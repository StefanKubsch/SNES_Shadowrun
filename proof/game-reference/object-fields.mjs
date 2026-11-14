// Register-level references of the object field script natives (moved from
// src/task/native-object-flags-*.mjs, src/task/native-object-record-*.mjs and
// src/task/native-object-armour-*.mjs and the motion getters; lifted in
// src/game/object-fields.mjs). The proof plans and the Native58 dispatch of
// proof/task/native-dispatch.mjs run these; the game runs the lifted natives.
import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  indexObjectRecord,
  leaf,
  readRecordField,
} from '../../src/task/native-leaf-support.mjs';
import {
  OBJECT_ARMOUR,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_RECORD,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_VELOCITY_Z,
  OBJECT_X,
  OBJECT_Y,
  RECORD_COUNT,
  RECORD_FLAGS,
  RECORD_PROPERTY,
  WRAM,
} from '../../src/task/wram.mjs';
import { BYTE_MASK, LONG_MASK } from '../../src/constants/bits.mjs';
import { FLAG_MEMORY_8BIT } from '../../src/constants/cpu-flags.mjs';
import { protectedJakeHealth } from '../../src/game/cheats.mjs';

// 80:CA05: return the flag word of the object (first argument).
export const getObjectFlagsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(h.abs(OBJECT_FLAGS) + object)));
    },
    outerReturn,
  );
// 80:CA0D: replace the flag word of the object (first argument) with the second argument.
export const setObjectFlagsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        flags = h.load(h.dp(SECOND_ARGUMENT));
      h.longWrite(h.abs(OBJECT_FLAGS) + object, flags);
    },
    outerReturn,
  );
// 80:CA15: set the bits of the second argument in the flag word of the object (first argument).
export const setObjectFlagBitsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        bits = h.load(h.dp(SECOND_ARGUMENT)),
        address = h.abs(OBJECT_FLAGS) + object;
      h.longWrite(address, h.load(bits | h.longRead(address)));
    },
    outerReturn,
  );
// 80:CA20: keep only the bits of the second argument in the flag word of the object (first argument).
export const keepObjectFlagBitsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        bits = h.load(h.dp(SECOND_ARGUMENT)),
        address = h.abs(OBJECT_FLAGS) + object;
      h.longWrite(address, h.load(bits & h.longRead(address)));
    },
    outerReturn,
  );
// 80:CA2B: return byte 0 of the record of the object (first argument); the meaning of
// this field is still open. The record word is read whole and then masked to its low
// byte. Without a record, X = 0 and the byte at WRAM 7E:0000 is returned.
export const getObjectRecordFirstByteReference = (a, outerReturn = true) =>
  leaf(a, (h) => readRecordField(h, 0, 1), outerReturn);
// 80:CA3A: return the flag byte of the record of the object (first argument).
export const getObjectRecordFlagsReference = (a, outerReturn = true) =>
  leaf(a, (h) => readRecordField(h, RECORD_FLAGS, 1), outerReturn);
// 80:CA49: return the count byte (ammunition or body) of the record of the object (first argument).
export const getObjectRecordCountReference = (a, outerReturn = true) =>
  leaf(a, (h) => readRecordField(h, RECORD_COUNT, 1), outerReturn);
// 80:CA58: return the property word of the record of the object (first argument).
export const getObjectRecordPropertyReference = (a, outerReturn = true) =>
  leaf(a, (h) => readRecordField(h, RECORD_PROPERTY), outerReturn);
// 80:CAA2: set the flag byte of the record of the object (first argument) to the low
// byte of the second argument (SEP #$20 store); no record, no change.
export const setObjectRecordFlagsReference = (a, outerReturn = true) =>
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
// 80:CAB4: set the bits of the second argument's low byte in the flag byte of the
// record of the object (first argument); no record, no change. The record pointer is
// read as a full word; the OR and the store are byte wide.
export const setObjectRecordFlagBitsReference = (a, outerReturn = true) =>
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
// 80:CACA: keep only the bits of the second argument's low byte in the flag byte of
// the record of the object (first argument); no record, no change. The record pointer
// is read as a full word; the AND and the store are byte wide.
export const keepObjectRecordFlagBitsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const record = indexObjectRecord(h);
      if (record === 0) return;
      h.ctx.status |= FLAG_MEMORY_8BIT;
      const address = WRAM + RECORD_FLAGS + record,
        flags = h.load(a.read(address & LONG_MASK, 'native7a-record-BYTE'), 1);
      h.longWrite(address, h.load(flags & BYTE_MASK & h.dp(SECOND_ARGUMENT, 1), 1), 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
// 80:CAE0: set the count byte (ammunition or body) of the record of the object (first
// argument) to the low byte of the second argument; no record, no change. With cheats
// on, Jake's health is protected (src/game/cheats.mjs).
export const setObjectRecordCountReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('y', h.dp(FIRST_ARGUMENT)),
        record = h.index('x', h.longRead(h.abs(OBJECT_RECORD) + object));
      if (record === 0) return;
      h.ctx.status |= FLAG_MEMORY_8BIT;
      let count = h.load(h.dp(SECOND_ARGUMENT, 1), 1);
      if (a.vm?.cheats) count = h.load(protectedJakeHealth(a, record, count), 1);
      h.longWrite(WRAM + RECORD_COUNT + record, count, 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
// 80:8EF5: return the armour of the object (first argument).
export const getObjectArmourReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(WRAM + OBJECT_ARMOUR + object)));
    },
    outerReturn,
  );
// 80:8AF1: set the armour of the object (first argument) to the second argument.
export const setObjectArmourReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        armour = h.load(h.dp(SECOND_ARGUMENT));
      h.longWrite(WRAM + OBJECT_ARMOUR + object, armour);
    },
    outerReturn,
  );
// 80:8AFA: armour of the object (first argument) plus the second argument,
// as a wrapping 16-bit sum without a limit. X keeps the object index.
export const addObjectArmourReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        armour = h.add(h.longRead(WRAM + OBJECT_ARMOUR + object), h.dp(SECOND_ARGUMENT));
      h.longWrite(WRAM + OBJECT_ARMOUR + object, armour);
    },
    outerReturn,
  );
// 80:8B08: armour of the object (first argument) minus the second argument,
// as a wrapping 16-bit difference without a lower limit. X keeps the object index.
export const subtractObjectArmourReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        armour = h.subtract(h.longRead(WRAM + OBJECT_ARMOUR + object), h.dp(SECOND_ARGUMENT));
      h.longWrite(WRAM + OBJECT_ARMOUR + object, armour);
    },
    outerReturn,
  );
// 80:A941: return the X velocity of the object (first argument).
export const getObjectVelocityXReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(h.abs(OBJECT_VELOCITY_X) + object)));
    },
    outerReturn,
  );
// 80:A949: return the Y velocity of the object (first argument).
export const getObjectVelocityYReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(h.abs(OBJECT_VELOCITY_Y) + object)));
    },
    outerReturn,
  );
// 80:A951: return the Z (height) velocity of the object (first argument).
export const getObjectVelocityZReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(h.abs(OBJECT_VELOCITY_Z) + object)));
    },
    outerReturn,
  );
// 80:A959: return the X position of the object (first argument) divided by four
// (two LSRs; the carry keeps the second shifted-out bit).
export const getObjectCoarseXReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(h.longRead(h.abs(OBJECT_X) + object));
      h.lsr();
      h.result(h.lsr());
    },
    outerReturn,
  );
// 80:A963: return the Y position of the object (first argument) divided by four
// (two LSRs; the carry keeps the second shifted-out bit).
export const getObjectCoarseYReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(h.longRead(h.abs(OBJECT_Y) + object));
      h.lsr();
      h.result(h.lsr());
    },
    outerReturn,
  );
// 80:A96D: return the height of the object (first argument) divided by four
// (two LSRs; the carry keeps the second shifted-out bit).
export const getObjectCoarseHeightReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(h.longRead(h.abs(OBJECT_HEIGHT) + object));
      h.lsr();
      h.result(h.lsr());
    },
    outerReturn,
  );
