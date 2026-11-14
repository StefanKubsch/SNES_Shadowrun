import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { raiseStoryStage as raiseStage } from '../game/room-story.mjs';

// 80:CCA4 (lifted in src/game/room-story.mjs; register-level reference in
// proof/game-reference/room-story.mjs): raise the story stage to stage n (first
// argument, 1 to 16) unless the current stage is past it.
export const raiseStoryStage = (a, outerReturn = true) => {
  raiseStage(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
