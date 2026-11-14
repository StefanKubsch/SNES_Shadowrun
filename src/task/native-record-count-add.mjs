import { RECORD_COUNT, WRAM } from './wram.mjs';
import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf, readActorState } from './native-leaf-support.mjs';
import { LONG_MASK, BYTE_MASK, BYTE_SIGN } from '../constants/bits.mjs';
import {
  FLAG_MEMORY_8BIT,
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_OVERFLOW,
} from '../constants/cpu-flags.mjs';

// The byte sum is wrapped before it is clamped to six.
const COUNT_MAX = 6;
const COUNT_LIMIT = COUNT_MAX + 1;

// 80:9DEC: add the second argument's low byte to the count byte of the state record of
// the actor entry (first argument), at most six (CLC, byte ADC, CMP #7, BCC); no record,
// no change.
export const addActorStateCount = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      if (readActorState(h, actor) === 0) return;
      const state = h.index('x', h.ctx.a);
      h.ctx.status |= FLAG_MEMORY_8BIT;
      h.ctx.status &= ~FLAG_CARRY;
      h.load(a.read((WRAM + RECORD_COUNT + state) & LONG_MASK, 'native26-record-BYTE'), 1);
      if (h.ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
      const left = h.ctx.a & BYTE_MASK,
        right = h.dp(SECOND_ARGUMENT, 1),
        sum = left + right,
        result = sum & BYTE_MASK,
        overflow = (~(left ^ right) & (left ^ result) & BYTE_SIGN) !== 0;
      h.ctx.status =
        (h.ctx.status & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
        Number(sum > BYTE_MASK) |
        (overflow ? FLAG_OVERFLOW : 0);
      h.load(result, 1);
      h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(result >= COUNT_LIMIT);
      h.nz((result - COUNT_LIMIT) & BYTE_MASK, 1);
      if (h.ctx.status & FLAG_CARRY) h.load(COUNT_MAX, 1);
      h.longWrite(WRAM + RECORD_COUNT + state, h.ctx.a, 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
