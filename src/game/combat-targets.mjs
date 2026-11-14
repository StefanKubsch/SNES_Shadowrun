// Targets in a fight by line of sight (lifted from the script natives 80:8BC5, 80:8C08,
// 80:8C8D and 80:8CCF; register-level references in
// proof/game-reference/enemy-target-choice.mjs and src/task/native-combat.mjs). The natives'
// bridges are in src/task/native-script-leaves.mjs.
//
// Only an object on screen looks for a target. An object marked as no target is never
// taken; the line of sight (src/game/line-of-sight.mjs) from the looking object to the
// candidate decides. The group's slots (the runners' objects) and the fight list hold
// object indices as words, each with the index of its last entry.
import { lineOfSight } from './line-of-sight.mjs';
import { randomBelow } from '../system/random.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import {
  FIGHT_LIST,
  FIGHT_LIST_INDEX,
  GROUP_INDEX,
  GROUP_LEADER_ONLY,
  GROUP_SLOTS,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_NO_TARGET,
  OBJECT_ON_SCREEN,
  OBJECT_X,
  OBJECT_Y,
} from '../task/wram.mjs';
import { BYTE_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// No target: the result word FFFF.
export const NO_TARGET = WORD_MASK;

// The object fields, the fight list and the group's slots are read through the data
// bank 80 as the original does (src/system/data-bank.mjs): an object index FFFF (none),
// which scripts pass on, reads the WRAM word below the field.
const flags = (mem, object) => dataBankWord(mem, OBJECT_FLAGS, object);
const onScreen = (mem, object) => (flags(mem, object) & OBJECT_ON_SCREEN) !== 0;
const isNoTarget = (mem, object) => (flags(mem, object) & OBJECT_NO_TARGET) !== 0;
const fightListEntry = (mem, index) => dataBankWord(mem, FIGHT_LIST, index);
const groupSlot = (mem, index) => dataBankWord(mem, GROUP_SLOTS, index);
const wramWord = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const negative = (index) => (index & WORD_SIGN) !== 0;
const sees = (mem, port, viewer, target) => !lineOfSight(mem, port, viewer, target).blocked;

// A random entry of a word list whose last index is lastIndex: a number below
// lastIndex / 2 + 1, doubled. Returns the index and the range drawn from.
function randomEntry(mem, port, lastIndex) {
  const range = (lastIndex >>> 1) + 1;
  return { index: (randomBelow(mem, port, range) << 1) & WORD_MASK, range };
}

// 80:8BC5: an enemy's target, a random member of the group (only the first while the
// group's leader goes alone) if the enemy sees it. Returns { target, range }: the
// target or NO_TARGET, and the random range or null without a draw.
export function chooseEnemyTarget(mem, port, enemy) {
  const { wram } = mem;
  if (!onScreen(mem, enemy)) return { target: NO_TARGET, range: null };
  let index = 0,
    range = null;
  if (wramWord(wram, GROUP_LEADER_ONLY) === 0)
    ({ index, range } = randomEntry(mem, port, wramWord(wram, GROUP_INDEX)));
  const member = groupSlot(mem, index);
  if (isNoTarget(mem, member) || !sees(mem, port, enemy, member))
    return { target: NO_TARGET, range };
  return { target: member, range };
}

// The distance of two objects as the sum of their axis distances in 16 bits. Returns
// the sum and the partial sum of x and y, which the original keeps.
function axisDistance(mem, from, to) {
  const axis = (offset) => {
    const a = dataBankWord(mem, offset, to),
      b = dataBankWord(mem, offset, from);
    return a >= b ? a - b : b - a;
  };
  const plane = (axis(OBJECT_X) + axis(OBJECT_Y)) & WORD_MASK;
  return { distance: (plane + axis(OBJECT_HEIGHT)) & WORD_MASK, plane };
}

// 80:8C08: the nearest group member the object sees (strictly nearer wins, from the
// last member down; only the first while the leader goes alone). Returns null for an
// object off screen, else { member, distance, lastDistance }: the member or
// NO_TARGET, its distance (FFFF without one) and the original's working distance of
// the last member (its full distance when that was nearer, else its x plus y).
export function findNearestVisibleMember(mem, port, object) {
  const { wram } = mem;
  if (!onScreen(mem, object)) return null;
  let index = wramWord(wram, GROUP_LEADER_ONLY) === 0 ? wramWord(wram, GROUP_INDEX) : 0,
    member = NO_TARGET,
    nearest = WORD_MASK,
    lastDistance;
  do {
    const candidate = groupSlot(mem, index),
      { distance, plane } = axisDistance(mem, object, candidate);
    lastDistance = distance < nearest ? distance : plane;
    if (distance < nearest) {
      if (!isNoTarget(mem, candidate) && sees(mem, port, object, candidate)) {
        member = candidate;
        nearest = distance;
      }
    }
    index = (index - 2) & WORD_MASK;
  } while (!negative(index));
  return { member, distance: nearest, lastDistance };
}

// 80:8C8D: a random entry of the fight list as the object's target, if it is on screen,
// not marked as no target and seen. Returns { target, range } as chooseEnemyTarget.
export function chooseRandomFightTarget(mem, port, object) {
  const { wram } = mem;
  if (!onScreen(mem, object)) return { target: NO_TARGET, range: null };
  const lastIndex = wramWord(wram, FIGHT_LIST_INDEX);
  if (negative(lastIndex)) return { target: NO_TARGET, range: null };
  const { index, range } = randomEntry(mem, port, lastIndex),
    candidate = fightListEntry(mem, index);
  if (isNoTarget(mem, candidate) || !onScreen(mem, candidate)) return { target: NO_TARGET, range };
  return { target: sees(mem, port, object, candidate) ? candidate : NO_TARGET, range };
}

// 80:8CCF: whether attacker can attack target: both on screen, the target not marked
// as no target, in the fight list and seen.
export function canAttack(mem, port, attacker, target) {
  const { wram } = mem;
  if (!onScreen(mem, attacker)) return false;
  if (isNoTarget(mem, target) || !onScreen(mem, target)) return false;
  let index = wramWord(wram, FIGHT_LIST_INDEX);
  if (negative(index)) return false;
  while (fightListEntry(mem, index) !== target) {
    index = (index - 2) & WORD_MASK;
    if (negative(index)) return false;
  }
  return sees(mem, port, attacker, target);
}
