// The RTS of a script native for register-level test callers: the lifted native
// (src/script) ends with the result in the argument word 00 and uses no CPU frame; a
// caller that entered it with JSR gets the return the original takes, and the record the
// former in-native return gave (so frozen outcomes keep their shape).
import { BANK_WRAP, WORD_MASK } from '../../src/constants/bits.mjs';
import { CODE_BANK_BASE } from '../../src/constants/memory-map.mjs';

export function leafReturn(a) {
  const rawReturnWord = a.readWord((a.ctx.s + 1) & WORD_MASK, BANK_WRAP);
  a.ctx.s = (a.ctx.s + 2) & WORD_MASK;
  a.ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return {
    rawReturnWord,
    returnTarget: CODE_BANK_BASE | a.ctx.pc,
    frontier: 'observed-outer-RTS-target',
    scope: 'manual-source-specific-native-leaf-return-target-not-executed',
    dynamicDispatchExecuted: false,
    returnTargetExecuted: false,
  };
}

// The native leaf as its register form: run it, then its RTS. Extra fields the native
// returns (as the random natives do) are kept beside the return record.
export const leafRts =
  (leaf) =>
  (a, ...rest) => {
    const out = leaf(a, ...rest);
    if (a.valueReturn) return out;
    return { ...leafReturn(a), ...(out !== null && typeof out === 'object' ? out : {}) };
  };
