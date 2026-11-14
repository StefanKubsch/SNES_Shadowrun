import { taskStop } from './plan.mjs';
import { stepObjectAnimation } from './native-scene-tiles.mjs';
import {
  testUpperXEdge,
  testLowerXEdge,
  testUpperYEdge,
  testLowerYEdge,
  testHeightCells,
} from './main-motion-collision.mjs';
import { moveObjectTowardsTarget } from './main-motion-target.mjs';
import { playCutscene, playMatrixScene } from './main-scene.mjs';
import { setUpGameScreenRoutine } from './main-initialize.mjs';
import { enterRoom, forceBlank } from './main-transition.mjs';
import { MAIN_UPKEEP_ROUTINES } from './main-loop-upkeep.mjs';

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
  MOTION_ACTIVE,
  MOVING_BOX_FIRST,
  OBJECT_BLOCKED,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_COLLIDES,
  OBJECT_DIAGONAL,
  OBJECT_FALLS,
  OBJECT_FLAGS,
  OBJECT_HALTED,
  OBJECT_HEIGHT,
  OBJECT_IN_GRID,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_VELOCITY_Z,
  OBJECT_X,
  OBJECT_Y,
  STATIC_NODE_END,
  WRAM,
} from './wram.mjs';
import { WORD_MASK } from '../constants/bits.mjs';
import { WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
import { FLAG_ZERO, FLAG_CARRY, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
// Routines between the scheduler rounds. h accesses the shared VM WRAM directly.
// The scene sequences use their jointly bound helper graphs.
// Unbound calls stop before their return frame; there is no assumed return value.

// Direct page of 81:8799/81:846E: the object's X/4 and Y/4, the box offset, the grid columns
// and rows of the box edges, the four cells they combine to, the box offset being linked and
// the next free node. 80:AB26 keeps the old coordinate in DP_OLD; 80:AFC4 sets the bank byte
// DP_FRAME_BANK of the frame pointer DP3E that 80:AC2F reads.
const DP_X = 0x1a,
  DP_Y = 0x1d,
  DP_BOX = 0x20,
  DP_COLUMN_X0 = 0x3e,
  DP_COLUMN_X1 = 0x41,
  DP_ROW_Y0 = 0x44,
  DP_ROW_Y1 = 0x47,
  DP_LINK_BOX = 0x4d,
  DP_CELL_X0_Y0 = 0x50,
  DP_CELL_X1_Y1 = 0x53,
  DP_CELL_X1_Y0 = 0x56,
  DP_CELL_X0_Y1 = 0x59,
  DP_OLD = 0x6b,
  DP_FRAME_BANK = 0x40,
  DP_NODE = 0xa0;
// Bank 8C of the object frame data (80:AC2F).
const FRAME_BANK = 0x8c;
// 80:AB26: a blocking height below 5 is climbed (in quarter units); a height below 0100
// after the fall ends it.
const STEP_LIMIT = 5,
  FALL_FLOOR = 0x100;
const NO_NODE = WORD_MASK;
const callReturn = (address) => address & WORD_MASK;
const frontier = (target) => taskStop('main_loop_frontier', { target });
// The scene request's register-level callees stay here for its reference
// (proof/game-reference/scene-request.mjs); the lifted request is
// src/game/scene-request.mjs.
export const MAIN_MOTION_ROUTINES = new Map([
  [0x809629, setUpGameScreenRoutine],
  [0x80a4bf, enterRoom],
  [0x81cdf8, playCutscene],
  [0x81c3ca, playMatrixScene],
  [0x81b0bd, forceBlank],
  [0x81b0a1, MAIN_UPKEEP_ROUTINES.get(0x81b0a1)],
  [0x80ac2f, (h, e) => stepObjectAnimation(h, e)],
  [0x80c9e0, (h) => moveObjectTowardsTarget(h)],
  [0x8080b2, (h) => testUpperXEdge(h)],
  [0x808133, (h) => testLowerXEdge(h)],
  [0x8081b4, (h) => testUpperYEdge(h)],
  [0x808238, (h) => testLowerYEdge(h)],
  [0x8082bc, (h) => testHeightCells(h)],
]);
const call = (h, events, routines, pc, target, long = false) => {
  const run = routines.get(target);
  if (!run) frontier(target);
  return h.call(pc, target, () => run(h, events), long);
};

// $81:80F7: the 256 WORD stores written out in the original, with no register change in between.
function clearGrid(h) {
  h.load(NO_NODE);
  for (let cell = 0; cell < COLLISION_CELLS; cell++)
    h.write(h.abs(COLLISION_CELL_HEADS + cell * 2), h.ctx.a);
  return h.rtl();
}

// $81:846E: attach record DP4D to up to four different cells. The comparison order
// is the original's; in particular DP59 is not compared with DP50 again.
function linkGrid(h) {
  const { ctx } = h;
  h.dpWrite(DP_LINK_BOX, ctx.x);
  h.index('x', h.dp(DP_NODE));
  h.index('y', h.dp(DP_CELL_X0_Y0));
  const link = () => {
    h.load(h.dp(DP_LINK_BOX));
    h.write(h.abs(COLLISION_NODE_BOX) + ctx.x, ctx.a);
    h.load(h.read(h.abs(COLLISION_CELL_HEADS) + ctx.y));
    h.write(h.abs(COLLISION_NODE_NEXT) + ctx.x, ctx.a);
    h.load(ctx.x);
    h.write(h.abs(COLLISION_CELL_HEADS) + ctx.y, ctx.a);
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
  };
  link();
  h.cpy(h.dp(DP_CELL_X1_Y1));
  if (!(ctx.status & FLAG_ZERO)) {
    h.index('y', h.dp(DP_CELL_X1_Y1));
    link();
    h.cpy(h.dp(DP_CELL_X1_Y0));
    if (!(ctx.status & FLAG_ZERO)) {
      h.cpy(h.dp(DP_CELL_X0_Y1));
      if (!(ctx.status & FLAG_ZERO)) {
        h.index('y', h.dp(DP_CELL_X1_Y0));
        link();
        h.index('y', h.dp(DP_CELL_X0_Y1));
        link();
      }
    }
  }
  h.dpWrite(DP_NODE, ctx.x);
  h.index('x', h.dp(DP_LINK_BOX));
  return h.rtl();
}

// $81:8799: build the collision list of the active objects. Through DBR 7E high addresses are
// real WRAM tables; the caller's bank is restored through the real stack.
function runCollisionList(h) {
  const { ctx } = h,
    field = (offset) => h.read(h.abs(offset) + ctx.y);
  h.phb();
  h.push(WRAM_BANK_PAIR, 2);
  h.plb();
  h.plb();
  h.call(callReturn(0x81879f), 0x8180f7, () => clearGrid(h), true);
  h.load(h.read(h.abs(STATIC_NODE_END)));
  h.dpWrite(DP_NODE, ctx.a);
  h.index('x', h.read(h.abs(DRAW_LIST_INDEX)));
  if (!(ctx.status & FLAG_NEGATIVE)) {
    h.load(MOVING_BOX_FIRST);
    h.dpWrite(DP_BOX, ctx.a);
    do {
      h.index('y', h.read(h.abs(DRAW_LIST) + ctx.x));
      h.load(field(OBJECT_FLAGS) & OBJECT_IN_GRID);
      if (!(ctx.status & FLAG_ZERO)) {
        h.load(field(OBJECT_BOX_HEIGHT));
        if (!(ctx.status & FLAG_ZERO)) {
          h.phx();
          h.index('x', h.dp(DP_BOX));
          h.load(field(OBJECT_X));
          h.lsr();
          h.lsr();
          h.dpWrite(DP_X, ctx.a);
          ctx.status &= ~FLAG_CARRY;
          h.adc(field(OBJECT_BOX_X1));
          h.write(h.abs(COLLISION_BOX_X0) + ctx.x, ctx.a);
          h.load(ctx.a & CELL_COORDINATE_MASK);
          h.asl();
          h.asl();
          h.asl();
          h.xba();
          h.dpWrite(DP_COLUMN_X0, ctx.a);
          h.load(field(OBJECT_Y));
          h.lsr();
          h.lsr();
          h.dpWrite(DP_Y, ctx.a);
          ctx.status &= ~FLAG_CARRY;
          h.adc(field(OBJECT_BOX_Y1));
          h.write(h.abs(COLLISION_BOX_Y0) + ctx.x, ctx.a);
          h.load(h.read(h.abs(COLLISION_BOX_Y0) + ctx.x));
          h.load(ctx.a & CELL_COORDINATE_MASK);
          h.lsr();
          h.dpWrite(DP_ROW_Y0, ctx.a);
          h.load(ctx.a | h.dp(DP_COLUMN_X0));
          h.dpWrite(DP_CELL_X0_Y0, ctx.a);
          h.load(field(OBJECT_HEIGHT));
          h.lsr();
          h.lsr();
          h.write(h.abs(COLLISION_BOX_BOTTOM) + ctx.x, ctx.a);
          ctx.status &= ~FLAG_CARRY;
          h.adc(field(OBJECT_BOX_HEIGHT));
          h.write(h.abs(COLLISION_BOX_TOP) + ctx.x, ctx.a);
          ctx.status &= ~FLAG_CARRY;
          h.load(field(OBJECT_BOX_X2));
          h.adc(h.dp(DP_X));
          h.write(h.abs(COLLISION_BOX_X1) + ctx.x, ctx.a);
          h.load(ctx.a & CELL_COORDINATE_MASK);
          h.asl();
          h.asl();
          h.asl();
          h.xba();
          h.dpWrite(DP_COLUMN_X1, ctx.a);
          ctx.status &= ~FLAG_CARRY;
          h.load(field(OBJECT_BOX_Y2));
          h.adc(h.dp(DP_Y));
          h.write(h.abs(COLLISION_BOX_Y1) + ctx.x, ctx.a);
          h.load(ctx.a & CELL_COORDINATE_MASK);
          h.lsr();
          h.dpWrite(DP_ROW_Y1, ctx.a);
          h.load(ctx.a | h.dp(DP_COLUMN_X1));
          h.dpWrite(DP_CELL_X1_Y1, ctx.a);
          h.load(h.dp(DP_COLUMN_X1));
          h.load(ctx.a | h.dp(DP_ROW_Y0));
          h.dpWrite(DP_CELL_X1_Y0, ctx.a);
          h.load(h.dp(DP_COLUMN_X0));
          h.load(ctx.a | h.dp(DP_ROW_Y1));
          h.dpWrite(DP_CELL_X0_Y1, ctx.a);
          h.call(callReturn(0x818840), 0x81846e, () => linkGrid(h), true);
          h.load(ctx.x);
          ctx.status &= ~FLAG_CARRY;
          h.adc(COLLISION_BOX_BYTES);
          h.dpWrite(DP_BOX, ctx.a);
          h.load(ctx.x);
          h.lsr();
          h.lsr();
          h.index('x', ctx.a);
          h.ply();
          h.load(h.read(h.abs(DRAW_LIST) + ctx.y));
          h.write(COLLISION_BOX_OBJECT + ctx.x, ctx.a);
          h.index('x', ctx.y);
        }
      }
      h.index('x', ctx.x - 1);
      h.index('x', ctx.x - 1);
    } while (!(ctx.status & FLAG_NEGATIVE));
  }
  h.plb();
  return h.rtl();
}

// $80:AB26: movement of an object, with the original carry transitions to the
// collision tests. The helpers are required only when their call is reached.
export function runObjectMove(h, events, routines = MAIN_MOTION_ROUTINES) {
  const { ctx } = h,
    field = (offset) => h.read(h.abs(offset) + ctx.x),
    put = (offset, v) => h.write(h.abs(offset) + ctx.x, v);
  h.load(h.read(WRAM + MOTION_ACTIVE + ctx.x));
  if (!(ctx.status & FLAG_ZERO)) call(h, events, routines, callReturn(0x80ab2c), 0x80c9e0);
  h.load(field(OBJECT_FLAGS) & (WORD_MASK ^ OBJECT_BLOCKED));
  put(OBJECT_FLAGS, ctx.a);
  const horizontal = (position, velocity, forward, backward, forwardPc, backwardPc) => {
    h.load(field(position));
    h.dpWrite(DP_OLD, ctx.a);
    h.load(field(velocity));
    if (ctx.status & FLAG_ZERO) return;
    ctx.status &= ~FLAG_CARRY;
    h.adc(field(position));
    put(position, ctx.a);
    h.load(field(OBJECT_FLAGS) & OBJECT_COLLIDES);
    if (ctx.status & FLAG_ZERO) return;
    const reverse = (ctx.status & FLAG_CARRY) !== 0;
    call(
      h,
      events,
      routines,
      callReturn(reverse ? backwardPc : forwardPc),
      reverse ? backward : forward,
    );
    if (ctx.status & FLAG_CARRY) return;
    h.cmp(STEP_LIMIT);
    if (!(ctx.status & FLAG_CARRY)) {
      h.asl();
      h.asl();
      h.adc(field(OBJECT_HEIGHT));
      put(OBJECT_HEIGHT, ctx.a);
      put(OBJECT_VELOCITY_Z, 0);
    } else {
      h.load(h.dp(DP_OLD));
      put(position, ctx.a);
      h.load(field(OBJECT_FLAGS) | OBJECT_BLOCKED);
      put(OBJECT_FLAGS, ctx.a);
    }
  };
  horizontal(OBJECT_X, OBJECT_VELOCITY_X, 0x8080b2, 0x808133, 0x80ab53, 0x80ab6a);
  horizontal(OBJECT_Y, OBJECT_VELOCITY_Y, 0x8081b4, 0x808238, 0x80abaa, 0x80abc1);
  h.load(field(OBJECT_FLAGS) & OBJECT_FALLS);
  if (!(ctx.status & FLAG_ZERO)) {
    ctx.status |= FLAG_CARRY;
    h.load(field(OBJECT_VELOCITY_Z));
    h.sbc(1);
    put(OBJECT_VELOCITY_Z, ctx.a);
  }
  ctx.status &= ~FLAG_CARRY;
  h.load(field(OBJECT_HEIGHT));
  h.dpWrite(DP_OLD, ctx.a);
  h.adc(field(OBJECT_VELOCITY_Z));
  h.cmp(FALL_FLOOR);
  let restore = !(ctx.status & FLAG_CARRY);
  if (!restore) {
    h.cmp(field(OBJECT_HEIGHT));
    if (!(ctx.status & FLAG_ZERO)) {
      put(OBJECT_HEIGHT, ctx.a);
      h.load(field(OBJECT_FLAGS) & OBJECT_COLLIDES);
      if (!(ctx.status & FLAG_ZERO)) {
        call(h, events, routines, callReturn(0x80ac16), 0x8082bc);
        restore = !(ctx.status & FLAG_CARRY);
      }
    }
  }
  if (restore) {
    h.load(h.dp(DP_OLD));
    put(OBJECT_HEIGHT, ctx.a);
    put(OBJECT_VELOCITY_Z, 0);
  }
  ctx.status &= ~FLAG_CARRY;
  h.load(field(OBJECT_Y));
  h.adc(field(OBJECT_X));
  h.lsr();
  put(OBJECT_DIAGONAL, ctx.a);
  return h.rts();
}

// $80:AFC4: search list first, then movement and animation in two separate passes.
// The second list is read afresh; there is no second BMI test between the passes.
export function moveAndAnimateObjects(h, events, routines = MAIN_MOTION_ROUTINES) {
  const { ctx } = h;
  h.call(callReturn(0x80afc4), 0x818799, () => runCollisionList(h), true);
  h.index('y', h.read(h.abs(DRAW_LIST_INDEX)));
  if (ctx.status & FLAG_NEGATIVE) return h.rts();
  do {
    h.index('x', h.read(h.abs(DRAW_LIST) + ctx.y));
    h.load(h.read(h.abs(OBJECT_FLAGS) + ctx.x));
    h.bit(OBJECT_HALTED);
    if (ctx.status & FLAG_ZERO) {
      h.phy();
      h.call(callReturn(0x80afd9), 0x80ab26, () => runObjectMove(h, events, routines));
      h.ply();
    }
    h.index('y', ctx.y - 1);
    h.index('y', ctx.y - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(FRAME_BANK);
  h.dpWrite(DP_FRAME_BANK, ctx.a);
  h.index('y', h.read(h.abs(DRAW_LIST_INDEX)));
  do {
    h.index('x', h.read(h.abs(DRAW_LIST) + ctx.y));
    h.load(h.read(h.abs(OBJECT_FLAGS) + ctx.x));
    h.bit(OBJECT_HALTED);
    if (ctx.status & FLAG_ZERO) call(h, events, routines, callReturn(0x80aff4), 0x80ac2f);
    h.index('y', ctx.y - 1);
    h.index('y', ctx.y - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  return h.rts();
}
