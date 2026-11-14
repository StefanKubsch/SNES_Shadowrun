import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile('Shadowrun (E).smc');
const report = JSON.parse(await readFile('analysis/render-text-helpers-native.json', 'utf8'));
const regions = [
  [0x81ADBA, 0x81AE14, 44, 6, '6af343efde35add1b2072248f0960584b1b317a0a29c3152a0f0c34cf1d292f3'],
  [0x81AE14, 0x81AE4C, 30, 6, '574468e3e7eb396741e0131d588732f373b22f34d82c99c493bc8abcc30fc4b1'],
  [0x81AE4C, 0x81AE4D, 1, 3, '8254c329a92850f6d539dd376f4816ee2764517da5e0235514af433164480d7a'],
  [0x81AE4D, 0x81AEB0, 43, 7, '28131781e93ac07790fe9aaaf03be61f53e200fa7f3c7c4e7b7b6e411b2d1e01'],
  [0x81AEC8, 0x81AEF4, 23, 3, '2f32d5c67123e6f6bb7c8c737d8c51ba88124c72cc76aad2859ddd1fedfdc942'],
  [0x81AEF4, 0x81AEFC, 3, 6, 'c42b520efec1f8184464ed0eeb2e52e2177da61bfcd85a59fedbe9defa5c8c05'],
  [0x81AEFC, 0x81AF04, 3, 6, 'c292a8b0c6d98285be51ac08dedd41dd3cc280754cf66041133a063c2fd59503'],
  [0x81ACC3, 0x81ACC9, 3, 3, 'ee3afaa5eb1080cd4da298f2311a806c7d1c61cbfdc7a4e138077120f8fb8aaf'],
  [0x81ACC9, 0x81ACCF, 3, 3, '8a827672e30a3f779561aeb41548677c16053a93a394c1975a9f453b5dc39870'],
];
const map = new Map();
for (const [entry, end] of regions) {
  const state = { e: 0, m: 0, x: 0 };
  for (let pc = entry; pc < end;) {
    const i = decode(rom, pc, state); map.set(pc, i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic) && i.value & 32) state.m = Number(i.mnemonic === 'SEP');
  }
}
const at = (pc, op, operand) => {
  const i = map.get(pc); assert.equal(i.mnemonic, op);
  if (operand !== undefined) assert.equal(i.target ?? i.value, operand); return i;
};
test('all318 helperbytes/153instructions and nine closed stackproofs are independently pinned', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.romSha256);
  assert.equal(map.size, 153); assert.equal(report.sources.length, regions.length);
  for (const [j, [entry, end, count, stack, hash]] of regions.entries()) {
    const raw = rom.subarray(cpuToOffset(entry, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash);
    assert.equal(report.sources[j].machine_bytes, raw.toString('hex').toUpperCase());
    assert.equal([...map.keys()].filter(pc => pc >= entry && pc < end).length, count);
    const p = proveWordStack(map, entry, 'RTL', { measureStack: true });
    assert.deepEqual(p, report.stackProofs[j]); assert.equal(p.minimum_protected_stack_bytes, stack);
    assert.equal(p.external_return_assumptions, 0); assert.ok(p.returns.every(r => r.m === 0 && r.x === 0 && r.dbr === 'entry'));
  }
});
test('ADBA and AE14 original width, shiftcarry, fresh reads, PHP/PLP and final PLB are preserved', () => {
  at(0x81ADBA, 'PHB'); at(0x81ADBB, 'PEA', 0x8080); at(0x81ADC9, 'STA', 0x4204);
  assert.equal(at(0x81ADCE, 'LDA', 0x7E2020).state.m, 1); at(0x81ADD4, 'STA', 0x4206);
  at(0x81ADDD, 'LDA', 0x4216); for (let pc = 0x81ADE0; pc <= 0x81ADE2; pc++) at(pc, 'ASL');
  at(0x81ADE3, 'ADC', 0x7E20E0); at(0x81ADE7, 'SEC'); at(0x81ADE8, 'SBC', 0x7E2100);
  at(0x81ADEC, 'BCS', 0x81AE12); at(0x81ADF2, 'PHA'); at(0x81ADF6, 'ADC', 0x7E20E0);
  at(0x81ADFA, 'CMP', 8); at(0x81AE04, 'PLA'); at(0x81AE05, 'PHP');
  for (let pc = 0x81AE06; pc <= 0x81AE08; pc++) at(pc, 'LSR');
  at(0x81AE09, 'PLP'); at(0x81AE0A, 'ADC', 0x7E20C0); at(0x81AE12, 'PLB');
  assert.equal(at(0x81AE26, 'LDA', 0x7E2020).state.m, 0); at(0x81AE2A, 'DEC'); at(0x81AE2B, 'DEC');
  at(0x81AE2C, 'SEP', 32); at(0x81AE2E, 'STA', 0x4206); at(0x81AE31, 'REP', 32);
  at(0x81AE36, 'STA', 0xBD); at(0x81AE39, 'LDA', 0x4216); at(0x81AE3F, 'ADC', 0x7E20E0);
  at(0x81AE43, 'STA', 0xC0); at(0x81AE45, 'SEC'); at(0x81AE46, 'LDA', 0xBD);
  at(0x81AE48, 'SBC', 0xC0); at(0x81AE4A, 'PLB');
});
test('AE4D has distinct fresh BYTEquotient reads, multiplier requests and WORDproduct read before compare/noop', () => {
  at(0x81AE4E, 'PEA', 0x8080); at(0x81AE5C, 'STA', 0x4204); at(0x81AE67, 'STA', 0x4206);
  assert.equal(at(0x81AE71, 'SBC', 4).state.m, 1);
  at(0x81AE73, 'CMP', 0x4214); at(0x81AE76, 'BCS', 0x81AE7D); at(0x81AE78, 'STZ', 0x4202);
  at(0x81AE7D, 'LDA', 0x4214); at(0x81AE80, 'INC'); at(0x81AE81, 'STA', 0x4202);
  at(0x81AE84, 'LDA', 0x7E2020); at(0x81AE8A, 'STA', 0x4203); at(0x81AE8D, 'REP', 32);
  at(0x81AE8F, 'CLC'); at(0x81AE90, 'LDA', 0x7E2060); at(0x81AE94, 'ADC', 0x4216);
  at(0x81AE97, 'STA', 0x7E20C0); at(0x81AEA3, 'PLA'); at(0x81AEA4, 'CMP', 0x7E2080);
  at(0x81AEA8, 'BNE', 0x81AEAE); at(0x81AEAA, 'JSL', 0x81AE4C);
  at(0x81AE4C, 'RTL'); at(0x81AEAE, 'PLB');
});
test('AEC8 original full index/eight-word mask loop and both literal requestwait offsets are pinned', () => {
  at(0x81AEC8, 'LDA', 0xAB); at(0x81AECA, 'LDX', 0xB7); at(0x81AECC, 'BEQ', 0x81AEF0);
  at(0x81AECF, 'ADC', 16); at(0x81AED2, 'STA', 0xAB); at(0x81AED6, 'ASL');
  at(0x81AED8, 'LDA', 0x81AC8D); at(0x81AEDC, 'STA', 0xBA); at(0x81AEDE, 'LDX', 8);
  at(0x81AEE1, 'LDA', 0x2ADE); at(0x81AEE4, 'ORA', 0xBA); at(0x81AEE6, 'STA', 0x2ADE);
  at(0x81AEEC, 'BNE', 0x81AEE1); at(0x81AEEE, 'LDA', 0xAB); at(0x81AEF0, 'STA', 0x210);
  at(0x81AEF4, 'INC', 0x1FA); at(0x81AEF7, 'JSL', 0x81ACC3); at(0x81ACC3, 'LDA', 0x1FA);
  at(0x81ACC6, 'BNE', 0x81ACC3); at(0x81ACC8, 'RTL');
  at(0x81AEFC, 'INC', 0x1FC); at(0x81AEFF, 'JSL', 0x81ACC9); at(0x81ACC9, 'LDA', 0x1FC);
  at(0x81ACCC, 'BNE', 0x81ACC9); at(0x81ACCE, 'RTL');
});
