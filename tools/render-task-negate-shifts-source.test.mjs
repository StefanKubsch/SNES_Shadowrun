import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveNegateShiftToDispatch,
  describeNegateShiftByteOwners,
  negateWord,
  shiftWordConsequence,
} from './render-task-negate-shifts-source-proof.mjs';
import { compileScriptFrame } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-task-negate-shifts.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'negateF6F4',
    0x80f6f4,
    0x80f6fd,
    5,
    '7668fcfcd8ec8873d37273393823ed319458072af9395bfc9cdcfb6bb1692db3',
  ],
  [
    'shiftLeftF6FD',
    0x80f6fd,
    0x80f709,
    8,
    'cb1198f2c538526bc877d551b8bd37f599a6557314aba51e8a8217aea78e7a42',
  ],
  [
    'shiftRightF709',
    0x80f709,
    0x80f715,
    8,
    '047365499699b1524cb289bf9d8b7c199062aee82bf8e68430f7ab3af8e70a6b',
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
const context = { d: 0x3d6, bank: 0x9d, s: 0x3f0, y: 4, count: 1, pointerAfter: 0xa001 };
const own = (entry, patch = {}) => describeNegateShiftByteOwners({ ...context, entry, ...patch });
const addresses = (p) => p.stack_operations.map((o) => o.bytes.map((b) => b.address));
const shift = (entry, count, value, incomingCarry) =>
  shiftWordConsequence({ entry, count, value, incomingCarry });
// Independent ROM pins, symbolic count equations and synthetic data only.
// These tests do not execute machine instructions, Tasks, devices or scenes.
test('negate/shifts43/26 independently pins European ROM, complete windows and hashes/counts', () => {
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
  assert.equal(map.size, 26);
  assert.equal(report.source_graph.code_bytes, 43);
  assert.equal(report.source_graph.instructions, 26);
});
test('78/7A/7C originaltable WORD targets and sharedfetch owners match independent pins', async () => {
  for (const [opcode, source, target, hash] of [
    [0x78, 0x80f32c, 0x80f6f4, 'e5bd8775778f107b48b1d4b6302b29b618357b675073839a672dd8c9236f63a9'],
    [0x7a, 0x80f32e, 0x80f6fd, '7bfa4f8d688b7799256b8d01447a83f2b3182d88e1b7452ec68bb1716cb598df'],
    [0x7c, 0x80f330, 0x80f709, 'd08b26d5fd97cdbbe7ba2dab177528243d46f8a1ae30b902a4d1db11a37a6be7'],
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
test('Negate uses WORDPLA/EORFFFF/INCA/PHA with high-first replacement, preservesS/C/V and allWORD values', () => {
  at(0x80f6f4, 'PLA');
  at(0x80f6f5, 'EOR', 65535, 'immM');
  at(0x80f6f8, 'INC', 0, 'A');
  at(0x80f6f9, 'PHA');
  at(0x80f6fa, 'JMP', 0x80f389);
  const p = proveNegateShiftToDispatch(map, 0x80f6f4);
  assert.deepEqual(p, report.negate_shifts[0]);
  assert.equal(p.executed_instructions, 10);
  assert.equal(p.operand_s_delta, 0);
  assert.deepEqual(addresses(own(0x80f6f4)), [
    ['00:03F1', '00:03F2'],
    ['00:03F2', '00:03F1'],
  ]);
  for (let value = 0; value < 65536; value++)
    assert.equal(negateWord(value), Number(BigInt.asUintN(16, -BigInt(value))));
  assert.equal(negateWord(0x8000), 0x8000);
  assert.equal(negateWord(0), 0);
  assert.equal(negateWord(65535), 1);
});
test('zero WORDcount BEQ comes fromPLX Z and bypasses every value read/shift/DEX/PHA for both directions', () => {
  for (const [entry, gate, target] of [
    [0x80f6fd, 0x80f6fe, 0x80f706],
    [0x80f709, 0x80f70a, 0x80f712],
  ]) {
    at(entry, 'PLX');
    at(gate, 'BEQ', target, 'rel8');
    const p = proveNegateShiftToDispatch(map, entry);
    assert.deepEqual(
      p,
      report.negate_shifts.find((p) => p.entry === cpuLabel(entry)),
    );
    assert.equal(p.zero_count.executed_instructions, 8);
    assert.equal(p.zero_count.required_readable_operand_stack_bytes, 2);
    assert.equal(p.zero_count.required_writable_operand_stack_bytes, 0);
    assert.equal(p.zero_count.value_word_read, false);
    assert.deepEqual(p.zero_count.visited, [
      cpuLabel(entry),
      cpuLabel(gate),
      cpuLabel(target),
      '80:F389',
      '80:F38B',
      '80:F38C',
      '80:F38F',
      '80:F390',
    ]);
    assert.deepEqual(addresses(own(entry, { count: 0 })), [['00:03F1', '00:03F2']]);
    assert.equal(own(entry, { count: 0 }).s_before_pha, null);
    for (const carry of [0, 1])
      assert.deepEqual(shift(entry, 0, undefined, carry), {
        value: null,
        value_word_read: false,
        original_value_preserved: true,
        carry,
        iterations: 0,
      });
    const alias = own(entry, { count: 0, d: context.s + 3 });
    assert.deepEqual(
      alias.next_opcode_sources.pointer_reads.map((b) => b.address),
      ['00:03F3', '00:03F4'],
    );
    assert.equal(alias.value_word_read, false);
    assert.match(alias.qualification, /aliased valuebytes can still be F389/);
  }
});
test('positivecount PLA then accumulatorASL/LSR/DEX/BNE uses DEX-Z and PHA at raisedS4', () => {
  for (const [entry, op] of [
    [0x80f6fd, 'ASL'],
    [0x80f709, 'LSR'],
  ]) {
    at(entry + 3, 'PLA');
    at(entry + 4, op, 0, 'A');
    at(entry + 5, 'DEX');
    at(entry + 6, 'BNE', entry + 4, 'rel8');
    at(entry + 8, 'PHA');
    at(entry + 9, 'JMP', 0x80f389);
    const p = proveNegateShiftToDispatch(map, entry);
    assert.equal(p.reachable_instructions, 13);
    assert.equal(p.positive_count.required_readable_operand_stack_bytes, 4);
    assert.equal(p.positive_count.required_writable_operand_stack_bytes, 2);
    assert.equal(p.positive_count.x_at_loop_exit, 0);
    assert.equal(p.loop_lemma.shift, cpuLabel(entry + 4));
    assert.equal(p.loop_lemma.decrement, cpuLabel(entry + 5));
    assert.equal(p.loop_lemma.backedge, cpuLabel(entry + 6));
    assert.deepEqual(addresses(own(entry)), [
      ['00:03F1', '00:03F2'],
      ['00:03F3', '00:03F4'],
      ['00:03F4', '00:03F3'],
    ]);
    assert.equal(own(entry).s_before_pha, 0x3f4);
    assert.equal(own(entry).output_operand_s, 0x3f2);
  }
});
test('fullWORD countdown lemma excludes zero underflow and premature/signed/16-count exit without timing claim', () => {
  for (let n = 1; n < 65536; n++) {
    // Check the algebraic induction's first/last and arbitrary midpoint,
    // not a processor loop or trace of n machine iterations.
    for (const k of new Set([0, n - 1, Math.floor(n / 2)])) {
      const x = n - k;
      assert.ok(x >= 1 && x <= 65535);
      assert.equal((x + 65535) % 65536, n - k - 1);
      assert.equal(x - 1 === 0, k + 1 === n);
    }
  }
  for (const p of report.negate_shifts.slice(1)) {
    assert.match(p.loop_lemma.invariant, /BNE tests DEX Z/);
    assert.match(p.loop_lemma.finite_iterations, /no host clamp/);
    assert.match(p.loop_lemma.qualification, /neither elapsed time/);
    assert.equal(p.positive_count.executed_instructions, '10+3*count');
  }
  assert.equal(10 + 3 * 65535, 196615);
  assert.match(report.contract.loop_flags, /value becoming0 early never shortens/);
});
test('every value/count1..17 agrees with independent BigInt bit extraction, including result0/Carry1 at16', () => {
  for (let value = 0; value < 65536; value++)
    for (let count = 1; count <= 17; count++)
      for (const entry of [0x80f6fd, 0x80f709]) {
        const left = entry === 0x80f6fd,
          v = BigInt(value),
          n = BigInt(count),
          p = shift(entry, count, value);
        assert.equal(p.value, Number(left ? BigInt.asUintN(16, v << n) : v >> n));
        assert.equal(
          p.carry,
          count > 16 ? 0 : Number((v >> BigInt(left ? 16 - count : count - 1)) & 1n),
        );
        assert.equal(p.iterations, count);
      }
  assert.equal(shift(0x80f6fd, 16, 1).carry, 1);
  assert.equal(shift(0x80f709, 16, 0x8000).carry, 1);
  assert.equal(shift(0x80f6fd, 17, 65535).carry, 0);
  assert.equal(shift(0x80f709, 1, 0x8000).value, 0x4000);
});
test('all65535 positivecounts retain exact iterations even past16/32, zero value early and incomingCarry independent', () => {
  for (let count = 1; count < 65536; count++)
    for (const entry of [0x80f6fd, 0x80f709]) {
      const p = shift(entry, count, 0);
      assert.equal(p.iterations, count);
      assert.equal(p.value, 0);
      assert.equal(p.carry, 0);
      if (count > 16) {
        const q = shift(entry, count, 65535);
        assert.equal(q.value, 0);
        assert.equal(q.carry, 0);
      }
    }
  for (const count of [1, 15, 16, 17, 32, 0x8000, 0xffff])
    for (const entry of [0x80f6fd, 0x80f709])
      assert.deepEqual(shift(entry, count, 0x8001, 0), shift(entry, count, 0x8001, 1));
});
test('every16bit S wraps PLX/PLA/PHA separately, with no value owner/write required on count0', () => {
  for (let s = 0; s < 65536; s++)
    for (const [entry, count] of [
      [0x80f6f4, undefined],
      [0x80f6fd, 0],
      [0x80f709, 1],
    ]) {
      const p = own(entry, { s, count }),
        top = [(s + 1) % 65536, (s + 2) % 65536],
        value = [(s + 3) % 65536, (s + 4) % 65536];
      const expected =
        entry === 0x80f6f4
          ? [top, top.slice().reverse()]
          : count === 0
            ? [top]
            : [top, value, value.slice().reverse()];
      assert.deepEqual(
        addresses(p),
        expected.map((pair) => pair.map(cpuLabel)),
      );
      assert.equal(p.output_operand_s, entry === 0x80f6f4 ? s : (s + 2) % 65536);
    }
  const zero = own(0x80f6fd, { s: 0x1ffe, count: 0 });
  assert.deepEqual(
    zero.stack_operations[0].bytes.map((b) => b.physical_address),
    ['7E:1FFF', null],
  ); // highcount source still required
  assert.equal(zero.stack_operations.length, 1);
  assert.equal(zero.value_word_read, false);
  assert.deepEqual(addresses(own(0x80f709, { s: 0xfffc, count: 1 })).at(-1), [
    '00:0000',
    '00:FFFF',
  ]);
});
test('256 DBRs leave pulls/pushes inbank00; D/Y and freshWORD fetch bankcarry/wrap are independent', () => {
  for (let bank = 0; bank < 256; bank++) {
    const p = own(0x80f6fd, { bank, d: 65535, y: 1, pointerAfter: 65535 });
    assert.deepEqual(addresses(p), addresses(own(0x80f6fd)));
    assert.deepEqual(
      p.next_opcode_sources.pointer_reads.map((b) => b.address),
      ['00:FFFF', '00:0000'],
    );
    assert.deepEqual(
      p.next_opcode_sources.word_reads.map((b) => b.address),
      [cpuLabel(((bank + 1) & 255) * 65536), cpuLabel(((bank + 1) & 255) * 65536 + 1)],
    );
  }
  assert.equal(own(0x80f709, { y: 65535 }).frontier_y, 0);
  assert.equal(own(0x80f709, { y: 65535 }).next_opcode_y, 65535);
  assert.deepEqual(
    own(0x80f6fd, {
      count: 0,
      bank: 255,
      y: 0,
      pointerAfter: 65535,
    }).next_opcode_sources.word_reads.map((b) => b.address),
    ['FF:FFFF', '00:0000'],
  );
});
test('Negate/positive-shift PHA can overwrite pointer/controlbytes before freshfetch, count0 creates no stores', () => {
  for (const [entry, s] of [
    [0x80f6f4, 0x3d5],
    [0x80f6fd, 0x3d3],
    [0x80f709, 0x3d3],
  ]) {
    const p = own(entry, { bank: 0x80, s, pointerAfter: 0x1234 }),
      writes = p.stack_operations.at(-1).bytes;
    assert.deepEqual(
      writes.map((b) => b.physical_address),
      p.next_opcode_sources.pointer_reads
        .slice()
        .reverse()
        .map((b) => b.physical_address),
    );
    assert.deepEqual(
      p.next_opcode_sources.word_reads.map((b) => b.address),
      ['80:1238', '80:1239'],
    );
    assert.notEqual(p.next_opcode_sources.word_reads[0].address, '80:A005');
  }
  assert.ok(own(0x80f6fd, { count: 0 }).stack_operations.every((o) => o.kind === 'read'));
  assert.match(report.contract.aliases, /freshpoststore pointer\/data/);
  assert.match(report.contract.aliases, /no automatic frame7 rewrite/);
});
test('freshfetch replaces local result/DEX N/Z and loopX, retains pathCarry and V/I/decimal without binary-only premise', () => {
  at(0x80f389, 'LDA', 0, 'diy');
  at(0x80f38b, 'INY');
  at(0x80f38c, 'AND', 255, 'immM');
  at(0x80f38f, 'TAX');
  at(0x80f390, 'JMP', 0xf2b4, 'indx');
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30))
      for (let low = 0; low < 256; low++) {
        const final = (status & ~0x82) | (low === 0 ? 2 : 0);
        assert.equal(final & 0x4d, status & 0x4d);
        assert.equal(final & 0x80, 0);
        assert.equal(Boolean(final & 2), low === 0);
      }
  assert.ok(
    ![...map.values()].some((i) =>
      ['ADC', 'SBC', 'CLC', 'SEC', 'CLD', 'SED', 'ROR', 'ROL'].includes(i.mnemonic),
    ),
  );
  assert.ok(
    report.negate_shifts.every(
      (p) =>
        p.decimal_flag_required === null &&
        p.y_delta_before_next_opcode === 0 &&
        p.y_delta_at_frontier === 1,
    ),
  );
  assert.match(report.contract.fetch, /including ignoredhigh/);
});
test('normalized host Negate/Shifts match synthetic values while zero-read/actualWORD-loop/Carry remain separate', () => {
  for (const [op, entry] of [
    [0x78, 0x80f6f4],
    [0x7a, 0x80f6fd],
    [0x7c, 0x80f709],
  ]) {
    const compile = compileScriptFrame([op, 0x56], { localBytes: 0, returnBytes: 2 });
    for (const value of [0, 1, 0x7fff, 0x8000, 65535])
      for (const count of [0, 1, 15, 16, 17, 32, 65535]) {
        const frame = compile(op === 0x78 ? [0xcafe, value] : [0xcafe, value, count]);
        frame.step();
        assert.equal(frame.snapshot().pc, 1);
        assert.deepEqual(frame.snapshot().stack, [
          0xcafe,
          op === 0x78 ? negateWord(value) : count === 0 ? value : shift(entry, count, value).value,
        ]);
      }
    assert.throws(() => compile(op === 0x78 ? [] : [1]).step(), /underflow/);
  }
  assert.match(report.contract.host_boundary, /reads known leftvalue even for count0/);
  assert.match(report.contract.host_boundary, /no original WORD loop\/Carry/);
});
test('proof rejects every missing/raw/width/mode/stack/loop/gate mutation without relying on other handlers', () => {
  for (const [entry, start, end] of [
    [0x80f6f4, 0x80f6f4, 0x80f6fd],
    [0x80f6fd, 0x80f6fd, 0x80f709],
    [0x80f709, 0x80f709, 0x80f715],
  ]) {
    const local = new Map(
      [...map].filter(([pc]) => (pc >= start && pc < end) || (pc >= 0x80f389 && pc < 0x80f393)),
    );
    assert.deepEqual(
      proveNegateShiftToDispatch(local, entry),
      proveNegateShiftToDispatch(map, entry),
    );
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveNegateShiftToDispatch(missing, entry));
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
        assert.throws(() => proveNegateShiftToDispatch(m, entry));
      }
    }
  }
  for (const [entry, pc, patch] of [
    [0x80f6fd, 0x80f6fe, { target: 0x80f705 }],
    [0x80f709, 0x80f70f, { target: 0x80f70e }],
    [0x80f6fd, 0x80f702, { mnemonic: 'DEY' }],
    [0x80f6fd, 0x80f701, { mnemonic: 'ROL' }],
    [0x80f709, 0x80f70d, { mnemonic: 'ASL' }],
    [0x80f6f4, 0x80f6f5, { value: 255 }],
    [0x80f6f4, 0x80f6f9, { mnemonic: 'PHX' }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveNegateShiftToDispatch(m, entry));
  }
  assert.throws(() => proveNegateShiftToDispatch(map, 0x80f378), /Invalid/);
});
test('address/value descriptors reject unknowncontext/count/C but zero count requires no value, no owner inferred', () => {
  for (const patch of [
    { d: -1 },
    { d: 65536 },
    { s: null },
    { y: undefined },
    { bank: 256 },
    { pointerAfter: undefined },
    { count: undefined },
    { count: -1 },
    { count: 65536 },
  ])
    assert.throws(() => own(0x80f6fd, patch), /Explicit/);
  for (const value of [-1, 65536, null, undefined]) {
    assert.throws(() => negateWord(value), /WORD/);
    assert.throws(() => shift(0x80f6fd, 1, value), /WORD/);
  }
  for (const c of [undefined, null, 2, false])
    assert.throws(() => shift(0x80f709, 0, undefined, c), /Carry/);
  assert.throws(() => shift(0x80f6f4, 1, 1), /Invalid/);
  assert.throws(() => own(0x80f393), /Invalid/);
  assert.equal(own(0x80f6f4, { count: undefined }).value_word_read, true);
  assert.equal(own(0x80f6fd, { count: 0 }).value_word_read, false);
  assert.equal(
    own(0x80f709, { s: 0x1ffc }).stack_operations.at(-1).bytes[0].physical_address,
    null,
  );
  assert.match(own(0x80f6f4).qualification, /not an owner/);
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
});
test('negate/shift sources stay partial in visit/9178/central, with full dynamic return/globalstack/native open', async () => {
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
    (s) => s.source === 'analysis/render-task-negate-shifts.json',
  );
  assert.deepEqual(supplied.entries, ['80:F6F4', '80:F6FD', '80:F709']);
  assert.deepEqual(supplied.operand_s_deltas, [0, 2, 2]);
  assert.equal(supplied.outer_return_frames_added, 0);
  assert.equal(visit.full_graph.closed, false);
  assert.equal(visit.full_graph.minimum_protected_stack_bytes, null);
  assert.equal(text.full_graph.closed, false);
  assert.ok(
    ['native-required', 'composition-required'].includes(
      progress.work_groups.find((g) => g.id === 'task-f378-negate-shifts').status,
    ),
  );
  assert.ok(
    !progress.supplied.some((r) =>
      ['80:F6F4', '80:F6FD', '80:F709', '80:C1CA', '80:9178'].includes(r.entry),
    ),
  );
});
