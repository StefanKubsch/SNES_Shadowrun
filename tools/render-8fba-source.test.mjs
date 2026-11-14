import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-8fba.json', import.meta.url), 'utf8'));
const windows = [
  ['request8FBA', 0x808FBA, 0x808FF5, 24, '18655de4a121db47dcfeba902f2669aaf96cd7e6278346678cef3845029487fb'],
  ['callbackCallC176', 0x80C176, 0x80C179, 1, 'c0d084dc841180ba69f8fdbca197efabe10660368a5f3588a4ed94297a6f05f4'],
  ['reset8FB3', 0x808FB3, 0x808FBA, 3, 'a8d93c25aaa6809f113cfb6ce2a576ea818adb628c0d57f7a8b77cacd1195d8a'],
  ['setupWait8FF5', 0x808FF5, 0x809022, 18, 'c1fc51d93929dd0a4fbabfc2fd22a93230285adefc8ac7a669f178682e1a3f54'],
  ['selectedPointerWriter942F', 0x80942F, 0x80943F, 6, '8078e84bf750bbf059bac6d28b532984a25646da4e0f02952fdb6864ba6163a5'],
  ['selectedPointerWriter9456', 0x809456, 0x809465, 7, '5fb35de8f1aa7a8d3c86d1ec862375a35384359d08d490ea110cfeed4ce7a940'],
  ['selectedPointerWriterE4C5', 0x80E4C5, 0x80E4D5, 6, '8078e84bf750bbf059bac6d28b532984a25646da4e0f02952fdb6864ba6163a5'],
  ['selectedSetupCaller9022', 0x809022, 0x80902E, 4, '5247f210bd128e8766afb4b5a8899f819de0d2d337e5c1d61337bddaaef80cae'],
  ['selectedSetupCaller905E', 0x80905E, 0x80906A, 4, 'c3445fc8fd3539fbf5dc36241d109bd1e33ab829c43061edfceaf69bb54acc98'],
  ['selectedSetupCallerE48D', 0x80E48D, 0x80E499, 4, 'c3445fc8fd3539fbf5dc36241d109bd1e33ab829c43061edfceaf69bb54acc98'],
];
const instructions = new Map();
for (const [, lo, hi] of windows) for (let pc = lo; pc < hi;) {
  const m = Number(pc >= 0x808FC4 && pc < 0x808FCB || pc >= 0x808FDC && pc < 0x808FEE
    || pc >= 0x809003 && pc < 0x809019 || pc >= 0x809431 && pc < 0x809439
    || pc >= 0x80945B && pc < 0x809461 || pc >= 0x80E4C7 && pc < 0x80E4CF);
  const i = decode(rom, pc, { e: 0, m, x: 0 }); assert.ok(i.next <= hi); instructions.set(pc, i); pc = i.next;
}
const range = (lo, hi) => [...instructions.values()].filter(i => i.cpu >= lo && i.cpu < hi);
const at = (pc, op, value, target) => {
  const i = instructions.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};

test('8FBA body/caller and selected complete owners/parameterwriters have independent literal ROM pins', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  for (const [name, lo, hi, count, sha256] of windows) {
    const raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), sha256); assert.equal(range(lo, hi).length, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(lo), end_exclusive: cpuLabel(hi),
      covered_bytes: hi - lo, instruction_count: count, sha256, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(report.code_bytes, 59); assert.equal(report.instruction_count, 24);
  assert.equal(report.owner_body_bytes, 52); assert.equal(report.owner_excerpt_bytes, 83);
});

test('8FBA fresh WORD0140 uses a signgate; nonnegative zero is active and negative A/flags survive', () => {
  assert.equal(at(0x808FBA, 'LDA', 0x140).state.m, 0); at(0x808FBD, 'BMI', undefined, 0x808FF4);
  assert.equal(at(0x808FBA, 'LDA').mode, 'abs'); assert.equal(report.graph.edges.length, 1);
  assert.match(report.gate, /Nonnegative including0/); assert.match(report.gate, /Negative returns thatWORD/);
});

test('8FBA keeps seven ordered registerstores, separate420B01/10 and a final WORDFFFF marker', () => {
  assert.deepEqual(range(0x808FBA, 0x808FF5).filter(i => i.mnemonic === 'STA').map(i => [i.value, i.state.m]),
    [[0x2116, 0], [0x420B, 1], [0x4342, 0], [0x4345, 0], [0x2121, 1], [0x4344, 1], [0x420B, 1], [0x140, 0]]);
  at(0x808FC4, 'LDA', 1); at(0x808FD4, 'LDA', 0x1E); at(0x808FE7, 'LDA', 0x10);
  at(0x808FEE, 'LDA', 0xFFFF); at(0x808FF1, 'STA', 0x140); at(0x808FF4, 'RTS');
});

test('8FBA DPWORD F6+3 is binary CLC/ADC with wordwrap and independent C/V for all65536 words', () => {
  assert.equal(at(0x808FCB, 'LDA', 0xF6).mode, 'dp'); at(0x808FCD, 'CLC'); at(0x808FCE, 'ADC', 3);
  for (let p = 0; p < 65536; p++) {
    const shiftedSign = p < 32768 ? p : p - 65536, mathematical = shiftedSign + 3;
    assert.equal(Number(mathematical > 32767 || mathematical < -32768), Number(p >= 0x7FFD && p <= 0x7FFF));
    assert.equal(Number(p + 3 >= 65536), Number(p >= 0xFFFD));
    assert.equal((p + 3) % 65536, (p + 3) & 65535);
  }
  assert.deepEqual(report.active.pointers.find(p => p.pointer === 0xFFFF), { pointer: 0xFFFF, offset: 2, carry: 1, overflow: 0 });
  assert.deepEqual(report.active.pointers.find(p => p.pointer === 0x7FFD), { pointer: 0x7FFD, offset: 0x8000, carry: 0, overflow: 1 });
});

test('8FBA paletteindex and sourcebank are BYTEreads, and bank00F8 remains unchanged by pointercarry', () => {
  const index = at(0x808FDC, 'LDA', 0x142), bank = at(0x808FE2, 'LDA', 0xF8);
  assert.equal(index.mode, 'abs'); assert.equal(bank.mode, 'dp'); assert.equal(index.state.m, 1); assert.equal(bank.state.m, 1);
  assert.deepEqual(range(0x808FBA, 0x808FF5).filter(i => i.mnemonic === 'LDA' && !i.mode.startsWith('imm')).map(i => i.value), [0x140, 0xF6, 0x142, 0xF8]);
  assert.ok(!range(0x808FBA, 0x808FF5).some(i => ['INC', 'STZ', 'STA'].includes(i.mnemonic) && i.value === 0xF8));
  assert.match(report.active.pointer, /no carry increment of bank00 F8/);
});

test('8FBA returns AFFFF/N1/Z0 with final C/V from ADC and preserves supplied X/Y/DBR/D/I', () => {
  assert.deepEqual(range(0x808FE7, 0x808FF5).map(i => i.mnemonic), ['LDA', 'STA', 'REP', 'LDA', 'STA', 'RTS']);
  assert.ok(!range(0x808FD1, 0x808FF5).some(i => ['ADC', 'SBC', 'CMP', 'ASL', 'CLC', 'SEC', 'CLV'].includes(i.mnemonic)));
  assert.match(report.active.returns, /AFFFF\/N1\/Z0/); assert.match(report.active.returns, /C\/V from F6\+3/);
});

test('8FBA/reset/setup all structurally close WORD RTS but setupbusywait termination remains unproven', () => {
  assert.deepEqual(proveWordStack(new Map(range(0x808FBA, 0x808FF5).map(i => [i.cpu, i])), 0x808FBA, 'RTS'), report.graph.proof);
  assert.equal(report.graph.proof.reachable_instructions, 24); assert.deepEqual(report.graph.calls, []);
  for (const [j, lo, hi] of [[0, 0x808FB3, 0x808FBA], [1, 0x808FF5, 0x809022]])
    assert.deepEqual(proveWordStack(new Map(range(lo, hi).map(i => [i.cpu, i])), lo, 'RTS'), report.owners.proofs[j].proof);
  at(0x80901C, 'LDA', 0x140); at(0x80901F, 'BPL', undefined, 0x80901C);
  assert.match(report.owners.setup_wait, /does not prove waittermination/); assert.equal(report.graph.actual_transfer_completion_proven, false);
});

test('Complete8FF5 setup owns channel0 parameters and enqueues X into0140 without nativewait binding', () => {
  assert.deepEqual(range(0x808FF5, 0x809022).filter(i => i.mnemonic === 'STA').map(i => [i.value, i.state.m]),
    [[0x4305, 0], [0x4302, 0], [0x4304, 1], [0x4301, 1], [0x2115, 1], [0x4300, 1]]);
  at(0x808FF5, 'LDA', 0x1000); at(0x808FFB, 'LDA', 0x5250); at(0x809003, 'LDA', 0x7F);
  at(0x809019, 'STX', 0x140); at(0x808FB3, 'LDA', 0xFFFF); at(0x808FB6, 'STA', 0x140);
  assert.match(report.owners.setup_wait, /Channel4 setup\/F6\/F8 are not supplied/);
});

test('Selected pointer/indexwriters preserve distinct BYTE/WORD/longDP sources and caller bounds', () => {
  for (const pc of [0x809431, 0x80E4C7]) assert.equal(at(pc, 'LDA', 0x8D0002).mode, 'longx');
  at(0x809435, 'STA', 0xF8); at(0x809439, 'LDA', 0x8D0000); at(0x80943D, 'STA', 0xF6);
  at(0x809456, 'LDY', 2); assert.equal(at(0x80945B, 'LDA', 0x11).mode, 'dily');
  at(0x80945D, 'STA', 0xF8); assert.equal(at(0x809461, 'LDA', 0x11).mode, 'dil'); at(0x809463, 'STA', 0xF6);
  for (const [pc, index, x] of [[0x809022, 0x91, 0], [0x80905E, 0xA1, 0x800], [0x80E48D, 0xA1, 0x800]]) {
    at(pc, 'LDA', index); at(pc + 3, 'STA', 0x142); at(pc + 6, 'LDX', x); at(pc + 9, 'JSR', undefined, 0x808FF5);
  }
  assert.match(report.owners.pointer_writers, /not8FBA callees/);
});

test('8FBA selectedcaller is a3-byte JSR; rawhints and three remaining callee/lifecycle boundaries stay qualified', () => {
  assert.equal(at(0x80C176, 'JSR', undefined, 0x808FBA).length, 3);
  assert.deepEqual(report.caller.raw_patterns.jsr8FBA, ['80:C176']); assert.deepEqual(report.caller.raw_patterns.jsr8FF5, ['80:902B', '80:9067', '80:E496']);
  assert.deepEqual(report.caller.remaining_after, ['80:9E0B', '80:C06B', '81:B0D1']);
  assert.match(report.aliases, /requires2 protectedreturnbytes/); assert.match(report.caller.qualification, /no allwriter/);
  assert.match(report.boundaries[0], /native atomic8FBA/); assert.match(report.owners.lifecycle, /no original data/);
});
