// Live frame and input entry points shared by the main loop and menus.
import { waitForCounterWord } from './frame-wait.mjs';
import { takePadPresses } from './joypad.mjs';
import { lagFree } from '../vm/frame-events.mjs';
import { taskStop } from './task-stop.mjs';

// 81:B0A1 (called with JSL) and 80:9E1A (JSR) at the top of the main loop. With the
// lag-free frame model the NMI arrives only at the word wait's blocking branch, so
// both run lifted: the word wait (frame-wait.mjs) and the newly pressed
// buttons (joypad.mjs). Recorded interrupt replays use the register-level
// routines and instruction continuations in proof/vm/main-loop.mjs; the table entries
// with the original's registers are in proof/caller/input-routines.mjs.
export function* frameWaitCallSequence(h, events) {
  yield* waitForCounterWord(h, events);
  let result;
  yield () => {
    result = h.rtl();
  };
  return result;
}
// The pad word (80:9E1A) for lifted callers, without the JSR frame (the caller's return
// word lies only in free stack bytes): the newly pressed and held words taken; no
// registers are left (user decision 2026-11-17).
export function takePad(h, events) {
  if (!lagFree(events)) taskStop('game_lag_free_required');
  takePadPresses(h.a.mem.wram);
}
