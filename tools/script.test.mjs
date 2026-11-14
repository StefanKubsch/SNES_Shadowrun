import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stepStackPrimitive } from '../proof/script/stack-primitives.mjs';

test('Native browser script primitives use the recovered word-stack semantics', () => {
  const code = Uint8Array.from([0x00, 0xFF, 0x14, 0x34, 0x92, 0xC0, 0xBC]);
  const stack = [];
  let pc = 0;
  pc = stepStackPrimitive(code, pc, stack).nextPc;
  assert.deepEqual(stack, [255]);
  pc = stepStackPrimitive(code, pc, stack).nextPc;
  assert.deepEqual(stack, [255, 0x9234]);
  pc = stepStackPrimitive(code, pc, stack).nextPc;
  assert.deepEqual(stack, [255, 0x9234, 0]);
  pc = stepStackPrimitive(code, pc, stack).nextPc;
  assert.deepEqual(stack, [255, 0x9234]);
  assert.equal(pc, code.length);
});

test('Unsupported, truncated, and invalid script instructions fail before changing state', () => {
  for (const code of [[0x56], [0x00], [0x14, 0x34], [0x01]]) {
    const stack = [0x1234];
    assert.throws(() => stepStackPrimitive(Uint8Array.from(code), 0, stack));
    assert.deepEqual(stack, [0x1234]);
  }
  assert.throws(() => stepStackPrimitive(Uint8Array.of(0xBC), 0, []), /underflow/);
  assert.throws(() => stepStackPrimitive(Uint8Array.of(0xC0), -1, []));
  assert.throws(() => stepStackPrimitive(Uint8Array.of(0xC0), 0, [-1]));
});

test('Recovered primitive dispatch targets and implementations match this European ROM', async () => {
  const bytes = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const signatures = [
    [0x00, 0xF398, 'B100C829FF004880E8'],
    [0x14, 0xF3B1, 'B100C8C8484C89F3'],
    [0xBC, 0xF8BB, '684C89F3'],
    [0xC0, 0xF393, 'F4000080F1'],
  ];
  for (const [opcode, target, signature] of signatures) {
    assert.equal(bytes.readUInt16LE(0x72B4 + opcode), target);
    assert.equal(bytes.subarray(target - 0x8000, target - 0x8000 + signature.length / 2).toString('hex').toUpperCase(), signature);
  }
});
