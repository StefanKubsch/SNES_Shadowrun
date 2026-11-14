import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/motion-helper-8238.json', import.meta.url), 'utf8'));
const earlier = JSON.parse(await readFile(new URL('../analysis/motion-helper-8133.json', import.meta.url), 'utf8'));
const mode = { e: 0, m: 0, x: 0 };
const windows = [
  [0x808238, 0x8082BC, 'b9e3b7bd867b8e84e1428d03e243038fcd907d5a9d712c61c18662e6d8067c7a'],
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

test('Complete8238 graph pins391 bytes,37 edges and all shared list callees; preparation is a distinct source routine', () => {
  let total = 0;
  for (const [index, [start, end, digest]] of windows.entries()) {
    const bytes = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
    assert.deepEqual(report.routines[index], { entry: cpuLabel(start), end_exclusive: cpuLabel(end), covered_bytes: end - start,
      sha256: digest, machine_bytes: bytes.toString('hex').toUpperCase() });
    if (index > 0) assert.deepEqual(report.routines[index], earlier.routines[index]);
    total += bytes.length;
  }
  assert.equal(total, 391);
  const edges = [...all.values()].filter(i => i.target !== undefined);
  assert.equal(edges.length, 37);
  assert.deepEqual(report.edges, edges.map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
  for (const i of edges) assert.ok(all.has(i.target));
  assert.deepEqual(edges.filter(i => i.mnemonic === 'JSL').map(i => i.target), [0x8186E5, 0x8186E5, 0x8185FE, 0x818686]);
  const preparation = routines[0];
  assert.equal(rom.subarray(0x238, 0x243).toString('hex'), '863e5a8bf47e7eabab643b');
  assert.deepEqual([...preparation.values()].filter(i => i.mnemonic === 'ADC').map(i => i.value), [0x7E43A0, 0x7E4348, 0x7E42F0, 0x7E4240, 0x7E4298]);
  assert.deepEqual([...preparation.values()].filter(i => i.mnemonic === 'LDA' && i.mode === 'absx').map(i => i.value), [0x0ED8, 0x0E80, 0x0E80, 0x0E28, 0x0E28]);
  assert.equal(rom.subarray(0x292, 0x2B0).toString('hex'), '851429c0030a0a0aeb85260529852fa822e58681a438c42ff00422e58681');
  assert.equal(preparation.get(0x8082AA).target, 0x8082B0);
  assert.deepEqual([...all.values()].filter(i => i.mnemonic === 'LDA' && i.mode === 'longx').map(i => i.value), [0x7FE214, 0x7FE214]);
  assert.deepEqual([...all.values()].filter(i => i.mode === 'absx' && i.mnemonic === 'LDA' && i.value >= 0x8000).map(i => i.value), [0xF79C, 0xF79C]);
});

test('Every8238 graph instruction has a covered CFG with balanced stacks and restored DBR/word modes on all returns', () => {
  // Static control/stack shapes only; no CPU registers or game data executed.
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
      if (i.mnemonic === 'PLB') assert.equal(stack.pop(), pc === 0x8082B0 ? 'callerDBR' : '7E');
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

test('8238 exact scratch footprint, original carry polarity and second-axis caller reactions are pinned independently', () => {
  const writes = [...all.values()].filter(i => ['STA', 'STX', 'STY', 'STZ'].includes(i.mnemonic));
  assert.ok(writes.every(i => i.mode === 'dp'));
  const locations = [...new Set(writes.map(i => i.value))].sort((a, b) => a - b);
  assert.deepEqual(locations, [0x11, 0x14, 0x17, 0x1A, 0x1D, 0x20, 0x23, 0x26, 0x29, 0x2F, 0x38, 0x3B, 0x3E, 0x68]);
  assert.deepEqual(report.side_effects.scratch_words, locations.map(v => v.toString(16).toUpperCase().padStart(2, '0')));
  assert.ok(locations.every(v => v > 0x0F && v + 1 < 0x6B));
  assert.equal(locations.includes(0x2C) || locations.includes(0x32), false);
  assert.equal(rom.subarray(0x2B0, 0x2BC).toString('hex'), 'ab7aa63ea53bd00238601860');
  assert.equal(all.get(0x81862E).mnemonic, 'BCC'); // Equal candidate accepted.
  assert.equal(all.get(0x8186B6).mnemonic, 'BCC');
  assert.equal(all.get(0x818673).value, 0x40); // Forced64 may replace larger candidate.
  assert.equal(all.get(0x8186C8).value, 0x0CC2);
  const caller = rom.subarray(0x2BC1, 0x2BE6);
  assert.equal(createHash('sha256').update(caller).digest('hex'), '3145bad9f1daa2764682ae03b1c13652377304d2887ce06b6c17c89c389ca70a');
  assert.equal(report.caller.machine_bytes, caller.toString('hex').toUpperCase());
  const continuation = new Map();
  for (let pc = 0x80ABC1; pc < 0x80ABE6;) { const i = decode(rom, pc, mode); continuation.set(pc, i); pc = i.next; }
  assert.equal(continuation.get(0x80ABC4).target, 0x80ABE6);
  assert.equal(continuation.get(0x80ABC6).value, 5);
  assert.equal(continuation.get(0x80ABC9).target, 0x80ABD8);
  assert.deepEqual([...continuation.values()].filter(i => ['STA', 'STZ'].includes(i.mnemonic)).map(i => i.value), [0x0ED8, 0x0DD0, 0x0E80, 0x1458]);
  assert.equal(continuation.get(0x80ABCD).value, 0x0ED8);
  assert.equal(continuation.get(0x80ABD8).value, 0x6B);
  assert.equal(continuation.get(0x80ABE0).value, 8);
});
