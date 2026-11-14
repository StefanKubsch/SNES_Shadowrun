import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_SELECTION } from './wram.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { WORD_MASK, BANK_WRAP } from '../constants/bits.mjs';

const NO_SELECTION = WORD_MASK,
  FALSE = 0;

// 80:BB90: return TRUE (FFFF) when the object (first argument) has no animation
// selected (selection word FFFF), else FALSE (0). The flags come from the CMP or the
// load of FALSE.
export const hasNoObjectAnimation = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h;
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        selection = h.load(h.longRead(h.abs(OBJECT_SELECTION) + object));
      // CMP #FFFF: carry when the selection is FFFF, N and Z from the difference.
      h.nz((selection - NO_SELECTION) & WORD_MASK);
      ctx.status = (ctx.status & ~FLAG_CARRY) | Number(selection >= NO_SELECTION);
      if (!(ctx.status & FLAG_ZERO)) h.load(FALSE);
      a.writeWord(FIRST_ARGUMENT, ctx.a, BANK_WRAP, 'bb90-DP00');
    },
    outerReturn,
  );
