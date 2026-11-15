// Register-level references of the script natives 80:A985 (animation selection), 80:AAAF
// (turn) and 80:D15C (selection, then turn); lifted in src/game/object-turn.mjs and
// src/game/member-facing.mjs. The proof plans, the Native58 dispatch of
// proof/task/native-dispatch.mjs and the lift tests run these; the game runs the lifted
// natives. They stay in src/script/native-object-turn.mjs for the register-level natives
// that still call them.
export {
  selectAnimationRegisters as setObjectAnimationReference,
  turnRegisters as setObjectDirectionReference,
  setActionAndDirectionRegisters as setObjectActionAndDirectionReference,
} from '../../src/script/native-object-turn.mjs';
