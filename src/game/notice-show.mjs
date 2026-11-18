// Show a notice window (lifted from 80:FEC1; register-level version in
// proof/replay/native-notice.mjs, which the other callers still use).
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
// The window opening and text are composed directly through their call frames,
// as is the release with the frame and slot the
// original pushes; the minimum the original pushes, and its allocation, lie on the
// stack around them. The text number must point within bank 80
// (notice_text_required past it).
//
// Registers (user decision 2026-11-17): game state only. The notice returns its window
// in shown.window (A in the original) and leaves no registers; the register form for
// register-level callers is noticeRoutineSequence.
import { taskStop } from '../system/task-stop.mjs';
import { dialogCallBody } from '../system/native-call-continuation.mjs';
import { openWindowSequence, requestTileClearSequence } from './window-open.mjs';
import { waitForConfirmKeySequence } from './confirm-key.mjs';
import { printTextSequence } from './text-print.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
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
  WINDOW_CURSOR_PIXEL,
  WINDOW_CURSOR_TILE,
  WINDOW_LEFT_PIXEL,
  WINDOW_TILE_INITIAL,
  WINDOW_TILE_START,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

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
  RELEASE_SITE = 0x80ff04,
  // The routines a paged notice adds between its pages.
  CONFIRM_KEY = 0x80f953,
  TILE_CLEAR = 0x80fa67;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// A translated notice too long for the text tiles left (fitNoticeWindow): its pages
// one after another in the same window, each after a confirming key (80:F953) and
// with the window's tiles cleared (80:FA67) and its text cursor back at the start.
// The last page stays, as a whole notice would. A port extension; the waits run
// through call frames at the text call site.
function* pagesSequence(h, events, renderBuffer, { id, pages }) {
  const { mem } = h.a,
    { wram } = mem,
    window = word(wram, DP_WINDOW),
    text = word(wram, DP_TEXT);
  for (let page = 0; page < pages.length; page++) {
    if (page) {
      yield* dialogCallBody(h, TEXT_CALL[0], CONFIRM_KEY, () =>
        waitForConfirmKeySequence(h, events),
      );
      yield () => setWord(wram, DP_WINDOW, window);
      yield* dialogCallBody(h, TEXT_CALL[0], TILE_CLEAR, () => requestTileClearSequence(h, events));
      yield () => {
        setWord(wram, WINDOW_CURSOR_TILE + window, word(wram, WINDOW_TILE_START + window));
        setWord(wram, WINDOW_TILE_INITIAL + window, word(wram, WINDOW_TILE_START + window));
        setWord(wram, WINDOW_CURSOR_PIXEL + window, 0);
        setWord(wram, WINDOW_LEFT_PIXEL + window, 0);
        setWord(wram, DP_WINDOW, window);
        setWord(wram, DP_TEXT, text);
      };
    }
    yield () => {
      mem.noticePage = { id, codes: pages[page] };
    };
    yield* dialogCallBody(h, ...TEXT_CALL, () => printTextSequence(h, events, renderBuffer));
    yield () => {
      mem.noticePage = null;
    };
  }
}

// Show the notice (80:FEC1), a sequence for a native call continuation: h the caller's
// access (direct page 0, data bank 80), events its frame events, and renderBuffer
// the text-buffer renderer sequence; shown receives the window and the slot.
export function* showNoticeSequence(h, events, renderBuffer = drawTextBufferSequence, shown = {}) {
  const { mem } = h.a,
    { wram } = mem,
    call = (site, body) => dialogCallBody(h, ...site, body);
  let paged = null;
  yield () => {
    paged = fitNoticeWindow(
      mem,
      (offset) => word(wram, offset),
      (offset, value) => setWord(wram, offset, value),
    );
    if (word(wram, DP_WINDOW_ATTRIBUTES) === EFFECT_ATTRIBUTES)
      setWord(wram, NOTICE_EFFECT_FRAMES, EFFECT_FRAMES);
  };
  yield* call(WINDOW_CALL, () => openWindowSequence(h, events));
  yield () => {
    h.a.pushWord(word(wram, DP_WINDOW));
    const text = word(wram, DP_NOTICE_TEXT),
      x = (text << 1) & WORD_MASK,
      at = TEXT_NUMBERS + x;
    if (at + 1 > BANK_END) taskStop('notice_text_required', { text });
    setWord(wram, DP_TEXT, mem.read8(at) | (mem.read8(at + 1) << BYTE_BITS));
  };
  if (paged) yield* pagesSequence(h, events, renderBuffer, paged);
  else yield* call(TEXT_CALL, () => printTextSequence(h, events, renderBuffer));
  let replace = false,
    slot;
  yield () => {
    // The last free slot from the top; on the way the fewest frames (the last of equal
    // ones) and their slot. The minimum lies on the stack as the original pushes it.
    let minimum = WORD_MASK,
      fewest;
    for (let x = NOTICE_WINDOW_LAST; x >= 0; x -= 2) {
      if (word(wram, NOTICE_WINDOWS + x) & WORD_SIGN) {
        h.a.pushWord(minimum);
        slot = x;
        return;
      }
      const frames = word(wram, NOTICE_FRAMES + x);
      if (minimum >= frames) {
        minimum = frames;
        fewest = x;
      }
    }
    // All used: release the window with the fewest frames left (the slot and the
    // release's return word on the stack, as the original).
    h.a.pushWord(minimum);
    slot = fewest;
    setWord(wram, DP_WINDOW, word(wram, NOTICE_WINDOWS + slot));
    h.a.pushWord(slot);
    h.a.pushWord((RELEASE_SITE + JSR_LAST_BYTE) & WORD_MASK);
    replace = true;
  };
  if (replace) {
    yield* releaseWindowSequence(h, events);
    yield () => {
      h.a.pullWord();
      h.a.pullWord();
    };
  }
  let result;
  yield () => {
    setWord(wram, NOTICE_FRAMES + slot, word(wram, DP_NOTICE_FRAMES));
    h.a.pullWord();
    const window = h.a.pullWord();
    setWord(wram, NOTICE_WINDOWS + slot, window);
    shown.window = window;
    shown.slot = slot;
    result = h.rts();
  };
  return result;
}

// The notice for register-level callers: A the window with its sign and zero and X the
// slot, as the original leaves them.
export function* noticeRoutineSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const shown = {},
    result = yield* showNoticeSequence(h, events, renderBuffer, shown),
    { ctx } = h;
  ctx.a = shown.window;
  ctx.x = shown.slot;
  ctx.status &= ~(FLAG_NEGATIVE | FLAG_ZERO);
  if (shown.window & WORD_SIGN) ctx.status |= FLAG_NEGATIVE;
  if (shown.window === 0) ctx.status |= FLAG_ZERO;
  return result;
}
