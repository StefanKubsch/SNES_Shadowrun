import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-a6a5.json', import.meta.url)));
const address = s => parseInt(s.replace(':', ''), 16);
const windows = [
  [0x80A6A5, 0x80A835, 170, '9f52312c885d7f40174fcaacf6e20f64b40adf49d94ef7d3c5db2fbb24854da9'],
  [0x80A5DB, 0x80A5F9, 15, '6d0fefa7549eda117411b58c9427a82b741528159b10214d54719b90ce71ffc2'],
  [0x80A5F9, 0x80A617, 15, '9ed6402468e35d4dac2c58ca021914c02c6a16ea7a12a47e8a6766f91669a95b'],
  [0x80A617, 0x80A6A5, 67, 'edfc6c7e3157c3fd23b3ee975219d37cdc27a15681af074ac9e3321faff3e34d'],
  [0x80FAAC, 0x80FADD, 22, 'ff9165edcb4ced8bea740aeaaa98e8d3fd225a5f1c23e5568311023a9c84c3a8'],
  [0x80FD80, 0x80FDCF, 38, '051470ef6ea2ab6f4f2a648e0478b05c14bcf91dfec8cbb72380062c687c9778'],
  [0x809B5B, 0x809B80, 15, '98d4dc2f2d40025960b1dc1ad38ec6254f8c2f21083e7ff4dad76e01089fd8fa'],
  [0x80C46E, 0x80C4B3, 28, 'ce0aef528b83978bd42e83f7eca36565f48f0ee212846c2f42fd109ff3cc2e92'],
];
// Independently declared incoming BYTE regions, rather than the analyzer's
// linear REP/SEP state. FD80 division widths differ from geometry widths.
const byteRegions = [[0x80FAB6, 0x80FAC6], [0x80FD91, 0x80FDA7], [0x80FDBC, 0x80FDCA],
  [0x80FE84, 0x80FE89], [0x80FEA1, 0x80FEBC], [0x80FB95, 0x80FBC6],
  [0x80FC38, 0x80FC5C], [0x80FC5F, 0x80FC79], [0x80FC96, 0x80FCEE],
  [0x80FD15, 0x80FD37], [0x80FD56, 0x80FD5B], [0x81ADCE, 0x81ADD9],
  [0x81AE2E, 0x81AE33], [0x81AE61, 0x81AE8F]];
const map = new Map();
for (const [lo, hi] of [...windows, ...report.dependencies[0].windows.map(w => [address(w.entry), address(w.end_exclusive)])]) {
  for (let pc = lo; pc < hi;) {
    const i = decode(rom, pc, { e: 0, m: Number(byteRegions.some(([a, b]) => pc >= a && pc < b)), x: 0 });
    assert.ok(i.next <= hi); assert.ok(!map.has(pc)); map.set(pc, i); pc = i.next;
  }
}
const at = (pc, op, value) => {
  const i = map.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op, cpuLabel(pc));
  if (value !== undefined) assert.equal(i.target ?? i.value, value, cpuLabel(pc)); return i;
};
test('A6A5 pins eight complete local windows and original selected sound WORD independently', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  assert.equal(report.windows.length, windows.length);
  for (const [lo, hi, count, hash] of windows) {
    const w = report.windows.find(w => w.entry === cpuLabel(lo));
    const raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    assert.equal(w.end_exclusive, cpuLabel(hi)); assert.equal(w.covered_bytes, hi - lo);
    assert.equal(w.instruction_count, count); assert.equal(w.sha256, hash);
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash);
    assert.equal(w.machine_bytes, raw.toString('hex').toUpperCase());
    assert.equal([...map.keys()].filter(pc => pc >= lo && pc < hi).length, count);
  }
  const raw = rom.subarray(cpuToOffset(0x80C4FF, rom.length), cpuToOffset(0x80C501, rom.length));
  assert.equal(raw.toString('hex'), '2d00'); assert.equal(report.tables[0].machine_bytes, '2D00');
  assert.equal(report.tables[0].sha256, '24ea1ebd0bafd39482db46ec2d8959e61353a90efc072719e1308f86c3a106ba');
  assert.equal(createHash('sha256').update(raw).digest('hex'), report.tables[0].sha256);
});
test('five helper graphs close WORD and entryDBR with real PHY frames and no external returns', async () => {
  const graph = new Map([...map].filter(([pc]) => windows.slice(1, 6).some(([lo, hi]) => pc >= lo && pc < hi)
    || report.dependencies[0].windows.some(w => pc >= address(w.entry) && pc < address(w.end_exclusive))));
  assert.equal(graph.size, 649); assert.equal(report.helper_graph.code_bytes, 1346);
  const entries = [0x80A617, 0x80A5DB, 0x80A5F9, 0x80FAAC, 0x80FD80], stacks = [16, 14, 14, 5, 12];
  for (const [n, entry] of entries.entries()) {
    const p = proveWordStack(graph, entry, 'RTS', { measureStack: true, widthJoins: new Set([0x80FC36]) });
    assert.deepEqual(p, report.helper_graph.proofs[n]); assert.equal(p.minimum_protected_stack_bytes, stacks[n]);
    assert.equal(p.external_return_assumptions, 0);
    assert.ok(p.returns.every(v => v.m === 0 && v.x === 0 && v.dbr === 'entry'));
  }
  const broken = new Map(graph); broken.set(0x80A63C, { ...graph.get(0x80A63C), mnemonic: 'NOP' });
  assert.throws(() => proveWordStack(broken, 0x80A617, 'RTS', { widthJoins: new Set([0x80FC36]) }), /Stack mismatch/);
  const old = JSON.parse(await readFile(new URL('../analysis/render-be6d.json', import.meta.url)));
  for (const w of report.dependencies[0].windows) {
    assert.ok(old.windows.some(v => JSON.stringify(v) === JSON.stringify(w)));
    const raw = rom.subarray(cpuToOffset(address(w.entry), rom.length), cpuToOffset(address(w.end_exclusive), rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), w.sha256);
    assert.equal(raw.toString('hex').toUpperCase(), w.machine_bytes);
  }
  assert.equal(report.helper_graph.native_binding, true);
  assert.deepEqual(report.helper_graph.native_entries, ['80:FAAC', '80:FD80', '80:A617', '80:A5DB', '80:A5F9']);
});
test('four menu roots retain actual prefix stores and full caller list/pointer parameters', () => {
  assert.deepEqual(report.menu.roots, ['80:A6A5', '80:A6AD', '80:A6B8', '80:A6C7']);
  assert.equal(report.menu.reachable_local_instructions, 170);
  at(0x80A6A8, 'STA', 0x1DA7); at(0x80A6AB, 'BRA', 0x80A6CA);
  at(0x80A6B0, 'STA', 0x1DA5); at(0x80A6B6, 'BRA', 0x80A6CD);
  at(0x80A6B8, 'ASL'); at(0x80A6B9, 'STA', 0x1D97); at(0x80A6C5, 'BRA', 0x80A6D0);
  at(0x80A6C7, 'STZ', 0x1DA7); at(0x80A6CA, 'STZ', 0x1DA5); at(0x80A6CD, 'STZ', 0x1D97);
  at(0x809B69, 'LDA', 8); at(0x809B6E, 'LDA', 0x1F6A); at(0x809B73, 'LDA', 0x7E);
  at(0x809B78, 'LDA', 0x1F82); at(0x809B7D, 'JSR', 0x80A6A5);
});
test('repeat is exact20 and fresh held read; cancellation wins over confirmation and down over up', () => {
  at(0x80A6E9, 'JSL', 0x81B0A1); at(0x80A6ED, 'JSR', 0x809E1A);
  at(0x80A6F0, 'LDA', 0x1CE); at(0x80A6F6, 'LDA', 0x1CA); at(0x80A6F9, 'AND', 0xC00);
  at(0x80A704, 'CMP', 20); at(0x80A707, 'BNE', 0x80A71A); at(0x80A709, 'LDA', 19);
  at(0x80A70F, 'LDA', 0x1CA); at(0x80A717, 'STZ', 0x1DA1);
  at(0x80A71D, 'BIT', 0x2000); at(0x80A722, 'JMP', 0x80A826); at(0x80A725, 'BIT', 0xD0C0);
  at(0x80A730, 'BIT', 0x400); at(0x80A740, 'BIT', 0x800);
});
test('page calculation shares Carry across two ADC or SBC and preserves source do-loop', () => {
  at(0x80A760, 'SEC'); at(0x80A761, 'SBC', 6); at(0x80A763, 'SBC', 6);
  at(0x80A76D, 'LDX', 6); at(0x80A772, 'INY'); at(0x80A774, 'LDA', 8);
  at(0x80A778, 'DEX'); at(0x80A779, 'BNE', 0x80A772);
  at(0x80A7E0, 'CLC'); at(0x80A7E1, 'ADC', 6); at(0x80A7E3, 'ADC', 6);
  at(0x80A7EA, 'SEC'); at(0x80A7EB, 'SBC', 6); at(0x80A7ED, 'SBC', 6); at(0x80A7EF, 'BCS', 0x80A7F4);
  at(0x80A7F7, 'JSR', 0x80FA67); at(0x80A7FA, 'JSR', 0x80A617); at(0x80A7FD, 'BRA', 0x80A791);
});
test('navigation4A has no audio call; confirmation4C calls audio and hotkey uses PHY then PLA', () => {
  at(0x80A798, 'PEI', 0); at(0x80A79A, 'PEI', 6); at(0x80A7AB, 'LDA', 0x4A);
  at(0x80A7B0, 'PLA'); at(0x80A7B1, 'STA', 6); at(0x80A7B3, 'PLA'); at(0x80A7B4, 'STA', 0);
  assert.ok(![...map.values()].some(i => i.cpu >= 0x80A798 && i.cpu < 0x80A7B6 && ['JSR', 'JSL'].includes(i.mnemonic)));
  at(0x80A7C2, 'LDA', 12); at(0x80A7C4, 'AND', 0x1CE); at(0x80A7CD, 'PHY'); at(0x80A7D4, 'PLA');
  at(0x80A814, 'LDA', 0x4C); at(0x80A819, 'JSR', 0x80C46E);
  at(0x80A820, 'STA', 0); at(0x80A82C, 'LDA', 65535); at(0x80A82F, 'STA', 0);
});
test('list emits cursor before token gate, saves Y around callees and freshly rereads number', () => {
  at(0x80A633, 'JSR', 0x80FAAC); at(0x80A636, 'LDA', 8); at(0x80A638, 'BEQ', 0x80A687);
  assert.equal(map.get(0x80A636).mode, 'dily');
  for (const [save, call, restore, target] of [[0x80A63C, 0x80A63D, 0x80A640, 0x80FE69],
    [0x80A64F, 0x80A650, 0x80A653, 0x80FE69], [0x80A658, 0x80A659, 0x80A65C, 0x80FD80]]) {
    at(save, 'PHY'); at(call, 'JSR', target); at(restore, 'PLY');
  }
  at(0x80A646, 'LDA', 12); at(0x80A654, 'LDA', 12);
  at(0x80A65F, 'DEC', 0x1D9F); at(0x80A662, 'BNE', 0x80A625);
  at(0x80A67F, 'LDA', 0x707A); at(0x80A69C, 'LDA', 0x7077);
  at(0x80A5F0, 'LDA', 0x707D); at(0x80A60E, 'LDA', 0x7074);
});
test('FAAC fixes local MMIO bank, BYTE operands and chained WORD additions; FD80 has reversed result widths', () => {
  at(0x80FAAC, 'PHB'); at(0x80FAAD, 'PEA', 0x8080); at(0x80FAB0, 'PLB'); at(0x80FAB1, 'PLB');
  assert.equal(at(0x80FAB6, 'LDA', 4).state.m, 1);
  assert.equal(at(0x80FABB, 'LDA', 0x7E2020).state.m, 1);
  at(0x80FAC6, 'CLC'); at(0x80FACB, 'ADC', 2); assert.equal(at(0x80FACD, 'ADC', 0x4216).state.m, 0);
  at(0x80FAD0, 'STA', 0x7E20C0); at(0x80FAD7, 'STA', 0x7E20E0); at(0x80FADB, 'PLB');
  assert.equal(at(0x80FD8C, 'STA', 0x4204).state.m, 0);
  assert.equal(at(0x80FD9E, 'ADC', 0x4216).state.m, 1);
  assert.equal(at(0x80FDA7, 'LDA', 0x4214).state.m, 0);
  at(0x80FDAA, 'BNE', 0x80FD8C); at(0x80FDB5, 'BEQ', 0x80FDCA);
  at(0x80FDC2, 'BEQ', 0x80FDC8); at(0x80FDCA, 'JSR', 0x80FB39);
});
test('unconditional reset/menu graph remains open; generic PEI/PHK proof cannot silently claim conditional closure', () => {
  assert.equal(report.menu.full_graph_closed, false); assert.equal(report.menu.minimum_protected_stack_bytes, null);
  assert.throws(() => proveWordStack(map, 0x80A798, 'RTS'), /Unproved stack operation 80:A798/);
  assert.throws(() => proveWordStack(map, 0x80C46E, 'RTS'), /Unproved stack operation 80:C46E/);
  at(0x80C46E, 'PHK'); at(0x80C46F, 'PLB'); at(0x80C475, 'PHA');
  at(0x80C495, 'BEQ', 0x80C4B2); at(0x80C4A6, 'PLA'); at(0x80C4B2, 'RTS');
  assert.deepEqual(report.menu.calls.map(c => c.to).filter((v, n, a) => a.indexOf(v) === n),
    ['80:A617', '80:A5F9', '81:B0A1', '80:9E1A', '80:A5DB', '80:FA67', '80:C46E']);
});
test('FD80 division uses entryDBR before local7E, retains BYTE ADC highA and has no digit bound', () => {
  at(0x80FD80, 'LDA', 0); at(0x80FD83, 'STA', 0x7E21A5); at(0x80FD87, 'LDX', 5);
  at(0x80FD8A, 'LDA', 2); at(0x80FD8C, 'STA', 0x4204); at(0x80FD8F, 'SEP', 32);
  at(0x80FD91, 'LDA', 10); at(0x80FD93, 'STA', 0x4206);
  for (const pc of [0x80FD96, 0x80FD97, 0x80FD98, 0x80FD99]) at(pc, 'NOP');
  at(0x80FD9A, 'DEX'); at(0x80FD9B, 'CLC'); at(0x80FD9C, 'LDA', 48);
  at(0x80FD9E, 'ADC', 0x4216); at(0x80FDA1, 'STA', 0x7E21A0); at(0x80FDA5, 'REP', 32);
  at(0x80FDA7, 'LDA', 0x4214); at(0x80FDAA, 'BNE', 0x80FD8C);
  assert.ok(![...map].filter(([pc]) => pc >= 0x80FD80 && pc < 0x80FDAC)
    .some(([, i]) => ['PHB', 'PLB', 'CPX', 'CMP', 'XBA'].includes(i.mnemonic)));
});
test('FD80 copy is original fresh forward null-inclusive BYTE loop with separate wrapping indices', () => {
  at(0x80FDAC, 'PHB'); at(0x80FDAD, 'PEA', 0x7E7E); at(0x80FDB0, 'PLB'); at(0x80FDB1, 'PLB');
  at(0x80FDB2, 'CPX', 0); at(0x80FDB5, 'BEQ', 0x80FDCA); at(0x80FDB7, 'LDY', 0);
  at(0x80FDBA, 'SEP', 32); at(0x80FDBC, 'LDA', 0x21A0); at(0x80FDBF, 'STA', 0x21A0);
  at(0x80FDC2, 'BEQ', 0x80FDC8); at(0x80FDC4, 'INX'); at(0x80FDC5, 'INY'); at(0x80FDC6, 'BRA', 0x80FDBC);
  at(0x80FDC8, 'REP', 32); at(0x80FDCA, 'JSR', 0x80FB39); at(0x80FDCD, 'PLB'); at(0x80FDCE, 'RTS');
  assert.equal(map.get(0x80FDBC).mode, 'absx'); assert.equal(map.get(0x80FDBF).mode, 'absy');
});
test('A617 full WORD row/count owner preserves initial do-loop and null-token exit before decrement', () => {
  at(0x80A617, 'LDA', 0x1D9B); at(0x80A61A, 'STA', 0x1D9D);
  at(0x80A61D, 'LDA', 6); at(0x80A61F, 'STA', 0x1D9F); at(0x80A622, 'LDY', 0x1D95);
  at(0x80A625, 'LDA', 0x1D99); at(0x80A628, 'STA', 2);
  at(0x80A62A, 'LDA', 0x1D9D); at(0x80A62D, 'STA', 4); at(0x80A62F, 'INC'); at(0x80A630, 'STA', 0x1D9D);
  at(0x80A638, 'BEQ', 0x80A687); at(0x80A641, 'LDA', 0x1DA5);
  at(0x80A65D, 'INY'); at(0x80A65E, 'INY'); at(0x80A65F, 'DEC', 0x1D9F); at(0x80A662, 'BNE', 0x80A625);
  assert.ok([...map].filter(([pc]) => pc >= 0x80A617 && pc < 0x80A6A5).every(([, i]) => i.state.m === 0 && i.state.x === 0));
});
test('marks and scroll arrows preserve WORD math and the actual unsaved callee Y path', () => {
  for (const [entry, token] of [[0x80A5DB, 0x707D], [0x80A5F9, 0x7074]]) {
    const body = [...map.values()].filter(i => i.cpu >= entry && i.cpu < entry + 30);
    assert.deepEqual(body.map(i => i.mnemonic), ['TYA', 'SEC', 'SBC', 'LSR', 'CLC', 'ADC', 'STA',
      'LDA', 'DEC', 'STA', 'JSR', 'LDA', 'STA', 'JSR', 'RTS']);
    assert.equal(body[2].value, 0x1D95); assert.equal(body[5].value, 0x1D9B);
    assert.equal(body[7].value, 0x1D99); assert.equal(body[11].value, token);
  }
  at(0x80A664, 'LDA', 8); at(0x80A666, 'BEQ', 0x80A687);
  at(0x80A668, 'LDX', 0); at(0x80A66A, 'LDA', 0x7E2020); at(0x80A673, 'LDA', 0x7E2040);
  for (const pc of [0x80A66E, 0x80A66F, 0x80A670, 0x80A677, 0x80A678, 0x80A679,
    0x80A692, 0x80A693, 0x80A694]) at(pc, 'DEC');
  at(0x80A687, 'LDA', 0x1D95); at(0x80A68A, 'BEQ', 0x80A6A4); at(0x80A697, 'STZ', 4);
  assert.ok(![...map.values()].some(i => i.cpu >= 0x80A664 && i.cpu < 0x80A6A5 && ['PHY', 'PLY'].includes(i.mnemonic)));
});
