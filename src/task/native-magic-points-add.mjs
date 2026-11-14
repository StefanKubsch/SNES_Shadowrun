import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { addMemberMagicPoints } from '../game/party-funds.mjs';

// 80:8B8A (lifted in src/game/party-funds.mjs; register-level reference in
// proof/game-reference/party-funds.mjs): magic points of the selected team member plus
// the low byte of the first argument, as a wrapping one-byte sum without a limit.
export const addMagicPoints = (a, outerReturn = true) => {
  addMemberMagicPoints(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
