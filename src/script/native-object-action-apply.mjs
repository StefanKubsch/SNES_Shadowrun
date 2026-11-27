import { finishLeaf } from '../system/native-leaf-support.mjs';
import { selectObjectAnimation } from '../game/object-turn.mjs';

// 80:A985 (lifted in src/game/object-turn.mjs; register-level reference in
// proof/game-reference/object-turn.mjs): select animation (second argument) for the
// object (first argument) unless that animation is already selected.
export const setObjectAnimation = (a) => {
  selectObjectAnimation(a.mem, a.mem.wram);
  return finishLeaf(a);
};
