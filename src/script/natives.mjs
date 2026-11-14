// Script natives on the JS scheduler (docs/SCRIPT-VM-LIFT.md, phase 3). The bridge
// 80:F4F6 and the resumption 80:F509 of the register-level interpreter, over a JS task:
//
//   F4CB  the argument words go to the direct page words 00.. (args[0] at 00), as the
//         call_native prefix leaves them for the native
//   F4F6  the native runs on the outer stack (S as F378 saved it at 01F2), with D = 0,
//         DBR = 80, A = its pointer, X = 2 * ID and the return word F508 pushed
//   F509  after its RTS the result is the word at 7E:0000 (the scheduler pushes it only
//         when the table 82:D970 says the native has one)
//
// The natives are the lifted modules of the register-level bridge (src/vm/native-call.mjs):
// the admitted natives and the special natives with live devices (src/vm/devices.mjs).
// A native's JSR 80:C1CA (the dialog's topic action, the spell menu) visits the head task
// of the JS scheduler as a nested visit. With a finite work budget the special natives
// with a resumable sequence pause; the scheduler keeps the pending call as the task's
// continuation, and a nested visit inside it pauses with it.
import { taskStop } from '../task/plan.mjs';
import { TaskAccessor } from '../vm/task-accessor.mjs';
import { interruptEventsOf } from '../vm/devices.mjs';
import { SPECIAL_NATIVES, SPECIAL_NATIVE_CONTINUATIONS } from '../vm/special-natives.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../task/native-wait-continuation.mjs';
import { finishInterruptObservations } from '../task/main-wait-interrupt.mjs';
import { NATIVE_POINTERS, NATIVE_RESUME } from '../vm/layout.mjs';
import { WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { CODE_BANK, CODE_BANK_BASE, WRAM_BASE } from '../constants/memory-map.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';

// JSR 80:F52F at F4F6 pushes the return word F508; the native's RTS lands on F509.
const NATIVE_RETURN_WORD = NATIVE_RESUME - 1;
// Scheduler entries a native or the main loop calls with JSR.
export const HEAD_VISIT = 0xc1ca;
export const ROUND = 0xc1e3;
// Stack bytes between the JSR into the scheduler and the task entry F378: the round
// pushes its visit's return and the task's return (C1E3, C1FE); the head visit also
// saves the cursor (C1CA).
const ENTRY_STACK_BYTES = new Map([
  [ROUND, 4],
  [HEAD_VISIT, 6],
]);
// Work units of one resumption of a nested visit (the budget belongs to its natives).
const VISIT_WORK = 1;

const flagsOf = (value) => (value & WORD_SIGN ? FLAG_NEGATIVE : 0) | (value === 0 ? FLAG_ZERO : 0);
const nativeTarget = (mem, id) => CODE_BANK_BASE | mem.read16(NATIVE_POINTERS + 2 * id);

export class ScriptNatives {
  // admitted and implementation: the lifted natives without devices (target -> run);
  // devices: the observation source of the special natives (LiveDevices).
  constructor(mem, { admitted, implementation, devices = null }) {
    this.mem = mem;
    this.admitted = new Set(admitted);
    this.implementation = implementation;
    this.devices = devices;
    // Finite: special natives with a resumable sequence pause at their own limits.
    this.workBudget = Infinity;
    // S at the task entry F378 of the visit that runs now (innermost last).
    this.stacks = [];
    // One accessor per nesting depth of native calls (a nested visit's natives).
    this.accessors = [];
    this.depth = 0;
    this.calls = 0;
    // The scheduler callback: native(id, args, scheduler, slot).
    this.native = (id, args, scheduler, slot) => this.call(id, args, scheduler, slot);
  }

  // A scheduler entry by JSR from code on accessor `a` (the JSR frame is on its stack):
  // the round C1E3 or the head visit C1CA, run to the end; then its RTS.
  visit(a, scheduler, entry) {
    const steps = this.enter(a, scheduler, entry);
    for (;;) if (steps.next().done) return;
  }
  // The same as a resumable continuation of a native sequence (work budget units).
  visitContinuation(a, scheduler, entry) {
    const steps = this.enter(a, scheduler, entry);
    return {
      work: 0,
      result: undefined,
      run(budget) {
        if (!Number.isSafeInteger(budget) || budget < 0) taskStop('script_visit_budget_required');
        this.work += VISIT_WORK;
        if (!steps.next().done) return WAIT_PAUSED;
        this.result = { wait: [], input: [] };
        return WAIT_RETURNED;
      },
    };
  }
  *enter(a, scheduler, entry) {
    const ctx = a.ctx,
      at = entry & WORD_MASK,
      bytes = ENTRY_STACK_BYTES.get(at);
    if (bytes === undefined) taskStop('script_scheduler_entry_unknown', { entry });
    if (ctx.d !== 0) taskStop('script_visit_direct_page', { entry, d: ctx.d });
    this.stacks.push((ctx.s - bytes) & WORD_MASK);
    try {
      yield* at === ROUND ? scheduler.rounds() : scheduler.headVisit();
    } finally {
      this.stacks.pop();
    }
    // C1E3 ends with LDA of the list head, C1CA with PLA of the saved cursor; both set
    // DBR = 80 (PEA 8080, PLB, PLB) and return by RTS.
    const word = (value) => (value < 0 ? WORD_MASK : 2 * value);
    ctx.a = word(at === ROUND ? scheduler.head : scheduler.cursor);
    ctx.status = (ctx.status & ~(FLAG_NEGATIVE | FLAG_ZERO)) | flagsOf(ctx.a);
    ctx.bank = CODE_BANK;
    ctx.pc = (a.pullWord() + 1) & WORD_MASK;
  }

  accessor() {
    const depth = this.depth++;
    if (depth === this.accessors.length) {
      const a = new TaskAccessor({ mem: this.mem });
      a.devices = this.devices;
      this.accessors.push(a);
    }
    return this.accessors[depth];
  }

  // F4F6 to F509 for script native `id` with its argument words.
  call(id, args, scheduler, slot) {
    if (this.stacks.length === 0) taskStop('script_native_outside_visit', { native: id });
    const mem = this.mem,
      target = nativeTarget(mem, id),
      stack = this.stacks[this.stacks.length - 1];
    args.forEach((value, n) => mem.write16(WRAM_BASE + 2 * n, value));
    const a = this.accessor(),
      ctx = a.ctx,
      pointer = target & WORD_MASK;
    a.resetAccessBudget(target);
    Object.assign(ctx, {
      e: 0,
      programBank: CODE_BANK,
      pc: pointer,
      a: pointer,
      x: (2 * id) & WORD_MASK,
      y: scheduler.slots[slot].task.pc,
      s: stack,
      d: 0,
      bank: CODE_BANK,
      status: flagsOf(pointer),
    });
    a.pushWord(NATIVE_RETURN_WORD);
    this.calls++;
    const resumable =
      this.workBudget !== Infinity && !this.admitted.has(target)
        ? SPECIAL_NATIVE_CONTINUATIONS.get(target)
        : undefined;
    try {
      if (resumable) return this.pending(a, target, stack, scheduler, resumable);
      if (this.admitted.has(target)) this.implementation(target)(a, false);
      else this.callSpecial(a, target, scheduler);
      return this.finish(a, target, stack);
    } catch (error) {
      this.depth--;
      throw error;
    }
  }

  // F509: the native returned by RTS to F509 on its entry stack, in the bridge's modes.
  finish(a, target, stack) {
    const ctx = a.ctx;
    this.depth--;
    if (
      ctx.pc !== NATIVE_RESUME ||
      ctx.s !== stack ||
      ctx.d !== 0 ||
      ctx.bank !== CODE_BANK ||
      ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
    )
      taskStop('native_return_context', { target, pc: ctx.pc, s: ctx.s });
    return this.mem.read16(WRAM_BASE);
  }

  options(a, target, scheduler, set, interruptEvents) {
    return {
      waitMode: 'record-observations',
      waitObservations: set.wait,
      inputMode: 'record-observations',
      inputObservations: set.input,
      interruptEvents,
      round: (entry) => {
        if (entry >>> WORD_BITS !== CODE_BANK) taskStop('script_visit_bank', { target, entry });
        this.visit(a, scheduler, entry);
        return { wait: [], input: [] };
      },
      nestedRound: (entry) => {
        if (entry >>> WORD_BITS !== CODE_BANK) taskStop('script_visit_bank', { target, entry });
        return this.visitContinuation(a, scheduler, entry);
      },
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
  closeObservations(a, target, interruptEvents) {
    if (interruptEvents) finishInterruptObservations(interruptEvents);
    if (a.ioIndex !== a.io.length)
      taskStop('device_observation_unused', { target, observationIndex: a.ioIndex });
    a.io = null;
  }

  callSpecial(a, target, scheduler) {
    const set = this.observations(a, target),
      interruptEvents = interruptEventsOf(set, target);
    SPECIAL_NATIVES.get(target)(a, this.options(a, target, scheduler, set, interruptEvents));
    this.closeObservations(a, target, interruptEvents);
  }

  // A special native with a resumable sequence: the first resume() starts it.
  pending(a, target, stack, scheduler, create) {
    const set = this.observations(a, target),
      interruptEvents = interruptEventsOf(set, target),
      made = create(a, this.options(a, target, scheduler, set, interruptEvents)),
      natives = this;
    let ioIndex = 0;
    return {
      target,
      result: null,
      resume() {
        a.io = set.io;
        a.ioIndex = ioIndex;
        let paused;
        try {
          paused = made.continuation.run(natives.workBudget) === WAIT_PAUSED;
        } catch (error) {
          natives.depth--;
          throw error;
        }
        ioIndex = a.ioIndex;
        if (paused) {
          a.io = null;
          return false;
        }
        made.finish();
        natives.closeObservations(a, target, interruptEvents);
        this.result = natives.finish(a, target, stack);
        return true;
      },
    };
  }
}
