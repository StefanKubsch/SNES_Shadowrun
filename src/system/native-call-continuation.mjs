import { taskStop } from './task-stop.mjs';
import { WAIT_PAUSED } from './native-wait-continuation.mjs';
import { SequenceRunner } from './sequence-runner.mjs';
import { WORD_MASK, WORD_BITS } from '../constants/bits.mjs';

export const JSR_RETURN_OFFSET = 2,
  JSL_RETURN_OFFSET = 3;

const registers = ['e', 'programBank', 'pc', 'a', 'x', 'y', 's', 'd', 'bank', 'status'];
// Implementations register their own fixed equations. This neutral module
// must never import a callback graph: that would pull scene tables into wait
// adapters before their existing cyclic module graph has initialized.
export const NATIVE_CALL_CONTINUATIONS = new Map();

// Compatibility guard for the remaining register-level native and oracle calls.
// The live outer loop uses SequenceRunner directly and owns no register snapshot.
export class NativeCallContinuation extends SequenceRunner {
  constructor(a, sequence, continuations = NATIVE_CALL_CONTINUATIONS) {
    super(sequence, continuations);
    this.a = a;
    this.context = a.ctx;
    this.saved = registers.map((key) => a.ctx[key]);
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
      return super.run(budget);
    } finally {
      for (let n = 0; n < registers.length; n++) this.saved[n] = this.context[registers[n]];
    }
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
      while (action.continuation.run(Number.MAX_SAFE_INTEGER) === WAIT_PAUSED) {
        // Drain every pause when the caller requests synchronous completion.
      }
      reply = action.continuation.result;
    } else
      reply =
        typeof action === 'function'
          ? action()
          : action.run(action.h, action.events, action.routines);
  }
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
