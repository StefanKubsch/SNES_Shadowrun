import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile('Shadowrun (E).smc');
const report = JSON.parse(await readFile('analysis/render-ad92-native.json', 'utf8'));
const map = new Map();
for (const w of report.sources) {
  const state = { e: 0, m: 0, x: 0 }, end = parseInt(w.end_exclusive.replace(':', ''), 16);
  for (let pc = parseInt(w.entry.replace(':', ''), 16); pc < end;) {
    const i = decode(rom, pc, state); map.set(pc, i); pc = i.next;
    for (const [bit, name] of [[32, 'm'], [16, 'x']])
      if (['REP', 'SEP'].includes(i.mnemonic) && i.value & bit) state[name] = Number(i.mnemonic === 'SEP');
  }
}
test('AD92 native source independently pins all40 original callerbytes and the closed790/368 graph', () => {
  const raw = rom.subarray(cpuToOffset(0x81AD92, rom.length), cpuToOffset(0x81ADBA, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), 'de7bc7c4cb91717e27a7b7b0eab421495a009b497cb012cf56ff6b0713c35b13');
  assert.equal(raw.toString('hex'), '22b2a981ad0402301aa20000ec00029009bd2602f00422cfac81e8e8ec040290ebf0e922b5ac816b');
  assert.equal(map.size, 368); assert.equal(report.sources.reduce((n, w) => n + w.covered_bytes, 0), 790);
  for (const w of report.sources) {
    const start = parseInt(w.entry.replace(':', ''), 16), end = parseInt(w.end_exclusive.replace(':', ''), 16);
    const bytes = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), w.sha256);
    assert.equal(bytes.toString('hex').toUpperCase(), w.machine_bytes);
  }
});
test('original AD92 order pins fresh signed initialgate, unsigned lowerbound and inclusive wrapping tail', () => {
  const expected = [[0xAD92, 'JSL', 0x81A9B2], [0xAD96, 'LDA', 0x204], [0xAD99, 'BMI', 0x81ADB5],
    [0xAD9B, 'LDX', 0], [0xAD9E, 'CPX', 0x200], [0xADA1, 'BCC', 0x81ADAC], [0xADA3, 'LDA', 0x226],
    [0xADA6, 'BEQ', 0x81ADAC], [0xADA8, 'JSL', 0x81ACCF], [0xADAC, 'INX'], [0xADAD, 'INX'],
    [0xADAE, 'CPX', 0x204], [0xADB1, 'BCC', 0x81AD9E], [0xADB3, 'BEQ', 0x81AD9E],
    [0xADB5, 'JSL', 0x81ACB5], [0xADB9, 'RTL']];
  for (const [pc, op, operand] of expected) {
    const i = map.get(0x810000 + pc); assert.equal(i.mnemonic, op);
    if (operand !== undefined) assert.equal(i.target ?? i.value, operand);
    assert.deepEqual(i.state, { e: 0, m: 0, x: 0 });
  }
  assert.equal(map.get(0x81ADA3).mode, 'absx');
});
test('complete local graph independently proves22 protected stackbytes and restored WORD/DBR return', () => {
  const p = proveWordStack(map, 0x81AD92, 'RTL', { measureStack: true });
  assert.deepEqual(p, report.stackProof); assert.equal(p.minimum_protected_stack_bytes, 22);
  assert.equal(p.maximum_local_stack_bytes, 19); assert.equal(p.external_return_assumptions, 0);
  assert.deepEqual(p.returns, [{ at: '81:ADB9', m: 0, x: 0, dbr: 'entry' }]);
});
