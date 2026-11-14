import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { actorKindFlags } from '../game/kind-values.mjs';

// 80:CB06 (lifted in src/game/kind-values.mjs; register-level reference in
// proof/game-reference/kind-values.mjs): return the kind flags of the actor entry
// (offset in the first argument).
export const getActorKindFlags = (a, outerReturn = true) => {
  setLeafResult(a, actorKindFlags(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
