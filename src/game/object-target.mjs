// An object's walk towards its motion target (lifted from 80:C9E0 with the two ways
// 80:C84D and 80:C913 and the distance 80:C80C; register-level reference
// moveObjectTowardsTarget in src/task/main-motion-target.mjs).
//
// An object with a motion target counts its frames to the next step down
// (7E:40E0). At 0 it measures the distance to the target: the point 7E:4190/41E8, or,
// when the target x is 0, the object whose slot 7E:41E8 holds. Below a distance sum of
// 10 the object has arrived: it stops, and the task it belongs to (or the parent its
// waiting child hands on to) gets the event 4. Otherwise it picks one of eight
// directions, turns to it (80:AAAF, lifted in object-turn.mjs, through its frame) and
// takes that direction's
// steps as its velocity; the steps come from table a, or table b when its selection
// is 2 (src/data/tables.mjs, motion_x/y_a and _b), read in the caller's data bank 80
// as in the original.
//
// With bit 0 of the mode word 7E:4138, the object walks axis by axis: on its preferred
// axis (y with bit 1, else x) until that axis is nearer than 12, which flips the
// preference, and after being blocked one step on the other axis with a pause of 1E
// frames. Without it, it walks straight: the axis whose distance is at least twice the
// other's, or else the diagonal; a direction that differs from the one noted in the
// mode word (direction * 4 + 2) is noted first, without a turn. The next step comes
// after two frames.
//
// The direct page words of the original are written: the distances A2 and A5, the
// negative differences A8 and AB (0 when not negative), and the turn's object 00 and
// direction 02; the direction is pushed around the turn as in the original. A, X, Y
// and the flags are left as the original leaves them; the turn's X and overflow carry
// on as in the original.
import { taskStop } from '../task/plan.mjs';
import { turnObjectRoutine } from './object-turn.mjs';
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
} from '../task/wram.mjs';
import { TASK_EVENTS, TASK_PREVIOUS, TASK_WAIT } from '../vm/layout.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const LOW_WRAM_END = 0x2000,
  WRAM_SIZE = 0x20000;
// Mode bits: axis by axis, y preferred; the noted direction above them.
const MODE_AXES = 1,
  MODE_Y_FIRST = 2,
  MODE_DIRECTION_SHIFT = 2,
  MODE_NOTED = 2;
// Frames to the next step, normally and after being blocked.
const STEP_DELAY = 2,
  BLOCKED_DELAY = 0x1e;
const ARRIVAL_DISTANCE = 0x10,
  AXIS_SWITCH_DISTANCE = 12,
  MOTION_END_EVENT = 4;
// The eight directions (0 is y plus).
const Y_PLUS = 0,
  X_PLUS_Y_PLUS = 1,
  X_PLUS = 2,
  X_PLUS_Y_MINUS = 3,
  Y_MINUS = 4,
  X_MINUS_Y_MINUS = 5,
  X_MINUS = 6,
  X_MINUS_Y_PLUS = 7;
// The step tables (src/data/tables.mjs): a, or b when the selection is 2.
const STEPS_X_A = 0xc7cc,
  STEPS_Y_A = 0xc7dc,
  STEPS_X_B = 0xc7ec,
  STEPS_Y_B = 0xc7fc,
  SELECTION_STEPS_B = 2;
// Direct page locals of the original.
const DP_OBJECT = 0,
  DP_DIRECTION = 2,
  DP_DISTANCE_X = 0xa2,
  DP_DISTANCE_Y = 0xa5,
  DP_X_NEGATIVE = 0xa8,
  DP_Y_NEGATIVE = 0xab;
// Original call sites: the two ways, the distance and the turns.
const AXES_CALL = 0x80c9e9,
  AXES_TARGET = 0x80c84d,
  DIRECT_CALL = 0x80c9ed,
  DIRECT_TARGET = 0x80c913,
  AXES_DISTANCE_CALL = 0x80c858,
  DIRECT_DISTANCE_CALL = 0x80c91f,
  DISTANCE_TARGET = 0x80c80c,
  AXES_TURN_CALL = 0x80c8a6,
  DIRECT_TURN_CALL = 0x80c990,
  TURN_TARGET = 0x80aaaf;

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

// Walk the object in X towards its target (80:C9E0, called with JSR); action is the
// turn 80:AAAF, which ends with its own RTS.
export function walkTowardsTarget(h, action = turnObjectRoutine) {
  const { ctx } = h,
    { wram } = h.a.mem;
  // Fields in the caller's data bank 80 (WRAM below 2000); the motion fields are long.
  const low = (base, index) => {
    if (base + index + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { base, index });
    return base + index;
  };
  const get = (base, index = ctx.x) => word(wram, low(base, index)),
    put = (base, value) => setWord(wram, low(base, ctx.x), value),
    far = (base) => word(wram, base + ctx.x),
    setFar = (base, value) => setWord(wram, base + ctx.x, value);

  // The frames to the next step; true when it is due.
  const due = () => {
    const left = (far(MOTION_ACTIVE) - 1) & WORD_MASK;
    setFar(MOTION_ACTIVE, left);
    ctx.a = left;
    signAndZero(ctx, left);
    return left === 0;
  };
  // The distances to the target (80:C80C); returns their sum with the sign, zero and
  // overflow of the ADC (its carry is replaced by the comparison with 10).
  const distance = (call) => {
    let sum;
    h.call(call, DISTANCE_TARGET, () => {
      setWord(wram, DP_X_NEGATIVE, 0);
      setWord(wram, DP_Y_NEGATIVE, 0);
      const toPoint = far(MOTION_X) !== 0;
      let targetX, targetY;
      if (toPoint) {
        targetX = far(MOTION_X);
        targetY = far(MOTION_Y);
      } else {
        // The original indexes the object with Y, which is set again before it leaves.
        const object = far(MOTION_Y);
        targetX = get(OBJECT_X, object);
        targetY = get(OBJECT_Y, object);
      }
      const measure = (target, own, negative) => {
        const difference = (target - own) & WORD_MASK;
        if (!(difference & WORD_SIGN)) return difference;
        setWord(wram, negative, difference);
        return -difference & WORD_MASK;
      };
      const dx = measure(targetX, get(OBJECT_X), DP_X_NEGATIVE),
        dy = measure(targetY, get(OBJECT_Y), DP_Y_NEGATIVE);
      setWord(wram, DP_DISTANCE_X, dx);
      setWord(wram, DP_DISTANCE_Y, dy);
      sum = (dy + dx) & WORD_MASK;
      ctx.a = sum;
      signAndZero(ctx, sum);
      flag(ctx, FLAG_OVERFLOW, (~(dy ^ dx) & (dy ^ sum) & WORD_SIGN) !== 0);
      return h.rts();
    });
    return sum;
  };
  // Arrived: stop and send the event to the waiting task of the object's task chain.
  const arrive = () => {
    flag(ctx, FLAG_CARRY, false);
    put(OBJECT_VELOCITY_X, 0);
    put(OBJECT_VELOCITY_Y, 0);
    let task = get(OBJECT_TASK);
    ctx.y = task;
    signAndZero(ctx, task);
    if (task & WORD_SIGN) return h.rts();
    while (get(TASK_WAIT, task) & WORD_SIGN) task = get(TASK_PREVIOUS, task);
    const events = get(TASK_EVENTS, task) | MOTION_END_EVENT;
    setWord(wram, low(TASK_EVENTS, task), events);
    ctx.y = task;
    ctx.a = events;
    signAndZero(ctx, events);
    return h.rts();
  };
  // Note the turn's object and direction, push the direction and run the turn unless
  // skipped; then pull the direction and take its steps as the velocity.
  const turnAndStep = (direction, turnCall, turn = true) => {
    setWord(wram, DP_OBJECT, ctx.x);
    setWord(wram, DP_DIRECTION, direction);
    h.a.pushWord(direction);
    return (noted) => {
      if (turn) h.call(turnCall, TURN_TARGET, () => action(h));
      if (noted !== undefined) noted();
      const pulled = h.a.pullWord(),
        offset = (pulled << 1) & WORD_MASK,
        selection = get(OBJECT_SELECTION),
        tables = selection === SELECTION_STEPS_B ? [STEPS_X_B, STEPS_Y_B] : [STEPS_X_A, STEPS_Y_A],
        // CMP #2: the carry when the selection is 2 or more.
        steps = tables.map((table) => h.read(h.abs(table) + offset, 2));
      put(OBJECT_VELOCITY_X, steps[0]);
      put(OBJECT_VELOCITY_Y, steps[1]);
      ctx.y = offset;
      ctx.a = steps[1];
      signAndZero(ctx, steps[1]);
      flag(ctx, FLAG_CARRY, selection >= SELECTION_STEPS_B);
    };
  };

  // 80:C84D: axis by axis.
  const walkAxes = () => {
    if (!due()) return h.rts();
    if (distance(AXES_DISTANCE_CALL) < ARRIVAL_DISTANCE) return arrive();
    let yAxis;
    if (get(OBJECT_FLAGS) & OBJECT_BLOCKED) {
      setFar(MOTION_ACTIVE, BLOCKED_DELAY);
      yAxis = !(far(MOTION_MODE) & MODE_Y_FIRST);
    } else {
      setFar(MOTION_ACTIVE, STEP_DELAY);
      yAxis = (far(MOTION_MODE) & MODE_Y_FIRST) !== 0;
      if (word(wram, yAxis ? DP_DISTANCE_Y : DP_DISTANCE_X) < AXIS_SWITCH_DISTANCE) {
        const mode = far(MOTION_MODE) ^ MODE_Y_FIRST;
        setFar(MOTION_MODE, mode);
        yAxis = (mode & MODE_Y_FIRST) !== 0;
      }
    }
    const negative = word(wram, yAxis ? DP_Y_NEGATIVE : DP_X_NEGATIVE) !== 0,
      direction = yAxis ? (negative ? Y_MINUS : Y_PLUS) : negative ? X_MINUS : X_PLUS;
    turnAndStep(direction, AXES_TURN_CALL)();
    return h.rts();
  };

  // 80:C913: straight, in eight directions.
  const walkDirect = () => {
    if (!due()) return h.rts();
    if (distance(DIRECT_DISTANCE_CALL) < ARRIVAL_DISTANCE) return arrive();
    const dx = word(wram, DP_DISTANCE_X),
      dy = word(wram, DP_DISTANCE_Y),
      xNegative = word(wram, DP_X_NEGATIVE) !== 0,
      yNegative = word(wram, DP_Y_NEGATIVE) !== 0;
    let direction;
    if (dy >>> 1 >= dx) direction = yNegative ? Y_MINUS : Y_PLUS;
    else if (dx >>> 1 >= dy) direction = xNegative ? X_MINUS : X_PLUS;
    else if (xNegative) direction = yNegative ? X_MINUS_Y_MINUS : X_MINUS_Y_PLUS;
    else direction = yNegative ? X_PLUS_Y_MINUS : X_PLUS_Y_PLUS;
    const mode = far(MOTION_MODE),
      changed = mode !== 0 && mode >>> MODE_DIRECTION_SHIFT !== direction;
    const rest = turnAndStep(direction, DIRECT_TURN_CALL, !changed);
    if (mode === 0 || changed)
      setFar(MOTION_MODE, ((direction << MODE_DIRECTION_SHIFT) | MODE_NOTED) & WORD_MASK);
    rest();
    setFar(MOTION_ACTIVE, STEP_DELAY);
    ctx.a = STEP_DELAY;
    signAndZero(ctx, STEP_DELAY);
    return h.rts();
  };

  if (far(MOTION_MODE) & MODE_AXES) h.call(AXES_CALL, AXES_TARGET, walkAxes);
  else h.call(DIRECT_CALL, DIRECT_TARGET, walkDirect);
  return h.rts();
}
