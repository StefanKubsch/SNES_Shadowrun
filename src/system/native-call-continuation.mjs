import { taskStop } from './task-stop.mjs';
import {
  SequenceRunner,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  segmentSequence,
} from './sequence-runner.mjs';
import { installRegisterCompat } from './register-compat.mjs';
import { WORD_MASK, WORD_BITS } from '../constants/bits.mjs';

export const JSR_RETURN_OFFSET = 2,
  JSL_RETURN_OFFSET = 3;

// The neutral sequence helpers live in sequence-runner.mjs; frozen callers import
// them from here.
export { NATIVE_CALL_CONTINUATIONS, drainNativeSequence, segmentSequence };

const registers = ['e', 'programBank', 'pc', 'a', 'x', 'y', 's', 'd', 'bank', 'status'];

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

installRegisterCompat({ dialogCallBody, observedContinuation });
