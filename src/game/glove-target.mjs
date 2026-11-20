import {
  drawWindowListSequence,
  requestUploadJslSequence,
  unpackWindowMapCall,
} from './window-list.mjs';
import { gloveMove } from './glove-move.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { closeDialog } from './dialog-talk.mjs';
import { showNotice } from './notice-show.mjs';
import { putGloveAwaySequence } from './window-release.mjs';
import { frameWaitCallSequence, takePad } from '../system/live-input-calls.mjs';
// Choosing with the action or spell glove (lifted from the script natives 80:8D0B and its
// relatives; register-level version in proof/replay/native-glove-target.mjs, which
// recorded waits and inputs replay).
//
// The glove appears over the player figure (80:BC36 with 80:BC67 or 80:BC99). Each frame
// the word wait 81:B0A1, the newly pressed buttons 80:9E1A and the glove movement
// 80:BE6D run, until A, B, X or Y is newly pressed. The object under the glove
// (7E:01DE, while 7E:01DA is not negative) is the choice; the glove is put away
// (80:BCB2) and the pad word taken once more. Wait, pad, release, notice and
// redraw compose directly; movement, map preparation and close also compose directly.
//
// The choice with a reach check (80:9C40) takes an object only when the summed X and Y
// distances from the player figure and the height distance are each below 81; a farther
// object shows the out-of-reach notice (window 2, 2, C x 3, text 0, 3C frames, 80:FEC1)
// and counts as none. Without an open member menu (7E:1F62 zero) the window list is
// redrawn (81:AEB0). 80:9BC6 turns the slot into the object's number, 80:9BB9 and
// 80:9C33 mark the choice as the script's (7E:1D6D FFFF) while it runs.
//
// The spell glove (80:9BD3) closes an open member menu's dialog and prepares the window
// list first; it takes only objects with bit 15 of their flags set. The place choice
// (80:C724) turns the glove's position into a place on the floor for an object's walk.
//
// Registers (user decision 2026-11-17): game state only; the natives leave no A, X, Y or
// flags (the script interpreter replaces them and reads DP 00). The chosen slot and
// the place choice's object still wait on the stack as in the original.
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import { GLOVE_LIMITS, GLOVE_OVER_PLAYER } from '../script/native-glove-crosshair-limits.mjs';
import {
  CAMERA_X,
  CAMERA_Y,
  GLOVE_BASE_X,
  GLOVE_BASE_Y,
  GLOVE_KIND,
  GLOVE_LIMIT_KIND,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  GLOVE_X,
  GLOVE_Y,
  OBJECT_DIAGONAL,
  OBJECT_HEIGHT,
  OBJECT_X,
  OBJECT_Y,
  PAD_A,
  PAD_B,
  PAD_PRESSED,
  PAD_X,
  PAD_Y,
  PLAYER_OBJECT,
} from '../data/wram.mjs';
import {
  DP_NOTICE_FRAMES,
  DP_NOTICE_TEXT,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  MEMBER_MENU_ACTIVE,
  MOTION_ACTIVE,
  MOTION_MODE,
  MOTION_X,
  MOTION_Y,
  OBJECT_FLAGS,
  OBJECT_NUMBER,
  SCRIPT_GLOVE_CHOICE,
  SPELL_TARGET_OBJECT,
  WINDOW_FIRST_INDEX,
  WINDOW_LAST_INDEX,
} from '../data/wram.mjs';
import { DP_SCRATCH } from '../data/native-member-spell-menu.mjs';
import { GLOVE_REACH, OUT_OF_REACH_NOTICE } from '../data/native-glove-target.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// The choice ends on a newly pressed A, B, X or Y.
const CHOICE_BUTTONS = PAD_A | PAD_B | PAD_X | PAD_Y;
// The result word without a choice.
export const NO_CHOICE = WORD_MASK;
// The glove positions keep the screen pixel in the high byte: the projected value is
// shifted right twice and its bytes swapped.
const POSITION_SHIFT = 2;
// The call sites of 80:8D0B.
const UNDER_GLOVE = {
  wait: 0x808d0e,
  awayChosen: 0x808d29,
  awayNone: 0x808d33,
};
// The call sites of 80:9C40 and its callers.
const SELECT = {
    wait: 0x809c43,
    redrawChosen: 0x809cbd,
    awayChosen: 0x809cc5,
    awayNone: 0x809ccf,
    redrawNone: 0x809cd7,
  },
  SELECT_ENTRY = 0x809c40,
  NUMBER_SELECT = 0x809bc6,
  NUMBER_ENTRY = 0x809bc6,
  SCRIPT_NUMBER_SELECT = 0x809bbf,
  SCRIPT_SELECT = 0x809c39,
  REDRAW_LIST = 0x81aeb0,
  REDRAW_LIST_CALL = 0x81aeb3,
  PREPARE_LIST = 0x81aeb8,
  PREPARE_UPLOAD = 0x81aebc;
// The call sites of 80:9BD3.
const SPELL = {
  prepareList: 0x809bdb,
  wait: 0x809be2,
  redrawChosen: 0x809c06,
  awayChosen: 0x809c11,
  awayNone: 0x809c1b,
  redrawNone: 0x809c23,
};
// The call sites of 80:C724.
const PLACE = {
  prepareList: 0x80c733,
  wait: 0x80c73a,
  redraw: 0x80c74c,
  putAway: 0x80c798,
};
// The place choice's screen pixels of the glove (its position words shifted right six
// times) in the direct page, and the bases of its projection back onto the floor.
const PIXEL_SHIFT = 6,
  DP_GLOVE_PIXEL_X = 0xa8,
  DP_GLOVE_HALF_PIXEL_X = 0xa2,
  DP_GLOVE_PIXEL_Y = 0xa5,
  PLACE_Y_BASE = 0x900,
  PLACE_X_BASE = 0x600;
const FRAME_WAIT = 0x81b0a1,
  UNPACK_MAP = 0x81a9b2,
  REQUEST_UPLOAD = 0x81acb5;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const swapBytes = (value) => ((value >>> BYTE_BITS) | (value << BYTE_BITS)) & WORD_MASK;

// Subtract each value in turn with the borrow passed on (SEC, then SBC each); returns
// the word.
function subtractChain(start, values) {
  let value = start,
    carry = true;
  for (const right of values) {
    const difference = value - right - (carry ? 0 : 1);
    carry = difference >= 0;
    value = difference & WORD_MASK;
  }
  return value;
}

// The glove's position over the player figure (80:BC36): across from 0600 plus the
// figure's Y less its X, the camera X and 10; down from 0C00 less the figure's diagonal,
// height, the camera Y and 48.
export function placeGloveOverPlayer(h) {
  const { mem } = h.a,
    { wram } = mem,
    player = word(wram, PLAYER_OBJECT),
    field = (offset) => dataBankWord(mem, offset, player);
  const down = subtractChain(GLOVE_OVER_PLAYER.yBase, [
    field(OBJECT_DIAGONAL),
    field(OBJECT_HEIGHT),
    word(wram, CAMERA_Y),
    GLOVE_OVER_PLAYER.yOffset,
  ]);
  setWord(wram, GLOVE_Y, swapBytes(down >>> POSITION_SHIFT));
  const across = subtractChain((GLOVE_OVER_PLAYER.xBase + field(OBJECT_Y)) & WORD_MASK, [
    field(OBJECT_X),
    word(wram, CAMERA_X),
    GLOVE_OVER_PLAYER.xOffset,
  ]);
  setWord(wram, GLOVE_X, swapBytes(across >>> POSITION_SHIFT));
}

// Put the glove on (80:BC67 action, 80:BC99 spell) without the JSR frames of the entry
// and of 80:BC36 (their return words lie only in free stack bytes): the position over
// the player figure, the kind's projection bases and the kind itself.
function putGloveOn(h, limits) {
  placeGloveOverPlayer(h);
  setGloveLimits(h.a.mem, limits);
}

// Each frame the word wait at the given call site, the pad word and the glove movement
// (without its JSR frame), until a choosing button is newly pressed. The glove movement
// receives the name renderer.
export function* gloveFramesSequence(h, events, renderBuffer, wait) {
  const { wram } = h.a.mem;
  let pressed;
  do {
    yield* dialogCallBody(h, wait, FRAME_WAIT, () => frameWaitCallSequence(h, events), true);
    yield* segmentSequence(() => takePad(h, events));
    yield* gloveMove(h, events, renderBuffer);
    yield () => {
      pressed = word(wram, PAD_PRESSED) & CHOICE_BUTTONS;
    };
  } while (pressed === 0);
}

// The object slot under the glove, or null when it points at none.
export function gloveTarget(wram) {
  return word(wram, GLOVE_TARGET_TAG) & WORD_SIGN ? null : word(wram, GLOVE_TARGET_OBJECT);
}

// Store the result word in DP 00.
const setResult = (h, value) => setWord(h.a.mem.wram, 0, value);
// The original keeps the chosen slot on the stack while the glove is put away (PHA,
// PLA); that word lies only in free stack bytes, and the slot is kept in a local here
// (game state only, user decision 2026-11-17).

// 80:8D0B: choose the object under the action glove, without a reach check. DP 00 gets
// its slot or FFFF; a sequence that ends with the native's RTS.
export function* chooseObjectUnderGloveSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { wram } = h.a.mem,
    sites = UNDER_GLOVE;
  yield () => putGloveOn(h, GLOVE_LIMITS.action);
  yield* gloveFramesSequence(h, events, renderBuffer, sites.wait);
  let target;
  yield () => {
    target = gloveTarget(wram);
  };
  if (target !== null) {
    yield* putGloveAwaySequence(h, events);
    yield () => setResult(h, target);
    yield* segmentSequence(() => takePad(h, events));
  } else {
    yield* putGloveAwaySequence(h, events);
    yield () => setResult(h, NO_CHOICE);
    yield* segmentSequence(() => takePad(h, events));
  }
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// The distance of two objects on one axis: the difference, made positive when its sign
// is set (so 8000 stays).
function axisDistance(mem, offset, from, to) {
  const difference = (dataBankWord(mem, offset, from) - dataBankWord(mem, offset, to)) & WORD_MASK;
  return difference & WORD_SIGN ? -difference & WORD_MASK : difference;
}
// Whether the target is out of the glove's reach from the player figure: the summed X
// and Y distances (a word), or else the height distance, at least 81. DP 6B keeps the X
// distance.
function outOfReach(h, target) {
  const { mem } = h.a,
    player = word(mem.wram, PLAYER_OBJECT),
    across = axisDistance(mem, OBJECT_X, player, target),
    down = axisDistance(mem, OBJECT_Y, player, target),
    sum = (down + across) & WORD_MASK;
  setWord(mem.wram, DP_SCRATCH, across);
  return sum >= GLOVE_REACH || axisDistance(mem, OBJECT_HEIGHT, player, target) >= GLOVE_REACH;
}
// The out-of-reach notice's window, text and frames in the direct page.
function prepareOutOfReachNotice(h) {
  const { wram } = h.a.mem,
    notice = OUT_OF_REACH_NOTICE;
  // The window's top gets the left column's value still in A.
  for (const [offset, value] of [
    [DP_WINDOW_LEFT, notice.left],
    [DP_WINDOW_TOP, notice.left],
    [DP_WINDOW_COLUMNS, notice.columns],
    [DP_WINDOW_ROWS, notice.rows],
    [DP_WINDOW_ATTRIBUTES, 0],
    [DP_NOTICE_TEXT, 0],
    [DP_NOTICE_FRAMES, notice.frames],
  ])
    setWord(wram, offset, value);
}
// 81:AEB0 at its call site: the window list redrawn from its first window (81:AD92).
function* redrawListSequence(h, events, pc) {
  yield* dialogCallBody(
    h,
    pc,
    REDRAW_LIST,
    function* () {
      yield () => setWord(h.a.mem.wram, WINDOW_FIRST_INDEX, 0);
      yield* drawWindowListSequence(h, events, REDRAW_LIST_CALL);
      let result;
      yield () => {
        result = h.rtl();
      };
      return result;
    },
    true,
  );
}
// The window list is redrawn unless a member menu is open.
function* redrawUnlessMenuSequence(h, events, pc) {
  let open;
  yield () => {
    open = word(h.a.mem.wram, MEMBER_MENU_ACTIVE) !== 0;
  };
  if (!open) yield* redrawListSequence(h, events, pc);
}
function* returnSequence(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// 80:9C40 at its call site pc: choose an object in reach with the action glove; DP 00
// gets its slot or FFFF.
function* chooseInReachSequence(h, events, renderBuffer, pc) {
  yield* dialogCallBody(h, pc, SELECT_ENTRY, function* () {
    const { wram } = h.a.mem,
      sites = SELECT;
    yield () => putGloveOn(h, GLOVE_LIMITS.action);
    yield* gloveFramesSequence(h, events, renderBuffer, sites.wait);
    let target, far;
    yield () => {
      target = gloveTarget(wram);
      if (target === null) return;
      far = outOfReach(h, target);
      if (far) prepareOutOfReachNotice(h);
    };
    if (target !== null && far) yield* showNotice(h, events);
    if (target !== null && !far) {
      yield* redrawUnlessMenuSequence(h, events, sites.redrawChosen);
      let chosen;
      yield () => {
        chosen = word(wram, GLOVE_TARGET_OBJECT);
      };
      yield* putGloveAwaySequence(h, events);
      yield () => setResult(h, chosen);
      yield* segmentSequence(() => takePad(h, events));
    } else {
      yield* putGloveAwaySequence(h, events);
      yield* redrawUnlessMenuSequence(h, events, sites.redrawNone);
      yield () => setResult(h, NO_CHOICE);
      yield* segmentSequence(() => takePad(h, events));
    }
    return yield* returnSequence(h);
  });
}
// 80:9BC6 without its RTS: the chosen slot becomes the object's number in DP 00 (FFFF
// stays).
function* chooseNumberBodySequence(h, events, renderBuffer) {
  yield* chooseInReachSequence(h, events, renderBuffer, NUMBER_SELECT);
  yield () => {
    const { mem } = h.a,
      slot = word(mem.wram, 0);
    if (!(slot & WORD_SIGN)) setResult(h, dataBankWord(mem, OBJECT_NUMBER, slot));
  };
}
// 80:9BC6: choose an object in reach with the action glove; DP 00 gets its number or
// FFFF. A sequence that ends with the native's RTS.
export function* chooseObjectNumberSequence(h, events, renderBuffer = drawTextBufferSequence) {
  yield* chooseNumberBodySequence(h, events, renderBuffer);
  return yield* returnSequence(h);
}
// Mark the glove choice as the script's while body runs (7E:1D6D FFFF, then 0).
function* scriptChoiceSequence(h, body) {
  yield () => setWord(h.a.mem.wram, SCRIPT_GLOVE_CHOICE, WORD_MASK);
  yield* body();
  yield () => setWord(h.a.mem.wram, SCRIPT_GLOVE_CHOICE, 0);
  return yield* returnSequence(h);
}
// 80:9BB9: 80:9BC6 as the script's choice.
export function* scriptChooseObjectNumberSequence(
  h,
  events,
  renderBuffer = drawTextBufferSequence,
) {
  return yield* scriptChoiceSequence(h, () =>
    dialogCallBody(h, SCRIPT_NUMBER_SELECT, NUMBER_ENTRY, function* () {
      yield* chooseNumberBodySequence(h, events, renderBuffer);
      return yield* returnSequence(h);
    }),
  );
}
// 80:9C33: 80:9C40 (the slot) as the script's choice.
export function* scriptChooseObjectSequence(h, events, renderBuffer = drawTextBufferSequence) {
  return yield* scriptChoiceSequence(h, () =>
    chooseInReachSequence(h, events, renderBuffer, SCRIPT_SELECT),
  );
}

// 81:AEB8 at its call site: the window list prepared (the window map unpacked 81:A9B2,
// its upload requested 81:ACB5) and its first window set after the last one.
function* prepareWindowListSequence(h, events, pc) {
  yield* dialogCallBody(
    h,
    pc,
    PREPARE_LIST,
    function* () {
      yield* dialogCallBody(
        h,
        PREPARE_LIST,
        UNPACK_MAP,
        () => segmentSequence(() => unpackWindowMapCall(h)),
        true,
      );
      yield* dialogCallBody(
        h,
        PREPARE_UPLOAD,
        REQUEST_UPLOAD,
        () => requestUploadJslSequence(h, events),
        true,
      );
      let result;
      yield () => {
        const { wram } = h.a.mem,
          first = (word(wram, WINDOW_LAST_INDEX) + 1) & WORD_MASK;
        setWord(wram, WINDOW_FIRST_INDEX, first);
        result = h.rtl();
      };
      return result;
    },
    true,
  );
}

// 80:9BD3: choose the spell's target with the spell glove; an open member menu's dialog
// is closed first (80:92C5) and the window list prepared. Objects without bit 15 of
// their flags cannot be chosen (the glove stays out); the chosen slot or FFFF goes to
// DP 00 and 7E:1FD2. A sequence that ends with the native's RTS.
export function* spellGloveTargetSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem,
    sites = SPELL;
  let open;
  yield () => {
    open = word(wram, MEMBER_MENU_ACTIVE) !== 0;
  };
  if (open) yield* closeDialog(h, events);
  yield* prepareWindowListSequence(h, events, sites.prepareList);
  yield () => putGloveOn(h, GLOVE_LIMITS.spell);
  let target;
  for (;;) {
    yield* gloveFramesSequence(h, events, renderBuffer, sites.wait);
    let usable;
    yield () => {
      target = gloveTarget(wram);
      if (target === null) return;
      usable = (dataBankWord(mem, OBJECT_FLAGS, target) & WORD_SIGN) !== 0;
    };
    if (target === null || usable) break;
  }
  if (target !== null) {
    yield* redrawUnlessMenuSequence(h, events, sites.redrawChosen);
    yield () => {
      setWord(wram, SPELL_TARGET_OBJECT, target);
    };
    yield* putGloveAwaySequence(h, events);
    yield () => setResult(h, target);
    yield* segmentSequence(() => takePad(h, events));
  } else {
    yield* putGloveAwaySequence(h, events);
    yield* redrawUnlessMenuSequence(h, events, sites.redrawNone);
    yield () => {
      setWord(wram, SPELL_TARGET_OBJECT, NO_CHOICE);
      setResult(h, NO_CHOICE);
    };
    yield* segmentSequence(() => takePad(h, events));
  }
  return yield* returnSequence(h);
}

// The glove's place on the floor (80:C724 after the choice): the glove position's screen
// pixels (each word shifted right six times, across halved once more into DP A2, kept in
// DP A8 and A5) projected back with the camera and the object's height (the inverse of
// 80:BC36). Down: 900 plus the half pixel across less the camera Y, the pixel down and
// the height (with the borrow passed on), doubled, plus the camera X and halved; across:
// that plus 600 less the pixel across and the camera X. Returns both.
function gloveFloorPlace(mem, object) {
  const { wram } = mem,
    pixelX = word(wram, GLOVE_X) >>> PIXEL_SHIFT,
    halfPixelX = pixelX >>> 1,
    pixelY = word(wram, GLOVE_Y) >>> PIXEL_SHIFT,
    cameraX = word(wram, CAMERA_X);
  setWord(wram, DP_GLOVE_PIXEL_X, pixelX);
  setWord(wram, DP_GLOVE_HALF_PIXEL_X, halfPixelX);
  setWord(wram, DP_GLOVE_PIXEL_Y, pixelY);
  const raised = subtractChain((PLACE_Y_BASE + halfPixelX) & WORD_MASK, [
    word(wram, CAMERA_Y),
    pixelY,
    dataBankWord(mem, OBJECT_HEIGHT, object),
  ]);
  const down = ((((raised << 1) & WORD_MASK) + cameraX) & WORD_MASK) >>> 1;
  const across = subtractChain((down + PLACE_X_BASE) & WORD_MASK, [pixelX, cameraX]);
  return { down, across };
}

// 80:C724: choose a place with the action glove for the object DP 00 to walk to. Its
// motion record (7E:4138, 7E:4190, 7E:41E8 and 7E:40E0 at the object's index) gets mode
// 0, then the glove's floor place and 1 as active; the window list is prepared before
// and redrawn after the choice. A sequence that ends with the native's RTS.
export function* choosePlaceWithGloveSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem,
    sites = PLACE;
  let object;
  yield () => {
    // The original keeps the object's index on the stack during the choice.
    object = word(wram, 0);
    setWord(wram, MOTION_MODE + object, 0);
  };
  yield* prepareWindowListSequence(h, events, sites.prepareList);
  yield () => putGloveOn(h, GLOVE_LIMITS.action);
  yield* gloveFramesSequence(h, events, renderBuffer, sites.wait);
  yield* redrawListSequence(h, events, sites.redraw);
  yield () => {
    const { down, across } = gloveFloorPlace(mem, object);
    setWord(wram, MOTION_Y + object, down);
    setWord(wram, MOTION_X + object, across);
    setWord(wram, MOTION_ACTIVE + object, 1);
  };
  yield* putGloveAwaySequence(h, events);
  return yield* returnSequence(h);
}

// 80:BC83 and 80:BC9C (the script natives' tails of 80:BC80 and 80:BC99): the projection
// bases and the kind of a GLOVE_LIMITS entry, and the kind as the active glove kind.
export function setGloveLimits(mem, [baseX, baseY, kind]) {
  const { wram } = mem;
  setWord(wram, GLOVE_BASE_X, baseX);
  setWord(wram, GLOVE_BASE_Y, baseY);
  setWord(wram, GLOVE_LIMIT_KIND, kind);
  setWord(wram, GLOVE_KIND, kind);
}
