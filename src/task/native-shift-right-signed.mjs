import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { BANK_WRAP, WORD_BITS } from '../constants/bits.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';

const SIGN_SHIFT = WORD_BITS - 1;

// 80:D9A7: halve the first argument in place as a signed word (LDA, ASL A puts the sign
// into the carry, ROR of the fresh DP00 shifts it back in). A keeps the ASL result;
// N, Z and C come from the ROR.
export const halveArgumentSigned = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.load(h.dp(FIRST_ARGUMENT));
      h.asl();
      const sign = h.ctx.status & FLAG_CARRY,
        word = h.dp(FIRST_ARGUMENT),
        halved = (word >>> 1) | (sign << SIGN_SHIFT);
      h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | (word & 1);
      h.nz(halved);
      a.writeWord(FIRST_ARGUMENT, halved, BANK_WRAP, 'leaf-ROR-DP00');
    },
    outerReturn,
  );
