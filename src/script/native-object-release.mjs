import { finishLeaf } from '../system/native-leaf-support.mjs';
import { removeObject as removeLiftedObject } from '../game/object-release.mjs';

// 80:A8F5 (lifted in src/game/object-release.mjs; register-level reference in
// proof/game-reference/object-release.mjs): remove the object (first argument) from the
// scene: its graphics are released (80:AA4C), its kind becomes FFFF and it leaves the
// draw list.
export const removeObject = (a) => {
  removeLiftedObject(a.mem, a);
  return finishLeaf(a);
};
