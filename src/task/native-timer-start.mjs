import { leaf } from './native-leaf-support.mjs';
import { TIMER, TIMER_FRAMES } from './wram.mjs';

// Start values stored by the ROM: frame counter 3540, countdown 29.
const TIMER_START_FRAMES = 3540,
  TIMER_START_VALUE = 29;

// 80:E255: start the countdown timer.
export const startTimer = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(h.abs(TIMER_FRAMES), h.load(TIMER_START_FRAMES));
      h.longWrite(h.abs(TIMER), h.load(TIMER_START_VALUE));
    },
    outerReturn,
  );
