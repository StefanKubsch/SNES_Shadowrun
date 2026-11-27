import {
  FIRST_ARGUMENT,
  finishLeaf,
  leafArgument,
  setLeafResult,
} from '../system/native-leaf-support.mjs';
import { halveSigned } from '../game/script-queries.mjs';

// 80:D9A7 (lifted in src/game/script-queries.mjs; register-level reference in
// proof/game-reference/script-measures.mjs): halve the first argument in place as a
// signed word.
export const halveArgumentSigned = (a) => {
  setLeafResult(a, halveSigned(leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a);
};
