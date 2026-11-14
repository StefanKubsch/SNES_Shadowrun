import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { fixesEnabled } from '../game/bugfixes.mjs';
import { setActorItemProperty } from '../game/runner-equipment.mjs';

// 80:9CE4 (lifted in src/game/runner-equipment.mjs; register-level reference in
// proof/game-reference/runner-equipment.mjs): as 80:9D15 for an actor entry (first
// argument): its state record gets the property word (second argument) and its item is
// taken off any runner who has it equipped.
export const setActorItemPropertyAndUnequip = (a, outerReturn = true) => {
  setActorItemProperty(
    a.mem,
    leafArgument(a, FIRST_ARGUMENT),
    leafArgument(a, SECOND_ARGUMENT),
    fixesEnabled(a),
    a,
  );
  return finishLeaf(a, outerReturn);
};
