import { RECORD_PROPERTY, WRAM } from './wram.mjs';
import { FIRST_ARGUMENT, leaf, readActorState } from './native-leaf-support.mjs';

// 80:CB4D: return the property word of the state record of the actor entry (first
// argument). An actor without a record reads WRAM address 3 (a real null read).
export const getActorStateProperty = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT)),
        state = h.index('x', readActorState(h, actor));
      h.result(h.load(h.longRead(WRAM + RECORD_PROPERTY + state)), 'nativeCD-result-WORD');
    },
    outerReturn,
  );
