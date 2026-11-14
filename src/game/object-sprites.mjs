// The sprites of one object (lifted from 80:B20A with the occlusion grids 80:B45D to
// 80:B754, the map cell test and the occlusion sprite 80:B130; register-level versions
// in src/task/native-scene-sprites.mjs and src/task/native-sprite-occlusion.mjs).
//
// The sprite list calls it for every drawn object with a picture (picture pointer in A,
// the object in Y). The picture (bank 9B, or 9C with bit 15 of the pointer) starts with
// its anchor (two bytes, doubled), its size (rows of 16x16 parts in the high nibble,
// columns in the low one) and one byte per part (bit 5: empty, bits 6 and 7: flip).
// The object's palette gets its slot (80:AB0A). Its screen position is projected from
// its diagonal, height, y and x and the camera in quarter units: row (0C00 - diagonal -
// height - anchor y) / 4, column (0600 + y - x - anchor x) / 4. An object below or right
// of the screen, or entirely above or left of it, is hidden (flag 0800).
//
// The OAM priority of each part comes from the occlusion masks 7E:1872: with a depth
// order (7E:1400) all parts are in front (priority 2) or behind (3, flag 0200). Otherwise
// the wall map in bank 7F is walked over the cells the picture covers (one map word per
// four cells of a column, six bytes per cell): a cell whose wall heights (7F:0C00, 0C02,
// 0C04) are lower than the object's depth puts that wall's tile (7F:69C0 and on) in front
// of it. The occlusion grid of the picture's alignment then enters each covering wall
// tile as an 8x8 sprite and gives the parts with walls in front priority 3. Each visible
// part takes the next OAM entry (offset in the direct page word 84) with its VRAM tile
// from the object's slot chain; parts left of the screen set their X bit 8 in the high
// table, the wall sprites their small size. The object's flags collect the cells met:
// on screen (0004), and front walls and open cells as covered (0200) or hidden (0800).
//
// The direct page words of the original are written as it writes them, the return words
// of the inner calls and the grid's pushed index and column on the stack. X is left as
// the original leaves it (the sprite list's last object passes it on); A, the flags and
// Y (the caller pulls it) are not produced. The fields the original reads through its
// data bank 80 lie below 2000 (`object_slot_required` past it), the walls in bank 7F, the
// pictures in 9B and 9C.
import { taskStop } from '../task/plan.mjs';
import { paletteSlot } from './palette-slots.mjs';
import {
  CAMERA_X,
  CAMERA_Y,
  CELL_BITS,
  CELL_FRONT_WALL,
  CELL_OPEN,
  ENTERED_OBJECT,
  ENTERED_OBJECT_FLAGS,
  OAM_BUFFER,
  OAM_HIGH_TABLE,
  OBJECT_COVERED,
  OBJECT_DEPTH_ORDER,
  OBJECT_DIAGONAL,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_HIDDEN,
  OBJECT_ON_SCREEN,
  OBJECT_PALETTE,
  OBJECT_VRAM_SLOT_HEAD,
  OBJECT_X,
  OBJECT_Y,
  OCCLUSION_COLUMN_BYTES,
  OCCLUSION_MASKS,
  OCCLUSION_TILES,
  VRAM_SLOT_NEXT,
  WALL_CELL_BYTES,
  WALL_HEIGHTS,
  WALL_MAP,
  WALL_TILES,
  WALL_WORD_CELLS,
  WRAM,
} from '../task/wram.mjs';
import {
  OAM_ENTRY_BYTES,
  OAM_FLIP_MASK,
  OAM_LOW_TABLE_BYTES,
  OAM_NAME_BYTE,
  OAM_NAME_HIGH,
  OAM_PRIORITY_2,
  OAM_PRIORITY_3,
  OAM_Y_BYTE,
} from '../constants/ppu.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  HEX_RADIX,
  LONG_MASK,
  NIBBLE_BITS,
  NIBBLE_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

// The direct page words: the picture pointer and its bank, the part's screen position
// (12: the high byte of x), the top row, the anchor, the columns, the rows and the rows
// left, the VRAM tile, the palette slot, the cell position, the depth (later the part's
// priority), the map walk (cell rows and columns, map word, cell offset, cells per map
// word, rows left, columns left, column word, depth order or alignment, row offset, the
// first and top cell rows), the camera and a scratch word, and the OAM offset.
const DP_PICTURE = 0x0e,
  DP_PICTURE_BANK = 0x10,
  DP_SCREEN_X = 0x11,
  DP_SCREEN_X_HIGH = 0x12,
  DP_TOP_Y = 0x14,
  DP_SCREEN_Y = 0x17,
  DP_ANCHOR_X = 0x1a,
  DP_ANCHOR_Y = 0x1d,
  DP_COLUMNS = 0x20,
  DP_ROWS = 0x23,
  DP_ROWS_LEFT = 0x26,
  DP_TILE = 0x29,
  DP_PALETTE_SLOT = 0x2c,
  DP_CELL_X = 0x2f,
  DP_CELL_Y = 0x32,
  DP_DEPTH = 0x35,
  DP_PRIORITY = DP_DEPTH,
  DP_CELL_ROWS = 0x38,
  DP_CELL_COLUMNS = 0x3b,
  DP_MAP_WORD = 0x41,
  DP_CELL_OFFSET = 0x44,
  DP_FIRST_WORD_CELLS = 0x47,
  DP_WORD_CELLS = 0x4a,
  DP_CELL_ROWS_LEFT = 0x4d,
  DP_COLUMN_WORD = 0x53,
  DP_COLUMNS_LEFT = 0x56,
  DP_DEPTH_ORDER = 0x59,
  DP_COLUMN_ALIGNED = DP_DEPTH_ORDER,
  DP_ROW_OFFSET = 0x5c,
  DP_FIRST_CELL_Y = 0x5f,
  DP_TOP_CELL_Y = 0x62,
  DP_CAMERA_X = 0x65,
  DP_CAMERA_Y = 0x68,
  DP_SCRATCH = 0x6b,
  DP_OAM_OFFSET = 0x84;
// The picture: banks 9B and 9C, the size byte and the parts; an empty part.
const PICTURE_BANK = 0x9b,
  HIGH_PICTURE = WORD_SIGN,
  PICTURE_SIZE = 2,
  PICTURE_PARTS = 3,
  ROWS_MASK = 0xf0,
  PART_EMPTY = 0x20;
// The projection bases, the visible area (positions from -8 count), the cell and part
// sizes in pixels.
const ROW_BASE = 0xc00,
  COLUMN_BASE = 0x600,
  QUARTER_SHIFT = 2,
  VISIBLE_HEIGHT = 0xd8,
  VISIBLE_WIDTH = 0xf8,
  EDGE_MIN = 0xfff8,
  CELL_SIZE = 8,
  PART_SIZE = 0x10,
  // The picture's pixel rows to rows of 8x8 cells.
  CELL_ROW_SHIFT = 3,
  // The OAM entry's attribute byte follows the tile name.
  OAM_ATTRIBUTE_BYTE = OAM_NAME_BYTE + 1;
// The map walk: the cell alignment, the map word's rows and cell index bits, a column of
// map words, the cell rows of a map word (times four).
const CELL_ALIGN = 0xfff8,
  CELL_OFFSET_MASK = 7,
  MAP_WORD_ROWS = 0xffe0,
  MAP_CELL_INDEX = 0x18,
  MAP_COLUMN_BYTES = 0x20,
  SIGN_NIBBLE = 0xf000,
  CELL_BYTE_SHIFT = 2,
  WORD_CELL_BYTES = WALL_WORD_CELLS << CELL_BYTE_SHIFT,
  // The heights and tiles of a cell's three walls.
  WALL_LAYERS = 3;
// The occlusion grids: a part covers two cells down (four bytes) and two columns across.
const PART_CELL_BYTES = 4,
  PART_COLUMN_BYTES = 2 * OCCLUSION_COLUMN_BYTES;
// The high table bytes: X bit 8 of a part (ORA) and the small size of a wall sprite (AND).
const HIGH_X_BITS = 0x80b85e,
  SMALL_SPRITE_BITS = 0x80b18a;
// The return words of the inner calls: the palette slot and the occlusion sprite.
const PALETTE_CALL = 0x80b23d,
  PALETTE_TARGET = 0x80ab0a,
  SPRITE_TARGET = 0x80b130;
// The occlusion grids by alignment: A (neither column nor row aligned), B (row aligned),
// C (column aligned), D (both). The cells tested (byte offsets of 1872 and 1A72), and
// the steps between the wall sprites: a cell's sprite, the hidden flag, the first and
// the next row down, the next column (saving the column), back to the top row, right.
const GRIDS = {
  A: {
    checks: [0, 2, 4, 0x20, 0x22, 0x24, 0x40, 0x42, 0x44],
    steps: [
      'c0',
      'hide',
      'first',
      'c2',
      'down',
      'c4',
      'next',
      'c20',
      'down',
      'c22',
      'down',
      'c24',
      'top',
      'right',
      'c40',
      'down',
      'c42',
      'down',
      'c44',
      'top',
    ],
    calls: [0xb486, 0xb49c, 0xb4aa, 0xb4bd, 0xb4cb, 0xb4d9, 0xb4eb, 0xb4f9, 0xb507],
  },
  B: {
    checks: [0, 2, 0x20, 0x22, 0x40, 0x42],
    steps: [
      'c0',
      'hide',
      'first',
      'c2',
      'next',
      'c20',
      'down',
      'c22',
      'top',
      'right',
      'c40',
      'down',
      'c42',
      'top',
    ],
    calls: [0xb56c, 0xb582, 0xb595, 0xb5a3, 0xb5b5, 0xb5c3],
  },
  C: {
    checks: [0, 2, 4, 0x20, 0x22, 0x24],
    steps: [
      'c0',
      'hide',
      'first',
      'c2',
      'down',
      'c4',
      'next',
      'c20',
      'down',
      'c22',
      'down',
      'c24',
      'top',
    ],
    calls: [0xb62f, 0xb645, 0xb653, 0xb666, 0xb674, 0xb682],
  },
  D: {
    checks: [0, 2, 0x20, 0x22],
    steps: ['c0', 'hide', 'first', 'c2', 'nextOnly', 'c22', 'top', 'c20'],
    calls: [0xb6e1, 0xb6f7, 0xb706, 0xb710],
  },
};
const LOW_WRAM_END = 0x2000;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const longByte = (mem, at) => mem.read8(at & LONG_MASK);
const longWord = (mem, at) => longByte(mem, at) | (longByte(mem, at + 1) << BYTE_BITS);
// A word shifted right twice with its sign (SEC; ROR twice) or without.
const quarter = (value) =>
  value & WORD_SIGN
    ? WORD_SIGN | (WORD_SIGN >>> 1) | (value >>> QUARTER_SHIFT)
    : value >>> QUARTER_SHIFT;

// Enter the sprites of the object in Y with the picture in A (80:B20A, called with JSR);
// returns with its RTS.
export function enterObjectSprites(h) {
  const { ctx, a } = h,
    { mem } = a,
    { wram } = mem,
    slot = ctx.y,
    picture = ctx.a;
  // Fields of the data bank 80 below 2000, the direct page, the OAM buffer in bank 7E.
  const at = (field, index) => {
    if (field + index + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { field, index });
    return field + index;
  };
  const get = (field, index = slot) => word(wram, at(field, index)),
    put = (field, value, index = slot) => setWord(wram, at(field, index), value),
    dp = (offset) => word(wram, offset),
    setDp = (offset, value) => setWord(wram, offset, value),
    oam = (offset, value) => mem.write8((WRAM + OAM_BUFFER + offset) & LONG_MASK, value);
  const addFlags = (bits) => put(ENTERED_OBJECT_FLAGS, get(ENTERED_OBJECT_FLAGS, 0) | bits, 0);
  // The high table byte of the OAM entry before offset (the original's X after it).
  const highBits = (offset, table, or) => {
    const index = ((offset >>> QUARTER_SHIFT) - 1) & WORD_MASK,
      bits = longByte(mem, table + index);
    wram[DP_SCRATCH] = bits;
    const x = (index & ~BYTE_MASK) | ((index & BYTE_MASK) >>> QUARTER_SHIFT),
      high = (WRAM + OAM_HIGH_TABLE + x) & LONG_MASK;
    mem.write8(high, or ? bits | mem.read8(high) : bits & mem.read8(high));
    return x;
  };
  let x = ctx.x;
  const leave = () => {
    ctx.x = x;
    return h.rts();
  };
  const hide = () => {
    put(OBJECT_FLAGS, get(OBJECT_FLAGS) | OBJECT_HIDDEN, get(ENTERED_OBJECT, 0));
    return leave();
  };

  // The picture, its anchor, the palette slot and the projection.
  put(ENTERED_OBJECT, slot, 0);
  put(ENTERED_OBJECT_FLAGS, 0, 0);
  setDp(DP_PICTURE, picture | HIGH_PICTURE);
  setDp(DP_PICTURE_BANK, PICTURE_BANK + (picture >>> (WORD_BITS - 1)));
  const pictureAt = (offset) =>
    ((wram[DP_PICTURE_BANK] << WORD_BITS) + dp(DP_PICTURE) + offset) & LONG_MASK;
  setDp(DP_ANCHOR_X, longByte(mem, pictureAt(0)) << 1);
  setDp(DP_ANCHOR_Y, longByte(mem, pictureAt(1)) << 1);
  put(OBJECT_FLAGS, get(OBJECT_FLAGS) & ~(OBJECT_ON_SCREEN | OBJECT_COVERED | OBJECT_HIDDEN));
  ctx.a = get(OBJECT_PALETTE);
  h.call(PALETTE_CALL, PALETTE_TARGET, () => paletteSlot(h));
  x = ctx.x;
  setDp(DP_PALETTE_SLOT, ctx.a);
  setDp(DP_DEPTH, get(OBJECT_DIAGONAL) >>> QUARTER_SHIFT);
  const cameraY = word(wram, CAMERA_Y) >>> QUARTER_SHIFT;
  setDp(DP_CAMERA_Y, cameraY);
  const cellY = quarter(
    (ROW_BASE - get(OBJECT_DIAGONAL) - get(OBJECT_HEIGHT) - dp(DP_ANCHOR_Y)) & WORD_MASK,
  );
  setDp(DP_CELL_Y, cellY);
  const top = (cellY - cameraY) & WORD_MASK;
  if (!(top & WORD_SIGN) && top >= VISIBLE_HEIGHT) return hide();
  setDp(DP_TOP_Y, top);
  setDp(DP_SCREEN_Y, top);
  const cameraX = word(wram, CAMERA_X) >>> QUARTER_SHIFT;
  setDp(DP_CAMERA_X, cameraX);
  const cellX = quarter(
    (COLUMN_BASE + get(OBJECT_Y) - get(OBJECT_X) - dp(DP_ANCHOR_X)) & WORD_MASK,
  );
  setDp(DP_CELL_X, cellX);
  const left = (cellX - cameraX) & WORD_MASK;
  if (!(left & WORD_SIGN) && left >= VISIBLE_WIDTH) return hide();
  setDp(DP_SCREEN_X, left);
  setDp(DP_TILE, get(OBJECT_VRAM_SLOT_HEAD));
  setDp(DP_DEPTH_ORDER, get(OBJECT_DEPTH_ORDER));
  // The size: rows of parts (high nibble) and columns; entirely above or left: hidden.
  const size = longWord(mem, pictureAt(PICTURE_SIZE)),
    height = size & ROWS_MASK;
  setDp(DP_SCRATCH, height);
  if ((height + top + CELL_SIZE) & WORD_SIGN) return hide();
  setDp(DP_CELL_ROWS, height >>> CELL_ROW_SHIFT);
  setDp(DP_ROWS, height >>> NIBBLE_BITS);
  setDp(DP_ROWS_LEFT, height >>> NIBBLE_BITS);
  const columns = size & NIBBLE_MASK;
  setDp(DP_COLUMNS, columns);
  setDp(DP_COLUMNS_LEFT, columns);
  setDp(DP_CELL_COLUMNS, columns << 1);
  if (((columns << NIBBLE_BITS) + left + CELL_SIZE) & WORD_SIGN) return hide();

  const depthOrder = dp(DP_DEPTH_ORDER);
  if (depthOrder) {
    // All parts in front, or all behind (covered).
    let priority = OAM_PRIORITY_2;
    if (depthOrder & WORD_SIGN) {
      addFlags(OBJECT_COVERED);
      priority = OAM_PRIORITY_3;
    }
    x = 0;
    do {
      let rows = dp(DP_ROWS);
      do {
        put(OCCLUSION_MASKS, priority, x);
        x = (x + 2) & WORD_MASK;
        rows = (rows - 1) & WORD_MASK;
      } while (rows);
      setDp(DP_COLUMNS_LEFT, dp(DP_COLUMNS_LEFT) - 1);
    } while (dp(DP_COLUMNS_LEFT));
  } else {
    walkWallMap();
    x = occlusionGrid();
  }
  return enterParts();

  // The walls in front of the object, cell by cell (80:B2F2 to 80:B45C): a front wall
  // tile per cell in 1A72 and its mask (FFFF: a wall behind or an open cell) in 1872.
  function walkWallMap() {
    const rowOffset = cellY & CELL_OFFSET_MASK;
    if (rowOffset) setDp(DP_CELL_ROWS, dp(DP_CELL_ROWS) + 1);
    setDp(DP_ROW_OFFSET, rowOffset);
    setDp(DP_COLUMN_ALIGNED, cellX);
    const alignedX = cellX & CELL_ALIGN;
    if (alignedX !== cellX) {
      setDp(DP_CELL_COLUMNS, dp(DP_CELL_COLUMNS) + 1);
      setDp(DP_COLUMN_ALIGNED, 0);
    }
    const columnBytes = (alignedX << CELL_BYTE_SHIFT) & WORD_MASK;
    setDp(DP_SCRATCH, columnBytes);
    setDp(DP_CELL_X, alignedX - cameraX);
    const rows = cellY & MAP_WORD_ROWS,
      rowWord = rows & WORD_SIGN ? SIGN_NIBBLE | (rows >>> NIBBLE_BITS) : rows >>> NIBBLE_BITS;
    let mapWord = rowWord | columnBytes;
    setDp(DP_MAP_WORD, mapWord);
    setDp(DP_COLUMN_WORD, mapWord);
    x = mapWord;
    const cellIndex = (cellY & MAP_CELL_INDEX) >>> 1;
    setDp(DP_SCRATCH, cellIndex);
    setDp(DP_CELL_OFFSET, (cellIndex >>> 1) + cellIndex);
    setDp(DP_CELL_Y, (cellY & CELL_ALIGN) - cameraY);
    setDp(DP_TOP_CELL_Y, (cellY & CELL_ALIGN) - cameraY);
    const firstCells = (WORD_CELL_BYTES - cellIndex) >>> CELL_BYTE_SHIFT;
    setDp(DP_FIRST_WORD_CELLS, firstCells);
    setDp(DP_WORD_CELLS, firstCells);
    let y = 0;
    const decrement = (offset) => {
      setDp(offset, dp(offset) - 1);
      return dp(offset);
    };
    for (;;) {
      setDp(DP_CELL_ROWS_LEFT, dp(DP_CELL_ROWS));
      let value = longWord(mem, WALL_MAP + x),
        state = value & WORD_SIGN ? 'empty' : 'first';
      column: for (;;) {
        if (state === 'empty') {
          // No walls in this map word.
          for (;;) {
            put(OCCLUSION_MASKS, 0, y);
            put(OCCLUSION_TILES, 0, y);
            y = (y + 2) & WORD_MASK;
            if (!decrement(DP_CELL_ROWS_LEFT)) break column;
            if (!decrement(DP_WORD_CELLS)) break;
          }
        } else {
          if (state === 'first') value = (value + dp(DP_CELL_OFFSET)) & WORD_MASK;
          x = value;
          put(OCCLUSION_MASKS, wallCell(x, y), y);
          y = (y + 2) & WORD_MASK;
          if (!decrement(DP_CELL_ROWS_LEFT)) break;
          if (decrement(DP_WORD_CELLS)) {
            value = (x + WALL_CELL_BYTES) & WORD_MASK;
            state = 'cell';
            continue;
          }
        }
        // The next map word of the column.
        setDp(DP_WORD_CELLS, WALL_WORD_CELLS);
        x = (dp(DP_MAP_WORD) + 2) & WORD_MASK;
        setDp(DP_MAP_WORD, x);
        value = longWord(mem, WALL_MAP + x);
        state = value & WORD_SIGN ? 'empty' : 'cell';
      }
      if (!decrement(DP_CELL_COLUMNS)) break;
      setDp(DP_WORD_CELLS, dp(DP_FIRST_WORD_CELLS));
      const next = (y & ~(OCCLUSION_COLUMN_BYTES - 1) & WORD_MASK) + OCCLUSION_COLUMN_BYTES;
      y = next & WORD_MASK;
      mapWord = (dp(DP_COLUMN_WORD) + MAP_COLUMN_BYTES + (next > WORD_MASK ? 1 : 0)) & WORD_MASK;
      setDp(DP_COLUMN_WORD, mapWord);
      setDp(DP_MAP_WORD, mapWord);
      x = mapWord;
    }
  }

  // The map cell at x for the occlusion cell y: the first wall lower than the object's
  // depth puts its tile in front; returns the mask.
  function wallCell(cell, y) {
    const depth = dp(DP_DEPTH);
    for (let layer = 0; layer < WALL_LAYERS; layer++) {
      const wallHeight = longWord(mem, WALL_HEIGHTS + 2 * layer + cell);
      if (wallHeight & WORD_SIGN) {
        if (!layer) {
          put(OCCLUSION_TILES, 0, y);
          return 0;
        }
        break;
      }
      if (wallHeight < depth) {
        put(OCCLUSION_TILES, longWord(mem, WALL_TILES + 2 * layer + cell), y);
        if (layer) return WORD_MASK;
        addFlags(CELL_FRONT_WALL);
        return 0;
      }
    }
    addFlags(CELL_OPEN);
    put(OCCLUSION_TILES, 0, y);
    return WORD_MASK;
  }

  // The occlusion grid of the picture's alignment (80:B45D to 80:B754): each part's
  // priority, and its covering wall tiles as 8x8 sprites. Returns the original's X.
  function occlusionGrid() {
    const aligned = dp(DP_COLUMN_ALIGNED) !== 0,
      grid = GRIDS[(aligned ? 'CD' : 'AB')[dp(DP_ROW_OFFSET) ? 0 : 1]];
    let index = 0,
      y = 0;
    for (;;) {
      const covered = grid.checks.some((offset) => get(OCCLUSION_MASKS, y + offset));
      let priority = OAM_PRIORITY_2;
      if (covered) {
        a.pushWord(index);
        let call = 0;
        for (const step of grid.steps) {
          if (step[0] === 'c') {
            const tile = get(OCCLUSION_TILES, y + parseInt(step.slice(1), HEX_RADIX));
            h.call(grid.calls[call++], SPRITE_TARGET, () => wallSprite(tile, y));
          } else if (step === 'hide') addFlags(OBJECT_HIDDEN);
          else if (step === 'first') {
            setDp(DP_FIRST_CELL_Y, dp(DP_CELL_Y));
            setDp(DP_CELL_Y, dp(DP_CELL_Y) + CELL_SIZE);
          } else if (step === 'down') setDp(DP_CELL_Y, dp(DP_CELL_Y) + CELL_SIZE);
          else if (step === 'next' || step === 'nextOnly') {
            a.pushWord(dp(DP_CELL_X));
            setDp(DP_CELL_X, dp(DP_CELL_X) + CELL_SIZE);
            if (step === 'next') setDp(DP_CELL_Y, dp(DP_FIRST_CELL_Y));
          } else if (step === 'top') setDp(DP_CELL_Y, dp(DP_FIRST_CELL_Y));
          else if (step === 'right') setDp(DP_CELL_X, dp(DP_CELL_X) + CELL_SIZE);
        }
        setDp(DP_CELL_X, a.pullWord());
        index = a.pullWord();
        priority = OAM_PRIORITY_3;
      }
      put(OCCLUSION_MASKS, priority, index);
      index = (index + 2) & WORD_MASK;
      setDp(DP_ROWS_LEFT, dp(DP_ROWS_LEFT) - 1);
      if (dp(DP_ROWS_LEFT)) {
        setDp(DP_CELL_Y, dp(DP_CELL_Y) + PART_SIZE);
        y = (y + PART_CELL_BYTES) & WORD_MASK;
        continue;
      }
      setDp(DP_COLUMNS_LEFT, dp(DP_COLUMNS_LEFT) - 1);
      if (!dp(DP_COLUMNS_LEFT)) return index;
      const next = (y & ~(PART_COLUMN_BYTES - 1) & WORD_MASK) + PART_COLUMN_BYTES;
      y = next & WORD_MASK;
      setDp(DP_CELL_X, dp(DP_CELL_X) + PART_SIZE + (next > WORD_MASK ? 1 : 0));
      setDp(DP_CELL_Y, dp(DP_TOP_CELL_Y));
      setDp(DP_ROWS_LEFT, dp(DP_ROWS));
    }
  }

  // A wall tile as a small 8x8 sprite at the cell position (80:B130); the grid cell's
  // tile is cleared once an OAM entry is left for it.
  function wallSprite(tile, y) {
    if (tile) {
      let offset = dp(DP_OAM_OFFSET);
      if (offset < OAM_LOW_TABLE_BYTES) {
        oam(offset + OAM_NAME_BYTE, (tile | OAM_NAME_HIGH) & BYTE_MASK);
        oam(offset + OAM_NAME_BYTE + 1, ((tile | OAM_NAME_HIGH) >>> BYTE_BITS) & BYTE_MASK);
        put(OCCLUSION_TILES, 0, y);
        const row = dp(DP_CELL_Y),
          column = dp(DP_CELL_X);
        if (
          !(row & WORD_SIGN) &&
          row < VISIBLE_HEIGHT &&
          !(column & WORD_SIGN) &&
          column < VISIBLE_WIDTH
        ) {
          oam(offset, column & BYTE_MASK);
          oam(offset + OAM_Y_BYTE, (row - 1) & BYTE_MASK);
          offset = (offset + OAM_ENTRY_BYTES) & WORD_MASK;
          setDp(DP_OAM_OFFSET, offset);
          highBits(offset, SMALL_SPRITE_BITS, false);
        }
      }
    }
    return h.rts();
  }

  // The parts of the picture, column by column (80:B755 to 80:B813), then the cells met
  // into the object's flags (80:B814).
  function enterParts() {
    addFlags(OBJECT_ON_SCREEN);
    setDp(DP_ROWS_LEFT, dp(DP_ROWS));
    let part = PICTURE_PARTS;
    for (;;) {
      const screenX = dp(DP_SCREEN_X),
        screenY = dp(DP_SCREEN_Y),
        visible =
          (screenX >= EDGE_MIN || screenX < VISIBLE_WIDTH) &&
          (screenY >= EDGE_MIN || screenY < VISIBLE_HEIGHT),
        byte = longByte(mem, pictureAt(part));
      let next = !(byte & PART_EMPTY);
      if (visible && next) {
        x = (part << 1) & WORD_MASK;
        setDp(DP_PRIORITY, get(OCCLUSION_MASKS - 2 * PICTURE_PARTS, x));
        x = dp(DP_OAM_OFFSET);
        if (x >= OAM_LOW_TABLE_BYTES) next = false;
        else {
          oam(x, screenX & BYTE_MASK);
          oam(x + OAM_Y_BYTE, (screenY - 1) & BYTE_MASK);
          oam(x + OAM_NAME_BYTE, wram[DP_TILE]);
          oam(
            x + OAM_ATTRIBUTE_BYTE,
            (byte & OAM_FLIP_MASK) | wram[DP_PALETTE_SLOT] | wram[DP_PRIORITY],
          );
          x = (x + OAM_ENTRY_BYTES) & WORD_MASK;
          setDp(DP_OAM_OFFSET, x);
          if (wram[DP_SCREEN_X_HIGH] & BYTE_SIGN) x = highBits(x, HIGH_X_BITS, true);
        }
      }
      if (next) {
        // The next VRAM tile of the slot chain (a byte).
        x = dp(DP_TILE);
        wram[DP_TILE] = wram[at(VRAM_SLOT_NEXT, x)];
      }
      part = (part + 1) & WORD_MASK;
      setDp(DP_ROWS_LEFT, dp(DP_ROWS_LEFT) - 1);
      if (dp(DP_ROWS_LEFT)) {
        setDp(DP_SCREEN_Y, dp(DP_SCREEN_Y) + PART_SIZE);
        continue;
      }
      setDp(DP_COLUMNS, dp(DP_COLUMNS) - 1);
      if (!dp(DP_COLUMNS)) break;
      setDp(DP_SCREEN_X, dp(DP_SCREEN_X) + PART_SIZE);
      setDp(DP_ROWS_LEFT, dp(DP_ROWS));
      setDp(DP_SCREEN_Y, dp(DP_TOP_Y));
    }
    // Front walls alone leave the flags; open cells cover the object, both hide it.
    const entered = get(ENTERED_OBJECT_FLAGS, 0),
      cells = entered & CELL_BITS,
      object = get(ENTERED_OBJECT, 0);
    let bits = entered;
    if (cells === CELL_BITS) bits = (entered & ~CELL_BITS) | OBJECT_HIDDEN;
    else if (cells) bits = (entered & ~CELL_BITS) | (cells & CELL_FRONT_WALL ? 0 : OBJECT_COVERED);
    put(OBJECT_FLAGS, get(OBJECT_FLAGS, object) | bits, object);
    return leave();
  }
}
