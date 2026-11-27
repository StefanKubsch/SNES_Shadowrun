import test from 'node:test';
import assert from 'node:assert/strict';
import { Scheduler, NONE } from '../src/script/scheduler.mjs';
import { native, script } from '../src/scripts/runtime.mjs';
import {
  SCRIPT_RETURN_BYTES,
  NATIVE_POINTERS,
  NATIVE_ARGUMENT_COUNTS,
  NATIVE_RETURN_BYTES,
} from '../src/vm/layout.mjs';

// Small scripts isolate scheduler suspension from the native/device bridge. Native 1 is
// the wait (two arguments, a result), native 2 takes one argument; script 1 returns 42.
function* waitsAndChild() {
  yield* native(2, yield* native(1, 1, 1));
  yield* native(2, yield* script(1));
  yield* native(2, yield* native(1, 1, 2));
  return null;
}
// eslint-disable-next-line require-yield -- a script is a generator even without calls
function* answer() {
  return 42;
}
function fixture(native) {
  const bytes = new Map();
  const mem = {
    read8: (at) => bytes.get(at) ?? 0,
    read16(at) {
      return this.read8(at) | (this.read8(at + 1) << 8);
    },
    write8: (at, value) => bytes.set(at, value & 255),
    write16(at, value) {
      this.write8(at, value);
      this.write8(at + 1, value >>> 8);
    },
  };
  mem.write16(NATIVE_POINTERS + 2, 0xc401);
  mem.write8(NATIVE_ARGUMENT_COUNTS + 1, 2);
  mem.write8(NATIVE_RETURN_BYTES + 1, 2);
  mem.write8(NATIVE_ARGUMENT_COUNTS + 2, 1);
  mem.write8(SCRIPT_RETURN_BYTES + 1, 2);
  const scheduler = new Scheduler(mem, { native, scripts: [waitsAndChild, answer] });
  return scheduler;
}

test('A persistent coroutine carries both wait results and a child result without resume labels', () => {
  const values = [];
  const scheduler = fixture((id, args) => {
    values.push(args[0]);
    return null;
  });
  const parent = scheduler.append(0);
  scheduler.round(); // Rewind the initially empty cursor.
  scheduler.round(); // First wait.
  scheduler.slots[parent].continuation = null; // Diagnostic metadata is not control flow.
  scheduler.round(); // Expire counter, run child, reach second wait.
  assert.deepEqual(values, [1, 42]);
  assert.equal(scheduler.slots[parent].counter, 2);
  scheduler.slots[parent].continuation = null;
  scheduler.round();
  assert.deepEqual(values, [1, 42]);
  scheduler.round();
  assert.deepEqual(values, [1, 42, 1]);
  assert.equal(scheduler.head, NONE);
  assert.equal(scheduler.running.size, 0);
  // Reusing the same slot must create a fresh coroutine, not resume the old task.
  assert.equal(scheduler.append(0), parent);
  for (let n = 0; n < 5; n++) scheduler.round();
  assert.deepEqual(values, [1, 42, 1, 1, 42, 1]);
  assert.equal(scheduler.head, NONE);
});

test('Native budget pauses retain the coroutine and do not repeat readiness or native calls', () => {
  const values = [];
  let calls = 0,
    resumes = 0;
  const scheduler = fixture((id, args) => {
    calls++;
    values.push(args[0]);
    return { result: null, resume: () => ++resumes % 3 === 0 };
  });
  const parent = scheduler.append(0);
  scheduler.round();
  scheduler.round();
  assert.equal(scheduler.beginRound(), true);
  assert.equal(calls, 1);
  assert.equal(scheduler.running.has(parent), true);
  assert.equal(scheduler.continueRound(), true);
  assert.equal(calls, 1);
  assert.equal(scheduler.continueRound(), true); // Child completed; second native pauses.
  while (scheduler.continueRound());
  assert.equal(calls, 2);
  assert.equal(scheduler.slots[parent].counter, 2);
  assert.equal(scheduler.slots[parent].native, null);
  scheduler.round();
  assert.equal(scheduler.beginRound(), true);
  while (scheduler.continueRound());
  assert.deepEqual(values, [1, 42, 1]);
  assert.equal(calls, 3);
  assert.equal(scheduler.head, NONE);
  assert.equal(scheduler.running.size, 0);
});
