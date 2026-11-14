import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { taskSelectionSupport } from './native-object-turn.mjs';
import { FIGHT_LIST_INDEX, FIGHT_LIST } from './wram.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { WORD_MASK, BANK_WRAP } from '../constants/bits.mjs';
// 80:8631: return the object before the object (first argument) in the fight list. A
// negative argument takes the last entry, an object not in the list the one before the
// last; none (empty list or the object first) gives FFFF.
export const getPreviousFightObject = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const k = taskSelectionSupport(h),
        { ctx } = h,
        dex = () => h.index('x', (ctx.x - 1) & WORD_MASK),
        field = (o) => h.longRead(h.abs(o) + ctx.x);
      const none = () => {
        h.load(WORD_MASK);
        a.writeWord(FIRST_ARGUMENT, ctx.a, BANK_WRAP, '8631-DP00');
      };
      h.index('x', h.longRead(h.abs(FIGHT_LIST_INDEX)));
      if (ctx.status & FLAG_NEGATIVE) {
        none();
        return;
      }
      h.load(h.dp(FIRST_ARGUMENT));
      if (!(ctx.status & FLAG_NEGATIVE)) {
        let found = false;
        for (;;) {
          k.compare(ctx.a, field(FIGHT_LIST));
          if (ctx.status & FLAG_ZERO) {
            found = true;
            break;
          }
          dex();
          dex();
          if (ctx.status & FLAG_NEGATIVE) break;
        }
        if (!found) h.index('x', h.longRead(h.abs(FIGHT_LIST_INDEX)));
        dex();
        dex();
        if (ctx.status & FLAG_NEGATIVE) {
          none();
          return;
        }
      }
      h.load(field(FIGHT_LIST));
      a.writeWord(FIRST_ARGUMENT, ctx.a, BANK_WRAP, '8631-DP00');
    },
    outerReturn,
  );
