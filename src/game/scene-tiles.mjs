// The scene tiles (lifted from 81:9AE6 with 81:A1BC, 81:A1E1, 81:A243 and 81:9490;
// register-level version in src/task/main-scene-graphics.mjs).
//
// The scene load leaves a tile stack per BG tile (src/task/wram.mjs, TILE_STACK_*): a
// use count (negative: empty) and up to three tile ids drawn over each other. Each
// tile id names a 128-byte stream of four tiles (src/data/tiles.mjs) and may be flipped.
// The upload composes every stack entry and writes it to VRAM from word address 1000.
// Streams are kept in a cache of 64 entries, most recently used first; a missing
// stream is unpacked into the least recently used entry.
//
// The streams are unpacked with the lifted unpacker (80:9E7E, src/system/unpack.mjs),
// which leaves its direct page state as the original. The direct page words of the original (the cache
// key 7A, the cache head 7C, the entry before the one found 7E, the found entry's data
// offset 80 and the stack entry 26) and the quarter offset 0D16 are written as in the
// original.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { taskStop } from '../task/plan.mjs';
import { UNPACK_FIXED_7E, unpackLong } from '../system/unpack.mjs';
import {
  TILE_CACHE_DATA,
  TILE_CACHE_KEYS,
  TILE_CACHE_LAST,
  TILE_CACHE_NEXT,
  TILE_COMPOSE,
  TILE_QUARTER_OFFSET,
  TILE_STACK_FIRST,
  TILE_STACK_LAST,
  TILE_STACK_SECOND,
  TILE_STACK_THIRD,
  TILE_STACK_USES,
} from '../task/wram.mjs';
import { TILE_BANK, TILE_TABLE } from '../data/tiles.mjs';
import { VMADDL, VMAINC, VMDATAL } from '../constants/hardware-registers.mjs';
import { PLANE_PAIR_BYTES, TILE_H_FLIP, VMAINC_INCREMENT_AFTER_HIGH } from '../constants/ppu.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const LONG_MASK = 0xffffff,
  NO_KEY = WORD_MASK,
  // More list steps than any word offset allows.
  CACHE_STEP_LIMIT = 0x8000;
const DP_CACHE_KEY = 0x7a,
  DP_CACHE_HEAD = 0x7c,
  DP_CACHE_PREVIOUS = 0x7e,
  DP_CACHE_OFFSET = 0x80,
  DP_STACK_ENTRY = 0x26;
// Tile id: bits 2-13 name the stream (its key), bits 0-1 its tile (a quarter of 32
// bytes), bits 10-13 the bank from 82; bit 14 flips it horizontally, bit 15
// vertically.
const STREAM_KEY_MASK = 0x3ffc,
  QUARTER_MASK = 3,
  QUARTER_SHIFT = 5,
  STREAM_BANK_SHIFT = 10;
// Bit reversal table 81:A017 for horizontally flipped tiles.
const BIT_REVERSE = 0x81a017;
// A 4-bit tile of 32 bytes, plane by plane, eight bytes (rows) per plane.
const PLANE_BYTES = 8,
  TILE_PLANES = 4,
  TILE_BYTES = 32,
  TILE_WORDS = TILE_BYTES / 2,
  PLANE_PAIRS = 2,
  ROW_MASK = PLANE_BYTES - 1;
const SCENE_TILES_VRAM = 0x1000,
  STACK_END = TILE_STACK_LAST + 2;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);

// Empty the cache and link its entries in order (81:A1BC). The word before the keys,
// which the original sets to FFFF, is the link of the last entry: it ends the list.
function clearTileCache(wram) {
  setWord(wram, DP_CACHE_HEAD, 0);
  for (let x = TILE_CACHE_LAST; x >= 0; x -= 2) {
    setWord(wram, TILE_CACHE_KEYS + x, NO_KEY);
    setWord(wram, TILE_CACHE_NEXT + x, x + 2);
  }
  setWord(wram, TILE_CACHE_KEYS - 2, NO_KEY);
}
// Move the entry after DP 7E (negative: the head itself) to the front; DP 80 gets the
// data offset of the head (81:A243).
function moveCacheEntryToFront(wram) {
  const previous = word(wram, DP_CACHE_PREVIOUS);
  if (!(previous & WORD_SIGN)) {
    const entry = word(wram, TILE_CACHE_NEXT + previous);
    setWord(wram, TILE_CACHE_NEXT + previous, word(wram, TILE_CACHE_NEXT + entry));
    setWord(wram, TILE_CACHE_NEXT + entry, word(wram, DP_CACHE_HEAD));
    setWord(wram, DP_CACHE_HEAD, entry);
  }
  const head = word(wram, DP_CACHE_HEAD),
    swapped = ((head & BYTE_MASK) << BYTE_BITS) | (head >>> BYTE_BITS);
  // The entry's byte offset in the list * 64: 128 data bytes per entry.
  setWord(wram, DP_CACHE_OFFSET, swapped >>> 2);
}
// The offset in TILE_CACHE_DATA of tile id (81:A1E1): the stream is found in the cache
// or unpacked into its last entry.
function findCachedTile(wram, mem, id) {
  setWord(wram, DP_CACHE_KEY, id & STREAM_KEY_MASK);
  setWord(wram, TILE_QUARTER_OFFSET, (id & QUARTER_MASK) << QUARTER_SHIFT);
  setWord(wram, DP_CACHE_PREVIOUS, NO_KEY);
  const key = word(wram, DP_CACHE_KEY);
  for (let entry = word(wram, DP_CACHE_HEAD), steps = 0; ; steps++) {
    // A list without end (only from a damaged cache) loops forever in the original.
    if (steps > CACHE_STEP_LIMIT) taskStop('tile_cache_end_required');
    if (word(wram, TILE_CACHE_KEYS + entry) === key) {
      moveCacheEntryToFront(wram);
      return (word(wram, DP_CACHE_OFFSET) + word(wram, TILE_QUARTER_OFFSET)) & WORD_MASK;
    }
    const next = word(wram, TILE_CACHE_NEXT + entry);
    if (next & WORD_SIGN) break;
    setWord(wram, DP_CACHE_PREVIOUS, entry);
    entry = next;
  }
  // Not cached: the last entry moves to the front and takes the stream.
  moveCacheEntryToFront(wram);
  setWord(wram, TILE_CACHE_KEYS + word(wram, DP_CACHE_HEAD), key);
  const bank = TILE_BANK + (key >>> STREAM_BANK_SHIFT),
    source = readWord(mem, TILE_TABLE + (key >>> 1)),
    output = (word(wram, DP_CACHE_OFFSET) + TILE_CACHE_DATA) & WORD_MASK;
  unpackLong(mem, source, bank, output, UNPACK_FIXED_7E);
  return (word(wram, TILE_QUARTER_OFFSET) + word(wram, DP_CACHE_OFFSET)) & WORD_MASK;
}
// The tile's rows as stored: a horizontally flipped tile reverses each byte, a
// vertically flipped one takes the rows bottom up (in pairs, swapped, without the
// horizontal flip).
function tileUnits(mem, wram, at, id) {
  const horizontal = (id & TILE_H_FLIP) !== 0,
    vertical = (id & WORD_SIGN) !== 0,
    size = horizontal ? 1 : 2,
    units = [];
  for (let offset = 0; offset < TILE_BYTES; offset += size) {
    let value = size === 1 ? wram[at + offset] : word(wram, at + offset);
    if (horizontal) value = mem.read8(BIT_REVERSE + value);
    else if (vertical) value = ((value & BYTE_MASK) << BYTE_BITS) | (value >>> BYTE_BITS);
    const row = offset & ROW_MASK,
      to = (offset & ~ROW_MASK) + (vertical ? PLANE_BYTES - size - row : row);
    units.push([to, value, size]);
  }
  return units;
}
const put = (wram, at, value, size) => (size === 1 ? (wram[at] = value) : setWord(wram, at, value));
const get = (wram, at, size) => (size === 1 ? wram[at] : word(wram, at));

// Overlay tile id on the composed tile: its pixels replace the planes below (81:9490).
function overlayStackTile(wram, mem, id) {
  const offset = findCachedTile(wram, mem, id),
    units = tileUnits(mem, wram, TILE_CACHE_DATA + offset, id),
    size = units[0][2],
    perPlane = PLANE_BYTES / size;
  for (let row = 0; row < perPlane; row++) {
    const layers = Array.from({ length: TILE_PLANES }, (_, p) => units[p * perPlane + row]),
      to = layers[0][0],
      mask = layers.reduce((bits, [, value]) => bits | value, 0);
    for (let p = 0; p < TILE_PLANES; p++) {
      const at = TILE_COMPOSE + to + p * PLANE_BYTES;
      put(wram, at, get(wram, at, size) & ~mask, size);
    }
    for (let p = 0; p < TILE_PLANES; p++) {
      const at = TILE_COMPOSE + to + p * PLANE_BYTES;
      put(wram, at, get(wram, at, size) | layers[p][1], size);
    }
  }
}

// Upload the scene tiles to VRAM from word address 1000 (81:9AE6), a sequence, one step
// per stack entry.
export function* uploadSceneTilesSequence(h) {
  const { mem, wram, video } = sceneRuntime(h);
  yield () => {
    clearTileCache(wram);
    video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 2);
    video.write(VMADDL, SCENE_TILES_VRAM, 2);
  };
  for (let x = 0; x !== STACK_END; x = word(wram, DP_STACK_ENTRY) + 2) {
    setWord(wram, DP_STACK_ENTRY, x);
    if (word(wram, TILE_STACK_USES + x) & WORD_SIGN) {
      yield () => {
        for (let n = 0; n < TILE_WORDS; n++) video.write(VMDATAL, 0, 2);
      };
      continue;
    }
    yield () => {
      const first = word(wram, TILE_STACK_FIRST + x),
        offset = findCachedTile(wram, mem, first);
      for (const [to, value, size] of tileUnits(mem, wram, TILE_CACHE_DATA + offset, first))
        put(wram, TILE_COMPOSE + to, value, size);
      const second = word(wram, TILE_STACK_SECOND + word(wram, DP_STACK_ENTRY));
      if (second) {
        overlayStackTile(wram, mem, second);
        const third = word(wram, TILE_STACK_THIRD + word(wram, DP_STACK_ENTRY));
        if (third) overlayStackTile(wram, mem, third);
      }
      // Two plane pairs, each row as the low and the high byte of a VRAM word.
      for (let pair = 0; pair < PLANE_PAIRS; pair++)
        for (let row = 0; row < PLANE_BYTES; row++)
          for (let plane = 0; plane < 2; plane++)
            video.write(
              VMDATAL + plane,
              wram[TILE_COMPOSE + pair * PLANE_PAIR_BYTES + row + plane * PLANE_BYTES],
              1,
            );
    };
  }
}
