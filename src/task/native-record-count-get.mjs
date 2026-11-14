import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { actorStateCount } from '../game/actor-state.mjs';

// 80:CB3C (lifted in src/game/actor-state.mjs; register-level reference in
// proof/game-reference/actor-state.mjs): return the count byte of the state record of
// the actor entry (first argument). An actor without a record reads its count from
// 7E:0002.
export const getActorStateCount = (a, outerReturn = true) => {
  setLeafResult(a, actorStateCount(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
