import { partyState } from '../state/party.mjs';
import { dataBankOf } from '../system/data-bank.mjs';
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
// long in bank 8D. The return words of the calls and the two pushed words lie only in
// free stack bytes and are not reproduced (game state only, user decision 2026-11-17).
// A number no runner has, whose search the original never
// ends, stops at the frontier `runner_number_required` after a full turn of the index.
import { taskStop } from '../system/task-stop.mjs';
import { createObject } from './object-create.mjs';
import { turnObject } from './object-turn.mjs';
import {
  DP_OBJECT_SCRIPT,
  DP_SCENE_OBJECT_NUMBER,
  DP_SCENE_OBJECT_POSITION,
  DP_SCENE_OBJECT_SCRATCH,
  OBJECT_CLASS_MASK,
  PLAYER_OBJECT,
  RUNNER_ARMOUR_RATING,
  SCENE_OBJECT_ROW_FACTOR,
  WRAM,
} from '../data/wram.mjs';
import { ACTOR_DEPTH_FLAGS, ACTOR_RECORD, ACTOR_SCRIPT, ACTOR_TABLE } from '../data/actors.mjs';
import { RUNNER_LAST_INDEX, RUNNER_OBJECT_NUMBERS } from '../data/runners.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import { bankObjectWord, setBankObjectWord, setLongObjectWord } from '../state/objects.mjs';

// The kind and the direction argument (words 00 and 02 of the creation and the turn).
const DP_OBJECT = 0,
  DP_DIRECTION = 2;
// The position's coarse step (/ 8) and the runner armour rows (four bytes per runner
// index word).
const POSITION_SHIFT = 3,
  ARMOUR_ROW_SHIFT = 2;
const ENTRY_BYTES = 2,
  INDEX_TURN = (WORD_MASK + 1) / ENTRY_BYTES,
  TOP_BIT = WORD_BITS - 1;

const wramAddress = (offset) => (WRAM + offset) & LONG_MASK;
const wramWord = (mem, offset) => mem.read16(wramAddress(offset));
const bankAddress = (a, offset) => ((dataBankOf(a) << WORD_BITS) + offset) & LONG_MASK;
const bankWord = (a, offset) => a.mem.read16(bankAddress(a, offset));
const setBankWord = (a, offset, value) => a.mem.write16(bankAddress(a, offset), value & WORD_MASK);
const directWord = (mem, offset) => mem.read16Bank0(offset);
const setDirectWord = (mem, offset, value) => mem.write16Bank0(offset, value & WORD_MASK);
const actorWord = (mem, offset) => mem.read16((ACTOR_TABLE + offset) & LONG_MASK);

// 80:A1E6: add the group member's object of the arguments to the scene.
export function addSceneObject(mem, a) {
  const { wram } = mem;
  const index = (partyState(mem).lastIndex + ENTRY_BYTES) & WORD_MASK;
  partyState(mem).lastIndex = index;
  partyState(mem).member(index / 2).kind = directWord(mem, DP_OBJECT);
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
  partyState(mem).member(index / 2).position = position + directWord(mem, DP_SCENE_OBJECT_POSITION);
  const number = directWord(mem, DP_SCENE_OBJECT_NUMBER);
  partyState(mem).member(index / 2).number = number;
  // The creation takes the actor's script; the direction waits in word 6B.
  setDirectWord(mem, DP_SCENE_OBJECT_SCRATCH, directWord(mem, DP_OBJECT_SCRIPT));
  setDirectWord(mem, DP_OBJECT_SCRIPT, actorWord(mem, ACTOR_SCRIPT + number));
  createObject(mem, wram, a);
  // The original keeps the new slot and the number on the stack over the turn.
  const slot = directWord(mem, DP_OBJECT),
    actor = number;
  setDirectWord(mem, DP_DIRECTION, directWord(mem, DP_SCENE_OBJECT_SCRATCH));
  turnObject(mem, wram);
  if (partyState(mem).lastIndex === 0) setBankWord(a, PLAYER_OBJECT, directWord(mem, DP_OBJECT));
  setBankObjectWord(a, 'number', slot, actor);
  // The depth flags (bits 6 and 7) go to the high byte, then rotate left by one.
  const flags = (actorWord(mem, actor) & ACTOR_DEPTH_FLAGS) << BYTE_BITS;
  setBankObjectWord(a, 'depthOrder', slot, (flags << 1) + (flags >>> TOP_BIT));
  setBankObjectWord(a, 'record', slot, actorWord(mem, ACTOR_RECORD + actor));
  if (partyState(mem).lastIndex === 0)
    setBankObjectWord(a, 'flags', slot, bankObjectWord(a, 'flags', slot) | OBJECT_CLASS_MASK);
  partyState(mem).member(partyState(mem).lastIndex / 2).slot = slot;
  // The runner with the object's number, searched from the last one down.
  const objectNumber = bankObjectWord(a, 'number', slot);
  let runner = RUNNER_LAST_INDEX;
  for (let step = 0; bankWord(a, RUNNER_OBJECT_NUMBERS + runner) !== objectNumber; step++) {
    if (step === INDEX_TURN) taskStop('runner_number_required', { number: objectNumber });
    runner = (runner - ENTRY_BYTES) & WORD_MASK;
  }
  const rating = wramWord(mem, RUNNER_ARMOUR_RATING + ((runner << ARMOUR_ROW_SHIFT) & WORD_MASK));
  setLongObjectWord(mem, 'armour', slot, rating & BYTE_MASK);
}
