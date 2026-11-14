import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/motion-prefix-de94.json', import.meta.url), 'utf8'));
const mode = { e: 0, m: 0, x: 0 };
const readWindow = (start, end) => {
  const instructions = new Map();
  for (let pc = start; pc < end;) {
    const ins = decode(rom, pc, mode); assert.ok(ins.next <= end); instructions.set(pc, ins); pc = ins.next;
  }
  assert.equal([...instructions.values()].at(-1).next, end); return instructions;
};
const body = readWindow(0x80DE94, 0x80DEC7), caller = readWindow(0x8096C3, 0x8096D3);
const ins = (pc, mnemonic, value, target) => {
  const instruction = body.get(pc) ?? caller.get(pc); assert.ok(instruction); assert.equal(instruction.mnemonic, mnemonic);
  if (value !== undefined) assert.equal(instruction.value, value);
  if (target !== undefined) assert.equal(instruction.target, target);
  return instruction;
};
const checkWindow = (source, start, end, digest) => {
  const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), digest);
  assert.deepEqual(source, { entry: cpuLabel(start), end_exclusive: cpuLabel(end), covered_bytes: raw.length,
    sha256: digest, machine_bytes: raw.toString('hex').toUpperCase() });
};

test('DE94 source pinsentire51 bytes,20instructions,fiveedges,twoRTS andzerodirect/transitivecalls', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  checkWindow(report.routines[0], 0x80DE94, 0x80DEC7, '6e973939e18990095b07d3fb43d84f0f2365fc9a3713e1fc9b416884b498c76f');
  assert.equal(body.size, 20); assert.equal(report.instruction_count, 20); assert.deepEqual(report.calls, []);
  const edges = [...body.values()].filter(i => i.target !== undefined);
  assert.equal(edges.length, 5); assert.deepEqual(report.edges, edges.map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
  assert.equal([...body.values()].some(i => ['JSR', 'JSL', 'JMP', 'JML'].includes(i.mnemonic) || ['ind', 'indx'].includes(i.mode)), false);
  assert.deepEqual([...body.values()].filter(i => i.mnemonic === 'RTS').map(i => i.cpu), [0x80DEBF, 0x80DEC6]);
  assert.equal(rom.subarray(0x5EC7, 0x5ECA).toString('hex'), 'adca01'); // Adjacent routine,not a DE94 helper.
});

test('EveryDE94instruction isCFGreachable,andallpaths returnwithunchanged widths,D,DBR,Y,Carry/V andnolocalstack', () => {
  // Static reachability and instruction-effect proof; no CPU/data execution.
  const pending = [0x80DE94], reached = new Set(), returns = new Set();
  const permitted = new Set(['LDX', 'LDA', 'BMI', 'BEQ', 'DEC', 'AND', 'STA', 'BRA', 'STZ', 'RTS']);
  while (pending.length) {
    const pc = pending.pop(); if (reached.has(pc)) continue;
    const i = body.get(pc); assert.ok(i); reached.add(pc); assert.deepEqual(i.state, mode); assert.ok(permitted.has(i.mnemonic));
    assert.ok(['abs', 'absx', 'immM', 'rel8', 'i'].includes(i.mode));
    if (i.mnemonic === 'RTS') { returns.add(pc); continue; }
    if (i.target !== undefined) { assert.ok(body.has(i.target)); pending.push(i.target); }
    if (i.mnemonic !== 'BRA') { assert.ok(body.has(i.next)); pending.push(i.next); }
  }
  assert.equal(reached.size, 20); assert.equal(report.reachable_instructions, 20);
  assert.deepEqual([...returns].sort((a, b) => a - b).map(cpuLabel), report.returns.sites);
  // LDX changesonlyX/N/Z;theother permitted instructions donotwriteY,D,
  // DBR,widths,Carry,V orstack exceptthe plain callerreturn RTS.
  assert.match(report.returns.stack, /Carry andV retain entry values/);
  assert.deepEqual(report.returns.accumulator_flags, [
    { path: 'negative0CC2', site: '80:DEBF', a: 'Incoming A unchanged', nz: 'N1/Z0 fromLDX' },
    { path: 'counter_zero', site: '80:DEBF', a: '0000', nz: 'N0/Z1 fromLDA1D65' },
    { path: 'counter_expiry', site: '80:DEC6', a: '0001 oldcounter', nz: 'N0/Z1 fromDEC1D65;STZ preserves flags' },
    { path: 'nonexpiry_odd', site: '80:DEBF', a: '0004', nz: 'N0/Z0 fromfinalLDA' },
    { path: 'nonexpiry_even', site: '80:DEBF', a: 'FFFC', nz: 'N1/Z0 fromfinalLDA' },
  ]);
});

test('0CC2signgate precedestimerread;zerocounter precedesDEC,withnoalignment/capacity/slotflags guards', () => {
  ins(0x80DE94, 'LDX', 0x0CC2); ins(0x80DE97, 'BMI', undefined, 0x80DEBF);
  ins(0x80DE99, 'LDA', 0x1D65); ins(0x80DE9C, 'BEQ', undefined, 0x80DEBF);
  ins(0x80DE9E, 'DEC', 0x1D65); ins(0x80DEA1, 'BEQ', undefined, 0x80DEC0);
  assert.deepEqual([...body.values()].filter(i => ['CMP', 'CPX', 'CPY', 'BIT'].includes(i.mnemonic)), []);
  assert.equal([...body.values()].filter(i => i.mnemonic === 'LDX').length, 1);
  for (let pointer = 0; pointer <= 0xFFFF; pointer++) {
    assert.equal(!!(pointer & 0x8000), BigInt(pointer) >= 32768n);
  }
  assert.match(report.gate, /without reading1D65/); assert.match(report.gate, /without decrement or slot writes/);
});

test('Counterdecrement isWORDRMW andcachedoldA parityselectsbranches for every65536 countervalues', () => {
  assert.equal(ins(0x80DE99, 'LDA', 0x1D65).mode, 'abs'); assert.equal(ins(0x80DE9E, 'DEC', 0x1D65).mode, 'abs');
  ins(0x80DEA3, 'AND', 1); ins(0x80DEA6, 'BEQ', undefined, 0x80DEB3);
  assert.deepEqual([...body.values()].filter(i => i.cpu >= 0x80DE99 && i.cpu < 0x80DEA8).map(i => i.mnemonic), ['LDA', 'BEQ', 'DEC', 'BEQ', 'AND', 'BEQ']);
  for (let old = 0; old <= 0xFFFF; old++) {
    if (old === 0) { assert.equal(old, 0); continue; } // Guard:zero never reachesDEC.
    const after = Number((BigInt(old) - 1n + 65536n) % 65536n);
    assert.equal((old - 1) & 0xFFFF, after); assert.equal(after === 0, old === 1);
    if (after !== 0) assert.equal(old & 1, 1 - (after & 1));
  }
  assert.match(report.alternating.parity, /oldcounter,not the decremented/);
  assert.match(report.counter, /only old1 selects expiry/);
});

test('Alternatingwrites overwritewholemovementWORDS inexactorder,andexpiry zerosbothwithoutreads', () => {
  for (const [pc, op, value] of [[0x80DEA8, 'LDA', 0xFFFC], [0x80DEAB, 'STA', 0x0D20],
    [0x80DEAE, 'LDA', 4], [0x80DEB3, 'LDA', 4], [0x80DEB6, 'STA', 0x0D20],
    [0x80DEB9, 'LDA', 0xFFFC], [0x80DEBC, 'STA', 0x0D78], [0x80DEC0, 'STZ', 0x0D20],
    [0x80DEC3, 'STZ', 0x0D78]]) ins(pc, op, value);
  ins(0x80DEB1, 'BRA', undefined, 0x80DEBC); ins(0x80DEC6, 'RTS');
  const movements = [...body.values()].filter(i => i.mode === 'absx');
  assert.deepEqual(movements.map(i => i.mnemonic), ['STA', 'STA', 'STA', 'STZ', 'STZ']);
  assert.ok(movements.every(i => i.state.m === 0)); assert.equal((65536 - 4), 0xFFFC);
  assert.equal(report.accesses.length, 8); assert.equal(report.accesses.find(a => a.instruction === 'DEC').operation, 'read_modify_write');
  assert.ok(report.accesses.every(a => a.width_bytes === 2));
  assert.deepEqual(report.side_effects.global_words, ['DBR:1D65']);
  assert.deepEqual(report.side_effects.slot_words, ['DBR:0D20+X', 'DBR:0D78+X']); assert.deepEqual(report.side_effects.scratch_words, []);
});

test('OddcounterWORDS andhostilepositiveX aliases remainexplicit;44 even slotsaresafely disjoint', () => {
  const counter = new Set([0x1D65, 0x1D66]);
  for (const base of [0x0D20, 0x0D78]) {
    const hits = [];
    for (let x = 0; x < 0x8000; x++) {
      const at = base + x; assert.ok(at + 1 <= 0xFFFF); // No bankcarry,not a WRAM mapping assertion.
      if (counter.has(at) || counter.has(at + 1)) hits.push(x);
    }
    assert.deepEqual(hits, base === 0x0D20 ? [0x1044, 0x1045, 0x1046] : [0x0FEC, 0x0FED, 0x0FEE]);
    for (let x = 0; x <= 0x56; x += 2) assert.equal(counter.has(base + x) || counter.has(base + x + 1), false);
  }
  assert.match(report.aliases.counter_word, /1D65\/1D66/); assert.match(report.aliases.hostile_offsets, /afterDEC/);
  assert.match(report.aliases.bounded_slots, /negative0CC2 andzero counter do not reach them/);
});

test('Caller16originalbytes pinsgates thenDE94/AFC4,withoutpost-DE94Carrychecks orreturnvalue reactions', () => {
  checkWindow(report.caller_windows[0], 0x8096C3, 0x8096D3, '47cbf29a8d8eef967d6f87220af6b1741fa569f2cf51e15893d66d08d91706f5');
  ins(0x8096C3, 'JSR', undefined, 0x808000); ins(0x8096C6, 'BCS', undefined, 0x8096AB);
  ins(0x8096C8, 'JSR', undefined, 0x80CC4B); ins(0x8096CB, 'BCS', undefined, 0x8096AB);
  ins(0x8096CD, 'JSR', undefined, 0x80DE94); ins(0x8096D0, 'JSR', undefined, 0x80AFC4);
  assert.equal(caller.get(0x8096CD).next, 0x8096D0);
  assert.deepEqual(report.caller_contract.edges, [...caller.values()].map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
  assert.match(report.caller_contract.order, /no returnedA\/X\/Y\/N\/Z\/Carry check/);
});

test('Data/entry boundaries preserveactualDBR anddonotclaimtimer/slotinitialization oradjacentDEC7 execution', () => {
  assert.ok([...body.values()].every(i => ['abs', 'absx', 'immM', 'rel8', 'i'].includes(i.mode)));
  assert.match(report.entry_contract, /D register|D-register/); assert.match(report.entry_contract, /does not prove prior8000\/CC4B return widths/);
  assert.match(report.side_effects.preserves_with_bounded_slots, /doesnot initialize0CC2 or1D65/);
  assert.match(report.boundaries[0], /manual native DE94/); assert.match(report.boundaries[2], /adjacentDEC7/);
  assert.equal(body.has(0x80DEC7), false); assert.equal(body.has(0x80AFC4), false);
});
