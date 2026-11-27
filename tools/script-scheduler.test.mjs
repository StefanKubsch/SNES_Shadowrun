// The JS scheduler (src/script/scheduler.mjs) against the frozen outcomes of the
// register-level scheduler (retired with proof/vm), docs/SCRIPT-VM-LIFT.md phase 2.
//
// Each scenario starts from random WRAM in which the register-level side ran C1A6 and
// appended one to four ROM scripts through C34A (frozen as the bytes it changed); the
// conversion layer (tools/task-layout.mjs) reads that state into a JS scheduler, which
// then runs rounds (C1E3). The wait native (C401) runs inside the scheduler; every other
// native returns a random result and may, as natives do in the game, append a task and
// visit it at once (C34A, C1CA, a nested round), send events to a task or toggle its
// halt bit. After every round the native calls (ID and arguments), the projected task
// tables, heap headers and live frame bytes and the rest of the WRAM outside the
// interpreter's work bytes form the snapshot that the frozen outcome holds.
//
// New JS frames start zeroed, the original's hold heap residue: the locals of tasks
// created during a run are projected once written, and a load of an unwritten local ends
// the scenario as a fresh read (phase 1: script DD and seven value-chain sites).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assertFrozenRun, frozenData, useLiftVectors } from './lift-function-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { createTask } from '../src/script/tasks.mjs';
import {
  Scheduler,
  NONE,
  TASK_SLOTS,
  RESUME_CHILD,
  RESUME_WAIT,
  WAIT_EVENTS,
  WAIT_HALTED,
} from '../src/script/scheduler.mjs';
import { loadScheduler } from './task-layout.mjs';

const rom = new Uint8Array(readFileSync(new URL('../Shadowrun (E).smc', import.meta.url)));
useLiftVectors(import.meta.url);
const SCRIPT_COUNT = 937;
const NATIVE_LIMIT = 3000;
// Interpreter and scheduler work bytes outside the projection: the argument and result
// words 00.., the C2C8/C3C9 direct page words 71-75, the status words of F927, the
// native pointer of F4F6 at A2, the arithmetic scratch with the outer stack word 01F2,
// the stack page.
const WORK_BYTES = [
  [0x0000, 0x0020],
  [0x0071, 0x0076],
  [0x00a2, 0x00a4],
  [0x01be, 0x01c2],
  [0x01ea, 0x01f4],
  [0x1b00, 0x1cbc],
];
// The scheduler's tables, work words and heap: compared through the projection only.
const SCHEDULER_BYTES = [0x0246, 0x0cc2];

function prng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const EDGE = [0, 1, 2, 0x7f, 0x80, 0xff, 0x100, 0x7fff, 0x8000, 0x8001, 0xfffe, 0xffff];
const randomWord = (rnd) =>
  rnd() < 0.4
    ? EDGE[(rnd() * EDGE.length) | 0]
    : rnd() < 0.5
      ? (rnd() * 0x10) | 0
      : (rnd() * 0x10000) | 0;

// Scripts a task can be created for (even argument bytes, frame size without carry).
const scratch = new VmMemory(rom, new Uint8Array(0x20000));
const STARTABLE = [];
for (let id = 0; id < SCRIPT_COUNT; id++) {
  try {
    const args = scratch.read8(0x82e9cc + id) >>> 1;
    createTask(scratch, id, new Array(args).fill(0));
    STARTABLE.push({ id, args });
  } catch (error) {
    if (!error?.taskBoundary) throw error;
  }
}

// The native effects, one per native call in call order, the same on both sides.
function effectStream(seed) {
  const rnd = prng(seed),
    list = [];
  return (n) => {
    if (n >= NATIVE_LIMIT) throw { nativeBudget: true };
    while (list.length <= n) {
      const r = rnd(),
        script = STARTABLE[(rnd() * STARTABLE.length) | 0];
      list.push({
        result: randomWord(rnd),
        kind: r < 0.06 ? 'append' : r < 0.14 ? 'events' : r < 0.18 ? 'halt' : null,
        script: script.id,
        args: Array.from({ length: script.args }, () => randomWord(rnd)),
        visit: rnd() < 0.7,
        pick: rnd(),
        bits: (rnd() * 0x10000) & WAIT_EVENTS,
      });
    }
    return list[n];
  };
}
const pick = (list, r) => (list.length ? list[(r * list.length) | 0] : NONE);

function randomWram(rnd) {
  const wram = new Uint8Array(0x20000);
  for (let n = 0; n < wram.length; n++) wram[n] = rnd() < 0.5 ? 0 : (rnd() * 256) | 0;
  return wram;
}

// --- JS side ---------------------------------------------------------------------

// Locals of a task created during the run: loads of unwritten bytes end the scenario.
function trackLocals(task, written) {
  const bytes = task.locals,
    marks = new Set();
  written.set(task, marks);
  const isIndex = (key) => typeof key === 'string' && /^\d+$/.test(key);
  task.locals = new Proxy(bytes, {
    get(target, key) {
      if (isIndex(key) && !marks.has(Number(key)))
        throw { freshRead: `${task.script.toString(16)}@${task.pc.toString(16)}` };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, key, value) {
      target[key] = value;
      if (isIndex(key)) marks.add(Number(key));
      return true;
    },
  });
}

function jsWorld(wram, effects, stats) {
  const mem = new VmMemory(rom, wram.slice()),
    written = new WeakMap(),
    world = { mem, log: [], calls: 0, running: [] };
  const count = (key) => (stats[key] = (stats[key] ?? 0) + 1);
  const liveSlots = (scheduler) => {
    const slots = [];
    for (let slot = scheduler.head; slot !== NONE; slot = scheduler.slots[slot].next)
      slots.push(slot);
    return slots;
  };
  const native = (id, args, scheduler, slot) => {
    world.log.push([id, ...args]);
    world.running.push(slot);
    const effect = effects(world.calls++);
    if (effect.kind === 'append') {
      scheduler.append(effect.script, effect.args);
      count('append');
      if (effect.visit) {
        scheduler.visitHead();
        count('nested-visit');
      }
    } else if (effect.kind === 'events') {
      const target = pick(liveSlots(scheduler), effect.pick);
      if (target !== NONE) scheduler.slots[target].events |= effect.bits;
    } else if (effect.kind === 'halt') {
      const target = pick(
        liveSlots(scheduler).filter((slot) => !world.running.includes(slot)),
        effect.pick,
      );
      if (target !== NONE) {
        scheduler.slots[target].wait ^= WAIT_HALTED;
        count('halt');
      }
    }
    world.running.pop();
    return effect.result;
  };
  const layout = loadScheduler(mem, wram, {
    native,
    onCreate: (slot, task) => trackLocals(task, written),
  });
  const scheduler = layout.scheduler;
  // Flow statistics.
  const run = scheduler.run.bind(scheduler),
    ready = scheduler.ready.bind(scheduler),
    child = scheduler.child.bind(scheduler),
    release = scheduler.release.bind(scheduler);
  scheduler.run = function* (slot, how, input) {
    if (how === RESUME_CHILD) count('child-resume');
    if (how === RESUME_WAIT) count('wait-resume');
    const exit = yield* run(slot, how, input);
    if (exit.ended) count('end');
    return exit;
  };
  scheduler.ready = (slot) => {
    const value = ready(slot);
    if (value > 0 && value & 1) count('counter');
    if (value > 0 && value & WAIT_EVENTS) count('events');
    return value;
  };
  scheduler.child = (...args) => {
    count('child');
    return child(...args);
  };
  scheduler.release = (slot) => {
    count('release');
    return release(slot);
  };
  world.scheduler = scheduler;
  world.project = () =>
    layout.project({ includeLocal: (task, n) => written.get(task)?.has(n) ?? true });
  return world;
}

const inside = (n, [start, end]) => n >= start && n < end;

// The JS side's state after a round.
function jsSnapshot(js) {
  const wram = js.mem.wram.slice();
  for (let n = 0; n < wram.length; n++)
    if (inside(n, SCHEDULER_BYTES) || WORK_BYTES.some((range) => inside(n, range))) wram[n] = 0;
  return {
    log: js.log.map((call) => [...call]),
    projection: [...js.project()],
    wram: createHash('sha256').update(wram).digest('hex'),
  };
}

// The register-level start state can no longer be recorded.
const retired = () => {
  throw new Error('the register-level scheduler is retired; its start states cannot be recorded');
};

// One scenario: rounds until a frontier, a fresh read or the native budget, from the
// frozen start state (the WRAM bytes the register-level C1A6 and C34A changed).
function scenario(seed, stats) {
  const rnd = prng(seed);
  // The draws of the appended scripts (their count, then one per script) come first.
  const appended = 1 + ((rnd() * 4) | 0);
  for (let n = 0; n < appended; n++) rnd();
  const wram = randomWram(rnd);
  const changes = frozenData(`start ${seed}`, retired);
  for (let n = 0; n < changes.length; n += 2) wram[changes[n]] = changes[n + 1];
  const js = jsWorld(wram, effectStream(seed), stats),
    snapshots = [];
  const finish = (result) => {
    const outcome = { result, snapshots };
    assertFrozenRun(outcome, null, `seed ${seed}`);
    return result;
  };
  snapshots.push(jsSnapshot(js));
  for (let round = 0; round < 12; round++) {
    // Where the JS side stops at a frontier, the original went on to paths no ROM script
    // takes with real natives (unused status returns).
    try {
      js.scheduler.round();
    } catch (error) {
      if (error?.nativeBudget) return finish('native-budget');
      if (error?.taskBoundary) return finish(`frontier:${error.reason}`);
      if (error?.freshRead) return finish(`fresh:${error.freshRead}`);
      throw error;
    }
    snapshots.push(jsSnapshot(js));
  }
  return finish('equal');
}

test('the JS scheduler runs rounds as the register-level scheduler', () => {
  const tally = {},
    stats = {};
  for (let seed = 1; seed <= 300; seed++) {
    const result = scenario(seed, stats);
    tally[result] = (tally[result] ?? 0) + 1;
  }
  // Frontiers the original passes into undefined behaviour: an undefined child result
  // (an empty stack at END), and the last task of the list ending while slot 0 waits for
  // a child (80:C224 reads past the wait table and jumps through stale words). Phase 1
  // found the fresh reads.
  const allowed = (result) =>
    result === 'equal' ||
    result === 'native-budget' ||
    result === 'frontier:script_result_undefined' ||
    result === 'frontier:task_list_end_resume' ||
    result.startsWith('fresh:');
  assert.deepEqual(
    Object.keys(tally).filter((result) => !allowed(result)),
    [],
    JSON.stringify(tally),
  );
  assert.ok(tally.equal > 200, JSON.stringify(tally));
  for (const key of [
    'append',
    'nested-visit',
    'halt',
    'child',
    'child-resume',
    'wait-resume',
    'counter',
    'events',
    'end',
    'release',
  ])
    assert.ok(stats[key] > 0, `${key}: ${JSON.stringify(stats)}`);
});

test('slot and heap exhaustion and re-entry stop at frontiers', () => {
  const stopsWith = (reason, run) =>
    assert.throws(run, (error) => error?.taskBoundary && error.reason === reason, reason);
  const small = STARTABLE.find(({ args }) => args === 0).id;
  // 48 slots, as in the original.
  const scheduler = new Scheduler(new VmMemory(rom, new Uint8Array(0x20000)));
  for (let n = 0; n < TASK_SLOTS; n++) assert.equal(scheduler.append(small), n);
  stopsWith('task_slot_required', () => scheduler.append(small));
  // The conversion layer replays the heap: about 2 KiB of frames.
  const start = randomWram(prng(5)),
    changes = frozenData('exhaustion start', retired);
  for (let n = 0; n < changes.length; n += 2) start[changes[n]] = changes[n + 1];
  const { scheduler: loaded } = loadScheduler(new VmMemory(rom, start.slice()), start);
  const large = STARTABLE.reduce((best, entry) =>
    createTask(scratch, entry.id, new Array(entry.args).fill(0)).frameBytes >
    createTask(scratch, best.id, new Array(best.args).fill(0)).frameBytes
      ? entry
      : best,
  );
  stopsWith('task_heap_required', () => {
    for (let n = 0; n < TASK_SLOTS; n++) loaded.append(large.id, new Array(large.args).fill(0));
  });
  // A native that visits its own task (the head): the first script that calls one.
  const reentered = STARTABLE.some(({ id, args }) => {
    const reentry = new Scheduler(new VmMemory(rom, new Uint8Array(0x20000)), {
      native: (native, values, self) => {
        self.visitHead();
        return 0;
      },
    });
    reentry.append(id, new Array(args).fill(0));
    reentry.cursor = reentry.head;
    try {
      reentry.round();
      return false;
    } catch (error) {
      if (error?.reason === 'task_reentered') return true;
      if (error?.taskBoundary) return false;
      throw error;
    }
  });
  assert.ok(reentered);
});
