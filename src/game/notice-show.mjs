// Show a notice window (lifted from 80:FEC1; register-level version in
// src/task/native-notice.mjs, which the other callers still use).
//
// The caller sets the window in the direct page words 02 to 08 (left, top, columns,
// rows, attributes), the text number in 0A and the frames the notice stays in 0C. The
// text language may resize the window first (src/data/language.mjs). A window with the
// attributes 0400 starts 30 frames of the notice effect (7E:0202). The window is
// opened (80:F963, which leaves it in the direct page word 00) and the text number's
// pointer (80:D9B8) is printed into it (80:FE69). The notice takes the last free one
// of the four notice slots; with all four used it replaces the one with the fewest
// frames left (the last of equal ones), whose window is released (80:FA3E, lifted in
// window-release.mjs).
//
// The window opening and the text are still register-level and run through their
// frames from the routine table, as does the release with the frame and the slot the
// original pushes; the minimum the original pushes, and its allocation, lie on the
// stack around them. The notice leaves A the window with its sign and zero, X the
// slot, and Y, the carry and the overflow as the original: those of the last frames
// comparison, or of the callee that ran last. The text number must point within bank
// 80 (notice_text_required past it).
import { taskStop } from '../task/plan.mjs';
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { fitNoticeWindow } from '../data/language.mjs';
import { releaseWindowSequence } from './window-release.mjs';
import {
  DP_NOTICE_FRAMES,
  DP_NOTICE_TEXT,
  DP_WINDOW_ATTRIBUTES,
  NOTICE_EFFECT_FRAMES,
  NOTICE_FRAMES,
  NOTICE_WINDOW_LAST,
  NOTICE_WINDOWS,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const EFFECT_ATTRIBUTES = 0x400,
  EFFECT_FRAMES = 30,
  TEXT_NUMBERS = 0x80d9b8,
  BANK_END = 0x80ffff,
  DP_WINDOW = 0x00,
  DP_TEXT = 0x02,
  // A JSR pushes the address of its last byte.
  JSR_LAST_BYTE = 2;
// Original call sites and callees.
const WINDOW_CALL = [0x80fece, 0x80f963],
  TEXT_CALL = [0x80fedd, 0x80fe69],
  RELEASE_SITE = 0x80ff04;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const signAndZero = (ctx, value) => {
  flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  flag(ctx, FLAG_ZERO, value === 0);
};
// The sign, zero and carry of the original's CMP.
const compare = (ctx, left, right) => {
  flag(ctx, FLAG_CARRY, left >= right);
  signAndZero(ctx, (left - right) & WORD_MASK);
};

// Show the notice (80:FEC1), a sequence for a native call continuation: h the caller's
// access (direct page 0, data bank 80), events its frame events, routines the table
// with the window opening and the text.
export function* showNoticeSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    call = ([site, target]) => nativeCallSequence(h, events, routines, site, target);
  yield () => {
    fitNoticeWindow(
      mem,
      (offset) => word(wram, offset),
      (offset, value) => setWord(wram, offset, value),
    );
    // The callees read no flags, so only A is passed on as the original leaves it.
    ctx.a = word(wram, DP_WINDOW_ATTRIBUTES);
    if (ctx.a !== EFFECT_ATTRIBUTES) return;
    ctx.a = EFFECT_FRAMES;
    setWord(wram, NOTICE_EFFECT_FRAMES, EFFECT_FRAMES);
  };
  yield* call(WINDOW_CALL);
  yield () => {
    h.a.pushWord(word(wram, DP_WINDOW));
    const text = word(wram, DP_NOTICE_TEXT),
      x = (text << 1) & WORD_MASK,
      at = TEXT_NUMBERS + x;
    if (at + 1 > BANK_END) taskStop('notice_text_required', { text });
    ctx.x = x;
    ctx.a = mem.read8(at) | (mem.read8(at + 1) << BYTE_BITS);
    setWord(wram, DP_TEXT, ctx.a);
  };
  yield* call(TEXT_CALL);
  let replace = false;
  yield () => {
    // The last free slot from the top; on the way the fewest frames (the last of equal
    // ones) and their slot in Y. A free slot ends the search with its window loaded.
    let minimum = WORD_MASK;
    for (let x = NOTICE_WINDOW_LAST; x >= 0; x -= 2) {
      const window = word(wram, NOTICE_WINDOWS + x);
      if (window & WORD_SIGN) {
        h.a.pushWord(minimum);
        ctx.x = x;
        return;
      }
      const frames = word(wram, NOTICE_FRAMES + x);
      compare(ctx, minimum, frames);
      if (minimum >= frames) {
        minimum = frames;
        ctx.y = x;
      }
    }
    // All used: release the window with the fewest frames left.
    h.a.pushWord(minimum);
    ctx.x = ctx.y;
    setWord(wram, DP_WINDOW, word(wram, NOTICE_WINDOWS + ctx.x));
    h.a.pushWord(ctx.x);
    h.a.pushWord((RELEASE_SITE + JSR_LAST_BYTE) & WORD_MASK);
    replace = true;
  };
  if (replace) {
    yield* releaseWindowSequence(h, events);
    yield () => {
      h.a.pullWord();
      ctx.x = h.a.pullWord();
    };
  }
  let result;
  yield () => {
    setWord(wram, NOTICE_FRAMES + ctx.x, word(wram, DP_NOTICE_FRAMES));
    h.a.pullWord();
    ctx.a = h.a.pullWord();
    signAndZero(ctx, ctx.a);
    setWord(wram, NOTICE_WINDOWS + ctx.x, ctx.a);
    result = h.rts();
  };
  return result;
}
