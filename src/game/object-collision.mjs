// The collision tests of an object's movement (lifted from 80:80B2, 80:8133, 80:81B4,
// 80:8238 and 80:82BC with their cell search 81:86E5, the static list 81:85FE and the
// moving list 81:8686; register-level reference in src/task/main-motion-collision.mjs).
//
// An object's collision box in quarter units is its position divided by 4 plus its box
// offsets (lowest and highest x and y), from its height divided by 4 (bottom) up by its
// box height (top). Each test searches the grid cells the box's leading edge falls in:
// the upper x edge the cells of the highest x, the lower x edge those of the lowest x,
// the upper and lower y edges those of the highest and lowest y, and the height test
// all four corner cells, each distinct cell once. In a cell, first the room's static
// boxes and then the moving boxes are searched. A box counts when it overlaps the
// object's box (the box's bottom at most the object's top) and its top lies at or
// above the object's bottom; the result is the largest height of such a top above the
// object's bottom. A static box with an object yields the height 0040 only for a
// searching object of class 3 whose centre lies inside the box (its bottom from the
// box's bottom up), else nothing. Among the moving boxes, the object's own box is
// ignored, and the player figure's box by a searching object of class 3.
//
// The four edge tests return the height in A with the carry set when it is 0. The
// height test stops after the first cell with a height and leaves the carry of its last
// cell search or cell comparison. Every test leaves X the object's slot, Y and the data
// bank as on entry, the sign and zero of the height (of the slot after the height test)
// and the overflow of its last addition or subtraction. The direct page words the
// original uses as locals are written as in the original (box 11 to 20, cell columns
// and rows 23 to 2C, cells 2F to 38, result 3B, slot 3E and box offset 68), and the
// frames of the cell searches and their pushes are reproduced on the stack, as the
// original leaves them below its own.
import { taskStop } from '../task/plan.mjs';
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
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_CLASS_MASK,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_OBJECT,
  STATIC_CELL_HEADS,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const POSITION_SHIFT = 2,
  // A cell column from the masked x (ASL three times, then XBA), a cell row from the
  // masked y (LSR once): column + row is the cell's byte offset.
  COLUMN_SHIFT = 5,
  ROW_SHIFT = 1,
  // The box offset over 4 indexes the box's object word (7F:E214).
  BOX_OBJECT_SHIFT = 2,
  // A searching object of class 3 ignores the player figure and finds the height 0040
  // in a static box with an object that holds its centre.
  SPECIAL_CLASS = 3,
  SPECIAL_CLASS_HEIGHT = 0x40,
  WRAM_SIZE = 0x20000,
  WRAM_BANK = 0x7e0000;
// Direct page locals of the original.
const DP_X0 = 0x11,
  DP_X1 = 0x14,
  DP_Y0 = 0x17,
  DP_Y1 = 0x1a,
  DP_BOTTOM = 0x1d,
  DP_TOP = 0x20,
  DP_COLUMN_X0 = 0x23,
  DP_COLUMN_X1 = 0x26,
  DP_ROW_Y0 = 0x29,
  DP_ROW_Y1 = 0x2c,
  DP_CELL_X1_Y0 = 0x2f,
  DP_CELL_X0_Y1 = 0x32,
  DP_CELL_X1_Y1 = 0x35,
  DP_CELL_X0_Y0 = 0x38,
  DP_RESULT = 0x3b,
  DP_SEARCHER = 0x3e,
  DP_BOX = 0x68;
// Original call sites of the cell search and its two lists.
const CELL_TARGET = 0x8186e5,
  STATIC_CALL = 0x86eb,
  STATIC_TARGET = 0x8185fe,
  MOVING_CALL = 0x86f5,
  MOVING_TARGET = 0x818686;
// The tests' calls of the cell search (first and second cell; the height test's four).
const UPPER_X_CALLS = [0x8119, 0x8123],
  LOWER_X_CALLS = [0x819a, 0x81a4],
  UPPER_Y_CALLS = [0x821e, 0x8228],
  LOWER_Y_CALLS = [0x82a2, 0x82ac],
  HEIGHT_CALLS = [0x8338, 0x8344, 0x8354, 0x8368];

const word = (wram, at) => wram[at % WRAM_SIZE] | (wram[(at + 1) % WRAM_SIZE] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at % WRAM_SIZE] = value & BYTE_MASK;
  wram[(at + 1) % WRAM_SIZE] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const signAndZero = (ctx, value) => {
  flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  flag(ctx, FLAG_ZERO, value === 0);
};
// The overflow of a 16-bit addition a + b = sum and of a subtraction a - b = difference.
const addOverflow = (a, b, sum) => (~(a ^ b) & (a ^ sum) & WORD_SIGN) !== 0;
const subtractOverflow = (a, b, difference) => ((a ^ b) & (a ^ difference) & WORD_SIGN) !== 0;
// The object word of a box (a long read in bank 7F, which must stay in WRAM).
const boxObject = (wram, box) => {
  const at = COLLISION_BOX_OBJECT - WRAM_BANK + (box >>> BOX_OBJECT_SHIFT);
  if (at + 1 >= WRAM_SIZE) taskStop('collision_box_required', { box });
  return word(wram, at);
};

// One cell search through its frame (81:86E5), on the state of a test (wram, the
// searching slot, the overflow of the last addition or subtraction): the static list,
// with the cell pushed around it, then the moving list. True when no height was found
// (the carry it leaves).
function searchCell(h, test, pc, cell) {
  const { wram } = test;
  h.call(
    pc,
    CELL_TARGET,
    () => {
      const first = word(wram, STATIC_CELL_HEADS + cell);
      if (!(first & WORD_SIGN)) {
        h.a.pushWord(cell);
        h.call(STATIC_CALL, STATIC_TARGET, () => searchList(h, test, first, true), true);
        h.a.pullWord();
      }
      const moving = word(wram, COLLISION_CELL_HEADS + cell);
      if (!(moving & WORD_SIGN))
        h.call(MOVING_CALL, MOVING_TARGET, () => searchList(h, test, moving, false), true);
      return h.rtl();
    },
    true,
  );
  return word(wram, DP_RESULT) === 0;
}

// The height a box offers the searching object (its top above the object's bottom), or
// null when the box does not overlap the object's box or offers no more than the result.
function offeredHeight(test, box) {
  const { wram } = test,
    field = (base) => word(wram, base + box),
    dp = (at) => word(wram, at);
  if (dp(DP_X1) < field(COLLISION_BOX_X0) || field(COLLISION_BOX_X1) < dp(DP_X0)) return null;
  if (dp(DP_Y1) < field(COLLISION_BOX_Y0) || field(COLLISION_BOX_Y1) < dp(DP_Y0)) return null;
  if (dp(DP_TOP) < field(COLLISION_BOX_BOTTOM)) return null;
  const top = field(COLLISION_BOX_TOP),
    bottom = dp(DP_BOTTOM),
    height = (top - bottom) & WORD_MASK;
  test.overflow = subtractOverflow(top, bottom, height);
  if (top < bottom || height < dp(DP_RESULT)) return null;
  return height;
}

// The searching object's centre inside a static box from its bottom up (81:8652).
function centreInside(test, box) {
  const { wram, slot } = test,
    field = (base) => word(wram, base + box),
    x = word(wram, OBJECT_X + slot) >>> POSITION_SHIFT,
    y = word(wram, OBJECT_Y + slot) >>> POSITION_SHIFT;
  return (
    x >= field(COLLISION_BOX_X0) &&
    x < field(COLLISION_BOX_X1) &&
    y >= field(COLLISION_BOX_Y0) &&
    y < field(COLLISION_BOX_Y1) &&
    word(wram, DP_BOTTOM) >= field(COLLISION_BOX_BOTTOM)
  );
}

// One list of a cell from node on: the static boxes (81:85FE) or the moving ones
// (81:8686). The registers it leaves are overwritten by the cell search and the tests;
// only its pushes stay on the stack.
function searchList(h, test, node, isStatic) {
  const { wram, slot } = test,
    searcherClass = () => word(wram, OBJECT_FLAGS + slot) & OBJECT_CLASS_MASK;
  for (; !(node & WORD_SIGN); node = word(wram, COLLISION_NODE_NEXT + node)) {
    const box = word(wram, COLLISION_NODE_BOX + node),
      height = offeredHeight(test, box);
    if (height === null) continue;
    if (isStatic) {
      h.a.pushWord(node);
      setWord(wram, DP_BOX, box);
      if (!boxObject(wram, box)) setWord(wram, DP_RESULT, height);
      else if (searcherClass() === SPECIAL_CLASS && centreInside(test, box))
        setWord(wram, DP_RESULT, SPECIAL_CLASS_HEIGHT);
      h.a.pullWord();
      continue;
    }
    // The height and the node are pushed around the object read.
    h.a.pushWord(height);
    h.a.pushWord(node);
    const object = boxObject(wram, box);
    h.a.pullWord();
    h.a.pullWord();
    if (object === slot) continue;
    if (object !== word(wram, PLAYER_OBJECT)) setWord(wram, DP_RESULT, height);
    else {
      // The height is pushed around the class read.
      h.a.pushWord(height);
      h.a.pullWord();
      if (searcherClass() !== SPECIAL_CLASS) setWord(wram, DP_RESULT, height);
    }
  }
  return h.rtl();
}

// The box of slot in quarter units: lowest and highest x and y, bottom and top, and the
// cell columns and rows of its edges.
function objectBox(wram, slot) {
  const x = word(wram, OBJECT_X + slot) >>> POSITION_SHIFT,
    y = word(wram, OBJECT_Y + slot) >>> POSITION_SHIFT,
    bottom = word(wram, OBJECT_HEIGHT + slot) >>> POSITION_SHIFT,
    boxHeight = word(wram, OBJECT_BOX_HEIGHT + slot),
    offset = (base) => word(wram, base + slot),
    // An addition and its overflow.
    add = (a, b) => {
      const sum = (a + b) & WORD_MASK;
      return { value: sum, overflow: addOverflow(a, b, sum) };
    },
    column = (v) => (v & CELL_COORDINATE_MASK) >>> COLUMN_SHIFT,
    row = (v) => (v & CELL_COORDINATE_MASK) >>> ROW_SHIFT;
  const box = {
    top: add(bottom, boxHeight),
    x0: add(x, offset(OBJECT_BOX_X1)),
    x1: add(x, offset(OBJECT_BOX_X2)),
    y0: add(y, offset(OBJECT_BOX_Y1)),
    y1: add(y, offset(OBJECT_BOX_Y2)),
    bottom,
  };
  box.columnX0 = column(box.x0.value);
  box.columnX1 = column(box.x1.value);
  box.rowY0 = row(box.y0.value);
  box.rowY1 = row(box.y1.value);
  return box;
}

// The common start of a test: slot, bottom and top, and the frame with the data bank 7E.
function beginTest(h) {
  const { ctx } = h,
    { wram } = h.a.mem,
    slot = ctx.x,
    box = objectBox(wram, slot);
  setWord(wram, DP_SEARCHER, slot);
  h.a.pushWord(ctx.y);
  h.phb();
  h.push(WRAM_BANK_PAIR, 2);
  h.plb();
  h.plb();
  setWord(wram, DP_RESULT, 0);
  setWord(wram, DP_BOTTOM, box.bottom);
  setWord(wram, DP_TOP, box.top.value);
  return { wram, slot, box, overflow: box.top.overflow };
}
// Write the box words in the order of a test (the last addition gives the overflow).
function writeBox(test, words) {
  for (const [at, part] of words) {
    setWord(test.wram, at, part.value ?? part);
    if (part.overflow !== undefined) test.overflow = part.overflow;
  }
}
// The end of a test: data bank and Y back, X the slot, A the result; the edge tests set
// the carry and the sign and zero of the result.
function finishTest(h, test, edge) {
  const { ctx } = h;
  h.plb();
  ctx.y = h.a.pullWord();
  ctx.x = test.slot;
  const result = word(test.wram, DP_RESULT);
  ctx.a = result;
  signAndZero(ctx, edge ? result : test.slot);
  if (edge) flag(ctx, FLAG_CARRY, result === 0);
  flag(ctx, FLAG_OVERFLOW, test.overflow);
  return h.rts();
}

// An edge test: write the box words, search the cell first and then second unless equal.
function edgeTest(h, words, [first, second], [firstCall, secondCall]) {
  const test = beginTest(h);
  writeBox(test, words(test.box));
  searchCell(h, test, firstCall, first(test.box));
  if (second(test.box) !== first(test.box)) searchCell(h, test, secondCall, second(test.box));
  return finishTest(h, test, true);
}
const cell = (row, column) => (box) => box[row] | box[column];

// Upper x edge (80:80B2): the cells of the highest x.
export const searchUpperXEdge = (h) =>
  edgeTest(
    h,
    (b) => [
      [DP_X0, b.x0],
      [DP_X1, b.x1],
      [DP_COLUMN_X1, b.columnX1],
      [DP_Y0, b.y0],
      [DP_ROW_Y0, b.rowY0],
      [DP_CELL_X1_Y0, b.rowY0 | b.columnX1],
      [DP_Y1, b.y1],
      [DP_ROW_Y1, b.rowY1],
      [DP_CELL_X1_Y1, b.rowY1 | b.columnX1],
    ],
    [cell('rowY1', 'columnX1'), cell('rowY0', 'columnX1')],
    UPPER_X_CALLS,
  );
// Lower x edge (80:8133): the cells of the lowest x.
export const searchLowerXEdge = (h) =>
  edgeTest(
    h,
    (b) => [
      [DP_X1, b.x1],
      [DP_X0, b.x0],
      [DP_COLUMN_X0, b.columnX0],
      [DP_Y0, b.y0],
      [DP_ROW_Y0, b.rowY0],
      [DP_CELL_X0_Y0, b.rowY0 | b.columnX0],
      [DP_Y1, b.y1],
      [DP_ROW_Y1, b.rowY1],
      [DP_CELL_X0_Y1, b.rowY1 | b.columnX0],
    ],
    [cell('rowY1', 'columnX0'), cell('rowY0', 'columnX0')],
    LOWER_X_CALLS,
  );
// Upper y edge (80:81B4): the cells of the highest y.
export const searchUpperYEdge = (h) =>
  edgeTest(
    h,
    (b) => [
      [DP_Y0, b.y0],
      [DP_Y1, b.y1],
      [DP_ROW_Y1, b.rowY1],
      [DP_X0, b.x0],
      [DP_COLUMN_X0, b.columnX0],
      [DP_CELL_X0_Y1, b.rowY1 | b.columnX0],
      [DP_X1, b.x1],
      [DP_COLUMN_X1, b.columnX1],
      [DP_CELL_X1_Y1, b.rowY1 | b.columnX1],
    ],
    [cell('rowY1', 'columnX1'), cell('rowY1', 'columnX0')],
    UPPER_Y_CALLS,
  );
// Lower y edge (80:8238): the cells of the lowest y.
export const searchLowerYEdge = (h) =>
  edgeTest(
    h,
    (b) => [
      [DP_Y1, b.y1],
      [DP_Y0, b.y0],
      [DP_ROW_Y0, b.rowY0],
      [DP_X0, b.x0],
      [DP_COLUMN_X0, b.columnX0],
      [DP_CELL_X0_Y0, b.rowY0 | b.columnX0],
      [DP_X1, b.x1],
      [DP_COLUMN_X1, b.columnX1],
      [DP_CELL_X1_Y0, b.rowY0 | b.columnX1],
    ],
    [cell('rowY0', 'columnX1'), cell('rowY0', 'columnX0')],
    LOWER_Y_CALLS,
  );

// Height test (80:82BC): the four corner cells, each distinct one once, until a cell
// offers a height. The carry is that of the last search (a cell equal to an earlier one
// is skipped with the carry its CPY sets, which the search before it set already).
export function searchHeightCells(h) {
  const test = beginTest(h),
    b = test.box,
    c00 = b.rowY0 | b.columnX0,
    c10 = b.rowY0 | b.columnX1,
    c11 = b.rowY1 | b.columnX1,
    c01 = b.rowY1 | b.columnX0;
  writeBox(test, [
    [DP_Y1, b.y1],
    [DP_ROW_Y1, b.rowY1],
    [DP_Y0, b.y0],
    [DP_ROW_Y0, b.rowY0],
    [DP_X0, b.x0],
    [DP_COLUMN_X0, b.columnX0],
    [DP_CELL_X0_Y0, c00],
    [DP_X1, b.x1],
    [DP_COLUMN_X1, b.columnX1],
    [DP_CELL_X1_Y0, c10],
    [DP_CELL_X1_Y1, c11],
    [DP_CELL_X0_Y1, c01],
  ]);
  const cells = [c01, c00, c10, c11];
  let free = true;
  for (let n = 0; n < cells.length && free; n++)
    if (!cells.slice(0, n).includes(cells[n]))
      free = searchCell(h, test, HEIGHT_CALLS[n], cells[n]);
  flag(h.ctx, FLAG_CARRY, free);
  return finishTest(h, test, false);
}
