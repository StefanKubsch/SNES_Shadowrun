import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { LONG_WRAP } from '../constants/bits.mjs';
import { PATH_START_HEIGHT_GOAL } from './wram.mjs';
import { WAVE_WORD_INDEX_MASK } from './native-object-bob.mjs';

// 80:D97C: set the target wave phase of the swarm height to the first argument as a wave index.
export const setSwarmHeightPhaseTarget = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const phase = h.load(h.dp(FIRST_ARGUMENT) & WAVE_WORD_INDEX_MASK);
      a.writeWord(h.abs(PATH_START_HEIGHT_GOAL), phase, LONG_WRAP, 'leaf-selection');
    },
    outerReturn,
  );
