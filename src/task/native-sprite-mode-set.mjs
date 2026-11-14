import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { storeSpriteMode } from '../game/object-fields.mjs';

// 80:D16D (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): replace the sprite mode bits of the object (first
// argument) with the second argument (not masked); the other depth order bits stay.
export const setSpriteMode = (a, outerReturn = true) => {
  storeSpriteMode(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
