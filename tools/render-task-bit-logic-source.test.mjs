import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveBitLogicToDispatch,
  describeBitLogicByteOwners,
  bitLogicWord,
} from './render-task-bit-logic-source-proof.mjs';
import { compileScriptFrame } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-task-bit-logic.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'andF715',
    0x80f715,
    0x80f71d,
    4,
    '2ab3b241cc1b2fa2026e8778e572218c6200438d1f8a58c93f64b46027cf16e5',
  ],
  [
    'orF71D',
    0x80f71d,
    0x80f725,
    4,
    '3d363b4510deb62f96585ffceab6ceaf56109263d6dee9b16eb105d4189d8188',
  ],
  [
    'xorF725',
    0x80f725,
    0x80f72d,
    4,
    'd68e45325d7f858ead9a8f4f4b252c07a55690971a934f2f8bbc7db2904f1639',
  ],
  [
    'notF72D',
    0x80f72d,
    0x80f735,
    4,
    '156b15f112adbcf86bd94ffb8b2bc591c337b20bc81d6fda908e4d74f16b4838',
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
const at = (pc, op, value, mode) => {
  const i = map.get(pc);
  assert.ok(i, cpuLabel(pc));
  assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.target ?? i.value, value);
  if (mode !== undefined) assert.equal(i.mode, mode);
  return i;
};
const context = { d: 0x3d6, bank: 0x9d, s: 0x3f0, y: 4, pointerAfter: 0xa001 };
const own = (entry, patch = {}) => describeBitLogicByteOwners({ ...context, entry, ...patch });
const addresses = (p) => p.stack_operations.map((o) => o.bytes.map((b) => b.address));
const entries = [0x80f715, 0x80f71d, 0x80f725, 0x80f72d];
// Independent pins and synthetic bit/address equations only, no CPU/Task/scene run.
test('bit logic42/21 independently pins ROM identity and complete windows/counts/hashes', () => {
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
  assert.equal(report.source_graph.code_bytes, 42);
  assert.equal(report.source_graph.instructions, 21);
});
test('7E/80/82/84 literalWORD tablepins and actual sharedfetch owners agree independently', async () => {
  for (const [opcode, source, target, hash] of [
    [0x7e, 0x80f332, 0x80f715, '1c00aed37f26e390b8c66d27c3c9e34aa2f75f9c0ed14e507ccdb1d502b7d642'],
    [0x80, 0x80f334, 0x80f71d, '5e0aaff9b30612cc3f748aa6052152b40d4bbb7d3a054bd085aa6f1d410b8609'],
    [0x82, 0x80f336, 0x80f725, '8009de765b05be4fc9d2f5eb863c7354f39673265f6e1ca3ffeaa6f8f5e32852'],
    [0x84, 0x80f338, 0x80f72d, '3d2dc12b42ecc0457585ab1a64f375e2d3050621c01fea87b0bce44fa8344c36'],
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
  }
  assert.equal(report.dependencies[0].window.machine_bytes, report.windows.at(-1).machine_bytes);
  assert.equal(
    report.dependencies[1].window.machine_bytes.slice(34),
    report.windows.at(-1).machine_bytes,
  );
});
test('AND/OR/XOR pop right first then read/store full leftWORD relative to updatedS, without resultPHA', () => {
  for (const [entry, op] of [
    [0x80f715, 'AND'],
    [0x80f71d, 'ORA'],
    [0x80f725, 'EOR'],
  ]) {
    at(entry, 'PLA');
    at(entry + 1, op, 1, 'sr');
    at(entry + 3, 'STA', 1, 'sr');
    at(entry + 5, 'JMP', 0x80f389, 'abs');
    const p = proveBitLogicToDispatch(map, entry);
    assert.deepEqual(
      p,
      report.bit_logic.find((p) => p.entry === cpuLabel(entry)),
    );
    assert.equal(p.reachable_instructions, 9);
    assert.equal(p.operand_s_delta, 2);
    assert.equal(p.operand_words_removed, 1);
    assert.equal(p.required_readable_operand_stack_bytes, 4);
    assert.deepEqual(
      p.stack_operations.map((o) => [o.kind, o.s_delta, o.offset]),
      [
        ['read', 0, 1],
        ['read', 2, 1],
        ['write', 2, 1],
      ],
    );
    assert.deepEqual(addresses(own(entry)), [
      ['00:03F1', '00:03F2'],
      ['00:03F3', '00:03F4'],
      ['00:03F3', '00:03F4'],
    ]);
    assert.deepEqual(
      own(entry)
        .stack_operations.at(-1)
        .bytes.map((b) => b.byte),
      ['low', 'high'],
    );
  }
});
test('NOT is fullWORD immediateFFFF EOR between PLA/PHA, high-first overwrite restoresS', () => {
  at(0x80f72d, 'PLA');
  at(0x80f72e, 'EOR', 65535, 'immM');
  at(0x80f731, 'PHA');
  at(0x80f732, 'JMP', 0x80f389);
  const p = proveBitLogicToDispatch(map, 0x80f72d);
  assert.deepEqual(p, report.bit_logic[3]);
  assert.equal(p.reachable_instructions, 9);
  assert.equal(p.operand_s_delta, 0);
  assert.equal(p.required_readable_operand_stack_bytes, 2);
  assert.equal(p.required_writable_operand_stack_bytes, 2);
  assert.equal(p.stack_operations.at(-1).s_delta, 2);
  assert.equal(p.stack_operations.at(-1).offset, -1);
  assert.deepEqual(addresses(own(0x80f72d)), [
    ['00:03F1', '00:03F2'],
    ['00:03F2', '00:03F1'],
  ]);
  assert.equal(own(0x80f72d).s_after_pla, 0x3f2);
});
test('independent perbit truth tables cover everyWORD against boundary/mask partners without signed/boolean normalization', () => {
  const truth = (entry, left, right) => {
    let n = 0;
    for (let bit = 0; bit < 16; bit++) {
      const weight = 2 ** bit,
        a = Math.floor(left / weight) % 2,
        b = Math.floor(right / weight) % 2;
      const set =
        entry === 0x80f715 ? a === 1 && b === 1 : entry === 0x80f71d ? a === 1 || b === 1 : a !== b;
      if (set) n += weight;
    }
    return n;
  };
  for (let left = 0; left < 65536; left++)
    for (const right of [0, 1, 0xff, 0x100, 0x7fff, 0x8000, 0xaaaa, 0xffff])
      for (const entry of entries.slice(0, 3))
        assert.equal(bitLogicWord(entry, left, right), truth(entry, left, right));
  assert.equal(bitLogicWord(0x80f715, 0xf0f0, 0xff00), 0xf000);
  assert.equal(bitLogicWord(0x80f71d, 0xf0f0, 0x0f0f), 65535);
  assert.equal(bitLogicWord(0x80f725, 0xaaaa, 0xffff), 0x5555);
});
test('everyWORD NOT preserves16bit complement, with exactzero/FFFF/highbyte values and no truth conversion', () => {
  for (let value = 0; value < 65536; value++)
    assert.equal(bitLogicWord(0x80f72d, value), 65535 - value);
  assert.equal(bitLogicWord(0x80f72d, 0x8000), 0x7fff);
  assert.equal(bitLogicWord(0x80f72d, 1), 0xfffe);
  assert.equal(bitLogicWord(0x80f72d, 65535), 0);
  assert.equal(bitLogicWord(0x80f72d, 0), 65535);
});
test('all16bit S values keep bank00 low/high STA versus high/low PHA order and exact finalS', () => {
  for (let s = 0; s < 65536; s++)
    for (const entry of [0x80f715, 0x80f72d]) {
      const p = own(entry, { s }),
        top = [(s + 1) % 65536, (s + 2) % 65536],
        left = [(s + 3) % 65536, (s + 4) % 65536],
        unary = entry === 0x80f72d;
      assert.equal(new Set([...top, ...left]).size, 4);
      assert.deepEqual(
        addresses(p),
        (unary ? [top, top.slice().reverse()] : [top, left, left]).map((pair) =>
          pair.map(cpuLabel),
        ),
      );
      assert.equal(p.output_operand_s, unary ? s : (s + 2) % 65536);
      assert.equal(p.s_after_pla, (s + 2) % 65536);
    }
  assert.deepEqual(addresses(own(0x80f715, { s: 0xfffc })).at(-1), ['00:FFFF', '00:0000']);
  assert.deepEqual(addresses(own(0x80f72d, { s: 0xfffe })).at(-1), ['00:0000', '00:FFFF']);
});
test('all256 DBRs leave operandstack bank00; fullD pointerwrap and24bit fetchWORD bankcarry stay separate', () => {
  for (let bank = 0; bank < 256; bank++) {
    const p = own(0x80f71d, { bank, d: 0xffff, y: 1, pointerAfter: 0xffff });
    assert.deepEqual(addresses(p), addresses(own(0x80f71d)));
    assert.deepEqual(
      p.next_opcode_sources.pointer_reads.map((b) => b.address),
      ['00:FFFF', '00:0000'],
    );
    assert.deepEqual(
      p.next_opcode_sources.word_reads.map((b) => b.address),
      [cpuLabel(((bank + 1) & 255) * 65536), cpuLabel(((bank + 1) & 255) * 65536 + 1)],
    );
  }
  assert.deepEqual(
    own(0x80f72d, { bank: 255, y: 0, pointerAfter: 65535 }).next_opcode_sources.word_reads.map(
      (b) => b.address,
    ),
    ['FF:FFFF', '00:0000'],
  );
  assert.equal(own(0x80f725, { y: 65535 }).next_opcode_y, 65535);
  assert.equal(own(0x80f725, { y: 65535 }).frontier_y, 0);
});
test('binaryleft or NOTtop stores can alias DPpointer and controlbytes before fresh actualF389', () => {
  for (const entry of entries) {
    const unary = entry === 0x80f72d,
      p = own(entry, { bank: 0x80, s: unary ? 0x3d5 : 0x3d3, pointerAfter: 0x1234 });
    const stored = p.stack_operations.at(-1).bytes.map((b) => b.physical_address),
      pointer = p.next_opcode_sources.pointer_reads.map((b) => b.physical_address);
    assert.deepEqual(stored, unary ? pointer.slice().reverse() : pointer);
    assert.deepEqual(
      p.next_opcode_sources.word_reads.map((b) => b.address),
      ['80:1238', '80:1239'],
    );
    assert.notEqual(p.next_opcode_sources.word_reads[0].address, '80:A005');
  }
  assert.deepEqual(addresses(own(0x80f715, { s: 0x3da })).at(-1), ['00:03DD', '00:03DE']);
  assert.match(report.contract.aliases, /freshpointer\/data; never cached/);
  assert.match(report.contract.aliases, /no automatic frame7 rewrite/);
});
test('Carry/V/decimal/I are preserved for all legalWORD statuses; no arithmetic/seed or binary-only premise', () => {
  assert.ok(
    ![...map.values()].some((i) =>
      ['ADC', 'SBC', 'CLC', 'SEC', 'CLD', 'SED', 'ASL'].includes(i.mnemonic),
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
  assert.ok(report.bit_logic.every((p) => p.decimal_flag_required === null));
  assert.match(report.contract.values, /decimal mode dependence or binary-only premise/);
});
test('fresh fullopcodeWORD follows every resultstore; ignoredhigh, oneINY and unscaled programbankJMP pinned', () => {
  at(0x80f389, 'LDA', 0, 'diy');
  at(0x80f38b, 'INY');
  at(0x80f38c, 'AND', 255, 'immM');
  at(0x80f38f, 'TAX');
  at(0x80f390, 'JMP', 0xf2b4, 'indx');
  for (const p of report.bit_logic) {
    assert.deepEqual(p.visited.slice(-5), ['80:F389', '80:F38B', '80:F38C', '80:F38F', '80:F390']);
    assert.ok(p.visited.indexOf(p.stack_operations.at(-1).at) < p.visited.indexOf('80:F389'));
    assert.equal(p.y_delta_before_next_opcode, 0);
    assert.equal(p.y_delta_at_frontier, 1);
    assert.equal(p.frontier.a, 'Fresh next-opcode lowbyte');
  }
  assert.equal([...map.values()].filter((i) => i.mnemonic === 'INY').length, 1);
  assert.match(report.contract.fetch, /including ignoredhigh/);
});
test('bounded hostbitlogic matches synthetic WORD results, lowerstack/underflowguard and distinct PC boundary', () => {
  for (const [op, entry] of [
    [0x7e, 0x80f715],
    [0x80, 0x80f71d],
    [0x82, 0x80f725],
    [0x84, 0x80f72d],
  ]) {
    const compile = compileScriptFrame([op, 0x56], { localBytes: 0, returnBytes: 2 }),
      unary = op === 0x84;
    for (const left of [0, 1, 0x8000, 0xaaaa, 0xffff])
      for (const right of [0, 1, 0xff, 0xffff]) {
        const frame = compile(unary ? [0xcafe, left] : [0xcafe, left, right]);
        frame.step();
        assert.equal(frame.snapshot().pc, 1);
        assert.deepEqual(frame.snapshot().stack, [0xcafe, bitLogicWord(entry, left, right)]);
      }
    assert.throws(() => compile(unary ? [] : [1]).step(), /underflow/);
  }
  assert.match(report.contract.host_boundary, /returnsPC before nextopcode/);
  assert.match(report.contract.host_boundary, /Synthetic hostvalue/);
});
test('sourceproof rejects every missing/raw/width/mode/stack/edge mutation independently for each selected handler', () => {
  for (const entry of entries) {
    const local = new Map(
      [...map].filter(
        ([pc]) => (pc >= entry && pc < entry + 8) || (pc >= 0x80f389 && pc < 0x80f393),
      ),
    );
    assert.deepEqual(proveBitLogicToDispatch(local, entry), proveBitLogicToDispatch(map, entry));
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveBitLogicToDispatch(missing, entry));
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
      ]) {
        const m = new Map(local);
        m.set(pc, { ...i, ...patch });
        assert.throws(() => proveBitLogicToDispatch(m, entry));
      }
    }
  }
  for (const [entry, pc, patch] of [
    [0x80f715, 0x80f716, { value: 3 }],
    [0x80f71d, 0x80f720, { mnemonic: 'PHA' }],
    [0x80f725, 0x80f726, { mnemonic: 'ORA' }],
    [0x80f72d, 0x80f72e, { value: 255 }],
    [0x80f72d, 0x80f731, { mnemonic: 'STA' }],
    [0x80f715, 0x80f71a, { target: 0x80f71d }],
    [0x80f725, 0x80f390, { value: 0xf2b5 }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveBitLogicToDispatch(m, entry));
  }
  assert.throws(() => proveBitLogicToDispatch(map, 0x80f378), /Invalid/);
});
test('address/value equations reject missingcontext/invalidWORDs and never authorize unmapped/ROM stackwrites', () => {
  for (const patch of [
    { d: -1 },
    { d: 65536 },
    { s: null },
    { s: 65536 },
    { y: undefined },
    { bank: -1 },
    { bank: 256 },
    { pointerAfter: undefined },
  ])
    assert.throws(() => own(0x80f715, patch), /Explicit/);
  assert.throws(() => own(0x80f393), /Invalid/);
  for (const value of [-1, 65536, null, undefined]) {
    assert.throws(() => bitLogicWord(0x80f715, value, 1), /WORDs/);
    assert.throws(() => bitLogicWord(0x80f715, 1, value), /WORDs/);
    assert.throws(() => bitLogicWord(0x80f72d, value), /WORDs/);
  }
  assert.throws(() => bitLogicWord(0x80f532, 1, 1), /Invalid/);
  assert.equal(
    own(0x80f715, { s: 0x1ffd }).stack_operations.at(-1).bytes[0].physical_address,
    null,
  );
  const b = own(0x80f715, { s: 0x7ffd }).stack_operations.at(-1).bytes[0];
  assert.equal(b.address, '00:8000');
  assert.equal(b.physical_address, '80:8000');
  assert.match(own(0x80f72d).qualification, /not an owner/);
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
});
test('bitlogic remains partial source in visit/9178/central without native/globalstack promotion', async () => {
  const [visit, text, progress] = await Promise.all(
    ['analysis/render-c1ca.json', 'analysis/render-9178.json', 'docs/PORTIERUNGSSTAND.json'].map(
      async (p) => JSON.parse(await readFile(p, 'utf8')),
    ),
  );
  assert.equal(report.source_graph.source_closed_to_dispatch, true);
  assert.equal(report.source_graph.full_graph_closed, false);
  assert.equal(report.source_graph.native_binding, false);
  assert.equal(report.source_graph.minimum_protected_stack_bytes, null);
  const supplied = visit.full_graph.supplied_opcode_sources.find(
    (s) => s.source === 'analysis/render-task-bit-logic.json',
  );
  assert.deepEqual(supplied.entries, entries.map(cpuLabel));
  assert.deepEqual(supplied.operand_s_deltas, [2, 2, 2, 0]);
  assert.equal(supplied.outer_return_frames_added, 0);
  assert.equal(visit.full_graph.closed, false);
  assert.equal(visit.full_graph.minimum_protected_stack_bytes, null);
  assert.equal(text.full_graph.closed, false);
  assert.ok(
    ['native-required', 'composition-required'].includes(
      progress.work_groups.find((g) => g.id === 'task-f378-bit-logic').status,
    ),
  );
  assert.ok(
    !progress.supplied.some((r) =>
      [...entries.map(cpuLabel), '80:C1CA', '80:9178'].includes(r.entry),
    ),
  );
});
