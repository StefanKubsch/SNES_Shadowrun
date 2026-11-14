// Object fields that scripts read and change (lifted from the script natives 80:CA05,
// 80:CA0D, 80:CA15 and 80:CA20 for the flag word and 80:CA2B, 80:CA3A, 80:CA49, 80:CA58,
// 80:CAA2, 80:CAB4, 80:CACA and 80:CAE0 for the record, 80:8EF5, 80:8AF1, 80:8AFA and
// 80:8B08 for the armour, 80:A941 to 80:A96D for the motion, 80:D255, 80:D1CA, 80:D17B and
// 80:D16D for the direction, number and sprite mode, 80:A91D and 80:A926 for the task link
// and 80:A92F and 80:D13E for the velocity, 80:A977 for the height, 80:94EE for the
// dialog, 80:D14A for the position, 80:BB90 for the animation and 80:9D6A and 80:9D7A for
// the record property; register-level references in
// proof/game-reference/object-fields.mjs).
//
// An object's flag word (7E:1458 plus its slot) and its record pointer (7E:13A8 plus its
// slot) are reached through the data bank 80 as the original does
// (src/system/data-bank.mjs), so a slot of FFFF (none) reaches the word just below the
// table. A record lies in bank 7E at its pointer: byte 0, the flag byte at +1, the count
// byte (ammunition or body) at +2 and the property word at +3. Without a record (pointer
// 0) the reads return the bytes at 7E:0000 and the writes change nothing.
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import {
  OBJECT_ARMOUR,
  OBJECT_DEPTH_MODE_CLEAR_MASK,
  OBJECT_DEPTH_MODE_MASK,
  OBJECT_DEPTH_ORDER,
  OBJECT_DIRECTION,
  OBJECT_FLAGS,
  OBJECT_NUMBER,
  OBJECT_HEIGHT,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_VELOCITY_Z,
  OBJECT_X,
  OBJECT_Y,
  OBJECT_RECORD,
  OBJECT_TASK,
  NO_TASK,
  OBJECT_DIALOG,
  OBJECT_SELECTION,
  GROUP_NUMBERS,
  RECORD_PROPERTY_RESET,
  RECORD_COUNT,
  RECORD_FLAGS,
  RECORD_PROPERTY,
  WRAM,
} from '../task/wram.mjs';
import { TASK_CURSOR } from '../vm/layout.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_MASK } from '../constants/bits.mjs';

// 80:CA05: the object's flag word.
export const objectFlags = (mem, object) => dataBankWord(mem, OBJECT_FLAGS, object);
// 80:CA0D: replace the object's flag word.
export const setObjectFlags = (mem, object, flags) =>
  setDataBankWord(mem, OBJECT_FLAGS, object, flags & WORD_MASK);
// 80:CA15: set bits in the object's flag word.
export const setObjectFlagBits = (mem, object, bits) =>
  setObjectFlags(mem, object, objectFlags(mem, object) | bits);
// 80:CA20: keep only these bits of the object's flag word.
export const keepObjectFlagBits = (mem, object, bits) =>
  setObjectFlags(mem, object, objectFlags(mem, object) & bits);

// The object's record pointer (0: none).
export const objectRecord = (mem, object) => dataBankWord(mem, OBJECT_RECORD, object);
// A record field's address in bank 7E (a pointer near the bank's end reaches 7F).
const recordAddress = (record, offset) => (WRAM + offset + record) & LONG_MASK;
const recordByte = (mem, object, offset) =>
  mem.read8(recordAddress(objectRecord(mem, object), offset));
// 80:CA2B: byte 0 of the object's record (its meaning is still open).
export const recordFirstByte = (mem, object) => recordByte(mem, object, 0);
// 80:CA3A: the flag byte of the object's record.
export const recordFlags = (mem, object) => recordByte(mem, object, RECORD_FLAGS);
// 80:CA49: the count byte of the object's record.
export const recordCount = (mem, object) => recordByte(mem, object, RECORD_COUNT);
// 80:CA58: the property word of the object's record.
export function recordProperty(mem, object) {
  const at = recordAddress(objectRecord(mem, object), RECORD_PROPERTY);
  return mem.read8(at) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
}
// A byte of the object's record changed by change(old) unless it has no record.
function changeRecordByte(mem, object, offset, change) {
  const record = objectRecord(mem, object);
  if (record === 0) return;
  const at = recordAddress(record, offset);
  mem.write8(at, change(mem.read8(at), record) & BYTE_MASK);
}
// 80:CAA2: the flag byte of the object's record set to the low byte of flags.
export const setRecordFlags = (mem, object, flags) =>
  changeRecordByte(mem, object, RECORD_FLAGS, () => flags);
// 80:CAB4: bits (low byte) set in the flag byte of the object's record.
export const setRecordFlagBits = (mem, object, bits) =>
  changeRecordByte(mem, object, RECORD_FLAGS, (old) => old | bits);
// 80:CACA: only these bits (low byte) kept in the flag byte of the object's record.
export const keepRecordFlagBits = (mem, object, bits) =>
  changeRecordByte(mem, object, RECORD_FLAGS, (old) => old & bits);
// 80:CAE0: the count byte of the object's record set to the low byte of count; guard
// (record, count) may change the count stored (the health cheat, src/game/cheats.mjs).
export const setRecordCount = (mem, object, count, guard = (_record, value) => value) =>
  changeRecordByte(mem, object, RECORD_COUNT, (_old, record) => guard(record, count & BYTE_MASK));

// The object's armour word (7E:43F8 plus its slot, a long index: a slot near FFFF
// reaches bank 7F).
const armourAddress = (object) => (WRAM + OBJECT_ARMOUR + object) & LONG_MASK;
// 80:8EF5: the object's armour.
export function objectArmour(mem, object) {
  const at = armourAddress(object);
  return mem.read8(at) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
}
// 80:8AF1: the object's armour set.
export function storeObjectArmour(mem, object, armour) {
  const at = armourAddress(object);
  mem.write8(at, armour & BYTE_MASK);
  mem.write8((at + 1) & LONG_MASK, (armour >>> BYTE_BITS) & BYTE_MASK);
}
// 80:8AFA and 80:8B08: the armour raised or lowered by amount, wrapping in 16 bits.
export const raiseObjectArmour = (mem, object, amount) =>
  storeObjectArmour(mem, object, objectArmour(mem, object) + amount);
export const lowerObjectArmour = (mem, object, amount) =>
  storeObjectArmour(mem, object, objectArmour(mem, object) - amount);

// The object's velocities (80:A941, 80:A949, 80:A951) through the data bank 80.
export const objectVelocityX = (mem, object) => dataBankWord(mem, OBJECT_VELOCITY_X, object);
export const objectVelocityY = (mem, object) => dataBankWord(mem, OBJECT_VELOCITY_Y, object);
export const objectVelocityZ = (mem, object) => dataBankWord(mem, OBJECT_VELOCITY_Z, object);
// The object's position and height in box units, over 4 (80:A959, 80:A963, 80:A96D).
const BOX_SHIFT = 2;
export const objectCoarseX = (mem, object) => dataBankWord(mem, OBJECT_X, object) >>> BOX_SHIFT;
export const objectCoarseY = (mem, object) => dataBankWord(mem, OBJECT_Y, object) >>> BOX_SHIFT;
export const objectCoarseHeight = (mem, object) =>
  dataBankWord(mem, OBJECT_HEIGHT, object) >>> BOX_SHIFT;

// 80:D255: the object's facing direction (low byte).
export const objectDirection = (mem, object) =>
  dataBankWord(mem, OBJECT_DIRECTION, object) & BYTE_MASK;
// 80:D1CA: the object's number.
export const objectNumber = (mem, object) => dataBankWord(mem, OBJECT_NUMBER, object);
// 80:D17B: the sprite mode bits of the object's depth order word.
export const spriteMode = (mem, object) =>
  dataBankWord(mem, OBJECT_DEPTH_ORDER, object) & OBJECT_DEPTH_MODE_MASK;
// 80:D16D: the sprite mode bits replaced by mode (not masked: other bits it holds are
// set too); the other depth order bits stay.
export const storeSpriteMode = (mem, object, mode) =>
  setDataBankWord(
    mem,
    OBJECT_DEPTH_ORDER,
    object,
    (dataBankWord(mem, OBJECT_DEPTH_ORDER, object) & OBJECT_DEPTH_MODE_CLEAR_MASK) | mode,
  );

// 80:A91D: detach the object from its task.
export const clearObjectTask = (mem, object) => setDataBankWord(mem, OBJECT_TASK, object, NO_TASK);
// 80:A926: bind the object to the currently running task.
export const bindObjectToCurrentTask = (mem, object) =>
  setDataBankWord(mem, OBJECT_TASK, object, dataBankWord(mem, TASK_CURSOR));
// 80:A92F: set the object's X, Y and Z velocity.
export const setObjectVelocity = (mem, object, x, y, z) => {
  setDataBankWord(mem, OBJECT_VELOCITY_X, object, x);
  setDataBankWord(mem, OBJECT_VELOCITY_Y, object, y);
  setDataBankWord(mem, OBJECT_VELOCITY_Z, object, z);
};
// 80:D13E: stop the object (all three velocities zero).
export const clearObjectVelocity = (mem, object) => setObjectVelocity(mem, object, 0, 0, 0);
// 80:A977: raise the object's height by four times amount (heights are in quarter
// units), wrapping in 16 bits.
const QUARTERS = 4;
export const raiseObjectHeight = (mem, object, amount) =>
  setDataBankWord(
    mem,
    OBJECT_HEIGHT,
    object,
    (((amount * QUARTERS) & WORD_MASK) + dataBankWord(mem, OBJECT_HEIGHT, object)) & WORD_MASK,
  );

// 80:94EE: the dialog record the action glove starts for the object (7E:4450 plus its
// slot, a long index).
export const setObjectDialog = (mem, object, dialog) =>
  mem.write16((WRAM + OBJECT_DIALOG + object) & LONG_MASK, dialog);
// 80:D14A: place the object at x, y and height.
export function setObjectPosition(mem, object, x, y, height) {
  setDataBankWord(mem, OBJECT_X, object, x);
  setDataBankWord(mem, OBJECT_Y, object, y);
  setDataBankWord(mem, OBJECT_HEIGHT, object, height);
}
// 80:BB90: TRUE (FFFF) when the object has no animation selected (FFFF), else 0.
export const hasNoAnimation = (mem, object) =>
  dataBankWord(mem, OBJECT_SELECTION, object) === WORD_MASK ? WORD_MASK : 0;
// The property word of the object's record set to value unless it has no record.
function setRecordProperty(mem, object, value) {
  const record = objectRecord(mem, object);
  if (record === 0) return;
  const at = recordAddress(record, RECORD_PROPERTY);
  mem.write8(at, value & BYTE_MASK);
  mem.write8((at + 1) & LONG_MASK, value >>> BYTE_BITS);
}
// 80:9D6A: the record property set to the first group member's number (7E:2DF0).
export const setRecordPropertyFromGroup = (mem, object) =>
  setRecordProperty(mem, object, mem.read16(WRAM + GROUP_NUMBERS));
// 80:9D7A: the record property reset to 1538.
export const resetRecordProperty = (mem, object) =>
  setRecordProperty(mem, object, RECORD_PROPERTY_RESET);
