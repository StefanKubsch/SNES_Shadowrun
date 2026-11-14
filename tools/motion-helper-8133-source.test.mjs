import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/motion-helper-8133.json', import.meta.url), 'utf8'));
const mode = { e: 0, m: 0, x: 0 };
const windows = [
  [0x808133, 0x8081B4, '37c879e0ee66fb0b6701079768f8a931a45788e18f135809995d03eac86c85ce'],
  [0x8185FE, 0x818686, 'f32fbd4f88be4f0bccc5158a829c516204c905ef974e0726a4b75436593510c7'],
  [0x818686, 0x8186E5, '16d889ce53ce547461388cde1911d233ad049d6321ec4c10a68f151e6a4319d2'],
  [0x8186E5, 0x818701, '871479ad00544723212520b3235a92ddd1836de60c947444c4e81dc7d0073294'],
];
const routines = windows.map(([start, end]) => {
  const instructions = new Map();
  for (let pc = start; pc < end;) { const i = decode(rom, pc, mode); assert.ok(i.next <= end); instructions.set(pc, i); pc = i.next; }
  return instructions;
});
const all = new Map(routines.flatMap(r => [...r]));

test('All 388 helper bytes and every branch/call are pinned; high tables use explicit DBR7E, not bank81 ROM', () => {
  let total = 0;
  for (const [index, [start, end, digest]] of windows.entries()) {
    const bytes = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
    assert.deepEqual(report.routines[index], { entry: cpuLabel(start), end_exclusive: cpuLabel(end), covered_bytes: end - start,
      sha256: digest, machine_bytes: bytes.toString('hex').toUpperCase() });
    total += bytes.length;
  }
  assert.equal(total, 388);
  const edges = [...all.values()].filter(i => i.target !== undefined);
  assert.equal(edges.length, 37);
  assert.deepEqual(report.edges, edges.map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
  for (const i of edges) assert.ok(all.has(i.target));
  assert.deepEqual(edges.filter(i => i.mnemonic === 'JSL').map(i => i.target), [0x8186E5, 0x8186E5, 0x8185FE, 0x818686]);
  assert.equal(rom.subarray(0x133, 0x13E).toString('hex'), '863e5a8bf47e7eabab643b');
  assert.deepEqual([...all.values()].filter(i => i.mode === 'absx' && i.mnemonic === 'LDA' && i.value >= 0x8000).map(i => i.value), [0xF79C, 0xF79C]);
  assert.deepEqual([...all.values()].filter(i => i.mode === 'longx' && i.mnemonic === 'LDA').map(i => i.value), [0x7FE214, 0x7FE214]);
});

test('Static CFG covers every helper instruction with balanced stacks, restored DBR and unchanged word modes on all returns', () => {
  // Abstract stack shapes/control edges only. No registers, bus or game data
  // are executed; balanced callee contracts are checked independently.
  for (const [index, routine] of routines.entries()) {
    const pending = [[windows[index][0], []]], seen = new Map(), returns = [];
    while (pending.length) {
      const [pc, incoming] = pending.pop();
      if (seen.has(pc)) { assert.deepEqual(seen.get(pc), incoming, `Conflicting stack at${cpuLabel(pc)}`); continue; }
      seen.set(pc, incoming);
      const i = routine.get(pc); assert.ok(i);
      assert.equal(['REP', 'SEP', 'PLP', 'XCE', 'TCD', 'PLD', 'SED', 'JSR', 'JML', 'RTI'].includes(i.mnemonic), false);
      const stack = [...incoming];
      if (['PHY', 'PHX', 'PHA'].includes(i.mnemonic)) stack.push('word');
      if (i.mnemonic === 'PHB') stack.push('callerDBR');
      if (i.mnemonic === 'PEA') { assert.equal(i.value, 0x7E7E); stack.push('7E', '7E'); }
      if (['PLY', 'PLX'].includes(i.mnemonic)) assert.equal(stack.pop(), 'word');
      if (i.mnemonic === 'PLB') assert.equal(stack.pop(), pc === 0x8081A8 ? 'callerDBR' : '7E');
      if (['RTS', 'RTL'].includes(i.mnemonic)) {
        assert.deepEqual(stack, []); assert.equal(i.mnemonic, index === 0 ? 'RTS' : 'RTL'); returns.push(pc); continue;
      }
      if (i.mnemonic === 'JSL') { assert.ok(windows.some(([start]) => start === i.target)); pending.push([i.next, stack]); }
      else if (i.mnemonic === 'JMP' || i.mnemonic === 'BRA') pending.push([i.target, stack]);
      else if (i.mode === 'rel8') pending.push([i.next, stack], [i.target, stack]);
      else pending.push([i.next, stack]);
    }
    assert.equal(seen.size, routine.size); assert.ok(returns.length > 0);
  }
});

test('Helper scratch writes, non-Boolean return polarity and caller result handling have exact source evidence', () => {
  const writes = [...all.values()].filter(i => ['STA', 'STX', 'STY', 'STZ'].includes(i.mnemonic));
  assert.ok(writes.every(i => i.mode === 'dp'));
  const locations = [...new Set(writes.map(i => i.value))].sort((a, b) => a - b);
  assert.deepEqual(locations, [0x11, 0x14, 0x17, 0x1A, 0x1D, 0x20, 0x23, 0x29, 0x2C, 0x32, 0x38, 0x3B, 0x3E, 0x68]);
  assert.deepEqual(report.side_effects.scratch_words, locations.map(v => v.toString(16).toUpperCase().padStart(2, '0')));
  assert.ok(locations.every(v => v > 0x0F && v + 1 < 0x6B));
  assert.equal(rom.subarray(0x1A8, 0x1B4).toString('hex'), 'ab7aa63ea53bd00238601860');
  assert.equal(rom.subarray(0x86F9, 0x8701).toString('hex'), 'a53bf002186b386b');
  const caller = rom.subarray(0x2B6A, 0x2B8F);
  assert.equal(createHash('sha256').update(caller).digest('hex'), 'fd1f702f6d2854db403b9ad4a8764776ad82c6b8c8750074b6f8733d35f93a71');
  assert.equal(report.caller.machine_bytes, caller.toString('hex').toUpperCase());
  assert.equal(all.get(0x81862E).mnemonic, 'BCC'); // Equal candidate is accepted.
  assert.equal(all.get(0x8186B6).mnemonic, 'BCC');
  assert.equal(all.get(0x818673).value, 0x40); // First-list override is64, not Boolean1.
  assert.equal(all.get(0x8186C8).value, 0x0CC2); // Second-list optional global comparison.
  assert.equal(all.get(0x8081A2).target, 0x8081A8); // Repeated index is visited only once.
});
