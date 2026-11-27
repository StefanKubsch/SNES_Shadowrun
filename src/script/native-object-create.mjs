import { finishLeaf } from '../system/native-leaf-support.mjs';
import { createObject as createLiftedObject } from '../game/object-create.mjs';

// 80:A835 as the script native (lifted in src/game/object-create.mjs; register-level
// reference in proof/script/native-object-create.mjs).
export const createObjectNative = (a) => {
  createLiftedObject(a.mem, a.mem.wram, a);
  return finishLeaf(a);
};
