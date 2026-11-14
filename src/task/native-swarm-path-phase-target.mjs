import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { PATH_START_XY_GOAL } from './wram.mjs';
import { WAVE_WORD_INDEX_MASK } from './native-object-bob.mjs';

// 80:D985: set the target wave phase of the swarm path (X/Y) to the first argument as a wave index.
export const setSwarmPathPhaseTarget = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const phase = h.load(h.dp(FIRST_ARGUMENT) & WAVE_WORD_INDEX_MASK);
      h.longWrite(h.abs(PATH_START_XY_GOAL), phase);
    },
    outerReturn,
  );
