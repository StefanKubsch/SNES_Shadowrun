// A group member's object added to the scene (lifted from the script native 80:A1E6;
// register-level reference in proof/game-reference/scene-object-add.mjs).
//
// The group's last index (7E:2DE6) grows by one word; the member's entry gets the object
// kind (direct page word 00), the position (word 0C plus word 0C / 8 times the row
// factor, the low byte of 7E:3C05) and the actor entry (word 0A). The object is created
// with the lifted creation 80:A835 with the actor's script (the direction in word 08 is
// kept in word 6B meanwhile) and turned to that direction with the lifted turn 80:AAAF.
// The first member's object becomes the player object and takes the class bits. The
// object gets the actor entry as its number, the depth order from the actor's depth
// flags (bits 6 and 7 to bits 15 and 0), the actor's record, and the armour rating of
// the runner with that number; the group's slot list gets the slot.
//
// Memory is reached as the original reaches it: the group lists, the row factor, the
// armour ratings and the object's armour long in bank 7E, the player object, the object
// fields, the group slots and the runner numbers through the data bank, the actor table
// long in bank 8D. The return words of the calls and the two pushed words lie on the
// stack as in the original. A number no runner has, whose search the original never
// ends, stops at the frontier `runner_number_required` after a full turn of the index.
import { taskStop } from '../task/plan.mjs';
import { createObject } from './object-create.mjs';
import { turnObject } from './object-turn.mjs';
import {
  DP_OBJECT_SCRIPT,
  DP_SCENE_OBJECT_NUMBER,
  DP_SCENE_OBJECT_POSITION,
  DP_SCENE_OBJECT_SCRATCH,
  GROUP_INDEX,
  GROUP_NUMBERS,
  GROUP_OBJECTS,
  GROUP_POSITIONS,
  GROUP_SLOTS,
  OBJECT_ARMOUR,
  OBJECT_CLASS_MASK,
  OBJECT_DEPTH_ORDER,
  OBJECT_FLAGS,
  OBJECT_NUMBER,
  OBJECT_RECORD,
  PLAYER_OBJECT,
  RUNNER_ARMOUR_RATING,
  SCENE_OBJECT_ROW_FACTOR,
  WRAM,
} from '../task/wram.mjs';
import { ACTOR_DEPTH_FLAGS, ACTOR_RECORD, ACTOR_SCRIPT, ACTOR_TABLE } from '../data/actors.mjs';
import { RUNNER_LAST_INDEX, RUNNER_OBJECT_NUMBERS } from '../data/runners.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// The kind and the direction argument (words 00 and 02 of the creation and the turn).
const DP_OBJECT = 0,
  DP_DIRECTION = 2;
// The return words of the JSRs to the creation and the turn.
const CREATE_RETURN = 0xa22f,
  TURN_RETURN = 0xa239;
// The position's coarse step (/ 8) and the runner armour rows (four bytes per runner
// index word).
const POSITION_SHIFT = 3,
  ARMOUR_ROW_SHIFT = 2;
const ENTRY_BYTES = 2,
  INDEX_TURN = (WORD_MASK + 1) / ENTRY_BYTES,
  TOP_BIT = WORD_BITS - 1;

const wramAddress = (offset) => (WRAM + offset) & LONG_MASK;
const wramWord = (mem, offset) => mem.read16(wramAddress(offset));
const setWramWord = (mem, offset, value) => mem.write16(wramAddress(offset), value & WORD_MASK);
const bankAddress = (a, offset) => ((a.ctx.bank << WORD_BITS) + offset) & LONG_MASK;
const bankWord = (a, offset) => a.mem.read16(bankAddress(a, offset));
const setBankWord = (a, offset, value) => a.mem.write16(bankAddress(a, offset), value & WORD_MASK);
const directWord = (mem, offset) => mem.read16Bank0(offset);
const setDirectWord = (mem, offset, value) => mem.write16Bank0(offset, value & WORD_MASK);
const actorWord = (mem, offset) => mem.read16((ACTOR_TABLE + offset) & LONG_MASK);

// 80:A1E6: add the group member's object of the arguments to the scene.
export function addSceneObject(mem, a) {
  const { wram } = mem;
  const index = (wramWord(mem, GROUP_INDEX) + ENTRY_BYTES) & WORD_MASK;
  setWramWord(mem, GROUP_INDEX, index);
  setWramWord(mem, GROUP_OBJECTS + index, directWord(mem, DP_OBJECT));
  // The position plus the coarse position times the row factor (16-bit sums).
  const rows = wramWord(mem, SCENE_OBJECT_ROW_FACTOR) & BYTE_MASK;
  setDirectWord(
    mem,
    DP_SCENE_OBJECT_SCRATCH,
    directWord(mem, DP_SCENE_OBJECT_POSITION) >>> POSITION_SHIFT,
  );
  let position = 0;
  for (let n = rows; n; n--)
    position = (position + directWord(mem, DP_SCENE_OBJECT_SCRATCH)) & WORD_MASK;
  setWramWord(mem, GROUP_POSITIONS + index, position + directWord(mem, DP_SCENE_OBJECT_POSITION));
  const number = directWord(mem, DP_SCENE_OBJECT_NUMBER);
  setWramWord(mem, GROUP_NUMBERS + index, number);
  a.pushWord(number);
  // The creation takes the actor's script; the direction waits in word 6B.
  setDirectWord(mem, DP_SCENE_OBJECT_SCRATCH, directWord(mem, DP_OBJECT_SCRIPT));
  setDirectWord(mem, DP_OBJECT_SCRIPT, actorWord(mem, ACTOR_SCRIPT + number));
  a.pushWord(CREATE_RETURN);
  createObject(mem, wram, a);
  a.pullWord();
  a.pushWord(directWord(mem, DP_OBJECT));
  setDirectWord(mem, DP_DIRECTION, directWord(mem, DP_SCENE_OBJECT_SCRATCH));
  a.pushWord(TURN_RETURN);
  turnObject(mem, wram, a);
  a.pullWord();
  if (wramWord(mem, GROUP_INDEX) === 0) setBankWord(a, PLAYER_OBJECT, directWord(mem, DP_OBJECT));
  const slot = a.pullWord(),
    actor = a.pullWord();
  setBankWord(a, OBJECT_NUMBER + slot, actor);
  // The depth flags (bits 6 and 7) go to the high byte, then rotate left by one.
  const flags = (actorWord(mem, actor) & ACTOR_DEPTH_FLAGS) << BYTE_BITS;
  setBankWord(a, OBJECT_DEPTH_ORDER + slot, (flags << 1) + (flags >>> TOP_BIT));
  setBankWord(a, OBJECT_RECORD + slot, actorWord(mem, ACTOR_RECORD + actor));
  if (wramWord(mem, GROUP_INDEX) === 0)
    setBankWord(a, OBJECT_FLAGS + slot, bankWord(a, OBJECT_FLAGS + slot) | OBJECT_CLASS_MASK);
  setBankWord(a, GROUP_SLOTS + wramWord(mem, GROUP_INDEX), slot);
  // The runner with the object's number, searched from the last one down.
  const objectNumber = bankWord(a, OBJECT_NUMBER + slot);
  let runner = RUNNER_LAST_INDEX;
  for (let step = 0; bankWord(a, RUNNER_OBJECT_NUMBERS + runner) !== objectNumber; step++) {
    if (step === INDEX_TURN) taskStop('runner_number_required', { number: objectNumber });
    runner = (runner - ENTRY_BYTES) & WORD_MASK;
  }
  const rating = wramWord(mem, RUNNER_ARMOUR_RATING + ((runner << ARMOUR_ROW_SHIFT) & WORD_MASK));
  setWramWord(mem, OBJECT_ARMOUR + slot, rating & BYTE_MASK);
}
