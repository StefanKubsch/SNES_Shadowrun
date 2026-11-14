import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { GROUP_NUMBERS, OBJECT_RECORD, WRAM, RECORD_PROPERTY } from './wram.mjs';

// 80:9D6A: set the property word of the record of the object (first argument) to the
// first word of the group numbers (7E:2DF0); an object without a record is unchanged.
export const setObjectRecordPropertyFromGroup = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('y', h.dp(FIRST_ARGUMENT)),
        record = h.index('x', h.longRead(h.abs(OBJECT_RECORD) + object));
      if (record === 0) return;
      h.longWrite(WRAM + RECORD_PROPERTY + record, h.load(h.longRead(WRAM + GROUP_NUMBERS)));
    },
    outerReturn,
  );
