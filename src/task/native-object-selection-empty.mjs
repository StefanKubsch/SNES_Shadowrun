import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { hasNoAnimation } from '../game/object-fields.mjs';

// 80:BB90 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return TRUE (FFFF) when the object (first
// argument) has no animation selected, else FALSE (0).
export const hasNoObjectAnimation = (a, outerReturn = true) => {
  setLeafResult(a, hasNoAnimation(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
