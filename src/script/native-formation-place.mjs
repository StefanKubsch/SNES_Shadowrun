import { finishLeaf } from '../system/native-leaf-support.mjs';
import { placeInFormation } from '../game/formation-place.mjs';

// 80:BB2C (lifted in src/game/formation-place.mjs; register-level reference in
// proof/game-reference/formation-place.mjs): the object (first argument) takes its place
// in the formation.
export const placeObjectInFormation = (a, outerReturn = true) => {
  placeInFormation(a.mem);
  return finishLeaf(a, outerReturn);
};
