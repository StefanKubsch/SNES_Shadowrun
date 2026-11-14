import { RECORD_COUNT } from './wram.mjs';
import { leaf, readRecordField } from './native-leaf-support.mjs';

// 80:CA49: return the count byte (ammunition or body) of the record of the object (first argument).
export const getObjectRecordCount = (a, outerReturn = true) =>
  leaf(a, (h) => readRecordField(h, RECORD_COUNT, 1), outerReturn);
