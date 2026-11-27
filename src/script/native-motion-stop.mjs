import { FIRST_ARGUMENT, finishLeaf, leafArgument } from '../system/native-leaf-support.mjs';
import { stopMotion as stop } from '../game/motion-targets.mjs';

// 80:C7C2 (lifted in src/game/motion-targets.mjs; register-level reference in
// proof/game-reference/motion-targets.mjs): clear the motion target of
// the object (first argument).
export const stopMotion = (a) => {
  stop(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a);
};
