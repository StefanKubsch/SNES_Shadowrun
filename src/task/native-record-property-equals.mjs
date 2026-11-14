import { RECORD_PROPERTY, WRAM } from './wram.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf, readActorState } from './native-leaf-support.mjs';
import { WORD_MASK, BANK_WRAP } from '../constants/bits.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';

const TRUE = WORD_MASK,
  FALSE = 0;

// 80:9DAE: return TRUE (FFFF) when the property word of the state record of the actor
// entry (second argument) equals the first argument, else FALSE (0); FALSE without a
// record. The flags come from the CMP or the load of TRUE.
export const isActorStateProperty = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(SECOND_ARGUMENT));
      if (readActorState(h, actor) !== 0) {
        const state = h.index('x', h.ctx.a),
          property = h.load(h.longRead(WRAM + RECORD_PROPERTY + state)),
          wanted = h.dp(FIRST_ARGUMENT);
        // CMP: carry when property >= wanted, N and Z from the difference.
        h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(property >= wanted);
        h.nz((property - wanted) & WORD_MASK);
        if (property === wanted) {
          h.result(h.load(TRUE), 'leaf-equal-DP00');
          return;
        }
      }
      a.writeWord(FIRST_ARGUMENT, FALSE, BANK_WRAP, 'leaf-zero-DP00');
    },
    outerReturn,
  );
