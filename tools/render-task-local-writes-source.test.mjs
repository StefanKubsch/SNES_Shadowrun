import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveLocalWriteToDispatch,
  describeLocalWriteByteOwners,
  localWriteWordConsequence,
} from './render-task-local-writes-source-proof.mjs';
import { compileScriptFrame, executableOpcodes } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-task-local-writes.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'local2CF3C6',
    0x80f3c6,
    0x80f3d7,
    9,
    'bc079c9c6ca12854e024fcba340e0ec5a384a97ed2d926aa51a8a0983f282e07',
  ],
  [
    'local34F3D7',
    0x80f3d7,
    0x80f3e4,
    7,
    'f5e159488d497556be7b2114f9aaf9cae6a58d54fa888d91f60be972fe52e41f',
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
for (const [, start, end] of windows) {
  let state = { e: 0, m: 0, x: 0 };
  for (let pc = start; pc < end;) {
    const i = decode(rom, pc, state);
    assert.ok(i.next <= end);
    map.set(pc, i);
    pc = i.next;
    if (i.mnemonic === 'SEP') state = { ...state, m: 1 };
    if (i.mnemonic === 'REP') state = { ...state, m: 0 };
  }
}
const entries = [0x80f3c6, 0x80f3d7],
  context = {
    d: 0x3d6,
    bank: 0x9d,
    s: 0x3f0,
    y: 4,
    pointerBefore: 0xa001,
    pointerAfter: 0xa001,
    indexWord: 1,
    stackWord: 0xab80,
  };
const own = (entry, patch = {}) => describeLocalWriteByteOwners({ ...context, entry, ...patch });
const equation = (entry, patch = {}) => localWriteWordConsequence({ ...context, entry, ...patch });
const addresses = (bs) => bs.map((b) => b.address),
  physical = (bs) => bs.map((b) => b.physical_address);
const at = (pc, op, value, mode, m = 0) => {
  const i = map.get(pc);
  assert.ok(i, cpuLabel(pc));
  assert.equal(i.mnemonic, op);
  assert.deepEqual(i.state, { e: 0, m, x: 0 });
  if (value !== undefined) assert.equal(i.target ?? i.value, value);
  if (mode !== undefined) assert.equal(i.mode, mode);
  return i;
};
// Independent ROM pins, edges and synthetic consequences, no memory/CPU runner.
test('local writes40/21 independently pin ROM identity, bytes and windows', () => {
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
  assert.equal(map.size, 21);
  assert.equal(report.source_graph.code_bytes, 40);
  assert.equal(report.source_graph.instructions, 21);
});
test('2C/34 original table WORDs and separate fetch source owners agree', async () => {
  for (const [opcode, pc, entry, hash] of [
    [
      0x2c,
      0x80f2e0,
      entries[0],
      '57b6b68607b572c7253fb2c74b59b2d0b6b385734e3e2873089a660b1f18a5b5',
    ],
    [
      0x34,
      0x80f2e8,
      entries[1],
      'a0d01f5eef81549105934fd5e4aee7359ff0ac6610e793cf3c5950ad9ebd425c',
    ],
  ]) {
    const off = cpuToOffset(pc, rom.length),
      raw = rom.subarray(off, off + 2);
    assert.equal(raw.readUInt16LE(), entry & 65535);
    assert.equal(sha(raw), hash);
    assert.deepEqual(
      report.dispatch_entries.find((d) => d.opcode === opcode),
      {
        opcode,
        word_source: cpuLabel(pc),
        target: cpuLabel(entry),
        machine_bytes: raw.toString('hex').toUpperCase(),
        sha256: hash,
      },
    );
  }
  for (const d of report.dependencies) {
    const r = JSON.parse(await readFile(d.report, 'utf8'));
    assert.equal(r.rom_sha256, metadata.rom_sha256);
    assert.deepEqual(
      d.window,
      r.windows.find((w) => w.name === d.window.name),
    );
    if (d.opcode_source_sha256)
      assert.equal(d.opcode_source_sha256, r.dispatch.opcode_source.sha256);
  }
  assert.equal(report.dependencies[0].window.machine_bytes, report.windows.at(-1).machine_bytes);
  assert.equal(
    report.dependencies[1].window.machine_bytes.slice(34),
    report.windows.at(-1).machine_bytes,
  );
});
test('independent ROM edge walk proves14/12 paths and PLA/store before fresh F389', () => {
  for (const [n, entry] of entries.entries()) {
    let pc = entry;
    const visited = [],
      pops = [],
      stores = [];
    while (true) {
      const i = map.get(pc);
      assert.ok(i);
      assert.ok(!visited.includes(cpuLabel(pc)));
      visited.push(cpuLabel(pc));
      assert.ok(visited.length <= 14);
      if (i.mnemonic === 'PLA') pops.push(cpuLabel(pc));
      if (i.mnemonic === 'STA') stores.push(cpuLabel(pc));
      if (pc === 0x80f390) break;
      assert.notEqual(i.mode, 'rel8');
      pc = i.mnemonic === 'JMP' ? i.target : i.next;
    }
    const p = report.local_writes[n];
    assert.deepEqual(p.visited, visited);
    assert.equal(visited.length, n ? 12 : 14);
    assert.equal(pops.length, 1);
    assert.equal(stores.length, 1);
    assert.ok(visited.indexOf(pops[0]) < visited.indexOf(stores[0]));
    assert.ok(visited.indexOf(stores[0]) < visited.indexOf('80:F389'));
    assert.deepEqual(proveLocalWriteToDispatch(map, entry), p);
  }
});
test('2C full WORDindex/PLA precede actual SEP20 BYTEstore and REP20 WORDfetch', () => {
  at(0x80f3c6, 'LDA', 0, 'diy');
  at(0x80f3c8, 'INY');
  at(0x80f3c9, 'AND', 255, 'immM');
  at(0x80f3cc, 'TAX');
  at(0x80f3cd, 'PLA');
  at(0x80f3ce, 'SEP', 0x20, 'imm8');
  at(0x80f3d0, 'STA', 0x13, 'dpx', 1);
  at(0x80f3d2, 'REP', 0x20, 'imm8', 1);
  at(0x80f3d4, 'JMP', 0x80f389, 'abs');
  assert.equal(report.local_writes[0].local_write_bytes, 1);
  assert.equal(report.local_writes[0].reads[1].bytes, 2);
  assert.equal(report.local_writes[0].required_writable_operand_stack_bytes, 0);
});
test('34 retains full WORD mode and writes both poppedbytes without local preread', () => {
  at(0x80f3d7, 'LDA', 0, 'diy');
  at(0x80f3d9, 'INY');
  at(0x80f3da, 'AND', 255, 'immM');
  at(0x80f3dd, 'TAX');
  at(0x80f3de, 'PLA');
  at(0x80f3df, 'STA', 0x13, 'dpx');
  at(0x80f3e1, 'JMP', 0x80f389, 'abs');
  for (const p of report.local_writes) {
    assert.deepEqual(p.local_reads, []);
    assert.equal(p.required_readable_operand_stack_bytes, 2);
    assert.equal(p.operand_words_removed, 1);
    assert.equal(p.operand_s_delta, 2);
  }
  assert.ok(
    ![...map.values()].some((i) =>
      ['PHA', 'STZ', 'INC', 'DEC', 'TCS', 'TCD', 'PLB'].includes(i.mnemonic),
    ),
  );
});
test('all indexWORDs mask to fullWORD X0..255 including odd andFF offsets without ASL/cap', () => {
  for (let indexWord = 0; indexWord < 65536; indexWord++)
    for (const entry of entries)
      assert.equal(equation(entry, { indexWord }).index, indexWord % 256);
  for (let index = 0; index < 256; index++)
    for (const d of [0, 0xed, 0xffec, 65535])
      for (const entry of entries) {
        const p = own(entry, { d, indexWord: 0xff00 + index }),
          base = (d + 19 + index) % 65536;
        assert.deepEqual(
          addresses(p.local_writes),
          Array.from({ length: entry === entries[0] ? 1 : 2 }, (_, n) =>
            cpuLabel((base + n) % 65536),
          ),
        );
      }
});
test('all poppedWORDs supply BYTE low versus WORD both and retain full hidden high A', () => {
  for (let stackWord = 0; stackWord < 65536; stackWord++)
    for (const entry of entries) {
      const p = equation(entry, { stackWord });
      assert.equal(p.write_value, entry === entries[0] ? stackWord % 256 : stackWord);
      assert.equal(p.a_before_next_fetch, stackWord);
    }
  for (const stackWord of [0, 0x80, 255, 256, 0x8000, 0xff80, 65535])
    for (const entry of entries) {
      const p = own(entry, { stackWord });
      assert.deepEqual(
        p.local_writes.map((w) => [w.byte, w.value]),
        entry === entries[0]
          ? [['low', stackWord % 256]]
          : [
              ['low', stackWord % 256],
              ['high', Math.floor(stackWord / 256)],
            ],
      );
    }
});
test('all full D values keepDL and actual bank00 local wrap includingFFFF/0000 and00FF/0100', () => {
  for (let d = 0; d < 65536; d++)
    for (const entry of entries) {
      const p = own(entry, { d, indexWord: 65535 }),
        base = (d + 19 + 255) % 65536;
      assert.deepEqual(
        addresses(p.local_writes),
        Array.from({ length: entry === entries[0] ? 1 : 2 }, (_, n) =>
          cpuLabel((base + n) % 65536),
        ),
      );
    }
  assert.deepEqual(addresses(own(entries[1], { d: 0xffeb, indexWord: 1 }).local_writes), [
    '00:FFFF',
    '00:0000',
  ]);
  assert.deepEqual(addresses(own(entries[1], { d: 0xeb, indexWord: 1 }).local_writes), [
    '00:00FF',
    '00:0100',
  ]);
});
test('all S values read PLA low/high before stores and removeWORD underS+2 without stackwrites', () => {
  for (let s = 0; s < 65536; s++)
    for (const entry of entries) {
      const p = own(entry, { s });
      assert.deepEqual(
        addresses(p.stack_sources.word_reads),
        [(s + 1) % 65536, (s + 2) % 65536].map(cpuLabel),
      );
      assert.equal(p.output_operand_s, (s + 2) % 65536);
    }
  for (const entry of entries) {
    assert.deepEqual(addresses(own(entry, { s: 65535 }).stack_sources.word_reads), [
      '00:0000',
      '00:0001',
    ]);
    assert.equal(own(entry, { s: 65534 }).output_operand_s, 0);
  }
});
test('all Y WORDvalues increment indexonce and nextfetchonce with separate wrap', () => {
  for (let y = 0; y < 65536; y++)
    for (const entry of entries) {
      const p = own(entry, { y });
      assert.equal(p.next_opcode_y, (y + 1) % 65536);
      assert.equal(p.frontier_y, (y + 2) % 65536);
    }
  assert.equal(own(entries[0], { y: 65535 }).next_opcode_y, 0);
  assert.equal(own(entries[1], { y: 65535 }).frontier_y, 1);
});
test('256 DBRs only affect indexedstream while DP/local/PLA staybank00; stream wraps24bits', () => {
  for (let bank = 0; bank < 256; bank++)
    for (const entry of entries) {
      const p = own(entry, { bank, d: 65535, y: 0, pointerBefore: 65535, pointerAfter: 65535 });
      assert.deepEqual(addresses(p.local_writes), addresses(own(entry, { d: 65535 }).local_writes));
      assert.deepEqual(
        addresses(p.stack_sources.word_reads),
        addresses(own(entry).stack_sources.word_reads),
      );
      assert.deepEqual(addresses(p.operand_sources.pointer_reads), ['00:FFFF', '00:0000']);
      assert.deepEqual(addresses(p.operand_sources.word_reads), [
        cpuLabel(bank * 65536 + 65535),
        cpuLabel(((bank + 1) % 256) * 65536),
      ]);
    }
  const p = own(entries[0], { bank: 255, y: 65535, pointerBefore: 65535, pointerAfter: 0 });
  assert.deepEqual(addresses(p.operand_sources.word_reads), ['00:FFFE', '00:FFFF']);
  assert.deepEqual(addresses(p.next_opcode_sources.word_reads), ['FF:0000', 'FF:0001']);
});
test('BYTEstore needs onlyone writeowner but full index/PLA ignored highbytes still require readowners', () => {
  const p = own(entries[0], { d: 0x1feb, indexWord: 1, s: 0x1ffe });
  assert.deepEqual(addresses(p.local_writes), ['00:1FFF']);
  assert.deepEqual(physical(p.local_writes), ['7E:1FFF']);
  assert.deepEqual(physical(p.stack_sources.word_reads), ['7E:1FFF', null]);
  assert.equal(own(entries[1], { d: 0x1feb, indexWord: 1 }).local_writes[1].physical_address, null);
  assert.deepEqual(
    physical(own(entries[0], { bank: 0, y: 0, pointerBefore: 0x1fff }).operand_sources.word_reads),
    ['7E:1FFF', null],
  );
  assert.ok(
    report.local_writes.every((p) => p.reads.every((r) => r.bytes === 2 && r.highbyte_required)),
  );
  for (const entry of entries) {
    assert.deepEqual(
      own(entry)
        .ordered_accesses.filter((a) => a.kind.startsWith('local-'))
        .map((a) => a.operation),
      entry === entries[0] ? ['write'] : ['write', 'write'],
    );
  }
});
test('all localoffsets exclude own19byte header modulo65536 even atwrappedD', () => {
  // Offset translation is bijective modulo65536: check every local offset/header pair,
  // then independently check the translation boundary for every D.
  for (let index = 0; index < 256; index++)
    for (let n = 0; n < 2; n++)
      for (let header = 0; header < 19; header++)
        assert.notEqual((19 + index + n - header + 65536) % 65536, 0);
  for (let d = 0; d < 65536; d++) {
    const p = own(entries[1], { d, indexWord: 0 }),
      base = (d + 19) % 65536;
    assert.notEqual(base, d);
    assert.notEqual(base, (d + 1) % 65536);
    assert.equal(p.local_writes[0].address, cpuLabel(base));
  }
  assert.match(report.contract.header_disjoint, /disjointfromownframeheader/);
  assert.match(report.contract.aliases, /do notassert externalchanges orownpointeroverwrite/);
});
test('local stores may alias popped orfuturestack; full PLA latched before bothlocalwrites', () => {
  for (const entry of entries) {
    const p = own(entry, { indexWord: 0, s: 0x3e8, stackWord: 0xab80 });
    assert.deepEqual(
      physical(p.local_writes),
      physical(p.stack_sources.word_reads).slice(0, p.write_bytes),
    );
    assert.equal(p.a_before_next_fetch, 0xab80);
    const kinds = p.ordered_accesses.map((a) => a.kind);
    assert.ok(kinds.indexOf('PLA-WORD') < kinds.indexOf('local-low'));
    assert.ok(kinds.indexOf('local-low') < kinds.indexOf('next-pointer'));
    const future = own(entry, { indexWord: 2, s: 0x3e7 });
    assert.equal(future.local_writes[0].address, cpuLabel(0x3eb));
  }
  assert.equal(own(entries[0], { indexWord: 0, s: 0x3e8 }).local_writes.length, 1);
  assert.equal(own(entries[1], { indexWord: 0, s: 0x3e8 }).local_writes.length, 2);
});
test('local store aliases othercontrol/nextopcode while freshWORD fetch occursafter allstores', () => {
  for (const entry of entries) {
    const p = own(entry, {
      bank: 0x80,
      y: 0,
      indexWord: 0,
      pointerBefore: 0x3e8,
      pointerAfter: 0x3e8,
      stackWord: 0xab34,
    });
    assert.deepEqual(
      physical(p.local_writes),
      physical(p.next_opcode_sources.word_reads).slice(0, p.write_bytes),
    );
    assert.equal(p.index, 0);
    assert.equal(p.operand_sources.word_reads[1].address, '80:03E9');
    assert.equal(p.next_opcode_sources.word_reads[0].address, '80:03E9');
    assert.deepEqual(
      p.ordered_accesses.slice(-2).map((a) => a.kind),
      ['next-pointer', 'next-opcode-WORD'],
    );
    assert.equal(p.next_opcode_sources.word_reads.length, 2);
    const fresh = own(entry, { pointerBefore: 0xa001, pointerAfter: 0xb123 });
    assert.equal(fresh.operand_sources.word_reads[0].address, '9D:A005');
    assert.equal(fresh.next_opcode_sources.word_reads[0].address, '9D:B128');
  }
  assert.ok(report.local_writes.every((p) => p.saved_frame_cursor_write === false));
  assert.match(report.contract.aliases, /othercontrol\/outerstack/);
});
test('PLA N/Z depend fullWORD; SEP20/STA/REP20 preserveflags andhighA until freshWORD opcode', () => {
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30))
      for (const value of [0, 0x80, 0x100, 0x8000, 65535]) {
        const pla = (status & ~0x82) | (value >= 32768 ? 0x80 : 0) | (value === 0 ? 2 : 0),
          sep = pla | 0x20,
          rep = sep & ~0x20;
        assert.equal(rep, pla);
        assert.equal(rep & 0x4d, status & 0x4d);
        if (value === 0x100) assert.equal(rep & 2, 0);
        if (value === 0x80) assert.equal(rep & 0x80, 0);
        for (const low of [0, 1, 0x80, 255]) {
          const final = (rep & ~0x82) | (low === 0 ? 2 : 0);
          assert.equal(final & 0x4d, status & 0x4d);
          assert.equal(final & 0x80, 0);
          assert.equal(Boolean(final & 2), low === 0);
        }
      }
  at(0x80f389, 'LDA', 0, 'diy');
  at(0x80f38b, 'INY');
  at(0x80f38c, 'AND', 255, 'immM');
  at(0x80f38f, 'TAX');
  at(0x80f390, 'JMP', 0xf2b4, 'indx');
  assert.ok(
    ![...map.values()].some((i) =>
      ['CLD', 'SED', 'ADC', 'SBC', 'CLC', 'SEC', 'XBA'].includes(i.mnemonic),
    ),
  );
  assert.ok(report.local_writes.every((p) => p.decimal_flag_required === null));
});
test('all missing/raw/width/state/mode/mask/edge mutations reject including BYTEPLA ormissingREP', () => {
  for (const entry of entries) {
    const [, , end] = windows.find((w) => w[1] === entry),
      local = new Map(
        [...map].filter(([pc]) => (pc >= entry && pc < end) || (pc >= 0x80f389 && pc < 0x80f393)),
      );
    assert.deepEqual(
      proveLocalWriteToDispatch(local, entry),
      proveLocalWriteToDispatch(map, entry),
    );
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveLocalWriteToDispatch(missing, entry));
      for (const patch of [
        { length: i.length + 1 },
        { raw: Buffer.alloc(i.length) },
        { state: { e: 0, m: 1 - i.state.m, x: 0 } },
        { state: { e: 0, m: i.state.m, x: 1 } },
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
        assert.throws(() => proveLocalWriteToDispatch(m, entry));
      }
    }
  }
  for (const [pc, patch] of [
    [0x80f3cd, { state: { e: 0, m: 1, x: 0 } }],
    [0x80f3d0, { state: { e: 0, m: 0, x: 0 } }],
    [0x80f3ce, { value: 0x30 }],
    [0x80f3d2, { value: 0x10 }],
    [0x80f3df, { mode: 'absx' }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveLocalWriteToDispatch(m, pc === 0x80f3df ? entries[1] : entries[0]));
  }
});
test('invalid/missing fullWORD/address context fails; mapping authorizesnowrites', () => {
  for (const entry of entries) {
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
      assert.throws(() => own(entry, patch), /Explicit/);
    for (const value of [-1, 65536, null, undefined])
      for (const field of ['indexWord', 'stackWord'])
        assert.throws(() => equation(entry, { [field]: value }), /WORD/);
  }
  assert.throws(() => equation(0x80f398), /Invalid/);
  assert.throws(() => own(0x80f398), /Invalid/);
  assert.throws(() => proveLocalWriteToDispatch(map, 0x80f398), /Invalid/);
  assert.equal(
    own(entries[0], { d: 0x7feb, indexWord: 2 }).local_writes[0].physical_address,
    '80:8000',
  );
  assert.match(own(entries[0]).qualification, /not byte ownership/);
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
});
test('boundedhost agrees on BYTE/WORD scalars and preserves otherlocalbyte butcannot supply originalowners', () => {
  for (const [op, width] of [
    [0x2c, 1],
    [0x34, 2],
  ]) {
    assert.ok(executableOpcodes.includes(op));
    for (const value of [0, 1, 0x80, 255, 256, 0xab80, 65535]) {
      const f = compileScriptFrame([op, 1, 0x56], { localBytes: 3, returnBytes: 0 })([value]);
      f.step();
      const snap = f.snapshot();
      assert.deepEqual(snap.stack, []);
      assert.equal(snap.pc, 2);
      const result = f.step();
      assert.equal(result.locals[1], value % 256);
      assert.equal(result.locals[2], width === 2 ? Math.floor(value / 256) : 0);
    }
  }
  const preserve = compileScriptFrame([0x34, 0, 0x2c, 0, 0x56], { localBytes: 2, returnBytes: 0 })([
    0xab80, 0xcc55,
  ]);
  preserve.step();
  preserve.step();
  assert.deepEqual([...preserve.step().locals], [0x80, 0xcc]);
  const outside = compileScriptFrame([0x34, 255, 0x56], { localBytes: 255, returnBytes: 0 })([
    0x1234,
  ]);
  assert.throws(() => outside.step(), /outside frame/);
  const empty = compileScriptFrame([0x2c, 0, 0x56], { localBytes: 1, returnBytes: 0 })([]);
  assert.throws(() => empty.step(), /underflow/);
  assert.equal(own(entries[1], { indexWord: 255 }).index, 255);
  assert.match(report.contract.host_boundary, /doesnot supplyoriginalindexHigh\/PLAHigh/);
});
test('C1CA/9178/central retain full dynamic/native/globalstack boundaries after localwrite sources', async () => {
  const [visit, text, progress] = await Promise.all(
    ['analysis/render-c1ca.json', 'analysis/render-9178.json', 'docs/PORTIERUNGSSTAND.json'].map(
      async (p) => JSON.parse(await readFile(p, 'utf8')),
    ),
  );
  const supplied = visit.full_graph.supplied_opcode_sources.find(
    (s) => s.source === 'analysis/render-task-local-writes.json',
  );
  assert.deepEqual(supplied.entries, entries.map(cpuLabel));
  assert.deepEqual(supplied.operand_s_deltas, [2, 2]);
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
      progress.work_groups.find((g) => g.id === 'task-f378-local-writes').status,
    ),
  );
  assert.ok(
    !progress.supplied.some((r) =>
      [...entries.map(cpuLabel), '80:C1CA', '80:9178'].includes(r.entry),
    ),
  );
});
