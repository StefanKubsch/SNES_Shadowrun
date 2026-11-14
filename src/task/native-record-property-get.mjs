import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { actorStateProperty } from '../game/actor-state.mjs';

// 80:CB4D (lifted in src/game/actor-state.mjs; register-level reference in
// proof/game-reference/actor-state.mjs): return the property word of the state
// record of the actor entry (first argument). An actor without a record reads 7E:0003.
export const getActorStateProperty = (a, outerReturn = true) => {
  setLeafResult(a, actorStateProperty(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
