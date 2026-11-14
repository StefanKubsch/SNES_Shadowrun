import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { SCRIPT_VARIABLES, WRAM } from './wram.mjs';

// 80:CC07: return the script variable at the byte offset in the first argument.
export const getScriptVariable = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const variable = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(WRAM + SCRIPT_VARIABLES + variable)));
    },
    outerReturn,
  );
