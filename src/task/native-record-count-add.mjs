import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { raiseActorStateCount } from '../game/actor-state.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// 80:9DEC (lifted in src/game/actor-state.mjs; register-level reference in
// proof/game-reference/actor-state.mjs): add the second argument's low byte to the count
// byte of the state record of the actor entry (first argument), at most six; no record,
// no change.
export const addActorStateCount = (a, outerReturn = true) => {
  raiseActorStateCount(
    a.mem,
    leafArgument(a, FIRST_ARGUMENT),
    leafArgument(a, SECOND_ARGUMENT) & BYTE_MASK,
  );
  return finishLeaf(a, outerReturn);
};
