import { FIRST_ARGUMENT, indexObjectRecord, leaf } from './native-leaf-support.mjs';
import { RECORD_PROPERTY, WRAM } from './wram.mjs';
import { BANK_WRAP, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';

const TRUE = WORD_MASK,
  FALSE = 0;

// 80:9D98: return TRUE (FFFF) when the object (first argument) has a record whose
// property word is not negative, else FALSE (0).
export const hasObjectRecordProperty = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const record = indexObjectRecord(h);
      if (record !== 0) {
        h.load(h.longRead(WRAM + RECORD_PROPERTY + record));
        if (!(h.ctx.status & FLAG_NEGATIVE)) {
          h.result(h.load(TRUE), 'C6-true-DP00');
          return;
        }
      }
      // The original STZ does not load A or change N/Z/C/V, even after a negative
      // record word. These live flags and register bytes survive the actual RTS.
      a.writeWord(FIRST_ARGUMENT, FALSE, BANK_WRAP, 'C6-zero-DP00');
    },
    outerReturn,
  );
