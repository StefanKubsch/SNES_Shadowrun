import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { FLAG_NEGATIVE, FLAG_CARRY } from '../constants/cpu-flags.mjs';
import { WORD_MASK } from '../constants/bits.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
import { BRIGHTNESS_FADE, BRIGHTNESS_FADE_FRAMES } from './wram.mjs';
const FADE_RETURN_WORD = 0xd9b6,
  FADE_FRAMES_BASE = 8;
// 80:D9AD: start a brightness fade with step -n (first argument n; positive n darkens):
// A = -n by EOR #FFFF and INC, then JSL 81:B0AC (real JSL/RTL frame) stores the step in
// BRIGHTNESS_FADE and |step| + 8 in BRIGHTNESS_FADE_FRAMES (the sign comes from the INC).
export const startBrightnessFade = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h;
      h.load(h.dp(FIRST_ARGUMENT));
      h.load(ctx.a ^ WORD_MASK);
      h.load(ctx.a + 1);
      a.write(ctx.s, CODE_BANK, 'd9ad-JSL-bank');
      ctx.s = (ctx.s - 1) & WORD_MASK;
      a.pushWord(FADE_RETURN_WORD, 'd9ad-JSL-WORD');
      h.longWrite(h.abs(BRIGHTNESS_FADE), ctx.a);
      if (ctx.status & FLAG_NEGATIVE) {
        h.load(ctx.a ^ WORD_MASK);
        h.load(ctx.a + 1);
      }
      ctx.status &= ~FLAG_CARRY;
      h.arithmetic(FADE_FRAMES_BASE);
      h.longWrite(h.abs(BRIGHTNESS_FADE_FRAMES), ctx.a);
      const raw = a.pullWord('b0ac-RTL-WORD');
      ctx.s = (ctx.s + 1) & WORD_MASK;
      const bank = a.read(ctx.s, 'b0ac-RTL-bank');
      if (raw !== FADE_RETURN_WORD || bank !== CODE_BANK)
        taskStop('task_native_helper_return_required', { actual: raw, bank });
      ctx.pc = (raw + 1) & WORD_MASK;
    },
    outerReturn,
  );
