import test from 'node:test';
import assert from 'node:assert/strict';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';

test('sequence replies and child pauses need no accessor or register snapshot', () => {
  const calls = [];
  const child = new SequenceRunner(
    (function* () {
      yield () => calls.push('child first');
      yield () => calls.push('child last');
      return 'child result';
    })(),
  );
  const parent = new SequenceRunner(
    (function* () {
      const first = yield () => 'first result';
      const second = yield { continuation: child };
      assert.equal(first, 'first result');
      assert.equal(second, 'child result');
      return 'finished';
    })(),
  );
  assert.equal(parent.run(0), WAIT_PAUSED);
  assert.deepEqual(calls, []);
  while (parent.run(1) === WAIT_PAUSED) assert.ok(parent.work <= 3);
  assert.equal(parent.result, 'finished');
  assert.equal(parent.work, 3);
  assert.deepEqual(calls, ['child first', 'child last']);
  assert.equal(parent.run(1), WAIT_RETURNED);
  assert.equal(parent.work, 3);
});

test('sequence faults and reentry cannot replay a partly executed action', () => {
  let calls = 0;
  const runner = new SequenceRunner(
    (function* () {
      yield () => {
        calls++;
        runner.run(1);
      };
    })(),
  );
  assert.throws(
    () => runner.run(-1),
    (e) => e.reason === 'native_call_budget_required',
  );
  assert.equal(calls, 0);
  assert.throws(
    () => runner.run(1),
    (e) => e.reason === 'native_call_reentry',
  );
  assert.throws(
    () => runner.run(1),
    (e) => e.reason === 'native_call_failed',
  );
  assert.equal(calls, 1);
});
