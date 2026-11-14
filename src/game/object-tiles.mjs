// The objects' tiles requested again (lifted from 80:ADF4 with 80:AE12; register-level
// versions in src/task/native-scene-tiles.mjs stay the reference).
//
// After the dialog the portraits have overwritten the objects' tiles in video memory, so
// each object of the draw list (7E:14B2, from its last index 7E:14B0 down) has its
// tiles queued for the NMI's upload again (80:AE12). An object whose picture change
// (OBJECT_PICTURE_CHANGE) is still waiting runs the animation step 80:AC2F
// (object-animation.mjs) until the change is taken, one frame apart (the job count
// 7E:1562 raised by 81:A954 and the word wait 81:B0A1). Otherwise its current picture is
// the frame stream's word before the frame offset (bank 8C at the action directions);
// the picture (bank 9B, 9C with bit 15) has its tiles queued in the object's VRAM slots:
// two jobs per tile, the source in bank 8E and up, the slot's two VRAM halves from the
// tables 80:AEB4 and 80:AEC4. A picture that would fill the upload list past 50 first
// waits until the NMI has emptied the job lists. At the end one more job list is
// counted and the routine waits until the NMI has run them all.
//
// The direct page words of the original are written as it writes them (3E to 40 the
// frame stream, 41 to 43 the picture, 44 the tile count, 82 the upload index). The
// routine leaves A 0 with zero set and sign clear, X the last object's last slot (or
// what its animation step leaves), Y the draw list index below 0, and the carry and
// overflow of the last object's last addition, as the original. Each object's slot
// index is pushed around its reload (PHY, PLY), and the frames of the inner calls are
// pushed as the original's JSR and JSL. With the lag-free frame model the NMI arrives
// at the waits' branches 80:AE61 and 80:AE0F; otherwise the recorded observations or
// interrupts are replayed as by the register-level routine. The word wait comes from
// the caller's routine table.
import {
  dialogCallBody,
  dialogCallSequence,
  segmentSequence,
} from '../task/native-call-continuation.mjs';
import { nmiWords, waitWord } from '../task/native-dialog-portrait.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
import { nmiAtBranch } from '../system/frame-wait.mjs';
import { stepAnimation } from './object-animation.mjs';
import { CarryArithmetic } from './carry-arithmetic.mjs';
import { taskStop } from '../task/plan.mjs';
import {
  DP_VRAM_UPLOAD_INDEX,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  NMI_JOB_LISTS,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_FRAME_OFFSET,
  OBJECT_PICTURE_CHANGE,
  OBJECT_VRAM_SLOT_COUNT,
  OBJECT_VRAM_SLOT_HEAD,
  VRAM_SLOT_NEXT,
  VRAM_UPLOAD_ADDRESSES,
  VRAM_UPLOAD_BANKS,
  VRAM_UPLOAD_SOURCES,
} from '../task/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';

// The direct page words: the frame stream with its bank, the picture with its bank and
// the tiles left to queue.
const DP_STREAM = 0x3e,
  DP_STREAM_BANK = 0x40,
  DP_PICTURE = 0x41,
  DP_PICTURE_BANK = 0x43,
  DP_TILES = 0x44;
const FRAME_BANK = 0x8c,
  PICTURE_BANK = 0x9b,
  HIGH_PICTURE = WORD_SIGN,
  // The stream's word before the frame offset is the picture shown.
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
  LOW_WRAM_END = 0x2000;
// Original call sites, and the waits' loads (their branches follow the 3-byte load).
const RELOAD_CALL = [0x80ae00, 0x80ae12],
  ANIMATION_CALL = [0x80ae17, 0x80ac2f],
  WAIT_CALL = [0x80ae23, 0x81b0a1, true],
  CHANGE_COUNT_SITE = 0x80ae1f,
  FULL_COUNT_SITE = 0x80ae5a,
  END_COUNT_SITE = 0x80ae08,
  FULL_WAIT = 0x80ae5e,
  END_WAIT = 0x80ae0c,
  LOAD_BYTES = 3,
  JSL_LAST_BYTE = 3;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const signAndZero = (ctx, value) => {
  flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  flag(ctx, FLAG_ZERO, value === 0);
};

// One more job list for the NMI (JSL 81:A954 at site): its frame stays below the stack.
function countJobList(h, site) {
  const { ctx } = h,
    { wram } = h.a.mem;
  h.pushByte(ctx.programBank);
  h.a.pushWord((site + JSL_LAST_BYTE) & WORD_MASK);
  ctx.s = (ctx.s + JSL_LAST_BYTE) & WORD_MASK;
  const jobs = (word(wram, NMI_JOB_LISTS) + 1) & WORD_MASK;
  setWord(wram, NMI_JOB_LISTS, jobs);
  signAndZero(ctx, jobs);
}

// Wait at the load site until the NMI has run all job lists (LDA 7E:1562, BNE back).
function* waitForJobLists(h, events, site) {
  const { ctx } = h,
    { wram } = h.a.mem;
  if (!lagFree(events)) {
    yield () => waitWord(h, events, site, NMI_JOB_LISTS, (v) => v === 0, [DP_VRAM_UPLOAD_INDEX]);
    return;
  }
  for (let value; (value = word(wram, NMI_JOB_LISTS)) !== 0;) {
    ctx.a = value;
    const status =
      (ctx.status & ~(FLAG_MEMORY_8BIT | FLAG_NEGATIVE | FLAG_ZERO)) |
      (value & WORD_SIGN ? FLAG_NEGATIVE : 0);
    yield* nmiAtBranch(h, events, site + LOAD_BYTES, status);
  }
  yield () => {
    ctx.a = 0;
    signAndZero(ctx, 0);
  };
}

// Request the tiles of the draw list's objects again (80:ADF4), a sequence for a native
// call continuation, called with JSR: routines the caller's table with 81:B0A1.
export function* reloadObjectTilesSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  yield () => {
    setWord(wram, DP_STREAM_BANK, FRAME_BANK);
    ctx.y = word(wram, DRAW_LIST_INDEX);
  };
  do {
    yield () => {
      // The draw list through the data bank, as the original's LDX abs,Y.
      ctx.x = longWord(mem, (ctx.bank << WORD_BITS) + DRAW_LIST + ctx.y);
      h.a.pushWord(ctx.y);
    };
    yield* dialogCallBody(h, ...RELOAD_CALL, () => reloadSequence(h, events, routines));
    yield () => {
      ctx.y = (h.a.pullWord() - FRAME_STEP) & WORD_MASK;
      signAndZero(ctx, ctx.y);
    };
  } while (!(ctx.y & WORD_SIGN));
  yield () => countJobList(h, END_COUNT_SITE);
  yield* waitForJobLists(h, events, END_WAIT);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// Request the tiles of the object in X again (80:AE12, called with JSR).
function* reloadSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    slot = ctx.x;
  // A field read in the data bank 80 below 2000.
  const near = (field, index = slot) => {
    if (field + index + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { field, index });
    return field + index;
  };
  const get = (field, index) => word(wram, near(field, index)),
    put = (field, value, index) => setWord(wram, near(field, index), value),
    pointer = (dp) => word(wram, dp) | (wram[dp + 2] << WORD_BITS);

  // A picture change still waiting: the animation step takes it, a frame apart.
  let change = 0;
  yield () => {
    change = ctx.a = get(OBJECT_PICTURE_CHANGE);
    signAndZero(ctx, change);
  };
  if (change) {
    for (;;) {
      yield* dialogCallBody(h, ...ANIMATION_CALL, () =>
        segmentSequence(() => stepAnimation(h, events)),
      );
      let waiting = false;
      yield () => {
        ctx.a = get(OBJECT_PICTURE_CHANGE, ctx.x);
        signAndZero(ctx, ctx.a);
        waiting = ctx.a !== 0;
        if (waiting) countJobList(h, CHANGE_COUNT_SITE);
      };
      if (!waiting) return yield* rts(h);
      yield* dialogCallSequence(h, events, routines, ...WAIT_CALL);
      if (!lagFree(events))
        yield () => nmiWords(h, events, WAIT_CALL[0], [DP_VRAM_UPLOAD_INDEX, NMI_JOB_LISTS]);
    }
  }

  // The current picture: the stream's word before the frame offset.
  let tiles = 0,
    full = false,
    math;
  yield () => {
    math = new CarryArithmetic(ctx);
    const directions = get(OBJECT_ACTION_DIRECTIONS);
    setWord(wram, DP_STREAM, directions);
    ctx.y = (get(OBJECT_FRAME_OFFSET) - FRAME_STEP) & WORD_MASK;
    const picture = (longWord(mem, pointer(DP_STREAM) + ctx.y) + 1) & WORD_MASK;
    setWord(wram, DP_PICTURE, picture | HIGH_PICTURE);
    setWord(wram, DP_PICTURE_BANK, PICTURE_BANK + (picture & HIGH_PICTURE ? 1 : 0));
    tiles = get(OBJECT_VRAM_SLOT_COUNT);
    ctx.a = tiles;
    signAndZero(ctx, tiles);
    if (!tiles) return;
    setWord(wram, DP_TILES, tiles);
    const jobs = math.add((tiles << TILE_JOB_SHIFT) & WORD_MASK, word(wram, DP_VRAM_UPLOAD_INDEX));
    // Past FFFF the original does not compare and does not wait.
    if (!math.carry) {
      math.compare(jobs, UPLOAD_LIMIT);
      full = math.carry;
    }
    ctx.a = jobs;
    flag(ctx, FLAG_CARRY, math.carry);
    flag(ctx, FLAG_OVERFLOW, math.overflow);
    if (full) countJobList(h, FULL_COUNT_SITE);
  };
  if (!tiles) return yield* rts(h);
  if (full) yield* waitForJobLists(h, events, FULL_WAIT);

  // Two upload jobs per tile into the object's slots.
  yield () => {
    let job = word(wram, DP_VRAM_UPLOAD_INDEX),
      tileSlot = get(OBJECT_VRAM_SLOT_HEAD);
    for (let n = tiles; n; n--) {
      for (const half of SLOT_HALVES) {
        job = (job + 2) & WORD_MASK;
        const tile = longWord(mem, pointer(DP_PICTURE));
        put(VRAM_UPLOAD_SOURCES, tile & SOURCE_OFFSET, job);
        put(VRAM_UPLOAD_BANKS, math.add(tile & SOURCE_BANK, FIRST_SOURCE_BANK), job);
        ctx.a = longWord(mem, half + tileSlot);
        put(VRAM_UPLOAD_ADDRESSES, ctx.a, job);
        if (half === SLOT_HALVES[1]) {
          tileSlot = get(VRAM_SLOT_NEXT, tileSlot);
          ctx.a = tileSlot;
        }
        setWord(wram, DP_PICTURE, word(wram, DP_PICTURE) + 2);
      }
    }
    setWord(wram, DP_TILES, 0);
    setWord(wram, DP_VRAM_UPLOAD_INDEX, job);
    ctx.x = tileSlot;
    ctx.y = job;
    math.apply(ctx, 0);
  };
  return yield* rts(h);
}

function* rts(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
