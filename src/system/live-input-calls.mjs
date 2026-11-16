// Live frame and input entry points shared by the main loop and menus.
import { waitForCounterWord } from './frame-wait.mjs';
import { takePadPresses } from './joypad.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { taskStop } from './task-stop.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from './native-call-continuation.mjs';
import { PAD_HELD } from '../data/wram.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// 81:B0A1 (called with JSL) and 80:9E1A (JSR) at the top of the main loop. With the
// lag-free frame model the NMI arrives only at the word wait's blocking branch, so
// both run lifted: the word wait (frame-wait.mjs) and the newly pressed
// buttons (joypad.mjs). Recorded interrupt replays use the register-level
// routines and instruction continuations in proof/vm/main-loop.mjs.
export function* frameWaitCallSequence(h, events) {
  yield* waitForCounterWord(h, events);
  let result;
  yield () => {
    result = h.rtl();
  };
  return result;
}
export function runFrameWait(h, events) {
  if (!lagFree(events)) taskStop('game_lag_free_required');
  return drainNativeSequence(frameWaitCallSequence(h, events));
}
// Bind by function identity so this live wait can coexist with replay tables.
NATIVE_CALL_CONTINUATIONS.set(runFrameWait, {
  run: runFrameWait,
  create: (call) =>
    new NativeCallContinuation(call.h.a, frameWaitCallSequence(call.h, call.events)),
});
// The pad word: the original leaves A with its four low bits, sign clear, zero when
// they are, and the carry of its comparison with the soft reset buttons 3030; the
// glove movement 80:BE6D follows.
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
