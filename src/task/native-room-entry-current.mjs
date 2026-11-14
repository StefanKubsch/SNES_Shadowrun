import { finishLeaf, setLeafResult } from './native-leaf-support.mjs';
import { currentRoomHeader } from '../game/room-story.mjs';

// 80:CCB9 (lifted in src/game/room-story.mjs; register-level reference in
// proof/game-reference/room-story.mjs): return the header word of the current room from
// the room table.
export const getCurrentRoomHeader = (a, outerReturn = true) => {
  setLeafResult(a, currentRoomHeader(a.mem));
  return finishLeaf(a, outerReturn);
};
