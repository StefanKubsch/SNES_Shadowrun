import { DP_ITEM_FLAGS, DP_ITEM_RECORD } from '../system/native-status-screen.mjs';
import { dataBankOf } from '../system/data-bank.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The object creation (lifted from 80:A835; register-level version in
// src/script/native-object-create.mjs, which the other callers still use).
//
// An object of the kind in the direct page word 00 is created in the last free object
// slot at the position in the words 02, 04 and 06 (times four), and the slot is
// returned in word 00 (with no free slot nothing happens and word 00 keeps the kind).
// It takes its kind's flags and goes onto the draw list. With a script (word 08 not
// negative) a task is started for it with the lifted task append 80:C34A
// (src/game/task-append.mjs), which copies the script's arguments from the direct page
// words 00 on.
//
// The kind times two is left in word 02. The return words of the calls (a JSL to
// 80:A8EB, which calls C34A) lie only in free stack bytes and are not reproduced (game
// state only, user decision 2026-11-17). The object tables lie
// in bank 7E below 2000, where the original's data bank 80 reads them; the draw list
// entry and the task word, whose index may be damaged, are written through the data
// bank as in the original.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { argumentWords, tasksOf } from '../script/task-api.mjs';
import {
  ANIMATION_CLOCK_START,
  DP_OBJECT_HEIGHT,
  DP_OBJECT_KIND,
  DP_OBJECT_SCRIPT,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  OBJECT_LAST_SLOT,
} from '../data/wram.mjs';
import { KIND_FLAGS_OFFSET, KIND_TABLE } from '../data/kinds.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { objectWordIn, setBankObjectWord, setObjectWordIn } from '../state/objects.mjs';

const LONG_MASK = 0xffffff,
  // A position argument is stored times four.
  POSITION_SHIFT = 2,
  // The kind table has six bytes per kind (kind * 4 + kind * 2).
  KIND_SHIFT = 1;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
const dataBankAddress = (a, offset) => ((dataBankOf(a) << WORD_BITS) + offset) & LONG_MASK;
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);

// Create an object (80:A835) from the direct page arguments.
export function createObject(mem, wram, a) {
  let slot = OBJECT_LAST_SLOT;
  while (!(objectWordIn(wram, 'kind', slot) & WORD_SIGN)) {
    slot -= 2;
    if (slot < 0) return;
  }
  const kind = word(wram, DP_OBJECT_KIND);
  setObjectWordIn(wram, 'kind', slot, kind);
  for (const name of [
    'velocityX',
    'velocityY',
    'velocityZ',
    'depthRule',
    'boxX1',
    'boxX2',
    'boxY1',
    'boxY2',
    'boxHeight',
    'armour',
    'dialog',
    'motionActive',
    'pictureChange',
    'picture',
  ])
    setObjectWordIn(wram, name, slot, 0);
  const x = (word(wram, DP_OBJECT_X) << POSITION_SHIFT) & WORD_MASK,
    y = (word(wram, DP_OBJECT_Y) << POSITION_SHIFT) & WORD_MASK;
  setObjectWordIn(wram, 'x', slot, x);
  setObjectWordIn(wram, 'y', slot, y);
  setObjectWordIn(wram, 'diagonal', slot, ((x + y) & WORD_MASK) >>> 1);
  setObjectWordIn(wram, 'height', slot, word(wram, DP_OBJECT_HEIGHT) << POSITION_SHIFT);
  for (const name of [
    'actionDirections',
    'vramSlotCount',
    'vramSlotHead',
    'direction',
    'record',
    'depthOrder',
  ])
    setObjectWordIn(wram, name, slot, 0);
  setObjectWordIn(wram, 'selection', slot, WORD_MASK);
  setObjectWordIn(wram, 'number', slot, WORD_MASK);
  setObjectWordIn(wram, 'animationClock', slot, ANIMATION_CLOCK_START);
  setObjectWordIn(wram, 'frameRepeats', slot, 1);
  setWord(wram, DP_OBJECT_KIND, slot);
  // kind * 6 as kind * 4 + kind * 2, with the bit shifted out of kind * 2 as carry.
  const twice = (kind << KIND_SHIFT) & WORD_MASK,
    entry = ((twice << KIND_SHIFT) + twice + (twice >>> (WORD_BITS - 1))) & WORD_MASK;
  setWord(wram, DP_OBJECT_X, twice);
  setObjectWordIn(wram, 'flags', slot, readWord(mem, KIND_TABLE + KIND_FLAGS_OFFSET + entry));
  const last = (word(wram, DRAW_LIST_INDEX) + 2) & WORD_MASK;
  setWord(wram, DRAW_LIST_INDEX, last);
  // The draw list index may be damaged: the entry is written through the data bank.
  mem.write16(dataBankAddress(a, DRAW_LIST + last), slot);
  const script = word(wram, DP_OBJECT_SCRIPT);
  if (script & WORD_SIGN) return;
  const task = tasksOf(a).append(script, argumentWords(mem, script));
  // The slot is read again from the direct page word 00, which the argument copy of
  // the append may have overwritten.
  setBankObjectWord(a, 'task', word(wram, DP_OBJECT_KIND), task);
}

// The object creation on the scene runtime of h.
export function createObjectCall(h) {
  const { mem, wram } = sceneRuntime(h);
  createObject(mem, wram, h.a);
}

// Create an actor's item at a position expressed in the creation function's units.
// Compatibility arguments stay here; callers keep coordinates and actor fields by name.
export function createActorItem(mem, a, actor, position) {
  const { wram } = mem;
  setWord(wram, DP_ITEM_FLAGS, actor.flags);
  setWord(wram, DP_ITEM_RECORD, actor.record);
  setWord(wram, DP_OBJECT_KIND, actor.kind);
  setWord(wram, DP_OBJECT_SCRIPT, actor.script);
  setWord(wram, DP_OBJECT_X, position.x);
  setWord(wram, DP_OBJECT_Y, position.y);
  setWord(wram, DP_OBJECT_HEIGHT, position.height);
  createObject(mem, wram, a);
  return word(wram, 0);
}
