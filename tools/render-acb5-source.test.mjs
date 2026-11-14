import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile('Shadowrun (E).smc');
const report = JSON.parse(await readFile('analysis/render-acb5-native.json', 'utf8'));
const map = new Map();
for (let pc = 0x81ACAF; pc < 0x81ACBD;) {
  const i = decode(rom, pc, { e: 0, m: 0, x: 0 }); map.set(pc, i); pc = i.next;
}

test('ACB5/ACAF original14 bytes/6 instructions are independently pinned', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.romSha256); assert.equal(map.size, 6);
  for (const [lo, hi, hash] of [
    [0x81ACB5, 0x81ACBD, '560a3f66c5d46e47b85e687c5a63f482b3cd1e12f7591e9a79d3eca1ea1012be'],
    [0x81ACAF, 0x81ACB5, 'abcd15f735893a9027750d6760a4ecefb5554f6e4ce37c3c78880bc2a24a70ee'],
  ]) {
    const bytes = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
    assert.equal(report.sources.find(w => parseInt(w.entry.replace(':', ''), 16) === lo).machine_bytes, bytes.toString('hex').toUpperCase());
  }
});

test('literal WORD increment, nested JSL, full-WORD BNE and RTL returns close both stacks', () => {
  for (const [pc, op, operand] of [[0x81ACB5, 'INC', 0x1F8], [0x81ACB8, 'JSL', 0x81ACAF],
    [0x81ACBC, 'RTL'], [0x81ACAF, 'LDA', 0x1F8], [0x81ACB2, 'BNE', 0x81ACAF], [0x81ACB4, 'RTL']]) {
    const i = map.get(pc); assert.equal(i.mnemonic, op);
    if (operand !== undefined) assert.equal(i.target ?? i.value, operand);
    assert.equal(i.state.m, 0); assert.equal(i.state.x, 0);
  }
  const proofs = [0x81ACB5, 0x81ACAF].map(pc => proveWordStack(map, pc, 'RTL', { measureStack: true }));
  assert.deepEqual(proofs, report.stackProofs);
  assert.deepEqual(proofs.map(p => p.minimum_protected_stack_bytes), [6, 3]);
  assert.ok(proofs.every(p => p.external_return_assumptions === 0 && p.returns[0].dbr === 'entry'));
});
