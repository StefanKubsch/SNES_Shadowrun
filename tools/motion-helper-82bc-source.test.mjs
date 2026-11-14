import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/motion-helper-82bc.json', import.meta.url), 'utf8'));
const earlier = JSON.parse(await readFile(new URL('../analysis/motion-helper-8238.json', import.meta.url), 'utf8'));
const mode = { e: 0, m: 0, x: 0 };
const windows = [
  [0x8082BC, 0x808371, 'ea535aa2cc837ba924860e6fd81b3015ebf8dc2109328e8dc4fdb88536ce3982'],
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

test('Complete82BC graph pins440 bytes,46 edges and all six calls; shared searches match the prior sourced routines', () => {
  let total = 0;
  for (const [index, [start, end, digest]] of windows.entries()) {
    const bytes = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
    assert.deepEqual(report.routines[index], { entry: cpuLabel(start), end_exclusive: cpuLabel(end), covered_bytes: end - start,
      sha256: digest, machine_bytes: bytes.toString('hex').toUpperCase() });
    if (index > 0) assert.deepEqual(report.routines[index], earlier.routines[index]);
    total += bytes.length;
  }
  assert.equal(total, 440);
  const edges = [...all.values()].filter(i => i.target !== undefined);
  assert.equal(edges.length, 46);
  assert.deepEqual(report.edges, edges.map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
  for (const i of edges) assert.ok(all.has(i.target));
  assert.deepEqual(edges.filter(i => i.mnemonic === 'JSL').map(i => i.target), [0x8186E5, 0x8186E5, 0x8186E5, 0x8186E5, 0x8185FE, 0x818686]);
  const root = routines[0];
  assert.equal(rom.subarray(0x2BC, 0x2C7).toString('hex'), '863e5a8bf47e7eabab643b');
  assert.deepEqual([...root.values()].filter(i => i.mnemonic === 'ADC').map(i => i.value), [0x7E43A0, 0x7E4348, 0x7E42F0, 0x7E4240, 0x7E4298]);
  assert.deepEqual([...root.values()].filter(i => i.mnemonic === 'LDA' && i.mode === 'absx').map(i => i.value), [0x0ED8, 0x0E80, 0x0E80, 0x0E28, 0x0E28]);
  assert.deepEqual([...all.values()].filter(i => i.mnemonic === 'LDA' && i.mode === 'longx').map(i => i.value), [0x7FE214, 0x7FE214]);
  assert.deepEqual([...all.values()].filter(i => i.mode === 'absx' && i.mnemonic === 'LDA' && i.value >= 0x8000).map(i => i.value), [0xF79C, 0xF79C]);
});

test('Every82BC graph instruction has a covered static CFG, balanced stacks and preserved word modes/DBR on all returns', () => {
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
      if (i.mnemonic === 'PLB') assert.equal(stack.pop(), pc === 0x80836C ? 'callerDBR' : '7E');
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

test('82BC prepares all four indices, skips duplicates, exits after nonzero index results and has the exact scratch/caller footprint', () => {
  const root = routines[0];
  assert.deepEqual([...root.values()].filter(i => i.mnemonic === 'STA').map(i => i.value), [0x1D, 0x20, 0x1A, 0x2C, 0x17, 0x29, 0x11, 0x23, 0x38, 0x14, 0x26, 0x2F, 0x35, 0x32]);
  assert.equal(rom.subarray(0x32B, 0x338).toString('hex'), 'a526052c8535a523052c8532a8');
  assert.deepEqual([...root.values()].filter(i => i.mode === 'rel8').map(i => [i.cpu, i.mnemonic, i.target]), [
    [0x80833C, 'BCC', 0x80836C], [0x808342, 'BEQ', 0x80834A], [0x808348, 'BCC', 0x80836C],
    [0x80834E, 'BEQ', 0x80835A], [0x808352, 'BEQ', 0x80835A], [0x808358, 'BCC', 0x80836C],
    [0x80835E, 'BEQ', 0x80836C], [0x808362, 'BEQ', 0x80836C], [0x808366, 'BEQ', 0x80836C]
  ]);
  assert.deepEqual([...root.values()].filter(i => i.mnemonic === 'LDY').map(i => i.value), [0x38, 0x2F, 0x35]);
  assert.deepEqual([...root.values()].filter(i => i.mnemonic === 'CPY').map(i => i.value), [0x32, 0x32, 0x38, 0x32, 0x38, 0x2F]);
  const writes = [...all.values()].filter(i => ['STA', 'STX', 'STY', 'STZ'].includes(i.mnemonic));
  assert.ok(writes.every(i => i.mode === 'dp'));
  const locations = [...new Set(writes.map(i => i.value))].sort((a, b) => a - b);
  assert.deepEqual(locations, [0x11, 0x14, 0x17, 0x1A, 0x1D, 0x20, 0x23, 0x26, 0x29, 0x2C, 0x2F, 0x32, 0x35, 0x38, 0x3B, 0x3E, 0x68]);
  assert.deepEqual(report.side_effects.scratch_words, locations.map(v => v.toString(16).toUpperCase().padStart(2, '0')));
  assert.ok(locations.every(v => v > 0x0F && v + 1 < 0x6B));
  const caller = rom.subarray(0x2C16, 0x2C2F);
  assert.equal(createHash('sha256').update(caller).digest('hex'), '43734e6547064a670a745d9c43a14101d818f84abd9b9fe4c465a5551e5c4ab1');
  assert.equal(report.caller.machine_bytes, caller.toString('hex').toUpperCase());
  const continuation = new Map();
  for (let pc = 0x80AC16; pc < 0x80AC2F;) { const i = decode(rom, pc, mode); continuation.set(pc, i); pc = i.next; }
  assert.equal(continuation.get(0x80AC19).target, 0x80AC23);
  assert.deepEqual([...continuation.values()].filter(i => ['STA', 'STZ'].includes(i.mnemonic)).map(i => i.value), [0x0ED8, 0x0DD0, 0x0F30]);
  assert.equal(continuation.get(0x80AC1B).value, 0x6B);
  assert.equal(continuation.get(0x80AC27).value, 0x0E28);
  assert.equal(continuation.get(0x80AC2A).mnemonic, 'LSR');
});

test('82BC return Carry is preserved after actual calls and correctly set by equalCPY when the last index is skipped', () => {
  // Abstract result classes and control-flow facts only. No concrete A/Y
  // values, memory, game records or CPU program are executed.
  // The shared86E5 endpoint independently pins its A=3B/Carry return class.
  assert.equal(rom.subarray(0x86F9, 0x8701).toString('hex'), 'a53bf002186b386b');
  assert.equal(rom.subarray(0x36C, 0x371).toString('hex'), 'ab7aa63e60');
  const root = routines[0], pending = [[0x808338, 'unknown', null]], seen = new Set(), returns = new Set();
  while (pending.length) {
    const [pc, result, carry] = pending.pop(), key = `${pc}/${result}/${carry}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const i = root.get(pc); assert.ok(i);
    if (i.mnemonic === 'JSL') {
      assert.equal(i.target, 0x8186E5);
      pending.push([i.next, 'zero', 1], [i.next, 'nonzero', 0]);
    } else if (i.mnemonic === 'BCC') {
      assert.notEqual(carry, null); pending.push([carry === 0 ? i.target : i.next, result, carry]);
    } else if (i.mnemonic === 'CPY') {
      pending.push([i.next, result, null]);
    } else if (i.mnemonic === 'BEQ') {
      assert.equal(root.get(pc - 2).mnemonic, 'CPY');
      pending.push([i.target, result, 1], [i.next, result, null]);
    } else if (i.mnemonic === 'RTS') {
      assert.notEqual(result, 'unknown'); assert.equal(carry, result === 'zero' ? 1 : 0); returns.add(`${result}/${carry}`);
    } else {
      assert.ok(['LDY', 'PLB', 'PLY', 'LDX'].includes(i.mnemonic));
      pending.push([i.next, result, carry]);
    }
  }
  assert.deepEqual([...returns].sort(), ['nonzero/0', 'zero/1']);
  for (const pc of root.keys()) if (pc >= 0x808338) assert.ok([...seen].some(key => key.startsWith(`${pc}/`)));
});
