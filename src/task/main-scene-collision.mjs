import { unpackStep } from './native-unpack-body.mjs';
import { SCENE_LOAD_ROUTINES } from './main-scene-load.mjs';
import { routineCaller } from './routine-call.mjs';
import { BYTE_MASK, BYTE_SIGN, HIGH_BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO, FLAG_CARRY, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
import { WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
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
} from './wram.mjs';
// Scene geometry from the original two layer streams and three zone lists.
// Coordinates, list links and counters stay in the shared WRAM. No host map.

// Direct page of the static grid: the next free node (81:83FB, 81:840E), the grid columns
// and rows of a box's edges (as in 81:846E), the object definition pointer with its bank,
// the object list pointer (81:84DE, as 81:A117), the room list and script list pointers
// (81:8756, as the room transition) and the counters and scratch words of 81:84DE/8701.
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
// An empty cell list, the last cell word index, and the cell bits of a word index: the
// column (bits 1-4) and one row step (16 cells of one word).
const NO_NODE = WORD_MASK,
  LAST_CELL_WORD = 2 * COLLISION_CELLS - 2,
  CELL_COLUMN_MASK = 0x1e,
  CELL_ROW_STEP = 0x20;
// Object definitions in bank 8A (src/data/object-types.mjs): the table, the box count
// header byte and the header size before the 5-byte parts.
const OBJECT_TABLE = 0x8ac36a,
  DEFINITION_BANK = 0x8a,
  DEFINITION_BOX_COUNT = 7,
  DEFINITION_HEADER_BYTES = 8;
// Scene object word bits 13 and 14 (high bytes of x and y): such objects get no boxes.
const OBJECT_POSITION_HIGH = 0x6000;
// DP_FLIPPED for a definition drawn flipped (bit 15 of the object word).
const FLIPPED = WORD_MASK;
// A of 81:8701: 0 for boxes alone, otherwise every box carries a data word.
const WITH_DATA_WORD = WORD_MASK;
const up = (h) => h.index('y', h.ctx.y + 1);
const nextWord = (h) => {
  up(h);
  up(h);
};
// Original routine $81:83FB.
function clearStaticGrid(h) {
  const { ctx } = h;
  h.dpWrite(DP_NODE, 0);
  h.write(h.abs(STATIC_BOX_END), 0);
  h.index('x', LAST_CELL_WORD);
  h.load(NO_NODE);
  do {
    h.write(h.abs(STATIC_CELL_HEADS) + ctx.x, ctx.a);
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  return h.rtl();
}
// Original routine $81:840E.
function addBoxToGrid(h, e) {
  const { ctx } = h;
  h.phy();
  for (const [at, dp] of [
    [COLLISION_BOX_X0, DP_COLUMN_X0],
    [COLLISION_BOX_X1, DP_COLUMN_X1],
  ]) {
    h.load(h.read(h.abs(at) + ctx.x));
    h.load(ctx.a & CELL_COORDINATE_MASK);
    h.asl();
    h.asl();
    h.asl();
    h.xba();
    h.dpWrite(dp, ctx.a);
  }
  h.load(h.read(h.abs(COLLISION_BOX_Y1) + ctx.x));
  unpackStep(h, e, 0x81842a);
  h.load(ctx.a & CELL_COORDINATE_MASK);
  h.lsr();
  h.dpWrite(DP_ROW_Y1, ctx.a);
  h.load(h.read(h.abs(COLLISION_BOX_Y0) + ctx.x));
  h.load(ctx.a & CELL_COORDINATE_MASK);
  h.lsr();
  for (;;) {
    h.dpWrite(DP_ROW_Y0, ctx.a);
    h.load(ctx.a | h.dp(DP_COLUMN_X0));
    h.index('y', ctx.a);
    for (;;) {
      h.phx();
      h.load(ctx.x);
      h.index('x', h.dp(DP_NODE, 2));
      h.write(h.abs(COLLISION_NODE_BOX) + ctx.x, ctx.a);
      h.load(h.read(h.abs(STATIC_CELL_HEADS) + ctx.y));
      h.write(h.abs(COLLISION_NODE_NEXT) + ctx.x, ctx.a);
      h.load(ctx.x);
      h.write(h.abs(STATIC_CELL_HEADS) + ctx.y, ctx.a);
      h.index('x', ctx.x + 1);
      h.index('x', ctx.x + 1);
      h.dpWrite(DP_NODE, ctx.x, 2);
      h.plx();
      nextWord(h);
      h.load(ctx.y);
      h.load(ctx.a & CELL_COLUMN_MASK);
      if (ctx.status & FLAG_ZERO) break;
      h.cmp(h.dp(DP_COLUMN_X1));
      if (ctx.status & FLAG_ZERO || !(ctx.status & FLAG_CARRY)) continue;
      break;
    }
    h.load(h.dp(DP_ROW_Y0));
    ctx.status &= ~FLAG_CARRY;
    h.adc(CELL_ROW_STEP);
    h.cmp(h.dp(DP_ROW_Y1));
    if (ctx.status & FLAG_ZERO || !(ctx.status & FLAG_CARRY)) continue;
    h.ply();
    return h.rtl();
  }
}
// Original routine $81:84CF.
function readSignedByte(h) {
  h.load(h.read(h.indirect(DP_DEFINITION, h.ctx.y)));
  up(h);
  h.load(h.ctx.a & BYTE_MASK);
  h.cmp(BYTE_SIGN);
  if (h.ctx.status & FLAG_CARRY) h.load(h.ctx.a | HIGH_BYTE_MASK);
  return h.rtl();
}
// Original routine $81:84DE.
function addObjectBoxes(h, e, r = SCENE_COLLISION_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r),
    read = () => h.read(h.indirect(DP_OBJECT_LISTS, ctx.y));
  h.index('y', 1);
  h.load(h.read(h.indirect(DP_OBJECT_LISTS)));
  h.load(ctx.a & BYTE_MASK);
  if (!(ctx.status & FLAG_ZERO)) {
    h.dpWrite(DP_OBJECTS_LEFT, ctx.a);
    do {
      h.load(read());
      nextWord(h);
      h.bit(OBJECT_POSITION_HIGH);
      let skip = !(ctx.status & FLAG_ZERO);
      if (!skip) {
        h.asl();
        h.phx();
        h.index('x', ctx.a);
        h.load(h.read(OBJECT_TABLE + ctx.x));
        h.plx();
        h.dpWrite(DP_DEFINITION, ctx.a);
        h.load(ctx.status & FLAG_CARRY ? FLIPPED : 0);
        h.dpWrite(DP_FLIPPED, ctx.a);
        h.load(read());
        h.load(ctx.a & BYTE_MASK);
        h.bit(BYTE_SIGN);
        skip = !(ctx.status & FLAG_ZERO);
        if (!skip) {
          h.asl();
          h.asl();
          h.asl();
          h.dpWrite(DP_Z, ctx.a);
          up(h);
          for (const dp of [DP_X, DP_Y]) {
            h.load(read());
            h.load(ctx.a & BYTE_MASK);
            h.asl();
            h.asl();
            h.dpWrite(dp, ctx.a);
            up(h);
          }
          h.phy();
          h.index('y', DEFINITION_BOX_COUNT);
          h.load(h.read(h.indirect(DP_DEFINITION, ctx.y)));
          h.load(ctx.a & BYTE_MASK);
          if (!(ctx.status & FLAG_ZERO)) {
            h.dpWrite(DP_BOXES_LEFT, ctx.a);
            h.load(h.read(h.indirect(DP_DEFINITION)));
            h.load(ctx.a & BYTE_MASK);
            h.dpWrite(DP_PART_COUNT, ctx.a);
            h.asl();
            h.asl();
            h.adc(h.dp(DP_PART_COUNT));
            h.adc(DEFINITION_HEADER_BYTES);
            h.index('y', ctx.a);
            do {
              h.load(h.dp(DP_FLIPPED));
              const swapped = !(ctx.status & FLAG_ZERO);
              for (const [pc, dp, lo, hi] of swapped
                ? [
                    [0x818587, DP_Y, COLLISION_BOX_Y0, COLLISION_BOX_Y1],
                    [0x81859e, DP_X, COLLISION_BOX_X0, COLLISION_BOX_X1],
                    [0x8185b5, DP_Z, COLLISION_BOX_BOTTOM, COLLISION_BOX_TOP],
                  ]
                : [
                    [0x818557, DP_X, COLLISION_BOX_X0, COLLISION_BOX_X1],
                    [0x81856e, DP_Y, COLLISION_BOX_Y0, COLLISION_BOX_Y1],
                    [0x8185b5, DP_Z, COLLISION_BOX_BOTTOM, COLLISION_BOX_TOP],
                  ]) {
                call(pc, 0x8184cf, true);
                ctx.status &= ~FLAG_CARRY;
                h.adc(h.dp(dp));
                h.write(h.abs(lo) + ctx.x, ctx.a);
                h.load(h.read(h.indirect(DP_DEFINITION, ctx.y)));
                up(h);
                h.load(ctx.a & BYTE_MASK);
                ctx.status &= ~FLAG_CARRY;
                h.adc(h.read(h.abs(lo) + ctx.x));
                h.write(h.abs(hi) + ctx.x, ctx.a);
              }
              h.phx();
              h.load(ctx.x);
              h.lsr();
              h.lsr();
              h.index('x', ctx.a);
              h.load(0);
              h.write(COLLISION_BOX_OBJECT + ctx.x, ctx.a);
              h.plx();
              call(0x8185d9, 0x81840e, true);
              h.load(ctx.x);
              ctx.status &= ~FLAG_CARRY;
              h.adc(COLLISION_BOX_BYTES);
              h.index('x', ctx.a);
              h.modify(DP_BOXES_LEFT, 'dec', true);
            } while (!(ctx.status & FLAG_ZERO));
          }
          h.ply();
        }
      }
      if (skip) {
        up(h);
        up(h);
        up(h);
      }
      h.modify(DP_OBJECTS_LEFT, 'dec', true);
    } while (!(ctx.status & FLAG_ZERO));
  }
  h.load(ctx.y);
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.dp(DP_OBJECT_LISTS));
  h.dpWrite(DP_OBJECT_LISTS, ctx.a);
  return h.rtl();
}
// Original routine $81:8701.
function addListBoxes(h, e, r = SCENE_COLLISION_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.dpWrite(DP_DATA_WORD, ctx.a);
  h.load(h.read(h.indirect(DP_ROOM_LISTS, ctx.y)));
  up(h);
  h.load(ctx.a & BYTE_MASK);
  if (!(ctx.status & FLAG_ZERO)) {
    h.dpWrite(DP_LIST_BOXES_LEFT, ctx.a);
    do {
      for (const at of [
        COLLISION_BOX_X0,
        COLLISION_BOX_Y0,
        COLLISION_BOX_BOTTOM,
        COLLISION_BOX_X1,
        COLLISION_BOX_Y1,
        COLLISION_BOX_TOP,
      ]) {
        h.load(h.read(h.indirect(DP_ROOM_LISTS, ctx.y)));
        h.write(h.abs(at) + ctx.x, ctx.a);
        nextWord(h);
      }
      h.phx();
      h.load(ctx.x);
      h.lsr();
      h.lsr();
      h.index('x', ctx.a);
      h.load(h.dp(DP_DATA_WORD));
      if (!(ctx.status & FLAG_ZERO)) nextWord(h);
      h.write(COLLISION_BOX_OBJECT + ctx.x, ctx.a);
      h.plx();
      call(0x818747, 0x81840e, true);
      h.load(ctx.x);
      ctx.status &= ~FLAG_CARRY;
      h.adc(COLLISION_BOX_BYTES);
      h.index('x', ctx.a);
      h.modify(DP_LIST_BOXES_LEFT, 'dec', true);
    } while (!(ctx.status & FLAG_ZERO));
  }
  return h.rtl();
}
// Original routine $81:8756 (lifted in src/game/collision-grid.mjs; this version serves
// the reference entry and the Mesen cold boot replay).
function buildStaticGrid(h, e, r = SCENE_COLLISION_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.phb();
  h.push(WRAM_BANK_PAIR, 2);
  h.plb();
  h.plb();
  call(0x81875c, 0x8183fb, true);
  h.index('x', h.read(h.abs(STATIC_BOX_END), 2));
  h.sep(FLAG_MEMORY_8BIT);
  h.load(DEFINITION_BANK);
  h.dpWrite(DP_DEFINITION_BANK, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  call(0x81876b, 0x8184de, true);
  call(0x81876f, 0x8184de, true);
  h.load(0);
  h.index('y', ctx.a);
  call(0x818777, 0x818701, true);
  h.load(ctx.y);
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.dp(DP_ROOM_LISTS));
  h.dpWrite(DP_SCRIPT_LIST, ctx.a);
  h.load(WITH_DATA_WORD);
  call(0x818784, 0x818701, true);
  h.load(WITH_DATA_WORD);
  call(0x81878b, 0x818701, true);
  h.write(h.abs(STATIC_BOX_END), ctx.x, 2);
  h.load(h.dp(DP_NODE));
  h.write(h.abs(STATIC_NODE_END), ctx.a);
  h.plb();
  return h.rtl();
}
export const SCENE_COLLISION_ROUTINES = new Map([
  ...SCENE_LOAD_ROUTINES,
  [0x8183fb, clearStaticGrid],
  [0x81840e, addBoxToGrid],
  [0x8184cf, readSignedByte],
  [0x8184de, addObjectBoxes],
  [0x818701, addListBoxes],
  [0x818756, buildStaticGrid],
]);
