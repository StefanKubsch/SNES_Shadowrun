import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/motion-helper-81b4.json', import.meta.url), 'utf8'));
const earlier = JSON.parse(await readFile(new URL('../analysis/motion-helper-82bc.json', import.meta.url), 'utf8'));
const mode = { e: 0, m: 0, x: 0 };
const windows = [
  [0x8081B4, 0x808238, 'c192b21a9a61dee237041d54e01bb0695bb7e8b09ff5f571f0c6989a5c44a164'],
  [0x8185FE, 0x818686, 'f32fbd4f88be4f0bccc5158a829c516204c905ef974e0726a4b75436593510c7'],
  [0x818686, 0x8186E5, '16d889ce53ce547461388cde1911d233ad049d6321ec4c10a68f151e6a4319d2'],
  [0x8186E5, 0x818701, '871479ad00544723212520b3235a92ddd1836de60c947444c4e81dc7d0073294'],
];
const decodeWindow = (start, end) => {
  const instructions = new Map();
  for (let pc = start; pc < end;) { const i = decode(rom, pc, mode); assert.ok(i.next <= end); instructions.set(pc, i); pc = i.next; }
  assert.equal([...instructions.values()].at(-1).next, end);
  return instructions;
};
const routines = windows.map(([start, end]) => decodeWindow(start, end));
const all = new Map(routines.flatMap(r => [...r]));
const checkWindow = (source, start, end, digest) => {
  const bytes = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
  assert.deepEqual(source, { entry: cpuLabel(start), end_exclusive: cpuLabel(end), covered_bytes: end - start,
    sha256: digest, machine_bytes: bytes.toString('hex').toUpperCase() });
};

test('Complete81B4 graph pins391 bytes,37 edges and four calls; all transitive searches match prior helpers', () => {
  for (const [i, [start, end, digest]] of windows.entries()) {
    checkWindow(report.routines[i], start, end, digest);
    if (i > 0) assert.deepEqual(report.routines[i], earlier.routines[i]);
  }
  assert.equal(windows.reduce((n, [a, b]) => n + b - a, 0), 391);
  const edges = [...all.values()].filter(i => i.target !== undefined);
  assert.equal(edges.length, 37);
  assert.deepEqual(report.edges, edges.map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
  for (const i of edges) assert.ok(all.has(i.target));
  assert.deepEqual(edges.filter(i => i.mnemonic === 'JSL').map(i => i.target), [0x8186E5, 0x8186E5, 0x8185FE, 0x818686]);
  const prep = [...routines[0].values()];
  assert.equal(rom.subarray(0x1B4, 0x1BF).toString('hex'), '863e5a8bf47e7eabab643b');
  assert.deepEqual(prep.filter(i => i.mnemonic === 'ADC').map(i => i.value), [0x7E43A0, 0x7E42F0, 0x7E4348, 0x7E4240, 0x7E4298]);
  assert.deepEqual(prep.filter(i => i.mnemonic === 'LDA' && i.mode === 'absx').map(i => i.value), [0x0ED8, 0x0E80, 0x0E80, 0x0E28, 0x0E28]);
  assert.deepEqual([...all.values()].filter(i => i.mode === 'longx' && i.mnemonic === 'LDA').map(i => i.value), [0x7FE214, 0x7FE214]);
});

test('Every81B4 graph instruction has covered CFG, balanced local stacks and restored DBR without width/D changes', () => {
  // Abstract stack shapes/control flow only; no register or memory execution.
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
      if (i.mnemonic === 'PLB') assert.equal(stack.pop(), pc === 0x80822C ? 'callerDBR' : '7E');
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

test('81B4 fixes upper second edge1A, searches35 then32 without hit shortcut and preserves29/2F/38', () => {
  const writes = [...all.values()].filter(i => ['STA', 'STX', 'STY', 'STZ'].includes(i.mnemonic));
  assert.ok(writes.every(i => i.mode === 'dp'));
  const locations = [...new Set(writes.map(i => i.value))].sort((a, b) => a - b);
  assert.deepEqual(locations, [0x11, 0x14, 0x17, 0x1A, 0x1D, 0x20, 0x23, 0x26, 0x2C, 0x32, 0x35, 0x3B, 0x3E, 0x68]);
  assert.deepEqual(report.side_effects.scratch_words, locations.map(v => v.toString(16).toUpperCase().padStart(2, '0')));
  assert.ok(locations.every(v => v > 0x0F && v + 1 < 0x6B));
  assert.equal(rom.subarray(0x1DF, 0x1EB).toString('hex'), '7f48437e851a29c0034a852c');
  assert.equal(rom.subarray(0x1F1, 0x204).toString('hex'), '7f40427e851129c0030a0a0aeb8523052c8532');
  assert.equal(rom.subarray(0x20A, 0x22C).toString('hex'), '7f98427e851429c0030a0a0aeb8526052c8535a822e58681a432c435f00422e58681');
  assert.equal(all.get(0x808226).target, 0x80822C);
  assert.deepEqual([...routines[0].values()].filter(i => i.mode === 'rel8').map(i => i.mnemonic), ['BEQ', 'BNE']); // No BCC hit shortcut.
  assert.equal(rom.subarray(0x22C, 0x238).toString('hex'), 'ab7aa63ea53bd00238601860'); // RecomputeCarry after CPY.
  assert.equal(all.get(0x81862E).mnemonic, 'BCC'); assert.equal(all.get(0x8186B6).mnemonic, 'BCC'); // Equal candidate accepted.
  assert.equal(all.get(0x818631).value, 0x68); // Write before metadata/flags rejection, preserved on failure.
  assert.equal(all.get(0x81863D).target, 0x818676); // Zero metadata skips flags.
  assert.equal(all.get(0x81864A).target, 0x818678); // Flags rejection retains68, restores nodeX.
  assert.equal(all.get(0x818673).value, 0x40); // Forced result may reduce a larger prior result.
  assert.equal(all.get(0x8186C6).target, 0x8186DE); // Self skips0CC2 and flags.
  assert.equal(all.get(0x8186C8).value, 0x0CC2);
  assert.equal(all.get(0x8186CB).target, 0x8186DC); // Unequal special slot skips flags.
  assert.deepEqual(report.preparation.source_fields, ['0ED8', '7E:43A0', '0E80', '7E:42F0', '7E:4348', '0E28', '7E:4240', '7E:4298', '1458']);
});

test('81B4 caller selects second-additionCarry0 and pins all keep/step/restore branches with exact writes', () => {
  checkWindow(report.caller_windows[0], 0x80AB8F, 0x80ABC1, '3bbcaf1d63f74c050a8301c0cff38b253d81fd0450c2047c0cf7f4fabb67a394');
  checkWindow(report.caller_windows[1], 0x80ABD8, 0x80ABE6, '1766e223747f2a9de855c9161fa2a7f0d93ab935e1093cc071cd1c34b6064d17');
  const caller = new Map([...decodeWindow(0x80AB8F, 0x80ABC1), ...decodeWindow(0x80ABD8, 0x80ABE6)]);
  assert.equal(caller.get(0x80AB8F).value, 0x0E80); assert.equal(caller.get(0x80AB94).value, 0x0D78);
  assert.equal(caller.get(0x80AB99).mnemonic, 'CLC'); assert.equal(caller.get(0x80AB9A).value, 0x0E80);
  assert.deepEqual([0x80AB9D, 0x80ABA0, 0x80ABA3, 0x80ABA6].map(pc => caller.get(pc).mnemonic), ['STA', 'LDA', 'AND', 'BEQ']); // Carry retained.
  assert.equal(caller.get(0x80ABA3).value, 0x40);
  assert.equal(caller.get(0x80ABA8).mnemonic, 'BCS'); assert.equal(caller.get(0x80ABA8).target, 0x80ABC1);
  assert.equal(caller.get(0x80ABAA).target, 0x8081B4);
  assert.equal(caller.get(0x80ABAD).mnemonic, 'BCS'); assert.equal(caller.get(0x80ABAD).target, 0x80ABE6);
  assert.equal(caller.get(0x80ABAF).value, 5); assert.equal(caller.get(0x80ABB2).target, 0x80ABD8);
  assert.deepEqual([0x80ABB4, 0x80ABB5, 0x80ABB6].map(pc => caller.get(pc).mnemonic), ['ASL', 'ASL', 'ADC']);
  assert.equal(caller.get(0x80ABB6).value, 0x0ED8); assert.equal(caller.get(0x80ABBC).value, 0x0DD0);
  assert.equal(caller.get(0x80ABD8).value, 0x6B); assert.equal(caller.get(0x80ABE0).value, 8);
  assert.deepEqual([...caller.values()].filter(i => ['STA', 'STZ'].includes(i.mnemonic)).map(i => [i.mode, i.value]), [['dp', 0x6B], ['absx', 0x0E80], ['absx', 0x0ED8], ['absx', 0x0DD0], ['absx', 0x0E80], ['absx', 0x1458]]);
  assert.deepEqual(report.caller_edges, [...caller.values()].filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
  const pending = [0x80AB8F], seen = new Set(), exits = new Set();
  while (pending.length) {
    const pc = pending.pop();
    if ([0x80ABC1, 0x80ABE6].includes(pc)) { exits.add(pc); continue; }
    if (seen.has(pc)) continue;
    seen.add(pc); const i = caller.get(pc); assert.ok(i);
    if (i.mnemonic === 'JSR') { assert.equal(i.target, 0x8081B4); pending.push(i.next); }
    else if (i.mnemonic === 'BRA') pending.push(i.target);
    else if (i.mode === 'rel8') pending.push(i.next, i.target);
    else pending.push(i.next);
  }
  assert.equal(seen.size, caller.size); assert.deepEqual([...exits].sort(), [0x80ABC1, 0x80ABE6]);
});
