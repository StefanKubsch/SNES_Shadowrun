import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuLabel, cpuToOffset } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-a9b2.json', import.meta.url), 'utf8'));
const windows = [
  ['renderA9B2', 0x81A9B2, 0x81A9E1, 22, '2f61dd8539c9883340a1444cfab2dca45375271b6761cac3b29df7a263dc9736'],
  ['copy9F49', 0x809F49, 0x809F69, 18, '5af926a50a9c79cf5ae3a099de4a099100aec12214362c4a66dee40578043db0'],
  ['unpack9E9B', 0x809E9B, 0x809F49, 91, 'c0544d0c8c3eec40a8e9bee5cd007a83316bf8f141f0d159c0a192ed1ffe3ea3'],
  ['bits9E65', 0x809E65, 0x809E7E, 15, 'c72d7b290430e738bb89d68f8cf33cdeb60367d827d0627a7caba6f4960daad5'],
  ['overlayAF1F', 0x81AF1F, 0x81B026, 103, '286626c5b2d2faadcdaabdc1569d77a03f8c4ab79b1929a7fbd283257e5c744c'],
  ['callerAD92', 0x81AD92, 0x81AD96, 1, '5620e3f6415eefef26330a7edd034f729122bd56fb44d8ae4b450b4eb6589c06'],
];
// Independently selected byte/index regions, without using analyzer mode propagation.
const instructions = new Map();
for (const [, start, end] of windows) {
  for (let pc = start; pc < end;) {
    const m = (pc >= 0x809EE4 && pc <= 0x809EEB) || (pc >= 0x809F00 && pc <= 0x809F10)
      || (pc >= 0x81AF37 && pc <= 0x81AF3C) || (pc >= 0x81AFB0 && pc <= 0x81AFB5)
      || (pc >= 0x81AFDE && pc <= 0x81AFE3) ? 1 : 0;
    const x = pc >= 0x809F00 && pc <= 0x809F10 ? 1 : 0;
    const i = decode(rom, pc, { e: 0, m, x }); assert.ok(i.next <= end); instructions.set(pc, i); pc = i.next;
  }
}
const at = (pc, op, value, target) => {
  const i = instructions.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};
const range = (start, end) => [...instructions.values()].filter(i => i.cpu >= start && i.cpu < end);

test('A9B2 source pins six independent digests including AF1F, complete windows and separate data', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  for (const [name, start, end, count, sha256] of windows) {
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), sha256); assert.equal(range(start, end).length, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(start), end_exclusive: cpuLabel(end),
      covered_bytes: end - start, instruction_count: count, sha256, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(report.code_bytes, 541); assert.equal(report.caller_bytes, 4);
});

test('A9B2 uses actual copy inputs, paired bank pushes and real AF1F before restoring entry DBR', () => {
  at(0x81A9B2, 'PHB'); at(0x81A9B3, 'LDA', 0x1FE); at(0x81A9B6, 'LDY', 0x1F4); at(0x81A9B9, 'LDX', 0x23A0);
  at(0x81A9BC, 'JSL', undefined, 0x809F49); at(0x81A9C0, 'PEA', 0x7E7E);
  for (const pc of [0x81A9C3, 0x81A9C4, 0x81A9D9, 0x81A9DA, 0x81A9DF]) at(pc, 'PLB');
  at(0x81A9D6, 'PEA', 0x8080); at(0x81A9DB, 'JSL', undefined, 0x81AF1F); at(0x81A9E0, 'RTL');
  at(0x81AD92, 'JSL', undefined, 0x81A9B2);
  assert.deepEqual(range(0x81A9B2, 0x81A9E1).filter(i => i.mnemonic === 'JSL').map(i => i.target), [0x809F49, 0x81AF1F]);
  assert.match(report.render.last, /only after actual compatible return/);
});

test('A9B2 has one CLC outside the descending 928 WORD conversion loop', () => {
  at(0x81A9C5, 'LDX', 0x73E); at(0x81A9C8, 'CLC');
  assert.equal(at(0x81A9C9, 'LDA', 0x23A0).mode, 'absx'); at(0x81A9CC, 'ADC', 0x2017);
  assert.equal(at(0x81A9CF, 'STA', 0x23A0).mode, 'absx'); at(0x81A9D2, 'DEX'); at(0x81A9D3, 'DEX');
  at(0x81A9D4, 'BPL', undefined, 0x81A9C9);
  assert.deepEqual(range(0x81A9C9, 0x81A9D6).map(i => i.mnemonic), ['LDA', 'ADC', 'STA', 'DEX', 'DEX', 'BPL']);
  assert.equal((0x73E / 2) + 1, 928); assert.equal(0x23A0 + 0x73E, 0x2ADE);
  assert.match(report.render.add, /Carry chains between additions/); assert.match(report.render.add, /not checked against0740/);
});

test('9F49 wrapper preserves P and DBR but writes both bytes of source bank WORD', () => {
  at(0x809F49, 'JSR', undefined, 0x809F4D); at(0x809F4C, 'RTL'); at(0x809F4D, 'PHP'); at(0x809F4E, 'PHB');
  at(0x809F4F, 'STA', 0xE1); at(0x809F51, 'STY', 0xE3); at(0x809F53, 'STX', 0xDD); at(0x809F55, 'STX', 0xDF);
  at(0x809F57, 'STZ', 0xEB); at(0x809F59, 'PEA', 0x7E7E); at(0x809F5C, 'PLB'); at(0x809F5D, 'PLB');
  at(0x809F5E, 'LDY', 0); assert.equal(at(0x809F61, 'LDA', 0xE1).mode, 'dily');
  at(0x809F63, 'JSR', undefined, 0x809E9B); at(0x809F66, 'PLB'); at(0x809F67, 'PLP'); at(0x809F68, 'RTS');
  assert.match(report.render.copy, /E4 is a real scratch write/); assert.match(report.copy.setup, /X\/Y are clobbered/);
});

test('9E9B keeps decoded header on stack and starts literal decoding without a zero guard', () => {
  at(0x809E9B, 'STA', 0xDB); at(0x809E9D, 'PHA'); at(0x809E9E, 'INY'); at(0x809E9F, 'INY');
  at(0x809EA0, 'CLC'); at(0x809EA1, 'LDA', 0xE1); at(0x809EA3, 'ADC', 2); at(0x809EA6, 'STA', 0xE5);
  at(0x809EA8, 'LDA', 4); at(0x809EAB, 'STA', 0xE7); at(0x809EAD, 'STZ', 0xE9); at(0x809EAF, 'STZ', 0xEF);
  at(0x809EB1, 'BRA', undefined, 0x809EB8); at(0x809F47, 'PLA'); at(0x809F48, 'RTS');
  assert.ok(range(0x809E9B, 0x809EB3).every(i => !['CMP', 'BEQ', 'BMI'].includes(i.mnemonic)));
  assert.match(report.copy.header, /without zero-length guard/);
});

test('9E65 refills sixteen MSB-first bits and preserves A while exposing Carry', () => {
  at(0x809E65, 'DEC', 0xEF); at(0x809E67, 'BPL', undefined, 0x809E7B);
  at(0x809E69, 'PHA'); at(0x809E6A, 'LDA', 15); at(0x809E6D, 'STA', 0xEF); at(0x809E6F, 'LDY', 0xE5);
  assert.equal(at(0x809E71, 'LDA', 0xE1).mode, 'dily'); at(0x809E73, 'XBA'); at(0x809E74, 'STA', 0xF1);
  at(0x809E76, 'INY'); at(0x809E77, 'INY'); at(0x809E78, 'STY', 0xE5); at(0x809E7A, 'PLA');
  at(0x809E7B, 'ASL', 0xF1); at(0x809E7D, 'RTS');
  assert.match(report.copy.bit, /A preserved, Y only changed on refill/);
});

test('Literal path preserves odd Carry across WORD copies and returns WORD widths on all joins', () => {
  at(0x809EB8, 'LDA', 1); at(0x809EBB, 'JSR', undefined, 0x809E65); at(0x809EBE, 'BCS', undefined, 0x809EC6);
  at(0x809EC0, 'JSR', undefined, 0x809E65); at(0x809EC3, 'ROL'); at(0x809EC4, 'BRA', undefined, 0x809EBB);
  at(0x809ECA, 'STA', 0xEB); at(0x809ECC, 'LSR'); at(0x809ECD, 'STA', 0xED); at(0x809ECF, 'BEQ', undefined, 0x809EE2);
  at(0x809ED1, 'PHP'); at(0x809ED6, 'STA', 0); at(0x809EDD, 'BNE', undefined, 0x809ED2);
  at(0x809EDF, 'PLP'); at(0x809EE0, 'BCC', undefined, 0x809EED); at(0x809EE2, 'SEP', 0x20);
  assert.equal(at(0x809EE7, 'STA', 0).state.m, 1); at(0x809EEB, 'REP', 0x20);
  at(0x809EF3, 'CLC'); at(0x809EF4, 'ADC', 0xE9); at(0x809EF8, 'CMP', 0xDB);
  at(0x809EFA, 'BCC', undefined, 0x809EFE); at(0x809EFC, 'BRA', undefined, 0x809F47);
  assert.match(report.copy.literal, /Length0 also reaches oneBYTE write/);
});

test('Reference widths use high-byte alias and pinned table; zero width has no guard', () => {
  const raw = rom.subarray(0x2033, 0x2133);
  assert.equal(createHash('sha256').update(raw).digest('hex'), '14a5d850c255623f9472e3c650abce0c78d32f0276b315b3a276a0462d97a1ac');
  assert.deepEqual(report.table, { name: 'bitLengths', entry: '80:A033', end_exclusive: '80:A133', covered_bytes: 256,
    sha256: '14a5d850c255623f9472e3c650abce0c78d32f0276b315b3a276a0462d97a1ac', machine_bytes: raw.toString('hex').toUpperCase() });
  for (let n = 0; n < 256; n++) assert.equal(raw[n], n.toString(2).replace(/^0$/, '').length);
  at(0x809EFE, 'SEP', 0x30); at(0x809F00, 'LDA', 8); at(0x809F02, 'LDX', 0xEA);
  at(0x809F04, 'BNE', undefined, 0x809F0A); at(0x809F06, 'LDA', 0); at(0x809F08, 'LDX', 0xE9);
  assert.equal(at(0x809F0B, 'ADC', 0x80A033).mode, 'longx'); at(0x809F10, 'REP', 0x30);
  at(0x809F15, 'JSR', undefined, 0x809E65); at(0x809F18, 'ROL'); at(0x809F19, 'DEX'); at(0x809F1A, 'BNE', undefined, 0x809F15);
  assert.match(report.copy.reference, /no zero guard/);
});

test('Reference copy uses forward overlapping MVN and counts the extra byte with SEC', () => {
  at(0x809F1C, 'CLC'); at(0x809F1D, 'ADC', 0xDD); at(0x809F1F, 'TAX'); at(0x809F20, 'LDA', 1);
  at(0x809F2F, 'INC'); at(0x809F30, 'STA', 0xEB); at(0x809F32, 'LDY', 0xDF);
  assert.equal(at(0x809F34, 'MVN').raw.toString('hex'), '547e7e'); at(0x809F37, 'STY', 0xDF);
  at(0x809F39, 'SEC'); at(0x809F3A, 'LDA', 0xEB); at(0x809F3C, 'ADC', 0xE9); at(0x809F3E, 'STA', 0xE9);
  at(0x809F42, 'BCS', undefined, 0x809F47); at(0x809F44, 'JMP', undefined, 0x809EB3);
  at(0x809EB3, 'JSR', undefined, 0x809E65); at(0x809EB6, 'BCS', undefined, 0x809EFE);
  assert.match(report.copy.reference, /EB\+1 bytes forward, allowing overlap/);
});

test('Static source closes A9B2 including AF1F with no external return assumptions but explicit memory limits', () => {
  const roots = [['80:9E65', 15, '80:9E7D', 0], ['80:9E9B', 106, '80:9F48', 0],
    ['80:9F49', 124, '80:9F4C', 0], ['81:A9B2', 249, '81:A9E0', 0]];
  for (const [entry, count, ret, externals] of roots) {
    const p = report.structural_proofs.find(p => p.entry === entry); assert.equal(p.reachable_instructions, count);
    assert.equal(p.external_return_assumptions, externals);
    assert.ok(p.returns.every(r => r.at === ret && r.m === 0 && r.x === 0));
    if (entry !== '80:9E9B') assert.ok(p.returns.every(r => r.dbr === 'entry'));
    assert.match(p.qualification, /no input termination, stack-alias, interrupt or hardware interference proof/);
  }
  for (const g of report.local_graphs) {
    const [, start, end] = windows.find(w => w[0] === g.name);
    assert.deepEqual(g.edges, range(start, end).filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
  }
  assert.equal(report.transitive_return_proven, false); assert.match(report.entry, /binary arithmetic/);
  assert.equal(report.local_call_graph_closed, true);
  assert.deepEqual(report.structural_proofs.find(p => p.entry === '81:AF1F').returns.map(r => r.at).sort(), ['81:AF24', '81:B025']);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json'); assert.match(report.boundaries[1], /No nativeA5\/97/);
});
