import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { PATH_SPEED_XY_GOAL } from './wram.mjs';
import { WAVE_WORD_INDEX_MASK } from './native-object-bob.mjs';

// 80:D98E: set the target wave speed of the swarm path (X/Y) to the first argument as a wave index.
export const setSwarmPathSpeedTarget = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const speed = h.load(h.dp(FIRST_ARGUMENT) & WAVE_WORD_INDEX_MASK);
      h.longWrite(h.abs(PATH_SPEED_XY_GOAL), speed);
    },
    outerReturn,
  );
