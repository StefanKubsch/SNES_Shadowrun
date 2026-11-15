// The task state of a live game on the plain game loop (src/script/game-loop.mjs,
// docs/SCRIPT-VM-LIFT.md phase 5) as the original's task tables, heap and frames, for the
// differential of tools/script-natives.test.mjs against the register-level loop
// (proof/script/register-level-loop.mjs):
//
// - the conversion layer follows the game's JS scheduler from the start and replays the
//   original heap allocation (proof/script/task-layout.mjs followScheduler);
// - the game keeps no task tables or heap in WRAM: any read or write of 7E:0246-0CC1
//   through the memory stops with RegisterLevelTaskAccess;
// - locals are tracked per task: only written locals are projected, and a load of an
//   unwritten local stops as a fresh read (the original would read heap residue).
import { followScheduler } from './task-layout.mjs';
import { nativeTarget } from '../../src/script/natives.mjs';
import { isPendingNative } from '../../src/script/scheduler.mjs';
import {
  BANK_WITHOUT_IO,
  LOW_RAM_END,
  MIRROR_BANK_MASK,
  WRAM_BANK,
} from '../../src/constants/memory-map.mjs';
import { HEX_RADIX, WORD_BITS, WORD_MASK } from '../../src/constants/bits.mjs';

// The task tables, scheduler work words and the heap (src/vm/layout.mjs).
export const SCHEDULER_BYTES = Object.freeze([0x0246, 0x0cc2]);

const isIndex = (key) => typeof key === 'string' && /^\d+$/.test(key);

// Code read or wrote a task table or heap byte of the original layout.
export class RegisterLevelTaskAccess extends Error {
  constructor(kind, offset, target) {
    const native = target === null ? 'outside a native' : `in native ${target.toString(HEX_RADIX)}`;
    super(`register-level task ${kind} at 7E:${offset.toString(HEX_RADIX)} ${native}`);
  }
}

export class FreshLocalRead extends Error {
  constructor(task) {
    super(`fresh local read: script ${task.script.toString(HEX_RADIX)} at ${task.pc}`);
  }
}

// Attaches to a LiveGame on the plain game loop; returns the statistics and project(),
// the live bytes of the original layout for the current task state.
export function followLiveTasks(game) {
  const mem = game.memory,
    loop = game.loop,
    scheduler = loop.scheduler;
  // The native's target while it runs (nested natives restore the outer one).
  let target = null,
    roundCalls = 0;
  const state = {
    calls: 0,
    pauses: 0,
    visits: 0,
    // Tasks appended through the task API inside a native, by native target.
    appends: new Map(),
    // Rounds by entry path: the main loop's C1E3 and the owner's 96C0 (attract demo).
    get paths() {
      return { driver: loop.rounds, owner: roundCalls - loop.rounds };
    },
    project: () => layout.project({ includeLocal }),
  };

  // The trap on the original's task bytes.
  const read8 = mem.read8.bind(mem),
    write8 = mem.write8.bind(mem);
  const wramOffset = (address) => {
    const offset = address & WORD_MASK,
      bank = address >>> WORD_BITS;
    if (bank === WRAM_BANK) return offset;
    return (bank & MIRROR_BANK_MASK) < BANK_WITHOUT_IO && offset < LOW_RAM_END ? offset : -1;
  };
  function guard(address, kind) {
    const offset = wramOffset(address);
    if (offset >= SCHEDULER_BYTES[0] && offset < SCHEDULER_BYTES[1])
      throw new RegisterLevelTaskAccess(kind, offset, target);
  }
  mem.read8 = (address) => {
    guard(address, 'read');
    return read8(address);
  };
  mem.write8 = (address, value) => {
    guard(address, 'write');
    write8(address, value);
  };

  // Written local indexes per task.
  const written = new WeakMap();
  function track(slot, task) {
    const indexes = new Set(),
      raw = task.locals;
    task.locals = new Proxy(raw, {
      get(target, key) {
        if (isIndex(key) && !indexes.has(Number(key))) throw new FreshLocalRead(task);
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, key, value) {
        target[key] = value;
        if (isIndex(key)) indexes.add(Number(key));
        return true;
      },
    });
    written.set(task, indexes);
  }
  const includeLocal = (task, n) => written.get(task)?.has(n) ?? true;
  const layout = followScheduler(scheduler, { onCreate: track });

  const native = scheduler.native;
  scheduler.native = (id, args, ...rest) => {
    state.calls++;
    const outer = target,
      own = nativeTarget(mem, id);
    const run = (step) => {
      target = own;
      try {
        return step();
      } finally {
        target = outer;
      }
    };
    const result = run(() => native(id, args, ...rest));
    if (!isPendingNative(result)) return result;
    return {
      get result() {
        return result.result;
      },
      resume() {
        const done = run(() => result.resume());
        if (!done) state.pauses++;
        return done;
      },
    };
  };
  const append = scheduler.append.bind(scheduler),
    headVisit = scheduler.headVisit.bind(scheduler),
    round = loop.round.bind(loop);
  scheduler.append = (script, args) => {
    if (target !== null) state.appends.set(target, (state.appends.get(target) ?? 0) + 1);
    return append(script, args);
  };
  scheduler.headVisit = function* () {
    state.visits++;
    yield* headVisit();
  };
  loop.round = (entry) => {
    roundCalls++;
    return round(entry);
  };
  return state;
}
