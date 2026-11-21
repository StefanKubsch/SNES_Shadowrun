import test from 'node:test';
import assert from 'node:assert/strict';
import { ScriptNatives, HEAD_VISIT, ROUND } from '../src/script/natives.mjs';
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

for (const entry of [ROUND, HEAD_VISIT])
  test(`nested scheduler entry ${entry.toString(16)} borrows workspace without CPU return metadata`, () => {
    const natives = fixture();
    const a = {
      ctx: new Proxy(
        { s: 0x127 },
        {
          get(target, key) {
            assert.equal(key, 's', 'only deeper native workspace needs a register');
            return target[key];
          },
          set: () => assert.fail('scheduler changed caller CPU context'),
        },
      ),
      pullWord: () => assert.fail('scheduler consumed a CPU return word'),
    };
    let visits = 0;
    const steps = function* () {
      visits++;
      assert.deepEqual(natives.stacks, [0x139, 0x127]);
      yield;
    };
    const scheduler = { rounds: steps, headVisit: steps };
    natives.stacks.push(0x139);
    const visit = natives.visitContinuation(a, scheduler, entry);
    assert.equal(visit.run(1), WAIT_PAUSED);
    assert.equal(visit.run(7), WAIT_RETURNED);
    assert.equal(visit.run(1), WAIT_RETURNED);
    assert.deepEqual(natives.stacks, [0x139]);
    assert.equal(visits, 1);
  });

test('failed nested visits restore the parent workspace and unknown entries never enter', () => {
  const natives = fixture();
  natives.stacks.push(0x139);
  const a = { ctx: { s: 0x127 } };
  const scheduler = {
    *headVisit() {
      yield;
      throw new Error('nested failure');
    },
  };
  const visit = natives.visitContinuation(a, scheduler, HEAD_VISIT);
  assert.equal(visit.run(1), WAIT_PAUSED);
  assert.throws(() => visit.run(1), /nested failure/);
  assert.deepEqual(natives.stacks, [0x139]);
  assert.throws(() => visit.run(1), { reason: 'script_visit_failed' });
  assert.throws(() => natives.visit(a, scheduler, 0x1234), {
    reason: 'script_scheduler_entry_unknown',
  });
  assert.deepEqual(natives.stacks, [0x139]);
});
