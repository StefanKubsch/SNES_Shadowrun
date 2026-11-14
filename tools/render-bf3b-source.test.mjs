import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-bf3b.json', import.meta.url)));
const address = s => parseInt(s.replace(':', ''), 16);
const windows = [
  [0x80BF3B, 0x80C06B, 132, 'ec2664a7e65aa63467a55dc4e42164a41afe15b4e2b498af3c8ba5955aa22af0'],
  [0x80FEC1, 0x80FF14, 40, '039abc05220efeb69068217e569a7a0e9d5518bbcf8a0d448adcf657b5a458be'],
  [0x8099EB, 0x809BA0, 181, '3e5aef83a620e227ff194a44806c9af9bbc8cc29618e616300636d501c33d3b1'],
  [0x80936C, 0x8094EA, 157, '09a59c53aea3b19534147e8079d09d34a7840933d521a9466d6c1707d30f0e4b'],
  [0x80BCB2, 0x80BCBE, 5, '53c72aa64846b83a5f7d8ccde17ecf65dc033003901d85657433987c3629506e'],
  [0x8096BD, 0x8096C0, 1, '9f3bed0a807fc576ee32db2aee810ffd60851d655b5654e327bbc68fb3b72595'],
  [0x80FF14, 0x80FF73, 41, 'c80713e3affcdb32d31a12df9aa1fd95cbe61b0da0d6fae6517c073c47c1eae1'],
  [0x8096E1, 0x8096E4, 1, '5157eb7aa093a5e69c0bd956c9e5a3e6e352f3cc5e792fe5b932e45a56a090dc'],
];
const byteRegions = [[0x80937C, 0x809380], [0x809431, 0x809437], [0x80945B, 0x80945F],
  [0x80F9E8, 0x80F9FB], [0x80FE84, 0x80FE89], [0x80FEA1, 0x80FEBC],
  [0x80FB95, 0x80FBC6], [0x80FC38, 0x80FC5C], [0x80FC5F, 0x80FC79],
  [0x80FC96, 0x80FCEE], [0x80FD15, 0x80FD37], [0x80FD56, 0x80FD5B],
  [0x81ADCE, 0x81ADD9], [0x81AE2E, 0x81AE33], [0x81AE61, 0x81AE8F],
  [0x809EE4, 0x809EED], [0x809F00, 0x809F12], [0x81AF37, 0x81AF3E],
  [0x81AFB0, 0x81AFB7], [0x81AFDE, 0x81AFE5]];
const map = new Map();
for (const [lo, hi] of [...windows, ...report.dependencies[0].windows.map(w => [address(w.entry), address(w.end_exclusive)])]) {
  for (let pc = lo; pc < hi;) {
    const i = decode(rom, pc, { e: 0, m: Number(byteRegions.some(([a, b]) => pc >= a && pc < b)),
      x: Number(pc >= 0x809F00 && pc < 0x809F12) });
    assert.ok(i.next <= hi); assert.ok(!map.has(pc)); map.set(pc, i); pc = i.next;
  }
}
const at = (pc, op, value) => {
  const i = map.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op, cpuLabel(pc));
  if (value !== undefined) assert.equal(i.target ?? i.value, value, cpuLabel(pc)); return i;
};

test('BF3B pins complete local routines and maincall independently of analyzer decoder modes', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  assert.equal(report.windows.length, windows.length);
  for (const [lo, hi, count, hash] of windows) {
    const w = report.windows.find(w => w.entry === cpuLabel(lo)), raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    assert.equal(w.end_exclusive, cpuLabel(hi)); assert.equal(w.covered_bytes, hi - lo); assert.equal(w.instruction_count, count);
    assert.equal(w.sha256, hash); assert.equal(createHash('sha256').update(raw).digest('hex'), hash);
    assert.equal(w.machine_bytes, raw.toString('hex').toUpperCase());
    assert.equal([...map.keys()].filter(pc => pc >= lo && pc < hi).length, count);
  }
});
test('FEC1 closes entire2189/1033 WORD DBR graph with32 protected bytes and zero external assumptions', async () => {
  const graph = new Map([...map].filter(([pc]) => pc >= 0x80FEC1 && pc < 0x80FF14
    || report.dependencies[0].windows.some(w => pc >= address(w.entry) && pc < address(w.end_exclusive))));
  const proof = proveWordStack(graph, 0x80FEC1, 'RTS', { measureStack: true, widthJoins: new Set([0x80FC36]) });
  assert.deepEqual(proof, report.notice_graph.proof); assert.equal(proof.minimum_protected_stack_bytes, 32);
  assert.equal(proof.external_return_assumptions, 0); assert.equal(graph.size, 1033); assert.equal(report.notice_graph.code_bytes, 2189);
  assert.deepEqual(proof.returns, [{ at: '80:FF13', m: 0, x: 0, dbr: 'entry' }]);
  const old = JSON.parse(await readFile(new URL('../analysis/render-be6d.json', import.meta.url)));
  for (const w of report.dependencies[0].windows) {
    assert.ok([...old.windows, ...old.dependencies[0].windows].some(v => JSON.stringify(w) === JSON.stringify(v)));
    const raw = rom.subarray(cpuToOffset(address(w.entry), rom.length), cpuToOffset(address(w.end_exclusive), rom.length));
    assert.equal(raw.toString('hex').toUpperCase(), w.machine_bytes); assert.equal(createHash('sha256').update(raw).digest('hex'), w.sha256);
  }
});
test('BF3B shortcircuit gates and initial1FA6 clear precede actual taskhead', async () => {
  at(0x80BF3B, 'LDA', 0x1D5D); at(0x80BF3E, 'ORA', 0x1D5F); at(0x80BF41, 'BNE', 0x80BF48);
  at(0x80BF43, 'LDA', 0x1DA); at(0x80BF46, 'BPL', 0x80BF4B); at(0x80BF48, 'JMP', 0x80BFE7);
  at(0x80BF4E, 'AND', 0x8030); at(0x80BF53, 'STZ', 0x1FA6); at(0x80BF56, 'LDY', 0x1DE);
  at(0x8096BD, 'JSR', 0x80BF3B);
  const input = JSON.parse(await readFile(new URL('../analysis/render-input-flow.json', import.meta.url)));
  assert.ok(report.windows[0].machine_bytes.startsWith(input.windows.find(w => w.name === 'selectedEdgeBF3B').machine_bytes));
  assert.equal(input.windows[0].machine_bytes.slice(36, 42), report.windows[5].machine_bytes);
});
test('all three chainwalks use full freshhead/flags/link, not a negative-link sentinel', () => {
  for (const [head, flags, link, jump] of [[0x80BF59, 0x80BF60, 0x80BF65, 0x80BF69],
    [0x80BFEB, 0x80BFF0, 0x80BFF5, 0x80BFF9], [0x80C04C, 0x80C052, 0x80C057, 0x80C05B]]) {
    assert.equal(at(head, 'LDX', 0x1350).mode, 'absy'); assert.equal(at(flags, 'LDA', 0xBA2).mode, 'absx');
    at(link, 'LDA', 0x372); at(link + 3, 'TAX'); at(jump, 'BRA', flags);
  }
  at(0x80BF6D, 'CMP', 0x8000); at(0x80BF72, 'LDA', 0xBA2); at(0x80BF75, 'AND', 0x6002);
  at(0x80BF7A, 'LDA', 0xBA2); at(0x80BF7D, 'AND', 0x6682);
});
test('BF3B distance uses wrapping signedmagnitudes thenunsigned A1/81 thresholds and nearclear', () => {
  for (const [pc, offset] of [[0x80BF86, 0xE28], [0x80BF95, 0xE80], [0x80BFAA, 0xED8]]) {
    at(pc, 'SEC'); at(pc + 1, 'LDA', offset); at(pc + 4, 'SBC', offset); at(pc + 9, 'EOR', 65535); at(pc + 12, 'INC');
  }
  at(0x80BFA2, 'CLC'); at(0x80BFA3, 'ADC', 0x6B); at(0x80BFA5, 'CMP', 161);
  at(0x80BFB7, 'CMP', 129); at(0x80BFBA, 'BCC', 0x80BFE8); at(0x80BFE8, 'STZ', 0x1FA6);
  at(0x80BFBC, 'LDA', 0x1FA6); at(0x80BFBF, 'BNE', 0x80BFEB); at(0x80BFDE, 'JSR', 0x80FEC1);
});
test('BF3B edgepriority/action/dialog preserves original X/Y and actualtask event owner', () => {
  at(0x80BFFB, 'AND', 0x67F2); at(0x80C004, 'BIT', 0x8000); at(0x80C00A, 'PHY'); at(0x80C00B, 'JSR', 0x8099EB);
  at(0x80C00E, 'PLY'); at(0x80C00F, 'BIT', 2); at(0x80C016, 'BIT', 32);
  at(0x80C021, 'PHX'); at(0x80C023, 'LDA', 0x7E4450); at(0x80C027, 'PLX');
  at(0x80C02D, 'PHY'); at(0x80C032, 'JSR', 0x80936C); at(0x80C035, 'PLY');
  at(0x80C04F, 'BMI', 0x80BFE7); at(0x80C051, 'PHA'); at(0x80C05D, 'PLA');
  at(0x80C05E, 'ORA', 0xC62); at(0x80C061, 'STA', 0xC62); at(0x80C064, 'JSR', 0x80BCB2); at(0x80C067, 'JSR', 0x809E1A);
});
test('FEC1 continues after capacityend, uses actualDBR table and fresh scratch after callees', () => {
  at(0x80FEC1, 'LDA', 8); at(0x80FEC3, 'CMP', 0x400); at(0x80FECB, 'STA', 0x202);
  at(0x80FECE, 'JSR', 0x80F963); at(0x80FED1, 'LDA', 0); at(0x80FED3, 'PHA');
  at(0x80FED4, 'LDA', 10); at(0x80FED6, 'ASL'); assert.equal(at(0x80FED8, 'LDA', 0xD9B8).mode, 'absx');
  at(0x80FEDD, 'JSR', 0x80FE69); at(0x80FF08, 'LDA', 12); at(0x80FF0A, 'STA', 0x21E);
  at(0x80FF0D, 'PLA'); at(0x80FF0E, 'PLA'); at(0x80FF0F, 'STA', 0x7E0216);
});
test('FEC1 freeandoccupied branches balance stack and equality picks lowerindex', () => {
  at(0x80FEE0, 'LDX', 6); at(0x80FEE3, 'LDA', 65535); at(0x80FEE6, 'PHA');
  at(0x80FEE7, 'LDA', 0x7E0216); at(0x80FEEB, 'BMI', 0x80FF08); at(0x80FEED, 'PLA');
  at(0x80FEEE, 'CMP', 0x21E); at(0x80FEF1, 'BCC', 0x80FEF7); at(0x80FEF3, 'LDA', 0x21E); at(0x80FEF6, 'TXY');
  at(0x80FEF9, 'BPL', 0x80FEE6); at(0x80FEFB, 'PHA'); at(0x80FEFC, 'TYX');
  at(0x80FEFD, 'LDA', 0x7E0216); at(0x80FF03, 'PHX'); at(0x80FF04, 'JSR', 0x80FA3E); at(0x80FF07, 'PLX');
});
test('action/dialog nestedfrontier and E382 remain explicit, no whole BF3B stackclaim', () => {
  at(0x809B7D, 'JSR', 0x80A6A5); at(0x80938D, 'JSR', 0x80FF79); at(0x8094E9, 'RTS');
  assert.equal(report.full_graph.closed, false); assert.equal(report.full_graph.native_binding, false);
  assert.equal(report.full_graph.minimum_protected_stack_bytes, null); assert.equal(report.full_graph.separate_nonreturn_terminal, '80:E382');
  assert.ok(report.full_graph.unresolved_nested_callees.includes('80:A6A5'));
  assert.ok(!report.full_graph.unresolved_nested_callees.includes('80:FF79'));
  assert.ok(!report.full_graph.unresolved_nested_callees.includes('81:EF47'));
  assert.ok(!report.full_graph.unresolved_nested_callees.includes('80:FA92'));
  assert.ok(!report.full_graph.unresolved_nested_callees.includes('80:9F6D'));
  assert.ok(!report.full_graph.unresolved_nested_callees.includes('80:8F20'));
  assert.ok(!report.full_graph.unresolved_nested_callees.includes('80:9022'));
  assert.ok(!report.full_graph.unresolved_nested_callees.includes('80:905E'));
  assert.deepEqual(report.full_graph.supplied_source_nested_callees.map(c => [c.entry,c.code_bytes,c.instructions,c.minimum_protected_stack_bytes,c.native_binding]),
    [['80:FF79',862,401,28,true],['81:EF47',428,213,22,true],['80:FA92',26,12,2,true],['80:9F6D',223,120,10,true],['80:8F20',26,13,3,true],['80:9022',105,43,4,true],['80:905E',95,36,5,true],['80:8F3A',122,55,6,true]]);
  assert.equal(report.full_graph.supplied_conditional_nested_callees[0].entry,'80:A6A5');
  assert.equal(report.full_graph.supplied_conditional_nested_callees[0].minimum_protected_stack_bytes,20);
  assert.match(report.scope, /full graph remains open/);
});
test('selected original noticeanddialog tables have no invented indexbound or initializer', () => {
  for (const [entry, length, hash] of [[0x80D9B8, 2, '5742a6706b83d40b67f60220ddde8f8a50f7976a75fdf57c737cf4a86815bf16'],
    [0x8094F7, 160, '9bd0b4700c3254c968e741b930deeee7aaea2b511f6c257e47e97a8e56b851b1'],
    [0x80FF73, 6, '6d5e78c6c41120aa56c412066be719d5823385c9047417d8480deb54afd59ac5']]) {
    const w = report.tables.find(t => t.entry === cpuLabel(entry));
    const raw = rom.subarray(cpuToOffset(entry, rom.length), cpuToOffset(entry, rom.length) + length);
    assert.equal(w.covered_bytes, length); assert.equal(w.sha256, hash); assert.equal(createHash('sha256').update(raw).digest('hex'), hash);
    assert.equal(w.machine_bytes, raw.toString('hex').toUpperCase()); assert.match(w.qualification, /No table capacity/);
  }
});
test('AB2C original slotreset and FF14 decrements/releases are existingowners, no implicit framebinding', async () => {
  const old = JSON.parse(await readFile(new URL('../analysis/render-a9e1.json', import.meta.url)));
  const w = old.windows.find(w => w.name === 'initializeAB2C');
  assert.deepEqual(report.selected_owners.initializer_window, w);
  const raw = rom.subarray(cpuToOffset(address(w.entry), rom.length), cpuToOffset(address(w.end_exclusive), rom.length));
  assert.equal(raw.toString('hex').toUpperCase(), w.machine_bytes);
  at(0x8096E1, 'JSR', 0x80FF14); at(0x80FF17, 'LDA', 0x7E0216); at(0x80FF1B, 'BMI', 0x80FF38);
  at(0x80FF1D, 'LDA', 0x21E); at(0x80FF20, 'DEC'); at(0x80FF21, 'STA', 0x21E); at(0x80FF24, 'BNE', 0x80FF38);
  at(0x80FF26, 'LDA', 0x7E0216); at(0x80FF2D, 'JSR', 0x80FA3E); at(0x80FF31, 'LDA', 65535);
  assert.deepEqual(report.selected_owners.expiry.calls.map(c => c.to), ['80:FA3E', '80:C560', '80:C51F', '80:C46E']);
  assert.match(report.contract.expiry, /Countdown0 wrapsFFFF/);
});
