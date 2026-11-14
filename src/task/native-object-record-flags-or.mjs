import { SECOND_ARGUMENT, indexObjectRecord, leaf } from './native-leaf-support.mjs';
import { RECORD_FLAGS, WRAM } from './wram.mjs';
import { LONG_MASK, BYTE_MASK } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

// 80:CAB4: set the bits of the second argument's low byte in the flag byte of the
// record of the object (first argument); no record, no change. The record pointer is
// read as a full word; the OR and the store are byte wide.
export const setObjectRecordFlagBits = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const record = indexObjectRecord(h);
      if (record === 0) return;
      h.ctx.status |= FLAG_MEMORY_8BIT;
      const address = WRAM + RECORD_FLAGS + record,
        flags = h.load(a.read(address & LONG_MASK, 'native33-record-BYTE'), 1);
      h.longWrite(address, h.load((flags & BYTE_MASK) | h.dp(SECOND_ARGUMENT, 1), 1), 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
