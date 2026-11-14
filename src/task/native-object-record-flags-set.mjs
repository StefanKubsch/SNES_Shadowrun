import { SECOND_ARGUMENT, indexObjectRecord, leaf } from './native-leaf-support.mjs';
import { RECORD_FLAGS, WRAM } from './wram.mjs';
import { FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

// 80:CAA2: set the flag byte of the record of the object (first argument) to the low
// byte of the second argument (SEP #$20 store); no record, no change.
export const setObjectRecordFlags = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const record = indexObjectRecord(h);
      if (record === 0) return;
      h.ctx.status |= FLAG_MEMORY_8BIT;
      h.longWrite(WRAM + RECORD_FLAGS + record, h.load(h.dp(SECOND_ARGUMENT, 1), 1), 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
