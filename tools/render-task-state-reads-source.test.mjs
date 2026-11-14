import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveStateReadToDispatch,
  describeStateReadByteOwners,
  stateReadWordConsequence,
} from './render-task-state-reads-source-proof.mjs';
import { compileScriptFrame, executableOpcodes } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-task-state-reads.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'state04F8D4',
    0x80f8d4,
    0x80f8e4,
    8,
    'c1f9eec5deb7dde5312713d961e5c500029c1839c7cd7e4db5cc903a3d7d5b34',
  ],
  [
    'state18F8E4',
    0x80f8e4,
    0x80f8f1,
    7,
    'c3fbabc28f8c3c0130be6764a63518ad7f5110fef2e8e7ae1e1f8e0eb115b562',
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
const entries = [0x80f8d4, 0x80f8e4],
  context = {
    d: 0x3d6,
    bank: 0x9d,
    s: 0x3f0,
    y: 4,
    pointerBefore: 0xa001,
    pointerAfter: 0xa001,
    offsetWord: 0x1234,
    stateWord: 0xab80,
  };
const own = (entry, patch = {}) => describeStateReadByteOwners({ ...context, entry, ...patch });
const equation = (entry, patch = {}) => stateReadWordConsequence({ ...context, entry, ...patch });
const addresses = (bs) => bs.map((b) => b.address),
  physical = (bs) => bs.map((b) => b.physical_address);
const at = (pc, op, value, mode) => {
  const i = map.get(pc);
  assert.ok(i, cpuLabel(pc));
  assert.equal(i.mnemonic, op);
  assert.deepEqual(i.state, { e: 0, m: 0, x: 0 });
  if (value !== undefined) assert.equal(i.target ?? i.value, value);
  if (mode !== undefined) assert.equal(i.mode, mode);
  return i;
};
// Independent ROM pins/edges and pure supplied equations; no memory/CPU runner.
test('state reads39/20 independently pins full ROMwindows and identity', () => {
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
  assert.equal(map.size, 20);
  assert.equal(report.source_graph.code_bytes, 39);
  assert.equal(report.source_graph.instructions, 20);
});
test('04/18 originaltable WORDs and separate sharedfetch source owners agree', async () => {
  for (const [opcode, pc, entry, hash] of [
    [
      0x04,
      0x80f2b8,
      entries[0],
      '522d2e5db894178675da591289872908da0ba671af0a07fcb959a9f94526040b',
    ],
    [
      0x18,
      0x80f2cc,
      entries[1],
      'd628ceb532de442a035bca07f30e4c4f0b376af1ef12b5712c4ff6d28bb48e75',
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
test('independent ROMedgewalk proves twoexactstraightpaths13/12 andfullState beforePHA/freshF389', () => {
  for (const [n, entry] of entries.entries()) {
    let pc = entry;
    const visited = [],
      pushes = [],
      reads = [];
    while (true) {
      const i = map.get(pc);
      assert.ok(i);
      assert.ok(!visited.includes(cpuLabel(pc)));
      visited.push(cpuLabel(pc));
      assert.ok(visited.length <= 13);
      if (i.mnemonic === 'PHA') pushes.push(cpuLabel(pc));
      if (i.mode === 'longx') reads.push(cpuLabel(pc));
      if (pc === 0x80f390) break;
      assert.notEqual(i.mode, 'rel8');
      pc = i.mnemonic === 'JMP' ? i.target : i.next;
    }
    assert.equal(visited.length, n ? 12 : 13);
    assert.deepEqual(visited, report.state_reads[n].visited);
    assert.equal(pushes.length, 1);
    assert.equal(reads.length, 1);
    assert.ok(visited.indexOf(reads[0]) < visited.indexOf(pushes[0]));
    assert.ok(visited.indexOf(pushes[0]) < visited.indexOf('80:F389'));
    assert.deepEqual(proveStateReadToDispatch(map, entry), report.state_reads[n]);
  }
});
test('04 full offsetWORD/twoINY/fullTAX/longX WORDstate precede mask/PHA', () => {
  at(0x80f8d4, 'LDA', 0, 'diy');
  at(0x80f8d6, 'INY');
  at(0x80f8d7, 'INY');
  at(0x80f8d8, 'TAX');
  at(0x80f8d9, 'LDA', 0x7e0000, 'longx');
  at(0x80f8dd, 'AND', 255, 'immM');
  at(0x80f8e0, 'PHA');
  at(0x80f8e1, 'JMP', 0x80f389, 'abs');
  assert.equal(
    report.state_reads[0].reads[1].mask_after_read,
    'WORD AND00FF; zeroextend stateLow after both reads',
  );
});
test('18 retainsboth Statebytes withsamefull offset/twoINY/TAX/longX source', () => {
  at(0x80f8e4, 'LDA', 0, 'diy');
  at(0x80f8e6, 'INY');
  at(0x80f8e7, 'INY');
  at(0x80f8e8, 'TAX');
  at(0x80f8e9, 'LDA', 0x7e0000, 'longx');
  at(0x80f8ed, 'PHA');
  at(0x80f8ee, 'JMP', 0x80f389, 'abs');
  for (const p of report.state_reads) {
    assert.deepEqual(p.local_reads, []);
    assert.deepEqual(p.state_writes, []);
    assert.deepEqual(
      p.reads.map((r) => r.kind),
      ['offset-operand', 'state', 'next-opcode'],
    );
    assert.equal(p.offset_operand_bytes_consumed, 2);
  }
  assert.ok(
    ![...map.values()].some((i) => ['STA', 'STZ', 'PLA', 'LDX', 'ASL'].includes(i.mnemonic)),
  );
});
test('all65536 offsetWORDs retainfullX and24bit Stateaddress includingodd/high/FFFF', () => {
  for (let offsetWord = 0; offsetWord < 65536; offsetWord++)
    for (const entry of entries) {
      const p = own(entry, { offsetWord });
      assert.equal(p.index, offsetWord);
      assert.deepEqual(
        addresses(p.state_sources.word_reads),
        [0x7e0000 + offsetWord, 0x7e0001 + offsetWord].map(cpuLabel),
      );
    }
  for (const offsetWord of [1, 255, 256, 0x8001, 65535])
    assert.equal(equation(entries[0], { offsetWord }).index, offsetWord);
});
test('StateWORD High atXFFFF crosses7EFFFF->7F0000 evenfor04 ignoredHigh', () => {
  for (const entry of entries) {
    const p = own(entry, { offsetWord: 65535 });
    assert.deepEqual(addresses(p.state_sources.word_reads), ['7E:FFFF', '7F:0000']);
    assert.deepEqual(physical(p.state_sources.word_reads), ['7E:FFFF', '7F:0000']);
    assert.equal(p.state_sources.word_reads.length, 2);
    assert.ok(
      report.state_reads.find((p) => p.entry === cpuLabel(entry)).reads[1].highbyte_required,
    );
  }
  assert.deepEqual(addresses(own(entries[1], { offsetWord: 0xfffe }).state_sources.word_reads), [
    '7E:FFFE',
    '7E:FFFF',
  ]);
});
test('allStateWORDs zeroextend04 low even80/FF while18 retainsoriginalfullWORD', () => {
  for (let stateWord = 0; stateWord < 65536; stateWord++)
    for (const entry of entries)
      assert.equal(
        equation(entry, { stateWord }).value,
        entry === entries[0] ? stateWord % 256 : stateWord,
      );
  for (const stateWord of [0, 0x80, 255, 256, 0x8000, 0xff80, 65535])
    for (const entry of entries) {
      const p = own(entry, { stateWord });
      assert.deepEqual(
        p.stack_writes.map((w) => [w.byte, w.value]),
        [
          ['high', entry === entries[0] ? 0 : Math.floor(stateWord / 256)],
          ['low', stateWord % 256],
        ],
      );
    }
});
test('allfullD values/lowbytes keepactualbank00 pointer wrap whileStateaddressesignoreD', () => {
  for (let d = 0; d < 65536; d++) {
    const p = own(entries[1], { d });
    assert.deepEqual(
      addresses(p.operand_sources.pointer_reads),
      [d, (d + 1) % 65536].map(cpuLabel),
    );
    assert.deepEqual(addresses(p.state_sources.word_reads), ['7E:1234', '7E:1235']);
  }
  assert.deepEqual(addresses(own(entries[0], { d: 255 }).operand_sources.pointer_reads), [
    '00:00FF',
    '00:0100',
  ]);
  assert.deepEqual(addresses(own(entries[1], { d: 65535 }).operand_sources.pointer_reads), [
    '00:FFFF',
    '00:0000',
  ]);
});
test('allS values PHAhigh/low underS-2 withnoreads andStateaddress independentofS', () => {
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
    report.state_reads.every(
      (p) =>
        p.required_readable_operand_stack_bytes === 0 &&
        p.required_writable_operand_stack_bytes === 2,
    ),
  );
});
test('allY values twoWORDINYbeforefetch andoneafterfetch withindependent16bitwrap', () => {
  for (let y = 0; y < 65536; y++)
    for (const entry of entries) {
      const p = own(entry, { y });
      assert.equal(p.next_opcode_y, (y + 2) % 65536);
      assert.equal(p.frontier_y, (y + 3) % 65536);
    }
  for (const entry of entries) {
    assert.equal(own(entry, { y: 65534 }).next_opcode_y, 0);
    assert.equal(own(entry, { y: 65535 }).next_opcode_y, 1);
    assert.equal(own(entry, { y: 65535 }).frontier_y, 2);
  }
});
test('256 DBRs affectstreamWORDs butStatebase7E andDP/stackbank00 remainfixed', () => {
  for (let bank = 0; bank < 256; bank++)
    for (const entry of entries) {
      const p = own(entry, {
        bank,
        d: 65535,
        y: 0,
        pointerBefore: 65535,
        pointerAfter: 65535,
        offsetWord: 65535,
      });
      assert.deepEqual(addresses(p.state_sources.word_reads), ['7E:FFFF', '7F:0000']);
      assert.deepEqual(addresses(p.stack_writes), addresses(own(entry).stack_writes));
      assert.deepEqual(addresses(p.operand_sources.pointer_reads), ['00:FFFF', '00:0000']);
      assert.deepEqual(addresses(p.operand_sources.word_reads), [
        cpuLabel(bank * 65536 + 65535),
        cpuLabel(((bank + 1) % 256) * 65536),
      ]);
    }
  const p = own(entries[0], { bank: 255, y: 65535, pointerBefore: 65535, pointerAfter: 0 });
  assert.deepEqual(addresses(p.operand_sources.word_reads), ['00:FFFE', '00:FFFF']);
  assert.deepEqual(addresses(p.next_opcode_sources.word_reads), ['FF:0001', 'FF:0002']);
});
test('full offset/state/nextopcode highbytes needactualreadowners despiteknownWRAM ormask', () => {
  for (const entry of entries) {
    const p = own(entry, { bank: 0, y: 0, pointerBefore: 0x1fff });
    assert.deepEqual(physical(p.operand_sources.word_reads), ['7E:1FFF', null]);
    const next = own(entry, { bank: 0, y: 0, pointerAfter: 0x1ffd });
    assert.deepEqual(physical(next.next_opcode_sources.word_reads), ['7E:1FFF', null]);
    assert.ok(
      report.state_reads
        .find((p) => p.entry === cpuLabel(entry))
        .reads.every((r) => r.bytes === 2 && r.highbyte_required),
    );
    assert.match(p.qualification, /not ownership/);
  }
});
test('fullState latchedbeforeoverlappingPHA throughbank00WRAM mirrors', () => {
  for (const entry of entries) {
    const p = own(entry, { offsetWord: 0x3e9, s: 0x3ea, stateWord: 0xab80 });
    assert.deepEqual(physical(p.stack_writes), physical(p.state_sources.word_reads).reverse());
    assert.deepEqual(
      p.stack_writes.map((w) => w.value),
      [entry === entries[0] ? 0 : 0xab, 128],
    );
    const kinds = p.ordered_accesses.map((a) => a.kind);
    assert.ok(kinds.indexOf('state-WORD') < kinds.indexOf('PHA-high'));
    assert.ok(kinds.indexOf('PHA-high') < kinds.indexOf('PHA-low'));
  }
  for (const entry of entries) {
    const p = own(entry, { offsetWord: 65535, s: 0 });
    assert.ok(!physical(p.state_sources.word_reads).includes(p.stack_writes[0].physical_address));
  }
});
test('State mayaliaspointer/header butreadsarebeforePHA; ownpointer overwrittenbeforefreshrefetch', () => {
  for (const entry of entries) {
    const value = entry === entries[0] ? 0x34 : 0x1234,
      p = own(entry, {
        bank: 0x80,
        s: 0x3d7,
        pointerBefore: 0x1200,
        pointerAfter: value,
        stateWord: 0x1234,
      });
    assert.deepEqual(
      physical(p.stack_writes),
      physical(p.next_opcode_sources.pointer_reads).reverse(),
    );
    assert.equal(p.operand_sources.word_reads[0].address, '80:1204');
    assert.equal(p.next_opcode_sources.word_reads[0].address, cpuLabel(0x800000 + value + 6));
    const header = own(entry, { offsetWord: 0x3d6 });
    assert.deepEqual(
      physical(header.state_sources.word_reads),
      physical(header.operand_sources.pointer_reads),
    );
    assert.deepEqual(addresses(own(entry, { s: 0x3de }).stack_writes), ['00:03DE', '00:03DD']);
  }
  assert.ok(report.state_reads.every((p) => p.saved_frame_cursor_write === false));
});
test('PHA aliases nextopcode bytes andfreshfullWORDopcode occursafterboth writes', () => {
  for (const entry of entries) {
    const p = own(entry, { d: 0x100, bank: 0x80, s: 0x3ea, y: 0, pointerAfter: 0x3e7 });
    assert.deepEqual(
      physical(p.stack_writes),
      physical(p.next_opcode_sources.word_reads).reverse(),
    );
    assert.deepEqual(
      p.ordered_accesses.slice(-4).map((a) => a.kind),
      ['PHA-high', 'PHA-low', 'next-pointer', 'next-opcode-WORD'],
    );
    assert.equal(p.next_opcode_sources.word_reads.length, 2);
  }
});
test('alllegalWORD statuses preservetheirCarry/V/I/decimal andfinalNZfromfreshopcode', () => {
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30))
      for (let opcode = 0; opcode < 256; opcode++) {
        const final = (status & ~0x82) | (opcode === 0 ? 2 : 0);
        assert.equal(final & 0x4d, status & 0x4d);
        assert.equal(final & 0x80, 0);
        assert.equal(Boolean(final & 2), opcode === 0);
      }
  assert.ok(
    ![...map.values()].some((i) =>
      ['CMP', 'CLD', 'SED', 'CLC', 'SEC', 'ADC', 'SBC', 'SEP', 'REP', 'PLB', 'TCD', 'TCS'].includes(
        i.mnemonic,
      ),
    ),
  );
  at(0x80f389, 'LDA', 0, 'diy');
  at(0x80f38b, 'INY');
  at(0x80f38c, 'AND', 255, 'immM');
  at(0x80f38f, 'TAX');
  at(0x80f390, 'JMP', 0xf2b4, 'indx');
  assert.ok(report.state_reads.every((p) => p.decimal_flag_required === null));
});
test('allmissing/raw/state/width/mode/value/edge mutationsreject includingBYTEstate/absX bankerror', () => {
  for (const entry of entries) {
    const [, , end] = windows.find((w) => w[1] === entry),
      local = new Map(
        [...map].filter(([pc]) => (pc >= entry && pc < end) || (pc >= 0x80f389 && pc < 0x80f393)),
      );
    assert.deepEqual(proveStateReadToDispatch(local, entry), proveStateReadToDispatch(map, entry));
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveStateReadToDispatch(missing, entry));
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
        assert.throws(() => proveStateReadToDispatch(m, entry));
      }
    }
  }
  for (const [entry, pc, patch] of [
    [entries[0], 0x80f8d9, { mode: 'absx' }],
    [entries[0], 0x80f8d8, { state: { e: 0, m: 0, x: 1 } }],
    [entries[1], 0x80f8e9, { value: 0x7f0000 }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveStateReadToDispatch(m, entry));
  }
});
test('invalid/missing fullWORD/context fails; unsupportedhost04/18 stopwithoutstateeffects', () => {
  for (const [n, entry] of entries.entries()) {
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
      for (const field of ['offsetWord', 'stateWord'])
        assert.throws(() => equation(entry, { [field]: value }), /WORD/);
    const op = n ? 0x18 : 0x04;
    assert.ok(!executableOpcodes.includes(op));
    const f = compileScriptFrame([op, 255, 255, 0x56], { localBytes: 0, returnBytes: 2 })([]),
      before = f.snapshot();
    assert.throws(() => f.step(), /not implemented/);
    assert.deepEqual(f.snapshot(), before);
  }
  assert.throws(() => own(0x80f398), /Invalid/);
  assert.throws(() => equation(0x80f398), /Invalid/);
  assert.throws(() => proveStateReadToDispatch(map, 0x80f398), /Invalid/);
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
  assert.match(report.contract.host_boundary, /explicitlyunsupported/);
});
test('C1CA/9178/central retain dynamic/native/globalstack boundaries afterStateread source', async () => {
  const [visit, text, progress] = await Promise.all(
    ['analysis/render-c1ca.json', 'analysis/render-9178.json', 'docs/PORTIERUNGSSTAND.json'].map(
      async (p) => JSON.parse(await readFile(p, 'utf8')),
    ),
  );
  const supplied = visit.full_graph.supplied_opcode_sources.find(
    (s) => s.source === 'analysis/render-task-state-reads.json',
  );
  assert.deepEqual(supplied.entries, entries.map(cpuLabel));
  assert.deepEqual(supplied.operand_s_deltas, [-2, -2]);
  assert.equal(supplied.outer_return_frames_added, 0);
  assert.equal(report.source_graph.source_closed_to_dispatch, true);
  assert.equal(report.source_graph.full_graph_closed, false);
  assert.equal(report.source_graph.native_binding, false);
  assert.equal(report.source_graph.minimum_protected_stack_bytes, null);
  assert.equal(visit.full_graph.closed, false);
  assert.equal(visit.full_graph.minimum_protected_stack_bytes, null);
  assert.equal(text.full_graph.closed, false);
  const group = progress.work_groups.find((g) => g.id === 'task-f378-state-reads');
  assert.equal(group.status, 'composition-required');
  assert.deepEqual(group.manual_native, {
    module: 'proof/task/state-reads.mjs',
    report: 'analysis/render-task-state-reads-native.json',
  });
  assert.ok(
    !progress.supplied.some((r) =>
      [...entries.map(cpuLabel), '80:C1CA', '80:9178'].includes(r.entry),
    ),
  );
});
