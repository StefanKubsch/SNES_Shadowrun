import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from '../system/native-leaf-support.mjs';
import { equipArmour } from '../game/runner-equipment.mjs';

// 80:8B16 (lifted in src/game/runner-equipment.mjs; register-level reference in
// proof/game-reference/runner-equipment.mjs): equip the member shown in the menus with
// the armour item object (first argument) of rating (second argument).
export const equipRunnerArmour = (a) => {
  equipArmour(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a);
};
