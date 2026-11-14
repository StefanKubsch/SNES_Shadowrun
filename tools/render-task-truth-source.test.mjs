import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveTruthToDispatch,
  describeTruthByteOwners,
  truthWordConsequence,
} from './render-task-truth-source-proof.mjs';
import { compileScriptFrame } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-task-truth.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'booleanF8BF',
    0x80f8bf,
    0x80f8cb,
    5,
    'cfd1c23604a119694a8e3fc8ef7a685f769a64b2fc1b9cd4b9836713cc43e016',
  ],
  [
    'equalF843',
    0x80f843,
    0x80f852,
    8,
    '2945ae7e086cb77519ca02e21278a7b475992bb3509edb979cac4788e06450eb',
  ],
  [
    'notEqualF87F',
    0x80f87f,
    0x80f88e,
    8,
    '5332e83b6a8a070e2c35cd15237ff5069aa4b5c3a62936f93c1cbd45408d6054',
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
const context = {
  d: 0x3d6,
  bank: 0x9d,
  s: 0x3f0,
  y: 4,
  pointerAfter: 0xa001,
  value: 1,
  incomingCarry: 0,
  left: 1,
  right: 1,
};
const own = (entry, patch = {}) => describeTruthByteOwners({ ...context, entry, ...patch });
const addresses = (p) => p.stack_operations.map((o) => o.bytes.map((b) => b.address));
const entries = [0x80f8bf, 0x80f843, 0x80f87f];
const equation = (entry, patch = {}) => truthWordConsequence({ ...context, entry, ...patch });
// ROM pins and independent synthetic byte/value/flag consequences, no CPU run.
test('truth52/26 independently pins ROM identity and complete source windows', () => {
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
  assert.equal(report.source_graph.code_bytes, 52);
  assert.equal(report.source_graph.instructions, 26);
});
test('BE and both AA/B0 B2/B8 opcodealiases independently pin real WORDtargets/sharedfetch owners', async () => {
  for (const [opcode, source, target, hash] of [
    [0xbe, 0x80f372, 0x80f8bf, 'a44d118d13a0e8cfe3eae9d429f8c48c15e1c9f559da08c5e90948968b1a0afe'],
    [0xaa, 0x80f35e, 0x80f843, 'a3205ac54854d8f5cf30e841a47adb37ff4d8bad73de2497c461e04feefd117f'],
    [0xb0, 0x80f364, 0x80f843, 'a3205ac54854d8f5cf30e841a47adb37ff4d8bad73de2497c461e04feefd117f'],
    [0xb2, 0x80f366, 0x80f87f, '7d5818e610ed2d14e387cac6b4ac83d10fe87a709059633d9a453ddd13811e12'],
    [0xb8, 0x80f36c, 0x80f87f, '7d5818e610ed2d14e387cac6b4ac83d10fe87a709059633d9a453ddd13811e12'],
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
test('Boolean uses fullWORD LDA Z, zeroBEQ skips both immediateFFFF and STA with no operandwrite', () => {
  at(0x80f8bf, 'LDA', 1, 'sr');
  at(0x80f8c1, 'BEQ', 0x80f8c8, 'rel8');
  at(0x80f8c3, 'LDA', 65535, 'immM');
  at(0x80f8c6, 'STA', 1, 'sr');
  at(0x80f8c8, 'JMP', 0x80f389);
  const p = proveTruthToDispatch(map, 0x80f8bf);
  assert.deepEqual(p, report.truth[0]);
  assert.equal(p.operand_s_delta, 0);
  assert.equal(p.branch.flag_origin, '80:F8BF');
  assert.deepEqual(
    p.paths.map((p) => p.executed_instructions),
    [8, 10],
  );
  const zero = p.paths[0];
  assert.equal(zero.required_readable_operand_stack_bytes, 2);
  assert.equal(zero.required_writable_operand_stack_bytes, 0);
  assert.deepEqual(zero.visited.slice(0, 3), ['80:F8BF', '80:F8C1', '80:F8C8']);
  assert.equal(zero.stack_operations.length, 1);
  assert.equal(p.paths[1].required_writable_operand_stack_bytes, 2);
  assert.equal(own(0x80f8bf, { value: 0 }).operand_store, false);
  assert.deepEqual(addresses(own(0x80f8bf, { value: 0 })), [['00:03F1', '00:03F2']]);
  assert.equal(own(0x80f8bf).s_after_pla, null);
});
test('Equal LDX0000 PLA CMPright,left BNE skips only WORDDEX; TXA always stores fullleftWORD', () => {
  at(0x80f843, 'LDX', 0, 'immX');
  at(0x80f846, 'PLA');
  at(0x80f847, 'CMP', 1, 'sr');
  at(0x80f849, 'BNE', 0x80f84c, 'rel8');
  at(0x80f84b, 'DEX');
  at(0x80f84c, 'TXA');
  at(0x80f84d, 'STA', 1, 'sr');
  at(0x80f84f, 'JMP', 0x80f389);
  const p = proveTruthToDispatch(map, 0x80f843);
  assert.deepEqual(p, report.truth[1]);
  assert.equal(p.branch.flag_origin, '80:F847');
  assert.deepEqual(
    p.paths.map((p) => p.executed_instructions),
    [12, 13],
  );
  assert.ok(!p.paths[0].visited.includes('80:F84B'));
  assert.ok(p.paths[1].visited.includes('80:F84B'));
  for (const path of p.paths) {
    assert.equal(path.required_readable_operand_stack_bytes, 4);
    assert.equal(path.required_writable_operand_stack_bytes, 2);
    assert.equal(path.stack_operations.at(-1).at, '80:F84D');
  }
  assert.deepEqual(
    p.paths[0].stack_operations.map((o) => [o.kind, o.s_delta, o.offset]),
    [
      ['read', 0, 1],
      ['read', 2, 1],
      ['write', 2, 1],
    ],
  );
  assert.deepEqual(addresses(own(0x80f843)), [
    ['00:03F1', '00:03F2'],
    ['00:03F3', '00:03F4'],
    ['00:03F3', '00:03F4'],
  ]);
});
test('NotEqual LDXFFFF equality WORDINX wraps to0000, inequality preservesFFFF and always stores', () => {
  at(0x80f87f, 'LDX', 65535, 'immX');
  at(0x80f882, 'PLA');
  at(0x80f883, 'CMP', 1, 'sr');
  at(0x80f885, 'BNE', 0x80f888, 'rel8');
  at(0x80f887, 'INX');
  at(0x80f888, 'TXA');
  at(0x80f889, 'STA', 1, 'sr');
  at(0x80f88b, 'JMP', 0x80f389);
  const p = proveTruthToDispatch(map, 0x80f87f);
  assert.deepEqual(p, report.truth[2]);
  assert.equal(p.branch.flag_origin, '80:F883');
  assert.deepEqual(
    p.paths.map((p) => p.executed_instructions),
    [12, 13],
  );
  assert.ok(!p.paths[0].visited.includes('80:F887'));
  assert.ok(p.paths[1].visited.includes('80:F887'));
  assert.equal(equation(0x80f87f, { left: 65535, right: 65535 }).value, 0);
  assert.equal(equation(0x80f87f, { left: 0, right: 1 }).value, 65535);
  assert.ok(![...map.values()].some((i) => ['PHA', 'STZ', 'CLC', 'SEC'].includes(i.mnemonic)));
});
test('all65536 Boolean WORDs and both incomingCarries preserve exactzero no-store/fullhighbyte truth', () => {
  for (let value = 0; value < 65536; value++)
    for (const incomingCarry of [0, 1]) {
      const nonzero = value % 256 !== 0 || Math.floor(value / 256) !== 0;
      assert.deepEqual(equation(0x80f8bf, { value, incomingCarry }), {
        value: nonzero ? 65535 : 0,
        carry: incomingCarry,
        operand_store: nonzero,
      });
    }
  for (const value of [0x100, 0x8000, 0xffff])
    assert.equal(equation(0x80f8bf, { value }).operand_store, true);
});
test('independent byteborrow covers everyleftWORD with boundary/neighbor partners; CMP Carry direction and truth separate', () => {
  for (let left = 0; left < 65536; left++)
    for (const right of [
      0,
      1,
      0xff,
      0x100,
      0x7fff,
      0x8000,
      0xffff,
      left,
      (left + 1) % 65536,
      (left + 65535) % 65536,
    ]) {
      const lowBorrow = (right % 256) - (left % 256) < 0 ? 1 : 0,
        highDifference = Math.floor(right / 256) - Math.floor(left / 256) - lowBorrow;
      const carry = highDifference < 0 ? 0 : 1,
        equal = left % 256 === right % 256 && Math.floor(left / 256) === Math.floor(right / 256);
      const a = equation(0x80f843, { left, right }),
        b = equation(0x80f87f, { left, right });
      assert.deepEqual(a, { value: equal ? 65535 : 0, carry, operand_store: true });
      assert.deepEqual(b, { value: equal ? 0 : 65535, carry, operand_store: true });
      assert.equal(a.value + b.value, 65535);
    }
  for (const entry of entries.slice(1)) {
    assert.equal(equation(entry, { left: 0, right: 65535 }).carry, 1);
    assert.equal(equation(entry, { left: 65535, right: 0 }).carry, 0);
    assert.equal(equation(entry, { left: 0x8000, right: 0x7fff }).carry, 0);
    assert.equal(equation(entry, { left: 0x7fff, right: 0x8000 }).carry, 1);
  }
});
test('CMP C ignores incomingCarry and decimal, V/I/decimal preserved and final N/Z from freshopcode', () => {
  assert.ok(
    ![...map.values()].some((i) =>
      ['ADC', 'SBC', 'CLD', 'SED', 'CLC', 'SEC', 'CLV'].includes(i.mnemonic),
    ),
  );
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30))
      for (const entry of entries)
        for (const [left, right] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [0x7fff, 0x8000],
          [0x8000, 0x7fff],
        ])
          for (const low of [0, 1, 0x80, 0xff]) {
            const c = equation(entry, {
              left,
              right,
              value: left,
              incomingCarry: status & 1,
            }).carry;
            const final = (status & ~0x83) | c | (low === 0 ? 2 : 0);
            assert.equal(final & 0x4c, status & 0x4c);
            assert.equal(final & 1, entry === 0x80f8bf ? status & 1 : right < left ? 0 : 1);
            assert.equal(final & 0x80, 0);
            assert.equal(Boolean(final & 2), low === 0);
          }
  assert.ok(report.truth.every((p) => p.decimal_flag_required === null));
  assert.match(report.contract.values_flags, /C1 iff unsignedright>=left/);
});
test('all65536 S values retain bank00 WORDread/store order and exact BooleanS0 versus comparisonS+2', () => {
  for (let s = 0; s < 65536; s++)
    for (const [entry, value] of [
      [0x80f8bf, 0],
      [0x80f8bf, 0x100],
      [0x80f843, 1],
    ]) {
      const p = own(entry, { s, value }),
        top = [(s + 1) % 65536, (s + 2) % 65536],
        left = [(s + 3) % 65536, (s + 4) % 65536],
        unary = entry === 0x80f8bf;
      const expected = unary ? (value === 0 ? [top] : [top, top]) : [top, left, left];
      assert.deepEqual(
        addresses(p),
        expected.map((pair) => pair.map(cpuLabel)),
      );
      assert.equal(p.output_operand_s, unary ? s : (s + 2) % 65536);
      assert.ok(
        p.stack_operations.every((o) => o.bytes[0].byte === 'low' && o.bytes[1].byte === 'high'),
      );
    }
  assert.deepEqual(addresses(own(0x80f87f, { s: 0xfffc })).at(-1), ['00:FFFF', '00:0000']);
  assert.deepEqual(addresses(own(0x80f8bf, { s: 0xfffe })).at(-1), ['00:FFFF', '00:0000']);
});
test('all256 DBRs cannot redirect operandstack; fullD pointer and24bit WORDfetch wrap separately', () => {
  for (let bank = 0; bank < 256; bank++)
    for (const entry of entries) {
      const p = own(entry, { bank, d: 65535, y: 1, pointerAfter: 65535 });
      assert.deepEqual(addresses(p), addresses(own(entry)));
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
    own(0x80f843, { bank: 255, y: 0, pointerAfter: 65535 }).next_opcode_sources.word_reads.map(
      (b) => b.address,
    ),
    ['FF:FFFF', '00:0000'],
  );
  assert.equal(own(0x80f8bf, { y: 65535 }).frontier_y, 0);
});
test('Boolean and comparison stores physically alias freshpointer/control/opcode sources, zero path retains separate owners', () => {
  for (const entry of entries) {
    const unary = entry === 0x80f8bf;
    const p = own(entry, {
      bank: 0x80,
      s: unary ? 0x3d5 : 0x3d3,
      pointerAfter: 65535,
      left: entry === 0x80f843 ? 1 : 0,
      right: 1,
    });
    assert.deepEqual(
      p.stack_operations.at(-1).bytes.map((b) => b.physical_address),
      p.next_opcode_sources.pointer_reads.map((b) => b.physical_address),
    );
    assert.deepEqual(
      p.next_opcode_sources.word_reads.map((b) => b.address),
      ['81:0003', '81:0004'],
    );
    const opcode = own(entry, {
      bank: 0x80,
      d: 0x100,
      y: 0,
      s: unary ? 0x3d5 : 0x3d3,
      pointerAfter: 0x3d6,
    });
    assert.deepEqual(
      opcode.stack_operations.at(-1).bytes.map((b) => b.physical_address),
      opcode.next_opcode_sources.word_reads.map((b) => b.physical_address),
    );
  }
  const zero = own(0x80f8bf, { s: 0x3d5, value: 0, pointerAfter: 0 });
  assert.equal(zero.stack_operations.length, 1);
  assert.deepEqual(
    zero.stack_operations[0].bytes.map((b) => b.physical_address),
    zero.next_opcode_sources.pointer_reads.map((b) => b.physical_address),
  );
  assert.deepEqual(addresses(own(0x80f87f, { s: 0x3da })).at(-1), ['00:03DD', '00:03DE']);
  assert.match(report.contract.aliases, /zero needs no operandwriteowner/);
  assert.match(report.contract.aliases, /no automatic frame7 rewrite/);
});
test('fresh fullopcodeWORD follows both branch paths, finalX overwrites truthX, oneINY/unscaledJMP pinned', () => {
  at(0x80f389, 'LDA', 0, 'diy');
  at(0x80f38b, 'INY');
  at(0x80f38c, 'AND', 255, 'immM');
  at(0x80f38f, 'TAX');
  at(0x80f390, 'JMP', 0xf2b4, 'indx');
  for (const p of report.truth)
    for (const path of p.paths) {
      assert.deepEqual(path.visited.slice(-5), [
        '80:F389',
        '80:F38B',
        '80:F38C',
        '80:F38F',
        '80:F390',
      ]);
      for (const o of path.stack_operations)
        assert.ok(path.visited.indexOf(o.at) < path.visited.indexOf('80:F389'));
      assert.equal(p.y_delta_before_next_opcode, 0);
      assert.equal(p.y_delta_at_frontier, 1);
      assert.equal(p.frontier.x, 'Fresh next-opcode lowbyte');
    }
  assert.equal([...map.values()].filter((i) => i.mnemonic === 'INY').length, 1);
  assert.match(report.contract.fetch, /including ignoredhigh/);
});
test('hosttruth/aliases match synthetic values/lowerstack but zeroBoolean hoststore cannot prove original no-store', () => {
  for (const [op, entry] of [
    [0xbe, 0x80f8bf],
    [0xaa, 0x80f843],
    [0xb0, 0x80f843],
    [0xb2, 0x80f87f],
    [0xb8, 0x80f87f],
  ]) {
    const compile = compileScriptFrame([op, 0x56], { localBytes: 0, returnBytes: 2 }),
      unary = op === 0xbe;
    for (const left of [0, 1, 0x100, 0x8000, 0xffff])
      for (const right of [0, 1, 0x8000, 0xffff]) {
        const frame = compile(unary ? [0xcafe, left] : [0xcafe, left, right]);
        frame.step();
        assert.equal(frame.snapshot().pc, 1);
        assert.deepEqual(frame.snapshot().stack, [
          0xcafe,
          equation(entry, { value: left, left, right }).value,
        ]);
      }
    assert.throws(() => compile(unary ? [] : [1]).step(), /underflow/);
  }
  assert.match(report.contract.host_boundary, /Boolean host replaceTop writes zero too/);
  assert.match(report.contract.host_boundary, /Synthetic hostvalue/);
});
test('each branchproof rejects missing/raw/width/mode/value/target/stack/edge mutations across both paths', () => {
  for (const entry of entries) {
    const [, , end] = windows.find((w) => w[1] === entry),
      local = new Map(
        [...map].filter(([pc]) => (pc >= entry && pc < end) || (pc >= 0x80f389 && pc < 0x80f393)),
      );
    assert.deepEqual(proveTruthToDispatch(local, entry), proveTruthToDispatch(map, entry));
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveTruthToDispatch(missing, entry));
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
        assert.throws(() => proveTruthToDispatch(m, entry));
      }
    }
  }
  for (const [entry, pc, patch] of [
    [0x80f8bf, 0x80f8c1, { mnemonic: 'BNE' }],
    [0x80f8bf, 0x80f8c6, { mnemonic: 'STZ' }],
    [0x80f843, 0x80f847, { value: 3 }],
    [0x80f843, 0x80f84b, { mnemonic: 'INX' }],
    [0x80f87f, 0x80f887, { mnemonic: 'DEX' }],
    [0x80f87f, 0x80f885, { target: 0x80f889 }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveTruthToDispatch(m, entry));
  }
  assert.throws(() => proveTruthToDispatch(map, 0x80f378), /Invalid/);
});
test('address/value equations reject missingcontext/invalidWORDs and never authorize unmapped/ROM writes', () => {
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
    assert.throws(() => own(0x80f843, patch), /Explicit/);
  for (const value of [-1, 65536, null, undefined]) {
    assert.throws(() => equation(0x80f8bf, { value }), /WORD/);
    assert.throws(() => equation(0x80f843, { left: value }), /WORD/);
    assert.throws(() => equation(0x80f87f, { right: value }), /WORD/);
  }
  for (const incomingCarry of [-1, 2, null, undefined])
    assert.throws(() => equation(0x80f8bf, { incomingCarry }), /Carry/);
  assert.throws(() => own(0x80f393), /Invalid/);
  assert.throws(() => equation(0x80f532), /Invalid/);
  assert.equal(
    own(0x80f843, { s: 0x1ffd }).stack_operations.at(-1).bytes[0].physical_address,
    null,
  );
  const b = own(0x80f8bf, { s: 0x7fff }).stack_operations.at(-1).bytes[0];
  assert.equal(b.address, '00:8000');
  assert.equal(b.physical_address, '80:8000');
  assert.match(own(0x80f843).qualification, /not an owner/);
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
});
test('truth sources staypartial in visit/9178/central without native/globalstack promotion', async () => {
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
    (s) => s.source === 'analysis/render-task-truth.json',
  );
  assert.deepEqual(supplied.entries, entries.map(cpuLabel));
  assert.deepEqual(supplied.operand_s_deltas, [0, 2, 2]);
  assert.equal(supplied.outer_return_frames_added, 0);
  assert.equal(visit.full_graph.closed, false);
  assert.equal(visit.full_graph.minimum_protected_stack_bytes, null);
  assert.equal(text.full_graph.closed, false);
  assert.ok(
    ['native-required', 'composition-required'].includes(
      progress.work_groups.find((g) => g.id === 'task-f378-truth').status,
    ),
  );
  assert.ok(
    !progress.supplied.some((r) =>
      [...entries.map(cpuLabel), '80:C1CA', '80:9178'].includes(r.entry),
    ),
  );
});
