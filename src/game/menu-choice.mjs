// A choice from a menu list (lifted from 80:A6A5 to 80:A845; register-level version in
// proof/replay/native-menu-compose.mjs stays the reference).
//
// The caller passes the window in the direct page word 00, the list's column and row in
// 02 and 04, its visible rows in 06, the long pointer to its texts (words ended by 0) in
// 08 to 0A and, for numbers or hotkeys, a word list in 0C (data bank). Four entries
// differ in their start: 80:A6A5 with hotkeys, 80:A6AD with numbers, 80:A6B8 with numbers
// and the row in A preselected, 80:A6C7 plain. The list is drawn (80:A617) and the
// selection marked (80:A5F9, menu-list.mjs).
//
// Every frame (the word wait 81:B0A1, then the pad word 80:9E1A) the newly pressed
// buttons are taken; up or down held for 20 frames repeats every frame after (the
// counter set back to 19). Y cancels: the mark is removed (80:A5DB) and FFFF is the
// result. B, A, X or Start confirm: the mark is removed, the confirm sound 4C plays
// (80:C46E) and the selected row is the result. Down moves to the next row while one
// follows, up to the one before; without hotkeys R and L page forward and back by the
// visible rows. A move past the page shows the next or previous page (the window's text
// tiles cleared by 80:FA67, the list drawn again), otherwise the old mark is removed;
// then the new row is marked. A menu with hotkeys confirms the first row whose hotkey
// word (the list in 0C) has a newly pressed button. The result is left in the direct page
// word 00 after the pad word is taken once more.
//
// The frame wait, pad word and sound are composed directly. Only the text buffer
// renderer is passed as a sequence; drawing, marks and tile clearing are
// direct sequences. The former dispatched menu remains in proof/caller/menu-choice.mjs.
// Registers (user decision 2026-11-17): game state only; the preselected row of 80:A6B8
// is a parameter, the marks take the row's word index as a parameter, and the routine
// leaves no A, X, Y or flags (the result is in the direct page word 00). The list
// position's push around a hotkey and a move's pushes of the direct page words 00 and 06
// (around the move sound's arguments, which the original sets up and restores without
// playing it) lie only in free stack bytes and are kept in locals.
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { frameWaitCallSequence, takePad } from '../system/live-input-calls.mjs';
import { playSoundEffectRoutine } from '../apu/sound-effect.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { drawListSequence, markRowSequence, MARK, UNMARK } from './menu-list.mjs';
import { requestTileClear } from './window-open.mjs';
import {
  DP_LIST_TOKEN_BANK,
  DP_LIST_TOKENS,
  DP_LIST_VALUES,
  DP_MENU_COLUMN,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
  MENU_COLUMN,
  MENU_HOTKEYS,
  MENU_NAVIGATION_INPUT,
  MENU_PAGE_START,
  MENU_REPEAT_COUNTER,
  MENU_ROW,
  MENU_SELECTION,
  MENU_SHOW_NUMBERS,
  PAD_HELD,
  PAD_PRESSED,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

export const MENU_WITH_HOTKEYS = 0x80a6a5,
  MENU_WITH_NUMBERS = 0x80a6ad,
  MENU_WITH_NUMBERS_AT = 0x80a6b8,
  MENU = 0x80a6c7;
// The result (the window before) and the sound effect argument in the direct page.
const DP_RESULT = 0,
  DP_SOUND_EFFECT = 2;
const NONE = WORD_MASK,
  SOUND_LEVEL = 0x40,
  SOUND_VOICES = 3,
  CONFIRM_SOUND = 0x4c,
  MOVE_SOUND = 0x4a,
  REPEAT_DELAY = 0x14,
  REPEAT_AGAIN = 0x13,
  // The pad bits (src/system/joypad.mjs): down, up, both, Y, the confirming B, A, X
  // and Start, and R and L.
  DOWN = 0x400,
  UP = 0x800,
  VERTICAL = 0xc00,
  CANCEL = 0x2000,
  CONFIRM = 0xd0c0,
  PAGE_BACK = 0x20,
  PAGE_FORWARD = 0x10;
// The original's call sites.
const SITES = Object.freeze({
  list: 0x80a6e0,
  mark: 0x80a6e6,
  wait: 0x80a6e9,
  pageList: 0x80a7fa,
  moveUnmark: 0x80a78e,
  moveMark: 0x80a795,
  hotkeyUnmark: 0x80a7d1,
  confirmUnmark: 0x80a802,
  sound: 0x80a819,
  cancelUnmark: 0x80a829,
});
const WAIT = 0x81b0a1,
  SOUND = 0x80c46e,
  LIST = 0x80a617,
  MARK_ROW = 0x80a5f9,
  UNMARK_ROW = 0x80a5db;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// Two additions of the visible rows with the carry chained (CLC, ADC, ADC).
const addRowsTwice = (start, rows) => {
  const first = start + rows;
  return ((first & WORD_MASK) + rows + (first > WORD_MASK ? 1 : 0)) & WORD_MASK;
};
// Two subtractions with the borrow chained (SEC, SBC, SBC), and the final carry.
const subtractRowsTwice = (start, rows) => {
  const first = start - rows,
    second = (first & WORD_MASK) - rows - (first < 0 ? 1 : 0);
  return { value: second & WORD_MASK, carry: second >= 0 };
};

// Choose from the menu list (entry one of the four above), a sequence for a native call
// continuation, called with JSR, with an explicit text-buffer renderer sequence. row is
// the preselected row of 80:A6B8 (A in the original).
export function* chooseFromMenuSequence(
  h,
  events,
  renderBuffer = drawTextBufferSequence,
  entry,
  row = 0,
) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  // The row's word index (Y in the original).
  let index = 0;
  const field = (at) => word(wram, at),
    store = (at, value) => setWord(wram, at, value),
    longWord = (at) => mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS),
    // The list's texts at the long pointer, the hotkey words through the data bank.
    token = () =>
      longWord((field(DP_LIST_TOKENS) | (wram[DP_LIST_TOKEN_BANK] << WORD_BITS)) + index),
    hotkey = () => longWord(((ctx.bank << WORD_BITS) | field(DP_LIST_VALUES)) + index);
  const helper = (site, target, body) => dialogCallBody(h, site, target, body);
  const list = (site) => helper(site, LIST, () => drawListSequence(h, events, renderBuffer)),
    mark = (site) =>
      helper(site, MARK_ROW, () => markRowSequence(h, events, renderBuffer, MARK, index)),
    unmark = (site) =>
      helper(site, UNMARK_ROW, () => markRowSequence(h, events, renderBuffer, UNMARK, index)),
    pad = () => segmentSequence(() => takePad(h, events));
  let result;
  const rts = function* () {
    yield () => {
      result = h.rts();
    };
    return result;
  };
  // The sound effect's arguments in the direct page (the result word 00 set to FFFF).
  const soundArguments = (effect) => {
    store(DP_RESULT, NONE);
    store(DP_SOUND_LEVEL, SOUND_LEVEL);
    store(DP_SOUND_VOICE, SOUND_VOICES);
    store(DP_SOUND_EFFECT, effect);
  };
  // Confirm the selection: the sound, the row in 00, the pad word once more.
  const confirm = function* () {
    yield () => soundArguments(CONFIRM_SOUND);
    yield* helper(SITES.sound, SOUND, () => segmentSequence(() => playSoundEffectRoutine(h)));
    yield () => store(DP_RESULT, field(MENU_SELECTION) >>> 1);
    yield* pad();
    return yield* rts();
  };
  // Move to the row of the word index, with a new page past the page shown.
  const move = function* () {
    let page = false,
      target;
    yield () => {
      // The original keeps the row on the stack (PHA, PLA) over the redraw; that word
      // lies only in free stack bytes and is kept in a local here.
      target = index;
      const start = field(MENU_PAGE_START),
        rows = field(DP_MENU_VISIBLE_ROWS),
        back = index < start,
        forward = !back && ((index - start) & WORD_MASK) >>> 1 >= rows;
      page = back || forward;
      if (!page) {
        index = field(MENU_SELECTION);
        return;
      }
      if (forward) store(MENU_PAGE_START, addRowsTwice(start, rows));
      else {
        const { value, carry } = subtractRowsTwice(start, rows);
        store(MENU_PAGE_START, carry ? value : 0);
      }
    };
    if (page) {
      yield* requestTileClear(h, events);
      yield* list(SITES.pageList);
    } else yield* unmark(SITES.moveUnmark);
    yield () => {
      index = target;
      store(MENU_SELECTION, index);
    };
    yield* mark(SITES.moveMark);
    yield () => {
      // PEI 00, PEI 06, the move sound's arguments, PLA, PLA: the sound is not played and
      // the two words are restored.
      const first = field(DP_RESULT),
        rows = field(DP_MENU_VISIBLE_ROWS);
      soundArguments(MOVE_SOUND);
      store(DP_MENU_VISIBLE_ROWS, rows);
      store(DP_RESULT, first);
    };
  };
  // The move a newly pressed button asks for, if any (the row's word index in index).
  const navigate = () => {
    const input = field(MENU_NAVIGATION_INPUT);
    if (input & DOWN) {
      index = (field(MENU_SELECTION) + 2) & WORD_MASK;
      return token() !== 0;
    }
    if (input & UP) {
      index = field(MENU_SELECTION);
      if (!index) return false;
      index = (index - 2) & WORD_MASK;
      return true;
    }
    if (field(MENU_HOTKEYS)) return false;
    const pressed = field(PAD_PRESSED);
    if (pressed & PAGE_BACK) {
      const start = field(MENU_PAGE_START);
      if (!start) return false;
      index = subtractRowsTwice(start, field(DP_MENU_VISIBLE_ROWS)).value;
      return true;
    }
    if (!(pressed & PAGE_FORWARD)) return false;
    let left = field(DP_MENU_VISIBLE_ROWS);
    index = field(MENU_PAGE_START);
    do {
      index = (index + 2) & WORD_MASK;
      if (!token()) return false;
      left = (left - 1) & WORD_MASK;
    } while (left);
    return true;
  };

  yield () => {
    if (entry === MENU_WITH_NUMBERS_AT) {
      store(MENU_SELECTION, row << 1);
      store(MENU_SHOW_NUMBERS, NONE);
      store(MENU_HOTKEYS, 0);
    } else if (entry === MENU_WITH_NUMBERS) {
      store(MENU_SHOW_NUMBERS, NONE);
      store(MENU_HOTKEYS, 0);
      store(MENU_SELECTION, 0);
    } else {
      store(MENU_HOTKEYS, entry === MENU_WITH_HOTKEYS ? NONE : 0);
      store(MENU_SHOW_NUMBERS, 0);
      store(MENU_SELECTION, 0);
    }
    store(MENU_COLUMN, field(DP_MENU_COLUMN));
    store(MENU_ROW, field(DP_MENU_ROW));
    store(MENU_PAGE_START, 0);
    store(MENU_REPEAT_COUNTER, 0);
  };
  yield* list(SITES.list);
  yield () => {
    index = field(MENU_SELECTION);
  };
  yield* mark(SITES.mark);
  for (;;) {
    yield* dialogCallBody(h, SITES.wait, WAIT, () => frameWaitCallSequence(h, events), true);
    yield* pad();
    let branch;
    yield () => {
      store(MENU_NAVIGATION_INPUT, field(PAD_PRESSED));
      if (field(PAD_HELD) & VERTICAL) {
        const count = (field(MENU_REPEAT_COUNTER) + 1) & WORD_MASK;
        store(MENU_REPEAT_COUNTER, count);
        if (count === REPEAT_DELAY) {
          store(MENU_REPEAT_COUNTER, REPEAT_AGAIN);
          store(MENU_NAVIGATION_INPUT, field(PAD_HELD));
        }
      } else store(MENU_REPEAT_COUNTER, 0);
      const pressed = field(PAD_PRESSED);
      if (pressed & CANCEL) branch = 'cancel';
      else if (pressed & CONFIRM) branch = 'confirm';
      else return void (branch = 'navigate');
      index = field(MENU_SELECTION);
    };
    if (branch === 'cancel') {
      yield* unmark(SITES.cancelUnmark);
      yield () => store(DP_RESULT, NONE);
      yield* pad();
      return yield* rts();
    }
    if (branch === 'confirm') {
      yield* unmark(SITES.confirmUnmark);
      return yield* confirm();
    }
    let moving = false;
    yield () => {
      moving = navigate();
    };
    if (moving) yield* move();
    let hotkeys = false;
    yield () => {
      hotkeys = field(MENU_HOTKEYS) !== 0;
      if (hotkeys) index = 0;
    };
    if (!hotkeys) continue;
    for (;;) {
      let end = false,
        hit = false,
        position;
      yield () => {
        end = token() === 0;
        if (end) return;
        hit = (hotkey() & field(PAD_PRESSED)) !== 0;
        if (hit) {
          position = index;
          index = field(MENU_SELECTION);
        } else index = (index + 2) & WORD_MASK;
      };
      if (end) break;
      if (hit) {
        yield* unmark(SITES.hotkeyUnmark);
        yield () => store(MENU_SELECTION, position);
        return yield* confirm();
      }
    }
  }
}
