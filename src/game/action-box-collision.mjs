// The collision test of an object's action box (lifted from the script native 80:8371
// with its cell search 80:8486 and the moving box list 81:8686; register-level reference
// in proof/game-reference/action-box-collision.mjs).
//
// The object (direct page word 00) would take the action of its kind in the direction of
// word 02: the action table 8C:xxxx gives the action record, whose first word points to
// its box shape (bytes 3 to 6 the signed lowest and highest x and y offsets, byte 7 the
// height). The box in quarter units is the object's position divided by 4 plus the
// offsets, from its height divided by 4 (bottom) up by the shape's height (top). The
// grid cells of its corners are searched, each distinct cell once (lowest x and highest
// y first, then lowest x and lowest y, highest x and lowest y, highest x and highest y),
// until a cell yields a height: the moving boxes of the cell that overlap the box (the
// box's bottom at most the object's top) and whose top lies above the object's bottom by
// at least the largest height so far, except the object's own box and, for an object
// with both flag bits 0 and 1, the player figure's box. The result in word 00 is FFFF
// when a height above 0 was found, else 0.
//
// Memory is reached as the original reaches it: the kind long in bank 7E, the action
// table and shape long in bank 8C, the object fields, the grid and the boxes through the
// data bank 7E it sets (PHB, PEA 7E7E, PLB) with 24-bit indexes, the box's object word
// long in bank 7F. The direct page words the original uses as locals are written as in
// the original (pointers 00 to 06, box 11 to 20, cell columns and rows 23 to 2C, cells
// 2F to 38, height 3B, object 3E). Return words, the saved data bank and the list
// walk's pushes are not reproduced: they lie only in free stack bytes that nothing
// reads (game state only, docs/STRATEGY.md).
import {
  CELL_COORDINATE_MASK,
  COLLISION_BOX_BOTTOM,
  COLLISION_BOX_OBJECT,
  COLLISION_BOX_TOP,
  COLLISION_BOX_X0,
  COLLISION_BOX_X1,
  COLLISION_BOX_Y0,
  COLLISION_BOX_Y1,
  COLLISION_CELL_HEADS,
  COLLISION_NODE_BOX,
  COLLISION_NODE_NEXT,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_KIND,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_OBJECT,
  WRAM,
} from '../data/wram.mjs';
import { ACTION_TABLE } from '../data/actions.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';
import {
  BYTE_BITS,
  BYTE_SIGN,
  HIGH_BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

// The direct page: the action record and shape pointers, the box, the cell columns,
// rows and cells, the largest height and the object.
const DP_OBJECT = 0,
  DP_DIRECTION = 2,
  DP_ACTION_POINTER = 0,
  DP_ACTION_BANK = 2,
  DP_SHAPE_POINTER = 4,
  DP_SHAPE_BANK = 6,
  DP_LOW_X = 0x11,
  DP_HIGH_X = 0x14,
  DP_LOW_Y = 0x17,
  DP_HIGH_Y = 0x1a,
  DP_BOTTOM = 0x1d,
  DP_TOP = 0x20,
  DP_LOW_X_COLUMN = 0x23,
  DP_HIGH_X_COLUMN = 0x26,
  DP_LOW_Y_ROW = 0x29,
  DP_HIGH_Y_ROW = 0x2c,
  DP_CELL_HIGH_X_LOW_Y = 0x2f,
  DP_CELL_LOW_X_HIGH_Y = 0x32,
  DP_CELL_HIGH_X_HIGH_Y = 0x35,
  DP_CELL_LOW_X_LOW_Y = 0x38,
  DP_HEIGHT = 0x3b,
  DP_MOVED_OBJECT = 0x3e;
// The shape's edge offsets (bytes 3 to 6) and height (byte 7).
const SHAPE_FIRST_EDGE = 3,
  SHAPE_HEIGHT = 7;
// The player figure's box is passed by an object with both flag bits 0 and 1.
const PLAYER_PASSES = 3;
// A position over 4 in quarter units; a cell column from the masked x (ASL three times,
// then XBA), a cell row from the masked y (LSR once); a box offset over 4 indexes its
// object word.
const POSITION_SHIFT = 2,
  COLUMN_SHIFT = 3,
  ROW_SHIFT = 1,
  BOX_OBJECT_SHIFT = 2,
  TOP_BIT = WORD_BITS - 1;
const FOUND = WORD_MASK;
const WRAM_BANK_BASE = WRAM_BANK << WORD_BITS;

const directWord = (mem, offset) => mem.read16Bank0(offset);
const setDirectWord = (mem, offset, value) => mem.write16Bank0(offset, value & WORD_MASK);
// A word through the data bank 7E at offset (24-bit address).
const wramWord = (mem, offset) => mem.read16((WRAM_BANK_BASE + offset) & LONG_MASK);
const swapBytes = (value) => ((value >>> BYTE_BITS) | (value << BYTE_BITS)) & WORD_MASK;

// The moving boxes of a cell's list from node on (81:8686): the largest height of an
// overlapping box above the object's bottom goes to word 3B.
function searchBoxes(mem, node) {
  const dp = (offset) => directWord(mem, offset);
  do {
    const box = wramWord(mem, COLLISION_NODE_BOX + node),
      field = (offset) => wramWord(mem, offset + box);
    check: {
      if (dp(DP_HIGH_X) < field(COLLISION_BOX_X0)) break check;
      if (field(COLLISION_BOX_X1) < dp(DP_LOW_X)) break check;
      if (dp(DP_HIGH_Y) < field(COLLISION_BOX_Y0)) break check;
      if (field(COLLISION_BOX_Y1) < dp(DP_LOW_Y)) break check;
      if (dp(DP_TOP) < field(COLLISION_BOX_BOTTOM)) break check;
      const top = field(COLLISION_BOX_TOP),
        bottom = dp(DP_BOTTOM);
      if (top < bottom) break check;
      const height = top - bottom;
      if (height < dp(DP_HEIGHT)) break check;
      const owner = mem.read16((COLLISION_BOX_OBJECT + (box >>> BOX_OBJECT_SHIFT)) & LONG_MASK);
      if (owner === dp(DP_MOVED_OBJECT)) break check;
      if (
        owner === wramWord(mem, PLAYER_OBJECT) &&
        (wramWord(mem, OBJECT_FLAGS + dp(DP_MOVED_OBJECT)) & PLAYER_PASSES) === PLAYER_PASSES
      )
        break check;
      setDirectWord(mem, DP_HEIGHT, height);
    }
    node = wramWord(mem, COLLISION_NODE_NEXT + node);
  } while (!(node & WORD_SIGN));
}

// The cell search 80:8486: true when a height was found.
function searchCell(mem, cell) {
  const node = wramWord(mem, COLLISION_CELL_HEADS + cell);
  if (!(node & WORD_SIGN)) searchBoxes(mem, node);
  return directWord(mem, DP_HEIGHT) !== 0;
}

// A box edge: the object's position field over 4 plus the edge offset in word at.
function edge(mem, field, object, at) {
  const value =
    ((wramWord(mem, field + object) >>> POSITION_SHIFT) + directWord(mem, at)) & WORD_MASK;
  setDirectWord(mem, at, value);
  return value;
}

// 80:8371: the collision test of the object in word 00 with its action in the direction
// of word 02; the result in word 00.
export function testActionBoxCollision(mem) {
  const dp = (offset) => directWord(mem, offset);
  const object = dp(DP_OBJECT);
  setDirectWord(mem, DP_MOVED_OBJECT, object);
  // The kind times two indexes the action table; the direction times two (with the bit
  // shifted out as carry) is added to the kind's entry.
  const kind = (mem.read16((WRAM + OBJECT_KIND + object) & LONG_MASK) << 1) & WORD_MASK,
    direction = dp(DP_DIRECTION);
  setDirectWord(
    mem,
    DP_ACTION_POINTER,
    ((direction << 1) & WORD_MASK) +
      mem.read16((ACTION_TABLE + kind) & LONG_MASK) +
      (direction >>> TOP_BIT),
  );
  const actionBank = ACTION_TABLE >>> WORD_BITS;
  setDirectWord(mem, DP_ACTION_BANK, actionBank);
  setDirectWord(mem, DP_SHAPE_BANK, actionBank);
  const longPointer = (at) => (mem.read8(at + 2) << WORD_BITS) | dp(at);
  setDirectWord(mem, DP_SHAPE_POINTER, mem.read16(longPointer(DP_ACTION_POINTER)));
  const shapeByte = (offset) => mem.read8((longPointer(DP_SHAPE_POINTER) + offset) & LONG_MASK);
  [DP_LOW_X, DP_HIGH_X, DP_LOW_Y, DP_HIGH_Y].forEach((at, n) => {
    const value = shapeByte(SHAPE_FIRST_EDGE + n);
    setDirectWord(mem, at, value & BYTE_SIGN ? value | HIGH_BYTE_MASK : value);
  });
  setDirectWord(mem, DP_TOP, shapeByte(SHAPE_HEIGHT));
  const moved = dp(DP_MOVED_OBJECT);
  setDirectWord(mem, DP_HEIGHT, 0);
  const bottom = wramWord(mem, OBJECT_HEIGHT + moved) >>> POSITION_SHIFT;
  setDirectWord(mem, DP_BOTTOM, bottom);
  setDirectWord(mem, DP_TOP, bottom + dp(DP_TOP));
  const row = (y) => (y & CELL_COORDINATE_MASK) >>> ROW_SHIFT;
  setDirectWord(mem, DP_HIGH_Y_ROW, row(edge(mem, OBJECT_Y, moved, DP_HIGH_Y)));
  setDirectWord(mem, DP_LOW_Y_ROW, row(edge(mem, OBJECT_Y, moved, DP_LOW_Y)));
  for (const [at, column, cell] of [
    [DP_LOW_X, DP_LOW_X_COLUMN, DP_CELL_LOW_X_LOW_Y],
    [DP_HIGH_X, DP_HIGH_X_COLUMN, DP_CELL_HIGH_X_LOW_Y],
  ]) {
    const x = edge(mem, OBJECT_X, moved, at);
    setDirectWord(mem, column, swapBytes((x & CELL_COORDINATE_MASK) << COLUMN_SHIFT));
    setDirectWord(mem, cell, dp(column) | dp(DP_LOW_Y_ROW));
  }
  setDirectWord(mem, DP_CELL_HIGH_X_HIGH_Y, dp(DP_HIGH_X_COLUMN) | dp(DP_HIGH_Y_ROW));
  setDirectWord(mem, DP_CELL_LOW_X_HIGH_Y, dp(DP_LOW_X_COLUMN) | dp(DP_HIGH_Y_ROW));
  // The four corner cells, each distinct one once, until one yields a height.
  let found = searchCell(mem, dp(DP_CELL_LOW_X_HIGH_Y));
  if (!found) {
    const cell = dp(DP_CELL_LOW_X_LOW_Y);
    if (cell !== dp(DP_CELL_LOW_X_HIGH_Y)) found = searchCell(mem, cell);
  }
  if (!found) {
    const cell = dp(DP_CELL_HIGH_X_LOW_Y);
    if (cell !== dp(DP_CELL_LOW_X_HIGH_Y) && cell !== dp(DP_CELL_LOW_X_LOW_Y))
      found = searchCell(mem, cell);
  }
  if (!found) {
    const cell = dp(DP_CELL_HIGH_X_HIGH_Y);
    if (
      cell !== dp(DP_CELL_LOW_X_HIGH_Y) &&
      cell !== dp(DP_CELL_LOW_X_LOW_Y) &&
      cell !== dp(DP_CELL_HIGH_X_LOW_Y)
    )
      found = searchCell(mem, cell);
  }
  setDirectWord(mem, DP_OBJECT, found ? FOUND : 0);
}
