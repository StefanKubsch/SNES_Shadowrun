import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { keepActorStateFlagBits as keepBits } from '../game/actor-state.mjs';

// 80:CBCB (lifted in src/game/actor-state.mjs; register-level reference in
// proof/game-reference/actor-state.mjs): keep only the bits of the second
// argument's low byte in the flag byte of the state record of the actor entry (first
// argument); no record, no change.
export const keepActorStateFlagBits = (a, outerReturn = true) => {
  keepBits(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
