import {
  FIRST_ARGUMENT,
  finishLeaf,
  leafArgument,
  setLeafResult,
} from '../system/native-leaf-support.mjs';
import { countDownObjectState } from '../game/actor-state.mjs';
import { protectedJakeHealth } from '../game/cheats.mjs';

// 80:9DC8 (lifted in src/game/actor-state.mjs; register-level reference in
// proof/game-reference/actor-state.mjs): count down the count byte of the state record of
// the object's actor entry (object in the first argument). Return TRUE (FFFF) when the
// count reaches 0 or there is no record, else FALSE (0). With cheats, Jake's protected
// health keeps its value (src/game/cheats.mjs).
export const decrementObjectStateCount = (a, outerReturn = true) => {
  setLeafResult(
    a,
    countDownObjectState(a.mem, leafArgument(a, FIRST_ARGUMENT), (record, count) =>
      protectedJakeHealth(a, record, count),
    ),
  );
  return finishLeaf(a, outerReturn);
};
