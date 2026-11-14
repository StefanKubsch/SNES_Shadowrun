import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { LONG_WRAP } from '../constants/bits.mjs';
import { PATH_SPEED_HEIGHT_GOAL } from './wram.mjs';
import { WAVE_WORD_INDEX_MASK } from './native-object-bob.mjs';

// 80:D997: set the target wave speed of the swarm height to the first argument as a wave index.
export const setSwarmHeightSpeedTarget = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const speed = h.load(h.dp(FIRST_ARGUMENT) & WAVE_WORD_INDEX_MASK);
      a.writeWord(h.abs(PATH_SPEED_HEIGHT_GOAL), speed, LONG_WRAP, 'leaf-selection');
    },
    outerReturn,
  );
