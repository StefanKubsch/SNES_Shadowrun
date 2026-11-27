import { FIRST_ARGUMENT, finishLeaf, leafArgument } from '../system/native-leaf-support.mjs';
import { updateDepthMode } from '../game/object-fields.mjs';

// 80:D0D3 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): unless the object (first argument) is hidden,
// set its depth mode from its drawing flags.
export const updateObjectDepthMode = (a) => {
  updateDepthMode(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a);
};
