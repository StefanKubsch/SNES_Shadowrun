import { RECORD_FLAGS, WRAM } from './wram.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf, readActorState } from './native-leaf-support.mjs';
import { LONG_MASK } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

// 80:CBCB: keep only the bits of the second argument's low byte in the flag byte of
// the state record of the actor entry (first argument); no record, no change.
export const keepActorStateFlagBits = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      if (readActorState(h, actor) === 0) return;
      const state = h.index('x', h.ctx.a),
        field = (WRAM + RECORD_FLAGS + state) & LONG_MASK;
      h.ctx.status |= FLAG_MEMORY_8BIT;
      const flags = h.load(a.read(field, 'record-and-field-BYTE'), 1);
      h.longWrite(field, h.load(flags & h.dp(SECOND_ARGUMENT, 1), 1), 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
