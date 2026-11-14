import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { actorKindValue } from '../game/kind-values.mjs';

// 80:CAF2 (lifted in src/game/kind-values.mjs; register-level reference in
// proof/game-reference/kind-values.mjs): return the kind value of the actor entry
// (offset in the first argument).
export const getActorKindValue = (a, outerReturn = true) => {
  setLeafResult(a, actorKindValue(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
