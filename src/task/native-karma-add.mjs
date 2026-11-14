import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { addKarma as add } from '../game/party-funds.mjs';

// 80:CDB2 (lifted in src/game/party-funds.mjs; register-level reference in
// proof/game-reference/party-funds.mjs): karma plus the first script argument, as a
// wrapping 16-bit sum without a limit.
export const addKarma = (a, outerReturn = true) => {
  add(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
