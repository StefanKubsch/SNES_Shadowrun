// An object's walk towards its motion target (lifted from 80:C9E0 with the two ways
// 80:C84D and 80:C913 and the distance 80:C80C; register-level reference
// moveObjectTowardsTarget in proof/replay/main-motion-target.mjs).
//
// An object with a motion target counts its frames to the next step down
// (7E:40E0). At 0 it measures the distance to the target: the point 7E:4190/41E8, or,
// when the target x is 0, the object whose slot 7E:41E8 holds (a "none" slot FFFF reads
// the words below the position fields, as in the original). Below a distance sum of
// 10 the object has arrived: it stops, and the task it belongs to (or the parent its
// waiting child hands on to) gets the event 4. Otherwise it picks one of eight
// directions, turns to it (80:AAAF, lifted in object-turn.mjs, through its frame) and
// takes that direction's
// steps as its velocity; the steps come from table a, or table b when its selection
// is 2 (src/data/tables.mjs, motion_x/y_a and _b), read in bank 80 (the callers' data bank;
// the data bank register itself is not read, user decision 2026-11-17) as in the original.
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
// direction 02. Game state only (user decision 2026-11-17): the slot is a parameter, the
// routine leaves no registers, and its call frames and the pushed direction, which lie
// only in free stack bytes, are not reproduced.
import { dataBankWord } from '../system/data-bank.mjs';
import { turnObject } from './object-turn.mjs';
import { lowObjectWord, objectIndex, objectTable, objectWord } from '../state/objects.mjs';
import { OBJECT_BLOCKED } from '../data/wram.mjs';
import { sendEvents, tasksOf } from '../script/task-api.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const WRAM_SIZE = 0x20000;
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

const word = (wram, at) => wram[at % WRAM_SIZE] | (wram[(at + 1) % WRAM_SIZE] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at % WRAM_SIZE] = value & BYTE_MASK;
  wram[(at + 1) % WRAM_SIZE] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Walk the object in slot towards its target (80:C9E0); a is the accessor of the memory
// and the tasks, turn the turn 80:AAAF of the object in word 00 to the direction in word
// 02.
export function walkTowardsTarget(a, slot, turn = (mem) => turnObject(mem, mem.wram)) {
  const { mem } = a,
    { wram } = mem;
  const objects = objectTable(wram),
    i = objectIndex(slot);

  // The frames to the next step; true when it is due.
  const due = () => {
    return --objects.motionActive[i] === 0;
  };
  // The distances to the target (80:C80C); returns their sum.
  const distance = () => {
    setWord(wram, DP_X_NEGATIVE, 0);
    setWord(wram, DP_Y_NEGATIVE, 0);
    let targetX, targetY;
    if (objects.motionX[i] !== 0) {
      targetX = objects.motionX[i];
      targetY = objects.motionY[i];
    } else {
      // The original indexes the object with Y, which is set again before it leaves.
      // Scripts may pass "none" (FFFF) as the target object: script 18A calls 80:C6F3
      // with the result of native 07 before it tests that result for FF. The index then
      // carries into bank 81 and the original reads the WRAM words just below the
      // fields (src/system/data-bank.mjs); it does not stop.
      const object = objects.motionY[i];
      targetX = objectWord(mem, 'x', object);
      targetY = objectWord(mem, 'y', object);
    }
    const measure = (target, own, negative) => {
      const difference = (target - own) & WORD_MASK;
      if (!(difference & WORD_SIGN)) return difference;
      setWord(wram, negative, difference);
      return -difference & WORD_MASK;
    };
    const dx = measure(targetX, objects.x[i], DP_X_NEGATIVE),
      dy = measure(targetY, objects.y[i], DP_Y_NEGATIVE);
    setWord(wram, DP_DISTANCE_X, dx);
    setWord(wram, DP_DISTANCE_Y, dy);
    return (dy + dx) & WORD_MASK;
  };
  // Arrived: stop and send the event to the waiting task of the object's task chain.
  const arrive = () => {
    objects.velocityX[i] = 0;
    objects.velocityY[i] = 0;
    const task = lowObjectWord(wram, 'task', slot);
    if (!(task & WORD_SIGN)) sendEvents(tasksOf(a), task, MOTION_END_EVENT);
  };
  // Note the turn's object and direction for the turn; after it, take the direction's
  // steps as the velocity.
  const noteTurn = (direction) => {
    setWord(wram, DP_OBJECT, slot);
    setWord(wram, DP_DIRECTION, direction);
  };
  const step = (direction) => {
    const offset = (direction << 1) & WORD_MASK,
      tables =
        lowObjectWord(wram, 'selection', slot) === SELECTION_STEPS_B
          ? [STEPS_X_B, STEPS_Y_B]
          : [STEPS_X_A, STEPS_Y_A],
      steps = tables.map((table) => dataBankWord(mem, table, offset));
    [objects.velocityX[i], objects.velocityY[i]] = steps;
  };

  // 80:C84D: axis by axis.
  const walkAxes = () => {
    if (!due()) return;
    if (distance() < ARRIVAL_DISTANCE) return arrive();
    let yAxis;
    if (objects.flags[i] & OBJECT_BLOCKED) {
      objects.motionActive[i] = BLOCKED_DELAY;
      yAxis = !(objects.motionMode[i] & MODE_Y_FIRST);
    } else {
      objects.motionActive[i] = STEP_DELAY;
      yAxis = (objects.motionMode[i] & MODE_Y_FIRST) !== 0;
      if (word(wram, yAxis ? DP_DISTANCE_Y : DP_DISTANCE_X) < AXIS_SWITCH_DISTANCE) {
        const mode = (objects.motionMode[i] ^= MODE_Y_FIRST);
        yAxis = (mode & MODE_Y_FIRST) !== 0;
      }
    }
    const negative = word(wram, yAxis ? DP_Y_NEGATIVE : DP_X_NEGATIVE) !== 0,
      direction = yAxis ? (negative ? Y_MINUS : Y_PLUS) : negative ? X_MINUS : X_PLUS;
    noteTurn(direction);
    turn(mem);
    step(direction);
  };

  // 80:C913: straight, in eight directions.
  const walkDirect = () => {
    if (!due()) return;
    if (distance() < ARRIVAL_DISTANCE) return arrive();
    const dx = word(wram, DP_DISTANCE_X),
      dy = word(wram, DP_DISTANCE_Y),
      xNegative = word(wram, DP_X_NEGATIVE) !== 0,
      yNegative = word(wram, DP_Y_NEGATIVE) !== 0;
    let direction;
    if (dy >>> 1 >= dx) direction = yNegative ? Y_MINUS : Y_PLUS;
    else if (dx >>> 1 >= dy) direction = xNegative ? X_MINUS : X_PLUS;
    else if (xNegative) direction = yNegative ? X_MINUS_Y_MINUS : X_MINUS_Y_PLUS;
    else direction = yNegative ? X_PLUS_Y_MINUS : X_PLUS_Y_PLUS;
    const mode = objects.motionMode[i],
      changed = mode !== 0 && mode >>> MODE_DIRECTION_SHIFT !== direction;
    noteTurn(direction);
    if (mode === 0 || changed)
      objects.motionMode[i] = (direction << MODE_DIRECTION_SHIFT) | MODE_NOTED;
    if (!changed) turn(mem);
    step(direction);
    objects.motionActive[i] = STEP_DELAY;
  };

  if (objects.motionMode[i] & MODE_AXES) walkAxes();
  else walkDirect();
}
