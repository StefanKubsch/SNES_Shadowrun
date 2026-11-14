import { RECORD_COUNT, WRAM } from './wram.mjs';
import { FIRST_ARGUMENT, leaf, readActorState } from './native-leaf-support.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// 80:CB3C: return the count byte of the state record of the actor entry (first argument).
// An actor without a record reads its count from WRAM address 2.
export const getActorStateCount = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT)),
        state = h.index('x', readActorState(h, actor)),
        word = h.load(h.longRead(WRAM + RECORD_COUNT + state));
      h.result(h.load(word & BYTE_MASK), 'nativeC7-result-WORD');
    },
    outerReturn,
  );
