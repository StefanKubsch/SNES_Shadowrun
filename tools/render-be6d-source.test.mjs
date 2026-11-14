import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-be6d.json', import.meta.url)));
const address = s => parseInt(s.replace(':', ''), 16);
const hashes = [
  [0x80BE6D, 0x80BF3B, 85, '82d3e8dc2b7231d4a290bfe0ab391f8f8a68ed43dda3b71bb1658ed8996d124a'],
  [0x80BCBE, 0x80BE5B, 190, '0ce54d30d0eeddbab0e855f2b804c06be6edb1c3d3844e574f79928d7ed99b32'],
  [0x80FADD, 0x80FB2A, 35, '5368500123147e6e7ef808a4582febebe889c935cdd0680da47aa8d3994ef125'],
  [0x80FB2A, 0x80FB39, 8, 'a16fc2be888cb315e813ebaca84e98006779897dfeff4d84187a2ba834d5a4c6'],
  [0x80F963, 0x80FA3E, 95, '575759f8219c696e508a78ae51f53d31b0c0b8fb3cfbfc3a9e1236736087c5c5'],
  [0x80FA67, 0x80FA89, 16, '23fba8656c6da6c25b590f6e1ce1f9d5407439e1c762031deaf5a420db058ae2'],
  [0x80FE69, 0x80FEC1, 43, '0555ec706bcf599f09c8709a5fce70fc0fa34f33555dfe3a2efa207de6e2907a'],
  [0x80FB39, 0x80FD80, 283, '264a8d19c932719562f1bc1b688b05b74f5399799ea192d8d8c50c31121d1deb'],
  [0x81ACBD, 0x81ACC3, 3, '5e994a7e4330cd0a700c749ea167899d2c125cb442cb0b3c9b014d0752ce4104'],
  [0x81ACC3, 0x81ACC9, 3, 'ee3afaa5eb1080cd4da298f2311a806c7d1c61cbfdc7a4e138077120f8fb8aaf'],
  [0x81ACC9, 0x81ACCF, 3, '8a827672e30a3f779561aeb41548677c16053a93a394c1975a9f453b5dc39870'],
  [0x81ADBA, 0x81AE14, 44, '6af343efde35add1b2072248f0960584b1b317a0a29c3152a0f0c34cf1d292f3'],
  [0x81AE14, 0x81AE4C, 30, '574468e3e7eb396741e0131d588732f373b22f34d82c99c493bc8abcc30fc4b1'],
  [0x81AE4C, 0x81AE4D, 1, '8254c329a92850f6d539dd376f4816ee2764517da5e0235514af433164480d7a'],
  [0x81AE4D, 0x81AEB0, 43, '28131781e93ac07790fe9aaaf03be61f53e200fa7f3c7c4e7b7b6e411b2d1e01'],
  [0x81AEC8, 0x81AEF4, 23, '2f32d5c67123e6f6bb7c8c737d8c51ba88124c72cc76aad2859ddd1fedfdc942'],
  [0x81AEF4, 0x81AEFC, 3, 'c42b520efec1f8184464ed0eeb2e52e2177da61bfcd85a59fedbe9defa5c8c05'],
  [0x81AEFC, 0x81AF04, 3, 'c292a8b0c6d98285be51ac08dedd41dd3cc280754cf66041133a063c2fd59503'],
  [0x81AF04, 0x81AF1F, 13, '7292c796c170bc25babb82827d0e571049c150f5d53832588a38bd9874b572eb'],
  [0x8096BA, 0x8096BD, 1, 'bcb5ba918e46cc6d651e3e0961c62a6b239425fc7bab8980feccbefd9efcdbcf'],
];
// Independent literal incoming mode regions, including the taken BYTE
// pathFC5F whose linear WORD predecessor jumps away. No values executed.
const byteRegions = [[0x80FB11, 0x80FB27], [0x80FB2A, 0x80FB32], [0x80FB38, 0x80FB39],
  [0x80F9E8, 0x80F9FB], [0x80FE84, 0x80FE89], [0x80FEA1, 0x80FEBC],
  [0x80FB95, 0x80FBC6], [0x80FC38, 0x80FC5C], [0x80FC5F, 0x80FC79],
  [0x80FC96, 0x80FCEE], [0x80FD15, 0x80FD37], [0x80FD56, 0x80FD5B],
  [0x81ADCE, 0x81ADD9], [0x81AE2E, 0x81AE33], [0x81AE61, 0x81AE8F]];
const map = new Map();
for (const [lo, hi] of hashes) for (let pc = lo; pc < hi;) {
  const i = decode(rom, pc, { e: 0, x: 0, m: Number(byteRegions.some(([a, b]) => pc >= a && pc < b)) });
  assert.ok(i.next <= hi, cpuLabel(pc)); map.set(pc, i); pc = i.next;
}
const at = (pc, op, operand) => {
  const i = map.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (operand !== undefined) assert.equal(i.target ?? i.value, operand); return i;
};
const graph = new Map(map); graph.delete(0x8096BA);
for (const w of report.dependencies[0].windows) {
  for (let pc = address(w.entry); pc < address(w.end_exclusive);) {
    const m = Number(pc >= 0x809EE4 && pc <= 0x809EEB || pc >= 0x809F00 && pc <= 0x809F10
      || pc >= 0x81AF37 && pc <= 0x81AF3C || pc >= 0x81AFB0 && pc <= 0x81AFB5 || pc >= 0x81AFDE && pc <= 0x81AFE3);
    const x = Number(pc >= 0x809F00 && pc <= 0x809F10);
    const i = decode(rom, pc, { e: 0, m, x }); assert.ok(!graph.has(pc)); graph.set(pc, i); pc = i.next;
  }
}

test('BE6D pins every new original window/hash/width and rechecks reused AD92/A9B2/reset bytes', async () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  assert.equal(report.windows.length, hashes.length);
  for (const [lo, hi, count, hash] of hashes) {
    const raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    const w = report.windows.find(w => w.entry === cpuLabel(lo));
    assert.equal(w.end_exclusive, cpuLabel(hi)); assert.equal(w.covered_bytes, hi - lo);
    assert.equal(w.instruction_count, count); assert.equal(w.machine_bytes, raw.toString('hex').toUpperCase());
    assert.equal(w.sha256, hash); assert.equal(createHash('sha256').update(raw).digest('hex'), hash);
    assert.equal([...map.keys()].filter(pc => pc >= lo && pc < hi).length, count);
  }
  const old = JSON.parse(await readFile(new URL('../analysis/render-ad92.json', import.meta.url)));
  assert.deepEqual(report.dependencies[0].windows,
    [...old.windows.slice(0, 4), ...old.dependencies.flatMap(d => d.windows)].filter(w => w.name !== 'resetBCB2'));
  for (const w of report.dependencies[0].windows) {
    const raw = rom.subarray(cpuToOffset(address(w.entry), rom.length), cpuToOffset(address(w.end_exclusive), rom.length));
    assert.equal(raw.toString('hex').toUpperCase(), w.machine_bytes);
  }
});

test('BE6D whole2835/1318 graph closes all calls with originalDBR/WORD returns and32 protected stackbytes', () => {
  assert.equal(report.local_code_bytes, 1986); assert.equal(report.reused_code_bytes, 849);
  assert.equal(report.full_graph.code_bytes, 2835); assert.equal(graph.size, 1318);
  for (const p of report.structural_proofs) {
    assert.deepEqual(proveWordStack(graph, address(p.entry), p.entry === '81:AF04' ? 'RTL' : 'RTS',
      { measureStack: true, widthJoins: new Set([0x80FAF2, 0x80FC36]) }), p);
    assert.equal(p.external_return_assumptions, 0);
    assert.ok(p.returns.every(r => r.m === 0 && r.x === 0 && r.dbr === 'entry'));
  }
  assert.deepEqual(report.full_graph.proof.returns.map(r => r.at), ['80:BF36', '80:BF3A']);
  assert.equal(report.full_graph.proof.minimum_protected_stack_bytes, 32);
  assert.equal(report.full_graph.actual_termination_proven, false); assert.equal(report.full_graph.native_binding, true);
});

test('BE6D fresh WORDgate bypasses all axes and calls onzero, and selectedmain/prefix remain byteidentical', async () => {
  at(0x80BE6D, 'LDA', 0x1D8); at(0x80BE70, 'BNE', 0x80BE75); at(0x80BE72, 'JMP', 0x80BF36); at(0x80BF36, 'RTS');
  at(0x8096BA, 'JSR', 0x80BE6D);
  const input = JSON.parse(await readFile(new URL('../analysis/render-input-flow.json', import.meta.url)));
  const prefix = input.windows.find(w => w.name === 'selectedHeldBE6D');
  assert.ok(report.windows[0].machine_bytes.startsWith(prefix.machine_bytes));
  const main = input.windows.find(w => w.name === 'mainLoop96AB');
  assert.equal(main.machine_bytes.slice(30, 36), report.windows.at(-1).machine_bytes);
  assert.match(report.held.gate, /X\/Y\/C\/V/);
});

test('BE6D both axes preserve source direction priority, carry1 plus30 and source unsignedvelocity clamps', () => {
  at(0x80BE75, 'LDA', 0x1CA); at(0x80BE78, 'XBA'); at(0x80BE79, 'AND', 15); at(0x80BE7C, 'LSR'); at(0x80BE7D, 'TAX');
  at(0x80BE7E, 'BCS', 0x80BE9B); at(0x80BE80, 'LSR'); at(0x80BE81, 'BCC', 0x80BEB3);
  at(0x80BE8B, 'SBC', 48); at(0x80BE8E, 'CMP', 0xFD00); at(0x80BE91, 'BCS', 0x80BE96);
  at(0x80BEA3, 'ADC', 47); at(0x80BEA6, 'CMP', 0x300); at(0x80BEA9, 'BCC', 0x80BEAE);
  at(0x80BEB3, 'STZ', 0x1D0); at(0x80BEB6, 'TXA'); at(0x80BEB7, 'LSR'); at(0x80BEB8, 'LSR');
  at(0x80BEB9, 'BCS', 0x80BED6); at(0x80BEBB, 'LSR'); at(0x80BEBC, 'BCC', 0x80BEEE);
  at(0x80BEC6, 'SBC', 48); at(0x80BEDE, 'ADC', 47); at(0x80BEEE, 'STZ', 0x1D2);
  assert.ok(![...map.values()].some(i => i.cpu >= 0x80BE75 && i.cpu < 0x80BEF1 && ['CLC', 'SEC'].includes(i.mnemonic)));
});

test('BE6D positions read fresh velocity afterstore and clamp wrappedWORD through both unsigned bounds', () => {
  for (const [pc, position, velocity, high] of [[0x80BEF1, 0x1D4, 0x1D0, 0xEF01], [0x80BF0B, 0x1D6, 0x1D2, 0xCE01]]) {
    at(pc, 'CLC'); at(pc + 1, 'LDA', position); at(pc + 4, 'ADC', velocity); at(pc + 7, 'CMP', 0x300);
    at(pc + 15, 'CMP', high); at(pc + 23, 'STA', position);
  }
  assert.match(report.held.positions, /BYTE01D5\/01D7/); assert.match(report.held.positions, /Wrapped sums/);
});

test('BE6D tail rereads fullheldWORD and conditionally releases or selects, never assumes callee success', () => {
  at(0x80BF25, 'LDA', 0x1CA); at(0x80BF28, 'XBA'); at(0x80BF29, 'AND', 15);
  at(0x80BF2C, 'BEQ', 0x80BF37); at(0x80BF2E, 'LDA', 0x1DA); at(0x80BF31, 'BMI', 0x80BF36);
  at(0x80BF33, 'JSR', 0x80BE5B); at(0x80BF37, 'JSR', 0x80BCBE); at(0x80BF3A, 'RTS');
  assert.match(report.held.tail, /second fresh/);
});

test('BCBE preserves signedhead/fullslot reads,type000B gates and literal index ASLcarry', () => {
  at(0x80BCBE, 'LDY', 0x14B0); at(0x80BCC1, 'BPL', 0x80BCC6); at(0x80BCC3, 'JMP', 0x80BD99);
  at(0x80BCD8, 'LDX', 0x14B2); at(0x80BCDB, 'LDA', 0x1090); at(0x80BCE3, 'LDA', 0x7E3F28);
  at(0x80BCE7, 'CMP', 11); at(0x80BCEF, 'CMP', 0xFFFD); at(0x80BCF7, 'ORA', 0x1D6D);
  at(0x80BD03, 'ASL'); at(0x80BD06, 'ASL'); at(0x80BD07, 'ADC', 0x1A); at(0x80BD0C, 'LDA', 0x8CEFB0);
  at(0x80BD92, 'DEY'); at(0x80BD93, 'DEY'); at(0x80BD94, 'BMI', 0x80BD99); at(0x80BD96, 'JMP', 0x80BCD8);
  assert.equal(at(0x80BCD8, 'LDX').mode, 'absy'); assert.match(report.selection.search, /odd heads/);
});

test('BCBE geometry retains fixed7E/actualDBR reads, explicitSEC chains and negative ROR sequence', () => {
  at(0x80BD17, 'SEC'); at(0x80BD1B, 'SBC', 0xF30); at(0x80BD1E, 'SEC'); at(0x80BD1F, 'SBC', 0xED8);
  at(0x80BD22, 'SEC'); at(0x80BD23, 'SBC', 0xCC6); at(0x80BD2E, 'SBC', 0x7E4240);
  at(0x80BD33, 'SBC', 0x7E42F0); at(0x80BD57, 'CLC'); at(0x80BD5B, 'ADC', 0xE80);
  at(0x80BD5F, 'SBC', 0xE28); at(0x80BD66, 'BPL', 0x80BD6C);
  at(0x80BD68, 'SEC'); at(0x80BD69, 'ROR'); at(0x80BD6A, 'SEC'); at(0x80BD6B, 'ROR');
  at(0x80BD6C, 'LSR'); at(0x80BD6D, 'LSR'); assert.match(report.selection.geometry, /No screen-space/);
});

test('BCBE action search exhaustion reaches nextbank819780, and PHA protects text across FADD/F963', () => {
  at(0x80BDD7, 'AND', 3); at(0x80BDDA, 'CMP', 3); at(0x80BDE2, 'LDX', 24);
  at(0x80BDE5, 'CMP', 0x809700); at(0x80BDEB, 'DEX'); at(0x80BDEC, 'DEX'); at(0x80BDED, 'BPL', 0x80BDE5);
  const i = at(0x80BDEF, 'LDA', 0x809782); assert.equal(i.mode, 'longx'); assert.equal(i.value + 0xFFFE, 0x819780);
  at(0x80BE05, 'PHA'); at(0x80BE06, 'JSR', 0x80FADD); at(0x80BE09, 'CLC'); at(0x80BE0A, 'ADC', 24);
  at(0x80BE29, 'JSR', 0x80F963); at(0x80BE2C, 'LDA', 0); at(0x80BE2E, 'STA', 0x1DC);
  at(0x80BE31, 'PLA'); at(0x80BE32, 'STA', 2); at(0x80BE34, 'JSR', 0x80FE69);
  assert.match(report.selection.calls, /capacity failure still returns/);
});

test('BCBE tracking can write01D4 before later01D6 guard releases through BE5B', () => {
  at(0x80BDB2, 'JMP', 0x80BE38); at(0x80BDB5, 'PHX'); at(0x80BDB6, 'JSR', 0x80BE5B); at(0x80BDB9, 'PLX');
  at(0x80BE3E, 'CMP', 255); at(0x80BE41, 'BCS', 0x80BE57); at(0x80BE44, 'STA', 0x1D4);
  at(0x80BE4A, 'SBC', 0x1E2); at(0x80BE4D, 'CMP', 255); at(0x80BE50, 'BCS', 0x80BE57);
  at(0x80BE53, 'STA', 0x1D6); at(0x80BE57, 'JSR', 0x80BE5B);
  assert.match(report.selection.track, /already written01D4/);
});

test('AF04 pointer bankalias, signed bitreload, PHA preservation and WORDCF wrap remain literal', () => {
  at(0x80FADD, 'LDA', 0x9DFF); at(0x80FAE0, 'STA', 0xD0); at(0x80FAE6, 'INC', 0xD0);
  at(0x80FAE8, 'ORA', 0x8000); at(0x80FAEB, 'STA', 0xCF);
  at(0x81AF04, 'DEC', 0x206); at(0x81AF07, 'BPL', 0x81AF1B); at(0x81AF09, 'PHA');
  at(0x81AF0A, 'LDA', 15); at(0x81AF10, 'LDA', 0xCF); assert.equal(at(0x81AF10, 'LDA').mode, 'dil');
  at(0x81AF12, 'XBA'); at(0x81AF13, 'STA', 0x208); at(0x81AF16, 'INC', 0xCF); at(0x81AF18, 'INC', 0xCF);
  at(0x81AF1A, 'PLA'); at(0x81AF1B, 'ASL', 0x208); at(0x81AF1E, 'RTL');
  assert.equal(report.structural_proofs.at(-1).minimum_protected_stack_bytes, 5);
  assert.match(report.text.pointer, /wraps lowWORD withoutbankincrement/);
});

test('FADD widthBYTE helper returns BYTE with hiddenhighA; rootREP joins original BYTE loop and WORD initialpath', () => {
  at(0x80FAF7, 'TAX'); at(0x80FAF8, 'JSL', 0x81AF04); at(0x80FB00, 'LDA', 0x9D8000);
  at(0x80FB04, 'BPL', 0x80FAF7); at(0x80FB06, 'AND', 0x7F7F); at(0x80FB0E, 'XBA');
  at(0x80FB15, 'JSR', 0x80FB2A); at(0x80FB1A, 'BEQ', 0x80FAF2); at(0x80FB25, 'REP', 32);
  at(0x80FB2A, 'TAX'); assert.equal(at(0x80FB2C, 'LDA', 0x81AC0C).state.m, 1);
  at(0x80FB30, 'REP', 32); at(0x80FB32, 'ADC', 0xBA); at(0x80FB36, 'SEP', 32);
  assert.equal(at(0x80FB38, 'RTS').state.m, 1);
  const broken = new Map(graph); broken.set(0x80FAF2, { ...graph.get(0x80FAF2), value: 4 });
  assert.throws(() => proveWordStack(broken, 0x80FADD, 'RTS', { widthJoins: new Set([0x80FAF2]) }), /Mode mismatch/);
  assert.throws(() => proveWordStack(graph, 0x80FADD, 'RTS'), /Mode mismatch/);
  assert.throws(() => proveWordStack(graph, 0x80FADD, 'RTS', { widthJoins: new Set([0x80FB2A]) }), /Invalid width join/);
  assert.match(report.text.width, /hiddenhighB/);
});

test('F963 capacity failure leaves caller continuation intact; active multiplication has fresh2134 reads and request waits', () => {
  at(0x80F968, 'CPX', 32); at(0x80F96D, 'JMP', 0x80FA3D); at(0x80FA3D, 'RTS');
  assert.equal(at(0x80F9EC, 'STA', 0x211B).state.m, 1); at(0x80F9EF, 'STZ', 0x211B);
  at(0x80F9F6, 'STA', 0x211C); at(0x80FA01, 'LDA', 0x2134); at(0x80FA04, 'STA', 0x7E20A0);
  at(0x80FA08, 'ADC', 0x212); at(0x80FA19, 'ADC', 0x2134); at(0x80FA32, 'JSR', 0x80FA67);
  at(0x80FA35, 'JSL', 0x81ACCF); at(0x80FA39, 'JSL', 0x81ACB5);
  at(0x80FA7D, 'ASL'); at(0x80FA81, 'INC', 0x1F6); at(0x80FA84, 'JSL', 0x81ACBD);
  for (const [pc, gate] of [[0x81ACBD, 0x1F6], [0x81ACC3, 0x1FA], [0x81ACC9, 0x1FC]]) {
    at(pc, 'LDA', gate); at(pc + 3, 'BNE', pc); at(pc + 5, 'RTL');
  }
});

test('FE69 restores originalDBR after real7E textbuffer composition; FB39 takenBYTE path is not WORDlinearfallthrough', () => {
  at(0x80FE69, 'PHB'); at(0x80FE7A, 'PEA', 0x7E7E); at(0x80FE7D, 'PLB'); at(0x80FE7E, 'PLB');
  assert.equal(at(0x80FEA5, 'STA', 0x21A0).state.m, 1); at(0x80FEB7, 'STZ', 0x21A0);
  at(0x80FEBA, 'REP', 32); at(0x80FEBC, 'JSR', 0x80FB39); at(0x80FEBF, 'PLB'); at(0x80FEC0, 'RTS');
  assert.equal(at(0x80FC5C, 'JMP', 0x80FB8C).state.m, 0);
  assert.equal(at(0x80FC5F, 'DEC', 0xA5).state.m, 1); assert.equal(at(0x80FC61, 'LDA', 32).raw.length, 2);
  at(0x80FC6A, 'PLP'); at(0x80FD7F, 'RTS');
  assert.deepEqual(report.width_joins.map(j => [j.at, j.incoming_m, j.outgoing_m]),
    [['80:FAF2', [0, 1], 0], ['80:FC36', [0, 1], 1]]);
  const broken = new Map(graph); broken.set(0x80FC36, { ...graph.get(0x80FC36), value: 4 });
  assert.throws(() => proveWordStack(broken, 0x80FB39, 'RTS', { widthJoins: new Set([0x80FC36]) }), /Mode mismatch/);
  assert.throws(() => proveWordStack(graph, 0x80FB39, 'RTS'), /Mode mismatch/);
  assert.match(report.text.rendering, /DBR80/);
});

test('Original selectedtables and crossbank fallback are pinned independently without indexcaps or WRAM hydration', () => {
  const expected = [
    [0x809700, 26, '8fd2a9f1d18dd6a5a390cc92052b7a5559b8fbeeca92c57d4fd5a1afbf59e1e6'],
    [0x809782, 26, 'd141bf87275eadda47dd5304574ab5b3b36996e6f0be4f6206d1c3c86028a710'],
    [0x819780, 2, '1e0c26afdd681e97d71c00bc5ebd6bb7dbaa2576c4c006619c245175268635a0'],
    [0x81AC0C, 128, '00295b557632169d3946fe9596559c57b5b7d9352b11022e03fbfa3b35e55394'],
    [0x81AC8D, 34, 'de02021bffe2f75d8bb8ced06d9bab7313c36eeb68ac6f8f84ee519390ccac44'],
    [0x95F2D0, 2048, '593596223018d66038ce16985f409bb93ba129ae8b8684f686a8f8408511494e'],
  ];
  assert.equal(report.tables.length, expected.length);
  for (const [j, [entry, length, hash]] of expected.entries()) {
    const raw = rom.subarray(cpuToOffset(entry, rom.length), cpuToOffset(entry, rom.length) + length), table = report.tables[j];
    assert.equal(table.entry, cpuLabel(entry)); assert.equal(table.covered_bytes, length); assert.equal(table.sha256, hash);
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash); assert.equal(table.machine_bytes, raw.toString('hex').toUpperCase());
    assert.match(table.qualification, /no index clamp/);
  }
  assert.match(report.boundaries[0], /Native81:AF04\/80:FADD\/FB2A manual atomic/);
  assert.match(report.boundaries[0], /Native80:FA67\/81:ACBD manual atomic/);
  assert.match(report.boundaries[0], /Native81:ACB5\/ACAF manual atomic/);
  assert.match(report.boundaries[0], /Native81:ACCF manual atomic entry/);
  assert.match(report.boundaries[0], /Native81:ADBA\/AE14\/AE4D geometry/);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
  assert.match(report.boundaries[1], /BF3B remains/); assert.match(report.scope, /no CPU\/device execution/);
});
