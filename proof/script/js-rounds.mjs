// The live game's scheduler rounds on the JS scheduler with the natives of
// src/script/natives.mjs (docs/SCRIPT-VM-LIFT.md, phases 3 and 4), for the differential
// of tools/script-natives.test.mjs. Until the plain game loop (phase 5) the main loop
// still keeps the task tables and the heap in WRAM between rounds, so every round goes
// through the conversion layer:
//
// - each round (the driver's C1E3 after the main interval, the owner's 96C0) loads the
//   JS scheduler from the WRAM and stores its projection back at the end;
// - game code inside the round's natives reaches the tasks through the task API on the
//   JS scheduler (src/script/task-api.mjs); a read or write of the task tables or the
//   heap through the memory while a round is open (also while it is paused) stops with
//   RegisterLevelTaskAccess;
// - sync() stores the projection of an open round, for a comparison at an NMI.
//
// Locals of a task are tracked per frame: only written locals are projected, and a load
// of an unwritten local stops as a fresh read (the original would read heap residue).
import { loadScheduler } from './task-layout.mjs';
import { taskStop } from '../../src/task/plan.mjs';
import { ScriptNatives } from '../../src/script/natives.mjs';
import { isPendingNative, NONE, TASK_SLOTS } from '../../src/script/scheduler.mjs';
import { TaskAccessor, vmToContext, contextToVm } from '../../src/vm/task-accessor.mjs';
import { STOP_NATIVE_WAIT, STOP_RETURNED } from '../../src/vm/scheduler.mjs';
import { NATIVE_POINTERS, TASK_FRAME } from '../../src/vm/layout.mjs';
import { nativeOpcodeTargets } from '../../src/task/native-opcode-targets.mjs';
import { nativeTarget } from '../../src/task/native-targets.mjs';
import {
  BANK_WITHOUT_IO,
  CODE_BANK,
  CODE_BANK_BASE,
  LOW_RAM_END,
  MIRROR_BANK_MASK,
  WRAM_BANK,
} from '../../src/constants/memory-map.mjs';
import { BYTE_BITS, HEX_RADIX, WORD_BITS, WORD_MASK } from '../../src/constants/bits.mjs';

// The task tables, scheduler work words and the heap (layout.mjs).
export const SCHEDULER_BYTES = Object.freeze([0x0246, 0x0cc2]);

const isIndex = (key) => typeof key === 'string' && /^\d+$/.test(key);

// Register-level code read or wrote a task table or heap byte while a round was open.
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

// Attaches the JS rounds to a LiveGame (src/video/live-game.mjs); returns the statistics
// and the bytes of the last stored projection. synchronous: the natives never pause
// (the bridge's synchronous special natives), whatever budget the driver gives.
export function attachJsRounds(game, { synchronous = false } = {}) {
  const mem = game.memory,
    wram = mem.wram,
    vm = game.vm,
    natives = new ScriptNatives(mem, {
      admitted: nativeOpcodeTargets,
      implementation: nativeTarget,
      devices: game.devices,
    });
  const state = {
    natives,
    rounds: 0,
    calls: 0,
    pauses: 0,
    visits: 0,
    // Tasks game code appended through the task API inside a round, by native target.
    appends: new Map(),
    // Rounds by entry path: the driver's C1E3 and the owner's resumable 96C0.
    paths: { driver: 0, owner: 0 },
    projection: new Map(),
    sync() {
      if (open) store();
    },
  };
  // Written local indexes per slot ({frame, code, written}), across rounds. A frame word
  // written by register-level code between rounds (80:C2C8 from an append on the WRAM
  // tables) starts a new task in the slot; the layout's store writes the WRAM directly.
  const marks = new Map(),
    tracked = new WeakMap(),
    read8 = mem.read8.bind(mem),
    write8 = mem.write8.bind(mem);
  // The WRAM offset of a CPU address in bank 7E or a mirror of its first 8 KiB, else -1.
  const wramOffset = (address) => {
    const offset = address & WORD_MASK,
      bank = address >>> WORD_BITS;
    if (bank === WRAM_BANK) return offset;
    return (bank & MIRROR_BANK_MASK) < BANK_WITHOUT_IO && offset < LOW_RAM_END ? offset : -1;
  };
  const isTaskByte = (offset) => offset >= SCHEDULER_BYTES[0] && offset < SCHEDULER_BYTES[1];
  function guard(address, kind) {
    const offset = wramOffset(address);
    if (open && isTaskByte(offset)) throw new RegisterLevelTaskAccess(kind, offset, target);
    return offset;
  }
  mem.read8 = (address) => {
    guard(address, 'read');
    return read8(address);
  };
  mem.write8 = (address, value) => {
    const offset = guard(address, 'write');
    if (offset >= TASK_FRAME && offset < TASK_FRAME + 2 * TASK_SLOTS)
      marks.delete((offset - TASK_FRAME) >>> 1);
    write8(address, value);
  };
  let layout = null,
    open = false,
    target = null;

  function track(slot, task, created) {
    const frame = layout.frames[slot],
      known = marks.get(slot);
    if (created || known?.frame !== frame || known.code !== task.code)
      marks.set(slot, { frame, code: task.code, written: new Set() });
    const { written } = marks.get(slot),
      raw = task.locals;
    task.locals = new Proxy(raw, {
      get(target, key) {
        if (isIndex(key) && !written.has(Number(key))) throw new FreshLocalRead(task);
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, key, value) {
        target[key] = value;
        if (isIndex(key)) written.add(Number(key));
        return true;
      },
    });
    tracked.set(task, { written, raw });
  }
  const trackLive = () => {
    const { scheduler } = layout;
    for (let slot = scheduler.head; slot !== NONE; slot = scheduler.slots[slot].next) {
      const task = scheduler.slots[slot].task;
      if (!tracked.has(task)) track(slot, task, false);
    }
  };
  const includeLocal = (task, n) => tracked.get(task)?.written.has(n) ?? true;

  function store() {
    state.projection = layout.store({ includeLocal });
  }

  // The native's target while it runs (nested natives restore the outer one).
  const native = (id, args, scheduler, slot) => {
    state.calls++;
    const outer = target,
      own = CODE_BANK_BASE | read16(NATIVE_POINTERS + 2 * id);
    const run = (step) => {
      target = own;
      try {
        return step();
      } finally {
        target = outer;
      }
    };
    const result = run(() => natives.native(id, args, scheduler, slot));
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
  const read16 = (address) => read8(address) | (read8(address + 1) << BYTE_BITS);

  function begin() {
    layout = loadScheduler(mem, wram, {
      native,
      onCreate: (slot, task) => track(slot, task, true),
    });
    trackLive();
    const scheduler = layout.scheduler,
      headVisit = scheduler.headVisit.bind(scheduler),
      append = scheduler.append.bind(scheduler),
      release = scheduler.release.bind(scheduler);
    scheduler.release = (slot) => {
      marks.delete(slot);
      release(slot);
    };
    scheduler.append = (script, args) => {
      state.appends.set(target, (state.appends.get(target) ?? 0) + 1);
      return append(script, args);
    };
    scheduler.headVisit = function* () {
      state.visits++;
      yield* headVisit();
    };
    open = true;
    return scheduler;
  }
  function end() {
    open = false;
    store();
    state.rounds++;
  }

  // A round by JSR from the VM's registers (the JSR frame is on the VM stack).
  const scratch = new TaskAccessor({ mem });
  function vmRound(entry) {
    vmToContext(vm, scratch.ctx);
    scratch.ctx.programBank = CODE_BANK;
    return natives.enter(scratch, begin(), entry);
  }
  function vmReturn() {
    end();
    contextToVm(scratch.ctx, vm);
    vm.pc = scratch.ctx.pc;
  }

  // The driver's round after the main interval (MainLoopDriver.beginRound): the opcode
  // budget has no meaning for the JS round; the native work budget pauses it.
  let job = null;
  game.driver.scheduler = {
    opcodesRun: 0,
    call(entry, budget) {
      state.paths.driver++;
      job = vmRound(entry);
      return this.resume(budget);
    },
    resume() {
      if (!synchronous) natives.workBudget = vm.natives.workBudget;
      try {
        if (!job.next().done) return STOP_NATIVE_WAIT;
      } finally {
        natives.workBudget = Infinity;
      }
      job = null;
      vmReturn();
      return STOP_RETURNED;
    },
  };
  // The owner's round 96C0 (src/task/main-frontend.mjs), synchronous or resumable.
  // The live game's owner rounds are resumable (lag-free frames); a synchronous one would
  // need observations the live game does not have.
  vm.natives.rounds = (entry) => taskStop('js_rounds_synchronous_owner', { entry });
  vm.natives.nestedRound = (entry) => {
    state.paths.owner++;
    const a = vm.natives.accessor,
      visit = natives.visitContinuation(a, begin(), entry);
    return {
      get work() {
        return visit.work;
      },
      get result() {
        return visit.result;
      },
      run(budget) {
        if (!synchronous) natives.workBudget = budget;
        try {
          const status = visit.run(budget);
          if (visit.result !== undefined) end();
          return status;
        } finally {
          natives.workBudget = Infinity;
        }
      },
    };
  };
  return state;
}
