// Register-level references of the fight list's script queries (moved from
// src/script/native-fight-list-contains.mjs, native-fight-list-any-active.mjs and
// native-fight-list-previous.mjs; lifted in src/game/fight-list.mjs). The proof plans,
// the Native58 dispatch of proof/task/native-dispatch.mjs and the instruction tests of
// 80:8656 and 80:8631 run these; the game runs the lifted natives.
import { FIRST_ARGUMENT, leaf } from '../system/native-leaf-support.mjs';
import { taskSelectionSupport } from '../script/native-object-turn.mjs';
import {
  FIGHT_LIST,
  FIGHT_LIST_INDEX,
  OBJECT_FLAGS,
  OBJECT_NO_TARGET,
  OBJECT_ON_SCREEN,
} from '../../src/data/wram.mjs';
import { BANK_WRAP, WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

const TRUE = WORD_MASK,
  FALSE = 0;
// 80:8656: return TRUE (FFFF) when the object (first argument) is in the fight list,
// searched from its last index down; else FALSE (0), also for an empty list.
export const isInFightListReference = (a, outerReturn = true) =>
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
// 80:866F: return TRUE (FFFF) when an object of the fight list is drawn on screen and
// may be targeted (bit 2 set, bit 12 clear), searched from the last index down; else
// FALSE (0). BIT # changes only Z; the FALSE store (STZ) keeps the flags of the last
// DEX or LDX.
export const hasFightTargetReference = (a, outerReturn = true) =>
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
// 80:8631: return the object before the object (first argument) in the fight list. A
// negative argument takes the last entry, an object not in the list the one before the
// last; none (empty list or the object first) gives FFFF.
export const getPreviousFightObjectReference = (a, outerReturn = true) =>
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
