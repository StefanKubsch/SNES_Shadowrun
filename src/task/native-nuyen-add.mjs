import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { addNuyen as add } from '../game/party-funds.mjs';

// 80:CCDB (lifted in src/game/party-funds.mjs; register-level reference in
// proof/game-reference/party-funds.mjs): the 32-bit nuyen balance plus the first script
// argument, saturating at the maximum.
export const addNuyen = (a, outerReturn = true) => {
  add(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
