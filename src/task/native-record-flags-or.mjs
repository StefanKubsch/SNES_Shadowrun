import { RECORD_FLAGS, WRAM } from './wram.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf, readActorState } from './native-leaf-support.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

// 80:CBB3: set the bits of the second argument's low byte in the flag byte of the
// state record of the actor entry (first argument); no record, no change.
export const setActorStateFlagBits = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      if (readActorState(h, actor) === 0) return;
      const state = h.index('x', h.ctx.a);
      h.ctx.status |= FLAG_MEMORY_8BIT;
      const flags = h.load(a.read(WRAM + RECORD_FLAGS + state, 'leaf-record-BYTE'), 1);
      h.longWrite(
        WRAM + RECORD_FLAGS + state,
        h.load((flags & BYTE_MASK) | h.dp(SECOND_ARGUMENT, 1), 1),
        1,
      );
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
