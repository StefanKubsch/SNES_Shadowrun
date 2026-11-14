// Register-level references of the script variable natives 80:CC07, 80:CC10, 80:CC19
// and 80:CC26 (moved from src/task/native-script-variable-*.mjs; lifted in
// src/game/script-variables.mjs). The proof plans and the Native58 dispatch of
// proof/task/native-dispatch.mjs run these; the game runs the lifted natives.
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from '../../src/task/native-leaf-support.mjs';
import { SCRIPT_VARIABLES, WRAM } from '../../src/task/wram.mjs';
// 80:CC07: return the script variable at the byte offset in the first argument.
export const getScriptVariableReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const variable = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(WRAM + SCRIPT_VARIABLES + variable)));
    },
    outerReturn,
  );
// 80:CC10: set the script variable at the byte offset in the first argument to the second argument.
export const setScriptVariableReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const variable = h.index('x', h.dp(FIRST_ARGUMENT)),
        value = h.load(h.dp(SECOND_ARGUMENT));
      h.longWrite(WRAM + SCRIPT_VARIABLES + variable, value);
    },
    outerReturn,
  );
// 80:CC19: set the bits of the second argument in the script variable at the
// byte offset in the first argument.
export const setScriptVariableBitsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const variable = h.index('x', h.dp(FIRST_ARGUMENT)),
        address = WRAM + SCRIPT_VARIABLES + variable,
        value = h.load(h.longRead(address));
      h.longWrite(address, h.load(value | h.dp(SECOND_ARGUMENT)));
    },
    outerReturn,
  );
// 80:CC26: keep only the bits of the second argument in the script variable at
// the byte offset in the first argument.
export const keepScriptVariableBitsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const variable = h.index('x', h.dp(FIRST_ARGUMENT)),
        address = WRAM + SCRIPT_VARIABLES + variable,
        value = h.load(h.longRead(address));
      h.longWrite(address, h.load(value & h.dp(SECOND_ARGUMENT)));
    },
    outerReturn,
  );
