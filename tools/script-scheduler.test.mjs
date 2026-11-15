// Differential of the JS scheduler (src/script/scheduler.mjs) against the register-level
// scheduler (proof/vm/scheduler.mjs), docs/SCRIPT-VM-LIFT.md phase 2.
//
// Each scenario starts from random WRAM: the register-level side runs C1A6 and appends
// one to four ROM scripts through C34A; the conversion layer (proof/script/task-layout.mjs)
// reads that state into a JS scheduler. Both sides then run the same rounds (C1E3). The
// wait native (C401) runs inside both schedulers; every other native returns the same
// random result on both sides and may, as natives do in the game, append a task and visit
// it at once (C34A, C1CA, a nested round), send events to a task or toggle its halt bit.
// After every round the native calls (ID and arguments) must match, the projected task
// tables, heap headers and live frame bytes must equal the register-level WRAM, and the
// rest of the WRAM must be equal outside the interpreter's work bytes.
//
// New JS frames start zeroed, the original's hold heap residue: the locals of tasks
// created during a run are compared once written, and a load of an unwritten local ends
// the scenario as a fresh read (phase 1: script DD and seven value-chain sites).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VmMemory } from '../src/vm/memory.mjs';
import { ScriptInterpreter } from '../proof/vm/interpreter.mjs';
import { nativeBridge } from '../proof/vm/native-call.mjs';
import { TaskScheduler, STOP_NATIVE, STOP_RETURNED } from '../proof/vm/scheduler.mjs';
import {
  NATIVE_ARGUMENT_COUNTS,
  TASK_CURSOR,
  TASK_EVENTS,
  TASK_LIST_HEAD,
  TASK_NEXT,
  TASK_WAIT,
} from '../src/vm/layout.mjs';
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
import { loadScheduler } from '../proof/script/task-layout.mjs';

const rom = new Uint8Array(readFileSync(new URL('../Shadowrun (E).smc', import.meta.url)));
const SCRIPT_COUNT = 937;
// Below the game stack top 7E:1CBB (src/task/wram.mjs); scripts write state words above.
const OUTER_S = 0x1c80,
  OUTER_RETURN = 0x9998,
  NESTED_RETURN = 0x9990;
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
const word = (wram, at) => wram[at] | (wram[at + 1] << 8);
const putWord = (wram, at, value) => {
  wram[at] = value & 0xff;
  wram[at + 1] = value >>> 8;
};

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

// --- Register-level side -----------------------------------------------------------

function callOld(vm, entry, onNative) {
  vm.d = 0;
  vm.dbr = 0x80;
  vm.push16(entry === 0xc1e3 || entry === 0xc1a6 ? OUTER_RETURN : NESTED_RETURN);
  const scheduler = new TaskScheduler(vm);
  let stop = scheduler.call(entry);
  while (stop === STOP_NATIVE) {
    onNative(vm);
    stop = scheduler.resume();
  }
  if (stop !== STOP_RETURNED) throw Error(`register-level stop ${stop} at ${vm.pc.toString(16)}`);
}

function oldLiveSlots(wram) {
  const slots = [];
  for (let x = word(wram, TASK_LIST_HEAD); x !== 0xffff; x = word(wram, TASK_NEXT + x))
    slots.push(x >>> 1);
  return slots;
}

function oldWorld(rnd, ids, effects) {
  const wram = new Uint8Array(0x20000);
  for (let n = 0; n < wram.length; n++) wram[n] = rnd() < 0.5 ? 0 : (rnd() * 256) | 0;
  const mem = new VmMemory(rom, wram),
    vm = new ScriptInterpreter(mem),
    world = { mem, vm, wram: mem.wram, log: [], calls: 0, running: [] };
  vm.setContext({ a: 0, x: 0, y: 0, s: OUTER_S, d: 0, bank: 0x80, status: 0 });
  const native = (vm) => {
    const id = vm.x >>> 1,
      args = Array.from({ length: mem.read8(NATIVE_ARGUMENT_COUNTS + id) }, (_, n) =>
        word(world.wram, 2 * n),
      );
    world.log.push([id, ...args]);
    world.running.push(word(world.wram, TASK_CURSOR) >>> 1);
    nativeBridge(vm);
    const effect = effects(world.calls++);
    if (effect.kind === 'append') {
      effect.args.forEach((value, n) => putWord(world.wram, 2 * n, value));
      vm.x = effect.script;
      callOld(vm, 0xc34a, native);
      if (effect.visit) callOld(vm, 0xc1ca, native);
    } else if (effect.kind === 'events') {
      const slot = pick(oldLiveSlots(world.wram), effect.pick);
      if (slot !== NONE)
        putWord(
          world.wram,
          TASK_EVENTS + 2 * slot,
          word(world.wram, TASK_EVENTS + 2 * slot) | effect.bits,
        );
    } else if (effect.kind === 'halt') {
      const slots = oldLiveSlots(world.wram).filter((slot) => !world.running.includes(slot)),
        slot = pick(slots, effect.pick);
      if (slot !== NONE)
        putWord(
          world.wram,
          TASK_WAIT + 2 * slot,
          word(world.wram, TASK_WAIT + 2 * slot) ^ WAIT_HALTED,
        );
    }
    world.running.pop();
    putWord(world.wram, 0, effect.result);
    vm.d = 0;
    vm.dbr = 0x80;
    vm.pc = (vm.pull16() + 1) & 0xffff;
  };
  world.round = () => {
    vm.s = OUTER_S;
    callOld(vm, 0xc1e3, native);
  };
  vm.s = OUTER_S;
  callOld(vm, 0xc1a6, native);
  for (const id of ids) {
    vm.s = OUTER_S;
    vm.x = id;
    callOld(vm, 0xc34a, native);
  }
  putWord(world.wram, TASK_CURSOR, word(world.wram, TASK_LIST_HEAD));
  return world;
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

// --- Comparison --------------------------------------------------------------------

const inside = (n, [start, end]) => n >= start && n < end;
function compareWorlds(old, js, label) {
  assert.deepEqual(js.log, old.log, `${label}: native calls`);
  for (const [at, value] of js.project())
    if (old.wram[at] !== value)
      throw Error(
        `${label}: WRAM 7E:${at.toString(16)} register-level ${old.wram[at]}, JS ${value}`,
      );
  for (let n = 0; n < old.wram.length; n++)
    if (
      old.wram[n] !== js.mem.wram[n] &&
      !inside(n, SCHEDULER_BYTES) &&
      !WORK_BYTES.some((range) => inside(n, range))
    )
      throw Error(
        `${label}: WRAM 7E:${n.toString(16)} register-level ${old.wram[n]}, JS ${js.mem.wram[n]}`,
      );
}

// One scenario: rounds until a frontier, a fresh read or the native budget.
function scenario(seed, stats) {
  const rnd = prng(seed),
    ids = Array.from(
      { length: 1 + ((rnd() * 4) | 0) },
      () => STARTABLE[(rnd() * STARTABLE.length) | 0].id,
    ),
    old = oldWorld(rnd, ids, effectStream(seed)),
    js = jsWorld(old.wram, effectStream(seed), stats);
  compareWorlds(old, js, `seed ${seed} start`);
  for (let round = 0; round < 12; round++) {
    // The JS side first: where it stops at a frontier, the original goes on to paths no
    // ROM script takes with real natives (unused status returns).
    try {
      js.scheduler.round();
    } catch (error) {
      if (error?.nativeBudget) return 'native-budget';
      if (error?.taskBoundary) return `frontier:${error.reason}`;
      if (error?.freshRead) return `fresh:${error.freshRead}`;
      throw error;
    }
    old.round();
    compareWorlds(old, js, `seed ${seed} round ${round}`);
  }
  return 'equal';
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
  const world = oldWorld(prng(5), [], effectStream(5)),
    { scheduler: loaded } = loadScheduler(new VmMemory(rom, world.wram.slice()), world.wram);
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
