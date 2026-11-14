import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveConsumerToDispatch,
  describeConsumerByteOwners,
  binaryConsumerResult,
} from './render-task-consumers-source-proof.mjs';
import { stepStackPrimitive } from '../proof/script/stack-primitives.mjs';
import { compileScriptFrame } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-task-consumers.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'dropF8BB',
    0x80f8bb,
    0x80f8bf,
    2,
    'a3f0501858b9e555e8853664638818656f8538a0b43ff69eb13704cedb952c0e',
  ],
  [
    'addF532',
    0x80f532,
    0x80f53b,
    5,
    '72721238c0c5b038a1223ad130b7cccedcdfb1add74438781a223e8c138a81e4',
  ],
  [
    'subtractF53B',
    0x80f53b,
    0x80f546,
    6,
    'b30cdad532e7d83f49fcd3e82943dcfa1c0be220a1d8f45e3f550e20c24d496e',
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
const own = (entry, patch = {}) => describeConsumerByteOwners({ ...context, entry, ...patch });
const addresses = (p) => p.stack_operations.map((o) => o.bytes.map((b) => b.address));
const result = (entry, left, right) => binaryConsumerResult({ entry, left, right, decimalFlag: 0 });
// Independent ROM pins and synthetic data/address consequences only.
// These tests do not run CPU instructions, real Tasks, devices or scenes.

test('consumer34/18 pins independent original ROM windows, counts and full machine bytes', () => {
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
  assert.equal(map.size, 18);
  assert.equal(report.source_graph.code_bytes, 34);
  assert.equal(report.source_graph.instructions, 18);
});

test('BC/5C/5E actual unscaled tableWORD slots and sharedfetch owner remain independently pinned', async () => {
  for (const [opcode, source, target, hash] of [
    [0xbc, 0x80f370, 0x80f8bb, '0ecb95b8aaa42e36b6112ae66e7d26202821f420cb363c796393e146f6845593'],
    [0x5c, 0x80f310, 0x80f532, '358602613c11ef9d987a98a5dd48292217274c02971f38fd6ca00eb6d60fdfb7'],
    [0x5e, 0x80f312, 0x80f53b, '2099a29a90ba4579307b197c46126d06bb1f385778cdaab7f908082f74c6ab92'],
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

test('Drop still reads discarded low/high WORD, movesS2, never writes/clears or adds rootreturn', () => {
  at(0x80f8bb, 'PLA', 0, 'i');
  at(0x80f8bc, 'JMP', 0x80f389, 'abs');
  const p = proveConsumerToDispatch(map, 0x80f8bb);
  assert.deepEqual(p, report.consumers[0]);
  assert.equal(p.reachable_instructions, 7);
  assert.equal(p.required_readable_operand_stack_bytes, 2);
  assert.equal(p.required_writable_operand_stack_bytes, 0);
  assert.equal(p.binary_arithmetic, null);
  assert.equal(p.operand_s_delta, 2);
  assert.equal(p.outer_return_frames_added, 0);
  assert.deepEqual(addresses(own(0x80f8bb)), [['00:03F1', '00:03F2']]);
});

test('Add pops right before CLC, reads and overwrites left at updatedS+1 in low/high store order', () => {
  at(0x80f532, 'PLA');
  at(0x80f533, 'CLC');
  at(0x80f534, 'ADC', 1, 'sr');
  at(0x80f536, 'STA', 1, 'sr');
  at(0x80f538, 'JMP', 0x80f389);
  const p = proveConsumerToDispatch(map, 0x80f532);
  assert.deepEqual(p, report.consumers[1]);
  assert.equal(p.reachable_instructions, 10);
  assert.deepEqual(
    p.stack_operations.map((o) => [o.kind, o.s_delta, o.offset]),
    [
      ['read', 0, 1],
      ['read', 2, 1],
      ['write', 2, 1],
    ],
  );
  assert.deepEqual(addresses(own(0x80f532)), [
    ['00:03F1', '00:03F2'],
    ['00:03F3', '00:03F4'],
    ['00:03F3', '00:03F4'],
  ]);
  assert.deepEqual(
    own(0x80f532).stack_operations[2].bytes.map((b) => b.byte),
    ['low', 'high'],
  );
  assert.equal(p.binary_arithmetic.carry_seed, 0);
});

test('Subtract reads left/right, stores left-right before fresh discarded PLA, SEC removes incomingborrow', () => {
  at(0x80f53b, 'SEC');
  at(0x80f53c, 'LDA', 3, 'sr');
  at(0x80f53e, 'SBC', 1, 'sr');
  at(0x80f540, 'STA', 3, 'sr');
  at(0x80f542, 'PLA');
  at(0x80f543, 'JMP', 0x80f389);
  const p = proveConsumerToDispatch(map, 0x80f53b);
  assert.deepEqual(p, report.consumers[2]);
  assert.equal(p.reachable_instructions, 11);
  assert.deepEqual(
    p.stack_operations.map((o) => [o.kind, o.s_delta, o.offset]),
    [
      ['read', 0, 3],
      ['read', 0, 1],
      ['write', 0, 3],
      ['read', 0, 1],
    ],
  );
  assert.deepEqual(addresses(own(0x80f53b)), [
    ['00:03F3', '00:03F4'],
    ['00:03F1', '00:03F2'],
    ['00:03F3', '00:03F4'],
    ['00:03F1', '00:03F2'],
  ]);
  assert.equal(p.binary_arithmetic.carry_seed, 1);
  assert.equal(result(0x80f53b, 2, 7).value, 65531);
});

test('all16bit S values wrap inside bank00 for PLA/currentS-relative accesses, without operandbyte overlap', () => {
  for (let s = 0; s < 65536; s++) {
    const top = [(s + 1) % 65536, (s + 2) % 65536],
      left = [(s + 3) % 65536, (s + 4) % 65536];
    assert.equal(new Set([...top, ...left]).size, 4);
    // Exercise descriptor for every S; avoid manufacturing memory values.
    const p = own(0x80f53b, { s });
    assert.equal(p.output_operand_s, (s + 2) % 65536);
    assert.deepEqual(
      addresses(p),
      [left, top, left, top].map((pair) => pair.map(cpuLabel)),
    );
  }
  assert.deepEqual(addresses(own(0x80f532, { s: 0xfffe })), [
    ['00:FFFF', '00:0000'],
    ['00:0001', '00:0002'],
    ['00:0001', '00:0002'],
  ]);
  assert.deepEqual(addresses(own(0x80f53b, { s: 0xfffc }))[0], ['00:FFFF', '00:0000']);
  assert.equal(own(0x80f8bb, { s: 0xffff }).output_operand_s, 1);
});

test('256 actualDBRs never redirect operandstack; fetchWORD can carry24bits while D andY wrap separately', () => {
  for (let bank = 0; bank < 256; bank++) {
    const p = own(0x80f532, { bank, d: 0xffff, y: 1, pointerAfter: 0xffff });
    assert.deepEqual(addresses(p), addresses(own(0x80f532)));
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
    own(0x80f8bb, { bank: 255, y: 0, pointerAfter: 65535 }).next_opcode_sources.word_reads.map(
      (b) => b.address,
    ),
    ['FF:FFFF', '00:0000'],
  );
  assert.equal(own(0x80f53b, { y: 65535 }).next_opcode_y, 65535);
  assert.equal(own(0x80f53b, { y: 65535 }).frontier_y, 0);
});

test('resultstores can overwrite both DPpointerbytes before actual freshF389 sources and control aliases are explicit', () => {
  for (const entry of [0x80f532, 0x80f53b]) {
    const p = own(entry, { bank: 0x80, s: 0x3d3, pointerAfter: 0x1234 });
    const w = p.stack_operations.find((o) => o.kind === 'write');
    assert.deepEqual(
      w.bytes.map((b) => b.physical_address),
      p.next_opcode_sources.pointer_reads.map((b) => b.physical_address),
    );
    assert.deepEqual(
      p.next_opcode_sources.word_reads.map((b) => b.address),
      ['80:1238', '80:1239'],
    );
    assert.notEqual(p.next_opcode_sources.word_reads[0].address, '80:A005');
    assert.deepEqual(
      own(entry, { s: 0x3da })
        .stack_operations.find((o) => o.kind === 'write')
        .bytes.map((b) => b.address),
      ['00:03DD', '00:03DE'],
    );
  }
  assert.match(report.contract.aliases, /frame\/control\/cursor\/savedouterS/);
  assert.match(report.contract.aliases, /no cached pointer\/opcode/);
});

test('independent signed and unsigned arithmetic checks carry/overflow at all WORDs against boundarypartners', () => {
  const signed = (v) => (v >= 32768 ? v - 65536 : v),
    partners = [0, 1, 2, 0x7fff, 0x8000, 0x8001, 0xfffe, 0xffff];
  for (let left = 0; left < 65536; left++)
    for (const right of partners)
      for (const entry of [0x80f532, 0x80f53b]) {
        const add = entry === 0x80f532,
          unsigned = add ? left + right : left - right,
          signedResult = add ? signed(left) + signed(right) : signed(left) - signed(right);
        const p = result(entry, left, right);
        assert.equal(p.value, ((unsigned % 65536) + 65536) % 65536);
        assert.equal(p.carry, Number(add ? unsigned > 65535 : unsigned >= 0));
        assert.equal(p.overflow, Number(signedResult > 32767 || signedResult < -32768));
      }
  assert.deepEqual(result(0x80f532, 0x7fff, 1), { value: 0x8000, carry: 0, overflow: 1 });
  assert.deepEqual(result(0x80f532, 0xffff, 1), { value: 0, carry: 1, overflow: 0 });
  assert.deepEqual(result(0x80f53b, 0x8000, 1), { value: 0x7fff, carry: 1, overflow: 1 });
  assert.deepEqual(result(0x80f53b, 0, 1), { value: 0xffff, carry: 0, overflow: 0 });
});

test('binary equations reject decimal/unknownmode/invalidwords; source never CLDs and Drop needs no binarymode', () => {
  assert.ok(![...map.values()].some((i) => i.mnemonic === 'CLD'));
  for (const decimalFlag of [1, undefined, null, false])
    assert.throws(
      () => binaryConsumerResult({ entry: 0x80f532, left: 9, right: 1, decimalFlag }),
      /decimal flag0/,
    );
  for (const [left, right] of [
    [-1, 1],
    [65536, 0],
    [null, 0],
    [0, undefined],
  ])
    assert.throws(
      () => binaryConsumerResult({ entry: 0x80f53b, left, right, decimalFlag: 0 }),
      /WORDs/,
    );
  assert.throws(
    () => binaryConsumerResult({ entry: 0x80f8bb, left: 0, right: 0, decimalFlag: 0 }),
    /Invalid/,
  );
  assert.match(report.contract.decimal, /status decimal flag0/);
  assert.match(report.contract.decimal, /Neither handler executes CLD/);
  assert.equal(report.consumers[0].binary_arithmetic, null);
});

test('actual refetchAND/TAX overwrites N/Z but preserves arithmeticC/V and I/decimal; no oldopcode/extraINY', () => {
  at(0x80f389, 'LDA', 0, 'diy');
  at(0x80f38b, 'INY');
  at(0x80f38c, 'AND', 255, 'immM');
  at(0x80f38f, 'TAX');
  at(0x80f390, 'JMP', 0xf2b4, 'indx');
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30))
      for (let low = 0; low < 256; low++) {
        const final = (status & ~0x82) | (low === 0 ? 2 : 0);
        assert.equal(final & 0x80, 0);
        assert.equal(Boolean(final & 2), low === 0);
        assert.equal(final & 0x4d, status & 0x4d);
      }
  assert.equal([...map.values()].filter((i) => i.mnemonic === 'INY').length, 1);
  assert.ok(
    report.consumers.every(
      (p) => p.y_delta_before_next_opcode === 0 && p.y_delta_at_frontier === 1,
    ),
  );
  assert.ok(report.consumers.every((p) => p.frontier.a === 'Fresh next-opcode lowbyte'));
});

test('bounded host Drop and binaryAdd/Subtract match synthetic values, retaining separate source/PC/storage contracts', () => {
  const add = compileScriptFrame([0x5c, 0x56], { localBytes: 0, returnBytes: 2 }),
    sub = compileScriptFrame([0x5e, 0x56], { localBytes: 0, returnBytes: 2 });
  for (const left of [0, 1, 0x7fff, 0x8000, 0xffff])
    for (const right of [0, 1, 0x7fff, 0x8000, 0xffff])
      for (const [entry, compile] of [
        [0x80f532, add],
        [0x80f53b, sub],
      ]) {
        const frame = compile([left, right]);
        frame.step();
        assert.deepEqual(frame.snapshot().stack, [result(entry, left, right).value]);
        assert.equal(frame.snapshot().pc, 1);
      }
  const stack = [12, 34];
  assert.equal(stepStackPrimitive(Uint8Array.of(0xbc), 0, stack).nextPc, 1);
  assert.deepEqual(stack, [12]);
  assert.throws(() => stepStackPrimitive(Uint8Array.of(0xbc), 0, []), /underflow/);
  assert.throws(() => add([1]).step(), /underflow/);
  assert.match(report.contract.host_boundary, /F390Y already follows/);
  assert.match(report.contract.host_boundary, /synthetic/);
});

test('sourceproof rejects every missing instruction/width/raw/mode/edge and uses only the selected handler', () => {
  for (const [entry, start, end] of [
    [0x80f8bb, 0x80f8bb, 0x80f8bf],
    [0x80f532, 0x80f532, 0x80f53b],
    [0x80f53b, 0x80f53b, 0x80f546],
  ]) {
    const local = new Map(
      [...map].filter(([pc]) => (pc >= start && pc < end) || (pc >= 0x80f389 && pc < 0x80f393)),
    );
    assert.deepEqual(proveConsumerToDispatch(local, entry), proveConsumerToDispatch(map, entry));
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveConsumerToDispatch(missing, entry));
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
        assert.throws(() => proveConsumerToDispatch(m, entry));
      }
    }
  }
  for (const [entry, pc, patch] of [
    [0x80f532, 0x80f533, { mnemonic: 'SEC' }],
    [0x80f53b, 0x80f53b, { mnemonic: 'CLC' }],
    [0x80f532, 0x80f536, { value: 3 }],
    [0x80f53b, 0x80f540, { value: 1 }],
    [0x80f8bb, 0x80f8bc, { target: 0x80f532 }],
    [0x80f53b, 0x80f390, { value: 0xf2b5 }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveConsumerToDispatch(m, entry));
  }
  assert.throws(() => proveConsumerToDispatch(map, 0x80f378), /Invalid/);
});

test('address equations demand fullcontext/freshpointer and never authorize unmapped/ROM/device stackwrites', () => {
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
    assert.throws(() => own(0x80f532, patch), /Explicit/);
  assert.throws(() => own(0x80f393), /Invalid/);
  assert.equal(
    own(0x80f532, { s: 0x1ffd }).stack_operations.find((o) => o.kind === 'write').bytes[0]
      .physical_address,
    null,
  );
  const romByte = own(0x80f532, { s: 0x7ffd }).stack_operations.find((o) => o.kind === 'write')
    .bytes[0];
  assert.equal(romByte.address, '00:8000');
  assert.equal(romByte.physical_address, '80:8000');
  assert.match(own(0x80f532).qualification, /not an actual owner/);
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
});

test('local consumers stay partial sources in visit/9178 and central status without globalstack/native promotion', async () => {
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
    (s) => s.source === 'analysis/render-task-consumers.json',
  );
  assert.deepEqual(supplied.entries, ['80:F8BB', '80:F532', '80:F53B']);
  assert.equal(supplied.operand_s_delta_each, 2);
  assert.equal(supplied.outer_return_frames_added, 0);
  assert.equal(visit.full_graph.closed, false);
  assert.equal(visit.full_graph.minimum_protected_stack_bytes, null);
  assert.equal(text.full_graph.closed, false);
  assert.ok(
    ['native-required', 'composition-required'].includes(
      progress.work_groups.find((g) => g.id === 'task-f378-stack-consumers').status,
    ),
  );
  assert.ok(
    !progress.supplied.some((r) =>
      ['80:F8BB', '80:F532', '80:F53B', '80:C1CA', '80:9178'].includes(r.entry),
    ),
  );
});
