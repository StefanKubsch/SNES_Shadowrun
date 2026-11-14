// A hit (lifted from 80:8691 with the player hit 80:881C; register-level version in
// src/task/native-object-hit.mjs, which recorded waits and inputs replay).
//
// The hit takes the damage in A, the target's object slot in X and the shooter's in Y
// (negative: none, as from the blast 80:8E36); the damage is kept in DP 00.
// - A target without flag bit 13 cannot be damaged. With flag bit 15 it means no harm
//   and the hit is counted (7E:1FD4): the fourth warns, the eighth costs eight karma
//   eighths (one karma point) with a notice when there are at least eight, else the
//   karma drops to 0 without one; the count restarts. Both notices set the result DP B4
//   to 1. A notice is a window (80:F963) with its text (80:FE69), thirty word waits
//   (81:B0A1), the confirm key (80:F953) and the release (80:FA3E).
// - Otherwise the shooter goes to DP B7 and the damage is a draw below it (80:C51F) plus
//   1 less the target's armour byte, in the low byte. A positive damage below 80 lowers
//   the count byte of the target's record (not below 0); when the count reaches 0 or the
//   target has no record, the target's root task (the first one up its chain that does
//   not wait for a child) gets event bit 11 and the result is FFFF. A target whose task
//   is negative instead gets the damage word in the record count at its task slot, as
//   the original's jump back to its store does. A hit effect object (A1, script 10F)
//   appears four units above the target's box, with the draw's high byte and the damage,
//   less 1, as its armour word.
// - With a shooter an impact object (E7, script 80) appears at the target one unit
//   towards the shooter's facing (80:8850) with the facing of 80:8840 as its armour
//   word, at half of the target's height and box height plus its box height, halved.
// - The player hit 80:881C: a hit on the player figure plays sound 20 at level FF on
//   voices 7, shakes the figure for 11 frames (80:DE94) and redraws the window list
//   (81:AD92).
//
// Game state only (docs/STRATEGY.md, 2026-11-14): its callers read the result from DP
// B4 and restore their own registers, so the registers the original leaves are not
// produced; only X during the word waits (the original's count) is kept. The random
// number, the object slots 80:A835 and the sound 80:C46E run lifted as plain calls; the
// notices' callees and the window list run through their frames from the routine
// table, since they wait for frames.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import { drawBelowInDirectPage } from '../system/random.mjs';
import { playSoundEffect } from '../apu/sound-effect.mjs';
import { fitListWindow } from '../data/menu-layout.mjs';
import { taskStop } from '../task/plan.mjs';
import { createObject } from './object-create.mjs';
import { protectedJakeHealth } from './cheats.mjs';
import {
  DP_HIT_RESULT,
  DP_HIT_SHOOTER,
  HARMLESS_NOTICE_ROWS,
  HARMLESS_PENALTY,
  HARMLESS_WARNING,
  HIT_EFFECT_KIND,
  HIT_EFFECT_RAISE,
  HIT_EFFECT_SCRIPT,
  HIT_EVENT,
  IMPACT_FACINGS,
  IMPACT_KIND,
  IMPACT_OFFSETS,
  IMPACT_SCRIPT,
  KARMA_PENALTY,
  NOTICE_COUNTER_WAITS,
  PLAYER_HIT_SOUND,
  PLAYER_HIT_SOUND_LEVEL,
  PLAYER_HIT_SOUND_VOICES,
  PLAYER_HIT_STUN,
} from '../task/native-object-hit.mjs';
import {
  DP_OBJECT_HEIGHT,
  DP_OBJECT_KIND,
  DP_OBJECT_SCRIPT,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  DP_SOUND_EFFECT,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  HARMLESS_HITS,
  KARMA,
  OBJECT_ARMOUR,
  OBJECT_BOX_HEIGHT,
  OBJECT_DAMAGEABLE,
  OBJECT_DIRECTION,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_HITTABLE,
  OBJECT_RECORD,
  OBJECT_TASK,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_HIT_FRAMES,
  PLAYER_OBJECT,
  RECORD_COUNT,
  WRAM,
} from '../task/wram.mjs';
import { TASK_EVENTS, TASK_PREVIOUS, TASK_WAIT } from '../vm/layout.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  HIGH_BYTE_MASK,
  LONG_MASK,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

// The notices' callees and the window list (long calls: the word wait and the list).
const OPEN_WINDOW = 0x80f963,
  TEXT = 0x80fe69,
  WORD_WAIT = 0x81b0a1,
  CONFIRM_KEY = 0x80f953,
  RELEASE_WINDOW = 0x80fa3e,
  DRAW_WINDOW_LIST = 0x81ad92,
  LIST_CALL = 0x80883b;
// The call sites of the warning's and the penalty's callees.
const WARNING_CALLS = Object.freeze({
    window: 0x8087a1,
    text: 0x8087a9,
    wait: 0x8087af,
    key: 0x8087b6,
    release: 0x8087b9,
  }),
  PENALTY_CALLS = Object.freeze({
    window: 0x8087e7,
    text: 0x8087ef,
    wait: 0x8087f5,
    key: 0x8087fc,
    release: 0x8087ff,
  });
// Box units: coordinates over 4; the result of a notice.
const BOX_SHIFT = 2,
  NOTICE_RESULT = 1;
// The guard of the task chain: a wait chain longer than the task slots is no game state.
const TASK_CHAIN_LIMIT = 0x100;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// A long WRAM word or byte (bank 7E, crossing into 7F as the original's long index does).
const longAddress = (offset, index) => (WRAM + offset + index) & LONG_MASK;

// A notice of the harmless hits: its window, text, thirty word waits, the confirm key
// and the release.
function* noticeSequence(h, events, routines, notice, calls) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    call = (pc, target, long = false) =>
      nativeCallSequence(h, events, routines, pc, target, long, false);
  yield () => {
    setWord(wram, DP_WINDOW_LEFT, notice.margin);
    setWord(wram, DP_WINDOW_TOP, notice.margin);
    setWord(wram, DP_WINDOW_COLUMNS, notice.columns);
    setWord(wram, DP_WINDOW_ROWS, HARMLESS_NOTICE_ROWS);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
    fitListWindow(mem, h, [notice.text], { column: 0 });
  };
  yield* call(calls.window, OPEN_WINDOW);
  yield () => {
    setWord(wram, 2, notice.text);
  };
  yield* call(calls.text, TEXT);
  for (let left = NOTICE_COUNTER_WAITS; left > 0; left--) {
    yield () => {
      ctx.x = left;
    };
    yield* call(calls.wait, WORD_WAIT, true);
  }
  yield* call(calls.key, CONFIRM_KEY);
  yield* call(calls.release, RELEASE_WINDOW);
}

// A hit on a target that cannot be damaged: counted when it means no harm.
function* harmlessSequence(h, events, routines, flags) {
  const { mem } = h.a,
    { wram } = mem;
  if (!(flags & OBJECT_HITTABLE)) return;
  const hits = (dataBankWord(mem, HARMLESS_HITS) + 1) & WORD_MASK;
  setDataBankWord(mem, HARMLESS_HITS, 0, hits);
  if (hits === HARMLESS_WARNING.hits) {
    yield* noticeSequence(h, events, routines, HARMLESS_WARNING, WARNING_CALLS);
    yield () => {
      setWord(wram, DP_HIT_RESULT, NOTICE_RESULT);
    };
    return;
  }
  if (hits !== HARMLESS_PENALTY.hits) return;
  let karma = 0;
  if (mem.read16(WRAM + KARMA) >= KARMA_PENALTY) {
    yield* noticeSequence(h, events, routines, HARMLESS_PENALTY, PENALTY_CALLS);
    karma = mem.read16(WRAM + KARMA) - KARMA_PENALTY;
    if (karma < 0) karma = 0;
  }
  yield () => {
    mem.write16(WRAM + KARMA, karma);
    setDataBankWord(mem, HARMLESS_HITS, 0, 0);
    setWord(wram, DP_HIT_RESULT, NOTICE_RESULT);
  };
}

// The root task of the object's task: up the chain while a task waits for a child.
function rootTask(mem, task) {
  for (let n = 0; dataBankWord(mem, TASK_WAIT, task) & WORD_SIGN; n++) {
    if (n === TASK_CHAIN_LIMIT) taskStop('task_chain_unbounded', { task });
    task = dataBankWord(mem, TASK_PREVIOUS, task);
  }
  return task;
}

// The damage on the target's record: its count byte lowered, or the root task woken.
// draw is the random word, damage the low byte; returns nothing.
function damageRecord(h, target, draw, damage) {
  const { mem } = h.a,
    { wram } = mem,
    record = dataBankWord(mem, OBJECT_RECORD, target);
  // The accumulator's low byte at the store: the damage, or the count left.
  let low = damage;
  if (record !== 0) {
    let count = mem.read8(longAddress(RECORD_COUNT, record)) - damage;
    if (count < 0) count = 0;
    count = protectedJakeHealth(h.a, record, count) & BYTE_MASK;
    mem.write8(longAddress(RECORD_COUNT, record), count);
    if (count !== 0) return;
    low = 0;
  }
  const task = dataBankWord(mem, OBJECT_TASK, target);
  if (task & WORD_SIGN) {
    const at = longAddress(RECORD_COUNT, task);
    mem.write8(at, low);
    mem.write8((at + 1) & LONG_MASK, draw >>> BYTE_BITS);
    return;
  }
  const root = rootTask(mem, task);
  setDataBankWord(mem, TASK_EVENTS, root, dataBankWord(mem, TASK_EVENTS, root) | HIT_EVENT);
  setWord(wram, DP_HIT_RESULT, WORD_MASK);
}

// The hit effect object above the target's box; its armour word the draw's high byte
// with the damage, less 1.
function placeHitEffect(h, target, armour) {
  const { mem } = h.a,
    { wram } = mem,
    field = (offset) => dataBankWord(mem, offset, target);
  setWord(wram, DP_OBJECT_KIND, HIT_EFFECT_KIND);
  setWord(wram, DP_OBJECT_X, field(OBJECT_X) >>> BOX_SHIFT);
  setWord(wram, DP_OBJECT_Y, field(OBJECT_Y) >>> BOX_SHIFT);
  setWord(wram, DP_OBJECT_SCRIPT, HIT_EFFECT_SCRIPT);
  // Two additions without a clear carry between them.
  const raised =
      (field(OBJECT_HEIGHT) >>> BOX_SHIFT) + mem.read16(longAddress(OBJECT_BOX_HEIGHT, target)),
    carry = raised > WORD_MASK ? 1 : 0;
  setWord(wram, DP_OBJECT_HEIGHT, raised + HIT_EFFECT_RAISE + carry);
  createObject(mem, wram, h.a);
  mem.write16(longAddress(OBJECT_ARMOUR, word(wram, 0)), (armour - 1) & WORD_MASK);
}

// The impact object at the target, one unit towards the shooter's facing.
function placeImpact(h, target, shooter) {
  const { mem } = h.a,
    { wram } = mem,
    field = (offset) => dataBankWord(mem, offset, target),
    box = mem.read16(longAddress(OBJECT_BOX_HEIGHT, target)),
    half = ((field(OBJECT_HEIGHT) + box) & WORD_MASK) >>> 1,
    facing = (dataBankWord(mem, OBJECT_DIRECTION, shooter) << 1) & WORD_MASK,
    offset = dataBankWord(mem, IMPACT_OFFSETS, facing);
  setWord(wram, DP_OBJECT_KIND, IMPACT_KIND);
  setWord(wram, DP_OBJECT_HEIGHT, ((half + box) & WORD_MASK) >>> 1);
  setWord(wram, DP_OBJECT_X, (field(OBJECT_X) >>> BOX_SHIFT) + offset);
  setWord(wram, DP_OBJECT_Y, (field(OBJECT_Y) >>> BOX_SHIFT) + offset);
  setWord(wram, DP_OBJECT_SCRIPT, IMPACT_SCRIPT);
  const armour = dataBankWord(mem, IMPACT_FACINGS, facing);
  createObject(mem, wram, h.a);
  mem.write16(longAddress(OBJECT_ARMOUR, word(wram, 0)), armour);
}

// 80:881C: the player figure hit.
function* playerHitSequence(h, events, routines, target) {
  const { mem } = h.a,
    { wram } = mem;
  if (target !== dataBankWord(mem, PLAYER_OBJECT)) return;
  yield () => {
    setWord(wram, 0, target);
    setWord(wram, DP_SOUND_LEVEL, PLAYER_HIT_SOUND_LEVEL);
    setWord(wram, DP_SOUND_VOICE, PLAYER_HIT_SOUND_VOICES);
    setWord(wram, DP_SOUND_EFFECT, PLAYER_HIT_SOUND);
    playSoundEffect(mem, accessorPort(h.a), {
      object: target,
      effect: PLAYER_HIT_SOUND,
      level: PLAYER_HIT_SOUND_LEVEL,
      voices: PLAYER_HIT_SOUND_VOICES,
    });
    setDataBankWord(mem, PLAYER_HIT_FRAMES, 0, PLAYER_HIT_STUN);
  };
  yield* nativeCallSequence(h, events, routines, LIST_CALL, DRAW_WINDOW_LIST, true, false);
}

// 80:8691: the hit with the damage in A on the target X by the shooter Y. A sequence
// for a native call continuation that ends with the hit's RTS; routines holds the
// notices' callees and the window list.
export function* hitObjectSequence(h, events, routines) {
  if (h.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    target = ctx.x,
    shooter = ctx.y;
  setWord(wram, 0, ctx.a);
  const flags = dataBankWord(mem, OBJECT_FLAGS, target);
  if (!(flags & OBJECT_DAMAGEABLE)) yield* harmlessSequence(h, events, routines, flags);
  else {
    yield () => {
      setWord(wram, DP_HIT_SHOOTER, shooter);
      const draw = drawBelowInDirectPage(mem, accessorPort(h.a), ctx.a),
        damage = (draw + 1 - mem.read8(longAddress(OBJECT_ARMOUR, target))) & BYTE_MASK;
      if (damage === 0 || damage & BYTE_SIGN) return;
      const armour = (draw & HIGH_BYTE_MASK) | damage;
      wram[0] = damage;
      damageRecord(h, target, draw, damage);
      placeHitEffect(h, target, armour);
    };
    yield () => {
      if (!(shooter & WORD_SIGN)) placeImpact(h, target, shooter);
    };
    yield* playerHitSequence(h, events, routines, target);
  }
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
