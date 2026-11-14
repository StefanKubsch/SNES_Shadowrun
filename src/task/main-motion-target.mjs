import { WORD_MASK } from '../constants/bits.mjs';
import { setObjectDirection } from './native-object-action-set.mjs';

import {
  MOTION_ACTIVE,
  MOTION_MODE,
  MOTION_X,
  MOTION_Y,
  OBJECT_BLOCKED,
  OBJECT_FLAGS,
  OBJECT_SELECTION,
  OBJECT_TASK,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_X,
  OBJECT_Y,
  WRAM,
} from './wram.mjs';
import { TASK_EVENTS, TASK_PREVIOUS, TASK_WAIT } from '../vm/layout.mjs';
import { FLAG_ZERO, FLAG_NEGATIVE, FLAG_CARRY } from '../constants/cpu-flags.mjs';
// $80:C9E0 with C84D/C913 and C80C: running movement towards a target. The direction
// is set via the already proven AAAF; its data accesses stay fresh.

// Direct page of C80C: the distances on both axes and the negative differences (0: none);
// AAAF takes the direction in DP02.
const DP_DISTANCE_X = 0xa2,
  DP_DISTANCE_Y = 0xa5,
  DP_X_NEGATIVE = 0xa8,
  DP_Y_NEGATIVE = 0xab,
  DP_ACTION_DIRECTION = 2;
// MOTION_MODE bits: bit 0 approaches axis by axis (C84D) instead of directly (C913), bit 1
// prefers the Y axis; C913 notes a changed direction in the bits above.
const MODE_AXES = 1,
  MODE_Y_FIRST = 2;
// MOTION_ACTIVE counts the frames to the next step: 2 normally, 30 after an obstacle.
const STEP_DELAY = 2,
  BLOCKED_DELAY = 0x1e;
// The target is reached below a distance sum of 16; below 12 on the preferred axis, C84D
// switches to the other axis.
const ARRIVAL_DISTANCE = 0x10,
  AXIS_SWITCH_DISTANCE = 12;
// Task event bit sent to the object's task on arrival.
const MOTION_END_EVENT = 4;
// The eight directions by the signs of the differences, and Y = FFFF when C913 only notes
// a changed direction.
const DIRECTION_X_PLUS_Y_PLUS = 1,
  DIRECTION_X_PLUS = 2,
  DIRECTION_X_PLUS_Y_MINUS = 3,
  DIRECTION_Y_MINUS = 4,
  DIRECTION_X_MINUS_Y_MINUS = 5,
  DIRECTION_X_MINUS = 6,
  DIRECTION_X_MINUS_Y_PLUS = 7,
  DIRECTION_NONE = WORD_MASK;
// Direction step tables 80:C7CC/C7DC (a) and 80:C7EC/C7FC (b, when OBJECT_SELECTION is 2;
// what that value means is not established) (src/data/tables.mjs).
const STEPS_X_A = 0xc7cc,
  STEPS_Y_A = 0xc7dc,
  STEPS_X_B = 0xc7ec,
  STEPS_Y_B = 0xc7fc,
  SELECTION_STEPS_B = 2;
// FORMATION_UNMOVED value when the player figure did not move (0 after a new entry).
const zero = (h) => (h.ctx.status & FLAG_ZERO) !== 0;
const negative = (h) => (h.ctx.status & FLAG_NEGATIVE) !== 0;
const carry = (h) => (h.ctx.status & FLAG_CARRY) !== 0;
const field = (h, offset) => h.read(h.abs(offset) + h.ctx.x);
const put = (h, offset, value) => h.write(h.abs(offset) + h.ctx.x, value);
const farField = (h, offset) => h.read(WRAM + offset + h.ctx.x);
const farPut = (h, offset, value) => h.write(WRAM + offset + h.ctx.x, value);

// $C80C: distance on both axes and the original negative differences as signs.
function distance(h) {
  const { ctx } = h;
  h.dpWrite(DP_X_NEGATIVE, 0);
  h.dpWrite(DP_Y_NEGATIVE, 0);
  h.load(farField(h, MOTION_X));
  if (zero(h)) {
    h.load(farField(h, MOTION_Y));
    h.index('y', ctx.a);
    h.load(h.read(h.abs(OBJECT_X) + ctx.y));
  }
  ctx.status |= FLAG_CARRY;
  h.sbc(field(h, OBJECT_X));
  if (negative(h)) {
    h.dpWrite(DP_X_NEGATIVE, ctx.a);
    h.load(ctx.a ^ WORD_MASK);
    h.load(ctx.a + 1);
  }
  h.dpWrite(DP_DISTANCE_X, ctx.a);
  h.load(farField(h, MOTION_X));
  if (zero(h)) h.load(h.read(h.abs(OBJECT_Y) + ctx.y));
  else h.load(farField(h, MOTION_Y));
  ctx.status |= FLAG_CARRY;
  h.sbc(field(h, OBJECT_Y));
  if (negative(h)) {
    h.dpWrite(DP_Y_NEGATIVE, ctx.a);
    h.load(ctx.a ^ WORD_MASK);
    h.load(ctx.a + 1);
  }
  h.dpWrite(DP_DISTANCE_Y, ctx.a);
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.dp(DP_DISTANCE_X));
  return h.rts();
}
function arrived(h) {
  put(h, OBJECT_VELOCITY_X, 0);
  put(h, OBJECT_VELOCITY_Y, 0);
  h.index('y', field(h, OBJECT_TASK));
  if (!negative(h)) {
    for (;;) {
      h.load(h.read(h.abs(TASK_WAIT) + h.ctx.y));
      if (!negative(h)) break;
      h.load(h.read(h.abs(TASK_PREVIOUS) + h.ctx.y));
      h.index('y', h.ctx.a);
    }
    h.load(h.read(h.abs(TASK_EVENTS) + h.ctx.y) | MOTION_END_EVENT);
    h.write(h.abs(TASK_EVENTS) + h.ctx.y, h.ctx.a);
  }
  return h.rts();
}
function velocity(h) {
  h.asl();
  h.index('y', h.ctx.a);
  h.load(field(h, OBJECT_SELECTION));
  h.cmp(SELECTION_STEPS_B);
  const xTable = zero(h) ? STEPS_X_B : STEPS_X_A,
    yTable = zero(h) ? STEPS_Y_B : STEPS_Y_A;
  h.load(h.read(h.abs(xTable) + h.ctx.y));
  put(h, OBJECT_VELOCITY_X, h.ctx.a);
  h.load(h.read(h.abs(yTable) + h.ctx.y));
  put(h, OBJECT_VELOCITY_Y, h.ctx.a);
}

// $C84D: approach axis by axis. After an obstacle, the other axis first;
// below 12 units, switch the preferred axis in the mode word.
function moveAxes(h, action) {
  const { ctx } = h;
  h.load(farField(h, MOTION_ACTIVE));
  h.load(ctx.a - 1);
  farPut(h, MOTION_ACTIVE, ctx.a);
  if (!zero(h)) return h.rts();
  h.call(0x80c858, 0x80c80c, () => distance(h));
  h.cmp(ARRIVAL_DISTANCE);
  if (!carry(h)) return arrived(h);
  h.load(field(h, OBJECT_FLAGS) & OBJECT_BLOCKED);
  let yAxis;
  if (!zero(h)) {
    h.load(BLOCKED_DELAY);
    farPut(h, MOTION_ACTIVE, ctx.a);
    h.load(farField(h, MOTION_MODE) & MODE_Y_FIRST);
    yAxis = zero(h);
  } else {
    h.load(STEP_DELAY);
    farPut(h, MOTION_ACTIVE, ctx.a);
    h.load(farField(h, MOTION_MODE) & MODE_Y_FIRST);
    yAxis = !zero(h);
    h.load(h.dp(yAxis ? DP_DISTANCE_Y : DP_DISTANCE_X));
    h.cmp(AXIS_SWITCH_DISTANCE);
    if (!carry(h)) {
      h.load(farField(h, MOTION_MODE) ^ MODE_Y_FIRST);
      farPut(h, MOTION_MODE, ctx.a);
      h.load(ctx.a & MODE_Y_FIRST);
      yAxis = !zero(h);
    }
  }
  h.load(h.dp(yAxis ? DP_Y_NEGATIVE : DP_X_NEGATIVE));
  h.index(
    'y',
    yAxis ? (zero(h) ? ctx.a : DIRECTION_Y_MINUS) : zero(h) ? DIRECTION_X_PLUS : DIRECTION_X_MINUS,
  );
  h.dpWrite(0, ctx.x);
  h.dpWrite(DP_ACTION_DIRECTION, ctx.y);
  h.phy();
  h.call(0x80c8a6, 0x80aaaf, () => action(h));
  h.pla();
  velocity(h);
  return h.rts();
}

// $C913: eight directions; a changed direction is first only noted in the mode word.
function moveDirect(h, action) {
  const { ctx } = h;
  h.load(farField(h, MOTION_ACTIVE));
  h.load(ctx.a - 1);
  farPut(h, MOTION_ACTIVE, ctx.a);
  if (!zero(h)) return h.rts();
  h.call(0x80c91f, 0x80c80c, () => distance(h));
  h.cmp(ARRIVAL_DISTANCE);
  if (!carry(h)) return arrived(h);
  h.load(h.dp(DP_DISTANCE_Y));
  h.lsr();
  h.cmp(h.dp(DP_DISTANCE_X));
  if (carry(h)) {
    h.load(h.dp(DP_Y_NEGATIVE));
    h.index('y', zero(h) ? ctx.a : DIRECTION_Y_MINUS);
  } else {
    h.load(h.dp(DP_DISTANCE_X));
    h.lsr();
    h.cmp(h.dp(DP_DISTANCE_Y));
    if (carry(h)) {
      h.load(h.dp(DP_X_NEGATIVE));
      h.index('y', zero(h) ? DIRECTION_X_PLUS : DIRECTION_X_MINUS);
    } else {
      h.load(h.dp(DP_X_NEGATIVE));
      if (!zero(h)) {
        h.load(h.dp(DP_Y_NEGATIVE));
        h.index('y', zero(h) ? DIRECTION_X_MINUS_Y_PLUS : DIRECTION_X_MINUS_Y_MINUS);
      } else {
        h.load(h.dp(DP_Y_NEGATIVE));
        h.index('y', zero(h) ? DIRECTION_X_PLUS_Y_PLUS : DIRECTION_X_PLUS_Y_MINUS);
      }
    }
  }
  h.dpWrite(0, ctx.x);
  h.dpWrite(DP_ACTION_DIRECTION, ctx.y);
  h.phy();
  h.load(farField(h, MOTION_MODE));
  let update = zero(h);
  if (!update) {
    h.lsr();
    h.lsr();
    h.cmp(h.dp((ctx.s + 1) & WORD_MASK));
    if (!zero(h)) {
      h.index('y', DIRECTION_NONE);
      update = true;
    }
  }
  if (update) {
    h.load(h.dp((ctx.s + 1) & WORD_MASK));
    ctx.status |= FLAG_CARRY;
    h.rol();
    h.asl();
    farPut(h, MOTION_MODE, ctx.a);
    h.load(ctx.y);
  }
  if (!update || !negative(h)) h.call(0x80c990, 0x80aaaf, () => action(h));
  h.pla();
  velocity(h);
  h.load(STEP_DELAY);
  farPut(h, MOTION_ACTIVE, ctx.a);
  return h.rts();
}

export function moveObjectTowardsTarget(h, action = (h) => setObjectDirection(h.a, false)) {
  h.load(farField(h, MOTION_MODE) & MODE_AXES);
  if (!zero(h)) h.call(0x80c9e9, 0x80c84d, () => moveAxes(h, action));
  else h.call(0x80c9ed, 0x80c913, () => moveDirect(h, action));
  return h.rts();
}
