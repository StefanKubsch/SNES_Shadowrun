// Search drawn objects from front to back, retain the marked offset and show its name.
// Object projection arithmetic and live aliases retain their original behaviour.
import { gloveState } from '../state/glove.mjs';
import { lowObjectWord, longObjectWord } from '../state/objects.mjs';
import { segmentSequence } from '../system/sequence-runner.mjs';
import { releaseGloveNameWindowSequence } from './window-release.mjs';
import { printText } from './text-print.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { openWindow } from './window-open.mjs';
import { measure } from './text-width.mjs';
import { GLOVE_KIND_SPELL } from '../script/native-glove-crosshair-limits.mjs';
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
// The name window at the bottom right: three rows from row 17, (width + 18) / 8 columns
// left of column 1E, attributes 0800.
const WINDOW_PADDING = 0x18,
  WINDOW_PIXEL_SHIFT = 3,
  WINDOW_RIGHT = 0x1e,
  WINDOW_TOP = 0x17,
  WINDOW_ROWS = 3,
  WINDOW_ATTRIBUTES = 0x800;
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

export function* objectSearch(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    { wram } = mem,
    glove = gloveState(mem);
  // A field below 2000, read in the data bank 80 as the original; a field of the
  // object tables in bank 7E.
  const near = (name, slot) => lowObjectWord(wram, name, slot),
    far = (name, slot) => longObjectWord(mem, name, slot);
  const kindName = (kind) => {
    const { twice, entry } = kindEntry(kind);
    glove.search.kindIndex = twice;
    return entry;
  };

  // Does the object in slot hold the glove? With the original's direct page words.
  const holds = (slot, screenX, screenY) => {
    if (!near('actionDirections', slot)) return false;
    const kind = far('kind', slot);
    if (
      kind === RESTRICTED_KIND &&
      glove.kind !== GLOVE_KIND_SPELL &&
      !(glove.aimingSpell | glove.scriptChoice)
    )
      return false;
    const entry = kindName(kind);
    glove.search.kindIndex = slot;
    if (longWord(mem, KIND_TABLE + entry) === KIND_NO_NAME) return false;
    // Vertical: the glove's height on the screen above the object's base.
    let rise = glove.baseY;
    for (const right of [near('diagonal', slot), near('height', slot), glove.camera.y])
      rise = sub(rise, right);
    if (rise & WORD_SIGN) return false;
    const objectY = rise >>> QUARTER_SHIFT;
    glove.search.objectY = objectY;
    const top = sub(sub(shiftLeft(objectY), far('boxX1', slot)), far('boxY1', slot));
    if (top & WORD_SIGN || top >>> 1 < screenY) return false;
    const bottom = sub(
      sub(shiftLeft(sub(objectY, far('boxHeight', slot))), far('boxX2', slot)),
      far('boxY2', slot),
    );
    if (!(bottom & WORD_SIGN) && bottom >>> 1 >= screenY) return false;
    // Horizontal: the glove across the object's base; a negative distance is shifted
    // with its sign twice (SEC; ROR) before the two plain shifts.
    let across = (glove.baseX + near('y', slot)) & WORD_MASK;
    across = sub(sub(across, near('x', slot)), glove.camera.x);
    if (across & WORD_SIGN) across = WORD_SIGN | (WORD_SIGN >>> 1) | (across >>> QUARTER_SHIFT);
    const objectX = across >>> QUARTER_SHIFT;
    glove.search.objectX = objectX;
    const left = (sub(objectX, far('boxX1', slot)) + far('boxY2', slot)) & WORD_MASK;
    if (left & WORD_SIGN || left < screenX) return false;
    const right = sub((objectX + far('boxY1', slot)) & WORD_MASK, far('boxX2', slot));
    return (right & WORD_SIGN) !== 0 || right < screenX;
  };

  let slot = null,
    tag;
  yield () => {
    let y = glove.drawIndex;
    if (!(y & WORD_SIGN)) {
      const screenX = glove.x >>> BYTE_BITS,
        screenY = glove.y >>> BYTE_BITS;
      glove.search.screenX = screenX;
      glove.search.screenY = screenY;
      for (;;) {
        const candidate = glove.drawObject(y);
        if (holds(candidate, screenX, screenY)) {
          slot = candidate;
          break;
        }
        y = (y - 2) & WORD_MASK;
        if (y & WORD_SIGN) break;
      }
    }
    tag = glove.targetTag;
  };
  const marked = !(tag & WORD_SIGN);
  if (slot === null) {
    if (marked) yield* releaseGloveNameWindowSequence(h, events);
    return;
  }
  let same = false;
  if (marked) {
    yield () => {
      same = tag === far('kind', slot) && slot === glove.targetObject;
    };
  }
  if (same) {
    // The same object: the glove goes to the recorded offset, or lets go further away.
    for (const [coordinate, offset, position] of [
      ['objectX', 'snapX', 'x'],
      ['objectY', 'snapY', 'y'],
    ]) {
      let away;
      yield () => {
        const distance = sub(glove.search[coordinate], glove[offset]);
        away = distance >= SNAP_RANGE;
        // XBA: the distance becomes the high byte.
        if (!away) glove[position] = distance << BYTE_BITS;
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
    glove.snapX = sub(glove.search.objectX, glove.search.screenX);
    glove.snapY = sub(glove.search.objectY, glove.search.screenY);
    const kind = far('kind', slot);
    glove.targetTag = kind;
    glove.targetObject = slot;
    if ((near('flags', slot) & KIND_ITEM_CLASS_MASK) === RUNNER_CLASS) {
      // The runner whose object number it is, from the last row down; with none the
      // index ends at FFFE and the name is read before the column.
      const number = near('number', slot);
      let x = RUNNER_LAST_INDEX;
      for (;;) {
        if (number === longWord(mem, RUNNER_TABLE + x)) break;
        x = (x - 2) & WORD_MASK;
        if (x & WORD_SIGN) break;
      }
      text = longWord(mem, RUNNER_NAME_COLUMN + x);
    } else text = longWord(mem, KIND_TABLE + kindName(kind));
    glove.windows.windowArgument = text;
  };
  yield* segmentSequence(() => measure(h, 0));
  yield () => {
    // The window's columns from the text width (DP BA), and its place.
    let columns = ((glove.decoding.width + WINDOW_PADDING) & WORD_MASK) >>> WINDOW_PIXEL_SHIFT;
    // Edited names can exceed the screen; FB39 clips their remaining glyphs.
    if (mem.language) columns = Math.min(columns, WINDOW_RIGHT - 1);
    glove.windows.opening.columns = columns;
    glove.windows.opening.left = sub(WINDOW_RIGHT, columns);
    glove.windows.opening.top = WINDOW_TOP;
    glove.windows.opening.rows = WINDOW_ROWS;
    glove.windows.opening.attributes = WINDOW_ATTRIBUTES;
  };
  yield* openWindow(h, events);
  yield () => {
    glove.nameWindow = glove.windows.windowArgument;
    glove.windows.valueArgument = text;
  };
  yield* printText(h, events, renderBuffer);
}
