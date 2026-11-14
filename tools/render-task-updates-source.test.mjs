import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveUpdateToDispatch,
  describeUpdateByteOwners,
  updateWord,
} from './render-task-updates-source-proof.mjs';
import { compileScriptFrame } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-task-updates.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'incrementF3E4',
    0x80f3e4,
    0x80f3ea,
    4,
    'b8bf444f6c0c2d8ce32234fd42ebcf862a294352ff536287cd9fd7d9eac1b6ed',
  ],
  [
    'decrementF3EA',
    0x80f3ea,
    0x80f3f0,
    4,
    'ce491077960add6c93e2128795bf79f5dc7c802520def624e130bc1752535ccd',
  ],
  [
    'duplicateF3F0',
    0x80f3f0,
    0x80f3f6,
    3,
    '0fe10f25419a741de98efd46388abb699ba45ef7da1ebc743fe03943656e0bbd',
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
const own = (entry, patch = {}) => describeUpdateByteOwners({ ...context, entry, ...patch });
const labels = (bytes) => bytes.map((b) => b.address);
// Independent ROM source pins and explicit synthetic byte/value equations.
// No real Task/CPU/device/interrupt/scene or frame trace is executed.

test('update28/16 independently pins every original window/count/hash and whole JMP bodies', () => {
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
  assert.equal(map.size, 16);
  assert.equal(report.source_graph.code_bytes, 28);
  assert.equal(report.source_graph.instructions, 16);
});

test('86/88/BA unscaled opcode tableWORDs match independent targethashes and actual sharedfetch owners', async () => {
  for (const [opcode, source, target, hash] of [
    [0x86, 0x80f33a, 0x80f3e4, 'ef18c1b279b848cc054b5c09e89a5c03536ef3d70499e6935e93935e0919ba2d'],
    [0x88, 0x80f33c, 0x80f3ea, 'fd816a42ab0546055e5f56bb0d0982ffe31f7ffa628f867b86ffc6480094e412'],
    [0xba, 0x80f36e, 0x80f3f0, '142a21d26540ec3775225c82108637fec793855e585a582005d19b1d7bb4723b'],
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

test('Increment is fullWORD PLA/INC accumulator/PHA, temporaryS+2 and high-first replacement of original top', () => {
  at(0x80f3e4, 'PLA');
  at(0x80f3e5, 'INC', 0, 'A');
  at(0x80f3e6, 'PHA');
  at(0x80f3e7, 'JMP', 0x80f389, 'abs');
  const p = proveUpdateToDispatch(map, 0x80f3e4);
  assert.deepEqual(p, report.updates[0]);
  assert.equal(p.reachable_instructions, 9);
  assert.equal(p.operand_s_delta, 0);
  assert.equal(p.stack_read.s_delta_after_read, 2);
  assert.equal(p.stack_push.s_delta_before_push, 2);
  const b = own(0x80f3e4);
  assert.deepEqual(labels(b.stack_reads), ['00:03F1', '00:03F2']);
  assert.deepEqual(labels(b.stack_writes), ['00:03F2', '00:03F1']);
  assert.deepEqual(
    b.stack_writes.map((w) => w.byte),
    ['high', 'low'],
  );
  assert.equal(b.output_operand_s, 0x3f0);
});

test('Decrement uses DEC accumulator, not SBC/memoryDEC, and puts WORD back with unchanged finalS', () => {
  at(0x80f3ea, 'PLA');
  at(0x80f3eb, 'DEC', 0, 'A');
  at(0x80f3ec, 'PHA');
  at(0x80f3ed, 'JMP', 0x80f389, 'abs');
  const p = proveUpdateToDispatch(map, 0x80f3ea);
  assert.deepEqual(p, report.updates[1]);
  assert.equal(p.reachable_instructions, 9);
  assert.equal(p.operand_words_added, 0);
  assert.equal(p.operand_s_delta, 0);
  assert.equal(own(0x80f3ea).s_after_read, 0x3f2);
  assert.equal(updateWord(0x80f3ea, 0), 65535);
  assert.equal(updateWord(0x80f3ea, 0x8000), 0x7fff);
});

test('Duplicate LDA01,S leaves S before PHA, reads both original bytes then high/lowpush atS/S-1', () => {
  at(0x80f3f0, 'LDA', 1, 'sr');
  at(0x80f3f2, 'PHA');
  at(0x80f3f3, 'JMP', 0x80f389, 'abs');
  const p = proveUpdateToDispatch(map, 0x80f3f0);
  assert.deepEqual(p, report.updates[2]);
  assert.equal(p.reachable_instructions, 8);
  assert.equal(p.operand_s_delta, -2);
  assert.equal(p.operand_words_added, 1);
  assert.equal(p.stack_read.s_delta_after_read, 0);
  const b = own(0x80f3f0);
  assert.deepEqual(labels(b.stack_reads), ['00:03F1', '00:03F2']);
  assert.deepEqual(labels(b.stack_writes), ['00:03F0', '00:03EF']);
  assert.equal(b.s_after_read, 0x3f0);
  assert.equal(b.output_operand_s, 0x3ee);
});

test('every WORD value has independently checked increment/decrement modulo65536 and exactduplicate bytes', () => {
  for (let value = 0; value < 65536; value++) {
    assert.equal(updateWord(0x80f3e4, value), (value + 1) % 65536);
    assert.equal(updateWord(0x80f3ea, value), (value + 65535) % 65536);
    assert.equal(updateWord(0x80f3f0, value), (value >>> 8) * 256 + (value % 256));
  }
  assert.equal(updateWord(0x80f3e4, 0xffff), 0);
  assert.equal(updateWord(0x80f3e4, 0x7fff), 0x8000);
  assert.equal(updateWord(0x80f3ea, 0), 0xffff);
});

test('every16bit S wraps PLA/PHA separately; updates reuse exactbyteowners, duplicate newbytes are disjoint', () => {
  for (let s = 0; s < 65536; s++)
    for (const entry of [0x80f3e4, 0x80f3ea, 0x80f3f0]) {
      const duplicate = entry === 0x80f3f0,
        p = own(entry, { s }),
        top = [(s + 1) % 65536, (s + 2) % 65536];
      const out = duplicate ? [s, (s + 65535) % 65536] : top.slice().reverse();
      assert.deepEqual(labels(p.stack_reads), top.map(cpuLabel));
      assert.deepEqual(labels(p.stack_writes), out.map(cpuLabel));
      assert.equal(p.output_operand_s, duplicate ? (s + 65534) % 65536 : s);
      assert.equal(p.s_after_read, duplicate ? s : (s + 2) % 65536);
      if (duplicate) assert.equal(new Set([...top, ...out]).size, 4);
    }
  assert.deepEqual(labels(own(0x80f3e4, { s: 0xfffe }).stack_reads), ['00:FFFF', '00:0000']);
  assert.deepEqual(labels(own(0x80f3e4, { s: 0xfffe }).stack_writes), ['00:0000', '00:FFFF']);
  assert.deepEqual(labels(own(0x80f3f0, { s: 0 }).stack_writes), ['00:0000', '00:FFFF']);
});

test('256 DBRs never redirect operandbytes, fetchWORD carriesbanks while fullD/Y wrap independently', () => {
  for (let bank = 0; bank < 256; bank++) {
    const p = own(0x80f3f0, { bank, d: 0xffff, y: 1, pointerAfter: 0xffff });
    assert.deepEqual(p.stack_reads, own(0x80f3f0).stack_reads);
    assert.deepEqual(p.stack_writes, own(0x80f3f0).stack_writes);
    assert.deepEqual(labels(p.next_opcode_sources.pointer_reads), ['00:FFFF', '00:0000']);
    assert.deepEqual(labels(p.next_opcode_sources.word_reads), [
      cpuLabel(((bank + 1) & 255) * 65536),
      cpuLabel(((bank + 1) & 255) * 65536 + 1),
    ]);
  }
  const b = own(0x80f3ea, { bank: 255, y: 0, pointerAfter: 65535 });
  assert.deepEqual(labels(b.next_opcode_sources.word_reads), ['FF:FFFF', '00:0000']);
  assert.equal(own(0x80f3e4, { y: 65535 }).next_opcode_y, 65535);
  assert.equal(own(0x80f3e4, { y: 65535 }).frontier_y, 0);
});

test('updates or duplicate can alias both pointerbytes; actual fetch must follow original WORD read and both stores', () => {
  for (const [entry, s] of [
    [0x80f3e4, 0x3d5],
    [0x80f3ea, 0x3d5],
    [0x80f3f0, 0x3d7],
  ]) {
    const p = own(entry, { bank: 0x80, s, pointerAfter: 0x1234 });
    assert.deepEqual(
      p.stack_writes.map((b) => b.physical_address),
      p.next_opcode_sources.pointer_reads
        .slice()
        .reverse()
        .map((b) => b.physical_address),
    );
    assert.deepEqual(labels(p.next_opcode_sources.word_reads), ['80:1238', '80:1239']);
    assert.notEqual(p.next_opcode_sources.word_reads[0].address, '80:A005');
    assert.match(report.contract.aliases, /freshpointer\/data after both high\/lowstores/);
  }
  assert.deepEqual(labels(own(0x80f3f0, { s: 0x3de }).stack_writes), ['00:03DE', '00:03DD']);
  assert.match(report.contract.aliases, /No automatic frame7 rewrite/);
});

test('Carry/V/decimal/I survive INC/DEC including signedwrap; no binary-only premise or Carry seed', () => {
  assert.ok(
    ![...map.values()].some((i) => ['ADC', 'SBC', 'CLC', 'SEC', 'CLD', 'SED'].includes(i.mnemonic)),
  );
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30))
      for (let low = 0; low < 256; low++) {
        const final = (status & ~0x82) | (low === 0 ? 2 : 0);
        assert.equal(final & 0x4d, status & 0x4d);
        assert.equal(final & 0x80, 0);
        assert.equal(Boolean(final & 2), low === 0);
      }
  assert.ok(report.updates.every((p) => p.decimal_flag_required === null));
  assert.match(report.contract.flags, /preserveC\/V, even7FFF/);
  assert.match(report.contract.flags, /No ADC\/SBC\/CLD or binary-only premise/);
});

test('actual fullWORD fetch and ignoredhigh follow every PHA; finalopcode AND/TAX and oneINY are pinned', () => {
  at(0x80f389, 'LDA', 0, 'diy');
  at(0x80f38b, 'INY');
  at(0x80f38c, 'AND', 255, 'immM');
  at(0x80f38f, 'TAX');
  at(0x80f390, 'JMP', 0xf2b4, 'indx');
  for (const p of report.updates) {
    assert.deepEqual(p.visited.slice(-5), ['80:F389', '80:F38B', '80:F38C', '80:F38F', '80:F390']);
    assert.ok(p.visited.indexOf(p.stack_push.at) < p.visited.indexOf('80:F389'));
    assert.equal(p.y_delta_before_next_opcode, 0);
    assert.equal(p.y_delta_at_frontier, 1);
  }
  assert.equal([...map.values()].filter((i) => i.mnemonic === 'INY').length, 1);
  assert.match(report.contract.fetch, /including ignoredhigh/);
  assert.ok(report.updates.every((p) => p.frontier.a === 'Fresh next-opcode lowbyte'));
});

test('bounded hostupdates agree on synthetic values and preserve lowerwords, underflowguard and PC boundary', () => {
  for (const [opcode, entry] of [
    [0x86, 0x80f3e4],
    [0x88, 0x80f3ea],
    [0xba, 0x80f3f0],
  ]) {
    const compile = compileScriptFrame([opcode, 0x56], { localBytes: 0, returnBytes: 2 });
    for (const value of [0, 1, 9, 0x7fff, 0x8000, 0xffff]) {
      const frame = compile([0xcafe, value]);
      frame.step();
      const s = frame.snapshot();
      assert.equal(s.pc, 1);
      assert.deepEqual(
        s.stack,
        opcode === 0xba ? [0xcafe, value, value] : [0xcafe, updateWord(entry, value)],
      );
    }
    assert.throws(() => compile([]).step(), /underflow/);
  }
  assert.match(report.contract.host_boundary, /returnsPC before nextopcode/);
  assert.match(report.contract.host_boundary, /Synthetic hostvalue/);
});

test('sourceproof rejects missing bodies/modes/raw/accumulator forms/stack effects/return edges for each independent path', () => {
  for (const [entry, start, end] of [
    [0x80f3e4, 0x80f3e4, 0x80f3ea],
    [0x80f3ea, 0x80f3ea, 0x80f3f0],
    [0x80f3f0, 0x80f3f0, 0x80f3f6],
  ]) {
    const local = new Map(
      [...map].filter(([pc]) => (pc >= start && pc < end) || (pc >= 0x80f389 && pc < 0x80f393)),
    );
    assert.deepEqual(proveUpdateToDispatch(local, entry), proveUpdateToDispatch(map, entry));
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveUpdateToDispatch(missing, entry));
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
        assert.throws(() => proveUpdateToDispatch(m, entry));
      }
    }
  }
  for (const [entry, pc, patch] of [
    [0x80f3e4, 0x80f3e5, { mode: 'dp' }],
    [0x80f3ea, 0x80f3eb, { mnemonic: 'SBC' }],
    [0x80f3f0, 0x80f3f0, { value: 3 }],
    [0x80f3e4, 0x80f3e6, { mnemonic: 'PHX' }],
    [0x80f3f0, 0x80f3f3, { target: 0x80f3e4 }],
    [0x80f3ea, 0x80f390, { value: 0xf2b5 }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveUpdateToDispatch(m, entry));
  }
  assert.throws(() => proveUpdateToDispatch(map, 0x80f378), /Invalid/);
});

test('address/value equations demand realcontext/fullWORD and never authorize device/ROM byteowners', () => {
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
    assert.throws(() => own(0x80f3e4, patch), /Explicit/);
  assert.throws(() => own(0x80f393), /Invalid/);
  for (const value of [-1, 65536, null, undefined])
    assert.throws(() => updateWord(0x80f3e4, value), /WORD/);
  assert.throws(() => updateWord(0x80f532, 1), /Invalid/);
  assert.equal(own(0x80f3f0, { s: 0x2000 }).stack_writes[0].physical_address, null);
  const b = own(0x80f3e4, { s: 0x7ffe }).stack_writes[0];
  assert.equal(b.address, '00:8000');
  assert.equal(b.physical_address, '80:8000');
  assert.match(own(0x80f3ea).qualification, /not an owner/);
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
});

test('update sources stay partial in visit/9178/central, without globalstack or native promotion', async () => {
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
    (s) => s.source === 'analysis/render-task-updates.json',
  );
  assert.deepEqual(supplied.entries, ['80:F3E4', '80:F3EA', '80:F3F0']);
  assert.deepEqual(supplied.operand_s_deltas, [0, 0, -2]);
  assert.equal(supplied.outer_return_frames_added, 0);
  assert.equal(visit.full_graph.closed, false);
  assert.equal(visit.full_graph.minimum_protected_stack_bytes, null);
  assert.equal(text.full_graph.closed, false);
  assert.ok(
    ['native-required', 'composition-required'].includes(
      progress.work_groups.find((g) => g.id === 'task-f378-stack-updates').status,
    ),
  );
  assert.ok(
    !progress.supplied.some((r) =>
      ['80:F3E4', '80:F3EA', '80:F3F0', '80:C1CA', '80:9178'].includes(r.entry),
    ),
  );
});
