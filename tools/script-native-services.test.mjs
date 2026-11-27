import test from 'node:test';
import assert from 'node:assert/strict';
import { ScriptNatives, nativeTarget } from '../src/script/natives.mjs';
import {
  nativeTarget as implementation,
  nativeTargetEntries,
} from '../src/script/native-targets.mjs';
import { textWindowSide } from './text-window-caller-harness.mjs';
import * as W from '../src/data/wram.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';

function fixture(target, args, budget, unused = false) {
  const side = textWindowSide(),
    { a, mem, put, events } = side;
  put(W.WINDOW_ACTIVE, 0xffff);
  for (let at = 0; at <= W.NOTICE_WINDOW_LAST; at += 2) put(W.NOTICE_WINDOWS + at, 0xffff);
  let input = 0;
  const upload = events.interrupts.textWait;
  events.interrupts.textWait = (...values) => {
    if (values[3] !== 0x81b0a9) return upload(...values);
    put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
    put(W.PAD_HELD, input++ % 2 ? W.PAD_A : 0);
    return true;
  };
  const targets = [];
  const devices = {
    take(target) {
      targets.push(target);
      return {
        io: unused ? [{}] : [],
        wait: [],
        input: [],
        interrupts: events.interrupts,
        frameJobs: () => assert.fail('fixture services all waits'),
      };
    },
    bus: a.devices.bus,
    read: (...values) => a.devices.read(...values),
    write: (...values) => a.devices.write(...values),
  };
  const natives = new ScriptNatives(mem, {
    admitted: nativeTargetEntries,
    implementation,
    devices,
  });
  natives.workBudget = budget;
  const scheduler = { slots: [{ task: { pc: 0x1234 } }] };
  let id = 0;
  while (nativeTarget(mem, id) !== target) assert.ok(++id < 0x100);
  return { mem, natives, targets, call: () => natives.call(id, args, scheduler, 0) };
}

function finish(side) {
  const pending = side.call();
  if (typeof pending !== 'object') return pending;
  let steps = 0;
  while (!pending.resume()) assert.ok(++steps < 10000);
  const completed = side.mem.wram.slice();
  assert.equal(pending.resume(), true);
  assert.deepEqual(side.mem.wram, completed);
  return pending.result;
}

for (const budget of [1, 7, Infinity])
  for (const [target, args] of [
    [0x80f953, []],
    [0x80cda8, []],
    [0x80ff79, []],
    [0x808e36, [0, 0]],
    [0x808ab5, [0, 0xffff]],
  ])
    test(`native services own one service set: ${target.toString(16)}, budget ${budget}`, () => {
      const direct = fixture(target, args, budget);
      finish(direct);
      assert.deepEqual(direct.targets, [target]);
      assert.equal(direct.natives.services.length, 1);
      assert.equal('ctx' in direct.natives.services[0], false);
      assert.equal(direct.natives.services[0].io, null);
      assert.equal(direct.natives.depth, 0);
      const service = direct.natives.services[0];
      finish(direct);
      assert.equal(direct.natives.services[0], service);
      assert.equal(direct.natives.depth, 0);
    });

test('failed service natives close observations once and reject replay', () => {
  const side = fixture(0x80cda8, [], 1, true);
  const pending = side.call();
  assert.throws(
    () => {
      while (!pending.resume()) {
        /* Reach completion. */
      }
    },
    { reason: 'device_observation_unused' },
  );
  assert.equal(side.natives.depth, 0);
  assert.equal(side.natives.services[0].io, null);
  assert.throws(() => pending.resume(), { reason: 'script_native_failed' });
  assert.equal(side.natives.depth, 0);
});

test('nested service calls retain distinct owners across parent and child pauses', () => {
  const side = fixture(0x80f953, [], 1);
  const parent = side.call();
  assert.equal(parent.resume(), false);
  assert.equal(side.natives.depth, 1);
  finish(side);
  assert.equal(side.natives.depth, 1);
  assert.equal(side.natives.services.length, 2);
  assert.notEqual(side.natives.services[0], side.natives.services[1]);
  let steps = 0;
  while (!parent.resume()) assert.ok(++steps < 10000);
  assert.equal(side.natives.depth, 0);
  for (const a of side.natives.services) {
    assert.equal('ctx' in a, false);
    assert.equal(a.io, null);
  }
});

test('service nested scheduler entry never reads a caller CPU workspace', () => {
  const side = fixture(0x80f953, [], 1);
  let visits = 0;
  const visit = side.natives.headContinuation({
    *headVisit() {
      visits++;
      yield;
    },
  });
  assert.equal(visit.run(0), WAIT_PAUSED);
  assert.equal(visits, 0);
  assert.equal(visit.run(1), WAIT_PAUSED);
  assert.equal(visit.run(1), WAIT_RETURNED);
  assert.equal(visits, 1);
});
