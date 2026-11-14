import { finishLeaf, setLeafResult } from './native-leaf-support.mjs';
import { storyStage } from '../game/room-story.mjs';

// 80:D134 (lifted in src/game/room-story.mjs; register-level reference in
// proof/game-reference/room-story.mjs): return the story stage (low byte).
export const getStoryStage = (a, outerReturn = true) => {
  setLeafResult(a, storyStage(a.mem));
  return finishLeaf(a, outerReturn);
};
