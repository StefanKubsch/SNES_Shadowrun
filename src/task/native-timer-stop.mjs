import { leaf } from './native-leaf-support.mjs';
import { TIMER, TIMER_STOPPED } from './wram.mjs';

// 80:E24E: stop the countdown timer.
export const stopTimer = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(h.abs(TIMER), h.load(TIMER_STOPPED));
    },
    outerReturn,
  );
