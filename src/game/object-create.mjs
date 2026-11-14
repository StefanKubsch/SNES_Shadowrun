// The object creation (lifted from 80:A835; register-level version in
// src/task/native-object-create.mjs, which the other callers still use).
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
// 80:A8EB, which calls C34A) lie on the stack as in the original. The object tables lie
// in bank 7E below 2000, where the original's data bank 80 reads them.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { appendScriptTask } from './task-append.mjs';
import {
  ANIMATION_CLOCK_START,
  DP_OBJECT_HEIGHT,
  DP_OBJECT_KIND,
  DP_OBJECT_SCRIPT,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  MOTION_ACTIVE,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_ANIMATION_CLOCK,
  OBJECT_ARMOUR,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_DEPTH_ORDER,
  OBJECT_DEPTH_RULE,
  OBJECT_DIAGONAL,
  OBJECT_DIALOG,
  OBJECT_DIRECTION,
  OBJECT_FLAGS,
  OBJECT_FRAME_REPEATS,
  OBJECT_HEIGHT,
  OBJECT_KIND,
  OBJECT_LAST_SLOT,
  OBJECT_NUMBER,
  OBJECT_PICTURE,
  OBJECT_PICTURE_CHANGE,
  OBJECT_RECORD,
  OBJECT_SELECTION,
  OBJECT_TASK,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_VELOCITY_Z,
  OBJECT_VRAM_SLOT_COUNT,
  OBJECT_VRAM_SLOT_HEAD,
  OBJECT_X,
  OBJECT_Y,
} from '../task/wram.mjs';
import { KIND_FLAGS_OFFSET, KIND_TABLE } from '../data/kinds.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const LONG_MASK = 0xffffff,
  // A position argument is stored times four.
  POSITION_SHIFT = 2,
  // The kind table has six bytes per kind (kind * 4 + kind * 2).
  KIND_SHIFT = 1;
// The return words of the JSL to 80:A8EB and the JSRs to C34A (from C366), C2C8 (from
// C34A) and C242 (from C2F5).
const CODE_BANK = 0x80,
  APPEND_JSL_RETURN = 0xa8ee,
  APPEND_JSR_RETURN = 0xc368,
  JSR_LAST_BYTE = 2;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);

// Create an object (80:A835) from the direct page arguments.
export function createObject(mem, wram, a) {
  let slot = OBJECT_LAST_SLOT;
  while (!(word(wram, OBJECT_KIND + slot) & WORD_SIGN)) {
    slot -= 2;
    if (slot < 0) return;
  }
  const kind = word(wram, DP_OBJECT_KIND);
  setWord(wram, OBJECT_KIND + slot, kind);
  for (const table of [
    OBJECT_VELOCITY_X,
    OBJECT_VELOCITY_Y,
    OBJECT_VELOCITY_Z,
    OBJECT_DEPTH_RULE,
    OBJECT_BOX_X1,
    OBJECT_BOX_X2,
    OBJECT_BOX_Y1,
    OBJECT_BOX_Y2,
    OBJECT_BOX_HEIGHT,
    OBJECT_ARMOUR,
    OBJECT_DIALOG,
    MOTION_ACTIVE,
    OBJECT_PICTURE_CHANGE,
    OBJECT_PICTURE,
  ])
    setWord(wram, table + slot, 0);
  const x = (word(wram, DP_OBJECT_X) << POSITION_SHIFT) & WORD_MASK,
    y = (word(wram, DP_OBJECT_Y) << POSITION_SHIFT) & WORD_MASK;
  setWord(wram, OBJECT_X + slot, x);
  setWord(wram, OBJECT_Y + slot, y);
  setWord(wram, OBJECT_DIAGONAL + slot, ((x + y) & WORD_MASK) >>> 1);
  setWord(wram, OBJECT_HEIGHT + slot, word(wram, DP_OBJECT_HEIGHT) << POSITION_SHIFT);
  for (const table of [
    OBJECT_ACTION_DIRECTIONS,
    OBJECT_VRAM_SLOT_COUNT,
    OBJECT_VRAM_SLOT_HEAD,
    OBJECT_DIRECTION,
    OBJECT_RECORD,
    OBJECT_DEPTH_ORDER,
  ])
    setWord(wram, table + slot, 0);
  setWord(wram, OBJECT_SELECTION + slot, WORD_MASK);
  setWord(wram, OBJECT_NUMBER + slot, WORD_MASK);
  setWord(wram, OBJECT_ANIMATION_CLOCK + slot, ANIMATION_CLOCK_START);
  setWord(wram, OBJECT_FRAME_REPEATS + slot, 1);
  setWord(wram, DP_OBJECT_KIND, slot);
  // kind * 6 as kind * 4 + kind * 2, with the bit shifted out of kind * 2 as carry.
  const twice = (kind << KIND_SHIFT) & WORD_MASK,
    entry = ((twice << KIND_SHIFT) + twice + (twice >>> (WORD_BITS - 1))) & WORD_MASK;
  setWord(wram, DP_OBJECT_X, twice);
  setWord(wram, OBJECT_FLAGS + slot, readWord(mem, KIND_TABLE + KIND_FLAGS_OFFSET + entry));
  const last = (word(wram, DRAW_LIST_INDEX) + 2) & WORD_MASK;
  setWord(wram, DRAW_LIST_INDEX, last);
  setWord(wram, DRAW_LIST + last, slot);
  const script = word(wram, DP_OBJECT_SCRIPT);
  if (script & WORD_SIGN) return;
  a.write(a.ctx.s, CODE_BANK);
  a.ctx.s = (a.ctx.s - 1) & WORD_MASK;
  a.pushWord(APPEND_JSL_RETURN);
  a.pushWord(APPEND_JSR_RETURN);
  const task = appendScriptTask(mem, wram, a, script);
  a.pullWord();
  a.pullWord();
  a.ctx.s = (a.ctx.s + 1) & WORD_MASK;
  setWord(wram, OBJECT_TASK + slot, task);
}

// The object creation as the caller's JSR at site.
export function createObjectCall(h, site) {
  const { mem, wram } = sceneRuntime(h);
  h.a.pushWord((site + JSR_LAST_BYTE) & WORD_MASK);
  createObject(mem, wram, h.a);
  h.a.pullWord();
}
