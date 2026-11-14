import { RECORD_FLAGS } from './wram.mjs';
import { leaf, readRecordField } from './native-leaf-support.mjs';

// 80:CA3A: return the flag byte of the record of the object (first argument).
export const getObjectRecordFlags = (a, outerReturn = true) =>
  leaf(a, (h) => readRecordField(h, RECORD_FLAGS, 1), outerReturn);
