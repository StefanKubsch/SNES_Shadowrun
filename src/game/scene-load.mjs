// The scene load (lifted from 81:A117 with the shapes 81:8DE2, 81:8D09, 81:8D23,
// 81:8D3D and 81:8DC0, the tile stack interning 81:8E57 with its resets 81:8FC2 and
// 81:8FF0, the layer and wall map clears 81:9022 and 81:902D, the grid blocks
// 81:8EDF with the palette slots 81:8CE0 and cycles 81:801A, and the wall tiles
// 81:940A, and the layer stacks 81:903E; register-level versions in
// src/task/main-scene-load.mjs and main-scene-layers.mjs). The scene palette reset
// 81:8CB9 comes from game-screen.mjs; here its DMA set-up writes WRAM, as the
// original's with data bank 7E.
//
// A scene record (unpacked to 7F:DA14) gives the backdrop colour, the tileset and the
// shapes: diagonals and rectangles drawn into a grid of tileset blocks. Each drawn
// cell places its block of 2 x 4 tiles into the first layer; each tile becomes a
// tile stack entry (up to three tile ids drawn over each other, shared by all cells
// with the same ids up to a common flip). The two object lists of the record add
// their objects to both layers (81:903E), and the wall tiles take the stacks of the
// second layer apart for the wall map cells.
//
// The scene record is unpacked with the lifted unpacker (80:9F69, src/system/unpack.mjs),
// which leaves its direct page state as the original. The scene load runs in bank 81
// with data bank 7E below its JSL frame and data bank byte, as the original. The
// direct page words the original uses are written as in the original; the Mesen
// oracle compares them.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { UNPACK_7F, unpackLong } from '../system/unpack.mjs';
import { resetScenePalettes } from './game-screen.mjs';
import {
  DP_SCENE_COUNT,
  DP_SCENE_LAYER,
  DP_SCENE_LAYER_BITS,
  DP_SCENE_RECORD,
  DP_SCENE_RECORD_BANK,
  DP_TILE_FIRST,
  DP_TILE_FREE,
  DP_TILE_SECOND,
  DP_TILE_THIRD,
  DP_WALL_NEXT,
  GRAPHIC_DEPTH_MODE,
  PALETTE_BYTES,
  PALETTE_COUNT,
  PALETTE_DIRECTION,
  PALETTE_SLOT_END,
  PALETTE_STEP,
  PALETTE_TABLE,
  SCENE_BACKDROP,
  SCENE_LAYER_BYTES,
  SCENE_LAYER_HIGH,
  SCENE_LAYER_LOW,
  SCENE_LAYER_ROW_BYTES,
  SCENE_PALETTE_COUNT,
  SCENE_PALETTE_LIST,
  SCENE_PALETTE_SLOTS,
  SCENE_RECORD,
  SHAPE_GRID,
  SHAPE_GRID_BYTES,
  SHAPE_GRID_HIDDEN_ROWS,
  SHAPE_GRID_ROW_BYTES,
  TILE_STACK_FIRST,
  TILE_STACK_FREE,
  TILE_STACK_HEAD_LAST,
  TILE_STACK_HEADS,
  TILE_STACK_LAST,
  TILE_STACK_NEXT,
  TILE_STACK_PREVIOUS,
  TILE_STACK_SECOND,
  TILE_STACK_THIRD,
  TILE_STACK_USES,
  WALL_CELL_BYTES,
  WALL_HEIGHTS,
  WALL_MAP,
  WALL_MAP_BYTES,
  WALL_TILES,
  WALL_WORD_CELLS,
} from '../task/wram.mjs';
import { CYCLE_TABLE, CYCLES } from '../data/palette-cycles.mjs';
import { TILESET_ATTRIBUTES, TILESET_BLOCKS } from '../data/tilesets.mjs';
import { OBJECT_TABLE } from '../data/object-types.mjs';
import { GRAPHIC_TABLE } from '../data/object-graphics.mjs';
import {
  TILE_FLIP_BITS,
  TILE_H_FLIP,
  TILE_NAME_MASK,
  TILE_PALETTE_BITS,
  TILE_PRIORITY,
} from '../constants/ppu.mjs';
import { WRAM_HIGH_BANK } from '../constants/memory-map.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  HIGH_BYTE_MASK,
  NIBBLE_BITS,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

const LONG_MASK = 0xffffff,
  NONE = WORD_MASK,
  // WRAM index of a long 7E/7F address.
  WRAM_START = 0x7e0000;
const wramAt = (long) => long - WRAM_START;
// Direct page words besides the shared DP_SCENE_* and DP_TILE_* fields.
const DP_BLOCKS = 0x11,
  DP_BLOCKS_BANK = 0x13,
  DP_ATTRIBUTES = 0x14,
  DP_ATTRIBUTES_BANK = 0x16,
  DP_OBJECT_LISTS = 0x77,
  DP_OBJECT_LISTS_BANK = 0x79,
  DP_SCRATCH = 0x6b,
  DP_VALUE = 0x23,
  DP_CELLS = 0x26,
  DP_ROWS = 0x29,
  DP_WIDTH = 0x2c,
  DP_GRID_OFFSET = 0x23,
  DP_LAYER_OFFSET = 0x26,
  DP_PALETTE_BITS = 0x29,
  DP_WALL_CELLS = 0x65,
  DP_FLIP = 0x68,
  DP_CYCLE_RECORD = 0xa2;
// The scene streams: three bytes per scene at 8B:F9E3 (pointer word, then the bank).
const SCENE_STREAMS = 0x8bf9e3,
  SCENE_STREAM_BANK = 2,
  SCENE_STREAM_BYTES = 3;
// The tileset tables lie in bank 8D, the palette cycles in bank 8B.
const TILESET_BANK = TILESET_BLOCKS >>> WORD_BITS,
  CYCLE_BANK = 0x8b,
  CYCLE_ENTRY_BYTES = 3,
  CYCLE_SLOTS_END = 4,
  CYCLE_LENGTH = 2,
  CYCLE_SPEED = 4,
  CYCLE_STEPS = 6,
  CYCLE_COLOURS = 8;
// Shapes: a word with the grid offset (bit 15 rectangle, bit 14 border or right
// step), then the value byte and the cells (diagonal) or the value, width and rows
// (rectangle). Diagonal steps go one row down and one cell left or right.
const SHAPE_RECTANGLE = WORD_SIGN,
  SHAPE_SECOND_KIND = 0x4000,
  SHAPE_OFFSET_MASK = 0x3ffe,
  STEP_LEFT = SHAPE_GRID_ROW_BYTES - 2,
  STEP_RIGHT = SHAPE_GRID_ROW_BYTES + 2,
  GRID_LAST = SHAPE_GRID_BYTES - 1;
// A rectangle border's corner values: above the first cell, the two turns, the end.
const CORNER_ABOVE = 6,
  CORNER_FIRST_TURN = 3,
  CORNER_SECOND_TURN = 2,
  CORNER_END = 4;
// Grid blocks: the drawn rows (below the hidden ones), their first 32 cells; a block
// of 2 x 4 tile words (16 bytes) placed as columns of the layer rows.
const GRID_DRAWN = SHAPE_GRID + SHAPE_GRID_HIDDEN_ROWS * SHAPE_GRID_ROW_BYTES,
  GRID_DRAWN_LAST = 0xbbe,
  GRID_RIGHT_HALF = 0x40,
  GRID_CELL_MASK = 0x3f,
  GRID_ROW_MASK = 0xff80,
  GRID_ROW_SHIFT = 2,
  BLOCK_SHIFT = 4,
  PALETTE_BITS_SHIFT_AFTER_SWAP = 2,
  BLOCK_ROWS = 4,
  BLOCK_DESTINATIONS = [0, 1].flatMap((column) =>
    Array.from(
      { length: BLOCK_ROWS },
      (_, row) => SCENE_LAYER_LOW + row * SCENE_LAYER_ROW_BYTES + 2 * column,
    ),
  );
const TILE_STACK_HASH_MASK = BYTE_MASK;
// Wall tiles: each wall map word holds four cells of three tile words.
const WALL_CELL_TILES = WALL_CELL_BYTES / 2,
  WALL_WORD_LAYER_BYTES = 2 * WALL_WORD_CELLS;
// The scene load runs in bank 81 with data bank 7E; a JSL pushes the address of its
// last byte.
const SCENE_LOAD_BANK = 0x81,
  SCENE_DATA_BANK = WRAM_START >>> WORD_BITS,
  JSL_LAST_BYTE = 3;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
const longPointer = (wram, at) => (wram[at + 2] << WORD_BITS) | word(wram, at);
// The word at a direct page long pointer plus an offset (it runs on into the next bank).
const pointed = (mem, wram, dp, offset) => readWord(mem, longPointer(wram, dp) + offset);
const pointedByte = (mem, wram, dp, offset) =>
  mem.read8((longPointer(wram, dp) + offset) & LONG_MASK);

// --- Shapes (81:8DE2) ---

const GRID = wramAt(SHAPE_GRID);
// Write the shape value into DP 26 + 1 cells from x along a diagonal step (81:8D09
// left, 81:8D23 right); cells past the grid are skipped. Returns the cell after.
function diagonal(wram, x, step) {
  if (word(wram, DP_CELLS) & WORD_SIGN) return x;
  do {
    if (x < GRID_LAST) setWord(wram, GRID + x, word(wram, DP_VALUE));
    x = (x + step) & WORD_MASK;
    setWord(wram, DP_CELLS, word(wram, DP_CELLS) - 1);
  } while (!(word(wram, DP_CELLS) & WORD_SIGN));
  return x;
}
// A corner value at x when it lies in the grid.
function corner(wram, x, value) {
  if (x < GRID_LAST) setWord(wram, GRID + x, value);
}
// The border of a rectangle from x (81:8D3D): its edges take the values v+1 to v+4,
// its corners the edge value plus 6, 3, 2 and 4. The shape value is kept.
function drawRectangleBorder(wram, start) {
  const value = word(wram, DP_VALUE),
    width = word(wram, DP_WIDTH),
    rows = word(wram, DP_ROWS),
    edge = () => {
      setWord(wram, DP_VALUE, word(wram, DP_VALUE) + 1);
      return word(wram, DP_VALUE);
    };
  const first = edge();
  if (start >= SHAPE_GRID_ROW_BYTES)
    setWord(wram, GRID + start - SHAPE_GRID_ROW_BYTES, first + CORNER_ABOVE);
  setWord(wram, DP_CELLS, width - 1);
  let x = diagonal(wram, (start - 2) & WORD_MASK, STEP_LEFT);
  corner(wram, x, edge() + CORNER_FIRST_TURN);
  x = (x + STEP_RIGHT) & WORD_MASK;
  setWord(wram, DP_CELLS, rows - 1);
  diagonal(wram, x, STEP_RIGHT);
  setWord(wram, DP_VALUE, word(wram, DP_VALUE) + 1);
  setWord(wram, DP_CELLS, rows - 1);
  x = diagonal(wram, (start + 2) & WORD_MASK, STEP_RIGHT);
  corner(wram, x, edge() + CORNER_SECOND_TURN);
  x = (x + STEP_LEFT) & WORD_MASK;
  setWord(wram, DP_CELLS, width - 1);
  x = diagonal(wram, x, STEP_LEFT);
  corner(wram, x, word(wram, DP_VALUE) + CORNER_END);
  setWord(wram, DP_VALUE, value);
}
// The fill of a rectangle from x (81:8DC0): two left diagonals per row, the second
// one row lower and one cell shorter.
function fillRectangle(wram, x) {
  for (;;) {
    setWord(wram, DP_CELLS, word(wram, DP_WIDTH));
    diagonal(wram, x, STEP_LEFT);
    setWord(wram, DP_ROWS, word(wram, DP_ROWS) - 1);
    if (word(wram, DP_ROWS) & WORD_SIGN) return;
    setWord(wram, DP_CELLS, word(wram, DP_WIDTH) - 1);
    x = (x + SHAPE_GRID_ROW_BYTES) & WORD_MASK;
    diagonal(wram, x, STEP_LEFT);
    x = (x + 2) & WORD_MASK;
  }
}
// Clear the grid and draw the record's shapes (81:8DE2); the record pointer moves on.
function drawSceneShapes(mem, wram) {
  for (let x = SHAPE_GRID_BYTES - 2; x >= 0; x -= 2) setWord(wram, GRID + x, 0);
  if (!word(wram, DP_SCENE_COUNT)) return;
  const byte = (y) => pointedByte(mem, wram, DP_SCENE_RECORD, y),
    wordAt = (y) => pointed(mem, wram, DP_SCENE_RECORD, y);
  let y = 0;
  do {
    const shape = wordAt(y);
    y += 2;
    setWord(wram, DP_SCRATCH, shape);
    const x = shape & SHAPE_OFFSET_MASK,
      second = (shape & SHAPE_SECOND_KIND) !== 0;
    if (shape & SHAPE_RECTANGLE) {
      setWord(wram, DP_VALUE, byte(y));
      y += 1;
      const size = wordAt(y);
      y += 2;
      setWord(wram, DP_WIDTH, size & BYTE_MASK);
      setWord(wram, DP_ROWS, size >>> BYTE_BITS);
      if (second) drawRectangleBorder(wram, x);
      fillRectangle(wram, x);
    } else {
      const v = wordAt(y);
      y += 2;
      setWord(wram, DP_VALUE, v & BYTE_MASK);
      setWord(wram, DP_CELLS, v >>> BYTE_BITS);
      diagonal(wram, x, second ? STEP_RIGHT : STEP_LEFT);
    }
    setWord(wram, DP_SCENE_COUNT, word(wram, DP_SCENE_COUNT) - 1);
  } while (word(wram, DP_SCENE_COUNT));
  setWord(wram, DP_SCENE_RECORD, y + word(wram, DP_SCENE_RECORD));
}

// --- Tile stacks (81:8E57, 81:8FC2, 81:8FF0) ---

const HEADS = wramAt(TILE_STACK_HEADS);
// The tile stack entry of the ids in DP 1A, 1C and 1E (81:8E57): an entry with the
// same ids up to one common flip is used once more, otherwise a free entry is taken
// and hashed in. Returns the entry number with the common flip bits.
export function internTileStack(wram) {
  const first = word(wram, DP_TILE_FIRST),
    second = word(wram, DP_TILE_SECOND),
    third = word(wram, DP_TILE_THIRD),
    sum = first + second,
    head = 2 * ((sum + third + (sum > WORD_MASK ? 1 : 0)) & TILE_STACK_HASH_MASK);
  for (let y = word(wram, HEADS + head); !(y & WORD_SIGN);) {
    // Equal when all three ids agree apart from one common flip; a second id of zero
    // on both sides ends the comparison.
    const flip = word(wram, TILE_STACK_FIRST + y) ^ first;
    setWord(wram, DP_SCRATCH, flip);
    let equal = !(flip & ~TILE_FLIP_BITS & WORD_MASK);
    if (equal && word(wram, TILE_STACK_SECOND + y) | second) {
      equal = (word(wram, TILE_STACK_SECOND + y) ^ second) === flip;
      if (equal && word(wram, TILE_STACK_THIRD + y) | third)
        equal = (word(wram, TILE_STACK_THIRD + y) ^ third) === flip;
    }
    if (equal) {
      setWord(wram, TILE_STACK_USES + y, word(wram, TILE_STACK_USES + y) + 1);
      return (y >>> 1) | flip;
    }
    y = word(wram, TILE_STACK_NEXT + y);
  }
  const free = word(wram, DP_TILE_FREE),
    y = word(wram, TILE_STACK_FREE + free);
  setWord(wram, DP_TILE_FREE, free - 2);
  setWord(wram, TILE_STACK_USES + y, 0);
  setWord(wram, TILE_STACK_PREVIOUS + y, head | WORD_SIGN);
  setWord(wram, TILE_STACK_FIRST + y, first);
  setWord(wram, TILE_STACK_SECOND + y, second);
  setWord(wram, TILE_STACK_THIRD + y, third);
  setWord(wram, TILE_STACK_NEXT + y, word(wram, HEADS + head));
  setWord(wram, HEADS + head, y);
  setWord(wram, TILE_STACK_PREVIOUS + word(wram, TILE_STACK_NEXT + y), y);
  return y >>> 1;
}
// Entry 0 ends the free stack; the chains are emptied and the empty stack (0, 0, 0)
// is interned first.
function resetIntern(wram) {
  setWord(wram, TILE_STACK_FREE + TILE_STACK_LAST, 0);
  for (let x = TILE_STACK_HEAD_LAST; x >= 0; x -= 2) setWord(wram, HEADS + x, NONE);
  for (const at of [DP_TILE_FIRST, DP_TILE_SECOND, DP_TILE_THIRD]) setWord(wram, at, 0);
  internTileStack(wram);
}
// Free all tile stack entries, the free stack in descending order (81:8FC2).
function resetTileStacks(wram) {
  setWord(wram, DP_TILE_FREE, TILE_STACK_LAST);
  for (let x = TILE_STACK_LAST; x !== 0; x -= 2) {
    setWord(wram, TILE_STACK_FREE - 2 + x, x);
    setWord(wram, TILE_STACK_USES + x, NONE);
  }
  setWord(wram, TILE_STACK_USES, NONE);
  resetIntern(wram);
}
// The free stack in ascending order, the uses kept but entry 0's (81:8FF0).
function resetTileStacksAscending(wram) {
  setWord(wram, DP_TILE_FREE, TILE_STACK_LAST);
  for (let x = TILE_STACK_LAST, n = 2; x !== 0; x -= 2, n += 2)
    setWord(wram, TILE_STACK_FREE - 2 + x, n);
  setWord(wram, TILE_STACK_USES, NONE);
  resetIntern(wram);
}

// --- Layers, wall map, grid blocks and wall tiles ---

// Clear both tile layers (81:9022).
function clearSceneLayers(wram) {
  wram.fill(0, SCENE_LAYER_HIGH, SCENE_LAYER_HIGH + 2 * SCENE_LAYER_BYTES);
}
// Empty the wall map (81:902D).
function clearWallMap(wram) {
  setWord(wram, DP_WALL_NEXT, 0);
  wram.fill(BYTE_MASK, wramAt(WALL_MAP), wramAt(WALL_MAP) + WALL_MAP_BYTES);
}
// Look palette up in the palette cycles (81:801A): a hit fills the next of the two
// cycle slots for scene palette slot.
function addPaletteCycle(mem, wram, palette, slot) {
  const cycle = (at) => readWord(mem, (CYCLE_BANK << WORD_BITS) + at);
  for (let x = 0; x !== CYCLES * CYCLE_ENTRY_BYTES; x += CYCLE_ENTRY_BYTES) {
    if ((palette & BYTE_MASK) !== mem.read8((CYCLE_TABLE + x) & LONG_MASK)) continue;
    const record = readWord(mem, CYCLE_TABLE + x + 1);
    setWord(wram, DP_CYCLE_RECORD, record);
    const end = word(wram, PALETTE_SLOT_END);
    if (end === CYCLE_SLOTS_END) return;
    setWord(wram, PALETTE_DIRECTION + end, ((slot << NIBBLE_BITS) | cycle(record)) & WORD_MASK);
    setWord(wram, PALETTE_BYTES + end, cycle(record + CYCLE_LENGTH));
    setWord(wram, PALETTE_STEP + end, cycle(record + CYCLE_SPEED));
    setWord(wram, PALETTE_COUNT + end, cycle(record + CYCLE_STEPS));
    setWord(wram, PALETTE_TABLE + end, record + CYCLE_COLOURS);
    setWord(wram, PALETTE_SLOT_END, end + 2);
    return;
  }
}
// The scene palette slot of palette (81:8CE0); a palette seen first gets the next slot
// and is looked up in the palette cycles.
function scenePaletteSlot(mem, wram, palette) {
  const at = wramAt(SCENE_PALETTE_SLOTS) + ((palette << 1) & WORD_MASK),
    slot = word(wram, at);
  if (!(slot & WORD_SIGN)) return slot;
  const count = (word(wram, SCENE_PALETTE_COUNT) + 1) & WORD_MASK;
  setWord(wram, at, count);
  setWord(wram, SCENE_PALETTE_COUNT, count);
  const index = ((palette << 1) & WORD_MASK) >>> 1;
  setWord(wram, SCENE_PALETTE_LIST + ((count << 1) & WORD_MASK), index);
  addPaletteCycle(mem, wram, index, count);
  return word(wram, SCENE_PALETTE_COUNT);
}
// Place the tileset block of every drawn grid cell into the first layer (81:8EDF): the
// first 32 cells of each drawn row, from the last.
function placeGridBlocks(mem, wram) {
  const grid = wramAt(GRID_DRAWN);
  for (let x = GRID_DRAWN_LAST; ;) {
    const block = word(wram, grid + x);
    if (block) {
      setWord(wram, DP_GRID_OFFSET, x);
      const attribute = pointedByte(mem, wram, DP_ATTRIBUTES, block),
        slot = scenePaletteSlot(mem, wram, attribute);
      // The slot's bytes swapped, times 4: the palette bits of a tile word.
      const swapped = ((slot & BYTE_MASK) << BYTE_BITS) | (slot >>> BYTE_BITS);
      setWord(wram, DP_PALETTE_BITS, swapped << PALETTE_BITS_SHIFT_AFTER_SWAP);
      let y = (block << BLOCK_SHIFT) & WORD_MASK;
      const offset = word(wram, DP_GRID_OFFSET),
        column = (offset & GRID_CELL_MASK) << 1;
      setWord(wram, DP_SCRATCH, column);
      setWord(wram, DP_LAYER_OFFSET, ((offset & GRID_ROW_MASK) << GRID_ROW_SHIFT) | column);
      BLOCK_DESTINATIONS.forEach((destination, n) => {
        if (n) y = (y + 2) & WORD_MASK;
        const tile = pointed(mem, wram, DP_BLOCKS, y);
        if (!tile) return;
        setWord(wram, DP_TILE_FIRST, tile);
        const stack = internTileStack(wram);
        setWord(
          wram,
          destination + word(wram, DP_LAYER_OFFSET),
          stack | word(wram, DP_PALETTE_BITS),
        );
      });
      x = word(wram, DP_GRID_OFFSET);
    }
    x -= 2;
    if (x < 0) return;
    x &= ~GRID_RIGHT_HALF;
  }
}
// The wall tiles of every wall map cell (81:940A): from the second layer the tile
// itself and, as new single stacks, the second and third id of its stack (with its
// flip).
function buildWallTiles(wram) {
  const map = wramAt(WALL_MAP),
    tiles = wramAt(WALL_TILES);
  setWord(wram, DP_TILE_THIRD, 0);
  let y = SCENE_LAYER_BYTES - 2;
  for (let x = WALL_MAP_BYTES - 2; x >= 0; x -= 2) {
    const record = word(wram, map + x);
    if (record & WORD_SIGN) {
      y = (y - WALL_WORD_LAYER_BYTES) & WORD_MASK;
      continue;
    }
    let cell = (record + (WALL_WORD_CELLS - 1) * WALL_CELL_BYTES) & WORD_MASK;
    setWord(wram, DP_WALL_CELLS, WALL_WORD_CELLS);
    for (;;) {
      const tile = word(wram, SCENE_LAYER_HIGH + y);
      if (tile) {
        setWord(wram, tiles + cell, tile & (TILE_FLIP_BITS | TILE_NAME_MASK));
        const flip = tile & TILE_FLIP_BITS;
        setWord(wram, DP_FLIP, flip);
        const stack = (tile & TILE_NAME_MASK) << 1,
          second = word(wram, TILE_STACK_SECOND + stack);
        if (second) {
          setWord(wram, DP_TILE_FIRST, second ^ flip);
          const third = word(wram, TILE_STACK_THIRD + stack);
          setWord(wram, DP_TILE_SECOND, third ? third ^ flip : 0);
          setWord(wram, tiles + cell + 2, internTileStack(wram));
          const next = word(wram, DP_TILE_SECOND);
          if (next) {
            setWord(wram, DP_TILE_FIRST, next);
            setWord(wram, DP_TILE_SECOND, 0);
            setWord(wram, tiles + cell + (WALL_CELL_TILES - 1) * 2, internTileStack(wram));
          }
        }
      } else setWord(wram, tiles + cell, tile);
      y = (y - 2) & WORD_MASK;
      setWord(wram, DP_WALL_CELLS, word(wram, DP_WALL_CELLS) - 1);
      if (!word(wram, DP_WALL_CELLS)) break;
      cell = (cell - WALL_CELL_BYTES) & WORD_MASK;
    }
  }
}

// --- Layer stacks (81:903E) ---

// Direct page words of the layer stacks. Per object: the definition pointer (bank 13),
// its flip, its layer position (row in the high byte, column * 2 in the low byte) and
// depth, the parts left, x and y (then per part the part flip and the cell), z (then the
// row start) and the object word (then the part depth). Per graphic: its pointer (bank
// 16), the rows left, the cells per row and left, the palette bits, the tile, the cell
// depth and the read position. Per cell: the wall cell record, the layer offset, the
// full stack flag, the tile found there and the palette bits of the result.
const DP_LAYER_DEFINITION = 0x11,
  DP_LAYER_DEFINITION_BANK = 0x13,
  DP_OBJECT_FLIP = 0x29,
  DP_POSITION = 0x2c,
  DP_DEPTH = 0x2f,
  DP_PARTS = 0x32,
  DP_X = 0x35,
  DP_PART_FLIP = DP_X,
  DP_Y = 0x38,
  DP_CELL = DP_Y,
  DP_Z = 0x3b,
  DP_ROW_START = DP_Z,
  DP_WORD = 0x3e,
  DP_PART_DEPTH = DP_WORD,
  DP_GRAPHIC = 0x14,
  DP_GRAPHIC_BANK = 0x16,
  DP_ROWS_LEFT = 0x41,
  DP_ROW_CELLS = 0x44,
  DP_CELLS_LEFT = 0x47,
  DP_PALETTE = 0x4a,
  DP_TILE = 0x4d,
  DP_CELL_DEPTH = 0x50,
  DP_READ = 0x53,
  DP_CELL_RECORD = 0x56,
  DP_LAYER_CELL = 0x59,
  DP_STACK_FULL = 0x5f,
  DP_OLD_TILE = 0x62,
  DP_TILE_PALETTE = 0x68;
// Object definitions (src/data/object-types.mjs): the part count byte, the screen
// position word for an unflipped and a flipped object, the depth word, then 5 bytes
// per part (graphic word: number * 3 in bits 0-14, bit 15 flips; cell byte; row byte;
// depth byte). Bits 0-12 of the object word, doubled, index the type table; bits 13
// and 14 set the high byte of x and y.
const DEFINITION_OBJECT_BANK = OBJECT_TABLE >>> WORD_BITS,
  HEADER_POSITION = 1,
  HEADER_POSITION_FLIPPED = 3,
  HEADER_DEPTH = 5,
  HEADER_BYTES = 8,
  TYPE_INDEX_MASK = 0x3fff,
  GRAPHIC_INDEX_MASK = WORD_SIGN - 1,
  GRAPHIC_BANK_OFFSET = 2,
  OBJECT_X_HIGH = WORD_SIGN >>> 1,
  OBJECT_FLIPPED_ROWS = WORD_SIGN >>> 1,
  Z_SHIFT = 3,
  XY_SHIFT = 2;
// A graphic: rows in bits 0-3 and cells per row in bits 4-7 of byte 0; byte 1: bit 7
// one depth byte per row (else one per cell), bits 0-6 the palette; then per cell an
// optional depth byte and a tile word.
const GRAPHIC_ROWS_MASK = 0xf,
  GRAPHIC_CELLS_MASK = 0xf0,
  GRAPHIC_PALETTE_MASK = BYTE_SIGN - 1,
  DEPTH_PER_ROW = 0x7ffe;
// Layer position: row = (0300 - depth - 8 z) / 8 (13 bits, signed, times 2), column =
// (y - x + 0280) / 8 in the high byte. A cell is drawn for rows 20 to 7F and columns
// without bit 7; layer offset = row * 80 + column * 2 - 1000. Four layer cells share a
// wall map word, whose record holds three heights per cell.
const PROJECTION_ROW_BASE = 0x300,
  PROJECTION_COLUMN_BASE = 0x280,
  SHIFT_3 = 3,
  SHIFT_3_SIGN_BIT = 0x1000,
  SHIFT_3_SIGN_BITS = 0xe000,
  ROW_STEP = 0x100,
  CELL_FIRST_ROW = 0x2000,
  CELL_ROW_END = 0x8000,
  CELL_COLUMN_MASK = BYTE_SIGN - 1,
  LAYER_ORIGIN = 0x1000,
  WALL_WORD_MASK = 0xfff8,
  WALL_INDEX_SHIFT = 2,
  WALL_CELL_INDEX_MASK = 2 * (WALL_WORD_CELLS - 1),
  WALL_WORD_RECORD_BYTES = WALL_WORD_CELLS * WALL_CELL_BYTES,
  STACK_WORDS = 3,
  STACK_BYTES = 2 * STACK_WORDS,
  STACK_LAST = 2 * (STACK_WORDS - 1),
  HEIGHTS = wramAt(WALL_HEIGHTS);

const swapBytes = (value) => ((value & BYTE_MASK) << BYTE_BITS) | (value >>> BYTE_BITS);
// Release the stack entry of a tile taken from the layer: an unused entry leaves its
// hash chain and returns to the free stack.
function releaseTileStack(wram, tile) {
  const entry = (tile & TILE_NAME_MASK) << 1,
    uses = (word(wram, TILE_STACK_USES + entry) - 1) & WORD_MASK;
  setWord(wram, TILE_STACK_USES + entry, uses);
  if (!(uses & WORD_SIGN)) return;
  const free = (word(wram, DP_TILE_FREE) + 2) & WORD_MASK;
  setWord(wram, TILE_STACK_FREE + free, entry);
  setWord(wram, DP_TILE_FREE, free);
  const next = word(wram, TILE_STACK_NEXT + entry),
    previous = word(wram, TILE_STACK_PREVIOUS + entry);
  // A chain head's previous word is its bucket offset | 8000.
  if (previous & WORD_SIGN) setWord(wram, HEADS - WORD_SIGN + previous, next);
  else setWord(wram, TILE_STACK_NEXT + previous, next);
  if (!(next & WORD_SIGN)) setWord(wram, TILE_STACK_PREVIOUS + next, previous);
}
// The wall cell record of a layer offset (in DP 56): a wall map word holds four cell
// records; a new word takes the next four, whose first heights start empty.
function wallCellRecord(wram, offset) {
  const map = wramAt(WALL_MAP) + ((offset & WALL_WORD_MASK) >>> WALL_INDEX_SHIFT);
  setWord(wram, DP_SCRATCH, offset & WALL_CELL_INDEX_MASK);
  setWord(wram, DP_CELL_RECORD, STACK_WORDS * word(wram, DP_SCRATCH));
  let record = word(wram, map),
    carry = 0;
  if (record & WORD_SIGN) {
    record = word(wram, DP_WALL_NEXT);
    setWord(wram, map, record);
    const next = record + WALL_WORD_RECORD_BYTES;
    carry = next > WORD_MASK ? 1 : 0;
    setWord(wram, DP_WALL_NEXT, next);
    for (let n = 0; n < WALL_WORD_CELLS; n++)
      setWord(wram, HEIGHTS + n * WALL_CELL_BYTES + record, NONE);
  }
  setWord(wram, DP_CELL_RECORD, record + word(wram, DP_CELL_RECORD) + carry);
}
// The tile stack of the old tile at the cell into DP 1A-1E, its depth slot found among
// the cell's heights and the new tile placed there (part of 81:903E). Returns the byte
// offset of the new tile in DP 1A-1E, or -1 when the stack has no room in front.
function placeInStack(wram, old) {
  const depth = word(wram, DP_CELL_DEPTH),
    base = word(wram, DP_CELL_RECORD),
    stack = (old & TILE_NAME_MASK) << 1,
    flip = old & TILE_FLIP_BITS;
  setWord(wram, DP_TILE_PALETTE, old & TILE_PALETTE_BITS);
  if (flip) setWord(wram, DP_SCRATCH, flip);
  setWord(wram, DP_TILE_FIRST, word(wram, TILE_STACK_FIRST + stack) ^ flip);
  let x = base,
    y;
  const second = word(wram, TILE_STACK_SECOND + stack),
    third = second ? word(wram, TILE_STACK_THIRD + stack) : 0;
  setWord(wram, DP_TILE_SECOND, second ? second ^ flip : 0);
  setWord(wram, DP_TILE_THIRD, third ? third ^ flip : 0);
  if (!second) y = 1;
  else if (!third) y = 2;
  else y = STACK_WORDS;
  setWord(wram, DP_STACK_FULL, y === STACK_WORDS ? STACK_WORDS : 0);
  // Step through the stored heights while the cell depth lies below them.
  while (depth < word(wram, HEIGHTS + x)) {
    x = (x + 2) & WORD_MASK;
    if (!--y) {
      setWord(wram, DP_TILE_PALETTE, word(wram, DP_PALETTE));
      break;
    }
  }
  const height = (at) => word(wram, HEIGHTS + at),
    setHeight = (at, value) => setWord(wram, HEIGHTS + at, value),
    copyTile = (to, from) => setWord(wram, to, word(wram, from));
  if (word(wram, DP_STACK_FULL)) {
    // A full stack drops its front tile to make room behind.
    if (y === STACK_WORDS) return [-1, x];
    x = (x - 2) & WORD_MASK;
    if (y === 1) {
      copyTile(DP_TILE_FIRST, DP_TILE_SECOND);
      setHeight(x - 2, height(x));
    } else if (y !== 2) {
      copyTile(DP_TILE_FIRST, DP_TILE_SECOND);
      copyTile(DP_TILE_SECOND, DP_TILE_THIRD);
      setHeight(x - 2 * 2, height(x - 2));
      setHeight(x - 2, height(x));
      setWord(wram, DP_TILE_PALETTE, word(wram, DP_PALETTE));
    }
    return [(x - base) & WORD_MASK, x];
  }
  const at = (x - base) & WORD_MASK;
  if (at >= STACK_BYTES) return [-1, x];
  if (at === STACK_LAST) setWord(wram, DP_TILE_PALETTE, word(wram, DP_PALETTE));
  else if (!at) {
    setHeight(x + 2 * 2, height(x + 2));
    setHeight(x + 2, height(x));
    copyTile(DP_TILE_THIRD, DP_TILE_SECOND);
    copyTile(DP_TILE_SECOND, DP_TILE_FIRST);
  } else {
    setHeight(x + 2, height(x));
    copyTile(DP_TILE_THIRD, DP_TILE_SECOND);
  }
  return [at, x];
}
// Put the tile in DP 4D at the cell in DP 38 into the layer (part of 81:903E): it joins
// the stack of the tile already there at its depth, as long as the stack has room.
function drawLayerCell(wram) {
  const cell = word(wram, DP_CELL);
  setWord(wram, DP_SCRATCH, (cell & HIGH_BYTE_MASK) >>> 1);
  const offset = (((cell & CELL_COLUMN_MASK) | word(wram, DP_SCRATCH)) - LAYER_ORIGIN) & WORD_MASK;
  setWord(wram, DP_LAYER_CELL, offset);
  wallCellRecord(wram, offset);
  const layer = word(wram, DP_SCENE_LAYER),
    old = word(wram, layer + offset);
  setWord(wram, DP_OLD_TILE, old);
  let at = 0,
    x = word(wram, DP_CELL_RECORD);
  if (!old) {
    setWord(wram, DP_TILE_SECOND, 0);
    setWord(wram, DP_TILE_THIRD, 0);
    setWord(wram, HEIGHTS + 2 + x, NONE);
    setWord(wram, DP_TILE_PALETTE, word(wram, DP_PALETTE));
  } else {
    [at, x] = placeInStack(wram, old);
    if (at < 0) return;
  }
  setWord(wram, HEIGHTS + x, word(wram, DP_CELL_DEPTH));
  setWord(wram, DP_TILE_FIRST + at, word(wram, DP_TILE));
  if (old) releaseTileStack(wram, old);
  const stack = internTileStack(wram);
  setWord(
    wram,
    layer + word(wram, DP_LAYER_CELL),
    stack | word(wram, DP_TILE_PALETTE) | word(wram, DP_SCENE_LAYER_BITS),
  );
}
// Draw the graphic of one object part (DP 14) from its cell (DP 38) on, row by row.
function drawGraphic(mem, wram) {
  const graphic = (y) => pointed(mem, wram, DP_GRAPHIC, y),
    mode = () => word(wram, GRAPHIC_DEPTH_MODE);
  setWord(wram, DP_ROWS_LEFT, graphic(0) & GRAPHIC_ROWS_MASK);
  const cells = (graphic(0) & GRAPHIC_CELLS_MASK) >>> NIBBLE_BITS;
  setWord(wram, DP_ROW_CELLS, cells);
  setWord(wram, DP_CELLS_LEFT, cells);
  setWord(wram, GRAPHIC_DEPTH_MODE, graphic(1) & BYTE_SIGN ? DEPTH_PER_ROW : 0);
  const slot = scenePaletteSlot(mem, wram, graphic(1) & GRAPHIC_PALETTE_MASK);
  setWord(wram, DP_PALETTE, swapBytes(slot) << PALETTE_BITS_SHIFT_AFTER_SWAP);
  let y = 2;
  for (;;) {
    // A depth byte for each cell, or for the first cell of each row.
    setWord(wram, GRAPHIC_DEPTH_MODE, mode() + 1);
    const depthByte = !(mode() & WORD_SIGN);
    if (depthByte)
      setWord(wram, DP_CELL_DEPTH, (graphic(y) & BYTE_MASK) + word(wram, DP_PART_DEPTH));
    const cell = word(wram, DP_CELL),
      clipped = cell < CELL_FIRST_ROW || cell >= CELL_ROW_END || cell & BYTE_SIGN;
    if (depthByte) y++;
    const tile = clipped ? 0 : graphic(y);
    y += 2;
    setWord(wram, DP_READ, y);
    if (tile) {
      setWord(wram, DP_TILE, tile ^ word(wram, DP_PART_FLIP));
      drawLayerCell(wram);
    }
    setWord(wram, DP_CELLS_LEFT, word(wram, DP_CELLS_LEFT) - 1);
    if (!(word(wram, DP_CELLS_LEFT) & WORD_SIGN)) {
      setWord(wram, DP_CELL, word(wram, DP_CELL) + 2);
      y = word(wram, DP_READ);
      continue;
    }
    if ((mode() + 1) & WORD_SIGN) setWord(wram, GRAPHIC_DEPTH_MODE, DEPTH_PER_ROW);
    setWord(wram, DP_ROWS_LEFT, word(wram, DP_ROWS_LEFT) - 1);
    if (word(wram, DP_ROWS_LEFT) & WORD_SIGN) return;
    setWord(wram, DP_CELLS_LEFT, word(wram, DP_ROW_CELLS));
    const start = word(wram, DP_ROW_START),
      next = word(wram, DP_PART_FLIP) ? start - ROW_STEP : start + ROW_STEP;
    setWord(wram, DP_ROW_START, next);
    setWord(wram, DP_CELL, next);
    y = word(wram, DP_READ);
  }
}
// The objects of one object list (DP 0E, DP 17 of them) into the layer DP 5C with the
// bits DP 65 (81:903E): each part's graphic is drawn cell by cell into the layer's tile
// stacks. The record pointer moves on.
function buildLayerTileStacks(mem, wram) {
  const record = (y) => pointed(mem, wram, DP_SCENE_RECORD, y),
    definition = (y) => pointed(mem, wram, DP_LAYER_DEFINITION, y);
  wram[DP_LAYER_DEFINITION_BANK] = DEFINITION_OBJECT_BANK;
  let y = 0;
  do {
    const object = record(y),
      doubled = (object << 1) & WORD_MASK;
    setWord(wram, DP_WORD, doubled);
    y += 2;
    setWord(wram, DP_LAYER_DEFINITION, readWord(mem, OBJECT_TABLE + (doubled & TYPE_INDEX_MASK)));
    setWord(wram, DP_OBJECT_FLIP, object & WORD_SIGN ? TILE_H_FLIP : 0);
    setWord(wram, DP_Y, doubled & WORD_SIGN ? HIGH_BYTE_MASK : 0);
    setWord(wram, DP_X, doubled & OBJECT_X_HIGH ? HIGH_BYTE_MASK : 0);
    let z = record(y) & BYTE_MASK;
    if (z & BYTE_SIGN) z |= HIGH_BYTE_MASK;
    setWord(wram, DP_Z, z << Z_SHIFT);
    y++;
    for (const at of [DP_X, DP_Y]) {
      setWord(wram, at, ((record(y) & BYTE_MASK) | word(wram, at)) << XY_SHIFT);
      y++;
    }
    const objectEnd = y;
    // The layer position from the depth (x + y) / 2 and the height.
    setWord(wram, DP_DEPTH, ((word(wram, DP_X) + word(wram, DP_Y)) & WORD_MASK) >>> 1);
    let row =
      ((PROJECTION_ROW_BASE - word(wram, DP_DEPTH) - word(wram, DP_Z)) & WORD_MASK) >>> SHIFT_3;
    if (row & SHIFT_3_SIGN_BIT) row |= SHIFT_3_SIGN_BITS;
    setWord(wram, DP_POSITION, row << 1);
    const column =
      ((word(wram, DP_Y) - word(wram, DP_X) + PROJECTION_COLUMN_BASE) & WORD_MASK) >>> SHIFT_3;
    setWord(wram, DP_POSITION, swapBytes(column) + word(wram, DP_POSITION));
    const position = word(wram, DP_OBJECT_FLIP) ? HEADER_POSITION_FLIPPED : HEADER_POSITION;
    setWord(wram, DP_POSITION, definition(position) + word(wram, DP_POSITION));
    setWord(wram, DP_DEPTH, definition(HEADER_DEPTH) + word(wram, DP_DEPTH));
    const parts = definition(0) & BYTE_MASK;
    if (parts) {
      setWord(wram, DP_PARTS, parts);
      let p = HEADER_BYTES;
      do {
        const part = definition(p),
          index = (((part << 1) & WORD_MASK) + part) & GRAPHIC_INDEX_MASK;
        p += 2;
        wram[DP_GRAPHIC_BANK] = mem.read8(
          (GRAPHIC_TABLE + GRAPHIC_BANK_OFFSET + index) & LONG_MASK,
        );
        setWord(wram, DP_GRAPHIC, readWord(mem, GRAPHIC_TABLE + index));
        setWord(
          wram,
          DP_PART_FLIP,
          (part & WORD_SIGN ? TILE_H_FLIP : 0) ^ word(wram, DP_OBJECT_FLIP),
        );
        const place = definition(p);
        setWord(wram, DP_CELL, (place & BYTE_MASK) + word(wram, DP_POSITION));
        const rows = place & HIGH_BYTE_MASK;
        p += 2;
        // A flipped object steps its parts' rows up instead of down.
        if (word(wram, DP_OBJECT_FLIP) & OBJECT_FLIPPED_ROWS) {
          setWord(wram, DP_SCRATCH, rows);
          setWord(wram, DP_CELL, word(wram, DP_CELL) - rows);
        } else setWord(wram, DP_CELL, rows + word(wram, DP_CELL));
        setWord(wram, DP_ROW_START, word(wram, DP_CELL));
        const depth = (definition(p) & BYTE_MASK) + word(wram, DP_DEPTH);
        p++;
        setWord(wram, DP_PART_DEPTH, depth);
        setWord(wram, DP_CELL_DEPTH, depth);
        drawGraphic(mem, wram);
        setWord(wram, DP_PARTS, word(wram, DP_PARTS) - 1);
      } while (word(wram, DP_PARTS));
    }
    y = objectEnd;
    setWord(wram, DP_SCENE_COUNT, word(wram, DP_SCENE_COUNT) - 1);
  } while (word(wram, DP_SCENE_COUNT));
  setWord(wram, DP_SCENE_RECORD, y + word(wram, DP_SCENE_RECORD));
}

// --- The scene load (81:A117) ---

// Load scene (81:A117), a sequence. callSite is the address of the JSL that called the
// scene load.
export function* loadSceneSequence(h, scene, callSite) {
  const { ctx, a } = h,
    { mem, wram } = sceneRuntime(h),
    callerBank = ctx.programBank,
    dataBank = ctx.bank;
  const nextByte = () => {
    const value = pointedByte(mem, wram, DP_SCENE_RECORD, 0);
    setWord(wram, DP_SCENE_RECORD, word(wram, DP_SCENE_RECORD) + 1);
    return value;
  };
  yield () => {
    a.write(ctx.s, callerBank);
    ctx.s = (ctx.s - 1) & WORD_MASK;
    a.pushWord((callSite + JSL_LAST_BYTE) & WORD_MASK);
    a.write(ctx.s, dataBank);
    ctx.s = (ctx.s - 1) & WORD_MASK;
    Object.assign(ctx, { programBank: SCENE_LOAD_BANK, bank: SCENE_DATA_BANK });
    setWord(wram, DP_SCRATCH, scene);
    const entry = SCENE_STREAMS + ((scene * SCENE_STREAM_BYTES) & WORD_MASK);
    wram[DP_SCENE_RECORD_BANK] = WRAM_HIGH_BANK;
    wram[DP_OBJECT_LISTS_BANK] = WRAM_HIGH_BANK;
    setWord(wram, DP_SCENE_RECORD, SCENE_RECORD & WORD_MASK);
    unpackLong(
      mem,
      readWord(mem, entry),
      readWord(mem, entry + SCENE_STREAM_BANK),
      SCENE_RECORD & WORD_MASK,
      UNPACK_7F,
    );
  };
  yield () => {
    setWord(wram, SCENE_BACKDROP, pointed(mem, wram, DP_SCENE_RECORD, 0));
    setWord(wram, DP_SCENE_RECORD, word(wram, DP_SCENE_RECORD) + 2);
    const tileset = nextByte() << 1;
    setWord(wram, DP_BLOCKS_BANK, TILESET_BANK);
    setWord(wram, DP_ATTRIBUTES_BANK, TILESET_BANK);
    setWord(wram, DP_BLOCKS, readWord(mem, TILESET_BLOCKS + tileset));
    setWord(wram, DP_ATTRIBUTES, readWord(mem, TILESET_ATTRIBUTES + tileset));
    setWord(wram, DP_SCENE_COUNT, nextByte());
    drawSceneShapes(mem, wram);
    resetTileStacks(wram);
    // The original runs 81:8CB9 with data bank 7E: its DMA channel set-up lands in
    // WRAM at the register addresses (7E:4340 and 7E:4341), not in the hardware.
    resetScenePalettes(wram, { write: (address, value) => (wram[address] = value) });
    clearSceneLayers(wram);
    placeGridBlocks(mem, wram);
    clearWallMap(wram);
    setWord(wram, DP_OBJECT_LISTS, word(wram, DP_SCENE_RECORD));
  };
  // The two object lists: the first into the low layer, the second (with the free
  // stack in ascending order) into the high layer with priority.
  yield () => {
    let count = nextByte();
    if (count) {
      setWord(wram, DP_SCENE_COUNT, count);
      setWord(wram, DP_SCENE_LAYER, SCENE_LAYER_LOW);
      setWord(wram, DP_SCENE_LAYER_BITS, 0);
      buildLayerTileStacks(mem, wram);
      clearWallMap(wram);
    }
    count = nextByte();
    if (count) {
      setWord(wram, DP_SCENE_COUNT, count);
      setWord(wram, DP_SCENE_LAYER, SCENE_LAYER_HIGH);
      setWord(wram, DP_SCENE_LAYER_BITS, TILE_PRIORITY);
      resetTileStacksAscending(wram);
      buildLayerTileStacks(mem, wram);
    }
    buildWallTiles(wram);
    ctx.s = (ctx.s + 1) & WORD_MASK;
    ctx.bank = dataBank;
    a.pullWord();
    ctx.s = (ctx.s + 1) & WORD_MASK;
    ctx.programBank = callerBank;
  };
}
