// Routine-table call sequences used only by register-level references: the
// labelled call frame (nativeCallSequence), the unlabelled call frame
// (dialogCallSequence) and the original tail jump (nativeTailSequence). The game composes its callees directly.
import {
  JSL_RETURN_OFFSET,
  JSR_RETURN_OFFSET,
} from './native-call-continuation.mjs';
import { WORD_MASK, WORD_BITS } from '../../src/constants/bits.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';

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
