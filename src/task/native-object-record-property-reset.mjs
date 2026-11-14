import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_RECORD, RECORD_PROPERTY, WRAM, RECORD_PROPERTY_RESET } from './wram.mjs';

// 80:9D7A: reset the property word of the record of the object (first argument).
// Without a record nothing changes and A keeps its value (no record preread).
export const resetObjectRecordProperty = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('y', h.dp(FIRST_ARGUMENT)),
        record = h.index('x', h.longRead(h.abs(OBJECT_RECORD) + object));
      if (record === 0) return;
      h.longWrite(WRAM + RECORD_PROPERTY + record, h.load(RECORD_PROPERTY_RESET));
    },
    outerReturn,
  );
