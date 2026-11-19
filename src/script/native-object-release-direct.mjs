import { finishLeaf } from '../system/native-leaf-support.mjs';
import { releaseObjectGraphics as releaseLiftedGraphics } from '../game/object-release.mjs';

// 80:AA4C (lifted in src/game/object-release.mjs; register-level reference in
// proof/game-reference/object-release.mjs): clear the picture, animation, box and motion
// of the object (first argument) and return its VRAM slots to the free list.
export const releaseObjectGraphics = (a, outerReturn = true) => {
  releaseLiftedGraphics(a.mem, a);
  return finishLeaf(a, outerReturn);
};
