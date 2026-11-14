import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { actorStateFlags } from '../game/actor-state.mjs';
import { akimiArrivalFlags } from '../game/bugfixes.mjs';

// 80:CB2B (lifted in src/game/actor-state.mjs; register-level reference in
// proof/game-reference/actor-state.mjs): return the flag byte of the state record of the
// actor entry (first argument). With bug fixes enabled, Akimi's arrival flags are
// corrected (src/game/bugfixes.mjs).
export const getActorStateFlags = (a, outerReturn = true) => {
  const actor = leafArgument(a, FIRST_ARGUMENT);
  setLeafResult(a, akimiArrivalFlags(a, actor, actorStateFlags(a.mem, actor)));
  return finishLeaf(a, outerReturn);
};
