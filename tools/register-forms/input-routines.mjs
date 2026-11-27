// The frame wait 81:B0A1 and the pad word 80:9E1A as routine table entries with the
// original's registers, for register-level callers (moved from
// src/system/live-input-calls.mjs, whose lifted forms leave no registers).
import { frameWaitCallSequence } from '../../src/system/live-input-calls.mjs';
import { takePadPresses } from '../../src/system/joypad.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from './native-call-continuation.mjs';
import { PAD_HELD, RANDOM_STATE } from '../../src/data/wram.mjs';
import { BYTE_BITS } from '../../src/constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

// The word wait with the counter word in A, as the original's LDA 7E:1C76 leaves it
// before the first compare (moved from the register option of src/system/frame-wait.mjs).
function* registerFrameWaitSequence(h, events) {
  const { wram } = h.a.mem;
  yield () => {
    h.ctx.a = wram[RANDOM_STATE] | (wram[RANDOM_STATE + 1] << BYTE_BITS);
  };
  return yield* frameWaitCallSequence(h, events);
}
export function runFrameWait(h, events) {
  if (!lagFree(events)) taskStop('game_lag_free_required');
  return drainNativeSequence(registerFrameWaitSequence(h, events));
}
// Bind by function identity so this live wait can coexist with replay tables.
NATIVE_CALL_CONTINUATIONS.set(runFrameWait, {
  run: runFrameWait,
  create: (call) =>
    new NativeCallContinuation(call.h.a, registerFrameWaitSequence(call.h, call.events)),
});

// The register form for the routine tables: the original leaves A with its four low
// bits, sign clear, zero when they are, and the carry of its comparison with the soft
// reset buttons 3030.
const SOFT_RESET_BUTTONS = 0x3030,
  INVALID_PAD_BITS = 0x000f;
export function runPadPresses(h, events) {
  if (!lagFree(events)) taskStop('game_lag_free_required');
  const { ctx } = h,
    { wram } = h.a.mem,
    held = wram[PAD_HELD] | (wram[PAD_HELD + 1] << BYTE_BITS);
  takePadPresses(wram);
  ctx.a = held & INVALID_PAD_BITS;
  ctx.status &= ~(FLAG_NEGATIVE | FLAG_ZERO | FLAG_CARRY);
  if (!ctx.a) ctx.status |= FLAG_ZERO;
  if (held >= SOFT_RESET_BUTTONS) ctx.status |= FLAG_CARRY;
  return h.rts();
}
