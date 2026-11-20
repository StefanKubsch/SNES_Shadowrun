// An object's movement in the motion pass (from 80:AB26; register-level reference
// runObjectMove in proof/replay/main-loop-motion.mjs).
//
// An object with a motion target first turns its velocity towards it. Then its blocked
// flag is cleared and it moves along x and then along y by its velocity. An object that
// collides tests the edge it moves towards (src/game/object-collision.mjs): a negative
// velocity (a large word) carries the addition, so the carry picks the lower edge. Where
// the edge offers a height, a height below 5 is climbed (the height rises by 4 units for
// each, and the vertical velocity stops); a higher one blocks the object, which moves
// back to its old coordinate and gets the blocked flag. A falling object then loses one
// unit of vertical velocity and moves by it. A height below 0100 is not reached: the
// object stays at its old height and stops falling; so does a colliding object whose
// cells offer a height at the new one. Last, the diagonal (x + y) / 2 the depth sort
// uses is updated.
import { walkTowardsTarget } from './object-target.mjs';
import {
  heightCells,
  lowerXEdge,
  lowerYEdge,
  upperXEdge,
  upperYEdge,
} from './object-collision.mjs';
import { objectIndex, objectTable } from '../state/objects.mjs';
import { OBJECT_BLOCKED, OBJECT_COLLIDES, OBJECT_FALLS } from '../data/wram.mjs';
import { WORD_MASK } from '../constants/bits.mjs';

// A blocking height below 5 is climbed, each unit 4 height units up; a height below
// 0100 is never reached.
const STEP_LIMIT = 5,
  STEP_HEIGHT = 4,
  FALL_FLOOR = 0x100,
  FALL_STEP = 1;
// Each axis: position, velocity and the edge tests towards higher and lower values.
const AXES = [
  { position: 'x', velocity: 'velocityX', upper: upperXEdge, lower: lowerXEdge },
  { position: 'y', velocity: 'velocityY', upper: upperYEdge, lower: lowerYEdge },
];

// Move the object in slot (80:AB26) with its actual walk towards the target; a is the
// accessor of the tasks the walk sends its arrival to.
export function moveObject(wram, a, slot) {
  const objects = objectTable(wram),
    i = objectIndex(slot);
  if (objects.motionActive[i]) walkTowardsTarget(a, slot);
  objects.flags[i] &= ~OBJECT_BLOCKED;
  for (const axis of AXES) {
    const position = objects[axis.position],
      old = position[i],
      velocity = objects[axis.velocity][i];
    if (!velocity) continue;
    const sum = old + velocity;
    position[i] = sum;
    if (!(objects.flags[i] & OBJECT_COLLIDES)) continue;
    const found = (sum > WORD_MASK ? axis.lower : axis.upper)(wram, slot);
    if (found.free) continue;
    if (found.height < STEP_LIMIT) {
      objects.height[i] += found.height * STEP_HEIGHT;
      objects.velocityZ[i] = 0;
    } else {
      position[i] = old;
      objects.flags[i] |= OBJECT_BLOCKED;
    }
  }
  if (objects.flags[i] & OBJECT_FALLS) objects.velocityZ[i] -= FALL_STEP;
  const height = objects.height[i],
    next = (height + objects.velocityZ[i]) & WORD_MASK;
  let reached = next >= FALL_FLOOR;
  if (reached && next !== height) {
    objects.height[i] = next;
    if (objects.flags[i] & OBJECT_COLLIDES) reached = heightCells(wram, slot).free;
  }
  if (!reached) {
    objects.height[i] = height;
    objects.velocityZ[i] = 0;
  }
  // CLC, x + y, LSR: the carry out of the addition is lost.
  objects.diagonal[i] = ((objects.y[i] + objects.x[i]) & WORD_MASK) >>> 1;
}
