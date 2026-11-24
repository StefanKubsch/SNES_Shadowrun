// Script natives on the JS scheduler (docs/SCRIPT-VM-LIFT.md, phase 3). The bridge
// 80:F4F6 and the resumption 80:F509 of the register-level interpreter, over a JS task:
//
//   F4CB  the argument words go to the direct page words 00.. (args[0] at 00), as the
//         call_native prefix leaves them for the native
//   F4F6  admitted synchronous natives receive ordinary game services and bank 80.
//         Waiting live natives use the same services, with one per nesting depth.
//   F509  the result is the word at 7E:0000 (the scheduler pushes it only
//         when the table 82:D970 says the native has one)
//
// The natives are the lifted modules of the register-level bridge (proof/vm/native-call.mjs):
// the admitted natives and the special natives with live devices (src/vm/devices.mjs).
// A native's JSR 80:C1CA (the dialog's topic action, the spell menu) visits the head task
// of the JS scheduler as a nested visit. With a finite work budget the special natives
// with a resumable sequence pause; the scheduler keeps the pending call as the task's
// continuation, and a nested visit inside it pauses with it.
import { taskStop } from '../system/task-stop.mjs';
import { DeviceAccess } from '../vm/device-access.mjs';
import { TaskAccessor } from '../vm/task-accessor.mjs';
import { JsTasks } from './task-api.mjs';
import { interruptEventsOf } from '../vm/devices.mjs';
import {
  DEVICE_NATIVE_LEAVES,
  SPECIAL_NATIVES,
  SPECIAL_NATIVE_CONTINUATIONS,
} from '../vm/special-natives.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../system/native-wait-continuation.mjs';
import { NATIVE_POINTERS } from '../vm/layout.mjs';
import { WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { CODE_BANK, CODE_BANK_BASE, WRAM_BASE } from '../constants/memory-map.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// Original scheduler entry names used by the remaining callback interface.
export const HEAD_VISIT = 0xc1ca;
export const ROUND = 0xc1e3;
// Work units of one resumption of a nested visit (the budget belongs to its natives).
const VISIT_WORK = 1;

const flagsOf = (value) => (value & WORD_SIGN ? FLAG_NEGATIVE : 0) | (value === 0 ? FLAG_ZERO : 0);
export const nativeTarget = (mem, id) => CODE_BANK_BASE | mem.read16(NATIVE_POINTERS + 2 * id);

export class ScriptNatives {
  // admitted and implementation: the lifted natives without devices (target -> run);
  // devices: the observation source of the special natives (LiveDevices); host: the
  // game's settings as the natives' accessors see them (a.vm: gameplay, cheats).
  constructor(
    mem,
    { admitted, implementation, devices = null, host = { mem }, valueServices = false },
  ) {
    this.mem = mem;
    this.host = host;
    this.admitted = new Set(admitted);
    this.implementation = implementation;
    this.devices = devices;
    this.valueServices = valueServices;
    // Finite: special natives with a resumable sequence pause at their own limits.
    this.workBudget = Infinity;
    // Recorded interrupt adapters alone borrow CPU workspace (innermost last).
    this.stacks = [];
    // One accessor per nesting depth of native calls (a nested visit's natives).
    this.accessors = [];
    this.services = [];
    this.depth = 0;
    // Synchronous lifted leaves need only game services, never CPU registers.
    this.leaf = new DeviceAccess(host);
    Object.assign(this.leaf, { dataBank: CODE_BANK, valueReturn: true, devices });
    this.calls = 0;
    // The scheduler callback: native(id, args, scheduler, slot).
    this.native = (id, args, scheduler, slot) => this.call(id, args, scheduler, slot);
  }

  // A nested scheduler visit borrows workspace but returns through its generator.
  visit(a, scheduler, entry) {
    const steps = this.enter(a, scheduler, entry);
    for (;;) if (steps.next().done) return;
  }
  // The same as a resumable continuation of a native sequence (work budget units).
  visitContinuation(a, scheduler, entry) {
    return this.continuation(this.enter(a, scheduler, entry));
  }

  // Normal game and attract rounds have no CPU workspace. Recorded callers
  // retain the explicit workspace parameter of their compatibility adapter.
  roundContinuation(scheduler, workspace) {
    return this.continuation(
      this.valueServices ? scheduler.rounds() : this.roundSteps(scheduler, workspace),
    );
  }
  headContinuation(scheduler) {
    return this.continuation(scheduler.headVisit());
  }
  *roundSteps(scheduler, workspace, entry = ROUND) {
    this.stacks.push(workspace);
    try {
      yield* entry === ROUND ? scheduler.rounds() : scheduler.headVisit();
    } finally {
      this.stacks.pop();
    }
    return { wait: [], input: [] };
  }

  continuation(steps) {
    let running = false,
      done = false,
      failed = false;
    return {
      work: 0,
      result: undefined,
      run(budget) {
        if (!Number.isSafeInteger(budget) || budget < 0) taskStop('script_visit_budget_required');
        if (running) taskStop('script_visit_reentry');
        if (failed) taskStop('script_visit_failed');
        if (done) return WAIT_RETURNED;
        if (budget === 0) return WAIT_PAUSED;
        running = true;
        try {
          this.work += VISIT_WORK;
          const next = steps.next();
          if (!next.done) return WAIT_PAUSED;
          this.result = next.value ?? { wait: [], input: [] };
          done = true;
          return WAIT_RETURNED;
        } catch (error) {
          failed = true;
          throw error;
        } finally {
          running = false;
        }
      },
    };
  }
  *enter(a, scheduler, entry) {
    const at = entry & WORD_MASK;
    if (at !== ROUND && at !== HEAD_VISIT) taskStop('script_scheduler_entry_unknown', { entry });
    if (this.valueServices) {
      yield* at === ROUND ? scheduler.rounds() : scheduler.headVisit();
      return { wait: [], input: [] };
    }
    return yield* this.roundSteps(scheduler, a.ctx.s, at);
  }

  accessor() {
    const depth = this.depth++;
    if (depth === this.accessors.length) {
      const a = new TaskAccessor(this.host);
      a.devices = this.devices;
      this.accessors.push(a);
    }
    return this.accessors[depth];
  }

  // A waiting live native owns only game services, reused at its nesting depth.
  service() {
    const depth = this.depth++;
    if (depth === this.services.length) {
      const a = new DeviceAccess(this.host);
      Object.assign(a, { dataBank: CODE_BANK, valueReturn: true, devices: this.devices });
      this.services.push(a);
    }
    return this.services[depth];
  }

  // F4F6 to F509 for script native `id` with its argument words.
  call(id, args, scheduler, slot) {
    const mem = this.mem,
      target = nativeTarget(mem, id);
    args.forEach((value, n) => mem.write16(WRAM_BASE + 2 * n, value));
    if (this.admitted.has(target)) {
      this.leaf.tasks = scheduler.tasks ??= new JsTasks(scheduler);
      this.calls++;
      this.implementation(target)(this.leaf, false);
      return mem.read16(WRAM_BASE);
    }
    const deviceLeaf = DEVICE_NATIVE_LEAVES.get(target);
    if (deviceLeaf) {
      const a = this.leaf;
      this.observations(a, target);
      this.calls++;
      try {
        deviceLeaf(a, false);
        this.closeObservations(a, target);
        return mem.read16(WRAM_BASE);
      } finally {
        a.io = null;
      }
    }
    if (!this.valueServices && this.stacks.length === 0)
      taskStop('script_native_outside_visit', { native: id });
    const a = this.valueServices ? this.service() : this.accessor();
    // Game code inside the native reaches the tasks through the task API.
    a.tasks = scheduler.tasks ??= new JsTasks(scheduler);
    a.resetAccessBudget?.(target);
    if (!this.valueServices) {
      const pointer = target & WORD_MASK;
      Object.assign(a.ctx, {
        e: 0,
        programBank: CODE_BANK,
        pc: pointer,
        a: pointer,
        x: (2 * id) & WORD_MASK,
        y: scheduler.slots[slot].task.pc,
        s: this.stacks[this.stacks.length - 1],
        d: 0,
        bank: CODE_BANK,
        status: flagsOf(pointer),
      });
    }
    this.calls++;
    const resumable =
      this.workBudget !== Infinity && !this.admitted.has(target)
        ? SPECIAL_NATIVE_CONTINUATIONS.get(target)
        : undefined;
    try {
      if (resumable) return this.pending(a, target, scheduler, resumable);
      this.callSpecial(a, target, scheduler);
      return this.finish();
    } catch (error) {
      a.io = null;
      this.depth--;
      throw error;
    }
  }

  // Both service and recorded calls consume only the shared result word here.
  finish() {
    const result = this.mem.read16(WRAM_BASE);
    this.depth--;
    return result;
  }

  options(a, target, scheduler, set, interruptEvents) {
    return {
      valueReturn: true,
      valueServices: this.valueServices,
      valueRounds: true,
      waitMode: 'record-observations',
      waitObservations: set.wait,
      inputMode: 'record-observations',
      inputObservations: set.input,
      interruptEvents,
      ...(this.valueServices
        ? {
            headVisit: () => {
              scheduler.visitHead();
              return { wait: [], input: [] };
            },
            nestedHeadVisit: () => this.headContinuation(scheduler),
          }
        : {
            round: (entry) => {
              if (entry >>> WORD_BITS !== CODE_BANK)
                taskStop('script_visit_bank', { target, entry });
              this.visit(a, scheduler, entry);
              return { wait: [], input: [] };
            },
            nestedRound: (entry) => {
              if (entry >>> WORD_BITS !== CODE_BANK)
                taskStop('script_visit_bank', { target, entry });
              return this.visitContinuation(a, scheduler, entry);
            },
          }),
    };
  }

  observations(a, target) {
    if (this.devices === null || !SPECIAL_NATIVES.has(target))
      taskStop('script_native_unimplemented', { target });
    const set = this.devices.take(target);
    a.io = set.io;
    a.ioIndex = 0;
    return set;
  }
  // The end-of-native checks of the observation set.
  closeObservations(a, target) {
    if (a.ioIndex !== a.io.length)
      taskStop('device_observation_unused', { target, observationIndex: a.ioIndex });
    a.io = null;
  }

  callSpecial(a, target, scheduler) {
    const set = this.observations(a, target),
      interruptEvents = interruptEventsOf(set, target);
    SPECIAL_NATIVES.get(target)(a, this.options(a, target, scheduler, set, interruptEvents));
    this.closeObservations(a, target);
  }

  // A special native with a resumable sequence: the first resume() starts it.
  pending(a, target, scheduler, create) {
    const set = this.observations(a, target),
      interruptEvents = interruptEventsOf(set, target),
      made = create(a, this.options(a, target, scheduler, set, interruptEvents)),
      natives = this;
    let ioIndex = 0,
      running = false,
      done = false,
      failed = false;
    a.io = null;
    return {
      target,
      result: null,
      resume() {
        if (running) taskStop('script_native_reentry', { target });
        if (failed) taskStop('script_native_failed', { target });
        if (done) return true;
        running = true;
        a.io = set.io;
        a.ioIndex = ioIndex;
        try {
          const paused = made.continuation.run(natives.workBudget) === WAIT_PAUSED;
          ioIndex = a.ioIndex;
          if (paused) return false;
          made.finish();
          natives.closeObservations(a, target);
          this.result = natives.finish();
          done = true;
          return true;
        } catch (error) {
          failed = true;
          natives.depth--;
          throw error;
        } finally {
          running = false;
          a.io = null;
        }
      },
    };
  }
}
