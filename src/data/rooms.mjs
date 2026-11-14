// Rooms (docs/ROM-FREE.md, step 2). 80:A4BF (src/task/main-transition.mjs)
// takes entry n = 7E:2DE2 of the room table 8D:929D (498 entries of 9 bytes):
// a header word, a byte to DP 11 (handed to 80:AAAF as the direction by
// 80:A2FA) and the words x, y, z to DP 14, 17, 1A (start position for A2FA
// and the camera of A464). A44D sets the bank 99 + bit 15 of the word and
// A4BF sets bit 15 of the offset, so the header lies at
// (99 + bit 15):(word | 8000). Two entries hold FFFF and point nowhere.
// Header, read in this order:
// - +0 scene number (81:A117), +1 music (FF none; A4BF against 1CDE, EF47),
// - +2 word: pointer to the camera box; A4BF stores it minus 1 to 0CDA,
//   81:8A05 reads 4 words from it (minimum and maximum of DP 41, then of
//   DP 44) unless the first is FFFF. A word FFFF follows that no code reads.
// - +4 actors (80:A3B6): count byte, 6 bytes each: x in bits 0-10 of the
//   first word, y in bits 0-10 of the second, the high five bits of both
//   form DP 06 (x bits low), then the offset into the actor table 8D:B01F
//   (src/data/actors.mjs, entries of 7 bytes; stored as the entry index).
// - five lists, each a count byte and its entries; A3B6 leaves the start in
//   DP 9A. 81:8756 reads the first three with 81:8701 into the collision
//   boxes (six words: low x, y, z, high x, y, z), the second and third with
//   a data word, and leaves DP 9D at the second. 80:8000 tests the player
//   against the second (data: script started through C34A) and the third
//   (data: target room for A4BF). A4BF steps on to DP F3 (fourth list, points
//   of three words, read by 80:C6C7, D105, D2E7, 8D4E) and DP FC (fifth list,
//   six words: x0, y0, unused, x1, y1, height for the sight line 81:A25F).
// All 192 headers lie back to back from 99:8000 to 99:C5D8 and from 9A:8000
// to 9A:AD64; three of them have no table entry. No other code points into
// these banks (only A44D loads #99), so a room may change its size: the
// table words and box pointers are written from the layout, a run that no
// longer fits its bank range is refused (room_layout_changed), and a shorter
// run is filled with 00 up to the original end.
// Native form assets/vm-rooms.json: entries (room index or null, direction,
// x, y, z) and rooms in address order.
import { VmFault } from '../vm/memory.mjs';
import { ACTORS, ACTOR_BYTES as ACTOR_ENTRY_BYTES } from './actors.mjs';
import { romWriter } from './rom-bytes.mjs';
import {
  BYTE_MASK,
  WORD_MASK,
  BYTE_BITS,
  HEX_RADIX,
  WORD_BITS,
  WORD_SIGN,
  BANK_MASK,
} from '../constants/bits.mjs';
import { LOROM_OFFSET, LOROM_OFFSET_MASK } from '../constants/memory-map.mjs';

// Table entry: header word, direction byte, then the words x, y, z.
const ENTRY_BYTES = 9,
  ENTRY_DIRECTION = 2,
  ENTRY_POSITION = 3,
  POSITION_WORDS = 3;
export const ROOM_TABLE = 0x8d929d,
  ROOM_ENTRIES = 498,
  ROOM_TABLE_END = ROOM_TABLE + ENTRY_BYTES * ROOM_ENTRIES;
// The header lies at (ROOM_BANK + bit 15 of the word):(word | 8000).
export const ROOM_BANK = 0x99;
const ROOM_HIGH_BANK = 0x9a,
  BANK_SELECT = WORD_SIGN,
  BANK_SELECT_SHIFT = WORD_BITS - 1;
// Header: scene, music, camera box pointer, actor count, then the actors.
const HEADER_SCENE = 0,
  HEADER_MUSIC = 1,
  HEADER_CAMERA = 2,
  HEADER_ACTOR_COUNT = 4,
  HEADER_ACTORS = 5,
  HEADER_PLACEHOLDER = [0, 0];
// Actor: x and y in bits 0-10 of two words, their high five bits the flags,
// then the offset of an entry of the actor table (ACTOR_ENTRY_BYTES each).
const ACTOR_WORDS = 3,
  ACTOR_BYTES = 2 * ACTOR_WORDS,
  COORDINATE_MASK = 0x7ff,
  FLAG_SHIFT = 11,
  FLAG_BITS = 5,
  FLAG_LOW_MASK = (1 << FLAG_BITS) - 1,
  FLAGS_MAX = (1 << (2 * FLAG_BITS)) - 1;
// Camera box: four words unless the first is FFFF; a word FFFF ends the header.
const CAMERA_WORDS = 4,
  NONE = 0xffff;
export const ROOM_RUNS = [
  [0x998000, 0x99c5d8],
  [0x9a8000, 0x9aad64],
];
const LISTS = [
  ['boxes', 6, false],
  ['scripts', 6, true],
  ['exits', 6, true],
  ['points', 3, false],
  ['sight', 6, false],
];

const word = (read8, cpu) => read8(cpu) | (read8(cpu + 1) << BYTE_BITS);
const words = (read8, cpu, n) => Array.from({ length: n }, (_, i) => word(read8, cpu + 2 * i));

// Offset of the music byte in a room header (FF none; 80:A4BF hands it to 81:EF47).
export const ROOM_HEADER_MUSIC = HEADER_MUSIC;
// Further offsets read by 80:A4BF and 80:A3B6: the camera box pointer, the actor count,
// and the direction and position words of a table entry.
export const ROOM_HEADER_CAMERA = HEADER_CAMERA,
  ROOM_HEADER_ACTOR_COUNT = HEADER_ACTOR_COUNT,
  ROOM_ENTRY_BYTES = ENTRY_BYTES,
  ROOM_ENTRY_DIRECTION = ENTRY_DIRECTION,
  ROOM_ENTRY_POSITION = ENTRY_POSITION;
// Header address of room table entry n as 80:A44D/A4BF form it, or null for FFFF.
const headerAddress = (w) =>
  w === NONE ? null : ((ROOM_BANK + (w >> BANK_SELECT_SHIFT)) << WORD_BITS) | w | LOROM_OFFSET;
export const roomHeader = (read8, entry) =>
  headerAddress(word(read8, ROOM_TABLE + ENTRY_BYTES * entry));

function readRoom(read8, at) {
  const room = {
    bank: (at >> WORD_BITS).toString(HEX_RADIX).toUpperCase(),
    scene: read8(at + HEADER_SCENE),
    music: read8(at + HEADER_MUSIC),
  };
  let p = at + HEADER_ACTORS;
  room.actors = Array.from({ length: read8(at + HEADER_ACTOR_COUNT) }, () => {
    const [x, y, actor] = words(read8, p, ACTOR_WORDS);
    p += ACTOR_BYTES;
    if (actor % ACTOR_ENTRY_BYTES || actor >= ACTOR_ENTRY_BYTES * ACTORS)
      throw new VmFault('room_layout_required', p - 2);
    return {
      x: x & COORDINATE_MASK,
      y: y & COORDINATE_MASK,
      flags: (x >> FLAG_SHIFT) | ((y >> FLAG_SHIFT) << FLAG_BITS),
      actor: actor / ACTOR_ENTRY_BYTES,
    };
  });
  for (const [name, count, data] of LISTS) {
    room[name] = Array.from({ length: read8(p++) }, () => {
      const box = words(read8, p, count);
      p += 2 * count;
      if (!data) return box;
      const value = word(read8, p);
      p += 2;
      return name === 'scripts' ? { box, script: value } : { box, room: value };
    });
  }
  const box = (at & BANK_MASK) | word(read8, at + HEADER_CAMERA);
  if (box !== p) throw new VmFault('room_layout_required', at);
  room.camera = word(read8, p) === NONE ? null : words(read8, p, CAMERA_WORDS);
  p += room.camera ? 2 * CAMERA_WORDS : 0;
  if (word(read8, p) !== NONE) throw new VmFault('room_layout_required', p);
  return { room, end: p + 2 };
}

export function readRooms(read8) {
  const rooms = [],
    index = new Map();
  for (const [start, end] of ROOM_RUNS) {
    let at = start;
    while (at < end) {
      const r = readRoom(read8, at);
      index.set(at, rooms.length);
      rooms.push(r.room);
      at = r.end;
    }
    if (at !== end) throw new VmFault('room_layout_required', at);
  }
  const entries = Array.from({ length: ROOM_ENTRIES }, (_, n) => {
    const at = ROOM_TABLE + ENTRY_BYTES * n,
      w = word(read8, at),
      [x, y, z] = words(read8, at + ENTRY_POSITION, POSITION_WORDS);
    const room = w === NONE ? null : index.get(headerAddress(w));
    if (room === undefined) throw new VmFault('room_layout_required', at);
    return { room, direction: read8(at + ENTRY_DIRECTION), x, y, z };
  });
  return { entries, rooms };
}

function encodeRoom(room, base) {
  const bytes = [],
    put = (v) => bytes.push(v & BYTE_MASK, (v >> BYTE_BITS) & BYTE_MASK);
  const value = (v, max) => {
    if (!Number.isInteger(v) || v < 0 || v > max) throw new VmFault('room_value_required', base);
    return v;
  };
  const list = (items, max = BYTE_MASK) => {
    if (!Array.isArray(items) || items.length > max) throw new VmFault('room_value_required', base);
    return items;
  };
  bytes.push(value(room.scene, BYTE_MASK), value(room.music, BYTE_MASK), ...HEADER_PLACEHOLDER);
  bytes.push(list(room.actors).length);
  for (const a of room.actors) {
    const flags = value(a.flags, FLAGS_MAX);
    put(value(a.x, COORDINATE_MASK) | ((flags & FLAG_LOW_MASK) << FLAG_SHIFT));
    put(value(a.y, COORDINATE_MASK) | ((flags >> FLAG_BITS) << FLAG_SHIFT));
    put(ACTOR_ENTRY_BYTES * value(a.actor, ACTORS - 1));
  }
  for (const [name, count, data] of LISTS) {
    bytes.push(list(room[name]).length);
    for (const item of room[name]) {
      const box = data ? item?.box : item;
      list(box, count).forEach((v) => put(value(v, WORD_MASK)));
      if (box.length !== count) throw new VmFault('room_value_required', base);
      if (data) put(value(name === 'scripts' ? item.script : item.room, WORD_MASK));
    }
  }
  const box = base + bytes.length;
  bytes[HEADER_CAMERA] = box & BYTE_MASK;
  bytes[HEADER_CAMERA + 1] = (box >> BYTE_BITS) & BYTE_MASK;
  if (room.camera !== null) {
    if (list(room.camera, CAMERA_WORDS).length !== CAMERA_WORDS || room.camera[0] === NONE)
      throw new VmFault('room_value_required', base);
    room.camera.forEach((v) => put(value(v, WORD_MASK)));
  }
  put(NONE);
  return bytes;
}

export function placeRooms(rom, present, { entries, rooms }) {
  if (entries?.length !== ROOM_ENTRIES || !Array.isArray(rooms))
    throw new VmFault('room_layout_changed', ROOM_TABLE);
  const write = romWriter(rom, present, 'room_layout_changed');
  const address = [];
  for (const [start, end] of ROOM_RUNS) {
    const bank = (start >> WORD_BITS).toString(HEX_RADIX).toUpperCase();
    let at = start;
    rooms.forEach((room, n) => {
      if (room?.bank !== bank) return;
      address[n] = at;
      const bytes = encodeRoom(room, at & WORD_MASK);
      if (at + bytes.length > end) throw new VmFault('room_layout_changed', at);
      bytes.forEach((v, k) => write(at + k, v));
      at += bytes.length;
    });
    while (at < end) write(at++, 0);
  }
  if (address.length !== rooms.length || address.includes(undefined))
    throw new VmFault('room_layout_changed', ROOM_TABLE);
  entries.forEach((e, n) => {
    const at = ROOM_TABLE + ENTRY_BYTES * n;
    if (e.room !== null && !(Number.isInteger(e.room) && address[e.room] !== undefined))
      throw new VmFault('room_value_required', at);
    const head =
      e.room === null
        ? NONE
        : (address[e.room] >> WORD_BITS === ROOM_HIGH_BANK ? BANK_SELECT : 0) |
          (address[e.room] & LOROM_OFFSET_MASK);
    const value = (v, max) => {
      if (!Number.isInteger(v) || v < 0 || v > max) throw new VmFault('room_value_required', at);
      return v;
    };
    const position = [e.x, e.y, e.z].map((v) => value(v, WORD_MASK));
    [
      head & BYTE_MASK,
      head >> BYTE_BITS,
      value(e.direction, BYTE_MASK),
      ...position.flatMap((v) => [v & BYTE_MASK, v >> BYTE_BITS]),
    ].forEach((v, k) => write(at + k, v));
  });
}
