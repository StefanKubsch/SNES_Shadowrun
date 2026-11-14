import { BYTE_MASK, WORD_MASK, HIGH_BYTE_MASK, BYTE_SIGN } from '../constants/bits.mjs';
import { waitWord, observeRandomStateWait, nmiWords } from './native-dialog-portrait.mjs';
import { interruptStep } from './main-wait-interrupt.mjs';

import {
  DRAW_LIST,
  DRAW_LIST_INDEX,
  DP_VRAM_UPLOAD_INDEX,
  NMI_JOB_LISTS,
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
  OBJECT_ACTION_DIRECTIONS,
} from './wram.mjs';
import { TASK_EVENTS, TASK_PREVIOUS, TASK_WAIT } from '../vm/layout.mjs';
import { FLAG_CARRY, FLAG_ZERO, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
// Tile management of the scene objects (animation step AC2F, request tiles again AE12, all objects
// ADF4). An object X occupies a chain of VRAM slots (head $12F8+X, sequence $1564, count $12A0+X); free
// slots hang on $0D1E, their count is in $0D1C. Jobs for the NMI lie in $1654/$16D4/$1754 (index
// DP82); $1562 counts open job lists. h from dialogAccess, events as in the dialog.

// Direct page words of AC2F: a long pointer (frame direction table, then the picture), the
// picture's tile count, the previous clock sum, the frame stream pointer with its bank, the
// bank toggle of bit 15, a copy of the picture start and bank, and the slot difference.
const DP_POINTER = 0x11,
  DP_POINTER_BANK = 0x13,
  DP_TILE_COUNT = 0x14,
  DP_SLOT_CHANGE = 0x17,
  DP_CLOCK_SUM = 0x20,
  DP_PICTURE_START = 0x35,
  DP_PICTURE_BANK = 0x37,
  DP_PICTURE_BIT = 0x3b,
  DP_STREAM = 0x3e,
  DP_STREAM_BANK = 0x40;
// Direct page words of AE12: the picture pointer, its bank and the tile count.
const DP_RELOAD_POINTER = 0x41,
  DP_RELOAD_BANK = 0x43,
  DP_RELOAD_COUNT = 0x44;
// OBJECT_PICTURE_CHANGE value that restarts the current animation.
const PICTURE_RESTART = 0xffff;
// Object pictures lie in bank 9B; bit 15 of a picture pointer selects bank 9C (src/data/pictures.mjs).
const PICTURE_BANK = 0x9b,
  PICTURE_HIGH_BANK = 0x8000;
// Bank 8C of the object frame data (direction tables and frame streams).
const FRAME_BANK = 0x8c;
// The animation clock keeps bits 0-6; a carry into bit 7 advances the frame.
const ANIMATION_CLOCK_MASK = 0x7f;
// Frame count bit 7: the stream plays once (the count is cleared when it restarts).
const FRAME_COUNT_ONCE = 0x80,
  FRAME_COUNT_MASK = 0x7f;
// OBJECT_SELECTION bit and task event bit set when an animation ends.
const ANIMATION_ENDED = 0x8000,
  ANIMATION_END_EVENT = 8;
// Tile word: a 64-byte OBJ character at bank 8E + bits 0-5, offset word & FFC0 (src/data/pictures.mjs).
const SOURCE_OFFSET_MASK = 0xffc0,
  SOURCE_BANK_MASK = 0x3f,
  SOURCE_FIRST_BANK = 0x8e;
// A picture is queued only while DP82 + 4 * tiles stays below this upload index.
const VRAM_UPLOAD_INDEX_LIMIT = 0x50;
// VRAM word addresses of the first and second half of each slot (motion_offsets 80:AEB4/AEC4).
const SLOT_VRAM_FIRST = 0xaeb4,
  SLOT_VRAM_SECOND = 0xaec4;
// Picture layout: the first cell byte, its shadow selector bits (0-2) and the depth rule bit
// 15 set when they are not 0.
const LAYOUT_FIRST_CELL = 3,
  CELL_SHADOW_MASK = 7,
  DEPTH_RULE_SHADOW = 0x8000;

const incrementJobLists = (h, pc) =>
  h.call(
    pc,
    0x81a954,
    () => {
      h.modify(h.abs(NMI_JOB_LISTS), 'inc');
      return h.rtl();
    },
    true,
  );
// Two jobs per slot: source [ptr] (bits 6..15), tile count + 8E (bits 0..5), target from the tables
// first/second per slot X; ptr advances by 2 words, Y by 4.
function queueTiles(h, ptr, count, first, second) {
  const { ctx } = h;
  do {
    for (const table of [first, second]) {
      h.index('y', ctx.y + 1);
      h.index('y', ctx.y + 1);
      h.load(h.read(h.indirect(ptr)) & SOURCE_OFFSET_MASK);
      h.write(h.abs(VRAM_UPLOAD_SOURCES) + ctx.y, ctx.a);
      h.load(h.read(h.indirect(ptr)) & SOURCE_BANK_MASK);
      ctx.status &= ~FLAG_CARRY;
      h.adc(SOURCE_FIRST_BANK);
      h.write(h.abs(VRAM_UPLOAD_BANKS) + ctx.y, ctx.a);
      h.load(h.read(h.abs(table) + ctx.x));
      h.write(h.abs(VRAM_UPLOAD_ADDRESSES) + ctx.y, ctx.a);
      if (table === second) {
        h.load(h.read(h.abs(VRAM_SLOT_NEXT) + ctx.x));
        h.index('x', ctx.a);
      }
      h.modify(ptr, 'inc', true);
      h.modify(ptr, 'inc', true);
    }
  } while (h.modify(count, 'dec', true) !== 0);
}
// 80:AC2F: animation step of object X (PHY/PLY). $1140+X: 0 normal, FFFF restart, otherwise a new picture pointer.
export function stepObjectAnimation(h, events) {
  const { ctx } = h;
  h.phy();
  const done = () => {
    h.ply();
    return h.rts();
  };
  h.load(h.read(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x));
  let frame = null;
  if (!(ctx.status & FLAG_ZERO)) {
    h.cmp(PICTURE_RESTART);
    if (!(ctx.status & FLAG_ZERO)) {
      h.write(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x, 0);
      frame = 'pointer';
    } else h.write(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x, 0);
  }
  if (frame === null) {
    h.load(h.read(WRAM + OBJECT_ANIMATION_SPEED + ctx.x));
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.read(WRAM + OBJECT_ANIMATION_CLOCK + ctx.x));
    h.dpWrite(DP_CLOCK_SUM, ctx.a);
    h.load(ctx.a & ANIMATION_CLOCK_MASK);
    h.write(WRAM + OBJECT_ANIMATION_CLOCK + ctx.x, ctx.a);
    if (!(ctx.status & FLAG_CARRY)) {
      h.cmp(h.dp(DP_CLOCK_SUM));
      if (ctx.status & FLAG_ZERO) return done();
    }
    h.load(h.read(h.abs(OBJECT_ACTION_DIRECTIONS) + ctx.x));
    if (ctx.status & FLAG_ZERO) return done();
    h.dpWrite(DP_STREAM, ctx.a);
    h.load(h.read(WRAM + OBJECT_FRAME_REPEATS + ctx.x));
    h.load(ctx.a - 1);
    h.write(WRAM + OBJECT_FRAME_REPEATS + ctx.x, ctx.a);
    if (!(ctx.status & FLAG_ZERO)) {
      h.load(h.read(h.abs(OBJECT_FRAME_OFFSET) + ctx.x));
      h.index('y', ctx.a);
      h.load(ctx.a + 1);
      h.load(ctx.a + 1);
      h.write(h.abs(OBJECT_FRAME_OFFSET) + ctx.x, ctx.a);
      h.load(h.read(h.indirect(DP_STREAM, ctx.y)));
      frame = 'stream';
    } else {
      h.load(h.read(h.abs(OBJECT_FRAME_COUNT) + ctx.x));
      if (!(ctx.status & FLAG_ZERO)) {
        h.cmp(FRAME_COUNT_ONCE);
        if (ctx.status & FLAG_CARRY) {
          h.load(ctx.a & FRAME_COUNT_MASK);
          h.write(h.abs(OBJECT_FRAME_COUNT) + ctx.x, 0);
        }
        h.write(WRAM + OBJECT_FRAME_REPEATS + ctx.x, ctx.a);
        h.load(h.read(h.abs(OBJECT_ACTION_DIRECTIONS) + ctx.x));
        h.dpWrite(DP_POINTER, ctx.a);
        h.load(FRAME_BANK);
        h.dpWrite(DP_POINTER_BANK, ctx.a);
        h.index('y', h.read(h.abs(OBJECT_DIRECTION) + ctx.x));
        h.load(h.read(h.indirect(DP_POINTER, ctx.y)));
        // AC8D has loaded the full WORD before the observed NMI resumes at
        // AC8F's AND. Preserve that genuine accumulator and its flags.
        if (events?.startupInterrupts) interruptStep(h, events, 0x80ac8f);
        h.load(ctx.a & BYTE_MASK);
        h.index('y', ctx.a);
        h.load(ctx.a + 1);
        h.load(ctx.a + 1);
        h.write(h.abs(OBJECT_FRAME_OFFSET) + ctx.x, ctx.a);
        h.load(h.read(h.indirect(DP_STREAM, ctx.y)));
        frame = 'stream';
      } else {
        // Animation finished: 7E4088 = 0, bit 15 in $1038, event 8 to the object's task.
        h.load(0);
        h.write(WRAM + OBJECT_ANIMATION_SPEED + ctx.x, ctx.a);
        h.load(h.read(h.abs(OBJECT_SELECTION) + ctx.x) | ANIMATION_ENDED);
        h.write(h.abs(OBJECT_SELECTION) + ctx.x, ctx.a);
        h.load(h.read(h.abs(OBJECT_TASK) + ctx.x));
        if (!(ctx.status & FLAG_NEGATIVE)) {
          h.index('x', ctx.a);
          for (;;) {
            h.load(h.read(h.abs(TASK_WAIT) + ctx.x));
            if (!(ctx.status & FLAG_NEGATIVE)) break;
            h.load(h.read(h.abs(TASK_PREVIOUS) + ctx.x));
            h.index('x', ctx.a);
          }
          h.load(h.read(h.abs(TASK_EVENTS) + ctx.x) | ANIMATION_END_EVENT);
          h.write(h.abs(TASK_EVENTS) + ctx.x, ctx.a);
        }
        return done();
      }
    }
  }
  // ACD0: new picture pointer A (bit 15: bank 9C instead of 9B), fit the picture's tiles to the slot chain.
  h.dpWrite(DP_POINTER, ctx.a);
  h.load(ctx.a & PICTURE_HIGH_BANK);
  h.load(ctx.a ^ PICTURE_HIGH_BANK);
  h.dpWrite(DP_PICTURE_BIT, ctx.a);
  h.load(ctx.a ^ PICTURE_HIGH_BANK);
  h.asl();
  h.load(PICTURE_BANK);
  h.adc(0);
  h.dpWrite(DP_POINTER_BANK, ctx.a);
  h.dpWrite(DP_PICTURE_BANK, ctx.a);
  h.load(PICTURE_HIGH_BANK);
  h.testBits(DP_POINTER, true, true);
  h.load(h.dp(DP_POINTER));
  h.dpWrite(DP_PICTURE_START, ctx.a);
  h.load(h.read(h.indirect(DP_POINTER)) & BYTE_MASK);
  h.dpWrite(DP_TILE_COUNT, ctx.a);
  h.asl();
  h.asl();
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.dp(DP_VRAM_UPLOAD_INDEX));
  let fits = true;
  if (!(ctx.status & FLAG_CARRY)) {
    h.cmp(VRAM_UPLOAD_INDEX_LIMIT);
    if (ctx.status & FLAG_CARRY) fits = false;
    else ctx.status |= FLAG_CARRY;
  }
  if (!fits) {
    h.load(h.dp(DP_POINTER));
    h.load(ctx.a ^ h.dp(DP_PICTURE_BIT));
    h.write(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x, ctx.a);
    return done();
  }
  h.load(h.dp(DP_TILE_COUNT));
  h.sbc(h.read(h.abs(OBJECT_VRAM_SLOT_COUNT) + ctx.x));
  if (!(ctx.status & FLAG_ZERO)) {
    if (ctx.status & FLAG_CARRY) {
      // more slots: take them from the free list $0D1E if enough are free
      h.cmp(h.read(h.abs(VRAM_SLOT_COUNT)));
      if (ctx.status & FLAG_CARRY) {
        h.load(h.dp(DP_POINTER));
        h.load(ctx.a ^ h.dp(DP_PICTURE_BIT));
        h.write(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x, ctx.a);
        return done();
      }
      h.dpWrite(DP_SLOT_CHANGE, ctx.a);
      ctx.status |= FLAG_CARRY;
      h.load(h.read(h.abs(VRAM_SLOT_COUNT)));
      h.sbc(h.dp(DP_SLOT_CHANGE));
      h.write(h.abs(VRAM_SLOT_COUNT), ctx.a);
      do {
        h.index('y', h.read(h.abs(VRAM_SLOT_FREE_LIST)));
        h.load(h.read(h.abs(VRAM_SLOT_NEXT) + ctx.y));
        h.write(h.abs(VRAM_SLOT_FREE_LIST), ctx.a);
        h.load(h.read(h.abs(OBJECT_VRAM_SLOT_HEAD) + ctx.x));
        h.write(h.abs(VRAM_SLOT_NEXT) + ctx.y, ctx.a);
        h.load(ctx.y);
        h.write(h.abs(OBJECT_VRAM_SLOT_HEAD) + ctx.x, ctx.a);
      } while (h.modify(DP_SLOT_CHANGE, 'dec', true) !== 0);
    } else {
      // fewer slots: return the surplus ones to the free list
      h.load(ctx.a ^ WORD_MASK);
      h.load(ctx.a + 1);
      h.dpWrite(DP_SLOT_CHANGE, ctx.a);
      ctx.status &= ~FLAG_CARRY;
      h.adc(h.read(h.abs(VRAM_SLOT_COUNT)));
      h.write(h.abs(VRAM_SLOT_COUNT), ctx.a);
      do {
        h.index('y', h.read(h.abs(OBJECT_VRAM_SLOT_HEAD) + ctx.x));
        h.load(h.read(h.abs(VRAM_SLOT_NEXT) + ctx.y));
        h.write(h.abs(OBJECT_VRAM_SLOT_HEAD) + ctx.x, ctx.a);
        h.load(h.read(h.abs(VRAM_SLOT_FREE_LIST)));
        h.write(h.abs(VRAM_SLOT_FREE_LIST), ctx.y);
        h.write(h.abs(VRAM_SLOT_NEXT) + ctx.y, ctx.a);
      } while (h.modify(DP_SLOT_CHANGE, 'dec', true) !== 0);
    }
    h.load(h.dp(DP_TILE_COUNT));
    h.write(h.abs(OBJECT_VRAM_SLOT_COUNT) + ctx.x, ctx.a);
  }
  h.phx();
  h.modify(DP_POINTER, 'inc', true);
  h.index('y', h.dp(DP_VRAM_UPLOAD_INDEX));
  h.load(h.read(h.abs(OBJECT_VRAM_SLOT_HEAD) + ctx.x));
  h.index('x', ctx.a);
  queueTiles(h, DP_POINTER, DP_TILE_COUNT, SLOT_VRAM_FIRST, SLOT_VRAM_SECOND);
  h.dpWrite(DP_VRAM_UPLOAD_INDEX, ctx.y);
  h.plx();
  // End of the picture: offset, shadow mask and height of the picture.
  h.load(h.dp(DP_POINTER));
  h.load(ctx.a ^ h.dp(DP_PICTURE_BIT));
  h.write(WRAM + OBJECT_PICTURE + ctx.x, ctx.a);
  h.index('y', LAYOUT_FIRST_CELL);
  h.load(h.read(h.indirect(DP_POINTER, ctx.y)) & CELL_SHADOW_MASK);
  h.write(h.abs(OBJECT_DEPTH_RULE) + ctx.x, ctx.a);
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(ctx.a | DEPTH_RULE_SHADOW);
    h.write(h.abs(OBJECT_DEPTH_RULE) + ctx.x, ctx.a);
    h.modify(DP_PICTURE_START, 'dec', true);
    h.load(h.read(h.indirect(DP_PICTURE_START)));
    h.bit(BYTE_SIGN);
    if (ctx.status & FLAG_ZERO) h.load(ctx.a & BYTE_MASK);
    else h.load(ctx.a | HIGH_BYTE_MASK);
    h.asl();
    h.asl();
    h.write(h.abs(OBJECT_DEPTH_BIAS) + ctx.x, ctx.a);
  }
  return done();
}
// 80:AE12: request the tiles of object X again. If a picture change is running ($1140+X), it continues every
// frame via AC2F (1562 += 1, B0A1); otherwise the current picture is loaded again from the animation stream.
function runObjectTilesReload(h, events) {
  const { ctx } = h;
  h.load(h.read(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x));
  if (!(ctx.status & FLAG_ZERO)) {
    for (;;) {
      h.call(0x80ae17, 0x80ac2f, () => stepObjectAnimation(h, events));
      h.load(h.read(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x));
      if (ctx.status & FLAG_ZERO) return h.rts();
      // One frame later the NMI has processed the job list (DP82, $1562 observed).
      incrementJobLists(h, 0x80ae1f);
      observeRandomStateWait(h, events, 0x80ae23);
      nmiWords(h, events, 0x80ae23, [DP_VRAM_UPLOAD_INDEX, NMI_JOB_LISTS]);
    }
  }
  h.load(h.read(h.abs(OBJECT_ACTION_DIRECTIONS) + ctx.x));
  h.dpWrite(DP_STREAM, ctx.a);
  h.index('y', h.read(h.abs(OBJECT_FRAME_OFFSET) + ctx.x));
  h.index('y', ctx.y - 1);
  h.index('y', ctx.y - 1);
  h.load(h.read(h.indirect(DP_STREAM, ctx.y)));
  h.load(ctx.a + 1);
  h.dpWrite(DP_RELOAD_POINTER, ctx.a);
  h.load(PICTURE_BANK);
  h.dpWrite(DP_RELOAD_BANK, ctx.a);
  h.load(PICTURE_HIGH_BANK);
  h.testBits(DP_RELOAD_POINTER, true, true);
  if (!(ctx.status & FLAG_ZERO)) h.modify(DP_RELOAD_BANK, 'inc', true);
  h.load(h.read(h.abs(OBJECT_VRAM_SLOT_COUNT) + ctx.x));
  if (ctx.status & FLAG_ZERO) return h.rts();
  h.dpWrite(DP_RELOAD_COUNT, ctx.a);
  h.asl();
  h.asl();
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.dp(DP_VRAM_UPLOAD_INDEX));
  if (!(ctx.status & FLAG_CARRY)) {
    h.cmp(VRAM_UPLOAD_INDEX_LIMIT);
    if (ctx.status & FLAG_CARRY) {
      incrementJobLists(h, 0x80ae5a);
      waitWord(h, events, 0x80ae5e, NMI_JOB_LISTS, (v) => v === 0, [DP_VRAM_UPLOAD_INDEX]);
    }
  }
  h.index('y', h.dp(DP_VRAM_UPLOAD_INDEX));
  h.load(h.read(h.abs(OBJECT_VRAM_SLOT_HEAD) + ctx.x));
  h.index('x', ctx.a);
  queueTiles(h, DP_RELOAD_POINTER, DP_RELOAD_COUNT, SLOT_VRAM_FIRST, SLOT_VRAM_SECOND);
  h.dpWrite(DP_VRAM_UPLOAD_INDEX, ctx.y);
  return h.rts();
}
// 80:ADF4: request the tiles of all objects of the draw list $14B2 again, then wait for the NMI.
export function reloadObjectTiles(h, events) {
  const { ctx } = h;
  h.load(FRAME_BANK);
  h.dpWrite(DP_STREAM_BANK, ctx.a);
  h.index('y', h.read(h.abs(DRAW_LIST_INDEX)));
  do {
    h.index('x', h.read(h.abs(DRAW_LIST) + ctx.y));
    h.phy();
    h.call(0x80ae00, 0x80ae12, () => runObjectTilesReload(h, events));
    h.ply();
    h.index('y', ctx.y - 1);
    h.index('y', ctx.y - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  incrementJobLists(h, 0x80ae08);
  waitWord(h, events, 0x80ae0c, NMI_JOB_LISTS, (v) => v === 0, [DP_VRAM_UPLOAD_INDEX]);
  return h.rts();
}
