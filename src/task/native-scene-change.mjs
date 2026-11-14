import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  THIRD_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { requestScene } from '../game/script-requests.mjs';

// 80:CC33 (lifted in src/game/script-requests.mjs; register-level reference in
// proof/game-reference/script-requests.mjs): request the scene sequence (first argument)
// with its argument (second) and set the room (third argument).
export const changeScene = (a, outerReturn = true) => {
  const [scene, argument, room] = [FIRST_ARGUMENT, SECOND_ARGUMENT, THIRD_ARGUMENT].map((offset) =>
    leafArgument(a, offset),
  );
  requestScene(a.mem, scene, argument, room);
  return finishLeaf(a, outerReturn);
};
