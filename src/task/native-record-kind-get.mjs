import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { actorKind } from '../game/kind-values.mjs';

// 80:D0FC (lifted in src/game/kind-values.mjs; register-level reference in
// proof/game-reference/kind-values.mjs): return the kind of the actor entry
// (offset in the first argument).
export const getActorKind = (a, outerReturn = true) => {
  setLeafResult(a, actorKind(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
