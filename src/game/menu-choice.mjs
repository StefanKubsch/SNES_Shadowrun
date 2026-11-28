import { navigationState } from '../state/menu.mjs';
// Menu choices share named navigation and drawing state. Repeat, paging, hotkeys
// and confirmation retain their existing input and sound behaviour.
import { segmentSequence } from '../system/sequence-runner.mjs';
import { takePad } from '../system/live-input-calls.mjs';
import { waitForCounterWord } from '../system/frame-wait.mjs';
import { playSoundEffect } from '../apu/sound-effect.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { drawList, markRow, MARK, UNMARK } from './menu-list.mjs';
import { requestTileClear } from './window-open.mjs';
import { WORD_MASK } from '../constants/bits.mjs';

export const MENU_WITH_HOTKEYS = 0x80a6a5,
  MENU_WITH_NUMBERS = 0x80a6ad,
  MENU_WITH_NUMBERS_AT = 0x80a6b8,
  MENU = 0x80a6c7;
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

// Choose from the menu list directly and return the selected row (FFFF on cancel).
// The renderer is a sequence. row is
// the preselected row of 80:A6B8 (A in the original).
export function* chooseFromMenu(h, events, renderBuffer = drawTextBuffer, entry, row = 0) {
  const { mem } = h.a;
  // The row's word index (Y in the original).
  let index = 0;
  const state = navigationState(h.a),
    token = () => state.textAt(index),
    hotkey = () => state.valueAt(index);
  const list = () => drawList(h, events, renderBuffer),
    mark = () => markRow(h, events, renderBuffer, MARK, index),
    unmark = () => markRow(h, events, renderBuffer, UNMARK, index),
    pad = () => segmentSequence(() => takePad(h, events));
  // The selected row is also retained in DP 00 for the existing state boundary.
  const selected = () => state.window;
  // The sound effect's arguments in the direct page (the result word 00 set to FFFF).
  const soundArguments = (effect) => {
    state.window = NONE;
    state.soundLevel = SOUND_LEVEL;
    state.soundVoices = SOUND_VOICES;
    state.soundEffect = effect;
  };
  // Confirm the selection: the sound, the row in 00, the pad word once more.
  const confirm = function* () {
    yield () => soundArguments(CONFIRM_SOUND);
    yield* segmentSequence(() =>
      playSoundEffect(mem, accessorPort(h.a), {
        object: state.window,
        effect: state.soundEffect,
        level: state.soundLevel,
        voices: state.soundVoices,
      }),
    );
    yield () => (state.window = state.selection >>> 1);
    yield* pad();
    return selected();
  };
  // Move to the row of the word index, with a new page past the page shown.
  const move = function* () {
    let page = false,
      target;
    yield () => {
      // The original keeps the row on the stack (PHA, PLA) over the redraw; that word
      // lies only in free stack bytes and is kept in a local here.
      target = index;
      const start = state.pageStart,
        rows = state.visibleRows,
        back = index < start,
        forward = !back && ((index - start) & WORD_MASK) >>> 1 >= rows;
      page = back || forward;
      if (!page) {
        index = state.selection;
        return;
      }
      if (forward) state.pageStart = addRowsTwice(start, rows);
      else {
        const { value, carry } = subtractRowsTwice(start, rows);
        state.pageStart = carry ? value : 0;
      }
    };
    if (page) {
      yield* requestTileClear(h, events);
      yield* list();
    } else yield* unmark();
    yield () => {
      index = target;
      state.selection = index;
    };
    yield* mark();
    yield () => {
      // PEI 00, PEI 06, the move sound's arguments, PLA, PLA: the sound is not played and
      // the two words are restored.
      const first = state.window,
        rows = state.visibleRows;
      soundArguments(MOVE_SOUND);
      state.visibleRows = rows;
      state.window = first;
    };
  };
  // The move a newly pressed button asks for, if any (the row's word index in index).
  const navigate = () => {
    const input = state.navigationInput;
    if (input & DOWN) {
      index = (state.selection + 2) & WORD_MASK;
      return token() !== 0;
    }
    if (input & UP) {
      index = state.selection;
      if (!index) return false;
      index = (index - 2) & WORD_MASK;
      return true;
    }
    if (state.hotkeys) return false;
    const pressed = state.pressed;
    if (pressed & PAGE_BACK) {
      const start = state.pageStart;
      if (!start) return false;
      index = subtractRowsTwice(start, state.visibleRows).value;
      return true;
    }
    if (!(pressed & PAGE_FORWARD)) return false;
    let left = state.visibleRows;
    index = state.pageStart;
    do {
      index = (index + 2) & WORD_MASK;
      if (!token()) return false;
      left = (left - 1) & WORD_MASK;
    } while (left);
    return true;
  };

  yield () => {
    if (entry === MENU_WITH_NUMBERS_AT) {
      state.selection = row << 1;
      state.showNumbers = NONE;
      state.hotkeys = 0;
    } else if (entry === MENU_WITH_NUMBERS) {
      state.showNumbers = NONE;
      state.hotkeys = 0;
      state.selection = 0;
    } else {
      state.hotkeys = entry === MENU_WITH_HOTKEYS ? NONE : 0;
      state.showNumbers = 0;
      state.selection = 0;
    }
    state.column = state.argumentColumn;
    state.row = state.argumentRow;
    state.pageStart = 0;
    state.repeatCounter = 0;
  };
  yield* list();
  yield () => {
    index = state.selection;
  };
  yield* mark();
  for (;;) {
    yield* waitForCounterWord(h, events);
    yield* pad();
    let branch;
    yield () => {
      state.navigationInput = state.pressed;
      if (state.held & VERTICAL) {
        const count = (state.repeatCounter + 1) & WORD_MASK;
        state.repeatCounter = count;
        if (count === REPEAT_DELAY) {
          state.repeatCounter = REPEAT_AGAIN;
          state.navigationInput = state.held;
        }
      } else state.repeatCounter = 0;
      const pressed = state.pressed;
      if (pressed & CANCEL) branch = 'cancel';
      else if (pressed & CONFIRM) branch = 'confirm';
      else return void (branch = 'navigate');
      index = state.selection;
    };
    if (branch === 'cancel') {
      yield* unmark();
      yield () => (state.window = NONE);
      yield* pad();
      return selected();
    }
    if (branch === 'confirm') {
      yield* unmark();
      return yield* confirm();
    }
    let moving = false;
    yield () => {
      moving = navigate();
    };
    if (moving) yield* move();
    let hotkeys = false;
    yield () => {
      hotkeys = state.hotkeys !== 0;
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
        hit = (hotkey() & state.pressed) !== 0;
        if (hit) {
          position = index;
          index = state.selection;
        } else index = (index + 2) & WORD_MASK;
      };
      if (end) break;
      if (hit) {
        yield* unmark();
        yield () => (state.selection = position);
        return yield* confirm();
      }
    }
  }
}

// A choice from a list of texts (docs/READABLE-GAME.md): the window, the list's column,
// row and visible rows, and its texts. The texts go to the menu list buffer, which the
// list drawing reads; returns the chosen row, or NO_CHOICE after a cancel.
export const NO_CHOICE = NONE;
export function* chooseFromList(h, events, renderBuffer, options) {
  yield () => navigationState(h.a).configure(options);
  yield* chooseFromMenu(
    h,
    events,
    renderBuffer,
    options.values ? MENU_WITH_NUMBERS_AT : MENU,
    options.selectedRow ?? 0,
  );
  return navigationState(h.a).window;
}
