import { finishLeaf } from '../system/native-leaf-support.mjs';
import { GLOVE_LIMITS } from './native-glove-crosshair-limits.mjs';
import { setGloveLimits } from '../game/glove-target.mjs';

// 80:BC9C (lifted in src/game/glove-target.mjs; register-level reference in
// proof/game-reference/script-measures.mjs): keep the spell glove inside its screen
// limits (the tail of 80:BC99 after its JSR 80:BC36).
export const limitSpellGlove = (a, outerReturn = true) => {
  setGloveLimits(a.mem, GLOVE_LIMITS.spell);
  return finishLeaf(a, outerReturn);
};
