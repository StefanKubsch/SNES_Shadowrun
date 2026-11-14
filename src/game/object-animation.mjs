// The animation step of an object (lifted from 80:AC2F; register-level version in
// src/task/native-scene-tiles.mjs, which the tile reload 80:AE12 and the replays with
// recorded interrupts keep using).
//
// Each pass the motion pass steps the animation of every object that is not halted.
// A picture change (OBJECT_PICTURE_CHANGE) is taken at once, a restart (FFFF) begins
// the stream again. Otherwise the animation speed is added to the clock (bits 0 to 6);
// a carry into bit 7 or a speed of 80 and more advances the frame. A frame is shown
// for its repeats; then the next word of the frame stream (bank of the direct page
// word 40, at the object's action directions) is the new picture. At the end of the
// stream, a stream that loops (frame count 1 to 7F) starts again at the direction's
// first frame, one that plays once (frame count 80 and more) does too and clears its
// count; with no count left the animation ends: its speed is cleared, bit 15 of the
// selection is set and the object's task (or the task it waits for, up the list)
// gets the event 8.
//
// A new picture (bank 9B, 9C with bit 15) takes as many VRAM slots as it has tiles,
// from the free list or back to it, and its tiles are queued for the NMI's upload: two
// jobs per tile (the source in bank 8E and up, the slot's two VRAM halves from the
// tables 80:AEB4 and 80:AEC4). A picture that would fill the upload list past 50, or
// needs more slots than are free, waits in OBJECT_PICTURE_CHANGE for the next pass.
// Its layout's first cell gives the shadow rule (the depth rule with bit 15) and the
// depth bias from the byte before the picture.
//
// The direct page words of the original are written as it writes them (11 to 15, 17,
// 20, 35 to 38, 3B, 3E and the upload index 82). Y is kept on the stack as the
// original's PHY and PLY, the slot around the tile queue; A, X, Y and the flags are
// left as the original leaves them. The fields the original reads through its data
// bank 80 lie below 2000 (`object_slot_required` past it), the animation fields in
// bank 7E. A task chain whose waits never end stops at `task_chain_required`.
//
// With recorded interrupt observations an NMI may fall inside the routine (the Mesen
// cold boot replay records one at 80:AC8F), so the register-level routine runs there.
import { stepObjectAnimation } from '../task/native-scene-tiles.mjs';
import { taskStop } from '../task/plan.mjs';
import { CarryArithmetic } from './carry-arithmetic.mjs';
import {
  DP_VRAM_UPLOAD_INDEX,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_ANIMATION_CLOCK,
  OBJECT_ANIMATION_SPEED,
  OBJECT_DEPTH_BIAS,
  OBJECT_DEPTH_RULE,
  OBJECT_DIRECTION,
  OBJECT_FRAME_COUNT,
  OBJECT_FRAME_OFFSET,
  OBJECT_FRAME_REPEATS,
  OBJECT_PICTURE,
  OBJECT_PICTURE_CHANGE,
  OBJECT_SELECTION,
  OBJECT_TASK,
  OBJECT_VRAM_SLOT_COUNT,
  OBJECT_VRAM_SLOT_HEAD,
  VRAM_SLOT_COUNT,
  VRAM_SLOT_FREE_LIST,
  VRAM_SLOT_NEXT,
  VRAM_UPLOAD_ADDRESSES,
  VRAM_UPLOAD_BANKS,
  VRAM_UPLOAD_SOURCES,
  WRAM,
} from '../task/wram.mjs';
import { TASK_EVENTS, TASK_PREVIOUS, TASK_WAIT } from '../vm/layout.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  HIGH_BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// The direct page words: the long pointer (direction table, then the picture), the
// picture's tile count, the slot difference, the clock sum, the picture start and its
// bank, the bank bit of the pointer and the frame stream pointer with its bank.
const DP_POINTER = 0x11,
  DP_POINTER_BANK = 0x13,
  DP_TILE_COUNT = 0x14,
  DP_SLOT_CHANGE = 0x17,
  DP_CLOCK_SUM = 0x20,
  DP_PICTURE_START = 0x35,
  DP_PICTURE_BANK = 0x37,
  DP_PICTURE_BIT = 0x3b,
  // The stream's bank is the word 40 the caller leaves.
  DP_STREAM = 0x3e;
const RESTART = WORD_MASK,
  CLOCK_MASK = 0x7f,
  // The frame count: bit 7 plays the stream once.
  PLAYS_ONCE = 0x80,
  COUNT_MASK = 0x7f,
  // The direction tables and frame streams lie in bank 8C, the pictures in 9B and 9C.
  FRAME_BANK = 0x8c,
  PICTURE_BANK = 0x9b,
  HIGH_PICTURE = WORD_SIGN,
  // The selection's bit and the task event when an animation ends.
  ENDED = WORD_SIGN,
  END_EVENT = 8,
  // A frame stream entry is a word.
  FRAME_STEP = 2,
  // The upload list holds jobs up to index 50; four bytes of jobs per tile.
  UPLOAD_LIMIT = 0x50,
  TILE_JOB_SHIFT = 2,
  // A tile word: the source offset (bits 6 to 15) and the bank above 8E (bits 0 to 5).
  SOURCE_OFFSET = 0xffc0,
  SOURCE_BANK = 0x3f,
  FIRST_SOURCE_BANK = 0x8e,
  // The VRAM addresses of each slot's two halves in bank 80.
  SLOT_HALVES = [0x80aeb4, 0x80aec4],
  // The picture layout's first cell and its shadow bits; the depth rule's shadow bit.
  FIRST_CELL = 3,
  SHADOW_MASK = 7,
  SHADOW_RULE = WORD_SIGN,
  BIAS_SHIFT = 2,
  LOW_WRAM_END = 0x2000,
  // More steps up a task chain than slots: the waits never end.
  TASK_CHAIN_LIMIT = 0x10000;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);

// Step the animation of the object in X (80:AC2F, called with JSR).
export function stepAnimation(h, events) {
  if (events?.startupInterrupts) return stepObjectAnimation(h, events);
  const { ctx, a } = h,
    { mem } = a,
    { wram } = mem,
    math = new CarryArithmetic(ctx),
    slot = ctx.x;
  // A field read in the data bank 80 below 2000, a field of bank 7E, a long pointer in
  // the direct page.
  const near = (field, index = slot) => {
    if (field + index + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { field, index });
    return field + index;
  };
  const get = (field, index) => word(wram, near(field, index)),
    put = (field, value, index) => setWord(wram, near(field, index), value),
    getFar = (field) => longWord(mem, WRAM + field + slot),
    putFar = (field, value) => {
      mem.write8((WRAM + field + slot) & LONG_MASK, value & BYTE_MASK);
      mem.write8((WRAM + field + slot + 1) & LONG_MASK, (value >>> BYTE_BITS) & BYTE_MASK);
    },
    pointer = (dp) => word(wram, dp) | (wram[dp + 2] << WORD_BITS);

  a.pushWord(ctx.y);
  let result = ctx.a;
  const done = () => {
    ctx.a = result & WORD_MASK;
    math.apply(ctx, ctx.a);
    ctx.y = a.pullWord();
    ctx.status = ctx.y & WORD_SIGN ? ctx.status | FLAG_NEGATIVE : ctx.status & ~FLAG_NEGATIVE;
    ctx.status = ctx.y === 0 ? ctx.status | FLAG_ZERO : ctx.status & ~FLAG_ZERO;
    return h.rts();
  };

  // The next picture: a change waiting, or the next frame of the stream.
  let picture = null;
  const change = get(OBJECT_PICTURE_CHANGE);
  if (change) {
    math.compare(change, RESTART);
    put(OBJECT_PICTURE_CHANGE, 0);
    if (change !== RESTART) picture = change;
  }
  if (picture === null) {
    const sum = math.add(getFar(OBJECT_ANIMATION_SPEED), getFar(OBJECT_ANIMATION_CLOCK));
    setWord(wram, DP_CLOCK_SUM, sum);
    result = sum & CLOCK_MASK;
    putFar(OBJECT_ANIMATION_CLOCK, result);
    if (!math.carry) {
      math.compare(result, sum);
      if (result === sum) return done();
    }
    const directions = get(OBJECT_ACTION_DIRECTIONS);
    result = directions;
    if (!directions) return done();
    setWord(wram, DP_STREAM, directions);
    const stream = (offset) => longWord(mem, pointer(DP_STREAM) + offset);
    const repeats = (getFar(OBJECT_FRAME_REPEATS) - 1) & WORD_MASK;
    putFar(OBJECT_FRAME_REPEATS, repeats);
    let frame;
    if (repeats) {
      frame = get(OBJECT_FRAME_OFFSET);
    } else {
      const count = get(OBJECT_FRAME_COUNT);
      if (!count) {
        // The animation has ended.
        putFar(OBJECT_ANIMATION_SPEED, 0);
        put(OBJECT_SELECTION, get(OBJECT_SELECTION) | ENDED);
        result = get(OBJECT_TASK);
        if (!(result & WORD_SIGN)) {
          let task = result;
          for (let steps = 0; get(TASK_WAIT, task) & WORD_SIGN; steps++) {
            if (steps === TASK_CHAIN_LIMIT) taskStop('task_chain_required', { task });
            task = get(TASK_PREVIOUS, task);
          }
          result = get(TASK_EVENTS, task) | END_EVENT;
          put(TASK_EVENTS, result, task);
          ctx.x = task;
        }
        return done();
      }
      math.compare(count, PLAYS_ONCE);
      let frames = count;
      if (math.carry) {
        frames = count & COUNT_MASK;
        put(OBJECT_FRAME_COUNT, 0);
      }
      putFar(OBJECT_FRAME_REPEATS, frames);
      setWord(wram, DP_POINTER, directions);
      setWord(wram, DP_POINTER_BANK, FRAME_BANK);
      frame = longWord(mem, pointer(DP_POINTER) + get(OBJECT_DIRECTION)) & BYTE_MASK;
    }
    put(OBJECT_FRAME_OFFSET, frame + FRAME_STEP);
    picture = stream(frame);
  }

  // The picture: its bank, its tiles and their slots.
  setWord(wram, DP_POINTER, picture);
  const bit = (picture & HIGH_PICTURE) ^ HIGH_PICTURE;
  setWord(wram, DP_PICTURE_BIT, bit);
  const bank = PICTURE_BANK + (picture >>> (WORD_BITS - 1));
  math.add(PICTURE_BANK, 0, picture & HIGH_PICTURE);
  setWord(wram, DP_POINTER_BANK, bank);
  setWord(wram, DP_PICTURE_BANK, bank);
  const start = picture | HIGH_PICTURE;
  setWord(wram, DP_POINTER, start);
  setWord(wram, DP_PICTURE_START, start);
  const tiles = mem.read8(pointer(DP_POINTER)),
    held = () => {
      result = word(wram, DP_POINTER) ^ word(wram, DP_PICTURE_BIT);
      put(OBJECT_PICTURE_CHANGE, result);
      return done();
    };
  setWord(wram, DP_TILE_COUNT, tiles);
  const jobs = math.add(tiles << TILE_JOB_SHIFT, word(wram, DP_VRAM_UPLOAD_INDEX));
  if (!math.carry) {
    math.compare(jobs, UPLOAD_LIMIT);
    if (math.carry) return held();
  }
  // The carry is set here (SEC, or the carry of the addition), so the SBC subtracts
  // exactly.
  const difference = math.sub(tiles, get(OBJECT_VRAM_SLOT_COUNT));
  if (difference) {
    if (math.carry) {
      // More slots: from the head of the free list, if enough are free.
      math.compare(difference, word(wram, VRAM_SLOT_COUNT));
      if (math.carry) return held();
      setWord(wram, VRAM_SLOT_COUNT, math.sub(word(wram, VRAM_SLOT_COUNT), difference));
      for (let n = difference; n; n--) {
        ctx.y = word(wram, VRAM_SLOT_FREE_LIST);
        setWord(wram, VRAM_SLOT_FREE_LIST, get(VRAM_SLOT_NEXT, ctx.y));
        put(VRAM_SLOT_NEXT, get(OBJECT_VRAM_SLOT_HEAD), ctx.y);
        put(OBJECT_VRAM_SLOT_HEAD, ctx.y);
      }
    } else {
      // Fewer slots: the surplus goes back to the free list.
      const surplus = (difference ^ WORD_MASK) + 1;
      setWord(wram, VRAM_SLOT_COUNT, math.add(surplus, word(wram, VRAM_SLOT_COUNT)));
      for (let n = surplus; n; n--) {
        ctx.y = get(OBJECT_VRAM_SLOT_HEAD);
        put(OBJECT_VRAM_SLOT_HEAD, get(VRAM_SLOT_NEXT, ctx.y));
        const free = word(wram, VRAM_SLOT_FREE_LIST);
        setWord(wram, VRAM_SLOT_FREE_LIST, ctx.y);
        put(VRAM_SLOT_NEXT, free, ctx.y);
      }
    }
    setWord(wram, DP_SLOT_CHANGE, 0);
    put(OBJECT_VRAM_SLOT_COUNT, tiles);
  }

  // Queue two upload jobs per tile, the slot kept on the stack.
  a.pushWord(slot);
  setWord(wram, DP_POINTER, start + 1);
  let job = word(wram, DP_VRAM_UPLOAD_INDEX),
    tileSlot = get(OBJECT_VRAM_SLOT_HEAD);
  // A picture without tiles counts down from 0 through FFFF, as the original's DEC.
  for (let n = tiles || WORD_MASK + 1; n; n--) {
    for (const half of SLOT_HALVES) {
      job = (job + 2) & WORD_MASK;
      const tile = longWord(mem, pointer(DP_POINTER));
      put(VRAM_UPLOAD_SOURCES, tile & SOURCE_OFFSET, job);
      put(VRAM_UPLOAD_BANKS, math.add(tile & SOURCE_BANK, FIRST_SOURCE_BANK), job);
      put(VRAM_UPLOAD_ADDRESSES, longWord(mem, half + tileSlot), job);
      if (half === SLOT_HALVES[1]) tileSlot = get(VRAM_SLOT_NEXT, tileSlot);
      setWord(wram, DP_POINTER, word(wram, DP_POINTER) + 2);
    }
  }
  setWord(wram, DP_TILE_COUNT, 0);
  setWord(wram, DP_VRAM_UPLOAD_INDEX, job);
  ctx.y = job;
  ctx.x = a.pullWord();

  // The picture shown, its shadow rule and depth bias.
  result = word(wram, DP_POINTER) ^ word(wram, DP_PICTURE_BIT);
  putFar(OBJECT_PICTURE, result);
  const pointerAt = pointer(DP_POINTER);
  result = longWord(mem, pointerAt + FIRST_CELL) & SHADOW_MASK;
  put(OBJECT_DEPTH_RULE, result);
  if (result) {
    result |= SHADOW_RULE;
    put(OBJECT_DEPTH_RULE, result);
    const before = (word(wram, DP_PICTURE_START) - 1) & WORD_MASK;
    setWord(wram, DP_PICTURE_START, before);
    const bias = longWord(mem, pointer(DP_PICTURE_START));
    result = bias & BYTE_SIGN ? bias | HIGH_BYTE_MASK : bias & BYTE_MASK;
    for (let n = 0; n < BIAS_SHIFT; n++) result = math.shiftLeft(result);
    put(OBJECT_DEPTH_BIAS, result);
  }
  return done();
}
