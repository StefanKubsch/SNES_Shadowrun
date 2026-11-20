// Independent collision state for the live loop. Legacy offsets are confined to
// this schema and the byte boundary, also used by the diagnostic projection.
// Spans end at the next original table: 268 twelve-byte boxes and 1072 nodes.
// Owners are words three bytes apart (box offset / 4), including odd addresses.
// Out-of-table accesses retain their original byte aliases, without a new guard.
import {
  COLLISION_CELL_HEADS,
  COLLISION_NODE_BOX,
  COLLISION_NODE_NEXT,
  COLLISION_BOX_X0,
  COLLISION_BOX_Y0,
  COLLISION_BOX_BOTTOM,
  COLLISION_BOX_X1,
  COLLISION_BOX_Y1,
  COLLISION_BOX_TOP,
  COLLISION_BOX_OBJECT,
  COLLISION_CELLS,
  COLLISION_BOX_BYTES,
  STATIC_CELL_HEADS,
  STATIC_BOX_END,
  STATIC_NODE_END,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

const BOXES = (COLLISION_NODE_BOX - COLLISION_BOX_X0) / COLLISION_BOX_BYTES,
  NODES = (COLLISION_NODE_NEXT - COLLISION_NODE_BOX) / 2;
const field = (base, count = 1, stride = 2) => Object.freeze({ base, count, stride });
export const COLLISION_FIELDS = Object.freeze({
  staticBoxEnd: field(STATIC_BOX_END),
  staticNodeEnd: field(STATIC_NODE_END),
  staticHeads: field(STATIC_CELL_HEADS, COLLISION_CELLS),
  movingHeads: field(COLLISION_CELL_HEADS, COLLISION_CELLS),
  x0: field(COLLISION_BOX_X0, BOXES, COLLISION_BOX_BYTES),
  y0: field(COLLISION_BOX_Y0, BOXES, COLLISION_BOX_BYTES),
  bottom: field(COLLISION_BOX_BOTTOM, BOXES, COLLISION_BOX_BYTES),
  x1: field(COLLISION_BOX_X1, BOXES, COLLISION_BOX_BYTES),
  y1: field(COLLISION_BOX_Y1, BOXES, COLLISION_BOX_BYTES),
  top: field(COLLISION_BOX_TOP, BOXES, COLLISION_BOX_BYTES),
  owners: field(COLLISION_BOX_OBJECT - 0x7e0000, BOXES, COLLISION_BOX_BYTES / 4),
  nodeBoxes: field(COLLISION_NODE_BOX, NODES),
  nodeNext: field(COLLISION_NODE_NEXT, NODES),
});
const tables = new WeakMap(),
  byteFields = [];
for (const [name, { base, count, stride }] of Object.entries(COLLISION_FIELDS))
  for (let index = 0; index < count; index++) {
    byteFields[base + index * stride] = { name, index, shift: 0 };
    byteFields[base + index * stride + 1] = { name, index, shift: BYTE_BITS };
  }

export const collisionTable = (wram) => tables.get(wram);
export function detachCollisionStorage(wram) {
  let table = tables.get(wram);
  if (!table) {
    table = {};
    for (const [name, { base, count, stride }] of Object.entries(COLLISION_FIELDS)) {
      const values = new Uint16Array(count);
      for (let i = 0; i < count; i++)
        values[i] = wram[base + i * stride] | (wram[base + i * stride + 1] << BYTE_BITS);
      table[name] = values;
    }
    tables.set(wram, table);
  }
  return table;
}
// Undefined means the byte belongs to the compatibility store or another subsystem.
export function collisionByte(wram, at) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  return f ? (table[f.name][f.index] >>> f.shift) & BYTE_MASK : undefined;
}
export function setCollisionByte(wram, at, value) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  if (!f) return false;
  const values = table[f.name],
    mask = BYTE_MASK << f.shift;
  values[f.index] = (values[f.index] & ~mask) | ((value & BYTE_MASK) << f.shift);
  return true;
}
