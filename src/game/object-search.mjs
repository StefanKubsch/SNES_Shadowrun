// The glove's object search (lifted from 80:BCBE; register-level version in
// proof/replay/native-glove.mjs, which the glove natives keep calling).
//
// At rest, the glove looks for the object under it. The draw list is searched from its
// last entry down; an object qualifies with a picture (its action directions not zero)
// and a name (the kind table 8C:EFB0), and kind 0B only for the spell glove or an open
// spell aim or script choice. Its box is projected to the screen: the vertical test
// takes the glove's base minus the diagonal, the height and the camera (in quarter
// pixels, so shifted right twice) against the box's top and bottom, the horizontal test
// the base plus y minus x and the camera against its left and right edge.
//
// The first object that holds the glove is marked: its kind and slot are noted, the
// glove's offset from it is recorded, and its name goes into the name window at the
// bottom right (a runner's name from the runner table, any other kind's from the kind
// table). The object marked before lets go of its window first (80:BE5B). The same
// object again only pulls the glove to the recorded offset, while it stays within FF;
// further away it lets go. Without an object under the glove a marked one lets go.
//
// The name window release 80:BE5B (lifted in window-release.mjs), the text width
// 80:FADD (text-width.mjs), the window 80:F963 and the text 80:FE69 run directly; the
// return words of the original's JSRs to them lie only in free stack bytes. Registers (user decision 2026-11-17): game state only; the width comes
// from the direct page word BA, the original's carry chains are word arithmetic, and
// the search leaves no A, X, Y or flags. The direct page words 0E, 11, 14, 17 and 1A (the glove on the screen and
// relative to the object, the kind index) are written as the original writes them.
import { segmentSequence } from '../system/native-call-continuation.mjs';
import { releaseGloveNameWindowSequence } from './window-release.mjs';
import { printText } from './text-print.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { openWindow } from './window-open.mjs';
import { measure } from './text-width.mjs';
import { GLOVE_KIND_SPELL } from '../script/native-glove-crosshair-limits.mjs';
import { taskStop } from '../system/task-stop.mjs';
import {
  AIMING_SPELL,
  CAMERA_X,
  CAMERA_Y,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  GLOVE_BASE_X,
  GLOVE_BASE_Y,
  GLOVE_KIND,
  GLOVE_NAME_WINDOW,
  GLOVE_SNAP_X,
  GLOVE_SNAP_Y,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  GLOVE_X,
  GLOVE_Y,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_DIAGONAL,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_KIND,
  OBJECT_NUMBER,
  OBJECT_X,
  OBJECT_Y,
  SCRIPT_GLOVE_CHOICE,
  TEXT_WORK_WORD,
  WRAM,
} from '../data/wram.mjs';
import { KIND_ITEM_CLASS_MASK, KIND_NO_NAME, KIND_TABLE } from '../data/kinds.mjs';
import { RUNNER_LAST_INDEX, RUNNER_NAMES, RUNNER_TABLE } from '../data/runners.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

// Kind 0B is only offered to the spell glove or an open spell aim or script choice.
const RESTRICTED_KIND = 0x0b,
  // The glove snaps to the marked object while it stays within FF of the offset.
  SNAP_RANGE = BYTE_MASK,
  // Kind class 3 (object flags bits 0 and 1) names a runner.
  RUNNER_CLASS = 3,
  // The runner table's name column in its bank.
  RUNNER_NAME_COLUMN = (RUNNER_TABLE & ~WORD_MASK) | RUNNER_NAMES,
  // The screen and object positions are in quarter pixels.
  QUARTER_SHIFT = 2;
// The direct page words: the glove on the screen, relative to the object, the kind index.
const DP_SCREEN_X = 0x0e,
  DP_SCREEN_Y = 0x11,
  DP_OBJECT_X = 0x14,
  DP_OBJECT_Y = 0x17,
  DP_KIND_INDEX = 0x1a,
  DP_TEXT = 0,
  DP_TEXT_COPY = 2;
// The name window at the bottom right: three rows from row 17, (width + 18) / 8 columns
// left of column 1E, attributes 0800.
const WINDOW_PADDING = 0x18,
  WINDOW_PIXEL_SHIFT = 3,
  WINDOW_RIGHT = 0x1e,
  WINDOW_TOP = 0x17,
  WINDOW_ROWS = 3,
  WINDOW_ATTRIBUTES = 0x800;
// The object fields read through the data bank 80 lie below this.
const LOW_WRAM_END = 0x2000;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
// Word arithmetic as the original's SEC; SBC, ASL and LSR.
const sub = (left, right) => (left - right) & WORD_MASK,
  shiftLeft = (value) => (value << 1) & WORD_MASK;
// The kind table entry: the kind times 2 and 4 added with the carry of the second ASL
// (ASL, STA, ASL, ADC).
const kindEntry = (kind) => {
  const twice = shiftLeft(kind);
  return { twice, entry: (shiftLeft(twice) + twice + (twice >>> (WORD_BITS - 1))) & WORD_MASK };
};

// Search the glove's object (80:BCBE) for lifted callers, without the JSR frame (the
// caller's return word lies only in free stack bytes): h the main loop's access (direct
// page 0, data bank 80), events its frame events, renderBuffer the text-buffer renderer.
export function* objectSearch(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem;
  // A field below 2000, read in the data bank 80 as the original; a field of the
  // object tables in bank 7E.
  const near = (field, slot) => {
    if (field + slot + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { slot });
    return word(wram, field + slot);
  };
  const far = (field, slot) => longWord(mem, WRAM + field + slot);
  const kindName = (kind) => {
    const { twice, entry } = kindEntry(kind);
    setWord(wram, DP_KIND_INDEX, twice);
    return entry;
  };

  // Does the object in slot hold the glove? With the original's direct page words.
  const holds = (slot, screenX, screenY) => {
    if (!near(OBJECT_ACTION_DIRECTIONS, slot)) return false;
    const kind = far(OBJECT_KIND, slot);
    if (
      kind === RESTRICTED_KIND &&
      word(wram, GLOVE_KIND) !== GLOVE_KIND_SPELL &&
      !(word(wram, AIMING_SPELL) | word(wram, SCRIPT_GLOVE_CHOICE))
    )
      return false;
    const entry = kindName(kind);
    setWord(wram, DP_KIND_INDEX, slot);
    if (longWord(mem, KIND_TABLE + entry) === KIND_NO_NAME) return false;
    // Vertical: the glove's height on the screen above the object's base.
    let rise = word(wram, GLOVE_BASE_Y);
    for (const right of [
      near(OBJECT_DIAGONAL, slot),
      near(OBJECT_HEIGHT, slot),
      word(wram, CAMERA_Y),
    ])
      rise = sub(rise, right);
    if (rise & WORD_SIGN) return false;
    const objectY = rise >>> QUARTER_SHIFT;
    setWord(wram, DP_OBJECT_Y, objectY);
    const top = sub(sub(shiftLeft(objectY), far(OBJECT_BOX_X1, slot)), far(OBJECT_BOX_Y1, slot));
    if (top & WORD_SIGN || top >>> 1 < screenY) return false;
    const bottom = sub(
      sub(shiftLeft(sub(objectY, far(OBJECT_BOX_HEIGHT, slot))), far(OBJECT_BOX_X2, slot)),
      far(OBJECT_BOX_Y2, slot),
    );
    if (!(bottom & WORD_SIGN) && bottom >>> 1 >= screenY) return false;
    // Horizontal: the glove across the object's base; a negative distance is shifted
    // with its sign twice (SEC; ROR) before the two plain shifts.
    let across = (word(wram, GLOVE_BASE_X) + near(OBJECT_Y, slot)) & WORD_MASK;
    across = sub(sub(across, near(OBJECT_X, slot)), word(wram, CAMERA_X));
    if (across & WORD_SIGN) across = WORD_SIGN | (WORD_SIGN >>> 1) | (across >>> QUARTER_SHIFT);
    const objectX = across >>> QUARTER_SHIFT;
    setWord(wram, DP_OBJECT_X, objectX);
    const left = (sub(objectX, far(OBJECT_BOX_X1, slot)) + far(OBJECT_BOX_Y2, slot)) & WORD_MASK;
    if (left & WORD_SIGN || left < screenX) return false;
    const right = sub((objectX + far(OBJECT_BOX_Y1, slot)) & WORD_MASK, far(OBJECT_BOX_X2, slot));
    return (right & WORD_SIGN) !== 0 || right < screenX;
  };

  let slot = null,
    tag;
  yield () => {
    let y = word(wram, DRAW_LIST_INDEX);
    if (!(y & WORD_SIGN)) {
      const screenX = wram[GLOVE_X + 1],
        screenY = wram[GLOVE_Y + 1];
      setWord(wram, DP_SCREEN_X, screenX);
      setWord(wram, DP_SCREEN_Y, screenY);
      for (;;) {
        if (DRAW_LIST + y + 1 >= LOW_WRAM_END) taskStop('draw_list_required', { index: y });
        const candidate = word(wram, DRAW_LIST + y);
        if (holds(candidate, screenX, screenY)) {
          slot = candidate;
          break;
        }
        y = (y - 2) & WORD_MASK;
        if (y & WORD_SIGN) break;
      }
    }
    tag = word(wram, GLOVE_TARGET_TAG);
  };
  const marked = !(tag & WORD_SIGN);
  if (slot === null) {
    if (marked) yield* releaseGloveNameWindowSequence(h, events);
    return;
  }
  let same = false;
  if (marked) {
    yield () => {
      same = tag === far(OBJECT_KIND, slot) && slot === word(wram, GLOVE_TARGET_OBJECT);
    };
  }
  if (same) {
    // The same object: the glove goes to the recorded offset, or lets go further away.
    for (const [dp, offset, position] of [
      [DP_OBJECT_X, GLOVE_SNAP_X, GLOVE_X],
      [DP_OBJECT_Y, GLOVE_SNAP_Y, GLOVE_Y],
    ]) {
      let away;
      yield () => {
        const distance = sub(word(wram, dp), word(wram, offset));
        away = distance >= SNAP_RANGE;
        // XBA: the distance becomes the high byte.
        if (!away) setWord(wram, position, distance << BYTE_BITS);
      };
      if (away) {
        yield* releaseGloveNameWindowSequence(h, events);
        return;
      }
    }
    return;
  }
  // Another object was marked: it lets go first. The original keeps the slot and later
  // the name text on the stack; those words lie only in free stack bytes and are kept in
  // locals here (game state only, user decision 2026-11-17).
  if (marked) yield* releaseGloveNameWindowSequence(h, events);
  let text;
  yield () => {
    // The glove's offset from the object, its kind and slot, and its name.
    setWord(wram, GLOVE_SNAP_X, sub(word(wram, DP_OBJECT_X), word(wram, DP_SCREEN_X)));
    setWord(wram, GLOVE_SNAP_Y, sub(word(wram, DP_OBJECT_Y), word(wram, DP_SCREEN_Y)));
    const kind = far(OBJECT_KIND, slot);
    setWord(wram, GLOVE_TARGET_TAG, kind);
    setWord(wram, GLOVE_TARGET_OBJECT, slot);
    if ((near(OBJECT_FLAGS, slot) & KIND_ITEM_CLASS_MASK) === RUNNER_CLASS) {
      // The runner whose object number it is, from the last row down; with none the
      // index ends at FFFE and the name is read before the column.
      const number = near(OBJECT_NUMBER, slot);
      let x = RUNNER_LAST_INDEX;
      for (;;) {
        if (number === longWord(mem, RUNNER_TABLE + x)) break;
        x = (x - 2) & WORD_MASK;
        if (x & WORD_SIGN) break;
      }
      text = longWord(mem, RUNNER_NAME_COLUMN + x);
    } else text = longWord(mem, KIND_TABLE + kindName(kind));
    setWord(wram, DP_TEXT, text);
  };
  yield* segmentSequence(() => measure(h, 0));
  yield () => {
    // The window's columns from the text width (DP BA), and its place.
    let columns =
      ((word(wram, TEXT_WORK_WORD) + WINDOW_PADDING) & WORD_MASK) >>> WINDOW_PIXEL_SHIFT;
    // Edited names can exceed the screen; FB39 clips their remaining glyphs.
    if (mem.language) columns = Math.min(columns, WINDOW_RIGHT - 1);
    setWord(wram, DP_WINDOW_COLUMNS, columns);
    setWord(wram, DP_WINDOW_LEFT, sub(WINDOW_RIGHT, columns));
    setWord(wram, DP_WINDOW_TOP, WINDOW_TOP);
    setWord(wram, DP_WINDOW_ROWS, WINDOW_ROWS);
    setWord(wram, DP_WINDOW_ATTRIBUTES, WINDOW_ATTRIBUTES);
  };
  yield* openWindow(h, events);
  yield () => {
    setWord(wram, GLOVE_NAME_WINDOW, word(wram, DP_TEXT));
    setWord(wram, DP_TEXT_COPY, text);
  };
  yield* printText(h, events, renderBuffer);
}
// The RTS form for register-level callers is objectSearchJsr in
// proof/caller/jsr-forms.mjs.
