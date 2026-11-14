import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { SCRIPT_VARIABLES, WRAM } from './wram.mjs';

// 80:CC19: set the bits of the second argument in the script variable at the
// byte offset in the first argument.
export const setScriptVariableBits = (a, outerReturn = true) =>
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
