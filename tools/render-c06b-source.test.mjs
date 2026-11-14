import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-c06b.json', import.meta.url), 'utf8'));
const windows = [
  ['objectC06B', 0x80C06B, 0x80C0F7, 55, 'f4c3a3a2381323c8b8c19479807c7bd14f6096f09abd2ddad686411189554af7'],
  ['callbackCallC17C', 0x80C17C, 0x80C17F, 1, 'a06cca2024d0303d35c063bd0f71552b7c28bdd4c525f4d17d449bcc0a8703e1'],
  ['resetBC1A', 0x80BC1A, 0x80BC36, 10, 'a8d82ddca9827641bee12dd2c9e64b28554ae9d045fd85f94c5f16951c18ffdf'],
  ['coordinatesBC36', 0x80BC36, 0x80BC67, 23, 'cbac1395c8362175673ca5a1133dc7812e0c093dc66fd5c12bae18667aab5fcc'],
  ['selectBC67', 0x80BC67, 0x80BC80, 9, '295a8a1a39dc620be4a7d2b64a9739d575e28a82e287e1c5d99cd15991cb8792'],
  ['selectBC80', 0x80BC80, 0x80BC99, 9, 'c71a03217530cc7d80493e6be3fc5baca8aededcf409adc810aacf38755fd144'],
  ['selectBC99', 0x80BC99, 0x80BCB2, 9, '45faf4a4e607f905866c461b4ec59fe295e450c0a9c78779624691e9204607c4'],
  ['selectedClearBCB2', 0x80BCB2, 0x80BCB5, 1, 'b1ab07b6d50a0f2986d95ef94f84f522464e3a7aab8d2fcd406f6788463e1679'],
  ['gettersC0F7', 0x80C0F7, 0x80C109, 8, 'c207c7e1a970c4138e60640d24a263ae72c6ee722b3f9141465c88323c759719'],
];
const instructions = new Map();
for (const [, lo, hi] of windows) for (let pc = lo; pc < hi;) {
  // Independent incoming modes derived from the literal SEP/REP addresses.
  const m = Number(pc >= 0x80C08C && pc <= 0x80C0A0 || pc >= 0x80C0B0 && pc <= 0x80C0B5
    || pc >= 0x80C0C5 && pc <= 0x80C0CA || pc >= 0x80C0D4 && pc <= 0x80C0F4);
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

test('C06B complete140/55, callback and owner windows have independent literal ROM pins', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  for (const [name, lo, hi, count, hash] of windows) {
    const raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash); assert.equal(range(lo, hi).length, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(lo), end_exclusive: cpuLabel(hi),
      covered_bytes: hi - lo, instruction_count: count, sha256: hash, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(report.code_bytes, 140); assert.equal(report.instruction_count, 55); assert.equal(report.owner_body_bytes, 152);
});
test('C06B fresh WORDgate skips only transfer; exactFFFE/FFFD/default selection has no signed gate', () => {
  assert.equal(at(0x80C06B, 'LDA', 0x1E8).state.m, 0); at(0x80C06E, 'BEQ', undefined, 0x80C0CF);
  at(0x80C070, 'CMP', 0xFFFE); at(0x80C073, 'BEQ', undefined, 0x80C084);
  at(0x80C075, 'CMP', 0xFFFD); at(0x80C078, 'BEQ', undefined, 0x80C07F);
  at(0x80C07A, 'LDA', 0xFBF8); at(0x80C07F, 'LDA', 0xFC78); at(0x80C084, 'LDA', 0xFB78);
  assert.ok(!range(0x80C06B, 0x80C0F7).some(i => ['BMI', 'BPL', 'ADC', 'SBC'].includes(i.mnemonic)));
});
test('C06B eleven transfer stores retain both420B writes and no source reload before lateclear', () => {
  assert.deepEqual(range(0x80C087, 0x80C0CC).filter(i => i.mnemonic === 'STA').map(i => [i.value, i.state.m ? 1 : 2]),
    [[0x4302, 2], [0x4304, 1], [0x4301, 1], [0x2115, 1], [0x4300, 1], [0x2116, 2], [0x4305, 2],
      [0x420B, 1], [0x2116, 2], [0x4305, 2], [0x420B, 1]]);
  at(0x80C0A2, 'LDA', 0); at(0x80C0A8, 'LDA', 0x40); at(0x80C0B7, 'LDA', 0x100); at(0x80C0BD, 'LDA', 0x40);
  assert.equal(at(0x80C0CC, 'STZ', 0x1E8).state.m, 0); assert.match(report.contract.requests, /no4302 reload/);
});
test('Unconditional OAMtail resets WORD2102 then reads BYTE01D5 and WORD01D8 before conditional BYTE01D7', () => {
  assert.equal(at(0x80C0CF, 'STZ', 0x2102).state.m, 0);
  assert.equal(at(0x80C0D4, 'LDA', 0x1D5).state.m, 1);
  assert.equal(at(0x80C0DA, 'LDX', 0x1D8).state.x, 0); at(0x80C0DD, 'BNE', undefined, 0x80C0E6);
  at(0x80C0DF, 'LDA', 0xF0); at(0x80C0E4, 'BRA', undefined, 0x80C0F4);
  assert.equal(at(0x80C0E6, 'LDA', 0x1D7).state.m, 1); at(0x80C0EC, 'STZ', 0x2104); at(0x80C0EF, 'LDA', 0x30);
});
test('BYTE NZ persists through REP and fullWORD A00F0/0030; C from compare and V preserved', () => {
  at(0x80C0F4, 'REP', 0x20); assert.equal(at(0x80C0F6, 'RTS').state.m, 0);
  assert.match(report.contract.returns, /A00F0\/N1\/Z0/); assert.match(report.contract.returns, /A0030\/N0\/Z0/);
  assert.match(report.contract.returns, /REP20 doesnot recomputeNZ/); assert.match(report.contract.returns, /C preserved for gate0/);
  assert.ok(!range(0x80C06B, 0x80C0F7).some(i => ['CLC', 'SEC', 'CLV'].includes(i.mnemonic)));
});
test('Full localC06B and fiveowner graphs close typed WORDRTS without external callee assumptions', () => {
  assert.deepEqual(report.graph.proof, proveWordStack(new Map(range(0x80C06B, 0x80C0F7).map(i => [i.cpu, i])), 0x80C06B, 'RTS'));
  assert.equal(report.graph.proof.reachable_instructions, 55); assert.deepEqual(report.graph.calls, []);
  const map = new Map(range(0x80BC1A, 0x80BCB2).map(i => [i.cpu, i]));
  for (const [index, pc] of [0x80BC1A, 0x80BC36, 0x80BC67, 0x80BC80, 0x80BC99].entries())
    assert.deepEqual(report.owners.proofs[index].proof, proveWordStack(map, pc, 'RTS'));
  assert.equal(report.graph.actual_transfer_completion_proven, false);
});
test('Reset and fullcoordinate owners writeWORD01D4/01D6 and own actual tailBYTEhigh aliases', () => {
  at(0x80BC20, 'LDA', 0x8000); at(0x80BC23, 'STA', 0x1D4); at(0x80BC26, 'STA', 0x1D6);
  at(0x80BC29, 'STZ', 0x1D8); at(0x80BC2C, 'STZ', 0x1E8); at(0x80BCB2, 'STZ', 0x1D8);
  assert.deepEqual(range(0x80BC36, 0x80BC67).map(i => [i.mnemonic, i.value]),
    [['LDY', 0xCC2], ['SEC', 0], ['LDA', 0xC00], ['SBC', 0xF30], ['SBC', 0xED8], ['SBC', 0xCC6], ['SBC', 0x48],
      ['LSR', 0], ['LSR', 0], ['XBA', 0], ['STA', 0x1D6], ['CLC', 0], ['LDA', 0x600], ['ADC', 0xE80], ['SEC', 0],
      ['SBC', 0xE28], ['SBC', 0xCC4], ['SBC', 0x10], ['LSR', 0], ['LSR', 0], ['XBA', 0], ['STA', 0x1D4], ['RTS', 0]]);
  assert.match(report.owners.aliases, /highbytes/);
});
test('Three selectors call fullBC36 before equalWORDgate/object values and retain distinct coordinate constants', () => {
  for (const [pc, gate, first, second] of [[0x80BC67, 0xFFFF, 0x600, 0xC00], [0x80BC80, 0xFFFE, 0x5E4, 0xBE8], [0x80BC99, 0xFFFD, 0x600, 0xC00]]) {
    at(pc, 'JSR', undefined, 0x80BC36); at(pc + 3, 'LDA', first); at(pc + 6, 'STA', 0x1E4);
    at(pc + 9, 'LDA', second); at(pc + 12, 'STA', 0x1E6); at(pc + 15, 'LDA', gate);
    at(pc + 18, 'STA', 0x1E8); at(pc + 21, 'STA', 0x1D8);
  }
});
test('Original three128byte assets are independently pinned, qualification separates actual DMA from ROMdata', () => {
  for (const [index, address, hash] of [[0, 0x8DFB78, '29a071771f3b79a707e97d56fe959fa59c44833c112ce9ab9ecea5ee0359b994'],
    [1, 0x8DFBF8, '4fbc72759076804e73f83018498196829ec78c11e256f58c61e953c1e44ab10e'],
    [2, 0x8DFC78, 'e260101de535696c4d27c4ae65dd05ed5bd57703a296a232ac6e55b3570538d4']]) {
    const raw = rom.subarray(cpuToOffset(address, rom.length), cpuToOffset(address, rom.length) + 128);
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash); assert.equal(report.data_windows[index].machine_bytes, raw.toString('hex').toUpperCase());
  }
  assert.equal(report.data_bytes, 384); assert.match(report.owners.qualification, /contingent on actualincrementing DMA/);
});
test('Two fullWORDgetters require discarded highbyte; callbackmatches prior source and census stays qualified', async () => {
  for (const [pc, address] of [[0x80C0F7, 0x1D5], [0x80C100, 0x1D7]]) {
    assert.equal(at(pc, 'LDA', address).state.m, 0); at(pc + 3, 'AND', 255); assert.equal(at(pc + 6, 'STA', 0).mode, 'dp');
  }
  const prior = JSON.parse(await readFile(new URL('../analysis/render-a9e1.json', import.meta.url), 'utf8'));
  assert.equal(prior.windows.find(w => w.name === 'callbackC152').machine_bytes.slice(0x2A * 2, 0x2D * 2), '206BC0');
  assert.deepEqual(report.owners.raw_patterns.sta01E8, ['80:BC79', '80:BC92', '80:BCAB']);
  assert.match(report.owners.qualification, /not a complete/); assert.deepEqual(report.caller.remaining_after, ['81:B0D1']);
});
