import test from 'node:test';
import assert from 'node:assert/strict';
import { ScriptNatives } from '../src/script/natives.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';

function fixture() {
  return new ScriptNatives({}, { admitted: [], implementation: null });
}

test('rounds pause across budgets and ignore zero budgets', () => {
  const natives = fixture();
  let visits = 0;
  const round = natives.roundContinuation({
    *rounds() {
      visits++;
      yield;
      yield;
    },
  });
  assert.equal(round.run(0), WAIT_PAUSED);
  assert.equal(visits, 0);
  assert.equal(round.work, 0);
  assert.equal(round.run(1), WAIT_PAUSED);
  assert.equal(round.run(7), WAIT_PAUSED);
  assert.equal(round.run(1), WAIT_RETURNED);
  assert.equal(round.work, 3);
  assert.deepEqual(round.result, { wait: [], input: [] });
  assert.equal(round.run(1), WAIT_RETURNED);
  assert.equal(visits, 1);
  assert.equal(round.work, 3);
});

test('failed rounds reject replay and reentry', () => {
  const natives = fixture();
  let visits = 0;
  const round = natives.roundContinuation({
    *rounds() {
      visits++;
      assert.throws(() => round.run(1), { reason: 'script_visit_reentry' });
      yield;
      throw new Error('round failed');
    },
  });
  assert.equal(round.run(1), WAIT_PAUSED);
  assert.throws(() => round.run(1), /round failed/);
  assert.throws(() => round.run(1), { reason: 'script_visit_failed' });
  assert.equal(visits, 1);
});
