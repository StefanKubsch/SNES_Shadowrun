import { taskStop } from '../../src/task/plan.mjs';
import { leaf } from '../../src/task/native-leaf-support.mjs';
import { randomBelow } from '../../src/task/native-random.mjs';
import { testLineOfSight, SIGHT_ROUTINE } from '../../src/task/line-of-sight.mjs';

import {
  GROUP_INDEX,
  GROUP_LEADER_ONLY,
  GROUP_SLOTS,
  OBJECT_ON_SCREEN,
  OBJECT_FLAGS,
  OBJECT_NO_TARGET,
  WRAM,
} from '../../src/task/wram.mjs';
import { WORD_MASK, BANK_WRAP, WORD_BITS } from '../../src/constants/bits.mjs';
import { FLAG_ZERO, FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';
import { CODE_BANK } from '../../src/constants/memory-map.mjs';
// Return words of the JSR C51F and the JSL 81:A25F (bank offsets of the calls' last bytes).
const RANDOM_RETURN_WORD = 0x808bdf & WORD_MASK,
  SIGHT_RETURN_WORD = 0x808bfe & WORD_MASK;
// 80:8BC5: choose a target for the enemy object (first argument) (source: tools/task-native-8bc5-source.mjs). Without
// bit 2 in 1458+Y DP00 = FFFF. Otherwise a candidate from the object list 1FA8: index 0 when 1D6B is
// set, else random C51F below (7E2DE6 >> 1) + 1 (PPU counters as observations). A candidate with
// bit 12 in 1458 gives FFFF; otherwise the line of sight 81:A25F decides: free -> DP00 = candidate,
// blocked -> FFFF. Proved routines run their modules with the real JSR/JSL frames.
export function chooseEnemyTarget(a, outerReturn = true, random = () => randomBelow(a, false)) {
  return leaf(
    a,
    (h) => {
      const { ctx } = h;
      h.index('y', h.dp(0));
      h.load(h.longRead(h.abs(OBJECT_FLAGS) + ctx.y));
      ctx.status = (ctx.status & ~FLAG_ZERO) | (ctx.a & OBJECT_ON_SCREEN ? 0 : FLAG_ZERO); // BIT #$0004
      if (!(ctx.status & FLAG_ZERO)) {
        a.pushWord(ctx.y, '8bc5-PHY');
        h.load(h.longRead(h.abs(GROUP_LEADER_ONLY)));
        if (!(ctx.status & FLAG_ZERO)) h.index('x', 0);
        else {
          h.load(h.longRead(WRAM + GROUP_INDEX));
          ctx.status = (ctx.status & ~FLAG_CARRY) | (ctx.a & 1);
          h.load(ctx.a >>> 1);
          h.load((ctx.a + 1) & WORD_MASK);
          a.writeWord(0, ctx.a, BANK_WRAP, '8bc5-DP00-limit');
          a.pushWord(RANDOM_RETURN_WORD, '8bc5-JSR-C51F');
          const result = random();
          if (result.rawReturnWord !== RANDOM_RETURN_WORD)
            taskStop('task_native_helper_return_required', {
              actual: result.rawReturnWord,
              expected: RANDOM_RETURN_WORD,
            });
          h.load(h.dp(0));
          h.asl();
          h.index('x', ctx.a);
        }
        h.load(a.pullWord('8bc5-PLA'));
        a.writeWord(0, ctx.a, BANK_WRAP, '8bc5-DP00');
        h.index('y', h.longRead(h.abs(GROUP_SLOTS) + ctx.x));
        h.load(h.longRead(h.abs(OBJECT_FLAGS) + ctx.y));
        ctx.status = (ctx.status & ~FLAG_ZERO) | (ctx.a & OBJECT_NO_TARGET ? 0 : FLAG_ZERO); // BIT #$1000
        if (ctx.status & FLAG_ZERO) {
          a.pushWord(ctx.y, '8bc5-PHY-candidate');
          h.index('x', ctx.y);
          h.index('y', h.dp(0));
          a.write(ctx.s, ctx.programBank, '8bc5-JSL-bank');
          ctx.s = (ctx.s - 1) & WORD_MASK;
          a.pushWord(SIGHT_RETURN_WORD, '8bc5-JSL-WORD');
          ctx.programBank = SIGHT_ROUTINE >>> WORD_BITS;
          ctx.pc = SIGHT_ROUTINE & WORD_MASK;
          const sight = testLineOfSight(h);
          if (sight.rawReturnWord !== SIGHT_RETURN_WORD || ctx.programBank !== CODE_BANK)
            taskStop('task_native_long_return_required', {
              raw: sight.rawReturnWord,
              bank: ctx.programBank,
            });
          h.index('y', a.pullWord('8bc5-PLY-candidate'));
          if (!(ctx.status & FLAG_CARRY)) {
            a.writeWord(0, ctx.y, BANK_WRAP, '8bc5-DP00');
            return;
          }
        }
      }
      h.index('y', WORD_MASK);
      a.writeWord(0, ctx.y, BANK_WRAP, '8bc5-DP00');
    },
    outerReturn,
  );
}
