import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { requestRoomChange } from '../game/script-requests.mjs';

// 80:CC97 (lifted in src/game/script-requests.mjs; register-level reference in
// proof/game-reference/script-requests.mjs): switch to the room in the first argument
// without a scene sequence.
export const changeRoom = (a, outerReturn = true) => {
  requestRoomChange(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
