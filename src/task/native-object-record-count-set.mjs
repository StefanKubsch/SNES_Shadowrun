import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { setRecordCount } from '../game/object-fields.mjs';
import { protectedJakeHealth } from '../game/cheats.mjs';

// 80:CAE0 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): set the count byte (ammunition or
// body) of the record of the object (first argument) to the low byte of the second
// argument; no record, no change. With cheats on, Jake's health is protected
// (src/game/cheats.mjs).
export const setObjectRecordCount = (a, outerReturn = true) => {
  setRecordCount(
    a.mem,
    leafArgument(a, FIRST_ARGUMENT),
    leafArgument(a, SECOND_ARGUMENT),
    (record, count) => protectedJakeHealth(a, record, count),
  );
  return finishLeaf(a, outerReturn);
};
