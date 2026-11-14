import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { setActorStateFlags as setFlags } from '../game/actor-state.mjs';
import { keepVampireDefeated } from '../game/bugfixes.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// 80:CB9F (lifted in src/game/actor-state.mjs; register-level reference in
// proof/game-reference/actor-state.mjs): set the flag byte of the state record of the
// actor entry (first argument) to the low byte of the second argument; no record, no
// change. With exploit prevention, a defeated vampire stays defeated
// (src/game/bugfixes.mjs).
export const setActorStateFlags = (a, outerReturn = true) => {
  const actor = leafArgument(a, FIRST_ARGUMENT),
    flags = leafArgument(a, SECOND_ARGUMENT) & BYTE_MASK;
  setFlags(a.mem, actor, flags, (state) => keepVampireDefeated(a, actor, flags, state));
  return finishLeaf(a, outerReturn);
};
