import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeC68D as prepare } from '../proof/task/native-c68d.mjs';
import { prepareTaskNativeOpcodeC68D as call } from '../proof/task/native-opcode-bindings.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { nativeC68DSpec } from './task-native-c68d-spec.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
const word = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const signed = (v) => (v < 32768 ? v : v - 65536);
const magnitude = (left, right) => Math.abs(signed((left - right) & 65535));

test('C68D/C696: independent signed-wrap magnitudes, unsigned max, floor/Carry and retained second-SBC overflow', () => {
  const values = [0, 1, 3, 4, 7, 8, 399, 400, 401, 0x7fff, 0x8000, 0x8001, 0xffff];
  for (const dx of values)
    for (const dy of values)
      for (const bank of [0x80, 0x7f]) {
        const f = taskLeafFixture(0x80c68d, { bank }),
          base = bank * 65536;
        word(f, base + 0x0e38, dx);
        word(f, base + 0x0e48, 0);
        word(f, base + 0x0e90, dy);
        word(f, base + 0x0ea0, 0);
        const max = Math.max(magnitude(dx, 0), magnitude(dy, 0)),
          p = prepared(prepare, f);
        assert.equal(p.outputContext.a, Math.floor(max / 4));
        assert.equal(p.outputContext.status & 0xc3, ((max >>> 1) & 1) | (max < 4 ? 2 : 0));
        assert.equal(p.outputContext.x, 0x10);
        assert.equal(p.outputContext.y, 0x20);
        assert.equal(p.outputContext.bank, bank);
        assert.equal(p.outputContext.s, 0x701);
        assert.equal(p.rawReturnWord, 0xc20a);
        assert.deepEqual(
          p.accesses.filter((a) => a.label.startsWith('distance-inner-RTS')).map((a) => a.value),
          [0x92, 0xc6],
        );
      }
  for (const [left, right] of [
    [0x7fff, 0xffff],
    [0x8000, 1],
  ]) {
    const f = taskLeafFixture(0x80c68d);
    word(f, 0x800e38, 0);
    word(f, 0x800e48, 0);
    word(f, 0x800e90, left);
    word(f, 0x800ea0, right);
    const p = prepared(prepare, f),
      max = magnitude(left, right);
    assert.equal(p.outputContext.a, Math.floor(max / 4));
    assert.equal(p.outputContext.status & 0x41, 0x40 | ((max >>> 1) & 1));
  }
});

test('C696: full indices cross DBR banks and second coordinate observes the first DP00 store through a real alias', () => {
  const f = taskLeafFixture(0x80c68d);
  word(f, 0x800cc2, 0xf180);
  word(f, 0x800e38, 100);
  word(f, 0x80ffa8, 0);
  word(f, 0x800e90, 400);
  const p = prepared(prepare, f);
  assert.equal(p.outputContext.a, 75);
  assert.equal(p.outputContext.y, 0xf180);
  assert.equal(
    p.accesses.find((a) => a.label === 'leaf-long-WORD-low' && a.address === 0x810000).value,
    100,
  );
  const g = taskLeafFixture(0x80c68d, { bank: 0x7f });
  word(g, 0, 65535);
  word(g, 0x800e27, 100);
  word(g, 0x800e7f, 200);
  assert.equal(prepared(prepare, g).outputContext.a, 50);
});

test('C68D: actual inner-return aliases, decimal SBC and late full-call budgets refuse all private effects', () => {
  const f = taskLeafFixture(0x80c68d, { s: 2, savedOuterS: 2 });
  word(f, 0x800cc2, 0x20);
  word(f, 0x80a038, 20);
  word(f, 0x800e48, 0);
  word(f, 0x80a090, 30);
  word(f, 0x800ea0, 0);
  const failure = unchangedFailure(prepare, f, {}, 'task_native_helper_return_required');
  assert.equal(failure.actual, 0xc600);
  const g = taskLeafFixture(0x80c68d);
  unchangedFailure(
    prepare,
    g,
    { context: Object.freeze({ ...g.context, status: 8 }) },
    'task_binary_arithmetic_required',
  );
  const h = taskNativeOpcodeFixture(nativeC68DSpec),
    p = prepared(call, h);
  assert.equal(p.steps[0].resultPushed, true);
  assert.equal(p.steps[0].calleeReturnWord, 0xf508);
  assert.equal(p.accesses.find((a) => a.label === 'resume-fresh-result-low').value, 100);
  unchangedFailure(call, h, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(call, h, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
});
