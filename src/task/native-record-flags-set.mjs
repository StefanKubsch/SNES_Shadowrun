import { RECORD_FLAGS, WRAM } from './wram.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf, readActorState } from './native-leaf-support.mjs';
import { keepVampireDefeated } from '../game/bugfixes.mjs';
import { FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

// 80:CB9F: set the flag byte of the state record of the actor entry (first argument)
// to the low byte of the second argument (SEP #$20 store); no record, no change.
// With exploit prevention, a defeated vampire stays defeated (src/game/bugfixes.mjs).
export const setActorStateFlags = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      if (readActorState(h, actor) === 0) return;
      const state = h.index('x', h.ctx.a);
      if (
        a.vm?.gameplay?.preventExploits &&
        keepVampireDefeated(a, h.dp(FIRST_ARGUMENT), h.dp(SECOND_ARGUMENT, 1), state)
      )
        return;
      h.ctx.status |= FLAG_MEMORY_8BIT;
      const flags = h.load(h.dp(SECOND_ARGUMENT, 1), 1);
      h.longWrite(WRAM + RECORD_FLAGS + state, flags, 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
