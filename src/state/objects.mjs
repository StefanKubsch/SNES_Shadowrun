import { combatByte, setCombatByte } from './combat.mjs';
import { windowTextByte, setWindowTextByte } from './windows-text.mjs';
import { cameraMapByte, setCameraMapByte } from './camera-maps.mjs';
import { collisionByte, setCollisionByte } from './collision.mjs';
// The object table: one entry per object slot, each field a named array
// (docs/STATE-MODEL-REBUILD.md, phase 2). Game code reads and writes objects through
// these fields instead of WRAM addresses.
//
// A slot value is what scripts and natives pass around: the slot's byte offset in the
// original word arrays (0, 2, ..., 0x56). index(slot) turns it into the entry number.
//
// The live game owns independent typed arrays. The original byte addresses remain
// an explicit compatibility boundary for overlapping intro, OAM and matrix data and
// indirect native arguments. Proof fixtures can retain views onto their input WRAM;
// proof/state/to-wram.mjs projects the live fields for comparisons.
//
// Scripts also pass values that are no slot, above all FFFF for "none". The original
// then reads or writes the word at field + value: through its data bank 80 (the low
// WRAM mirror, so FFFF reaches the word just below the field) or, where it uses a long
// index, in bank 7E (FFFF reaches bank 7F). objectWord and longObjectWord keep that for
// such values; slots go through the arrays.
import { taskStop } from '../system/task-stop.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import {
  MOTION_ACTIVE,
  MOTION_MODE,
  MOTION_X,
  MOTION_Y,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_ANIMATION_CLOCK,
  OBJECT_ANIMATION_SPEED,
  OBJECT_ARMOUR,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_DEPTH_BIAS,
  OBJECT_DEPTH_ORDER,
  OBJECT_DEPTH_RULE,
  OBJECT_DIAGONAL,
  OBJECT_DIALOG,
  OBJECT_DIRECTION,
  OBJECT_FLAGS,
  OBJECT_FRAME_COUNT,
  OBJECT_FRAME_OFFSET,
  OBJECT_FRAME_REPEATS,
  OBJECT_HEIGHT,
  OBJECT_KIND,
  OBJECT_NUMBER,
  OBJECT_LAST_SLOT,
  OBJECT_PALETTE,
  OBJECT_PICTURE,
  OBJECT_PICTURE_CHANGE,
  OBJECT_RECORD,
  OBJECT_SELECTION,
  OBJECT_TASK,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_VELOCITY_Z,
  OBJECT_VRAM_SLOT_COUNT,
  OBJECT_VRAM_SLOT_HEAD,
  OBJECT_X,
  OBJECT_Y,
  WRAM,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

const SLOT_BYTES = Uint16Array.BYTES_PER_ELEMENT,
  WRAM_BYTES = 0x20000,
  LOW_WRAM_END = 0x2000;
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
  // The motion towards a target: 1 while started, its mode (0 straight, 1 axis by
  // axis) and the target (a point times four, or X 0 and the target object in Y).
  motionActive: MOTION_ACTIVE,
  motionMode: MOTION_MODE,
  motionX: MOTION_X,
  motionY: MOTION_Y,
  // Index into the kind table; bit 15 set marks a free slot.
  kind: OBJECT_KIND,
  number: OBJECT_NUMBER,
  // The task the object belongs to (negative: none) and its record pointer (0: none).
  task: OBJECT_TASK,
  record: OBJECT_RECORD,
  armour: OBJECT_ARMOUR,
  // The dialog record the action glove starts.
  dialog: OBJECT_DIALOG,
  // Low byte: the facing direction.
  direction: OBJECT_DIRECTION,
  // Drawing: depth sort rule, bias and order bits; the animation selection (FFFF none),
  // the action record's direction list, the picture and its pending change, the
  // palette and the VRAM slot chain.
  depthRule: OBJECT_DEPTH_RULE,
  depthBias: OBJECT_DEPTH_BIAS,
  depthOrder: OBJECT_DEPTH_ORDER,
  selection: OBJECT_SELECTION,
  actionDirections: OBJECT_ACTION_DIRECTIONS,
  picture: OBJECT_PICTURE,
  pictureChange: OBJECT_PICTURE_CHANGE,
  palette: OBJECT_PALETTE,
  vramSlotCount: OBJECT_VRAM_SLOT_COUNT,
  vramSlotHead: OBJECT_VRAM_SLOT_HEAD,
  // Animation: speed added to the clock, the repeats left of the frame word, its offset
  // in the frame stream and the frame count.
  animationSpeed: OBJECT_ANIMATION_SPEED,
  animationClock: OBJECT_ANIMATION_CLOCK,
  frameRepeats: OBJECT_FRAME_REPEATS,
  frameOffset: OBJECT_FRAME_OFFSET,
  frameCount: OBJECT_FRAME_COUNT,
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

// Install the live storage before the loop starts, importing the initial bytes
// once. Repeated calls keep the same table and arrays.
const detached = new WeakSet();
export function detachObjectStorage(wram) {
  const table = objectTable(wram);
  if (!detached.has(wram)) {
    for (const name of Object.keys(FIELDS)) table[name] = table[name].slice();
    detached.add(wram);
  }
  return table;
}
export const hasDetachedObjects = (wram) => detached.has(wram);

// Whether a value is a slot of the table.
export const isObjectSlot = (slot) =>
  Number.isInteger(slot) && slot >= 0 && slot <= OBJECT_LAST_SLOT && slot % SLOT_BYTES === 0;

// The entry number of a slot; anything but a slot of the table stops the task. For loops
// over the table and slots the game made itself.
export function objectIndex(slot) {
  if (!isObjectSlot(slot)) taskStop('object_slot_required', { slot });
  return slot / SLOT_BYTES;
}

// A field of the object a script names: the entry for a slot, else the original's word
// through the data bank 80.
export function objectWord(mem, name, slot) {
  if (isObjectSlot(slot)) return objectTable(mem.wram)[name][slot / SLOT_BYTES];
  return dataBankWord(mem, FIELDS[name], slot);
}
export function setObjectWord(mem, name, slot, value) {
  if (isObjectSlot(slot)) objectTable(mem.wram)[name][slot / SLOT_BYTES] = value;
  else setDataBankWord(mem, FIELDS[name], slot, value & WORD_MASK);
}
// The same on the WRAM alone: a value that is no slot reaches WRAM at field + value,
// wrapping at the end of WRAM.
const wramAt = (name, slot) => (FIELDS[name] + slot) % WRAM_BYTES;
export function objectWordIn(wram, name, slot) {
  if (isObjectSlot(slot)) return objectTable(wram)[name][slot / SLOT_BYTES];
  const at = wramAt(name, slot);
  return readStateByte(wram, at) | (readStateByte(wram, (at + 1) % WRAM_BYTES) << BYTE_BITS);
}
export function setObjectWordIn(wram, name, slot, value) {
  if (isObjectSlot(slot)) {
    objectTable(wram)[name][slot / SLOT_BYTES] = value;
    return;
  }
  const at = wramAt(name, slot);
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, (at + 1) % WRAM_BYTES, (value >>> BYTE_BITS) & BYTE_MASK);
}
// A field through the original's data bank 80 where only the low WRAM mirror is safe:
// a value whose word lies at or above 2000 stops the task.
export function lowObjectWord(wram, name, slot) {
  const base = FIELDS[name];
  if (base + slot + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { base, index: slot });
  return objectWordIn(wram, name, slot);
}
export function setLowObjectWord(wram, name, slot, value) {
  const base = FIELDS[name];
  if (base + slot + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { base, index: slot });
  setObjectWordIn(wram, name, slot, value);
}
// A field through the caller's data bank register (a.ctx.bank) for values that are no
// slot; a is a task accessor.
const bankAddress = (a, name, slot) =>
  ((a.ctx.bank << WORD_BITS) + FIELDS[name] + slot) & LONG_MASK;
export function bankObjectWord(a, name, slot) {
  if (isObjectSlot(slot)) return objectTable(a.mem.wram)[name][slot / SLOT_BYTES];
  return a.mem.read16(bankAddress(a, name, slot));
}
export function setBankObjectWord(a, name, slot, value) {
  if (isObjectSlot(slot)) objectTable(a.mem.wram)[name][slot / SLOT_BYTES] = value;
  else a.mem.write16(bankAddress(a, name, slot), value & WORD_MASK);
}
// The same with the original's long index in bank 7E for values that are no slot.
const longAddress = (name, slot) => (WRAM + FIELDS[name] + slot) & LONG_MASK;
export function longObjectWord(mem, name, slot) {
  if (isObjectSlot(slot)) return objectTable(mem.wram)[name][slot / SLOT_BYTES];
  return mem.read16(longAddress(name, slot));
}
export function setLongObjectWord(mem, name, slot, value) {
  if (isObjectSlot(slot)) objectTable(mem.wram)[name][slot / SLOT_BYTES] = value;
  else mem.write16(longAddress(name, slot), value & WORD_MASK);
}

// Byte aliases at the legacy boundary. The mapping is shared by every game; only
// fields owned by the object table are redirected. The raw WRAM bytes are never
// refreshed as a side effect of a read or a projection.
const byteFields = [];
for (const [name, base] of Object.entries(FIELDS)) {
  for (let index = 0; index < OBJECT_SLOTS; index++) {
    byteFields[base + index * SLOT_BYTES] = { name, index, shift: 0 };
    byteFields[base + index * SLOT_BYTES + 1] = { name, index, shift: BYTE_BITS };
  }
}
export function readStateByte(wram, at) {
  const field = detached.has(wram) && byteFields[at];
  if (!field)
    return (
      collisionByte(wram, at) ??
      cameraMapByte(wram, at) ??
      windowTextByte(wram, at) ??
      combatByte(wram, at) ??
      wram[at]
    );
  return (tables.get(wram)[field.name][field.index] >>> field.shift) & BYTE_MASK;
}
export function writeStateByte(wram, at, value) {
  const field = detached.has(wram) && byteFields[at];
  if (!field) {
    if (
      !setCollisionByte(wram, at, value) &&
      !setCameraMapByte(wram, at, value) &&
      !setWindowTextByte(wram, at, value) &&
      !setCombatByte(wram, at, value)
    )
      wram[at] = value;
    return value;
  }
  const values = tables.get(wram)[field.name],
    mask = BYTE_MASK << field.shift;
  values[field.index] = (values[field.index] & ~mask) | ((value & BYTE_MASK) << field.shift);
  return value;
}
export const readStateWord = (wram, at) =>
  readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
export function writeStateWord(wram, at, value) {
  writeStateByte(wram, at, value);
  writeStateByte(wram, at + 1, value >>> BYTE_BITS);
}
export function fillStateBytes(wram, value, start, end) {
  for (let at = start; at < end; at++) writeStateByte(wram, at, value);
}
