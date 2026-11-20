// The collision tests of an object's movement (from 80:80B2, 80:8133, 80:81B4, 80:8238
// and 80:82BC with their cell search 81:86E5, the static list 81:85FE and the moving
// list 81:8686; register-level reference in proof/replay/main-motion-collision.mjs).
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
// Each test takes the object's slot and returns { height, free } (free when the height
// is 0); the height test stops after the first cell with a height. The box and the
// running result are locals; the original's direct page words for them are not kept.
import { taskStop } from '../system/task-stop.mjs';
import { objectIndex, objectTable } from '../state/objects.mjs';
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
  OBJECT_CLASS_MASK,
  PLAYER_OBJECT,
  STATIC_CELL_HEADS,
} from '../data/wram.mjs';
import { BYTE_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

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

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
// The object word of a box (a long read in bank 7F, which must stay in WRAM).
const boxObject = (wram, box) => {
  const at = COLLISION_BOX_OBJECT - WRAM_BANK + (box >>> BOX_OBJECT_SHIFT);
  if (at + 1 >= WRAM_SIZE) taskStop('collision_box_required', { box });
  return word(wram, at);
};

// The height a box offers the searching object (its top above the object's bottom), or
// null when the box does not overlap the object's box or offers no more than the result.
function offeredHeight(test, box) {
  const { wram, box: own } = test,
    field = (base) => word(wram, base + box);
  if (own.x1 < field(COLLISION_BOX_X0) || field(COLLISION_BOX_X1) < own.x0) return null;
  if (own.y1 < field(COLLISION_BOX_Y0) || field(COLLISION_BOX_Y1) < own.y0) return null;
  if (own.top < field(COLLISION_BOX_BOTTOM)) return null;
  const top = field(COLLISION_BOX_TOP),
    height = (top - own.bottom) & WORD_MASK;
  if (top < own.bottom || height < test.result) return null;
  return height;
}

// The searching object's centre inside a static box from its bottom up (81:8652).
function centreInside(test, box) {
  const { wram, objects, i } = test,
    field = (base) => word(wram, base + box),
    x = objects.x[i] >>> POSITION_SHIFT,
    y = objects.y[i] >>> POSITION_SHIFT;
  return (
    x >= field(COLLISION_BOX_X0) &&
    x < field(COLLISION_BOX_X1) &&
    y >= field(COLLISION_BOX_Y0) &&
    y < field(COLLISION_BOX_Y1) &&
    test.box.bottom >= field(COLLISION_BOX_BOTTOM)
  );
}

// One list of a cell from node on: the static boxes (81:85FE) or the moving ones
// (81:8686).
function searchList(test, node, isStatic) {
  const { wram, slot, objects, i } = test,
    special = () => (objects.flags[i] & OBJECT_CLASS_MASK) === SPECIAL_CLASS;
  for (; !(node & WORD_SIGN); node = word(wram, COLLISION_NODE_NEXT + node)) {
    const box = word(wram, COLLISION_NODE_BOX + node),
      height = offeredHeight(test, box);
    if (height === null) continue;
    if (isStatic) {
      if (!boxObject(wram, box)) test.result = height;
      else if (special() && centreInside(test, box)) test.result = SPECIAL_CLASS_HEIGHT;
      continue;
    }
    const object = boxObject(wram, box);
    if (object === slot) continue;
    if (object !== word(wram, PLAYER_OBJECT) || !special()) test.result = height;
  }
}

// One cell search (81:86E5): the static list, then the moving list. True when no
// height was found so far.
function searchCell(test, cell) {
  const { wram } = test;
  const first = word(wram, STATIC_CELL_HEADS + cell);
  if (!(first & WORD_SIGN)) searchList(test, first, true);
  const moving = word(wram, COLLISION_CELL_HEADS + cell);
  if (!(moving & WORD_SIGN)) searchList(test, moving, false);
  return test.result === 0;
}

// The box of an object in quarter units: lowest and highest x and y, bottom and top,
// and the grid cells of its four corners.
function objectBox(objects, i) {
  const x = objects.x[i] >>> POSITION_SHIFT,
    y = objects.y[i] >>> POSITION_SHIFT,
    bottom = objects.height[i] >>> POSITION_SHIFT,
    add = (a, b) => (a + b) & WORD_MASK,
    column = (v) => (v & CELL_COORDINATE_MASK) >>> COLUMN_SHIFT,
    row = (v) => (v & CELL_COORDINATE_MASK) >>> ROW_SHIFT;
  const box = {
    x0: add(x, objects.boxX1[i]),
    x1: add(x, objects.boxX2[i]),
    y0: add(y, objects.boxY1[i]),
    y1: add(y, objects.boxY2[i]),
    bottom,
    top: add(bottom, objects.boxHeight[i]),
  };
  const columnX0 = column(box.x0),
    columnX1 = column(box.x1),
    rowY0 = row(box.y0),
    rowY1 = row(box.y1);
  box.cellX0Y0 = rowY0 | columnX0;
  box.cellX1Y0 = rowY0 | columnX1;
  box.cellX0Y1 = rowY1 | columnX0;
  box.cellX1Y1 = rowY1 | columnX1;
  return box;
}

function beginTest(wram, slot) {
  const objects = objectTable(wram),
    i = objectIndex(slot);
  return { wram, slot, objects, i, box: objectBox(objects, i), result: 0 };
}
const finish = (test) => ({ height: test.result, free: test.result === 0 });

// An edge test: search the first cell, then the second unless it is the same.
function edgeTest(wram, slot, first, second) {
  const test = beginTest(wram, slot);
  searchCell(test, test.box[first]);
  if (test.box[second] !== test.box[first]) searchCell(test, test.box[second]);
  return finish(test);
}

// Upper x edge (80:80B2): the cells of the highest x.
export const upperXEdge = (wram, slot) => edgeTest(wram, slot, 'cellX1Y1', 'cellX1Y0');
// Lower x edge (80:8133): the cells of the lowest x.
export const lowerXEdge = (wram, slot) => edgeTest(wram, slot, 'cellX0Y1', 'cellX0Y0');
// Upper y edge (80:81B4): the cells of the highest y.
export const upperYEdge = (wram, slot) => edgeTest(wram, slot, 'cellX1Y1', 'cellX0Y1');
// Lower y edge (80:8238): the cells of the lowest y.
export const lowerYEdge = (wram, slot) => edgeTest(wram, slot, 'cellX1Y0', 'cellX0Y0');

// Height test (80:82BC): the four corner cells, each distinct one once, until a cell
// offers a height.
export function heightCells(wram, slot) {
  const test = beginTest(wram, slot),
    b = test.box,
    cells = [b.cellX0Y1, b.cellX0Y0, b.cellX1Y0, b.cellX1Y1];
  for (let n = 0; n < cells.length; n++)
    if (!cells.slice(0, n).includes(cells[n]) && !searchCell(test, cells[n])) break;
  return finish(test);
}
