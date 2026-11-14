import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-80c4.json', import.meta.url), 'utf8'));
const windows = [
  ['paletteRequest80C4', 0x8180C4, 0x8180F7, 20, 'c2dee31d0f818564457d0cda4708d7ae4eb29bfad2e585604168f6d23ffebc74'],
  ['callbackCallC166', 0x80C166, 0x80C16A, 1, '35eacdffae688eb3f8fbc5bebea17f508aca4df811c779c1cecd3c1281bde179'],
  ['requestReset8000', 0x818000, 0x81801A, 11, '93c2f5b5d2036a2bc4a676205f38c532c8ba71811215bb92df9ec129e205e4cd'],
  ['requestAdvance8076', 0x818076, 0x8180C4, 34, 'c030407784acaf7463b644f50cd08c1f054835a6994ad0f19beeca96c3ca6240'],
  ['selectedSetupBank801A', 0x81801A, 0x818026, 7, '8742710ed2a469d40d80ea9e1ea87ff832b18225b08c94d44408d3ac3e6ece43'],
  ['selectedSetupWriters8035', 0x818035, 0x818073, 30, 'dace69b660b2e5df425a2a7e48762b3654e0e6c1ad207e9ca3e7ce3035a5a27c'],
];
const instructions = new Map();
for (const [, lo, hi] of windows) for (let pc = lo; pc < hi;) {
  // Independent literal mode regions; setup8035's firstREP enters in M1.
  const i = decode(rom, pc, { e: 0, m: Number(pc >= 0x8180DE && pc < 0x8180F0 || pc === 0x818035), x: 0 });
  assert.ok(i.next <= hi); instructions.set(pc, i); pc = i.next;
}
const range = (lo, hi) => [...instructions.values()].filter(i => i.cpu >= lo && i.cpu < hi);
const at = (pc, op, value, target) => {
  const i = instructions.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};

test('80C4 pins the complete local body, caller and separate selected writer windows', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  for (const [name, lo, hi, count, sha256] of windows) {
    const raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), sha256);
    assert.equal(range(lo, hi).length, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(lo), end_exclusive: cpuLabel(hi),
      covered_bytes: hi - lo, instruction_count: count, sha256, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(report.code_bytes, 51); assert.equal(report.caller_bytes, 4);
  assert.equal(report.owner_body_bytes, 104); assert.equal(report.owner_excerpt_bytes, 74);
});

test('80C4 gate goes directly to RTL without requiring later parameters or stores', () => {
  at(0x8180C4, 'LDA', 0x1CDA); at(0x8180C7, 'BEQ', undefined, 0x8180F6); at(0x8180F6, 'RTL');
  assert.equal(at(0x8180C4, 'LDA').state.m, 0);
  assert.deepEqual(report.graph.edges, [{ from: '81:80C7', kind: 'BEQ', to: '81:80F6' }]);
  assert.match(report.gate, /no index\/size\/palette reads/);
});

test('80C4 reads the full index but always the first unindexed size WORD', () => {
  at(0x8180C9, 'STA', 0x4302); at(0x8180CC, 'LDA', 0x1CDC); at(0x8180CF, 'TAX');
  assert.equal(at(0x8180D0, 'LDA', 0x1CCA).mode, 'abs'); at(0x8180D3, 'STA', 0x4305);
  const indexed = at(0x8180DE, 'LDA', 0x1CC6); assert.equal(indexed.mode, 'absx'); assert.equal(indexed.state.m, 1);
  assert.equal(indexed.state.x, 0); assert.match(report.active.indexing, /even for X2/);
  assert.ok(!range(0x8180C4, 0x8180F7).some(i => ['CMP', 'CPX', 'AND'].includes(i.mnemonic)));
});

test('80C4 preserves all six registerstore widths and clears only after420B', () => {
  assert.deepEqual(range(0x8180C4, 0x8180F7).filter(i => i.mnemonic === 'STA').map(i => [i.value, i.state.m]),
    [[0x4302, 0], [0x4305, 0], [0x4300, 0], [0x2121, 1], [0x4304, 1], [0x420B, 1], [0x1CDA, 0]]);
  at(0x8180D6, 'LDA', 0x2200); at(0x8180E4, 'LDA', 0x8B); at(0x8180E9, 'LDA', 1);
  at(0x8180EE, 'REP', 32); at(0x8180F0, 'LDA', 0); at(0x8180F3, 'STA', 0x1CDA);
  assert.match(report.active.requests, /Zero|WORDclear1CDA only after420B/);
});

test('80C4 final WORD zero replaces highA and preserves C/V/Y/DBR/D/I', () => {
  const body = range(0x8180C4, 0x8180F7);
  assert.ok(!body.some(i => /^(PH|PL)|^(CLC|SEC|ADC|SBC|ASL|LSR|CLV|CLI|SEI|TCD|XCE)$/.test(i.mnemonic)));
  assert.equal(at(0x8180F0, 'LDA').state.m, 0);
  assert.ok(!body.some(i => ['LDY', 'TAY', 'INY', 'DEY', 'SEP'].includes(i.mnemonic) && (i.mnemonic !== 'SEP' || i.value !== 32)));
  assert.match(report.active.returns, /A0000\/N0\/Z1/); assert.match(report.active.returns, /I\/C\/V preserved/);
});

test('80C4 and complete owner bodies close their local WORD/DBR/stack graphs without assumptions', () => {
  const map = (lo, hi) => new Map(range(lo, hi).map(i => [i.cpu, i]));
  assert.deepEqual(proveWordStack(map(0x8180C4, 0x8180F7), 0x8180C4), report.graph.proof);
  assert.equal(report.graph.proof.reachable_instructions, 20); assert.equal(report.graph.proof.external_return_assumptions, 0);
  assert.deepEqual(report.graph.calls, []); assert.equal(report.graph.actual_transfer_completion_proven, false);
  for (const [j, lo, hi, count] of [[0, 0x818000, 0x81801A, 11], [1, 0x818076, 0x8180C4, 34]]) {
    assert.deepEqual(proveWordStack(map(lo, hi), lo), report.owners.proofs[j].proof);
    assert.equal(report.owners.proofs[j].proof.reachable_instructions, count);
  }
});

test('8000 clears the request and selected progress fields but leaves size/index/palette unknown', () => {
  at(0x818000, 'LDX', 2); at(0x818003, 'LDA', 0); at(0x818006, 'STA', 0x1CDA);
  at(0x818017, 'BPL', undefined, 0x81800C);
  assert.deepEqual(range(0x818000, 0x81801A).filter(i => i.mnemonic === 'STA').map(i => i.value),
    [0x1CDA, 0x1CBC, 0x1CBE, 0x1CC2, 0x1CD6]);
  assert.match(report.owners.reset, /does not initialize1CDC,1CCA or1CC6/);
});

test('8076 writer handles first slot before second and carries ASL bit15 into requestpointer ADC', () => {
  at(0x818076, 'LDX', 0); at(0x818079, 'LDA', 0x1CBE); at(0x81807C, 'BEQ', undefined, 0x8180C3);
  at(0x81807E, 'CLC'); at(0x81807F, 'ADC', 0x1CC2); at(0x818082, 'BIT', 0x80);
  at(0x81808D, 'LDA', 0x1CC6); at(0x818090, 'BMI', undefined, 0x8180A0);
  at(0x8180A9, 'STA', 0x1CD6); at(0x8180AC, 'ASL'); at(0x8180AD, 'ADC', 0x1CCE);
  at(0x8180B0, 'STA', 0x1CDA); at(0x8180B3, 'TXA'); at(0x8180B4, 'STA', 0x1CDC);
  at(0x8180B7, 'BRA', undefined, 0x8180C3); at(0x8180BE, 'CPX', 4);
  assert.ok(!range(0x818076, 0x8180C4).some(i => i.mnemonic === 'LDA' && i.value === 0x1CDA));
  assert.match(report.owners.advance, /WITHOUTCLC/); assert.match(report.owners.advance, /replace an outstanding request/);
});

test('Selected801A writer source explicitly selects8B and writes shared indexed WORDs, without full loader proof', () => {
  at(0x81801A, 'PHP'); at(0x81801B, 'PHB'); at(0x81801C, 'PEA', 0x8B8B);
  at(0x81801F, 'PLB'); at(0x818020, 'PLB'); at(0x818024, 'SEP', 32);
  assert.deepEqual(range(0x818035, 0x818073).filter(i => i.mnemonic === 'STA').map(i => [i.value, i.mode]),
    [[0xA2, 'dp'], [0x1CC6, 'absx'], [0x1CCA, 'absx'], [0x1CBE, 'absx'], [0x1CD2, 'absx'], [0x1CCE, 'absx'], [0x1CBC, 'abs']]);
  assert.equal(report.owners.proofs.length, 2); assert.match(report.owners.setup_excerpts, /Full801A search/);
  assert.match(report.owners.lifecycle, /not hydrated/);
});

test('80C4 caller and live aliases require actual mapping, bankcarry and protected JSL stackbytes', () => {
  at(0x80C166, 'JSL', undefined, 0x8180C4);
  for (const [x, sum] of [[0, 0x1CC6], [2, 0x1CC8], [0x14, 0x1CDA], [0x263C, 0x4302],
    [0x263F, 0x4305], [0x263A, 0x4300], [0x462, 0x2128], [0xE33A, 0x10000], [0xFFFF, 0x11CC5]]) assert.equal(0x1CC6 + x, sum);
  assert.deepEqual(report.caller.raw_patterns, { jsl80C4: ['80:C166'], sta1CDA: ['81:8006', '81:80B0', '81:80F3'], sta1CDC: ['81:80B4'] });
  assert.equal(report.caller.actual_nmi_dbr, '00, despitePBR81 ofcallee');
  assert.equal(report.caller.remaining_after.length, 7); assert.equal(report.caller.remaining_after[0], '81:A919');
  assert.match(report.caller.qualification, /No indirect/); assert.match(report.aliases.stack, /3 intact returnbytes/);
  assert.deepEqual(report.manufacturer.sections, ['3.5.3', '7.3']);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});
