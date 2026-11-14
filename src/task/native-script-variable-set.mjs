import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { SCRIPT_VARIABLES, WRAM } from './wram.mjs';

// 80:CC10: set the script variable at the byte offset in the first argument to the second argument.
export const setScriptVariable = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const variable = h.index('x', h.dp(FIRST_ARGUMENT)),
        value = h.load(h.dp(SECOND_ARGUMENT));
      h.longWrite(WRAM + SCRIPT_VARIABLES + variable, value);
    },
    outerReturn,
  );
