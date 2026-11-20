// The objects' motion pass of the main loop (lifted from 80:AFC4 with the collision
// list 81:8799, its grid clear 81:80F7 and cell link 81:846E; register-level
// reference in proof/replay/main-loop-motion.mjs).
//
// Each pass first rebuilds the moving part of the collision grid: every cell head of
// the 16 x 16 grid starts empty, and each object on the draw list that takes part in
// the grid (flag 0100) and has a box height gets a collision box from its position
// (x, y and height divided by 4) and its box offsets: lowest and highest x and y, its
// bottom and top. The box is linked into each grid cell its corners fall in (up to
// four; a cell row is 40 units of y, a cell column 40 units of x), after the static
// nodes of the room (src/game/collision-grid.mjs), and the box's object is noted. Then
// every object that is not halted (flag 0400) moves (80:AB26, src/game/object-move.mjs),
// and in a second pass over the draw list every such object steps its animation
// (80:AC2F, frames in bank 8C, src/game/object-animation.mjs).
//
// The direct page words the original uses as locals are written as in the original:
// the position 1A and 1D, the box offset 20, the cell columns and rows 3E, 41, 44 and
// 47, the box being linked 4D, the four corner cells 50, 53, 56 and 59, the next node
// A0 and the frame bank 40. Registers (user decision 2026-11-17): game state only; the
// movement and the animation step take the slot as a parameter, and the pass leaves no
// A, X, Y or flags (the formation step 80:BAD5 that follows reads none). The collision
// list, its grid clear, cell link and the movement run as plain functions: their frames,
// the saved data bank and the draw list index pushed around each movement lie only in
// free stack bytes, which are not reproduced. The animation step runs without its JSR
// frame too; only a recorded run's register-level step returns through it.
import { taskStop } from '../system/task-stop.mjs';
import { moveObject } from './object-move.mjs';
import { stepAnimation, stepAnimationInPlace } from './object-animation.mjs';
import { recordedRoutine } from '../system/recorded-routines.mjs';
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
  COLLISION_CELL_HEADS,
  COLLISION_CELLS,
  COLLISION_NODE_BOX,
  COLLISION_NODE_NEXT,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  MOVING_BOX_FIRST,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_FLAGS,
  OBJECT_HALTED,
  OBJECT_HEIGHT,
  OBJECT_IN_GRID,
  OBJECT_X,
  OBJECT_Y,
  STATIC_NODE_END,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const POSITION_SHIFT = 2,
  // A cell column from the masked x (ASL three times, then the high byte), a cell row
  // from the masked y (LSR once): column + row is the cell's byte offset.
  COLUMN_SHIFT = 5,
  ROW_SHIFT = 1,
  // The box offset over 4 indexes the box's object word (7F:E214).
  BOX_OBJECT_SHIFT = 2,
  NODE_BYTES = 2,
  NO_NODE = WORD_MASK,
  FRAME_BANK = 0x8c,
  LOW_WRAM_END = 0x2000,
  WRAM_SIZE = 0x20000,
  WRAM_BANK = 0x7e0000;
// Direct page locals of the original.
const DP_X = 0x1a,
  DP_Y = 0x1d,
  DP_BOX = 0x20,
  DP_COLUMN_X0 = 0x3e,
  DP_FRAME_BANK = 0x40,
  DP_COLUMN_X1 = 0x41,
  DP_ROW_Y0 = 0x44,
  DP_ROW_Y1 = 0x47,
  DP_LINK_BOX = 0x4d,
  DP_CELL_X0_Y0 = 0x50,
  DP_CELL_X1_Y1 = 0x53,
  DP_CELL_X1_Y0 = 0x56,
  DP_CELL_X0_Y1 = 0x59,
  DP_NODE = 0xa0;
// Original call site of the animation step.
const ANIMATION_CALL = 0xaff4,
  ANIMATION_TARGET = 0x80ac2f;

const word = (wram, at) => wram[at % WRAM_SIZE] | (wram[(at + 1) % WRAM_SIZE] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at % WRAM_SIZE] = value & BYTE_MASK;
  wram[(at + 1) % WRAM_SIZE] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// A word of a table in bank 80 below 2000 (the motion pass's data bank reaches WRAM
// only there).
const lowField = (wram, base, index) => {
  if (base + index + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { base, index });
  return word(wram, base + index);
};

// Link box (its offset) into the cells: the lowest corner's, and unless the box lies
// in one cell the highest corner's, and unless that equals either mixed corner, both
// mixed corners (81:846E; the original does not compare the last with the first).
function linkBox(wram, box, cells) {
  const [c00, c11, c10, c01] = cells;
  setWord(wram, DP_LINK_BOX, box);
  let node = word(wram, DP_NODE);
  const link = (cell) => {
    setWord(wram, COLLISION_NODE_BOX + node, box);
    setWord(wram, COLLISION_NODE_NEXT + node, word(wram, COLLISION_CELL_HEADS + cell));
    setWord(wram, COLLISION_CELL_HEADS + cell, node);
    node = (node + NODE_BYTES) & WORD_MASK;
  };
  link(c00);
  if (c00 !== c11) {
    link(c11);
    if (c11 !== c10 && c11 !== c01) {
      link(c10);
      link(c01);
    }
  }
  setWord(wram, DP_NODE, node);
}

// The collision boxes of the draw list's objects (81:8799), with the grid clear 81:80F7.
function buildCollisionList(wram) {
  for (let cell = 0; cell < COLLISION_CELLS; cell++)
    setWord(wram, COLLISION_CELL_HEADS + cell * NODE_BYTES, NO_NODE);
  const nodes = word(wram, STATIC_NODE_END);
  setWord(wram, DP_NODE, nodes);
  const last = word(wram, DRAW_LIST_INDEX);
  if (last & WORD_SIGN) return;
  setWord(wram, DP_BOX, MOVING_BOX_FIRST);
  for (let index = last; !(index & WORD_SIGN); index = (index - 2) & WORD_MASK) {
    const slot = word(wram, DRAW_LIST + index),
      field = (base) => word(wram, base + slot);
    if (!(field(OBJECT_FLAGS) & OBJECT_IN_GRID) || !field(OBJECT_BOX_HEIGHT)) continue;
    const box = word(wram, DP_BOX),
      x = field(OBJECT_X) >>> POSITION_SHIFT,
      yPos = field(OBJECT_Y) >>> POSITION_SHIFT;
    setWord(wram, DP_X, x);
    const x0 = (x + field(OBJECT_BOX_X1)) & WORD_MASK;
    setWord(wram, COLLISION_BOX_X0 + box, x0);
    const columnX0 = (x0 & CELL_COORDINATE_MASK) >>> COLUMN_SHIFT;
    setWord(wram, DP_COLUMN_X0, columnX0);
    setWord(wram, DP_Y, yPos);
    const y0 = (yPos + field(OBJECT_BOX_Y1)) & WORD_MASK;
    setWord(wram, COLLISION_BOX_Y0 + box, y0);
    const rowY0 = (y0 & CELL_COORDINATE_MASK) >>> ROW_SHIFT;
    setWord(wram, DP_ROW_Y0, rowY0);
    const c00 = rowY0 | columnX0;
    setWord(wram, DP_CELL_X0_Y0, c00);
    const bottom = field(OBJECT_HEIGHT) >>> POSITION_SHIFT;
    setWord(wram, COLLISION_BOX_BOTTOM + box, bottom);
    setWord(wram, COLLISION_BOX_TOP + box, bottom + field(OBJECT_BOX_HEIGHT));
    const x1 = (field(OBJECT_BOX_X2) + x) & WORD_MASK;
    setWord(wram, COLLISION_BOX_X1 + box, x1);
    const columnX1 = (x1 & CELL_COORDINATE_MASK) >>> COLUMN_SHIFT;
    setWord(wram, DP_COLUMN_X1, columnX1);
    const y1 = (field(OBJECT_BOX_Y2) + yPos) & WORD_MASK;
    setWord(wram, COLLISION_BOX_Y1 + box, y1);
    const rowY1 = (y1 & CELL_COORDINATE_MASK) >>> ROW_SHIFT;
    setWord(wram, DP_ROW_Y1, rowY1);
    const c11 = rowY1 | columnX1,
      c10 = columnX1 | rowY0,
      c01 = columnX0 | rowY1;
    setWord(wram, DP_CELL_X1_Y1, c11);
    setWord(wram, DP_CELL_X1_Y0, c10);
    setWord(wram, DP_CELL_X0_Y1, c01);
    linkBox(wram, box, [c00, c11, c10, c01]);
    const next = (box + COLLISION_BOX_BYTES) & WORD_MASK;
    setWord(wram, DP_BOX, next);
    setWord(
      wram,
      (COLLISION_BOX_OBJECT - WRAM_BANK + (box >>> BOX_OBJECT_SHIFT)) % WRAM_SIZE,
      slot,
    );
  }
}

// Move and animate the objects (80:AFC4) on the main loop's access h (data bank 80);
// movement, target walking and animation compose their actual bodies directly.
export function moveAndAnimate(h, events) {
  const { wram } = h.a.mem;
  buildCollisionList(wram);
  const last = word(wram, DRAW_LIST_INDEX);
  if (last & WORD_SIGN) return h.rts();
  // Each listed object that is not halted: its movement, then in a second pass its animation.
  const pass = (run) => {
    for (let index = last; !(index & WORD_SIGN); index = (index - 2) & WORD_MASK) {
      const slot = lowField(wram, DRAW_LIST, index);
      if (!(lowField(wram, OBJECT_FLAGS, slot) & OBJECT_HALTED)) run(slot);
    }
  };
  pass((slot) => moveObject(h.a.mem.wram, h.a, slot));
  setWord(wram, DP_FRAME_BANK, FRAME_BANK);
  // A recorded run's register-level step returns through the JSR frame; the lifted step
  // runs without it.
  if (recordedRoutine(events, 'object-animation'))
    pass((slot) => h.call(ANIMATION_CALL, ANIMATION_TARGET, () => stepAnimation(h, events, slot)));
  else pass((slot) => stepAnimationInPlace(h, slot));
  return h.rts();
}
