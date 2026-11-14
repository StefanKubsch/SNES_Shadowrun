import { leaf, readRecordField } from './native-leaf-support.mjs';

// 80:CA2B: return byte 0 of the record of the object (first argument); the meaning of
// this field is still open. The record word is read whole and then masked to its low
// byte. Without a record, X = 0 and the byte at WRAM 7E:0000 is returned.
export const getObjectRecordFirstByte = (a, outerReturn = true) =>
  leaf(a, (h) => readRecordField(h, 0, 1), outerReturn);
