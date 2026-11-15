import { FIRST_ARGUMENT, finishLeaf, leafArgument } from '../system/native-leaf-support.mjs';
import { learnSpell as learn } from '../game/party-funds.mjs';

// 80:E1B3 (lifted in src/game/party-funds.mjs; register-level reference in
// proof/game-reference/party-funds.mjs): add the spell (first argument) to the end of the
// learned spell list unless the list already holds it.
export const learnSpell = (a, outerReturn = true) => {
  learn(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
