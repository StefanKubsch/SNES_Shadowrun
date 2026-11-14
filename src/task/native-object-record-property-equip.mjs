import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { fixesEnabled } from '../game/bugfixes.mjs';
import { setItemProperty } from '../game/runner-equipment.mjs';

// 80:9D15 (lifted in src/game/runner-equipment.mjs; register-level reference in
// proof/game-reference/runner-equipment.mjs): set the property word of the record of the
// item object (first argument) to the second argument and take the item off any runner
// who has it equipped.
export const setItemPropertyAndUnequip = (a, outerReturn = true) => {
  setItemProperty(
    a.mem,
    leafArgument(a, FIRST_ARGUMENT),
    leafArgument(a, SECOND_ARGUMENT),
    fixesEnabled(a),
  );
  return finishLeaf(a, outerReturn);
};
