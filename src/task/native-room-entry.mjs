import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { roomHeader } from '../game/room-story.mjs';

// 80:CCCC (lifted in src/game/room-story.mjs; register-level reference in
// proof/game-reference/room-story.mjs): return the header word of the room (first
// argument) from the room table.
export const getRoomHeader = (a, outerReturn = true) => {
  setLeafResult(a, roomHeader(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
