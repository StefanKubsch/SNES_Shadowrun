// The objects' motion pass of the main loop (lifted from 80:AFC4 with the collision
// list 81:8799, its grid clear 81:80F7 and cell link 81:846E; register-level
// reference in src/task/main-loop-motion.mjs).
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
// (80:AC2F, frames in bank 8C, src/game/object-animation.mjs) through its frame.
//
// The direct page words the original uses as locals are written as in the original:
// the position 1A and 1D, the box offset 20, the cell columns and rows 3E, 41, 44 and
// 47, the box being linked 4D, the four corner cells 50, 53, 56 and 59, the next node
// A0 and the frame bank 40. A, X, Y and the flags are left as the original leaves them;
// the formation step 80:BAD5 that follows reads X and Y. The grid clear's and the
// collision list's frames are reproduced on the stack, as the original leaves them
// below its own.
import { taskStop } from '../task/plan.mjs';
import { moveObject } from './object-move.mjs';
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
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

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
// Original call sites: the collision list, its grid clear and cell link (their frames
// are reproduced on the stack), and the register-level callees.
const LIST_CALL = 0xafc4,
  LIST_TARGET = 0x818799,
  CLEAR_CALL = 0x879f,
  CLEAR_TARGET = 0x8180f7,
  LINK_CALL = 0x8840,
  LINK_TARGET = 0x81846e,
  MOVE_CALL = 0xafd9,
  MOVE_TARGET = 0x80ab26,
  ANIMATION_CALL = 0xaff4,
  ANIMATION_TARGET = 0x80ac2f;

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

// The collision boxes of the draw list's objects (81:8799), with the original's data
// bank 7E. Returns the A, X and Y it leaves; the flags are set on ctx.
function buildCollisionList(h, wram) {
  const { ctx } = h;
  // The data bank 7E, set through the stack as the original does.
  h.phb();
  h.push(WRAM_BANK_PAIR, 2);
  h.plb();
  h.plb();
  h.call(
    CLEAR_CALL,
    CLEAR_TARGET,
    () => {
      for (let cell = 0; cell < COLLISION_CELLS; cell++)
        setWord(wram, COLLISION_CELL_HEADS + cell * NODE_BYTES, NO_NODE);
      return h.rtl();
    },
    true,
  );
  const nodes = word(wram, STATIC_NODE_END);
  setWord(wram, DP_NODE, nodes);
  const last = word(wram, DRAW_LIST_INDEX);
  // The bank byte 80 pulled at the end: sign set.
  const end = (registers) => {
    h.plb();
    return registers;
  };
  if (last & WORD_SIGN) return end({ a: nodes, x: last, y: ctx.y });
  setWord(wram, DP_BOX, MOVING_BOX_FIRST);
  let a = MOVING_BOX_FIRST,
    y = ctx.y;
  for (let index = last; !(index & WORD_SIGN); index = (index - 2) & WORD_MASK) {
    const slot = word(wram, DRAW_LIST + index),
      field = (base) => word(wram, base + slot);
    y = slot;
    a = field(OBJECT_FLAGS) & OBJECT_IN_GRID;
    if (!a) continue;
    a = field(OBJECT_BOX_HEIGHT);
    if (!a) continue;
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
    h.a.pushWord(index);
    h.call(
      LINK_CALL,
      LINK_TARGET,
      () => {
        linkBox(wram, box, [c00, c11, c10, c01]);
        return h.rtl();
      },
      true,
    );
    h.a.pullWord();
    const next = (box + COLLISION_BOX_BYTES) & WORD_MASK;
    setWord(wram, DP_BOX, next);
    // ADC #0C (the overflow stays), then LSR twice (the carry is bit 1 of the box).
    flag(ctx, FLAG_OVERFLOW, (~(box ^ COLLISION_BOX_BYTES) & (box ^ next) & WORD_SIGN) !== 0);
    flag(ctx, FLAG_CARRY, (box >>> 1) & 1);
    a = slot;
    setWord(wram, (COLLISION_BOX_OBJECT - WRAM_BANK + (box >>> BOX_OBJECT_SHIFT)) % WRAM_SIZE, a);
    y = index;
  }
  return end({ a, x: WORD_MASK - 1, y });
}

// Move and animate the objects (80:AFC4) on the main loop's access h (data bank 80);
// routines holds the callees run through their frames (the animation 80:AC2F and the
// movement's walk towards its target 80:C9E0; MOTION_ROUTINES in main-upkeep.mjs binds
// the lifted ones).
export function moveAndAnimate(h, events, routines) {
  const { ctx } = h,
    { wram } = h.a.mem;
  let listed;
  h.call(
    LIST_CALL,
    LIST_TARGET,
    () => {
      listed = buildCollisionList(h, wram);
      return h.rtl();
    },
    true,
  );
  ctx.a = listed.a;
  ctx.x = listed.x;
  ctx.y = listed.y;
  const last = word(wram, DRAW_LIST_INDEX);
  ctx.y = last;
  signAndZero(ctx, last);
  if (last & WORD_SIGN) return h.rts();
  // Each listed object that is not halted: its movement, then in a second pass its animation.
  const pass = (run) => {
    // The index counts on from the Y a callee leaves, as the original's DEY does.
    let index = last;
    while (!(index & WORD_SIGN)) {
      ctx.y = index;
      const slot = lowField(wram, DRAW_LIST, index),
        flags = lowField(wram, OBJECT_FLAGS, slot);
      ctx.x = slot;
      ctx.a = flags;
      // LDA sets the sign, BIT #0400 the zero flag.
      signAndZero(ctx, flags);
      flag(ctx, FLAG_ZERO, !(flags & OBJECT_HALTED));
      if (!(flags & OBJECT_HALTED)) run();
      index = (ctx.y - 2) & WORD_MASK;
    }
    ctx.y = index;
    signAndZero(ctx, index);
  };
  pass(() => {
    h.a.pushWord(ctx.y);
    h.call(MOVE_CALL, MOVE_TARGET, () => moveObject(h, events, routines));
    ctx.y = h.a.pullWord();
  });
  setWord(wram, DP_FRAME_BANK, FRAME_BANK);
  ctx.a = FRAME_BANK;
  pass(() =>
    h.call(ANIMATION_CALL, ANIMATION_TARGET, () => routines.get(ANIMATION_TARGET)(h, events)),
  );
  return h.rts();
}
