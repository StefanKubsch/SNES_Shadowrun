import { leaf } from './native-leaf-support.mjs';
import { TIMER, TIMER_FRAMES } from './wram.mjs';
import { WORD_MASK } from '../constants/bits.mjs';

const TRUE = WORD_MASK;

// 80:E262: return TRUE (FFFF) while the countdown or its frame counter is nonzero, else 0.
// The flags come from the ORA, or from the load of TRUE.
export const isTimerRunning = (a, outerReturn = true) =>
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
