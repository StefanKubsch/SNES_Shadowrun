import {
  PLAYER_OBJECT,
  WRAM,
  OBJECT_X,
  OBJECT_Y,
  OBJECT_HEIGHT,
  OBJECT_FLAGS,
  OBJECT_CLASS_MASK,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_BOX_HEIGHT,
  COLLISION_CELL_HEADS,
  COLLISION_NODE_BOX,
  COLLISION_NODE_NEXT,
  COLLISION_BOX_X0,
  COLLISION_BOX_Y0,
  COLLISION_BOX_BOTTOM,
  COLLISION_BOX_X1,
  COLLISION_BOX_Y1,
  COLLISION_BOX_TOP,
  COLLISION_BOX_OBJECT,
  CELL_COORDINATE_MASK,
  STATIC_CELL_HEADS,
} from './wram.mjs';
import { WORD_MASK } from '../constants/bits.mjs';
import { WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
import { FLAG_CARRY, FLAG_ZERO, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
// Collision helpers $80:80B2/$8133/$81B4/$8238/$82BC on the shared VM WRAM.
// All accesses follow the original order; after PHB/PEA/PLB high tables belong to DBR 7E.
// The lists are original data. As in the original, a cyclic list does not end by itself.

// Direct page of the helpers: the searching object's box in quarter units (x0, x1, y0, y1,
// bottom, top), the grid columns and rows of its edges, the up to four cells they combine
// to, the height found, the searching object and the box offset 81:85FE keeps.
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
// A searching object of class 3 ignores the player figure (81:8686) and is stopped by the
// height 0040 inside a static box with an object (81:85FE).
const SPECIAL_CLASS = 3,
  SPECIAL_CLASS_HEIGHT = 0x40;
const callReturn = (address) => address & WORD_MASK;

const carry = (h) => (h.ctx.status & FLAG_CARRY) !== 0;
const zero = (h) => (h.ctx.status & FLAG_ZERO) !== 0;
const negative = (h) => (h.ctx.status & FLAG_NEGATIVE) !== 0;
const fieldX = (h, at) => h.read(h.abs(at) + h.ctx.x);
const fieldY = (h, at) => h.read(h.abs(at) + h.ctx.y);

// The six shared containment comparisons of $85FE and $8686. The height is an SBC
// whose carry is checked before the following comparison with the result so far.
function eligible(h) {
  h.index('y', fieldX(h, COLLISION_NODE_BOX));
  h.load(h.dp(DP_X1));
  h.cmp(fieldY(h, COLLISION_BOX_X0));
  if (!carry(h)) return false;
  h.load(fieldY(h, COLLISION_BOX_X1));
  h.cmp(h.dp(DP_X0));
  if (!carry(h)) return false;
  h.load(h.dp(DP_Y1));
  h.cmp(fieldY(h, COLLISION_BOX_Y0));
  if (!carry(h)) return false;
  h.load(fieldY(h, COLLISION_BOX_Y1));
  h.cmp(h.dp(DP_Y0));
  if (!carry(h)) return false;
  h.load(h.dp(DP_TOP));
  h.cmp(fieldY(h, COLLISION_BOX_BOTTOM));
  if (!carry(h)) return false;
  h.ctx.status |= FLAG_CARRY;
  h.load(fieldY(h, COLLISION_BOX_TOP));
  h.sbc(h.dp(DP_BOTTOM));
  if (!carry(h)) return false;
  h.cmp(h.dp(DP_RESULT));
  return carry(h);
}

// $81:85FE: fixed scene geometry. Metadata 0 takes over the height found;
// otherwise object class 3 can set the value 0040 when the centre is contained.
function searchStatic(h) {
  const { ctx } = h;
  const inside = () => {
    h.index('y', h.dp(DP_BOX));
    h.load(fieldX(h, OBJECT_X));
    h.lsr();
    h.lsr();
    h.cmp(fieldY(h, COLLISION_BOX_X0));
    if (!carry(h)) return false;
    h.cmp(fieldY(h, COLLISION_BOX_X1));
    if (carry(h)) return false;
    h.load(fieldX(h, OBJECT_Y));
    h.lsr();
    h.lsr();
    h.cmp(fieldY(h, COLLISION_BOX_Y0));
    if (!carry(h)) return false;
    h.cmp(fieldY(h, COLLISION_BOX_Y1));
    if (carry(h)) return false;
    h.load(h.dp(DP_BOTTOM));
    h.cmp(fieldY(h, COLLISION_BOX_BOTTOM));
    return carry(h);
  };
  do {
    if (eligible(h)) {
      h.phx();
      h.dpWrite(DP_BOX, ctx.y);
      h.index('y', ctx.a);
      h.load(h.dp(DP_BOX));
      h.lsr();
      h.lsr();
      h.index('x', ctx.a);
      h.load(h.read(COLLISION_BOX_OBJECT + ctx.x));
      if (zero(h)) h.dpWrite(DP_RESULT, ctx.y);
      else {
        h.index('x', h.dp(DP_SEARCHER));
        h.load(fieldX(h, OBJECT_FLAGS) & OBJECT_CLASS_MASK);
        h.cmp(SPECIAL_CLASS);
        if (zero(h) && inside()) {
          h.index('y', SPECIAL_CLASS_HEIGHT);
          h.dpWrite(DP_RESULT, ctx.y);
        }
      }
      h.plx();
    }
    h.load(fieldX(h, COLLISION_NODE_NEXT));
    h.index('x', ctx.a);
  } while (!negative(h));
  return h.rtl();
}

// $81:8686: moving objects. Ignore the own object; for the player figure the class of the
// searching object also decides. PLY takes the height word saved with PHA.
function searchObjects(h) {
  const { ctx } = h;
  do {
    if (eligible(h)) {
      h.pha();
      h.phx();
      h.load(ctx.y);
      h.lsr();
      h.lsr();
      h.index('x', ctx.a);
      h.load(h.read(COLLISION_BOX_OBJECT + ctx.x));
      h.plx();
      h.ply();
      h.cmp(h.dp(DP_SEARCHER));
      if (!zero(h)) {
        h.cmp(h.read(h.abs(PLAYER_OBJECT)));
        if (!zero(h)) h.dpWrite(DP_RESULT, ctx.y);
        else {
          h.phy();
          h.index('y', h.dp(DP_SEARCHER));
          h.load(fieldY(h, OBJECT_FLAGS));
          h.ply();
          h.load(ctx.a & OBJECT_CLASS_MASK);
          h.cmp(SPECIAL_CLASS);
          if (!zero(h)) h.dpWrite(DP_RESULT, ctx.y);
        }
      }
    }
    h.load(fieldX(h, COLLISION_NODE_NEXT));
    h.index('x', ctx.a);
  } while (!negative(h));
  return h.rtl();
}

// $81:86E5: first the fixed, then the moving list of the same cell; carry 1 only for result 0.
function searchCell(h) {
  h.index('x', fieldY(h, STATIC_CELL_HEADS));
  if (!negative(h)) {
    h.phy();
    h.call(callReturn(0x8186eb), 0x8185fe, () => searchStatic(h), true);
    h.ply();
  }
  h.index('x', fieldY(h, COLLISION_CELL_HEADS));
  if (!negative(h)) h.call(callReturn(0x8186f5), 0x818686, () => searchObjects(h), true);
  h.load(h.dp(DP_RESULT));
  h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(zero(h));
  return h.rtl();
}

function begin(h) {
  h.dpWrite(DP_SEARCHER, h.ctx.x);
  h.phy();
  h.phb();
  h.push(WRAM_BANK_PAIR, 2);
  h.plb();
  h.plb();
  h.dpWrite(DP_RESULT, 0);
  h.load(fieldX(h, OBJECT_HEIGHT));
  h.lsr();
  h.lsr();
  h.ctx.status &= ~FLAG_CARRY;
  h.dpWrite(DP_BOTTOM, h.ctx.a);
  h.adc(h.read(WRAM + OBJECT_BOX_HEIGHT + h.ctx.x));
  h.dpWrite(DP_TOP, h.ctx.a);
}
// A limit from position/4 + extent; optionally store its cell part in the source form.
function extent(h, position, extension, scratch, cell = 0, firstAxis = false) {
  h.load(fieldX(h, position));
  h.lsr();
  h.lsr();
  h.ctx.status &= ~FLAG_CARRY;
  h.adc(h.read(WRAM + extension + h.ctx.x));
  h.dpWrite(scratch, h.ctx.a);
  if (cell) {
    h.load(h.ctx.a & CELL_COORDINATE_MASK);
    if (firstAxis) {
      h.asl();
      h.asl();
      h.asl();
      h.xba();
    } else h.lsr();
    h.dpWrite(cell, h.ctx.a);
  }
}
const combine = (h, withScratch, to) => {
  h.load(h.ctx.a | h.dp(withScratch));
  h.dpWrite(to, h.ctx.a);
};
const search = (h, pc) => h.call(callReturn(pc), 0x8186e5, () => searchCell(h), true);
function finish(h, result) {
  h.plb();
  h.ply();
  h.index('x', h.dp(DP_SEARCHER));
  if (result) {
    h.load(h.dp(DP_RESULT));
    h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(zero(h));
  }
  return h.rts();
}

// $80:80B2: x upper edge, cells 35 and 2F.
export function testUpperXEdge(h) {
  begin(h);
  extent(h, OBJECT_X, OBJECT_BOX_X1, DP_X0);
  extent(h, OBJECT_X, OBJECT_BOX_X2, DP_X1, DP_COLUMN_X1, true);
  extent(h, OBJECT_Y, OBJECT_BOX_Y1, DP_Y0, DP_ROW_Y0);
  combine(h, DP_COLUMN_X1, DP_CELL_X1_Y0);
  extent(h, OBJECT_Y, OBJECT_BOX_Y2, DP_Y1, DP_ROW_Y1);
  combine(h, DP_COLUMN_X1, DP_CELL_X1_Y1);
  h.index('y', h.ctx.a);
  search(h, 0x808119);
  h.index('y', h.dp(DP_CELL_X1_Y0));
  h.cpy(h.dp(DP_CELL_X1_Y1));
  if (!zero(h)) search(h, 0x808123);
  return finish(h, true);
}
// $80:8133: x lower edge, cells 32 and 38.
export function testLowerXEdge(h) {
  begin(h);
  extent(h, OBJECT_X, OBJECT_BOX_X2, DP_X1);
  extent(h, OBJECT_X, OBJECT_BOX_X1, DP_X0, DP_COLUMN_X0, true);
  extent(h, OBJECT_Y, OBJECT_BOX_Y1, DP_Y0, DP_ROW_Y0);
  combine(h, DP_COLUMN_X0, DP_CELL_X0_Y0);
  extent(h, OBJECT_Y, OBJECT_BOX_Y2, DP_Y1, DP_ROW_Y1);
  combine(h, DP_COLUMN_X0, DP_CELL_X0_Y1);
  h.index('y', h.ctx.a);
  search(h, 0x80819a);
  h.index('y', h.dp(DP_CELL_X0_Y0));
  h.cpy(h.dp(DP_CELL_X0_Y1));
  if (!zero(h)) search(h, 0x8081a4);
  return finish(h, true);
}
// $80:81B4: y upper edge; first the lower edge without the cell part, then the upper edge with DP2C.
export function testUpperYEdge(h) {
  begin(h);
  extent(h, OBJECT_Y, OBJECT_BOX_Y1, DP_Y0);
  extent(h, OBJECT_Y, OBJECT_BOX_Y2, DP_Y1, DP_ROW_Y1);
  extent(h, OBJECT_X, OBJECT_BOX_X1, DP_X0, DP_COLUMN_X0, true);
  combine(h, DP_ROW_Y1, DP_CELL_X0_Y1);
  extent(h, OBJECT_X, OBJECT_BOX_X2, DP_X1, DP_COLUMN_X1, true);
  combine(h, DP_ROW_Y1, DP_CELL_X1_Y1);
  h.index('y', h.ctx.a);
  search(h, 0x80821e);
  h.index('y', h.dp(DP_CELL_X0_Y1));
  h.cpy(h.dp(DP_CELL_X1_Y1));
  if (!zero(h)) search(h, 0x808228);
  return finish(h, true);
}
// $80:8238: y lower edge, cells 2F and 38.
export function testLowerYEdge(h) {
  begin(h);
  extent(h, OBJECT_Y, OBJECT_BOX_Y2, DP_Y1);
  extent(h, OBJECT_Y, OBJECT_BOX_Y1, DP_Y0, DP_ROW_Y0);
  extent(h, OBJECT_X, OBJECT_BOX_X1, DP_X0, DP_COLUMN_X0, true);
  combine(h, DP_ROW_Y0, DP_CELL_X0_Y0);
  extent(h, OBJECT_X, OBJECT_BOX_X2, DP_X1, DP_COLUMN_X1, true);
  combine(h, DP_ROW_Y0, DP_CELL_X1_Y0);
  h.index('y', h.ctx.a);
  search(h, 0x8082a2);
  h.index('y', h.dp(DP_CELL_X0_Y0));
  h.cpy(h.dp(DP_CELL_X1_Y0));
  if (!zero(h)) search(h, 0x8082ac);
  return finish(h, true);
}
// $80:82BC: height; each distinct cell at most once. Stop on carry 0 only after both lists
// of a whole cell. At the end there is no LDA 3B/SEC/CLC as in the four other helpers.
export function testHeightCells(h) {
  begin(h);
  extent(h, OBJECT_Y, OBJECT_BOX_Y2, DP_Y1, DP_ROW_Y1);
  extent(h, OBJECT_Y, OBJECT_BOX_Y1, DP_Y0, DP_ROW_Y0);
  extent(h, OBJECT_X, OBJECT_BOX_X1, DP_X0, DP_COLUMN_X0, true);
  combine(h, DP_ROW_Y0, DP_CELL_X0_Y0);
  extent(h, OBJECT_X, OBJECT_BOX_X2, DP_X1, DP_COLUMN_X1, true);
  combine(h, DP_ROW_Y0, DP_CELL_X1_Y0);
  h.load(h.dp(DP_COLUMN_X1));
  combine(h, DP_ROW_Y1, DP_CELL_X1_Y1);
  h.load(h.dp(DP_COLUMN_X0));
  combine(h, DP_ROW_Y1, DP_CELL_X0_Y1);
  h.index('y', h.ctx.a);
  search(h, 0x808338);
  if (!carry(h)) return finish(h, false);
  h.index('y', h.dp(DP_CELL_X0_Y0));
  h.cpy(h.dp(DP_CELL_X0_Y1));
  if (!zero(h)) {
    search(h, 0x808344);
    if (!carry(h)) return finish(h, false);
  }
  h.index('y', h.dp(DP_CELL_X1_Y0));
  h.cpy(h.dp(DP_CELL_X0_Y1));
  if (!zero(h)) {
    h.cpy(h.dp(DP_CELL_X0_Y0));
    if (!zero(h)) {
      search(h, 0x808354);
      if (!carry(h)) return finish(h, false);
    }
  }
  h.index('y', h.dp(DP_CELL_X1_Y1));
  h.cpy(h.dp(DP_CELL_X0_Y1));
  if (!zero(h)) {
    h.cpy(h.dp(DP_CELL_X0_Y0));
    if (!zero(h)) {
      h.cpy(h.dp(DP_CELL_X1_Y0));
      if (!zero(h)) search(h, 0x808368);
    }
  }
  return finish(h, false);
}
