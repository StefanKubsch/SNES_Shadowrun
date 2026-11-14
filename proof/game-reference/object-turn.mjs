// Register-level references of the script natives 80:A985 (animation selection), 80:AAAF
// (turn) and 80:D15C (selection, then turn), moved from
// src/task/native-object-action-apply.mjs, native-object-action-set.mjs and
// native-object-turn.mjs; lifted in src/game/object-turn.mjs and src/game/member-facing.mjs.
// The proof plans, the Native58 dispatch of proof/task/native-dispatch.mjs and the lift
// tests run these; the game runs the lifted natives. The shared register-level bodies stay
// in src/task/native-object-turn.mjs for the register-level natives that still call them.
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from '../../src/task/native-leaf-support.mjs';
import {
  runTaskAction,
  runTaskSelection,
  taskSelectionSupport,
} from '../../src/task/native-object-turn.mjs';
import { BANK_WRAP, WORD_MASK } from '../../src/constants/bits.mjs';

// D15C arguments: DP00 object, DP02 selection, DP04 direction (restored to DP02 for AAAF).
const DP_DIRECTION_ARGUMENT = 4;
// Return word of a JSR: the bank offset of the call's last byte.
const callReturn = (address) => address & WORD_MASK;

// 80:A985: select animation (second argument) for the object (first argument).
export const setObjectAnimationReference = (a, outerReturn = true) =>
  leaf(a, (h) => runTaskSelection(h, taskSelectionSupport(h)), outerReturn);
// 80:AAAF: turn the object (first argument) to the direction in the second argument.
export const setObjectDirectionReference = (a, outerReturn = true) =>
  leaf(a, (h) => runTaskAction(h, taskSelectionSupport(h)), outerReturn);
// 80:D15C: set the object's action selection (A985), then its direction (AAAF).
export const setObjectActionAndDirectionReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const k = taskSelectionSupport(h);
      a.pushWord(h.dp(DP_DIRECTION_ARGUMENT), 'd2-PEI04');
      a.pushWord(h.dp(FIRST_ARGUMENT), 'd2-PEI00');
      k.call(callReturn(0x80d162), () => runTaskSelection(h, k));
      h.load(a.pullWord('d2-restore-slot-PLA'));
      a.writeWord(FIRST_ARGUMENT, h.ctx.a, BANK_WRAP, 'd2-restored-slot');
      h.load(a.pullWord('d2-restore-action-PLA'));
      a.writeWord(SECOND_ARGUMENT, h.ctx.a, BANK_WRAP, 'd2-restored-action');
      k.call(callReturn(0x80d16b), () => runTaskAction(h, k));
    },
    outerReturn,
  );
