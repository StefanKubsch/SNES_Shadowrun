import test from 'node:test';
import assert from 'node:assert/strict';
import { ScriptNatives } from '../src/script/natives.mjs';
import { GameLoop } from '../src/script/game-loop.mjs';
import { scriptVisitSequence } from '../src/system/script-visit.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';
import { LagFreeFrames } from '../src/vm/frame-events.mjs';

function fixture() {
  const natives = new ScriptNatives({}, { admitted: [], implementation: null });
  const forbidden = () => assert.fail('live scheduler touched CPU workspace or an entry selector');
  const loop = Object.create(GameLoop.prototype);
  loop.natives = natives;
  loop.accessor = new Proxy({}, { get: forbidden });
  return { loop, natives, forbidden };
}

for (const head of [false, true])
  test(`named scheduler ${head ? 'head visit' : 'round'} needs no CPU workspace`, () => {
    const { loop, natives } = fixture();
    const budgets = [];
    const steps = function* () {
      budgets.push(natives.workBudget);
      yield;
      budgets.push(natives.workBudget);
    };
    loop.scheduler = { rounds: steps, headVisit: steps };
    const call = head ? loop.headVisit() : loop.schedulerRound();
    assert.equal(call.run(0), WAIT_PAUSED);
    assert.deepEqual(budgets, []);
    assert.equal(call.work, 0);
    assert.equal(call.run(1), WAIT_PAUSED);
    assert.equal(natives.workBudget, Infinity);
    assert.equal(call.run(7), WAIT_RETURNED);
    assert.equal(natives.workBudget, Infinity);
    assert.deepEqual(budgets, [1, 7]);
    assert.deepEqual(call.result, { wait: [], input: [] });
    assert.equal(call.run(1), WAIT_RETURNED);
    assert.deepEqual(budgets, [1, 7]);
  });

test('named nested head visit never evaluates the numeric legacy callbacks', () => {
  const { natives, forbidden } = fixture();
  let visits = 0;
  const scheduler = {
    *headVisit() {
      yield () => {};
      visits++;
      yield;
    },
  };
  // Scheduler generators yield pauses, while native sequences yield actions.
  const events = {
    valueRounds: true,
    nestedHeadVisit: (...args) => {
      assert.deepEqual(args, []);
      return natives.headContinuation(scheduler);
    },
    get nestedRound() {
      return forbidden();
    },
    get round() {
      return forbidden();
    },
  };
  const runner = new SequenceRunner(scriptVisitSequence(events));
  assert.equal(runner.run(0), WAIT_PAUSED);
  while (!runner.done) runner.run(1);
  assert.equal(visits, 1);
  assert.deepEqual(runner.result, { wait: [], input: [] });
});

test('named round failures reject replay and restore the native budget after reentry', () => {
  const { loop, natives } = fixture();
  let visits = 0;
  loop.scheduler = {
    *rounds() {
      visits++;
      assert.throws(() => call.run(1), { reason: 'script_visit_reentry' });
      assert.equal(natives.workBudget, 1, 'reentry restores the enclosing budget');
      yield;
      throw new Error('round failed');
    },
  };
  const call = loop.schedulerRound();
  assert.equal(call.run(1), WAIT_PAUSED);
  assert.equal(natives.workBudget, Infinity);
  assert.throws(() => call.run(7), /round failed/);
  assert.equal(natives.workBudget, Infinity);
  assert.throws(() => call.run(1), { reason: 'script_visit_failed' });
  assert.equal(natives.workBudget, Infinity);
  assert.equal(visits, 1);
});

test('named scheduler calls restore an enclosing finite native budget', () => {
  const { loop, natives } = fixture();
  natives.workBudget = 9;
  loop.scheduler = {
    *rounds() {
      yield;
    },
  };
  const call = loop.schedulerRound();
  assert.equal(call.run(1), WAIT_PAUSED);
  assert.equal(natives.workBudget, 9);
  assert.equal(call.run(7), WAIT_RETURNED);
  assert.equal(natives.workBudget, 9);
});

test('live intervals expose named rounds and head visits without numeric callbacks', () => {
  const { loop, forbidden } = fixture();
  const frameJobs = () => {};
  const interrupts = new LagFreeFrames();
  loop.devices = { take: () => ({ io: [], wait: [], input: [], frameJobs, interrupts }) };
  loop.accessor = { resetAccessBudget: () => {} };
  const events = loop.interval(0x8096c3);
  assert.equal('round' in events, false);
  assert.equal('nestedRound' in events, false);
  let rounds = 0,
    visits = 0;
  loop.scheduler = {
    *rounds() {
      rounds++;
      yield;
    },
    *headVisit() {
      visits++;
      yield;
    },
  };
  loop.accessor = new Proxy({}, { get: forbidden });
  for (const call of [events.schedulerRound(), events.nestedHeadVisit()]) {
    assert.equal(call.run(1), WAIT_PAUSED);
    assert.equal(call.run(1), WAIT_RETURNED);
  }
  assert.equal(rounds, 1);
  assert.equal(visits, 1);
});

test('named synchronous head visits return and report values without legacy fallbacks', () => {
  const { forbidden } = fixture();
  const result = { wait: ['wait'], input: ['input'] },
    observed = [];
  const events = {
    valueRounds: true,
    headVisit: (...args) => {
      assert.deepEqual(args, []);
      return result;
    },
    nestedHeadVisit: () => null,
    get round() {
      return forbidden();
    },
    get nestedRound() {
      return forbidden();
    },
  };
  const runner = new SequenceRunner(
    scriptVisitSequence(events, undefined, (value) => observed.push(value)),
  );
  while (!runner.done) runner.run(1);
  assert.equal(runner.result, result);
  assert.deepEqual(observed, [result]);
});
