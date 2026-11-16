import test from 'node:test';
import assert from 'node:assert/strict';
import { scriptVisitSequence, SCRIPT_VISIT } from '../src/system/script-visit.mjs';
import {
  NativeCallContinuation,
  drainNativeSequence,
} from '../src/system/native-call-continuation.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';

test('script visit keeps a pausing child and its result without synchronous fallback', () => {
  let created = 0;
  const child = {
    work: 0,
    result: 'nested result',
    run(budget) {
      assert.ok(budget > 0);
      this.work++;
      return this.work === 1 ? WAIT_PAUSED : WAIT_RETURNED;
    },
  };
  const parent = new NativeCallContinuation(
    { ctx: {} },
    scriptVisitSequence({
      nestedRound(target) {
        assert.equal(target, SCRIPT_VISIT);
        created++;
        return child;
      },
      round: () => assert.fail('nested child owns this visit'),
    }),
  );
  assert.equal(parent.run(0), WAIT_PAUSED);
  assert.equal(created, 0);
  assert.equal(parent.run(1), WAIT_PAUSED);
  assert.equal(child.work, 1);
  assert.equal(parent.run(1), WAIT_PAUSED);
  assert.equal(parent.run(1), WAIT_RETURNED);
  assert.equal(parent.result, child.result);
  assert.equal(created, 1);
});

for (const nestedRound of [undefined, () => null])
  test(`script visit synchronous fallback, factory present ${Boolean(nestedRound)}`, () => {
    const result = drainNativeSequence(
      scriptVisitSequence({
        nestedRound,
        round(target) {
          assert.equal(target, SCRIPT_VISIT);
          return 'synchronous result';
        },
      }),
    );
    assert.equal(result, 'synchronous result');
  });

test('script visit retains its missing-scheduler frontier', () => {
  assert.throws(
    () => drainNativeSequence(scriptVisitSequence({})),
    (error) => error.reason === 'task_f254_visit_open',
  );
});

test('script visit preserves the caller frontier and observes synchronous results', () => {
  assert.throws(
    () => drainNativeSequence(scriptVisitSequence({}, 'task_dialog_topic_visit_open')),
    (error) => error.reason === 'task_dialog_topic_visit_open',
  );
  const observed = [];
  const result = drainNativeSequence(
    scriptVisitSequence({ round: () => 'result' }, undefined, (value) => observed.push(value)),
  );
  assert.equal(result, 'result');
  assert.deepEqual(observed, ['result']);
});
