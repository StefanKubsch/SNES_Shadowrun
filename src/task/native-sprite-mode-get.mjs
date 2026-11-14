import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { spriteMode } from '../game/object-fields.mjs';

// 80:D17B (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the sprite mode bits of the depth order
// word of the object (first argument).
export const getSpriteMode = (a, outerReturn = true) => {
  setLeafResult(a, spriteMode(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
