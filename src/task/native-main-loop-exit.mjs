import { leaf } from './native-leaf-support.mjs';
import { MAIN_LOOP_EXIT, MAIN_LOOP_REQUESTED } from './wram.mjs';
import { LONG_WRAP } from '../constants/bits.mjs';

// 80:D9A0: ask the main loop to exit.
export const requestMainLoopExit = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      a.writeWord(h.abs(MAIN_LOOP_EXIT), h.load(MAIN_LOOP_REQUESTED), LONG_WRAP, 'leaf-reset-word');
    },
    outerReturn,
  );
