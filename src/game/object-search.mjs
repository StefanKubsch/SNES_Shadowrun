// The glove's object search (lifted from 80:BCBE; register-level version in
// src/task/native-glove.mjs, which the glove natives keep calling).
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
// 80:FADD (text-width.mjs), the window 80:F963 and the text 80:FE69 (from the routine
// table; the main loop binds the lifted ones) run through their frames with the A, X, Y
// and flags the original passes them. Where no callee runs last, A, X, Y and the flags are
// left as the original leaves them: the glove action and the scheduler round start
// with them. The direct page words 0E, 11, 14, 17 and 1A (the glove on the screen and
// relative to the object, the kind index) are written as the original writes them.
import { dialogCallBody, segmentSequence } from '../task/native-call-continuation.mjs';
import { releaseNameWindowCallSequence } from './window-release.mjs';
import { routineCall } from '../task/native-glove-target-support.mjs';
import { measureTextWidthRoutine } from './text-width.mjs';
import { GLOVE_KIND_SPELL } from '../task/native-glove-crosshair-limits.mjs';
import { taskStop } from '../task/plan.mjs';
import { CarryArithmetic } from './carry-arithmetic.mjs';
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
  WRAM,
} from '../task/wram.mjs';
import { KIND_ITEM_CLASS_MASK, KIND_NO_NAME, KIND_TABLE } from '../data/kinds.mjs';
import { RUNNER_LAST_INDEX, RUNNER_NAMES, RUNNER_TABLE } from '../data/runners.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

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
// Original call sites: the releases (no object, the same object too far away, another
// object marked before), the text width, the window and the text.
const RELEASE_TARGET = 0x80be5b,
  RELEASE_NONE_CALL = 0x80bd9e,
  RELEASE_AWAY_CALL = 0x80be57,
  RELEASE_OTHER_CALL = 0x80bdb6,
  WIDTH_CALL = 0x80be06,
  WIDTH_TARGET = 0x80fadd,
  WINDOW_CALL = 0x80be29,
  WINDOW_TARGET = 0x80f963,
  TEXT_CALL = 0x80be34,
  TEXT_TARGET = 0x80fe69,
  LOW_WRAM_END = 0x2000;

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

// Search the glove's object (80:BCBE), a sequence for a native call continuation: h the
// main loop's access (direct page 0, data bank 80), events its frame events, routines
// the table of the register-level callees.
export function* objectSearchSequence(h, events, routines) {
  const { ctx, a } = h,
    { mem } = a,
    { wram } = mem,
    math = new CarryArithmetic(ctx);
  // A field below 2000, read in the data bank 80 as the original; a field of the
  // object tables in bank 7E.
  const near = (field, slot) => {
    if (field + slot + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { slot });
    return word(wram, field + slot);
  };
  const far = (field, slot) => longWord(mem, WRAM + field + slot);
  const kindName = (kind) => {
    const twice = math.shiftLeft(kind);
    setWord(wram, DP_KIND_INDEX, twice);
    const four = math.shiftLeft(twice);
    return math.add(four, twice, math.carry);
  };

  // Does the object in slot hold the glove? With the original's direct page words.
  const holds = (slot, screenX, screenY) => {
    if (!near(OBJECT_ACTION_DIRECTIONS, slot)) return false;
    const kind = far(OBJECT_KIND, slot);
    math.compare(kind, RESTRICTED_KIND);
    if (kind === RESTRICTED_KIND) {
      const glove = word(wram, GLOVE_KIND);
      math.compare(glove, GLOVE_KIND_SPELL);
      if (
        glove !== GLOVE_KIND_SPELL &&
        !(word(wram, AIMING_SPELL) | word(wram, SCRIPT_GLOVE_CHOICE))
      )
        return false;
    }
    const entry = kindName(kind);
    setWord(wram, DP_KIND_INDEX, slot);
    const name = longWord(mem, KIND_TABLE + entry);
    math.compare(name, KIND_NO_NAME);
    if (name === KIND_NO_NAME) return false;
    // Vertical: the glove's height on the screen above the object's base.
    let rise = word(wram, GLOVE_BASE_Y);
    for (const right of [
      near(OBJECT_DIAGONAL, slot),
      near(OBJECT_HEIGHT, slot),
      word(wram, CAMERA_Y),
    ])
      rise = math.sub(rise, right);
    if (rise & WORD_SIGN) return false;
    const objectY = math.shiftRight(rise, QUARTER_SHIFT);
    setWord(wram, DP_OBJECT_Y, objectY);
    let top = math.shiftLeft(objectY);
    top = math.sub(top, far(OBJECT_BOX_X1, slot));
    top = math.sub(top, far(OBJECT_BOX_Y1, slot));
    if (top & WORD_SIGN) return false;
    math.compare(math.shiftRight(top, 1), screenY);
    if (!math.carry) return false;
    let bottom = math.sub(objectY, far(OBJECT_BOX_HEIGHT, slot));
    bottom = math.shiftLeft(bottom);
    bottom = math.sub(bottom, far(OBJECT_BOX_X2, slot));
    bottom = math.sub(bottom, far(OBJECT_BOX_Y2, slot));
    if (!(bottom & WORD_SIGN)) {
      math.compare(math.shiftRight(bottom, 1), screenY);
      if (math.carry) return false;
    }
    // Horizontal: the glove across the object's base; a negative distance is shifted
    // with its sign twice (SEC; ROR) before the two plain shifts.
    let across = math.add(word(wram, GLOVE_BASE_X), near(OBJECT_Y, slot));
    across = math.sub(across, near(OBJECT_X, slot));
    across = math.sub(across, word(wram, CAMERA_X));
    if (across & WORD_SIGN) across = WORD_SIGN | (WORD_SIGN >>> 1) | (across >>> QUARTER_SHIFT);
    const objectX = math.shiftRight(across, QUARTER_SHIFT);
    setWord(wram, DP_OBJECT_X, objectX);
    const left = math.add(math.sub(objectX, far(OBJECT_BOX_X1, slot)), far(OBJECT_BOX_Y2, slot));
    if (left & WORD_SIGN) return false;
    math.compare(left, screenX);
    if (!math.carry) return false;
    const right = math.sub(math.add(objectX, far(OBJECT_BOX_Y1, slot)), far(OBJECT_BOX_X2, slot));
    if (right & WORD_SIGN) return true;
    math.compare(right, screenX);
    return !math.carry;
  };

  const release = (pc) =>
    dialogCallBody(h, pc, RELEASE_TARGET, () => releaseNameWindowCallSequence(h, events));
  let result;
  const rts = function* () {
    yield () => {
      result = h.rts();
    };
    return result;
  };

  let found = false,
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
        ctx.x = word(wram, DRAW_LIST + y);
        if (holds(ctx.x, screenX, screenY)) {
          found = true;
          break;
        }
        y = (y - 2) & WORD_MASK;
        if (y & WORD_SIGN) break;
      }
    }
    ctx.y = y;
    tag = word(wram, GLOVE_TARGET_TAG);
    ctx.a = tag;
    math.apply(ctx, tag);
  };
  const marked = !(tag & WORD_SIGN);
  if (!found) {
    if (marked) yield* release(RELEASE_NONE_CALL);
    return yield* rts();
  }
  const slot = ctx.x;
  let same = false;
  if (marked) {
    yield () => {
      const kind = far(OBJECT_KIND, slot);
      math.compare(tag, kind);
      let difference = (tag - kind) & WORD_MASK;
      if (tag === kind) {
        const target = word(wram, GLOVE_TARGET_OBJECT);
        math.compare(slot, target);
        difference = (slot - target) & WORD_MASK;
        same = slot === target;
      }
      math.apply(ctx, difference);
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
        const distance = math.sub(word(wram, dp), word(wram, offset));
        math.compare(distance, SNAP_RANGE);
        away = math.carry;
        if (away) {
          ctx.a = distance;
          math.apply(ctx, (distance - SNAP_RANGE) & WORD_MASK);
          return;
        }
        // XBA: the distance becomes the high byte; sign and zero of the low byte (0).
        ctx.a = (distance << BYTE_BITS) & WORD_MASK;
        setWord(wram, position, ctx.a);
        math.apply(ctx, 0);
      };
      if (away) {
        yield* release(RELEASE_AWAY_CALL);
        return yield* rts();
      }
    }
    return yield* rts();
  }
  if (marked) {
    // Another object was marked: it lets go first (the slot kept on the stack).
    yield () => h.phx();
    yield* release(RELEASE_OTHER_CALL);
    yield () => h.plx();
  }
  yield () => {
    // The glove's offset from the object, its kind and slot, and its name.
    math.carry = (ctx.status & FLAG_CARRY) !== 0;
    math.overflow = (ctx.status & FLAG_OVERFLOW) !== 0;
    setWord(wram, GLOVE_SNAP_X, math.sub(word(wram, DP_OBJECT_X), word(wram, DP_SCREEN_X)));
    setWord(wram, GLOVE_SNAP_Y, math.sub(word(wram, DP_OBJECT_Y), word(wram, DP_SCREEN_Y)));
    const kind = far(OBJECT_KIND, slot);
    setWord(wram, GLOVE_TARGET_TAG, kind);
    setWord(wram, GLOVE_TARGET_OBJECT, slot);
    const kindClass = near(OBJECT_FLAGS, slot) & KIND_ITEM_CLASS_MASK;
    math.compare(kindClass, RUNNER_CLASS);
    let text;
    if (kindClass === RUNNER_CLASS) {
      // The runner whose object number it is, from the last row down; with none the
      // index ends at FFFE and the name is read before the column.
      const number = near(OBJECT_NUMBER, slot);
      let x = RUNNER_LAST_INDEX;
      for (;;) {
        const row = longWord(mem, RUNNER_TABLE + x);
        math.compare(number, row);
        if (number === row) break;
        x = (x - 2) & WORD_MASK;
        if (x & WORD_SIGN) break;
      }
      ctx.x = x;
      text = longWord(mem, RUNNER_NAME_COLUMN + x);
    } else {
      const entry = kindName(kind);
      ctx.x = entry;
      text = longWord(mem, KIND_TABLE + entry);
    }
    ctx.a = text;
    math.apply(ctx, text);
    setWord(wram, DP_TEXT, text);
    a.pushWord(text);
  };
  yield* dialogCallBody(h, WIDTH_CALL, WIDTH_TARGET, () =>
    segmentSequence(() => measureTextWidthRoutine(h)),
  );
  yield () => {
    // The window's columns from the text width, and its place.
    let columns = math.shiftRight(math.add(ctx.a, WINDOW_PADDING), WINDOW_PIXEL_SHIFT);
    // Edited names can exceed the screen; FB39 clips their remaining glyphs.
    if (mem.language) columns = Math.min(columns, WINDOW_RIGHT - 1);
    setWord(wram, DP_WINDOW_COLUMNS, columns);
    setWord(wram, DP_WINDOW_LEFT, math.sub(WINDOW_RIGHT, columns));
    setWord(wram, DP_WINDOW_TOP, WINDOW_TOP);
    setWord(wram, DP_WINDOW_ROWS, WINDOW_ROWS);
    setWord(wram, DP_WINDOW_ATTRIBUTES, WINDOW_ATTRIBUTES);
    ctx.a = WINDOW_ATTRIBUTES;
    math.apply(ctx, WINDOW_ATTRIBUTES);
  };
  yield* routineCall(routines, events, h, WINDOW_CALL, WINDOW_TARGET);
  yield () => {
    setWord(wram, GLOVE_NAME_WINDOW, word(wram, DP_TEXT));
    const text = a.pullWord();
    ctx.a = text;
    flag(ctx, FLAG_NEGATIVE, text & WORD_SIGN);
    flag(ctx, FLAG_ZERO, text === 0);
    setWord(wram, DP_TEXT_COPY, text);
  };
  yield* routineCall(routines, events, h, TEXT_CALL, TEXT_TARGET);
  return yield* rts();
}
