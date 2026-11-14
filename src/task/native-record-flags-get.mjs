import { RECORD_FLAGS, WRAM } from './wram.mjs';
import { FIRST_ARGUMENT, leaf, readActorState } from './native-leaf-support.mjs';
import { akimiArrivalFlags, fixesEnabled } from '../game/bugfixes.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// 80:CB2B: return the flag byte of the state record of the actor entry (first argument).
// With bug fixes enabled, Akimi's arrival flags are corrected (src/game/bugfixes.mjs).
export const getActorStateFlags = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT)),
        state = h.index('x', readActorState(h, actor)),
        word = h.load(h.longRead(WRAM + RECORD_FLAGS + state));
      let flags = h.load(word & BYTE_MASK);
      if (fixesEnabled(a)) flags = h.load(akimiArrivalFlags(a, h.dp(FIRST_ARGUMENT), flags));
      h.result(flags);
    },
    outerReturn,
  );
