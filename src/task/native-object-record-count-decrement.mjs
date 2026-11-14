import { FIRST_ARGUMENT, leaf, readActorState } from './native-leaf-support.mjs';
import { OBJECT_NUMBER, RECORD_COUNT, WRAM } from './wram.mjs';
import { BYTE_MASK, LONG_MASK, BANK_WRAP, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { protectedJakeHealth } from '../game/cheats.mjs';

const TRUE = WORD_MASK,
  FALSE = 0;

// 80:9DC8: count down the count byte of the state record of the object's actor entry
// (object in the first argument, its actor offset in OBJECT_NUMBER). Return TRUE (FFFF)
// when the count reaches 0 or there is no record, else FALSE (0). With cheats, Jake's
// protected health keeps its value (src/game/cheats.mjs).
export const decrementObjectStateCount = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h;
      const object = h.index('y', h.dp(FIRST_ARGUMENT)),
        actor = h.index('x', h.longRead(h.abs(OBJECT_NUMBER) + object));
      if (readActorState(h, actor) !== 0) {
        const state = h.index('x', ctx.a),
          count = (WRAM + RECORD_COUNT + state) & LONG_MASK;
        let value = h.load((a.read(count, '9dc8-BYTE') - 1) & BYTE_MASK, 1);
        if (a.vm?.cheats) value = h.load(protectedJakeHealth(a, state, value), 1);
        a.write(count, value, '9dc8-BYTE');
        if (!(ctx.status & FLAG_ZERO)) {
          a.writeWord(FIRST_ARGUMENT, FALSE, BANK_WRAP, '9dc8-STZ-DP00');
          return;
        }
      }
      a.writeWord(FIRST_ARGUMENT, h.load(TRUE), BANK_WRAP, '9dc8-DP00');
    },
    outerReturn,
  );
