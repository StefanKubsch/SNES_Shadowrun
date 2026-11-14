// An object's movement in the motion pass (lifted from 80:AB26; register-level
// reference runObjectMove in src/task/main-loop-motion.mjs).
//
// An object with a motion target (7E:40E0) first turns its velocity towards it (80:C9E0,
// still register-level, through its frame). Then its blocked flag (0008) is cleared and
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
// The direct page word 6B holds the old coordinate as in the original. A, X, Y and the
// flags are left as the original leaves them: X the slot (as the callees leave it), Y
// as the callees leave it, A the diagonal with the flags of its addition and shift.
import { taskStop } from '../task/plan.mjs';
import {
  searchHeightCells,
  searchLowerXEdge,
  searchLowerYEdge,
  searchUpperXEdge,
  searchUpperYEdge,
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
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

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
// Original call sites: the turn towards the target (register-level) and the tests.
const TARGET_CALL = 0xab2c,
  TARGET_TARGET = 0x80c9e0,
  HEIGHT_CALL = 0xac16,
  HEIGHT_TARGET = 0x8082bc;
// Each axis: position, velocity and the edge tests towards higher and lower values.
const AXES = [
  {
    position: OBJECT_X,
    velocity: OBJECT_VELOCITY_X,
    upper: [0xab53, 0x8080b2, searchUpperXEdge],
    lower: [0xab6a, 0x808133, searchLowerXEdge],
  },
  {
    position: OBJECT_Y,
    velocity: OBJECT_VELOCITY_Y,
    upper: [0xabaa, 0x8081b4, searchUpperYEdge],
    lower: [0xabc1, 0x808238, searchLowerYEdge],
  },
];

const word = (wram, at) => wram[at % WRAM_SIZE] | (wram[(at + 1) % WRAM_SIZE] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at % WRAM_SIZE] = value & BYTE_MASK;
  wram[(at + 1) % WRAM_SIZE] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};

// Move the object in X (80:AB26) on the access h of the motion pass; routines holds the
// register-level turn towards the target.
export function moveObject(h, events, routines) {
  const { ctx } = h,
    { wram } = h.a.mem;
  const target = word(wram, MOTION_ACTIVE + ctx.x);
  if (target) {
    ctx.a = target;
    flag(ctx, FLAG_NEGATIVE, target & WORD_SIGN);
    flag(ctx, FLAG_ZERO, false);
    h.call(TARGET_CALL, TARGET_TARGET, () => routines.get(TARGET_TARGET)(h, events));
  }
  // The fields are read in the caller's data bank 80, which reaches WRAM below 2000.
  const slot = ctx.x,
    at = (base) => {
      if (base + slot + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { base, slot });
      return base + slot;
    },
    get = (base) => word(wram, at(base)),
    put = (base, value) => setWord(wram, at(base), value);
  // A test through its frame; true when it found no height (carry set), with the height.
  const test = ([call, address, run]) => {
    h.call(call, address, () => run(h));
    return { free: (ctx.status & FLAG_CARRY) !== 0, height: ctx.a };
  };
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
    if (get(OBJECT_FLAGS) & OBJECT_COLLIDES)
      reached = test([HEIGHT_CALL, HEIGHT_TARGET, searchHeightCells]).free;
  }
  if (!reached) {
    put(OBJECT_HEIGHT, height);
    put(OBJECT_VELOCITY_Z, 0);
  }
  // CLC, x + y, LSR: the carry out of the addition is lost, the shift's carry stays.
  const x = get(OBJECT_X),
    y = get(OBJECT_Y),
    total = (y + x) & WORD_MASK,
    diagonal = total >>> 1;
  put(OBJECT_DIAGONAL, diagonal);
  ctx.a = diagonal;
  flag(ctx, FLAG_NEGATIVE, false);
  flag(ctx, FLAG_ZERO, diagonal === 0);
  flag(ctx, FLAG_CARRY, total & 1);
  flag(ctx, FLAG_OVERFLOW, (~(y ^ x) & (y ^ total) & WORD_SIGN) !== 0);
  return h.rts();
}
