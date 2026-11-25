// The sprite list of the game (phase 5 producers, docs/FRAME-DESCRIPTION.md): the 128
// sprites the object pass enters each frame (src/game/sprite-list.mjs and
// object-sprites.mjs) as typed fields instead of the OAM buffer 7E:3D08-3F27. The game
// NMI's OAM job (81:A98E) hands this table to the video interface, and the picture back
// end (src/video/picture-video.mjs) takes the sprites from it directly.
//
// Per sprite: x (low 8 bits), y, name (character, low 8 bits) and attributes (flips,
// priority, palette, name table); per four sprites one size byte (two bits each: x bit 8
// and the large size, the OAM high table). Byte writers at the legacy boundary reach the
// same fields; out-of-table offsets keep their raw WRAM bytes.
import { OAM_BUFFER, OAM_HIGH_TABLE } from '../data/wram.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';
import {
  OAM_ENTRY_BYTES,
  OAM_HIGH_TABLE_BYTES,
  OAM_NAME_BYTE,
  OAM_Y_BYTE,
  OBJECT_COUNT,
} from '../constants/ppu.mjs';

const OAM_ATTRIBUTE_BYTE = OAM_NAME_BYTE + 1;
const field = (base, count, stride = 1) => Object.freeze({ base, count, bytes: 1, stride });
export const SPRITE_FIELDS = Object.freeze({
  x: field(OAM_BUFFER, OBJECT_COUNT, OAM_ENTRY_BYTES),
  y: field(OAM_BUFFER + OAM_Y_BYTE, OBJECT_COUNT, OAM_ENTRY_BYTES),
  name: field(OAM_BUFFER + OAM_NAME_BYTE, OBJECT_COUNT, OAM_ENTRY_BYTES),
  attributes: field(OAM_BUFFER + OAM_ATTRIBUTE_BYTE, OBJECT_COUNT, OAM_ENTRY_BYTES),
  sizes: field(OAM_HIGH_TABLE, OAM_HIGH_TABLE_BYTES),
});
const tables = new WeakMap(),
  byteFields = [];
for (const [name, { base, count, stride }] of Object.entries(SPRITE_FIELDS))
  for (let index = 0; index < count; index++) byteFields[base + index * stride] = { name, index };

export const spriteTable = (wram) => tables.get(wram);
export function detachSprites(wram) {
  let table = tables.get(wram);
  if (!table) {
    table = {};
    for (const [name, { base, count, stride }] of Object.entries(SPRITE_FIELDS))
      table[name] = Uint8Array.from({ length: count }, (_, i) => wram[base + i * stride]);
    tables.set(wram, table);
  }
  return table;
}
// Undefined means the byte belongs to the compatibility store or another subsystem.
export function spriteByte(wram, at) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  return f ? table[f.name][f.index] : undefined;
}
export function setSpriteByte(wram, at, value) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  if (!f) return false;
  table[f.name][f.index] = value & BYTE_MASK;
  return true;
}
// The sprite list as OAM bytes (low table, then high table), for the SNES back end's
// transfer and the golden video hash.
export function spriteBytes(
  table,
  into = new Uint8Array(OBJECT_COUNT * OAM_ENTRY_BYTES + OAM_HIGH_TABLE_BYTES),
) {
  for (let n = 0; n < OBJECT_COUNT; n++) {
    const at = n * OAM_ENTRY_BYTES;
    into[at] = table.x[n];
    into[at + OAM_Y_BYTE] = table.y[n];
    into[at + OAM_NAME_BYTE] = table.name[n];
    into[at + OAM_ATTRIBUTE_BYTE] = table.attributes[n];
  }
  into.set(table.sizes, OBJECT_COUNT * OAM_ENTRY_BYTES);
  return into;
}
