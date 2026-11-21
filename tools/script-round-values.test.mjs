import test from 'node:test';
import assert from 'node:assert/strict';
import { ScriptNatives } from '../src/script/natives.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';

function fixture() {
  return new ScriptNatives({}, { admitted: [], implementation: null });
}

test('ordinary rounds own only native workspace across pauses and ignore zero budgets', () => {
  const natives = fixture();
  let visits = 0;
  const round = natives.roundContinuation(
    {
      *rounds() {
        visits++;
        assert.equal(natives.stacks.length, 1);
        assert.equal(natives.stacks[0], 0x139);
        yield;
        yield;
      },
    },
    0x139,
  );
  assert.equal(round.run(0), WAIT_PAUSED);
  assert.equal(visits, 0);
  assert.equal(round.work, 0);
  assert.deepEqual(natives.stacks, []);
  assert.equal(round.run(1), WAIT_PAUSED);
  assert.equal(round.run(7), WAIT_PAUSED);
  assert.equal(round.run(1), WAIT_RETURNED);
  assert.equal(round.work, 3);
  assert.deepEqual(round.result, { wait: [], input: [] });
  assert.deepEqual(natives.stacks, []);
  assert.equal(round.run(1), WAIT_RETURNED);
  assert.equal(visits, 1);
  assert.equal(round.work, 3);
});

test('failed ordinary rounds release workspace and reject replay and reentry', () => {
  const natives = fixture();
  let visits = 0;
  const round = natives.roundContinuation(
    {
      *rounds() {
        visits++;
        assert.throws(() => round.run(1), { reason: 'script_visit_reentry' });
        yield;
        throw new Error('round failed');
      },
    },
    0x139,
  );
  assert.equal(round.run(1), WAIT_PAUSED);
  assert.throws(() => round.run(1), /round failed/);
  assert.deepEqual(natives.stacks, []);
  assert.throws(() => round.run(1), { reason: 'script_visit_failed' });
  assert.equal(visits, 1);
});
