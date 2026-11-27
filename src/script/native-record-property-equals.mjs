import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
  setLeafResult,
} from '../system/native-leaf-support.mjs';
import { isActorStateProperty as hasProperty } from '../game/actor-state.mjs';

// 80:9DAE (lifted in src/game/actor-state.mjs; register-level reference in
// proof/game-reference/actor-state.mjs): return TRUE (FFFF) when the property word of the
// state record of the actor entry (second argument) equals the first argument, else
// FALSE (0); FALSE without a record.
export const isActorStateProperty = (a) => {
  setLeafResult(
    a,
    hasProperty(a.mem, leafArgument(a, SECOND_ARGUMENT), leafArgument(a, FIRST_ARGUMENT)),
  );
  return finishLeaf(a);
};
