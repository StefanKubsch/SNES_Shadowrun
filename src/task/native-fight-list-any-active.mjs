import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import {
  FIGHT_LIST,
  FIGHT_LIST_INDEX,
  OBJECT_FLAGS,
  OBJECT_ON_SCREEN,
  OBJECT_NO_TARGET,
} from './wram.mjs';
import { BANK_WRAP, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_ZERO, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';

const TRUE = WORD_MASK,
  FALSE = 0;

// 80:866F: return TRUE (FFFF) when an object of the fight list is drawn on screen and
// may be targeted (bit 2 set, bit 12 clear), searched from the last index down; else
// FALSE (0). BIT # changes only Z; the FALSE store (STZ) keeps the flags of the last
// DEX or LDX.
export const hasFightTarget = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        bit = (mask) => {
          ctx.status = (ctx.status & ~FLAG_ZERO) | (ctx.a & mask ? 0 : FLAG_ZERO);
          return !(ctx.status & FLAG_ZERO);
        };
      let entry = h.index('x', h.longRead(h.abs(FIGHT_LIST_INDEX)));
      while (!(ctx.status & FLAG_NEGATIVE)) {
        const object = h.index('y', h.longRead(h.abs(FIGHT_LIST) + entry));
        h.load(h.longRead(h.abs(OBJECT_FLAGS) + object));
        if (bit(OBJECT_ON_SCREEN) && !bit(OBJECT_NO_TARGET)) {
          a.writeWord(FIRST_ARGUMENT, h.load(TRUE), BANK_WRAP, 'leaf-result-DP00');
          return;
        }
        h.index('x', (entry - 1) & WORD_MASK);
        entry = h.index('x', (entry - 2) & WORD_MASK);
      }
      a.writeWord(FIRST_ARGUMENT, FALSE, BANK_WRAP, 'leaf-result-DP00');
    },
    outerReturn,
  );
