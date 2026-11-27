// Live frame and input entry points shared by the main loop and menus.
import { takePadPresses } from './joypad.mjs';
import { lagFree } from '../vm/frame-events.mjs';
import { taskStop } from './task-stop.mjs';

// The pad word (80:9E1A) for lifted callers, without the JSR frame (the caller's return
// word lies only in free stack bytes): the newly pressed and held words taken; no
// registers are left (user decision 2026-11-17).
export function takePad(h, events) {
  if (!lagFree(events)) taskStop('game_lag_free_required');
  takePadPresses(h.a.mem.wram);
}
