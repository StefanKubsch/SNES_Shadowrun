import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { taskSelectionSupport } from './native-object-turn.mjs';
import { FIGHT_LIST, FIGHT_LIST_INDEX } from './wram.mjs';
import { BANK_WRAP, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const TRUE = WORD_MASK,
  FALSE = 0;

// 80:8656: return TRUE (FFFF) when the object (first argument) is in the fight list,
// searched from its last index down; else FALSE (0), also for an empty list.
export const isInFightList = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const k = taskSelectionSupport(h),
        { ctx } = h;
      let entry = h.index('x', h.longRead(h.abs(FIGHT_LIST_INDEX)));
      if (!(ctx.status & FLAG_NEGATIVE)) {
        const object = h.load(h.dp(FIRST_ARGUMENT));
        for (;;) {
          k.compare(object, h.longRead(h.abs(FIGHT_LIST) + entry));
          if (ctx.status & FLAG_ZERO) {
            a.writeWord(FIRST_ARGUMENT, h.load(TRUE), BANK_WRAP, '8656-DP00');
            return;
          }
          h.index('x', (entry - 1) & WORD_MASK);
          entry = h.index('x', (entry - 2) & WORD_MASK);
          if (ctx.status & FLAG_NEGATIVE) break;
        }
      }
      a.writeWord(FIRST_ARGUMENT, FALSE, BANK_WRAP, '8656-STZ');
    },
    outerReturn,
  );
