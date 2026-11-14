import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-8877.json', import.meta.url), 'utf8'));
const specs = [
  ['reset8861', 0x818861, 0x81886A, 3, '23b06e2a40ba42bd691c1d2be9d27ca29612b31408b3950a59fe98d020df05af'],
  ['sharedTail886A', 0x81886A, 0x818877, 6, '53f9ac223d3943104d1a0594b7ddaba4659b31c6629f7c9fb884c7f72c5bc577'],
  ['postWait8877', 0x818877, 0x81891A, 73, 'f6371350805ae6e897bcfebecce03188b222d9dcd66cbebed87d412b4dd5e21b'],
  ['selectedMainCall96AF', 0x8096AF, 0x8096B3, 1, 'a651703edc1802728f296fffacb879b9f590c01a49b0e4f512fd08d2e32e0dce'],
  ['selectedPreloop96A1', 0x8096A1, 0x8096AB, 3, '9c38413862729d123216f6b97460391b3115b5ddfe6e04c3aa0174b060a1a298'],
  ['selectedResetCallA524', 0x80A524, 0x80A528, 1, 'c47c3f3d987a33f0a2f3915dff6a41bbd5af5e58693586961cae5de6fba9a9a4'],
];
const map = new Map();
for (const [, lo, hi] of specs) for (let pc = lo; pc < hi;) {
  const m = Number(pc >= 0x81886C && pc <= 0x818874 || pc >= 0x81888E && pc <= 0x818898
    || pc >= 0x8188BA && pc <= 0x8188CF || pc >= 0x8188F9 && pc <= 0x818914);
  const i = decode(rom, pc, { e: 0, m, x: 0 }); assert.ok(i.next <= hi); map.set(pc, i); pc = i.next;
}
const at = (pc, mnemonic, value, target) => {
  const i = map.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, mnemonic);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target); return i;
};
const range = (lo, hi) => [...map.values()].filter(i => i.cpu >= lo && i.cpu < hi);

test('8877 literal originalROM hashes pin full185/82 source and selected callers', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  for (const [name, lo, hi, count, hash] of specs) {
    const raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash); assert.equal(range(lo, hi).length, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(lo), end_exclusive: cpuLabel(hi),
      covered_bytes: hi - lo, instruction_count: count, sha256: hash, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(report.local_bytes, 185); assert.equal(report.instruction_count, 82);
});
test('Negative and zero precede one-shot, mask2 precedes mask4 without gate rereads', () => {
  at(0x818877, 'LDA', 0x1FDC); at(0x81887A, 'BPL', undefined, 0x818884);
  at(0x81887C, 'AND', 0x7FFC); at(0x81887F, 'STA', 0x1FDC); at(0x818882, 'BRA', undefined, 0x81886A);
  at(0x818884, 'BNE', undefined, 0x818887); at(0x818886, 'RTL');
  at(0x818887, 'BIT', 1); at(0x81888A, 'BEQ', undefined, 0x8188A5);
  at(0x8188A5, 'BIT', 2); at(0x8188A8, 'BEQ', undefined, 0x8188E4); at(0x8188E4, 'BIT', 4);
});
test('One-shot issues BYTE E5/E3 before WORDTRB1 with Z from original memory', () => {
  assert.deepEqual(range(0x81888C, 0x8188A2).map(i => [i.mnemonic, i.value, i.state.m]),
    [['SEP', 32, 0], ['LDA', 0xE5, 1], ['STA', 0x2132, 1], ['LDA', 0xE3, 1], ['STA', 0x2131, 1],
      ['REP', 32, 1], ['LDA', 1, 0], ['TRB', 0x1FDC, 0], ['BRA', 0x77, 0]]);
  at(0x8188A0, 'BRA', undefined, 0x818919); assert.match(report.contract.one_shot, /fresholdWORD/);
});
test('Ramp2 WORDADC40/mask, BYTEtable threeLSRs/conditionalSBC and late fresh compare/TRB', () => {
  at(0x8188AA, 'LDA', 0x1FDE); at(0x8188AD, 'CLC'); at(0x8188AE, 'ADC', 64); at(0x8188B1, 'AND', 511);
  at(0x8188B4, 'STA', 0x1FDE); at(0x8188B7, 'TAX');
  assert.equal(at(0x8188BA, 'LDA', 0xD3D1).state.m, 1); assert.equal(map.get(0x8188BA).mode, 'absx');
  assert.equal(range(0x8188BD, 0x8188C0).filter(i => i.mnemonic === 'LSR').length, 3);
  at(0x8188C0, 'BEQ', undefined, 0x8188C5); at(0x8188C2, 'SEC'); at(0x8188C3, 'SBC', 1);
  at(0x8188C5, 'ORA', 0xE0); at(0x8188C7, 'STA', 0x2132); at(0x8188CC, 'STA', 0x2131);
  at(0x8188D1, 'LDA', 0x1FDE); at(0x8188D4, 'CMP', 0x180);
  at(0x8188D7, 'BNE', undefined, 0x8188DF); at(0x8188D9, 'LDA', 2); at(0x8188DC, 'TRB', 0x1FDC);
});
test('Ramp4 fourLSRs, two separate2132 writes and fresh gate return without flagclear', () => {
  at(0x8188E9, 'LDA', 0x1FDE); at(0x8188EC, 'CLC'); at(0x8188ED, 'ADC', 16); at(0x8188F0, 'AND', 511);
  at(0x8188F3, 'STA', 0x1FDE); at(0x8188F6, 'TAX'); assert.equal(at(0x8188F9, 'LDA', 0xD3D1).state.m, 1);
  assert.equal(range(0x8188FC, 0x818900).filter(i => i.mnemonic === 'LSR').length, 4);
  at(0x818900, 'BEQ', undefined, 0x818905); at(0x818903, 'SBC', 1); at(0x818905, 'ORA', 0x20);
  at(0x818907, 'STA', 0x2132); at(0x81890A, 'LDA', 0xC0); at(0x81890C, 'STA', 0x2132);
  at(0x818911, 'STA', 0x2131); at(0x818916, 'LDA', 0x1FDC); at(0x818919, 'RTL');
  assert.ok(!range(0x8188E1, 0x81891A).some(i => ['TRB', 'CMP'].includes(i.mnemonic)));
});
test('Reset, sharedtail and alternate entries close four WORDRTL proofs without calls', () => {
  at(0x818861, 'STZ', 0x1FDC); at(0x818864, 'LDA', 0x180); at(0x818867, 'STA', 0x1FDE);
  at(0x81886E, 'STA', 0x2132); assert.equal(at(0x818871, 'STZ', 0x2131).state.m, 1);
  at(0x8188A2, 'LDA', 0x1FDC); at(0x8188E1, 'LDA', 0x1FDC);
  const local = new Map(range(0x818861, 0x81891A).map(i => [i.cpu, i]));
  assert.deepEqual([0x818861, 0x818877, 0x8188A2, 0x8188E1].map(pc => proveWordStack(local, pc)), report.graph.proofs);
  assert.equal(report.graph.proofs[1].reachable_instructions, 77); assert.deepEqual(report.graph.calls, []);
  assert.ok(report.graph.proofs.every(p => !p.external_return_assumptions && p.returns.every(r => !r.m && !r.x && r.dbr === 'entry')));
  local.set(0x8188E4, { ...local.get(0x8188E4), state: { e: 0, m: 1, x: 0 } });
  assert.throws(() => proveWordStack(local, 0x818877), /Mode mismatch/);
});
test('Original512BYTEtable is80D3D1, distinct from programbank81; asset equals original bytes', async () => {
  const raw = rom.subarray(cpuToOffset(0x80D3D1, rom.length), cpuToOffset(0x80D5D1, rom.length));
  const asset = JSON.parse(await readFile(new URL('../assets/render-8877-data.json', import.meta.url), 'utf8'));
  assert.equal(asset.format, 'shadowrun-e-render-8877-data-v1'); assert.equal(asset.romSha256, report.rom_sha256);
  assert.deepEqual(asset.sources[0].bytes, [...raw]); assert.equal(asset.sources[0].address, 0x80D3D1);
  assert.equal(report.table.length, 512); assert.equal(report.table.sha256, createHash('sha256').update(raw).digest('hex'));
  assert.notDeepEqual([...raw], [...rom.subarray(cpuToOffset(0x81D3D1, rom.length), cpuToOffset(0x81D5D1, rom.length))]);
  assert.ok(!range(0x818861, 0x81891A).some(i => ['PHB', 'PLB', 'JSL', 'JSR', 'PHA', 'PHP'].includes(i.mnemonic)));
});
test('Owners/callers stay qualified; earlier mainexcerpt unchanged; native8076 delivered; BE6D source delivered', async () => {
  const old = JSON.parse(await readFile(new URL('../analysis/render-input-flow.json', import.meta.url), 'utf8'));
  assert.equal(old.windows.find(w => w.name === 'selectedPostWait8877').machine_bytes, report.windows[2].machine_bytes.slice(0, 42));
  assert.deepEqual(report.owners.raw_patterns.jsl8877, ['80:96AF']); assert.deepEqual(report.owners.raw_patterns.jsl8861, ['80:96A7', '80:A524']);
  assert.match(report.owners.qualification, /not complete writer\/caller census/); assert.match(report.boundaries[1], /Native8076 atomic updateplan/);
});
