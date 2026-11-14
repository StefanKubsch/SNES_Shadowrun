import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveLocalReadToDispatch,
  describeLocalReadByteOwners,
  localReadWordConsequence,
} from './render-task-local-reads-source-proof.mjs';
import { compileScriptFrame, executableOpcodes } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-task-local-reads.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'local02F3A1',
    0x80f3a1,
    0x80f3b1,
    8,
    'd8162e2a5c30cbe3532f1251395b4c5ee923630285374260f39f9506e7f0b058',
  ],
  [
    'local16F3B9',
    0x80f3b9,
    0x80f3c6,
    7,
    '926157b9383c4b584fbb07c9e30154501cf7ede2e1d3b2a70941cb5d64737bc3',
  ],
  [
    'localC2F8CB',
    0x80f8cb,
    0x80f8d4,
    4,
    'eb02ec5952fae71311d2b4dfbec81ba52f00b977416152f367496ce014d4b163',
  ],
  [
    'fetchF389',
    0x80f389,
    0x80f393,
    5,
    '4c3f34f823702042ca64c29aeb6edbae702c6dfe3735c436921cd418d83c81cf',
  ],
];
const map = new Map();
for (const [, start, end] of windows)
  for (let pc = start; pc < end;) {
    const i = decode(rom, pc, { e: 0, m: 0, x: 0 });
    assert.ok(i.next <= end);
    map.set(pc, i);
    pc = i.next;
  }
const entries = [0x80f3a1, 0x80f3b9, 0x80f8cb];
const context = {
  d: 0x3d6,
  bank: 0x9d,
  s: 0x3f0,
  y: 4,
  pointerBefore: 0xa001,
  pointerAfter: 0xa001,
  indexWord: 1,
  localWord: 0xab80,
};
const own = (entry, patch = {}) => describeLocalReadByteOwners({ ...context, entry, ...patch });
const equation = (entry, patch = {}) => localReadWordConsequence({ ...context, entry, ...patch });
const addresses = (bs) => bs.map((b) => b.address),
  physical = (bs) => bs.map((b) => b.physical_address);
const at = (pc, op, value, mode) => {
  const i = map.get(pc);
  assert.ok(i, cpuLabel(pc));
  assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.target ?? i.value, value);
  if (mode !== undefined) assert.equal(i.mode, mode);
  return i;
};
// Independent pins/edges and synthetic equations; no CPU/memory/task execution.
test('local reads48/24 independently pin full ROMwindows and identity', () => {
  assert.equal(
    metadata.rom_sha256,
    '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690',
  );
  assert.equal(report.rom_sha256, metadata.rom_sha256);
  for (const [name, start, end, count, hash] of windows) {
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(sha(raw), hash);
    assert.equal([...map.keys()].filter((pc) => pc >= start && pc < end).length, count);
    assert.deepEqual(
      report.windows.find((w) => w.name === name),
      {
        name,
        entry: cpuLabel(start),
        end_exclusive: cpuLabel(end),
        covered_bytes: end - start,
        instruction_count: count,
        sha256: hash,
        machine_bytes: raw.toString('hex').toUpperCase(),
      },
    );
  }
  assert.equal(map.size, 24);
  assert.equal(report.source_graph.code_bytes, 48);
  assert.equal(report.source_graph.instructions, 24);
});
test('02/16/C2 originaltable slots and actual sharedfetch owners agree independently', async () => {
  for (const [opcode, source, target, hash] of [
    [2, 0x80f2b6, 0x80f3a1, '101f87f9a642ca427d156586438194ab7ce31acf4b8aac4b4371e43b6e716394'],
    [0x16, 0x80f2ca, 0x80f3b9, '3b597ac96c0bb917e545e934b0f800948cd1ef18c5a1c692d39220b6c6ed0778'],
    [0xc2, 0x80f376, 0x80f8cb, '3f7e0d8ceac7aa73d7b85e555b6eb417fcf7000cbc30fb826a4006b880ed727b'],
  ]) {
    const off = cpuToOffset(source, rom.length),
      raw = rom.subarray(off, off + 2);
    assert.equal(raw.readUInt16LE(), target & 65535);
    assert.equal(sha(raw), hash);
    assert.deepEqual(
      report.dispatch_entries.find((d) => d.opcode === opcode),
      {
        opcode,
        word_source: cpuLabel(source),
        target: cpuLabel(target),
        machine_bytes: raw.toString('hex').toUpperCase(),
        sha256: hash,
      },
    );
  }
  for (const d of report.dependencies) {
    const owner = JSON.parse(await readFile(d.report, 'utf8'));
    assert.equal(owner.rom_sha256, metadata.rom_sha256);
    assert.deepEqual(
      d.window,
      owner.windows.find((w) => w.name === d.window.name),
    );
    if (d.opcode_source_sha256)
      assert.equal(d.opcode_source_sha256, owner.dispatch.opcode_source.sha256);
  }
  assert.equal(report.dependencies[0].window.machine_bytes, report.windows.at(-1).machine_bytes);
  assert.equal(
    report.dependencies[1].window.machine_bytes.slice(34),
    report.windows.at(-1).machine_bytes,
  );
});
test('independent ROMedge walk matches three exact straightpaths and oneWORDPHA beforeF389', () => {
  for (const entry of entries) {
    let pc = entry;
    const visited = [],
      pushes = [];
    while (true) {
      const i = map.get(pc);
      assert.ok(i);
      assert.ok(!visited.includes(cpuLabel(pc)));
      visited.push(cpuLabel(pc));
      assert.ok(visited.length <= 13);
      if (i.mnemonic === 'PHA') pushes.push(cpuLabel(pc));
      if (pc === 0x80f390) break;
      assert.notEqual(i.mode, 'rel8');
      pc = i.mnemonic === 'JMP' ? i.target : i.next;
    }
    const p = report.local_reads.find((p) => p.entry === cpuLabel(entry));
    assert.deepEqual(p.visited, visited);
    assert.equal(pushes.length, 1);
    assert.equal(p.stack_writes[0].at, pushes[0]);
    assert.ok(visited.indexOf(pushes[0]) < visited.indexOf('80:F389'));
  }
});
test('02 fullindexWORD/INY/mask/TAX thenfullDP13X WORD/mask/PHA has actual13instruction path', () => {
  at(0x80f3a1, 'LDA', 0, 'diy');
  at(0x80f3a3, 'INY');
  at(0x80f3a4, 'AND', 255, 'immM');
  at(0x80f3a7, 'TAX');
  at(0x80f3a8, 'LDA', 0x13, 'dpx');
  at(0x80f3aa, 'AND', 255, 'immM');
  at(0x80f3ad, 'PHA');
  at(0x80f3ae, 'JMP', 0x80f389);
  const p = proveLocalReadToDispatch(map, entries[0]);
  assert.deepEqual(p, report.local_reads[0]);
  assert.equal(p.reachable_instructions, 13);
  assert.deepEqual(
    p.reads.map((r) => r.kind),
    ['index-operand', 'local', 'next-opcode'],
  );
  assert.equal(p.reads[1].mask_after_read, 'WORD AND00FF');
  assert.equal(p.stack_writes[0].byte, '00');
});
test('16 indexstillonebyte afterfullWORDread but localfullWORD isunmasked, PHA and12instruction path', () => {
  at(0x80f3b9, 'LDA', 0, 'diy');
  at(0x80f3bb, 'INY');
  at(0x80f3bc, 'AND', 255, 'immM');
  at(0x80f3bf, 'TAX');
  at(0x80f3c0, 'LDA', 0x13, 'dpx');
  at(0x80f3c2, 'PHA');
  at(0x80f3c3, 'JMP', 0x80f389);
  const p = proveLocalReadToDispatch(map, entries[1]);
  assert.deepEqual(p, report.local_reads[1]);
  assert.equal(p.reachable_instructions, 12);
  assert.equal(p.index_operand_bytes_consumed, 1);
  assert.equal(p.reads[1].mask_after_read, 'none; full WORD retained');
  assert.equal(p.stack_writes[0].byte, 'original local highbyte');
});
test('C2 actualdirectDP13 WORD/mask/PHA has noindexread/TAX/INY beforefetch and9instruction path', () => {
  at(0x80f8cb, 'LDA', 0x13, 'dp');
  at(0x80f8cd, 'AND', 255, 'immM');
  at(0x80f8d0, 'PHA');
  at(0x80f8d1, 'JMP', 0x80f389);
  const p = proveLocalReadToDispatch(map, entries[2]);
  assert.deepEqual(p, report.local_reads[2]);
  assert.equal(p.reachable_instructions, 9);
  assert.deepEqual(
    p.reads.map((r) => r.kind),
    ['local', 'next-opcode'],
  );
  assert.equal(p.y_delta_before_next_opcode, 0);
  assert.match(p.x_before_next_fetch, /entry X unchanged/);
  const a = own(entries[2], { pointerBefore: undefined, indexWord: undefined });
  assert.equal(a.operand_sources, null);
  assert.equal(a.index, null);
  assert.ok(!('indexWord' in a.context));
});
test('allindexWORDs maskhigh onlyafterread and all255 offsets includingodd/FF remainunclamped', () => {
  for (let indexWord = 0; indexWord < 65536; indexWord++)
    for (const entry of entries.slice(0, 2))
      assert.equal(equation(entry, { indexWord }).index, indexWord % 256);
  for (let index = 0; index < 256; index++)
    for (const d of [0, 0xed, 0xffec, 65535])
      for (const entry of entries.slice(0, 2)) {
        const p = own(entry, { d, indexWord: index + 0xff00 }),
          a = (d + 19 + index) % 65536;
        assert.deepEqual(addresses(p.local_sources.word_reads), [a, (a + 1) % 65536].map(cpuLabel));
      }
  assert.equal(own(entries[1], { indexWord: 65535 }).index, 255);
  assert.equal(own(entries[1], { indexWord: 1 }).local_sources.word_reads[0].address, '00:03EA');
});
test('alllocalWORDs zeroextendBYTE even80/FF whileWORD retainsbothbytes andPHAhighfirst', () => {
  for (let localWord = 0; localWord < 65536; localWord++)
    for (const entry of entries) {
      const value = entry === entries[1] ? localWord : localWord % 256;
      assert.equal(equation(entry, { localWord }).value, value);
    }
  for (const localWord of [0, 0x80, 0xff, 0x100, 0xff80, 65535])
    for (const entry of entries) {
      const p = own(entry, { localWord });
      assert.deepEqual(
        p.stack_writes.map((w) => [w.byte, w.value]),
        [
          ['high', entry === entries[1] ? Math.floor(localWord / 256) : 0],
          ['low', localWord % 256],
        ],
      );
    }
});
test('allD WORDvalues retainDL and bank00 localhighwrap ratherthan emulationpagewrap/DBR locals', () => {
  for (let d = 0; d < 65536; d++)
    for (const entry of entries) {
      const index = entry === entries[2] ? 0 : 255,
        p = own(entry, { d, indexWord: 65535 });
      const a = (d + 19 + index) % 65536;
      assert.deepEqual(addresses(p.local_sources.word_reads), [a, (a + 1) % 65536].map(cpuLabel));
    }
  assert.deepEqual(addresses(own(entries[2], { d: 0xffec }).local_sources.word_reads), [
    '00:FFFF',
    '00:0000',
  ]);
  assert.deepEqual(addresses(own(entries[2], { d: 0xec }).local_sources.word_reads), [
    '00:00FF',
    '00:0100',
  ]);
});
test('allS values/fourboundaryaddresses haveactualPHA high/low stores underS-2 withoutstackreads', () => {
  for (let s = 0; s < 65536; s++)
    for (const entry of entries) {
      const p = own(entry, { s });
      assert.deepEqual(addresses(p.stack_writes), [s, (s + 65535) % 65536].map(cpuLabel));
      assert.equal(p.output_operand_s, (s + 65534) % 65536);
    }
  for (const entry of entries) {
    assert.equal(own(entry, { s: 0 }).output_operand_s, 65534);
    assert.equal(own(entry, { s: 1 }).output_operand_s, 65535);
    assert.equal(own(entry, { s: 65535 }).output_operand_s, 65533);
  }
  assert.ok(
    report.local_reads.every(
      (p) =>
        p.required_readable_operand_stack_bytes === 0 &&
        p.required_writable_operand_stack_bytes === 2,
    ),
  );
});
test('allY WORDvalues advanceindexonce andfetchonce; C2 onlyfetch increment withindependentS', () => {
  for (let y = 0; y < 65536; y++)
    for (const entry of entries) {
      const width = entry === entries[2] ? 0 : 1,
        p = own(entry, { y });
      assert.equal(p.next_opcode_y, (y + width) % 65536);
      assert.equal(p.frontier_y, (y + width + 1) % 65536);
    }
  assert.equal(own(entries[0], { y: 65535 }).next_opcode_y, 0);
  assert.equal(own(entries[1], { y: 65535 }).frontier_y, 1);
  assert.equal(own(entries[2], { y: 65535 }).frontier_y, 0);
});
test('256DBRs affectindexedstreamWORDs whilelocal/stack/DPpointer bytes remainbank00 andwrap separately', () => {
  for (let bank = 0; bank < 256; bank++)
    for (const entry of entries) {
      const p = own(entry, { bank, d: 65535, y: 0, pointerBefore: 65535, pointerAfter: 65535 });
      assert.deepEqual(
        addresses(p.local_sources.word_reads),
        addresses(own(entry, { d: 65535 }).local_sources.word_reads),
      );
      assert.deepEqual(addresses(p.stack_writes), addresses(own(entry).stack_writes));
      assert.deepEqual(addresses(p.next_opcode_sources.pointer_reads), ['00:FFFF', '00:0000']);
      if (p.operand_sources)
        assert.deepEqual(addresses(p.operand_sources.word_reads), [
          cpuLabel(bank * 65536 + 65535),
          cpuLabel(((bank + 1) % 256) * 65536),
        ]);
    }
  const p = own(entries[0], { bank: 255, y: 65535, pointerBefore: 65535, pointerAfter: 0 });
  assert.deepEqual(addresses(p.operand_sources.word_reads), ['00:FFFE', '00:FFFF']);
  assert.deepEqual(addresses(p.next_opcode_sources.word_reads), ['FF:0000', 'FF:0001']);
});
test('ignoredindex andlocal highbytes requireowner evenwhenhigh isunmapped; BYTE masks nevertruncateactualreads', () => {
  const p = own(entries[0], { d: 0x1feb, indexWord: 1 });
  assert.deepEqual(addresses(p.local_sources.word_reads), ['00:1FFF', '00:2000']);
  assert.deepEqual(physical(p.local_sources.word_reads), ['7E:1FFF', null]);
  const index = own(entries[0], { bank: 0, y: 0, pointerBefore: 0x1fff });
  assert.deepEqual(physical(index.operand_sources.word_reads), ['7E:1FFF', null]);
  const direct = own(entries[2], { d: 0x1fec });
  assert.deepEqual(physical(direct.local_sources.word_reads), ['7E:1FFF', null]);
  assert.ok(
    report.local_reads.every((p) => p.reads.every((r) => r.bytes === 2 && r.highbyte_required)),
  );
});
test('localvalue islatched beforeoverlappingPHA andBYTEoverwritehigh doesnotalteralreadyreadlow', () => {
  for (const entry of entries) {
    const p = own(entry, { d: 0x3d6, indexWord: 0, s: 0x3ea, localWord: 0xab80 });
    assert.deepEqual(physical(p.stack_writes), physical(p.local_sources.word_reads).reverse());
    assert.deepEqual(
      p.stack_writes.map((w) => w.value),
      [entry === entries[1] ? 0xab : 0, 0x80],
    );
    const kinds = p.ordered_accesses.map((e) => e.kind);
    assert.ok(kinds.indexOf('local-WORD') < kinds.indexOf('PHA-high'));
    assert.ok(kinds.indexOf('PHA-high') < kinds.indexOf('PHA-low'));
  }
});
test('PHA updatespointer/control/S sources beforefreshrefetch; noexplicitframe7 cursorwrite', () => {
  for (const entry of entries) {
    const value = entry === entries[1] ? 0x1234 : 0x34,
      p = own(entry, {
        s: 0x3d7,
        bank: 0x80,
        pointerBefore: 0x1200,
        pointerAfter: value,
        localWord: 0x1234,
      });
    assert.deepEqual(
      physical(p.stack_writes),
      physical(p.next_opcode_sources.pointer_reads).reverse(),
    );
    assert.equal(
      p.next_opcode_sources.word_reads[0].address,
      cpuLabel(0x800000 + value + (entry === entries[2] ? 4 : 5)),
    );
    if (p.operand_sources) assert.equal(p.operand_sources.word_reads[0].address, '80:1204');
    assert.deepEqual(addresses(own(entry, { s: 0x3de }).stack_writes), ['00:03DE', '00:03DD']);
  }
  assert.ok(report.local_reads.every((p) => p.saved_frame_cursor_write === false));
  assert.match(report.contract.aliases, /notcached indexpointer/);
});
test('PHA canaliasnextopcode bytes andstill requiresfresh fullopcodeHigh afterbothwrites', () => {
  for (const entry of entries) {
    const p = own(entry, {
      d: 0x100,
      bank: 0x80,
      s: 0x3ea,
      y: 0,
      pointerAfter: entry === entries[2] ? 0x3e9 : 0x3e8,
    });
    assert.deepEqual(
      physical(p.stack_writes),
      physical(p.next_opcode_sources.word_reads).reverse(),
    );
    assert.deepEqual(
      p.ordered_accesses.slice(-4).map((e) => e.kind),
      ['PHA-high', 'PHA-low', 'next-pointer', 'next-opcode-WORD'],
    );
    assert.equal(p.next_opcode_sources.word_reads.length, 2);
  }
});
test('alllegal WORDstatuses preserveC/V/I/decimal, finalN0/Zfreshopcode independentofindex/local', () => {
  assert.ok(
    ![...map.values()].some((i) =>
      ['ADC', 'SBC', 'CLC', 'SEC', 'CLD', 'SED', 'SEP', 'REP', 'PLB', 'TCD', 'TCS', 'STA'].includes(
        i.mnemonic,
      ),
    ),
  );
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30))
      for (let low = 0; low < 256; low++) {
        const final = (status & ~0x82) | (low === 0 ? 2 : 0);
        assert.equal(final & 0x4d, status & 0x4d);
        assert.equal(final & 0x80, 0);
        assert.equal(Boolean(final & 2), low === 0);
      }
  for (const p of report.local_reads) {
    assert.equal(p.decimal_flag_required, null);
    assert.equal(p.frontier.x, 'Fresh next-opcode lowbyte');
  }
  at(0x80f389, 'LDA', 0, 'diy');
  at(0x80f38b, 'INY');
  at(0x80f38c, 'AND', 255, 'immM');
  at(0x80f38f, 'TAX');
  at(0x80f390, 'JMP', 0xf2b4, 'indx');
});
test('allmissing/raw/width/mode/value/target/edge mutations reject includingBYTE-LDA andindexed C2', () => {
  for (const entry of entries) {
    const [, , end] = windows.find((w) => w[1] === entry),
      local = new Map(
        [...map].filter(([pc]) => (pc >= entry && pc < end) || (pc >= 0x80f389 && pc < 0x80f393)),
      );
    assert.deepEqual(proveLocalReadToDispatch(local, entry), proveLocalReadToDispatch(map, entry));
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveLocalReadToDispatch(missing, entry));
      for (const patch of [
        { length: i.length + 1 },
        { raw: Buffer.alloc(i.length) },
        { state: { e: 0, m: 1, x: 0 } },
        { state: { e: 0, m: 0, x: 1 } },
        { state: { e: 1, m: 1, x: 1 } },
        { state: {} },
        { next: i.next + 1 },
        { mode: 'long' },
        { cpu: pc + 1 },
        { mnemonic: 'NOP' },
        { value: i.value + 1 },
        { target: i.target === undefined ? pc : i.target + 1 },
        { opcode: i.opcode ^ 1 },
      ]) {
        const m = new Map(local);
        m.set(pc, { ...i, ...patch });
        assert.throws(() => proveLocalReadToDispatch(m, entry));
      }
    }
  }
  for (const [entry, pc, patch] of [
    [entries[0], 0x80f3a8, { state: { e: 0, m: 1, x: 0 } }],
    [entries[1], 0x80f3c2, { mnemonic: 'PHX' }],
    [entries[2], 0x80f8cb, { mode: 'dpx' }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveLocalReadToDispatch(m, entry));
  }
});
test('invalid/missing fullWORD/context fails butC2 fabricatesnoindexowner andmapping authorizesnowrites', () => {
  for (const patch of [
    { d: -1 },
    { d: 65536 },
    { s: null },
    { y: undefined },
    { bank: -1 },
    { bank: 256 },
    { pointerBefore: undefined },
    { pointerAfter: undefined },
  ])
    assert.throws(() => own(entries[0], patch), /Explicit/);
  for (const value of [-1, 65536, null, undefined]) {
    assert.throws(() => equation(entries[0], { indexWord: value }), /WORD/);
    for (const entry of entries) assert.throws(() => equation(entry, { localWord: value }), /WORD/);
  }
  assert.doesNotThrow(() => own(entries[2], { pointerBefore: undefined, indexWord: undefined }));
  assert.throws(() => own(entries[2], { pointerAfter: undefined }), /Explicit/);
  assert.throws(() => equation(0x80f398), /Invalid/);
  assert.throws(() => own(0x80f398), /Invalid/);
  assert.throws(() => proveLocalReadToDispatch(map, 0x80f398), /Invalid/);
  assert.equal(own(entries[0], { s: 0x2000 }).stack_writes[0].physical_address, null);
  assert.equal(own(entries[1], { s: 0x8000 }).stack_writes[0].physical_address, '80:8000');
  assert.match(own(entries[0]).qualification, /not byte ownership/);
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
});
test('boundedhost agreesonscalars butomitsWORDhigh/physicalrefetch andretains initialization/capacity boundaries', () => {
  for (const [op, width] of [
    [2, 1],
    [0x16, 2],
    [0xc2, 1],
  ]) {
    assert.ok(executableOpcodes.includes(op));
    for (const value of [0, 1, 0x80, 0xff, 0x100, 0xab80, 65535]) {
      const code = [
          0x14,
          value & 255,
          value >>> 8,
          width === 2 ? 0x34 : 0x2c,
          0,
          op,
          ...(op === 0xc2 ? [] : [0]),
          0x56,
        ],
        f = compileScriptFrame(code, { localBytes: width, returnBytes: 2 })([]);
      f.step();
      f.step();
      f.step();
      assert.deepEqual(f.snapshot().stack, [width === 2 ? value : value % 256]);
      assert.equal(f.snapshot().pc, op === 0xc2 ? 6 : 7);
    }
  }
  // Host BYTE local0 works with ONE initialized byte; original C2 still reads localHigh.
  const f = compileScriptFrame([0x00, 0x80, 0x2c, 0, 0xc2, 0x56], {
    localBytes: 1,
    returnBytes: 2,
  })([]);
  f.step();
  f.step();
  f.step();
  assert.deepEqual(f.snapshot().stack, [0x80]);
  const uninitialized = compileScriptFrame([0xc2, 0x56], { localBytes: 1, returnBytes: 2 })([]);
  assert.throws(() => uninitialized.step(), /Uninitialized/);
  const outside = compileScriptFrame([2, 255, 0x56], { localBytes: 1, returnBytes: 2 })([]);
  assert.throws(() => outside.step(), /outside frame/);
  assert.equal(own(entries[0], { indexWord: 255 }).index, 255);
  assert.match(report.contract.host_boundary, /intentional coverage limits/);
});
test('C1CA/9178/central retaindynamic/native/globalstack boundaries despite closedlocalreads', async () => {
  const [visit, text, progress] = await Promise.all(
    ['analysis/render-c1ca.json', 'analysis/render-9178.json', 'docs/PORTIERUNGSSTAND.json'].map(
      async (p) => JSON.parse(await readFile(p, 'utf8')),
    ),
  );
  const supplied = visit.full_graph.supplied_opcode_sources.find(
    (s) => s.source === 'analysis/render-task-local-reads.json',
  );
  assert.deepEqual(supplied.entries, entries.map(cpuLabel));
  assert.deepEqual(supplied.operand_s_deltas, [-2, -2, -2]);
  assert.equal(supplied.outer_return_frames_added, 0);
  assert.equal(report.source_graph.source_closed_to_dispatch, true);
  assert.equal(report.source_graph.full_graph_closed, false);
  assert.equal(report.source_graph.native_binding, false);
  assert.equal(report.source_graph.minimum_protected_stack_bytes, null);
  assert.equal(visit.full_graph.closed, false);
  assert.equal(visit.full_graph.minimum_protected_stack_bytes, null);
  assert.equal(text.full_graph.closed, false);
  assert.ok(
    ['native-required', 'composition-required'].includes(
      progress.work_groups.find((g) => g.id === 'task-f378-local-reads').status,
    ),
  );
  assert.ok(
    !progress.supplied.some((r) =>
      [...entries.map(cpuLabel), '80:C1CA', '80:9178'].includes(r.entry),
    ),
  );
});
