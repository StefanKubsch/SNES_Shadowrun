import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';

import { OBJECT_X, OBJECT_Y, PLAYER_OBJECT } from './wram.mjs';
import { WORD_MASK, WORD_SIGN, BANK_WRAP } from '../constants/bits.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';
const DISTANCE_RETURN_WORD = 0xc692,
  DISTANCE_ENTRY = 0x80c696 & WORD_MASK,
  DISTANCE_RESUME = 0x80c693 & WORD_MASK;
// 80:C696..C6BE, shared by 80:C68D (JSR C696) and 80:C694 (falls in after LDY DP02):
// distance of the object (first argument, X) to the object in Y: fresh DP00 X, SEC and
// binary SBC of the X and Y positions at DBR (+X minus +Y), negative differences
// negated by EOR/INC; the larger magnitude (unsigned CMP, fresh DP00 reload) shifted
// right twice to DP00.
export function measureObjectDistance(h) {
  const { a } = h;
  h.index('x', h.dp(FIRST_ARGUMENT));
  h.ctx.status |= FLAG_CARRY;
  h.load(h.longRead(h.abs(OBJECT_X) + h.ctx.x));
  h.arithmetic(h.longRead(h.abs(OBJECT_X) + h.ctx.y), true);
  if (h.ctx.a & WORD_SIGN) {
    h.load(h.ctx.a ^ WORD_MASK);
    h.load((h.ctx.a + 1) & WORD_MASK);
  }
  a.writeWord(FIRST_ARGUMENT, h.ctx.a, BANK_WRAP, 'distance-first-DP00');
  h.ctx.status |= FLAG_CARRY;
  h.load(h.longRead(h.abs(OBJECT_Y) + h.ctx.x));
  h.arithmetic(h.longRead(h.abs(OBJECT_Y) + h.ctx.y), true);
  if (h.ctx.a & WORD_SIGN) {
    h.load(h.ctx.a ^ WORD_MASK);
    h.load((h.ctx.a + 1) & WORD_MASK);
  }
  const right = h.dp(FIRST_ARGUMENT);
  h.nz((h.ctx.a - right) & WORD_MASK);
  h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(h.ctx.a >= right);
  if (!(h.ctx.status & FLAG_CARRY)) h.load(h.dp(FIRST_ARGUMENT));
  for (let n = 0; n < 2; n++) {
    h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | (h.ctx.a & 1);
    h.load(h.ctx.a >>> 1);
  }
  a.writeWord(FIRST_ARGUMENT, h.ctx.a, BANK_WRAP, 'distance-result-DP00');
}
// 80:C68D: distance of the object (first argument) to the player object (0CC2), through
// a real JSR to the shared body 80:C696; the two-byte JSR frame is real data.
export const getDistanceToPlayer = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.index('y', h.longRead(h.abs(PLAYER_OBJECT)));
      a.pushWord(DISTANCE_RETURN_WORD, 'distance-inner-JSR');
      h.ctx.pc = DISTANCE_ENTRY;
      measureObjectDistance(h);
      const raw = a.pullWord('distance-inner-RTS');
      if (raw !== DISTANCE_RETURN_WORD)
        taskStop('task_native_helper_return_required', {
          actual: raw,
          expected: DISTANCE_RETURN_WORD,
        });
      h.ctx.pc = DISTANCE_RESUME;
    },
    outerReturn,
  );
