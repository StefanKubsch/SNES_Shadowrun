import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-a958.json', import.meta.url), 'utf8'));
const windows = [
  ['requestA958', 0x81A958, 0x81A98E, 23, 'be5e955766edc1794cf7409cbf4d8b041d9b071f4033d8be6ed65051412878e3'],
  ['callbackCallC16E', 0x80C16E, 0x80C172, 1, 'd2c6a990c534ce0acc4ef0bf247760177d494b48256acdd83505b817f2026481'],
  ['outputPostpassAC2F', 0x80AC2F, 0x80ADF4, 196, '2a821135b2546e32d885a499f1403fd6a06e5f26c40f980031f2619f377cecff'],
  ['selectedOutputWriterAE63', 0x80AE63, 0x80AEB4, 37, '6009f8b04f4cae889d573fea3e71253d18775ccaddcb6993a0e6e8fe416a754a'],
  ['selectedOutputBudgetAE4C', 0x80AE4C, 0x80AE63, 11, '0baafeb0550987aa911ad7c923c90c0debe60c1f6c2539f00998d5c83c15aedf'],
  ['selectedChannel1SetupA787', 0x81A787, 0x81A793, 5, '76405cf1e1e7957fc4b0f37726648e269921175ccfec2386b35aee747421bb76'],
  ['selectedCursorResetA7CB', 0x81A7CB, 0x81A7D3, 3, '973b8a711ecb6409933934c9f06cd432e009bace4198be0796836a524f641d94'],
  ['gateIncrementA954', 0x81A954, 0x81A958, 2, '8dae4a16e8b1334cc47a0b132b15f9d2c934f3732b2d9d26199c3d78d597b0a2'],
  ['selectedGateClearA772', 0x81A772, 0x81A775, 1, '8603163497943ae57852fd7a537bbc497f7a06d29afb40e926e8ef5d37b981a9'],
];
const instructions = new Map();
for (const [, lo, hi] of windows) for (let pc = lo; pc < hi;) {
  // Explicit independently selected BYTE intervals, not analyzer mode output.
  const m = Number(pc >= 0x81A975 && pc < 0x81A987 || pc >= 0x81A789 && pc < 0x81A793);
  const i = decode(rom, pc, { e: 0, m, x: 0 });
  assert.ok(i.next <= hi); instructions.set(pc, i); pc = i.next;
}
const range = (lo, hi) => [...instructions.values()].filter(i => i.cpu >= lo && i.cpu < hi);
const at = (pc, op, value, target) => {
  const i = instructions.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};

test('A958 full source, callback and selected owners have independent original byte pins', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  for (const [name, lo, hi, count, pin] of windows) {
    const raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    const sha256 = createHash('sha256').update(raw).digest('hex');
    assert.equal(sha256, pin); assert.equal(range(lo, hi).length, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(lo), end_exclusive: cpuLabel(hi),
      covered_bytes: hi - lo, instruction_count: count, sha256, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(report.code_bytes, 54); assert.equal(report.instruction_count, 23);
  assert.equal(report.owner_body_bytes, 457); assert.equal(report.owner_excerpt_bytes, 127);
});

test('A958 gates separate DBR1562 from bank00 DP82 and negative X returns original A with LDX flags', () => {
  assert.equal(at(0x81A958, 'LDA', 0x1562).mode, 'abs'); at(0x81A95B, 'BEQ', undefined, 0x81A98D);
  assert.equal(at(0x81A95D, 'LDX', 0x82).mode, 'dp'); at(0x81A95F, 'BMI', undefined, 0x81A98D);
  assert.equal(at(0x81A95D, 'LDX').state.x, 0);
  assert.match(report.gates.second, /independent ofDBR/); assert.match(report.gates.second, /negativeX\/N1\/Z0 even forA1/);
  assert.ok(!range(0x81A958, 0x81A98E).some(i => i.mnemonic === 'STZ'));
});

test('A958 visits current last-index then signeddecrements, including zero/odd/max values', () => {
  at(0x81A961, 'LDA', 0x16D4); at(0x81A987, 'DEX'); at(0x81A988, 'DEX'); at(0x81A989, 'BPL', undefined, 0x81A961);
  for (let cursor = 0; cursor < 65536; cursor++) {
    const n = cursor >= 32768 ? 0 : Math.floor(cursor / 2) + 1;
    if (n) {
      assert.ok(cursor - (n - 1) * 2 >= 0); assert.ok(cursor - n * 2 < 0);
      assert.equal((cursor - n * 2) & 65535, cursor & 1 ? 65535 : 65534);
    }
    const example = report.loop.cursors.find(v => v.cursor === cursor);
    if (example) assert.deepEqual(example, { cursor, nominalIterations: n, finalX: n ? cursor & 1 ? 65535 : 65534 : cursor });
  }
});

test('A958 three reads retain order and WORD X during BYTE bankread without masks or clamps', () => {
  for (const [pc, value, m] of [[0x81A961, 0x16D4, 0], [0x81A96D, 0x1754, 0], [0x81A97A, 0x1654, 1]]) {
    const i = at(pc, 'LDA', value); assert.equal(i.mode, 'absx'); assert.equal(i.state.m, m); assert.equal(i.state.x, 0);
  }
  assert.deepEqual(range(0x81A961, 0x81A987).filter(i => i.mnemonic === 'LDA' && i.mode !== 'immM').map(i => i.value), [0x16D4, 0x1754, 0x1654]);
  assert.ok(!range(0x81A958, 0x81A98E).some(i => ['AND', 'CMP', 'CPX', 'ASL', 'ADC'].includes(i.mnemonic)));
  assert.ok(0x1754 + 0x7FFF < 0x10000); assert.ok(0x1754 + 0x68AC >= 0x8000);
});

test('A958 six stores pervisit precede only final DP82 store; gate and tablebytes remain', () => {
  assert.deepEqual(range(0x81A958, 0x81A98E).filter(i => ['STA', 'STX'].includes(i.mnemonic)).map(i => [i.mnemonic, i.value, i.state.m, i.mode]),
    [['STA', 0x4312, 0, 'abs'], ['STA', 0x4315, 0, 'abs'], ['STA', 0x2116, 0, 'abs'],
      ['STA', 0x2115, 1, 'abs'], ['STA', 0x4314, 1, 'abs'], ['STA', 0x420B, 1, 'abs'], ['STX', 0x82, 0, 'dp']]);
  at(0x81A967, 'LDA', 0x40); at(0x81A975, 'LDA', 0x80); at(0x81A980, 'LDA', 2);
  at(0x81A98B, 'STX', 0x82); at(0x81A98D, 'RTL');
});

test('A958 active return retains highA from target and N/Z from DEX while preserving C/V', () => {
  at(0x81A973, 'SEP', 32); at(0x81A985, 'REP', 32);
  assert.deepEqual(range(0x81A96D, 0x81A98E).map(i => i.mnemonic),
    ['LDA', 'STA', 'SEP', 'LDA', 'STA', 'LDA', 'STA', 'LDA', 'STA', 'REP', 'DEX', 'DEX', 'BPL', 'STX', 'RTL']);
  for (let target = 0; target < 65536; target++) assert.equal((Math.floor(target / 256) * 256 + 2), (target & 0xFF00) | 2);
  assert.match(report.loop.returns, /retai[n]? it|retain it/); assert.match(report.loop.returns, /No A0002 assumption/);
});

test('A958 local graph closes all23 instructions, three branches, no calls and WORD RTL', () => {
  const map = new Map(range(0x81A958, 0x81A98E).map(i => [i.cpu, i]));
  assert.deepEqual(proveWordStack(map, 0x81A958), report.graph.proof);
  assert.equal(report.graph.proof.reachable_instructions, 23); assert.deepEqual(report.graph.calls, []);
  assert.deepEqual(report.graph.edges.map(e => e.kind), ['BEQ', 'BMI', 'BPL']);
  assert.deepEqual(report.graph.proof.returns, [{ at: '81:A98D', m: 0, x: 0, dbr: 'entry' }]);
  assert.equal(report.graph.actual_transfer_completion_proven, false);
});

test('A958 selected cursor/channel initialization and full wrapping gate increment stay explicit', () => {
  at(0x81A7CB, 'LDA', 0xFFFE); at(0x81A7CE, 'STA', 0x14B0); at(0x81A7D1, 'STA', 0x82);
  at(0x81A787, 'SEP', 32); at(0x81A789, 'LDA', 1); at(0x81A78B, 'STA', 0x4310);
  at(0x81A78E, 'LDA', 0x18); at(0x81A790, 'STA', 0x4311);
  at(0x81A772, 'STZ', 0x1562); at(0x81A954, 'INC', 0x1562); at(0x81A957, 'RTL');
  assert.deepEqual(proveWordStack(new Map(range(0x81A954, 0x81A958).map(i => [i.cpu, i])), 0x81A954), report.owners.gate_increment_proof);
  assert.match(report.owners.increment, /FFFF->0000/); assert.match(report.owners.reset, /No initial1654/);
});

test('A958 selected two producers share DP82 and exact three tablebases, with AE12 lifetime still open', () => {
  for (const [read, write, p1, b1, t1, p2, b2, t2] of [
    [0x80AD70, 0x80ADBE, 0x80AD7D, 0x80AD89, 0x80AD8F, 0x80AD9D, 0x80ADA9, 0x80ADAF],
    [0x80AE63, 0x80AEB1, 0x80AE70, 0x80AE7C, 0x80AE82, 0x80AE90, 0x80AE9C, 0x80AEA2],
  ]) {
    at(read, 'LDY', 0x82); at(write, 'STY', 0x82);
    for (const [pc, value] of [[p1, 0x16D4], [b1, 0x1654], [t1, 0x1754], [p2, 0x16D4], [b2, 0x1654], [t2, 0x1754]]) {
      const i = at(pc, 'STA', value); assert.equal(i.state.m, 0); assert.equal(i.mode, 'absy');
    }
  }
  at(0x80AE51, 'ADC', 0x82); at(0x80AE55, 'CMP', 0x50); at(0x80AE5A, 'JSL', undefined, 0x81A954);
  at(0x80AE5E, 'LDA', 0x1562); at(0x80AE61, 'BNE', undefined, 0x80AE5E);
  assert.match(report.owners.other_writer, /externalB0A1 return/);
});

test('A958 physical alias examples and five nextcallees do not claim global ownership or frames', () => {
  assert.equal(0x1754 + 0x2BBE, 0x4312); assert.equal(0x1654 + 0x2CC2, 0x4316);
  assert.match(report.aliases, /fresh1754\+X read4312/); assert.match(report.owners.lifecycle, /Manual render provider stays separate/);
  at(0x80C16E, 'JSL', undefined, 0x81A958); assert.deepEqual(report.caller.raw_patterns.jslA958, ['80:C16E']);
  assert.deepEqual(report.caller.raw_patterns.indexedPointerStore, ['80:AD7D', '80:AD9D', '80:AE70', '80:AE90']);
  assert.deepEqual(report.caller.remaining_after, ['81:A98E', '80:8FBA', '80:9E0B', '80:C06B', '81:B0D1']);
  assert.match(report.caller.qualification, /not allwriter/); assert.match(report.boundaries[0], /native atomicA958/);
});
