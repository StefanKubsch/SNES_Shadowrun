import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveStateWriteToDispatch,
  describeStateWriteByteOwners,
  stateWriteWordConsequence,
} from './render-task-state-writes-source-proof.mjs';
import { compileScriptFrame, executableOpcodes } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-task-state-writes.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'state2EF8F1',
    0x80f8f1,
    0x80f902,
    9,
    '41a89df560bdf5dce0cc411135333e446a01c923292e460085730d66b17cb66c',
  ],
  [
    'state36F902',
    0x80f902,
    0x80f90f,
    7,
    '09d265d50ab80abc4d0f3a6a581afbdecf5501c3c24941c521cd9f783e86c628',
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
const entries = [0x80f8f1, 0x80f902],
  context = {
    d: 0x3d6,
    bank: 0x9d,
    s: 0x3f0,
    y: 4,
    pointerBefore: 0xa001,
    pointerAfter: 0xa001,
    offsetWord: 0x1234,
    stackWord: 0xab80,
  };
const own = (entry, patch = {}) => describeStateWriteByteOwners({ ...context, entry, ...patch });
const equation = (entry, patch = {}) => stateWriteWordConsequence({ ...context, entry, ...patch });
const addresses = (bs) => bs.map((b) => b.address),
  physical = (bs) => bs.map((b) => b.physical_address);
test('state writes40/21 independently pin allROMwindows and revision', () => {
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
});
test('2E/36 originaltable slots andactual separatefetchowners agree', async () => {
  for (const [op, pc, entry, hash] of [
    [
      0x2e,
      0x80f2e2,
      entries[0],
      'ab64f9837d2b0b719051ad0f129ee2c03de162b198772a7cf3e03c60a3f37f50',
    ],
    [
      0x36,
      0x80f2ea,
      entries[1],
      '1827936080ea874cfc6db868c214f95a83fb385a7161ab3e509165ed35b8a4e1',
    ],
  ]) {
    const off = cpuToOffset(pc, rom.length),
      raw = rom.subarray(off, off + 2);
    assert.equal(sha(raw), hash);
    assert.equal(raw.readUInt16LE(), entry & 65535);
    assert.deepEqual(
      report.dispatch_entries.find((d) => d.opcode === op),
      {
        opcode: op,
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
test('independentedgewalk verifies14/12 paths andfullPLA beforestore andfreshfetch', () => {
  for (const [n, entry] of entries.entries()) {
    let pc = entry;
    const seen = [],
      pops = [],
      stores = [];
    while (true) {
      const i = map.get(pc);
      assert.ok(i);
      assert.ok(!seen.includes(cpuLabel(pc)));
      seen.push(cpuLabel(pc));
      assert.ok(seen.length <= 14);
      if (i.mnemonic === 'PLA') pops.push(cpuLabel(pc));
      if (i.mnemonic === 'STA') stores.push(cpuLabel(pc));
      if (pc === 0x80f390) break;
      assert.notEqual(i.mode, 'rel8');
      pc = i.mnemonic === 'JMP' ? i.target : i.next;
    }
    assert.deepEqual(report.state_writes[n].visited, seen);
    assert.equal(seen.length, n ? 12 : 14);
    assert.equal(pops.length, 1);
    assert.equal(stores.length, 1);
    assert.ok(seen.indexOf(pops[0]) < seen.indexOf(stores[0]));
    assert.ok(seen.indexOf(stores[0]) < seen.indexOf('80:F389'));
    assert.deepEqual(proveStateWriteToDispatch(map, entry), report.state_writes[n]);
  }
});
test('2E actualWORD PLA precedesSEP20 BYTE longX store andREP20 WORDfetch', () => {
  for (const [pc, op, m] of [
    [0x80f8f6, 'PLA', 0],
    [0x80f8f7, 'SEP', 0],
    [0x80f8f9, 'STA', 1],
    [0x80f8fd, 'REP', 1],
    [0x80f8ff, 'JMP', 0],
  ]) {
    assert.equal(map.get(pc).mnemonic, op);
    assert.deepEqual(map.get(pc).state, { e: 0, m, x: 0 });
  }
  assert.equal(map.get(0x80f8f9).mode, 'longx');
  assert.equal(map.get(0x80f8f9).value, 0x7e0000);
  assert.equal(map.get(0x80f8f7).value, 32);
  assert.equal(map.get(0x80f8fd).value, 32);
});
test('36 WORDSTA andbothsources fullTAX/twoINY withoutStatepreread orPHA', () => {
  assert.equal(map.get(0x80f907).mnemonic, 'PLA');
  assert.equal(map.get(0x80f908).mnemonic, 'STA');
  assert.equal(map.get(0x80f908).mode, 'longx');
  assert.equal(map.get(0x80f908).value, 0x7e0000);
  assert.equal(map.get(0x80f908).state.m, 0);
  for (const p of report.state_writes) {
    assert.deepEqual(p.state_reads, []);
    assert.deepEqual(p.local_reads, []);
    assert.equal(p.offset_operand_bytes_consumed, 2);
    assert.equal(p.required_readable_operand_stack_bytes, 2);
    assert.equal(p.required_writable_operand_stack_bytes, 0);
  }
  assert.ok(![...map.values()].some((i) => ['PHA', 'STZ', 'LDX', 'ASL'].includes(i.mnemonic)));
});
test('alloffsetWORDs preservefullX and24bit Statewrites withodd/high/FFFF offsets', () => {
  for (let offsetWord = 0; offsetWord < 65536; offsetWord++)
    for (const entry of entries) {
      const p = own(entry, { offsetWord });
      assert.equal(p.index, offsetWord);
      assert.deepEqual(
        addresses(p.state_writes),
        Array.from({ length: entry === entries[0] ? 1 : 2 }, (_, n) =>
          cpuLabel(0x7e0000 + offsetWord + n),
        ),
      );
    }
});
test('2E atFFFF touchesonly7EFFFF while36 writesHigh7F0000 withoutbank7E wrap', () => {
  assert.deepEqual(addresses(own(entries[0], { offsetWord: 65535 }).state_writes), ['7E:FFFF']);
  assert.deepEqual(addresses(own(entries[1], { offsetWord: 65535 }).state_writes), [
    '7E:FFFF',
    '7F:0000',
  ]);
  assert.deepEqual(physical(own(entries[1], { offsetWord: 65535 }).state_writes), [
    '7E:FFFF',
    '7F:0000',
  ]);
});
test('allpoppedWORDs supplyonlyLow at2E/fullWORD at36 andretainhiddenHighA', () => {
  for (let stackWord = 0; stackWord < 65536; stackWord++)
    for (const entry of entries) {
      const p = equation(entry, { stackWord });
      assert.equal(p.write_value, entry === entries[0] ? stackWord % 256 : stackWord);
      assert.equal(p.a_before_next_fetch, stackWord);
    }
  for (const stackWord of [0, 128, 255, 256, 32768, 65535])
    for (const entry of entries)
      assert.deepEqual(
        own(entry, { stackWord }).state_writes.map((b) => [b.byte, b.value]),
        entry === entries[0]
          ? [['low', stackWord % 256]]
          : [
              ['low', stackWord % 256],
              ['high', Math.floor(stackWord / 256)],
            ],
      );
});
test('allD/DL values keepbank00 pointerwrap butStateaddresses independentofD', () => {
  for (let d = 0; d < 65536; d++) {
    const p = own(entries[1], { d });
    assert.deepEqual(
      addresses(p.operand_sources.pointer_reads),
      [d, (d + 1) % 65536].map(cpuLabel),
    );
    assert.deepEqual(addresses(p.state_writes), ['7E:1234', '7E:1235']);
  }
  assert.deepEqual(addresses(own(entries[0], { d: 255 }).operand_sources.pointer_reads), [
    '00:00FF',
    '00:0100',
  ]);
});
test('allS values readPLA low/high underS+2 beforewrites, noexplicitstackstore', () => {
  for (let s = 0; s < 65536; s++)
    for (const entry of entries) {
      const p = own(entry, { s });
      assert.deepEqual(
        addresses(p.stack_sources.word_reads),
        [(s + 1) % 65536, (s + 2) % 65536].map(cpuLabel),
      );
      assert.equal(p.output_operand_s, (s + 2) % 65536);
    }
  assert.deepEqual(addresses(own(entries[0], { s: 65535 }).stack_sources.word_reads), [
    '00:0000',
    '00:0001',
  ]);
});
test('allY WORDs consume2offsetbytes beforefetch then1opcodebyte withseparatewrap', () => {
  for (let y = 0; y < 65536; y++)
    for (const entry of entries) {
      const p = own(entry, { y });
      assert.equal(p.next_opcode_y, (y + 2) % 65536);
      assert.equal(p.frontier_y, (y + 3) % 65536);
    }
  for (const entry of entries) {
    assert.equal(own(entry, { y: 65534 }).next_opcode_y, 0);
    assert.equal(own(entry, { y: 65535 }).frontier_y, 2);
  }
});
test('256DBRs onlyselectstream data; State7E/7F andDP/PLA bank00 independent', () => {
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
      assert.deepEqual(
        addresses(p.state_writes),
        entry === entries[0] ? ['7E:FFFF'] : ['7E:FFFF', '7F:0000'],
      );
      assert.deepEqual(addresses(p.operand_sources.word_reads), [
        cpuLabel(bank * 65536 + 65535),
        cpuLabel(((bank + 1) % 256) * 65536),
      ]);
      assert.deepEqual(addresses(p.operand_sources.pointer_reads), ['00:FFFF', '00:0000']);
    }
  const p = own(entries[0], { bank: 255, y: 65535, pointerBefore: 65535, pointerAfter: 0 });
  assert.deepEqual(addresses(p.operand_sources.word_reads), ['00:FFFE', '00:FFFF']);
  assert.deepEqual(addresses(p.next_opcode_sources.word_reads), ['FF:0001', 'FF:0002']);
});
test('ignoredPLAHigh stillneedsreadowner for2E; plainSTA needsnoStatepreread/preservationread', () => {
  for (const entry of entries) {
    const p = own(entry, { bank: 0, y: 0, pointerBefore: 0x1fff, s: 0x1ffe });
    assert.deepEqual(physical(p.operand_sources.word_reads), ['7E:1FFF', null]);
    assert.deepEqual(physical(p.stack_sources.word_reads), ['7E:1FFF', null]);
    assert.ok(
      report.state_writes
        .find((p) => p.entry === cpuLabel(entry))
        .reads.every((r) => r.bytes === 2 && r.highbyte_required),
    );
    assert.ok(
      !p.ordered_accesses.some((a) => a.operation === 'read' && a.kind.startsWith('state-')),
    );
  }
});
test('Statewritesmayoverwriteownpointer/header: BYTEreplacesLow only andWORDreplacesboth', () => {
  for (const entry of entries) {
    const pointerAfter = entry === entries[0] ? 0x1234 : 0xab34,
      p = own(entry, {
        bank: 0x80,
        offsetWord: 0x3d6,
        pointerBefore: 0x1200,
        pointerAfter,
        stackWord: 0xab34,
      });
    assert.deepEqual(
      physical(p.state_writes),
      physical(p.next_opcode_sources.pointer_reads).slice(0, p.write_bytes),
    );
    assert.equal(p.operand_sources.word_reads[0].address, '80:1204');
    assert.equal(
      p.next_opcode_sources.word_reads[0].address,
      cpuLabel(0x800000 + pointerAfter + 6),
    );
    assert.equal(p.index, 0x3d6);
    assert.equal(p.a_before_next_fetch, 0xab34);
    for (const offsetWord of [0x3d8, 0x3da, 0x3dd, 0x3de])
      assert.equal(
        own(entry, { offsetWord }).state_writes[0].physical_address,
        cpuLabel(0x7e0000 + offsetWord),
      );
  }
  // Same low16 address outside the bank00 WRAM mirror does not establish alias.
  const separate = own(entries[1], { d: 65535, offsetWord: 65535 });
  assert.notEqual(
    separate.state_writes[0].physical_address,
    separate.operand_sources.pointer_reads[0].physical_address,
  );
});
test('StatewritesoverlaplatchedPLA/futureoperandbytes butplainstorehasnoimplicitstackinstruction', () => {
  for (const entry of entries) {
    const p = own(entry, { s: 0x3e8, offsetWord: 0x3e9, stackWord: 0xab80 });
    assert.deepEqual(
      physical(p.state_writes),
      physical(p.stack_sources.word_reads).slice(0, p.write_bytes),
    );
    assert.equal(p.a_before_next_fetch, 0xab80);
    const kinds = p.ordered_accesses.map((a) => a.kind);
    assert.ok(kinds.indexOf('PLA-WORD') < kinds.indexOf('state-low'));
    assert.ok(kinds.indexOf('state-low') < kinds.indexOf('next-pointer'));
    assert.equal(own(entry, { s: 0x3e8, offsetWord: 0x3eb }).state_writes[0].address, '7E:03EB');
  }
});
test('Statewritesaliasnextopcode afterfulloffsetread; freshWORDopcode isnotcached', () => {
  for (const entry of entries) {
    const p = own(entry, {
      bank: 0x80,
      y: 0,
      offsetWord: 0x3e9,
      pointerBefore: 0x3e7,
      pointerAfter: 0x3e7,
      stackWord: 0xab34,
    });
    assert.deepEqual(
      physical(p.state_writes),
      physical(p.next_opcode_sources.word_reads).slice(0, p.write_bytes),
    );
    assert.deepEqual(
      p.ordered_accesses.slice(-2).map((a) => a.kind),
      ['next-pointer', 'next-opcode-WORD'],
    );
    assert.equal(p.next_opcode_sources.word_reads.length, 2);
  }
  assert.ok(report.state_writes.every((p) => p.saved_frame_cursor_write === false));
});
test('WORDPLA NZ/fullHighA surviveSEP20/STA/REP20 whileC/V/I/decimalretained andfetchreplacesNZ', () => {
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30))
      for (const value of [0, 128, 256, 32768, 65535]) {
        const pla = (status & ~0x82) | (value >= 32768 ? 128 : 0) | (value === 0 ? 2 : 0),
          sep = pla | 32,
          rep = sep & ~32;
        assert.equal(rep, pla);
        assert.equal(rep & 0x4d, status & 0x4d);
        for (const opcode of [0, 1, 128, 255]) {
          const final = (rep & ~0x82) | (opcode === 0 ? 2 : 0);
          assert.equal(final & 0x4d, status & 0x4d);
          assert.equal(final & 128, 0);
        }
      }
  assert.ok(
    ![...map.values()].some((i) =>
      ['CLD', 'SED', 'CMP', 'CLC', 'SEC', 'ADC', 'SBC', 'XBA'].includes(i.mnemonic),
    ),
  );
});
test('allmissing/raw/state/mask/width/mode/bank/edge mutationsreject', () => {
  for (const entry of entries) {
    const [, , end] = windows.find((w) => w[1] === entry),
      local = new Map(
        [...map].filter(([pc]) => (pc >= entry && pc < end) || (pc >= 0x80f389 && pc < 0x80f393)),
      );
    assert.deepEqual(
      proveStateWriteToDispatch(local, entry),
      proveStateWriteToDispatch(map, entry),
    );
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveStateWriteToDispatch(missing, entry));
      for (const patch of [
        { length: i.length + 1 },
        { raw: Buffer.alloc(i.length) },
        { state: { e: 0, m: 1 - i.state.m, x: 0 } },
        { state: { e: 0, m: i.state.m, x: 1 } },
        { state: { e: 1, m: 1, x: 1 } },
        { state: {} },
        { next: i.next + 1 },
        { mode: 'absx' },
        { cpu: pc + 1 },
        { mnemonic: 'NOP' },
        { value: i.value + 1 },
        { target: i.target === undefined ? pc : i.target + 1 },
        { opcode: i.opcode ^ 1 },
      ]) {
        const m = new Map(local);
        m.set(pc, { ...i, ...patch });
        assert.throws(() => proveStateWriteToDispatch(m, entry));
      }
    }
  }
});
test('invalid/missingfullWORD/context fails; unsupportedhost2E/36 stopwithoutsidemutations', () => {
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
      for (const field of ['offsetWord', 'stackWord'])
        assert.throws(() => equation(entry, { [field]: value }), /WORD/);
    const op = n ? 0x36 : 0x2e;
    assert.ok(!executableOpcodes.includes(op));
    const f = compileScriptFrame([op, 255, 255, 0x56], { localBytes: 0, returnBytes: 0 })([0xab80]),
      before = f.snapshot();
    assert.throws(() => f.step(), /not implemented/);
    assert.deepEqual(f.snapshot(), before);
  }
  assert.throws(() => own(0x80f398), /Invalid/);
  assert.throws(() => equation(0x80f398), /Invalid/);
  assert.throws(() => proveStateWriteToDispatch(map, 0x80f398), /Invalid/);
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
});
test('C1CA/9178/central retain native/dynamic/globalstack boundary afterState-write source', async () => {
  const [visit, text, progress] = await Promise.all(
    ['analysis/render-c1ca.json', 'analysis/render-9178.json', 'docs/PORTIERUNGSSTAND.json'].map(
      async (p) => JSON.parse(await readFile(p, 'utf8')),
    ),
  );
  const s = visit.full_graph.supplied_opcode_sources.find(
    (s) => s.source === 'analysis/render-task-state-writes.json',
  );
  assert.deepEqual(s.entries, entries.map(cpuLabel));
  assert.deepEqual(s.operand_s_deltas, [2, 2]);
  assert.equal(s.outer_return_frames_added, 0);
  assert.equal(report.source_graph.source_closed_to_dispatch, true);
  assert.equal(report.source_graph.full_graph_closed, false);
  assert.equal(report.source_graph.native_binding, false);
  assert.equal(report.source_graph.minimum_protected_stack_bytes, null);
  assert.equal(visit.full_graph.closed, false);
  assert.equal(text.full_graph.closed, false);
  const group = progress.work_groups.find((g) => g.id === 'task-f378-state-writes');
  assert.equal(group.status, 'composition-required');
  assert.deepEqual(group.manual_native, {
    module: 'proof/task/state-writes.mjs',
    report: 'analysis/render-task-state-writes-native.json',
  });
});
