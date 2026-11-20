// The object table: one entry per object slot, each field a named array
// (docs/STATE-MODEL-REBUILD.md, phase 2). Game code reads and writes objects through
// these fields instead of WRAM addresses.
//
// A slot value is what scripts and natives pass around: the slot's byte offset in the
// original word arrays (0, 2, ..., 0x56). index(slot) turns it into the entry number.
//
// For now each field is a view onto its original WRAM array, so the bytes stay where
// the projection (proof/) and the save code expect them. When the subsystem's storage
// is detached, the fields get their own buffers and the projection copies them.
import { taskStop } from '../system/task-stop.mjs';
import {
  MOTION_ACTIVE,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_DIAGONAL,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_LAST_SLOT,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_VELOCITY_Z,
  OBJECT_X,
  OBJECT_Y,
} from '../data/wram.mjs';

const SLOT_BYTES = Uint16Array.BYTES_PER_ELEMENT;
export const OBJECT_SLOTS = OBJECT_LAST_SLOT / SLOT_BYTES + 1;

// Field name: WRAM array of the original. All fields are 16-bit words.
const FIELDS = Object.freeze({
  x: OBJECT_X,
  y: OBJECT_Y,
  height: OBJECT_HEIGHT,
  velocityX: OBJECT_VELOCITY_X,
  velocityY: OBJECT_VELOCITY_Y,
  velocityZ: OBJECT_VELOCITY_Z,
  // (x + y) / 2, the depth sort's key.
  diagonal: OBJECT_DIAGONAL,
  flags: OBJECT_FLAGS,
  // Signed collision box extents in quarter units, from the action record header.
  boxX1: OBJECT_BOX_X1,
  boxX2: OBJECT_BOX_X2,
  boxY1: OBJECT_BOX_Y1,
  boxY2: OBJECT_BOX_Y2,
  boxHeight: OBJECT_BOX_HEIGHT,
  // Non-zero while the object walks towards a motion target.
  motionActive: MOTION_ACTIVE,
});
export const OBJECT_FIELDS = FIELDS;

const tables = new WeakMap();
// The object table of a game's WRAM.
export function objectTable(wram) {
  let table = tables.get(wram);
  if (!table) {
    table = {};
    for (const [name, at] of Object.entries(FIELDS))
      table[name] = new Uint16Array(wram.buffer, wram.byteOffset + at, OBJECT_SLOTS);
    tables.set(wram, table);
  }
  return table;
}

// The entry number of a slot value; anything but a slot of the table stops the task.
export function objectIndex(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot > OBJECT_LAST_SLOT || slot % SLOT_BYTES)
    taskStop('object_slot_required', { slot });
  return slot / SLOT_BYTES;
}
