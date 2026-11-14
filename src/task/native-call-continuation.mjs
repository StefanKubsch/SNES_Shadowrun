import { taskStop } from './plan.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from './native-wait-continuation.mjs';
import { WORD_MASK, WORD_BITS } from '../constants/bits.mjs';

export const JSR_RETURN_OFFSET = 2,
  JSL_RETURN_OFFSET = 3;

const registers = ['e', 'programBank', 'pc', 'a', 'x', 'y', 's', 'd', 'bank', 'status'];
// Implementations register their own fixed equations. This neutral module
// must never import a callback graph: that would pull scene tables into wait
// adapters before their existing cyclic module graph has initialized.
export const NATIVE_CALL_CONTINUATIONS = new Map();

// Cooperative composition of fixed native equations. A yielded function is
// one bounded caller segment; a call descriptor owns a genuine stack frame.
// Factories are admitted by target AND function identity, so injected routines
// are never silently replaced. This class neither decodes nor times CPU code.
export class NativeCallContinuation {
  constructor(a, sequence, continuations = NATIVE_CALL_CONTINUATIONS) {
    this.a = a;
    this.context = a.ctx;
    this.sequence = sequence;
    this.continuations = continuations;
    this.saved = registers.map((key) => a.ctx[key]);
    this.work = 0;
    this.done = false;
    this.failed = false;
    this.current = null;
    this.child = null;
  }
  run(budget) {
    if (!Number.isSafeInteger(budget) || budget < 0) taskStop('native_call_budget_required');
    if (this.failed) taskStop('native_call_failed');
    if (
      this.a.ctx !== this.context ||
      registers.some((key, n) => this.context[key] !== this.saved[n])
    )
      taskStop('native_call_owner_required');
    try {
      while (budget > 0 && !this.done) {
        if (!this.current) {
          const next = this.sequence.next(this.reply);
          this.reply = undefined;
          if (next.done) {
            this.done = true;
            this.result = next.value;
            break;
          }
          this.current = next.value;
          if (this.current.continuation) this.child = this.current.continuation;
          else if (typeof this.current !== 'function') {
            // A factory is registered by target, or by its run function when
            // another implementation of the same target exists (proof references).
            const factory = this.continuations.get(this.current.target);
            if (factory?.run === this.current.run) this.child = factory.create(this.current);
            else
              this.child = this.continuations.get(this.current.run)?.create(this.current) ?? null;
          }
        }
        if (this.child) {
          const before = this.child.work,
            status = this.child.run(budget),
            used = this.child.work - before;
          budget -= used;
          this.work += used;
          if (status === WAIT_PAUSED) break;
          this.reply = this.child.result;
          this.child = null;
        } else {
          const action = this.current;
          this.reply =
            typeof action === 'function'
              ? action()
              : action.run(action.h, action.events, action.routines);
          budget--;
          this.work++;
        }
        this.current = null;
      }
    } catch (error) {
      this.failed = true;
      throw error;
    } finally {
      for (let n = 0; n < registers.length; n++) this.saved[n] = this.context[registers[n]];
    }
    return this.done ? WAIT_RETURNED : WAIT_PAUSED;
  }
}

// A scheduler special native: its observed sequence plus the unchanged
// end-of-native observation checks, applied only after the real return.
export function observedContinuation(a, { sequence, finish }) {
  const continuation = new NativeCallContinuation(a, sequence);
  return { continuation, finish: () => finish(continuation.result) };
}

export function drainNativeSequence(sequence) {
  let reply;
  for (let next = sequence.next(); ; next = sequence.next(reply)) {
    if (next.done) return next.value;
    const action = next.value;
    if (action.continuation) {
      while (action.continuation.run(Number.MAX_SAFE_INTEGER) === WAIT_PAUSED) {}
      reply = action.continuation.result;
    } else
      reply =
        typeof action === 'function'
          ? action()
          : action.run(action.h, action.events, action.routines);
  }
}

// The frame is built only when the original call is reached. Validation reads
// the actual callee result after all pauses; no saved return word is substituted.
export function* nativeCallSequence(
  h,
  events,
  routines,
  pc,
  target,
  long = false,
  forwardRoutines = true,
) {
  const run = routines.get(target);
  if (!run) taskStop('main_loop_frontier', { target });
  const bank = h.ctx.programBank,
    raw = (pc + (long ? JSL_RETURN_OFFSET : JSR_RETURN_OFFSET)) & WORD_MASK;
  yield () => {
    if (long) {
      h.a.write(h.ctx.s, bank, 'native-call-JSL-bank');
      h.ctx.s = (h.ctx.s - 1) & WORD_MASK;
    }
    h.a.pushWord(raw, long ? 'native-call-JSL-WORD' : 'native-call-JSR-WORD');
    h.ctx.programBank = target >>> WORD_BITS;
    h.ctx.pc = target & WORD_MASK;
  };
  const result = yield { target, run, h, events, routines: forwardRoutines ? routines : undefined };
  yield () => {
    if (h.ctx.programBank !== bank || h.ctx.pc !== ((raw + 1) & WORD_MASK))
      taskStop('task_native_helper_return_required', {
        pc,
        target,
        bank: h.ctx.programBank,
        returnPc: h.ctx.pc,
      });
  };
  return result;
}

// The same frame as dialogAccess().call, without access labels, so callers
// that already record its unlabelled pushes keep their observed accesses.
export function* dialogCallSequence(h, events, routines, pc, target, long = false) {
  const run = routines.get(target);
  if (!run) taskStop('main_loop_frontier', { target });
  const bank = h.ctx.programBank,
    raw = (pc + (long ? JSL_RETURN_OFFSET : JSR_RETURN_OFFSET)) & WORD_MASK;
  yield () => {
    if (long) h.pushByte(bank);
    h.a.pushWord(raw);
    h.ctx.programBank = target >>> WORD_BITS;
    h.ctx.pc = target & WORD_MASK;
  };
  const result = yield { target, run, h, events };
  yield () => {
    if (h.ctx.programBank !== bank || h.ctx.pc !== ((raw + 1) & WORD_MASK))
      taskStop('task_native_helper_return_required', {
        pc,
        target,
        bank: h.ctx.programBank,
        returnPc: h.ctx.pc,
      });
  };
  return result;
}

// The same unlabelled frame around a callee given as its own sequence.
export function* dialogCallBody(h, pc, target, body, long = false) {
  const bank = h.ctx.programBank,
    raw = (pc + (long ? JSL_RETURN_OFFSET : JSR_RETURN_OFFSET)) & WORD_MASK;
  yield () => {
    if (long) h.pushByte(bank);
    h.a.pushWord(raw);
    h.ctx.programBank = target >>> WORD_BITS;
    h.ctx.pc = target & WORD_MASK;
  };
  const result = yield* body();
  yield () => {
    if (h.ctx.programBank !== bank || h.ctx.pc !== ((raw + 1) & WORD_MASK))
      taskStop('task_native_helper_return_required', {
        pc,
        target,
        bank: h.ctx.programBank,
        returnPc: h.ctx.pc,
      });
  };
  return result;
}
// A callee without its own sequence stays one segment.
export function* segmentSequence(run) {
  let result;
  yield () => {
    result = run();
  };
  return result;
}

// An original tail jump transfers the existing frame. The callee's actual
// return value is passed back through the generator, without pushing a frame.
export function* nativeTailSequence(h, events, routines, target) {
  const run = routines.get(target);
  if (!run) taskStop('main_loop_frontier', { target });
  yield () => {
    h.ctx.programBank = target >>> WORD_BITS;
    h.ctx.pc = target & WORD_MASK;
  };
  return yield { target, run, h, events, routines };
}
