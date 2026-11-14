import { RECORD_PROPERTY } from './wram.mjs';
import { leaf, readRecordField } from './native-leaf-support.mjs';

// 80:CA58: return the property word of the record of the object (first argument).
export const getObjectRecordProperty = (a, outerReturn = true) =>
  leaf(a, (h) => readRecordField(h, RECORD_PROPERTY), outerReturn);
