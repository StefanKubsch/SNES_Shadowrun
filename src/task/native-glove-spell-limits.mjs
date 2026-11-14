import { leaf } from './native-leaf-support.mjs';
import { applyGloveLimits, GLOVE_LIMITS } from './native-glove-crosshair-limits.mjs';

// 80:BC9C: keep the spell glove inside its screen limits (the tail of 80:BC99 after
// its JSR 80:BC36), see native-glove-crosshair-limits.mjs.
export const limitSpellGlove = (a, outerReturn = true) =>
  leaf(a, (h) => applyGloveLimits(h, GLOVE_LIMITS.spell), outerReturn);
