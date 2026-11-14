// The static collision grid of a room (lifted from 81:8756 with 81:83FB, 81:840E,
// 81:84CF, 81:84DE and 81:8701; register-level version in
// src/task/main-scene-collision.mjs).
//
// The grid has 16 x 16 cells; each cell heads a linked list of nodes, each node names a
// box. The boxes come from the two object lists of the scene (direct page pointer 77,
// as the scene load leaves it: each object's definition in bank 8A gives its boxes,
// flipped objects swap x and y) and from the three room lists behind the actors
// (direct page pointer 9A: the collision boxes, then the script boxes and the exit
// boxes, each with a data word). A box is linked into every cell its x and y range
// covers. The grid leaves the end of the boxes and of the nodes in WRAM, the script
// list pointer in direct page word 9D and the object list pointer moved past both
// lists.
//
// The direct page words the original uses as locals are written as in the original,
// as the Mesen oracle compares them: the next node A0, the definition pointer 0E-10,
// the objects and boxes left 11 and 14, the flip word 17, the object position 1A, 1D
// and 20, the part count 6B, the list boxes left 5C, the data word flag 5F and the
// cell bounds 3E, 41, 44 and 47.
import {
  CELL_COORDINATE_MASK,
  COLLISION_BOX_BOTTOM,
  COLLISION_BOX_BYTES,
  COLLISION_BOX_OBJECT,
  COLLISION_BOX_TOP,
  COLLISION_BOX_X0,
  COLLISION_BOX_X1,
  COLLISION_BOX_Y0,
  COLLISION_BOX_Y1,
  COLLISION_CELLS,
  COLLISION_NODE_BOX,
  COLLISION_NODE_NEXT,
  STATIC_BOX_END,
  STATIC_CELL_HEADS,
  STATIC_NODE_END,
} from '../task/wram.mjs';
import { OBJECT_TABLE } from '../data/object-types.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  HIGH_BYTE_MASK,
  WORD_BITS,
  WORD_MASK,
} from '../constants/bits.mjs';

const LONG_MASK = 0xffffff,
  NO_NODE = WORD_MASK;
const DP_NODE = 0xa0,
  DP_COLUMN_X0 = 0x3e,
  DP_COLUMN_X1 = 0x41,
  DP_ROW_Y0 = 0x44,
  DP_ROW_Y1 = 0x47,
  DP_DEFINITION = 0x0e,
  DP_DEFINITION_BANK = 0x10,
  DP_OBJECT_LISTS = 0x77,
  DP_ROOM_LISTS = 0x9a,
  DP_SCRIPT_LIST = 0x9d,
  DP_OBJECTS_LEFT = 0x11,
  DP_BOXES_LEFT = 0x14,
  DP_FLIPPED = 0x17,
  DP_X = 0x1a,
  DP_Y = 0x1d,
  DP_Z = 0x20,
  DP_PART_COUNT = 0x6b,
  DP_LIST_BOXES_LEFT = 0x5c,
  DP_DATA_WORD = 0x5f;
// The last cell word, the cell column bits of a cell word index and one row step.
const LAST_CELL_WORD = 2 * COLLISION_CELLS - 2,
  CELL_COLUMN_MASK = 0x1e,
  CELL_ROW_STEP = 0x20,
  COLUMN_SHIFT = 3,
  OBJECT_INDEX_SHIFT = 2;
// Object definitions in bank 8A (src/data/object-types.mjs): the box count byte and the
// header size before the 5-byte parts.
const DEFINITION_BANK = 0x8a,
  DEFINITION_BOX_COUNT = 7,
  DEFINITION_HEADER_BYTES = 8,
  PART_BYTES = 5;
// A scene object: its word (bits 13 and 14: no boxes; bit 15: flipped; the rest the
// definition) and three bytes z (bit 7: no boxes), x and y.
const OBJECT_POSITION_HIGH = 0x6000,
  OBJECT_FLIPPED = 0x8000,
  OBJECT_BYTES = 3,
  Z_SHIFT = 3,
  XY_SHIFT = 2,
  FLIPPED = WORD_MASK;
// The room lists: six words per box (x0, y0, bottom, x1, y1, top) and, with the data
// word flag, a data word; the box object word is the flag.
const LIST_BOX_FIELDS = [
    COLLISION_BOX_X0,
    COLLISION_BOX_Y0,
    COLLISION_BOX_BOTTOM,
    COLLISION_BOX_X1,
    COLLISION_BOX_Y1,
    COLLISION_BOX_TOP,
  ],
  WITH_DATA_WORD = WORD_MASK,
  LIST_COUNT = 3;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
const longPointer = (wram, at) => (wram[at + 2] << WORD_BITS) | word(wram, at);
// A WRAM word of bank 7E at an absolute address plus an index (it runs on into 7F).
const boxWord = (wram, at, index) => word(wram, at + index);
const setBoxWord = (wram, at, index, value) => setWord(wram, at + index, value);

// Link the box at byte offset box into every cell of its x and y range (81:840E).
function addBoxToGrid(wram, box) {
  const column = (at) => {
    const v = ((boxWord(wram, at, box) & CELL_COORDINATE_MASK) << COLUMN_SHIFT) & WORD_MASK;
    return (v >>> BYTE_BITS) | ((v & BYTE_MASK) << BYTE_BITS);
  };
  const x0 = column(COLLISION_BOX_X0),
    x1 = column(COLLISION_BOX_X1),
    y1 = (boxWord(wram, COLLISION_BOX_Y1, box) & CELL_COORDINATE_MASK) >>> 1;
  setWord(wram, DP_COLUMN_X0, x0);
  setWord(wram, DP_COLUMN_X1, x1);
  setWord(wram, DP_ROW_Y1, y1);
  let row = (boxWord(wram, COLLISION_BOX_Y0, box) & CELL_COORDINATE_MASK) >>> 1;
  for (;;) {
    setWord(wram, DP_ROW_Y0, row);
    let cell = row | x0;
    for (;;) {
      const node = word(wram, DP_NODE);
      setBoxWord(wram, COLLISION_NODE_BOX, node, box);
      setBoxWord(wram, COLLISION_NODE_NEXT, node, boxWord(wram, STATIC_CELL_HEADS, cell));
      setBoxWord(wram, STATIC_CELL_HEADS, cell, node);
      setWord(wram, DP_NODE, node + 2);
      cell = (cell + 2) & WORD_MASK;
      // On to the next column up to the last one, but not past the row's end.
      const nextColumn = cell & CELL_COLUMN_MASK;
      if (!nextColumn || nextColumn > x1) break;
    }
    row = (word(wram, DP_ROW_Y0) + CELL_ROW_STEP) & WORD_MASK;
    if (row > y1) return;
  }
}
// The box object word at the box's byte offset / 4 (7F:E214).
function setBoxObject(mem, box, value) {
  const at = COLLISION_BOX_OBJECT + (box >>> OBJECT_INDEX_SHIFT);
  mem.write8(at & LONG_MASK, value & BYTE_MASK);
  mem.write8((at + 1) & LONG_MASK, (value >>> BYTE_BITS) & BYTE_MASK);
}
// The boxes of one object list (81:84DE), from box offset box; returns the next one.
function addObjectBoxes(mem, wram, box) {
  const list = longPointer(wram, DP_OBJECT_LISTS),
    byte = (offset) => mem.read8((list + offset) & LONG_MASK),
    count = byte(0);
  let offset = 1;
  if (count) setWord(wram, DP_OBJECTS_LEFT, count);
  for (let left = count; left > 0; left--) {
    const object = readWord(mem, list + offset);
    offset += 2;
    if (!(object & OBJECT_POSITION_HIGH)) {
      setWord(wram, DP_DEFINITION, readWord(mem, OBJECT_TABLE + ((object << 1) & WORD_MASK)));
      setWord(wram, DP_FLIPPED, object & OBJECT_FLIPPED ? FLIPPED : 0);
      const z = byte(offset);
      if (!(z & BYTE_SIGN)) {
        setWord(wram, DP_Z, z << Z_SHIFT);
        setWord(wram, DP_X, byte(offset + 1) << XY_SHIFT);
        setWord(wram, DP_Y, byte(offset + 2) << XY_SHIFT);
        box = addDefinitionBoxes(mem, wram, box);
      }
    }
    offset += OBJECT_BYTES;
    setWord(wram, DP_OBJECTS_LEFT, left - 1);
  }
  setWord(wram, DP_OBJECT_LISTS, offset + word(wram, DP_OBJECT_LISTS));
  return box;
}
// The boxes of the object definition at direct page 0E, placed at the object's position
// (direct page 1A, 1D, 20; x and y swapped when flipped).
function addDefinitionBoxes(mem, wram, box) {
  const definition = longPointer(wram, DP_DEFINITION),
    byte = (offset) => mem.read8((definition + offset) & LONG_MASK),
    boxes = byte(DEFINITION_BOX_COUNT);
  if (!boxes) return box;
  setWord(wram, DP_BOXES_LEFT, boxes);
  const parts = byte(0);
  setWord(wram, DP_PART_COUNT, parts);
  let offset = PART_BYTES * parts + DEFINITION_HEADER_BYTES;
  for (let left = boxes; left > 0; left--) {
    const axes = word(wram, DP_FLIPPED)
      ? [
          [DP_Y, COLLISION_BOX_Y0, COLLISION_BOX_Y1],
          [DP_X, COLLISION_BOX_X0, COLLISION_BOX_X1],
          [DP_Z, COLLISION_BOX_BOTTOM, COLLISION_BOX_TOP],
        ]
      : [
          [DP_X, COLLISION_BOX_X0, COLLISION_BOX_X1],
          [DP_Y, COLLISION_BOX_Y0, COLLISION_BOX_Y1],
          [DP_Z, COLLISION_BOX_BOTTOM, COLLISION_BOX_TOP],
        ];
    for (const [dp, low, high] of axes) {
      // A signed start (81:84CF) and an unsigned size.
      const start = byte(offset),
        signed = start & BYTE_SIGN ? start | HIGH_BYTE_MASK : start;
      setBoxWord(wram, low, box, signed + word(wram, dp));
      setBoxWord(wram, high, box, byte(offset + 1) + boxWord(wram, low, box));
      offset += 2;
    }
    setBoxObject(mem, box, 0);
    addBoxToGrid(wram, box);
    box = (box + COLLISION_BOX_BYTES) & WORD_MASK;
    setWord(wram, DP_BOXES_LEFT, left - 1);
  }
  return box;
}
// The boxes of one room list at offset of direct page pointer 9A (81:8701); with the
// data word flag each box carries a data word. Returns the next box and list offset.
function addListBoxes(mem, wram, box, offset, dataWord) {
  setWord(wram, DP_DATA_WORD, dataWord);
  const list = longPointer(wram, DP_ROOM_LISTS),
    count = mem.read8((list + offset) & LONG_MASK);
  offset = (offset + 1) & WORD_MASK;
  if (count) setWord(wram, DP_LIST_BOXES_LEFT, count);
  for (let left = count; left > 0; left--) {
    for (const at of LIST_BOX_FIELDS) {
      setBoxWord(wram, at, box, readWord(mem, list + offset));
      offset = (offset + 2) & WORD_MASK;
    }
    if (dataWord) offset = (offset + 2) & WORD_MASK;
    setBoxObject(mem, box, dataWord);
    addBoxToGrid(wram, box);
    box = (box + COLLISION_BOX_BYTES) & WORD_MASK;
    setWord(wram, DP_LIST_BOXES_LEFT, left - 1);
  }
  return [box, offset];
}

// Build the static collision grid of the room (81:8756).
export function buildCollisionGrid(mem, wram) {
  setWord(wram, DP_NODE, 0);
  setWord(wram, STATIC_BOX_END, 0);
  for (let cell = LAST_CELL_WORD; cell >= 0; cell -= 2)
    setWord(wram, STATIC_CELL_HEADS + cell, NO_NODE);
  let box = word(wram, STATIC_BOX_END);
  wram[DP_DEFINITION_BANK] = DEFINITION_BANK;
  box = addObjectBoxes(mem, wram, box);
  box = addObjectBoxes(mem, wram, box);
  let offset = 0;
  for (let n = 0; n < LIST_COUNT; n++) {
    [box, offset] = addListBoxes(mem, wram, box, offset, n ? WITH_DATA_WORD : 0);
    if (!n) setWord(wram, DP_SCRIPT_LIST, offset + word(wram, DP_ROOM_LISTS));
  }
  setWord(wram, STATIC_BOX_END, box);
  setWord(wram, STATIC_NODE_END, word(wram, DP_NODE));
}
