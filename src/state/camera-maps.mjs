// Camera and tile map storage, detached once for the normal live loop.
// Frontend fonts, palettes, intro maps and menu maps alias these same fields.
// Wall data and shape construction remain part of the later scene subsystem.
import {
  CAMERA_X,
  CAMERA_Y,
  CAMERA_SPEED_X,
  CAMERA_SPEED_Y,
  CAMERA_BOX,
  MAP_COLUMN_UPLOAD,
  MAP_ROW_UPLOAD,
  MAP_UPLOAD_HELD,
  MAP_COLUMN_VRAM_BG1,
  MAP_COLUMN_VRAM_BG2,
  MAP_ROW_VRAM_BG1,
  MAP_ROW_VRAM_BG2,
  MAP_COLUMN_BG1,
  MAP_COLUMN_BG2,
  MAP_ROW_BG1,
  MAP_ROW_BG2,
  MAP_LINE_BYTES,
  SCENE_LAYER_HIGH,
  SCENE_LAYER_LOW,
  SCENE_LAYER_BYTES,
  TILE_STACK_FIRST,
  TILE_STACK_SECOND,
  TILE_STACK_THIRD,
  TILE_STACK_NEXT,
  TILE_STACK_PREVIOUS,
  TILE_STACK_USES,
  TILE_STACK_FREE,
  TILE_STACK_LAST,
  TILE_STACK_HEADS,
  TILE_STACK_HEAD_LAST,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

const words = (base, count = 1) => Object.freeze({ base, count, bytes: 2 });
export const CAMERA_MAP_FIELDS = Object.freeze({
  x: words(CAMERA_X),
  y: words(CAMERA_Y),
  speedX: words(CAMERA_SPEED_X),
  speedY: words(CAMERA_SPEED_Y),
  box: Object.freeze({ base: CAMERA_BOX, count: 3, bytes: 1 }),
  columnPending: words(MAP_COLUMN_UPLOAD),
  rowPending: words(MAP_ROW_UPLOAD),
  uploadHeld: words(MAP_UPLOAD_HELD),
  columnVramBg1: words(MAP_COLUMN_VRAM_BG1),
  columnVramBg2: words(MAP_COLUMN_VRAM_BG2),
  rowVramBg1: words(MAP_ROW_VRAM_BG1),
  rowVramBg2: words(MAP_ROW_VRAM_BG2),
  columnBg1: words(MAP_COLUMN_BG1, MAP_LINE_BYTES / 2),
  columnBg2: words(MAP_COLUMN_BG2, MAP_LINE_BYTES / 2),
  rowBg1: words(MAP_ROW_BG1, MAP_LINE_BYTES / 2),
  rowBg2: words(MAP_ROW_BG2, MAP_LINE_BYTES / 2),
  layerHigh: words(SCENE_LAYER_HIGH, SCENE_LAYER_BYTES / 2),
  layerLow: words(SCENE_LAYER_LOW, SCENE_LAYER_BYTES / 2),
  stackFirst: words(TILE_STACK_FIRST, (TILE_STACK_LAST + 2) / 2),
  stackSecond: words(TILE_STACK_SECOND, (TILE_STACK_LAST + 2) / 2),
  stackThird: words(TILE_STACK_THIRD, (TILE_STACK_LAST + 2) / 2),
  stackNext: words(TILE_STACK_NEXT, (TILE_STACK_LAST + 2) / 2),
  stackPrevious: words(TILE_STACK_PREVIOUS, (TILE_STACK_LAST + 2) / 2),
  stackUses: words(TILE_STACK_USES, (TILE_STACK_LAST + 2) / 2),
  stackFree: words(TILE_STACK_FREE, (TILE_STACK_LAST + 2) / 2),
  stackHeads: words(TILE_STACK_HEADS - 0x7e0000, (TILE_STACK_HEAD_LAST + 2) / 2),
});
const tables = new WeakMap(),
  byteFields = [];
for (const [name, { base, count, bytes }] of Object.entries(CAMERA_MAP_FIELDS))
  for (let index = 0; index < count; index++)
    for (let byte = 0; byte < bytes; byte++)
      byteFields[base + index * bytes + byte] = { name, index, shift: byte * BYTE_BITS };

export const cameraMaps = (wram) => tables.get(wram);
export function detachCameraMaps(wram) {
  let table = tables.get(wram);
  if (!table) {
    table = {};
    for (const [name, { base, count, bytes }] of Object.entries(CAMERA_MAP_FIELDS)) {
      const values = bytes === 1 ? new Uint8Array(count) : new Uint16Array(count);
      for (let i = 0; i < count; i++)
        values[i] =
          wram[base + i * bytes] | (bytes === 2 ? wram[base + i * bytes + 1] << BYTE_BITS : 0);
      table[name] = values;
    }
    tables.set(wram, table);
  }
  return table;
}
export function cameraMapByte(wram, at) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  return f ? (table[f.name][f.index] >>> f.shift) & BYTE_MASK : undefined;
}
export function setCameraMapByte(wram, at, value) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  if (!f) return false;
  const values = table[f.name],
    mask = BYTE_MASK << f.shift;
  values[f.index] = (values[f.index] & ~mask) | ((value & BYTE_MASK) << f.shift);
  return true;
}
