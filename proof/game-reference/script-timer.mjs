// Register-level references of the time limit's script natives (moved from
// src/task/native-timer-start.mjs, native-timer-stop.mjs and native-timer-running.mjs;
// lifted in src/game/time-limit.mjs). The proof plans and the Native58 dispatch of
// proof/task/native-dispatch.mjs run these; the game runs the lifted natives.
import { leaf } from '../../src/task/native-leaf-support.mjs';
import { TIMER, TIMER_FRAMES, TIMER_STOPPED } from '../../src/task/wram.mjs';
import { WORD_MASK } from '../../src/constants/bits.mjs';

// Start values stored by the ROM: frame counter 3540, countdown 29.
const TIMER_START_FRAMES = 3540,
  TIMER_START_VALUE = 29,
  TRUE = WORD_MASK;

// 80:E255: start the countdown timer.
export const startTimerReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(h.abs(TIMER_FRAMES), h.load(TIMER_START_FRAMES));
      h.longWrite(h.abs(TIMER), h.load(TIMER_START_VALUE));
    },
    outerReturn,
  );
// 80:E24E: stop the countdown timer.
export const stopTimerReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(h.abs(TIMER), h.load(TIMER_STOPPED));
    },
    outerReturn,
  );
// 80:E262: return TRUE (FFFF) while the countdown or its frame counter is nonzero, else 0.
// The flags come from the ORA, or from the load of TRUE.
export const isTimerRunningReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const frames = h.load(h.longRead(h.abs(TIMER_FRAMES)));
      let running = h.load(frames | h.longRead(h.abs(TIMER)));
      if (running !== 0) running = h.load(TRUE);
      h.result(running);
    },
    outerReturn,
  );
