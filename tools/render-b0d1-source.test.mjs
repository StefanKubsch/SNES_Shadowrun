import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-b0d1.json', import.meta.url), 'utf8'));
const windows = [
  ['fadeB0D1', 0x81B0D1, 0x81B11A, 33, '811110aca0601f2335cdf40a7e876bf3e56020e25f205a9cfc675ff8dbf757af'],
  ['callbackCallC17F', 0x80C17F, 0x80C183, 1, 'e10f247e200eb666dce91a7a42b6ed8f663d7f7122e2248f072c8658070461b5'],
  ['setB0AC', 0x81B0AC, 0x81B0BD, 8, '9385011b40eea624aee558c702f288c55886edda102d5dce02417a2751fafeb9'],
  ['resetB0BD', 0x81B0BD, 0x81B0C7, 4, 'f680b037769671488b57ebcdae1079bd2e7eb31d2f7e37e174125ff96b238fa7'],
  ['resetB0C7', 0x81B0C7, 0x81B0D1, 4, '7651b442dbc4b9d0236e3139438c6386227ed716d966fc26af978b50efc52706'],
  ['selectedSetupB08B', 0x81B08B, 0x81B0A1, 8, '8dd35c1b7dd1ced0121a1233bb8a65738d289758fb0925fd1844be2b1711459c'],
  ['callbackTailC183', 0x80C183, 0x80C1A6, 13, '6ff5d2fbfabb3c459751c8826f9c1cfd1220b1331385c4a698aa1b5dbb5c1a9c'],
];
const instructions = new Map();
for (const [, lo, hi] of windows) for (let pc = lo; pc < hi;) {
  const m = Number(pc >= 0x81B0E9 && pc <= 0x81B0F7 || pc >= 0x81B0FF && pc <= 0x81B111
    || pc === 0x81B114 || pc >= 0x80C185 && pc <= 0x80C1A3);
  const i = decode(rom, pc, { e: 0, m, x: 0 }); assert.ok(i.next <= hi);
  instructions.set(pc, i); pc = i.next;
}
const range = (lo, hi) => [...instructions.values()].filter(i => i.cpu >= lo && i.cpu < hi);
const at = (pc, op, value, target) => {
  const i = instructions.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};
test('B0D1 complete73/33, callback, owners and selected setup have independent literal ROM pins', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  for (const [name, lo, hi, count, hash] of windows) {
    const raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash); assert.equal(range(lo, hi).length, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(lo), end_exclusive: cpuLabel(hi),
      covered_bytes: hi - lo, instruction_count: count, sha256: hash, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(report.code_bytes, 73); assert.equal(report.instruction_count, 33); assert.equal(report.owner_body_bytes, 37);
});
test('Fresh WORDgate, WORDDECmemory and nonzero earlyreturn precede fresh signreload', () => {
  at(0x81B0D1, 'LDA', 0x1C6); at(0x81B0D4, 'BEQ', undefined, 0x81B0F9);
  assert.equal(at(0x81B0D6, 'DEC', 0x1C8).state.m, 0); at(0x81B0D9, 'BNE', undefined, 0x81B0F9);
  at(0x81B0DB, 'LDA', 0x1C6); at(0x81B0DE, 'BPL', undefined, 0x81B0FA);
  assert.match(report.contract.early, /N\/Z from DECmemory, notA/); assert.match(report.contract.early, /initialcount0 becomesFFFF/);
});
test('Negative reload performs WORDnegation before countstore;8000 remains valid', () => {
  at(0x81B0E0, 'EOR', 0xFFFF); at(0x81B0E3, 'INC'); assert.equal(instructions.get(0x81B0E3).mode, 'A');
  assert.equal(at(0x81B0E4, 'STA', 0x1C8).state.m, 0); at(0x81B0FA, 'STA', 0x1C8);
  assert.match(report.contract.expire, /retaining8000/); assert.match(report.contract.expire, /before freshBYTE01BC/);
});
test('Negative BYTEnibble0 stops, othernibbles use fresh fullBYTEDEC withoutAND7F', () => {
  assert.equal(at(0x81B0E9, 'LDA', 0x1BC).state.m, 1); at(0x81B0EC, 'AND', 15);
  at(0x81B0EE, 'BEQ', undefined, 0x81B114); at(0x81B0F0, 'LDA', 0x1BC); at(0x81B0F3, 'DEC');
  assert.equal(at(0x81B0F4, 'STA', 0x1BC).state.m, 1);
  assert.ok(!range(0x81B0F0, 0x81B0FA).some(i => i.mnemonic === 'AND'));
});
test('Positive endpoint uses CMP0F flags, otherwise freshBYTEINC/AND7F beforestore', () => {
  at(0x81B0FF, 'LDA', 0x1BC); at(0x81B102, 'AND', 15); at(0x81B104, 'CMP', 15);
  at(0x81B106, 'BEQ', undefined, 0x81B114); at(0x81B108, 'LDA', 0x1BC); at(0x81B10B, 'INC');
  at(0x81B10C, 'AND', 127); assert.equal(at(0x81B10E, 'STA', 0x1BC).state.m, 1);
  assert.match(report.contract.positive, /Z1 fromCMP \(notA\)/);
});
test('Both stoppingBEQs reach BYTEentryB114 then WORDSTZ and exact three WORDRTLs', () => {
  assert.equal(at(0x81B114, 'REP', 32).state.m, 1); assert.equal(at(0x81B116, 'STZ', 0x1C6).state.m, 0);
  const map = new Map(range(0x81B0D1, 0x81B11A).map(i => [i.cpu, i]));
  assert.deepEqual(proveWordStack(map, 0x81B0D1), report.graph.proof); assert.equal(report.graph.proof.reachable_instructions, 33);
  assert.deepEqual(report.graph.proof.returns.map(r => r.at).sort(), ['81:B0F9', '81:B113', '81:B119']);
  map.set(0x81B114, { ...map.get(0x81B114), state: { e: 0, m: 0, x: 0 } });
  assert.throws(() => proveWordStack(map, 0x81B0D1), /Mode mismatch/);
});
test('B0D1 has no calls/registerwrites or C/V changes beyond positiveCMP; highA survivesBYTEtail', () => {
  assert.deepEqual(report.graph.calls, []);
  const body = range(0x81B0D1, 0x81B11A);
  assert.ok(!body.some(i => ['JSR', 'JSL', 'ADC', 'SBC', 'CLC', 'SEC', 'CLV', 'PLP', 'PHA'].includes(i.mnemonic)));
  assert.ok(body.filter(i => ['STA', 'STZ', 'DEC'].includes(i.mnemonic) && i.mode === 'abs').every(i => i.value < 0x2000));
  assert.match(report.contract.highA, /A8000\/Z1\/N0/); assert.match(report.contract.highA, /REP20 and STZ do not recomputeNZ/);
});
test('Three fullowners close WORDRTL, entryN controls B0AC and resetpaths retain countdown', async () => {
  for (const [j, pc, hi] of [[0, 0x81B0AC, 0x81B0BD], [1, 0x81B0BD, 0x81B0C7], [2, 0x81B0C7, 0x81B0D1]])
    assert.deepEqual(report.owners.proofs[j].proof, proveWordStack(new Map(range(pc, hi).map(i => [i.cpu, i])), pc));
  at(0x81B0AC, 'STA', 0x1C6); at(0x81B0AF, 'BPL', undefined, 0x81B0B5); at(0x81B0B5, 'CLC'); at(0x81B0B6, 'ADC', 8);
  for (const [lo, hi] of [[0x81B0BD, 0x81B0C7], [0x81B0C7, 0x81B0D1], [0x81B08B, 0x81B0A1]]) assert.ok(!range(lo, hi).some(i => i.value === 0x1C8));
  const old = JSON.parse(await readFile(new URL('../analysis/motion-transition-a4bf.json', import.meta.url), 'utf8'));
  assert.equal(old.windows.find(w => w.name === 'timeSet').machine_bytes, report.windows[2].machine_bytes);
  assert.equal(old.windows.find(w => w.name === 'timeReset').machine_bytes, report.windows[3].machine_bytes);
  assert.match(report.owners.set, /incomingN/);
});
test('Callbacktail has five interleaved freshBYTEreads/writes and matches previous source exactly', async () => {
  assert.deepEqual(range(0x80C185, 0x80C1A3).map(i => [i.mnemonic, i.value, i.state.m]),
    [['LDA', 0x1BC, 1], ['STA', 0x2100, 1], ['LDA', 0x1BE, 1], ['STA', 0x212C, 1], ['LDA', 0x1C0, 1], ['STA', 0x212D, 1],
      ['LDA', 0x1C2, 1], ['STA', 0x212E, 1], ['LDA', 0x1C4, 1], ['STA', 0x420C, 1]]);
  const old = JSON.parse(await readFile(new URL('../analysis/render-a9e1.json', import.meta.url), 'utf8'));
  assert.equal(old.windows.find(w => w.name === 'callbackC152').machine_bytes.slice(0x2D * 2), report.windows[1].machine_bytes + report.windows[6].machine_bytes);
});
test('All individual callbackcallees supplied; rawwriterpatterns and actual clock/lifecycle remain qualified', () => {
  assert.deepEqual(report.caller.remaining_after, []); assert.deepEqual(report.owners.raw_patterns.jslB0D1, ['80:C17F']);
  assert.deepEqual(report.owners.raw_patterns.stz01C8, ['87:968A']); assert.match(report.owners.qualification, /not a new proved owner/);
  assert.match(report.boundaries[1], /All eleven callbackcallees/); assert.match(report.boundaries[1], /automatic scene\/frame binding remain open/);
});
