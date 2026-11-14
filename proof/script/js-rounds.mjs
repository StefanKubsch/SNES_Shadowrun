// The live game's scheduler rounds on the JS scheduler with the natives of
// src/script/natives.mjs (docs/SCRIPT-VM-LIFT.md, phase 3), for the differential of
// tools/script-natives.test.mjs. Until phase 4 the rest of the game still keeps the task
// tables and the heap in WRAM, so every round goes through the conversion layer:
//
// - each round (the driver's C1E3 after the main interval, the owner's 96C0) loads the
//   JS scheduler from the WRAM and stores its projection back at the end;
// - before each native the projection is stored, so register-level code inside the native
//   (the task append C34A, object creation, the halt natives, task cursor reads) sees the
//   tables; when the native changed the tables or the heap, they are read back in place
//   (tasks whose frames are unchanged keep their JS objects), also before a nested visit.
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
  MIRROR_BANK_MASK,
  WRAM_BANK,
} from '../../src/constants/memory-map.mjs';
import { HEX_RADIX, WORD_BITS, WORD_MASK } from '../../src/constants/bits.mjs';

// The task tables, scheduler work words and the heap (layout.mjs).
export const SCHEDULER_BYTES = Object.freeze([0x0246, 0x0cc2]);

const isIndex = (key) => typeof key === 'string' && /^\d+$/.test(key);
const sameWords = (a, b) => a.length === b.length && a.every((value, n) => value === b[n]);

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
    // Rounds by entry path: the driver's C1E3 and the owner's resumable 96C0.
    paths: { driver: 0, owner: 0 },
    // Native target -> number of calls that changed the task tables or the heap.
    tableNatives: new Map(),
    projection: new Map(),
  };
  // Written local indexes per slot ({frame, code, written}), across rounds. A frame word
  // written by register-level code (80:C2C8 from an append outside the JS scheduler)
  // starts a new task in the slot; the layout's store writes the WRAM directly.
  const marks = new Map(),
    tracked = new WeakMap(),
    write8 = mem.write8.bind(mem);
  mem.write8 = (address, value) => {
    const offset = address & WORD_MASK,
      bank = address >>> WORD_BITS;
    if (
      offset >= TASK_FRAME &&
      offset < TASK_FRAME + 2 * TASK_SLOTS &&
      (bank === WRAM_BANK || (bank & MIRROR_BANK_MASK) < BANK_WITHOUT_IO)
    )
      marks.delete((offset - TASK_FRAME) >>> 1);
    write8(address, value);
  };
  let layout = null,
    snapshot = null;

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
    snapshot = wram.slice(...SCHEDULER_BYTES);
  }
  const changed = () => {
    const [start, end] = SCHEDULER_BYTES;
    for (let n = start; n < end; n++) if (wram[n] !== snapshot[n - start]) return true;
    return false;
  };
  // A task object stays when register-level code left its frame unchanged.
  function keep(slot, old, read) {
    const { written, raw } = tracked.get(old);
    if (
      old.code !== read.code ||
      old.pc !== read.pc ||
      !sameWords(old.stack, read.stack) ||
      !sameWords(old.returns, read.returns) ||
      [...written].some((n) => raw[n] !== read.locals[n])
    )
      throw Error(`register-level code changed the frame of slot ${slot}`);
    return true;
  }
  function syncIn(target) {
    if (!changed()) return;
    state.tableNatives.set(target, (state.tableNatives.get(target) ?? 0) + 1);
    layout.reload(keep);
    trackLive();
  }

  const native = (id, args, scheduler, slot) => {
    store();
    state.calls++;
    const target = CODE_BANK_BASE | mem.read16(NATIVE_POINTERS + 2 * id),
      result = natives.native(id, args, scheduler, slot);
    if (!isPendingNative(result)) {
      syncIn(target);
      return result;
    }
    return {
      get result() {
        return result.result;
      },
      resume() {
        const done = result.resume();
        if (done) syncIn(target);
        else state.pauses++;
        return done;
      },
    };
  };

  function begin() {
    layout = loadScheduler(mem, wram, {
      native,
      onCreate: (slot, task) => track(slot, task, true),
    });
    trackLive();
    const scheduler = layout.scheduler,
      headVisit = scheduler.headVisit.bind(scheduler),
      release = scheduler.release.bind(scheduler);
    scheduler.release = (slot) => {
      marks.delete(slot);
      release(slot);
    };
    scheduler.headVisit = function* () {
      state.visits++;
      syncIn('visit');
      yield* headVisit();
      store();
    };
    return scheduler;
  }
  function end() {
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
