import { routineCaller } from '../../src/task/routine-call.mjs';
import { taskStop } from '../../src/task/plan.mjs';
import { setCarry } from '../../src/task/status-flags.mjs';

import { GRID_MASK, MATRIX_MAP_STEPS } from './main-matrix-objects.mjs';
import {
  MATRIX_BLINK,
  MATRIX_DIRECTION,
  MATRIX_IC_COUNTED,
  MATRIX_OBJECT_FLAGS,
  MATRIX_OBJECT_SHOWN,
  MATRIX_PERSONA_X,
  MATRIX_PERSONA_Y,
  MATRIX_SPEED_X,
  MATRIX_SPEED_Y,
  MATRIX_STATE,
  MATRIX_STATE_CLOCK,
  MATRIX_STATE_CONTROL,
  MATRIX_STATE_FRAMES,
  MATRIX_STATE_HIT,
  MATRIX_STATE_TRACK,
  MATRIX_STATE_TURN_LEFT,
  MATRIX_STATE_TURN_RIGHT,
  MATRIX_TURN_TARGET,
  PAD_DIRECTIONS,
  PAD_HELD,
  RANDOM_STATE,
  WRAM,
} from '../../src/task/wram.mjs';
import { FLAG_ZERO, FLAG_CARRY, FLAG_NEGATIVE } from '../../src/constants/cpu-flags.mjs';
import { BANK_MASK, BYTE_BITS, WORD_MASK } from '../../src/constants/bits.mjs';
// Matrix movement of main-matrix-control.mjs: direction (81:BA93), track (81:BC09)
// and state (81:BD52) dispatch through their original word tables.

// Bank 81 tables (meanings in src/data/tables.mjs): the calls by pad direction, by heading
// and by state, the speeds (step and fast), the animation lists for moving and facing,
// and the map values and new headings of a path.
const MATRIX_DIRECTION_CALLS = 0x81bb56,
  MATRIX_TRACK_CALLS = 0x81bc1b,
  MATRIX_STATE_CALLS = 0x81bd56,
  MATRIX_STEP_X = 0x81bb96,
  MATRIX_STEP_Y = 0x81bba6,
  MATRIX_FAST_X = 0x81bbb6,
  MATRIX_FAST_Y = 0x81bbc6,
  MATRIX_MOVE_PICTURES = 0x81bbd6,
  MATRIX_FACE_PICTURES = 0x81bbe6,
  MATRIX_TRACK_STOP = 0x81bc73,
  MATRIX_TRACK_TURN1 = 0x81bc83,
  MATRIX_TRACK_TURN2 = 0x81bc93,
  MATRIX_TRACK_TURN1_DIRECTION = 0x81bca3,
  MATRIX_TRACK_TURN2_DIRECTION = 0x81bcb3;
// Headings (MATRIX_DIRECTION): four main directions 4 apart, the half turns between them
// odd; 16 pad nibbles of two bytes each. A turn over 8 or more goes anticlockwise.
const DIRECTION_UP = 0,
  DIRECTION_RIGHT = 4,
  DIRECTION_DOWN = 8,
  DIRECTION_LEFT = 12,
  DIRECTION_TURN_BITS = 3,
  DIRECTION_MASK = 0xf,
  DIRECTION_HALF_TURN = 8,
  DIRECTION_CALL_LAST = 30;
// A turn steps every 5 frames.
const TURN_STEP_FRAMES = 5;
// 81:BAAA does not move onto the map values 00, 58 and 10-4F (nodes); 01 and 02 are paths.
const NODE_BLOCKING = 0x58,
  BLOCKING_FIRST = 0x10,
  BLOCKING_END = 0x50;
const dispatch = (h, e, r, pc, table, valid, targets) => {
  const index = h.ctx.x,
    target = (pc & BANK_MASK) | h.read((pc & BANK_MASK) | ((table + index) & WORD_MASK), 2);
  if (!valid(index) || !targets.has(target))
    taskStop('matrix_control_dispatch_frontier', { pc, target, index });
  return h.call(pc, target, () => targets.get(target)(h, e, r));
};
// 81:BA70: return the persona to the control state.
function enterMatrixControlState(h) {
  h.load(MATRIX_STATE_CONTROL);
  h.write(h.abs(MATRIX_STATE), h.ctx.a);
  return h.rts();
}
// 81:BA77: on a grid point, count the IC around and steer the persona by the pad.
function runMatrixControlState(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.load(h.read(h.abs(MATRIX_PERSONA_X)));
  h.load(ctx.a & GRID_MASK);
  if (!(ctx.status & FLAG_ZERO)) return h.rts();
  h.load(h.read(h.abs(MATRIX_PERSONA_Y)));
  h.load(ctx.a & GRID_MASK);
  if (!(ctx.status & FLAG_ZERO)) return h.rts();
  call(0x81ba87, 0x81b959);
  h.load(h.read(h.abs(PAD_HELD)));
  h.xba();
  h.load(ctx.a & (PAD_DIRECTIONS >>> BYTE_BITS));
  h.asl();
  h.index('x', ctx.a);
  dispatch(
    h,
    e,
    r,
    0x81ba93,
    MATRIX_DIRECTION_CALLS & WORD_MASK,
    (i) => i <= DIRECTION_CALL_LAST && (i & 1) === 0,
    directionCalls,
  );
  return h.rts();
}
// 81:BA97: without a pad direction: face the heading, stop and check for IC.
function stopMatrixPersona(h, e, r) {
  const call = routineCaller(h, e, r);
  h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
  h.load(h.read(h.abs(MATRIX_FACE_PICTURES & WORD_MASK) + h.ctx.y));
  call(0x81ba9d, 0x81b8ad);
  h.write(h.abs(MATRIX_SPEED_X), 0);
  h.write(h.abs(MATRIX_SPEED_Y), 0);
  call(0x81baa6, 0x81b9d0);
  return h.rts();
}
// 81:BAAA: turn towards heading Y, or move along it when the map tile there is open.
function moveMatrixPersona(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.cpy(h.read(h.abs(MATRIX_DIRECTION), 2));
  if (!(ctx.status & FLAG_ZERO)) {
    h.write(h.abs(MATRIX_SPEED_X), 0);
    h.write(h.abs(MATRIX_SPEED_Y), 0);
    h.load(TURN_STEP_FRAMES);
    h.write(h.abs(MATRIX_STATE_FRAMES), ctx.a);
    h.write(h.abs(MATRIX_TURN_TARGET), ctx.y, 2);
    h.load(ctx.y);
    setCarry(h, true);
    h.sbc(h.read(h.abs(MATRIX_DIRECTION)));
    h.load(ctx.a & DIRECTION_MASK);
    h.cmp(DIRECTION_HALF_TURN);
    if (ctx.status & FLAG_CARRY) {
      h.load(MATRIX_STATE_TURN_LEFT);
      h.write(h.abs(MATRIX_STATE), ctx.a);
      call(0x81bad1, 0x81b9d0);
    } else {
      h.load(MATRIX_STATE_TURN_RIGHT);
      h.write(h.abs(MATRIX_STATE), ctx.a);
      call(0x81badb, 0x81b9d0);
    }
    return h.rts();
  }
  h.index('x', 0);
  h.load(h.read(h.abs(MATRIX_MAP_STEPS & WORD_MASK) + ctx.y));
  call(0x81bae5, 0x81b69d);
  for (const v of [0, NODE_BLOCKING]) {
    h.cmp(v);
    if (ctx.status & FLAG_ZERO) return stopMatrixPersona(h, e, r);
  }
  h.cmp(BLOCKING_FIRST);
  if (ctx.status & FLAG_CARRY) {
    h.cmp(BLOCKING_END);
    if (!(ctx.status & FLAG_CARRY)) return stopMatrixPersona(h, e, r);
  }
  h.write(h.abs(MATRIX_DIRECTION), ctx.y, 2);
  h.write(h.abs(MATRIX_IC_COUNTED), 0);
  h.load(h.read(h.abs(MATRIX_MOVE_PICTURES & WORD_MASK) + ctx.y));
  call(0x81bb05, 0x81b8ad);
  h.index('x', 0);
  h.load(h.read(h.abs(MATRIX_MAP_STEPS & WORD_MASK) + ctx.y));
  call(0x81bb0e, 0x81b69d);
  h.cmp(1);
  let fast = Boolean(ctx.status & FLAG_ZERO);
  if (!fast) {
    h.cmp(2);
    fast = Boolean(ctx.status & FLAG_ZERO);
  }
  if (fast) {
    h.load(h.read(h.abs(MATRIX_FAST_X & WORD_MASK) + ctx.y));
    h.write(h.abs(MATRIX_SPEED_X), ctx.a);
    h.load(h.read(h.abs(MATRIX_FAST_Y & WORD_MASK) + ctx.y));
    h.write(h.abs(MATRIX_SPEED_Y), ctx.a);
    h.load(MATRIX_STATE_TRACK);
    h.write(h.abs(MATRIX_STATE), ctx.a);
    return h.rts();
  }
  h.load(h.read(h.abs(MATRIX_STEP_X & WORD_MASK) + ctx.y));
  h.write(h.abs(MATRIX_SPEED_X), ctx.a);
  h.load(h.read(h.abs(MATRIX_STEP_Y & WORD_MASK) + ctx.y));
  h.write(h.abs(MATRIX_SPEED_Y), ctx.a);
  call(0x81bb3a, 0x81b9d0);
  return h.rts();
}
// 81:BC2B: set the track speed and moving animation of the heading.
function setTrackSpeed(h, e, r) {
  const call = routineCaller(h, e, r),
    { ctx } = h;
  h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
  h.load(h.read(h.abs(MATRIX_FAST_X & WORD_MASK) + ctx.y));
  h.write(h.abs(MATRIX_SPEED_X), ctx.a);
  h.load(h.read(h.abs(MATRIX_FAST_Y & WORD_MASK) + ctx.y));
  h.write(h.abs(MATRIX_SPEED_Y), ctx.a);
  h.load(h.read(h.abs(MATRIX_MOVE_PICTURES & WORD_MASK) + ctx.y));
  call(0x81bc3d, 0x81b8ad);
  return h.rts();
}
// 81:BC41: compare the map tile under the persona with the track values of heading X: the
// first keeps the heading, a turn value sets its new heading and speed. No match returns carry
// clear, which ends the track.
function checkTrackTile(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.load(ctx.x);
  h.index('y', ctx.a);
  h.index('x', 0);
  h.load(0);
  call(0x81bc49, 0x81b69d);
  h.cmp(h.read(h.abs(MATRIX_TRACK_STOP & WORD_MASK) + ctx.y));
  if (ctx.status & FLAG_ZERO) {
    setCarry(h, true);
    return h.rts();
  }
  h.cmp(h.read(h.abs(MATRIX_TRACK_TURN1 & WORD_MASK) + ctx.y));
  if (ctx.status & FLAG_ZERO) {
    h.load(h.read(h.abs(MATRIX_TRACK_TURN1_DIRECTION & WORD_MASK) + ctx.y));
    h.write(h.abs(MATRIX_DIRECTION), ctx.a);
    h.call(0x81bc5c, 0x81bc2b, () => setTrackSpeed(h, e, r));
    setCarry(h, true);
    return h.rts();
  }
  h.cmp(h.read(h.abs(MATRIX_TRACK_TURN2 & WORD_MASK) + ctx.y));
  if (!(ctx.status & FLAG_ZERO)) {
    setCarry(h, false);
    return h.rts();
  }
  h.load(h.read(h.abs(MATRIX_TRACK_TURN2_DIRECTION & WORD_MASK) + ctx.y));
  h.write(h.abs(MATRIX_DIRECTION), ctx.a);
  h.call(0x81bc6c, 0x81bc2b, () => setTrackSpeed(h, e, r));
  setCarry(h, true);
  return h.rts();
}
// 81:BBF6: on a grid point, follow the track or stop and return to control.
function runMatrixTrackState(h, e, r) {
  const { ctx } = h;
  h.load(h.read(h.abs(MATRIX_PERSONA_X)));
  h.load(ctx.a & GRID_MASK);
  if (!(ctx.status & FLAG_ZERO)) return h.rts();
  h.load(h.read(h.abs(MATRIX_PERSONA_Y)));
  h.load(ctx.a & GRID_MASK);
  if (!(ctx.status & FLAG_ZERO)) return h.rts();
  h.index('x', h.read(h.abs(MATRIX_DIRECTION), 2));
  dispatch(
    h,
    e,
    r,
    0x81bc09,
    MATRIX_TRACK_CALLS & WORD_MASK,
    (i) => i <= DIRECTION_LEFT && (i & DIRECTION_TURN_BITS) === 0,
    trackCalls,
  );
  if (!(ctx.status & FLAG_CARRY)) {
    h.write(h.abs(MATRIX_SPEED_X), 0);
    h.write(h.abs(MATRIX_SPEED_Y), 0);
    h.load(MATRIX_STATE_CONTROL);
    h.write(h.abs(MATRIX_STATE), ctx.a);
  }
  return h.rts();
}
function rotate(h, e, r, increment) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.load(h.read(h.abs(MATRIX_DIRECTION)));
  h.cmp(h.read(h.abs(MATRIX_TURN_TARGET)));
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(ctx.a + (increment ? 1 : -1));
    h.load(ctx.a + (increment ? 1 : -1));
    h.load(ctx.a & DIRECTION_MASK);
    h.write(h.abs(MATRIX_DIRECTION), ctx.a);
    h.index('y', ctx.a);
    h.load(h.read(h.abs(MATRIX_FACE_PICTURES & WORD_MASK) + ctx.y));
    call(increment ? 0x81bcd7 : 0x81bcfc, 0x81b8ad);
    return h.rts();
  }
  h.load(MATRIX_STATE_CONTROL);
  h.write(h.abs(MATRIX_STATE), ctx.a);
  h.load(1);
  h.write(h.abs(MATRIX_STATE_FRAMES), ctx.a);
  return h.rts();
}
// 81:BD0D: blink the hit persona until the blink count runs out.
function runMatrixHitState(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.index('y', h.read(h.abs(MATRIX_DIRECTION), 2));
  h.load(h.read(h.abs(MATRIX_FACE_PICTURES & WORD_MASK) + ctx.y));
  call(0x81bd13, 0x81b8ad);
  h.load(h.read(WRAM + RANDOM_STATE));
  h.load(ctx.a & 1);
  if (!(ctx.status & FLAG_ZERO)) return h.rts();
  h.modify(h.abs(MATRIX_BLINK), 'dec');
  if (!(ctx.status & FLAG_NEGATIVE)) {
    h.load(h.read(h.abs(MATRIX_OBJECT_FLAGS)));
    h.load(ctx.a ^ MATRIX_OBJECT_SHOWN);
    h.write(h.abs(MATRIX_OBJECT_FLAGS), ctx.a);
    return h.rts();
  }
  h.load(MATRIX_STATE_CONTROL);
  h.write(h.abs(MATRIX_STATE), ctx.a);
  h.load(h.read(h.abs(MATRIX_OBJECT_FLAGS)));
  h.load(ctx.a | MATRIX_OBJECT_SHOWN);
  h.write(h.abs(MATRIX_OBJECT_FLAGS), ctx.a);
  h.load(1);
  h.write(h.abs(MATRIX_STATE_FRAMES), ctx.a);
  return h.rts();
}
export const directionCalls = new Map([
  [0x81ba97, stopMatrixPersona],
  ...[
    [0x81bb3e, DIRECTION_LEFT],
    [0x81bb44, DIRECTION_RIGHT],
    [0x81bb4a, DIRECTION_UP],
    [0x81bb50, DIRECTION_DOWN],
  ].map(([t, y]) => [
    t,
    (h, e, r) => {
      h.index('y', y);
      return moveMatrixPersona(h, e, r);
    },
  ]),
]);
export const stateCalls = new Map([
  [0x81ba70, enterMatrixControlState],
  [0x81ba77, runMatrixControlState],
  [0x81bbf6, runMatrixTrackState],
  [0x81bcc3, (h, e, r) => rotate(h, e, r, true)],
  [0x81bce8, (h, e, r) => rotate(h, e, r, false)],
  [0x81bd0d, runMatrixHitState],
]);
export const trackCalls = new Map([[0x81bc41, checkTrackTile]]);
// 81:BD44: when the state clock runs out, run the call of the matrix state (table BD52).
export function stepMatrixState(h, e, r) {
  h.modify(h.abs(MATRIX_STATE_CLOCK), 'dec');
  if (h.ctx.status & FLAG_ZERO) {
    h.load(h.read(h.abs(MATRIX_STATE_FRAMES)));
    h.write(h.abs(MATRIX_STATE_CLOCK), h.ctx.a);
    h.index('x', h.read(h.abs(MATRIX_STATE), 2));
    dispatch(
      h,
      e,
      r,
      0x81bd52,
      MATRIX_STATE_CALLS & WORD_MASK,
      (i) => i <= MATRIX_STATE_HIT && (i & 1) === 0,
      stateCalls,
    );
  }
  return h.rts();
}
