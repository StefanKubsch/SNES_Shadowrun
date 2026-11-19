// An object's movement in the motion pass (lifted from 80:AB26; register-level
// reference runObjectMove in proof/replay/main-loop-motion.mjs).
//
// An object with a motion target (7E:40E0) first turns its velocity towards it (80:C9E0,
// composed directly through its frame). Then its blocked flag (0008) is cleared and
// it moves along x and then along y by its velocity. An object that collides (flag 0040)
// tests the edge it moves towards (src/game/object-collision.mjs): a negative velocity
// (a large word) carries the addition, so the carry picks the lower edge. Where the edge offers a height, a height below 5 is climbed (the height rises by
// 4 units for each, and the vertical velocity stops); a higher one blocks the object,
// which moves back to its old coordinate and gets the blocked flag. A falling object
// (flag 0020) then loses one unit of vertical velocity and moves by it. A height below
// 0100 is not reached: the object stays at its old height and stops falling; so does a
// colliding object whose cells offer a height at the new one. Last, the diagonal
// (x + y) / 2 the depth sort uses is updated.
//
// The direct page word 6B holds the old coordinate as in the original. Registers (user
// decision 2026-11-17): game state only; the slot is a parameter, the collision tests
// return their heights, and the routine leaves no A, X, Y or flags.
import { taskStop } from '../system/task-stop.mjs';
import { walkTowardsTarget } from './object-target.mjs';
import {
  heightCells,
  lowerXEdge,
  lowerYEdge,
  upperXEdge,
  upperYEdge,
} from './object-collision.mjs';
import {
  MOTION_ACTIVE,
  OBJECT_BLOCKED,
  OBJECT_COLLIDES,
  OBJECT_DIAGONAL,
  OBJECT_FALLS,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_VELOCITY_Z,
  OBJECT_X,
  OBJECT_Y,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';

// A blocking height below 5 is climbed, each unit 4 height units up; a height below
// 0100 is never reached.
const STEP_LIMIT = 5,
  STEP_HEIGHT = 4,
  FALL_FLOOR = 0x100,
  FALL_STEP = 1,
  LOW_WRAM_END = 0x2000,
  WRAM_SIZE = 0x20000;
// The direct page word with the old coordinate.
const DP_OLD = 0x6b;
// Each axis: position, velocity and the edge tests towards higher and lower values.
const AXES = [
  {
    position: OBJECT_X,
    velocity: OBJECT_VELOCITY_X,
    upper: upperXEdge,
    lower: lowerXEdge,
  },
  {
    position: OBJECT_Y,
    velocity: OBJECT_VELOCITY_Y,
    upper: upperYEdge,
    lower: lowerYEdge,
  },
];

const word = (wram, at) => wram[at % WRAM_SIZE] | (wram[(at + 1) % WRAM_SIZE] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at % WRAM_SIZE] = value & BYTE_MASK;
  wram[(at + 1) % WRAM_SIZE] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Move the object in slot (80:AB26) with its actual walk towards the target; a is the
// accessor of the tasks the walk sends its arrival to.
export function moveObject(wram, a, slot) {
  if (word(wram, MOTION_ACTIVE + slot)) walkTowardsTarget(a, slot);
  // The fields are read in the caller's data bank 80, which reaches WRAM below 2000.
  const at = (base) => {
      if (base + slot + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { base, slot });
      return base + slot;
    },
    get = (base) => word(wram, at(base)),
    put = (base, value) => setWord(wram, at(base), value);
  // A test: whether it found no height, and the height.
  const test = (run) => run(wram, slot);
  put(OBJECT_FLAGS, get(OBJECT_FLAGS) & ~OBJECT_BLOCKED);
  for (const axis of AXES) {
    const old = get(axis.position),
      velocity = get(axis.velocity);
    setWord(wram, DP_OLD, old);
    if (!velocity) continue;
    const sum = old + velocity;
    put(axis.position, sum);
    if (!(get(OBJECT_FLAGS) & OBJECT_COLLIDES)) continue;
    const found = test(sum > WORD_MASK ? axis.lower : axis.upper);
    if (found.free) continue;
    if (found.height < STEP_LIMIT) {
      put(OBJECT_HEIGHT, get(OBJECT_HEIGHT) + found.height * STEP_HEIGHT);
      put(OBJECT_VELOCITY_Z, 0);
    } else {
      put(axis.position, old);
      put(OBJECT_FLAGS, get(OBJECT_FLAGS) | OBJECT_BLOCKED);
    }
  }
  if (get(OBJECT_FLAGS) & OBJECT_FALLS) put(OBJECT_VELOCITY_Z, get(OBJECT_VELOCITY_Z) - FALL_STEP);
  const height = get(OBJECT_HEIGHT),
    next = (height + get(OBJECT_VELOCITY_Z)) & WORD_MASK;
  setWord(wram, DP_OLD, height);
  let reached = next >= FALL_FLOOR;
  if (reached && next !== height) {
    put(OBJECT_HEIGHT, next);
    if (get(OBJECT_FLAGS) & OBJECT_COLLIDES) reached = test(heightCells).free;
  }
  if (!reached) {
    put(OBJECT_HEIGHT, height);
    put(OBJECT_VELOCITY_Z, 0);
  }
  // CLC, x + y, LSR: the carry out of the addition is lost.
  put(OBJECT_DIAGONAL, ((get(OBJECT_Y) + get(OBJECT_X)) & WORD_MASK) >>> 1);
}
