// Choosing with the action or spell glove (lifted from the script natives 80:8D0B and its
// relatives; register-level version in src/task/native-glove-target.mjs, which
// recorded waits and inputs replay).
//
// The glove appears over the player figure (80:BC36 with 80:BC67 or 80:BC99). Each frame
// the word wait 81:B0A1, the newly pressed buttons 80:9E1A and the glove movement
// 80:BE6D run, until A, B, X or Y is newly pressed. The object under the glove
// (7E:01DE, while 7E:01DA is not negative) is the choice; the glove is put away
// (80:BCB2) and the pad word taken once more. The callees run through their frames from
// the routine table, each with its own callees (the table is not passed on).
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
import { dialogCallBody, nativeCallSequence } from '../task/native-call-continuation.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import { GLOVE_LIMITS, GLOVE_OVER_PLAYER } from '../task/native-glove-crosshair-limits.mjs';
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
} from '../task/wram.mjs';
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
} from '../task/wram.mjs';
import { DP_SCRATCH } from '../task/native-member-spell-menu.mjs';
import { GLOVE_REACH, OUT_OF_REACH_NOTICE } from '../task/native-glove-target.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// The choice ends on a newly pressed A, B, X or Y.
const CHOICE_BUTTONS = PAD_A | PAD_B | PAD_X | PAD_Y;
// The result word without a choice.
export const NO_CHOICE = WORD_MASK;
// The glove positions keep the screen pixel in the high byte: the projected value is
// shifted right twice and its bytes swapped.
const POSITION_SHIFT = 2;
// The routine 80:BC36 called from both glove entries, and the call sites of 80:8D0B.
const OVER_PLAYER = 0x80bc36,
  PUT_ON_ACTION = 0x80bc67,
  UNDER_GLOVE = {
    putOn: 0x808d0b,
    frames: [0x808d0e, 0x808d12, 0x808d15],
    awayChosen: 0x808d29,
    padChosen: 0x808d2f,
    awayNone: 0x808d33,
    padNone: 0x808d3b,
  };
// The call sites of 80:9C40 and its callers.
const SELECT = {
    putOn: 0x809c40,
    frames: [0x809c43, 0x809c47, 0x809c4a],
    notice: 0x809cb3,
    redrawChosen: 0x809cbd,
    awayChosen: 0x809cc5,
    padChosen: 0x809ccb,
    awayNone: 0x809ccf,
    redrawNone: 0x809cd7,
    padNone: 0x809ce0,
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
    closeDialog: 0x809bd8,
    prepareList: 0x809bdb,
    putOn: 0x809bdf,
    frames: [0x809be2, 0x809be6, 0x809be9],
    redrawChosen: 0x809c06,
    awayChosen: 0x809c11,
    padChosen: 0x809c17,
    awayNone: 0x809c1b,
    redrawNone: 0x809c23,
    padNone: 0x809c2f,
  },
  PUT_ON_SPELL = 0x80bc99;
// The call sites of 80:C724.
const PLACE = {
  prepareList: 0x80c733,
  putOn: 0x80c737,
  frames: [0x80c73a, 0x80c73e, 0x80c741],
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
  PAD_WORD = 0x809e1a,
  MOVE_GLOVE = 0x80be6d,
  PUT_AWAY = 0x80bcb2,
  SHOW_NOTICE = 0x80fec1,
  DRAW_LIST = 0x81ad92,
  CLOSE_DIALOG = 0x8092c5,
  UNPACK_MAP = 0x81a9b2,
  REQUEST_UPLOAD = 0x81acb5;
// A callee at its call site with its own callee table.
const callSequence = (h, events, routines, pc, target, long = false) =>
  nativeCallSequence(h, events, routines, pc, target, long, false);

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const swapBytes = (value) => ((value >>> BYTE_BITS) | (value << BYTE_BITS)) & WORD_MASK;
const setFlag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const setSignZero = (ctx, value) => {
  setFlag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  setFlag(ctx, FLAG_ZERO, value === 0);
};

// Subtract each value in turn with the borrow passed on (SEC, then SBC each); returns
// the word and the last subtraction's carry and overflow.
function subtractChain(start, values) {
  let value = start,
    carry = true,
    overflow = false;
  for (const right of values) {
    const difference = value - right - (carry ? 0 : 1),
      result = difference & WORD_MASK;
    carry = difference >= 0;
    overflow = subtractOverflow(value, right, result);
    value = result;
  }
  return { value, carry, overflow };
}
// The signed overflow of left - right = result and of left + right = result.
const subtractOverflow = (left, right, result) =>
  ((left ^ right) & (left ^ result) & WORD_SIGN) !== 0;
const addOverflow = (left, right, result) => (~(left ^ right) & (left ^ result) & WORD_SIGN) !== 0;

// The glove's position over the player figure (80:BC36): across from 0600 plus the
// figure's Y less its X, the camera X and 10; down from 0C00 less the figure's diagonal,
// height, the camera Y and 48. Leaves Y the figure's slot, the carry of the last
// shift and the overflow of the last subtraction.
export function placeGloveOverPlayer(h) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    player = word(wram, PLAYER_OBJECT),
    field = (offset) => dataBankWord(mem, offset, player);
  const down = subtractChain(GLOVE_OVER_PLAYER.yBase, [
    field(OBJECT_DIAGONAL),
    field(OBJECT_HEIGHT),
    word(wram, CAMERA_Y),
    GLOVE_OVER_PLAYER.yOffset,
  ]).value;
  setWord(wram, GLOVE_Y, swapBytes(down >>> POSITION_SHIFT));
  const { value: across, overflow } = subtractChain(
    (GLOVE_OVER_PLAYER.xBase + field(OBJECT_Y)) & WORD_MASK,
    [field(OBJECT_X), word(wram, CAMERA_X), GLOVE_OVER_PLAYER.xOffset],
  );
  setWord(wram, GLOVE_X, swapBytes(across >>> POSITION_SHIFT));
  ctx.y = player;
  setFlag(ctx, FLAG_CARRY, (across >>> (POSITION_SHIFT - 1)) & 1);
  setFlag(ctx, FLAG_OVERFLOW, overflow);
}

// Put the glove on (80:BC67 action, 80:BC99 spell) at its call site pc, a sequence: the
// position over the player figure, the kind's projection bases and the kind itself.
// Leaves A the kind.
export function* putGloveOnSequence(h, pc, entry, [baseX, baseY, kind]) {
  yield* dialogCallBody(h, pc, entry, function* () {
    let result;
    yield () => {
      const { ctx } = h,
        { wram } = h.a.mem;
      h.call(entry, OVER_PLAYER, () => {
        placeGloveOverPlayer(h);
        return h.rts();
      });
      setWord(wram, GLOVE_BASE_X, baseX);
      setWord(wram, GLOVE_BASE_Y, baseY);
      setWord(wram, GLOVE_LIMIT_KIND, kind);
      setWord(wram, GLOVE_KIND, kind);
      ctx.a = kind;
      setSignZero(ctx, kind);
      result = h.rts();
    };
    return result;
  });
}

// Each frame the word wait, the pad word and the glove movement at the given call
// sites, until a choosing button is newly pressed; leaves A those buttons. The glove
// movement gets its own callee table.
export function* gloveFramesSequence(h, events, routines, [wait, pad, move]) {
  const { ctx } = h,
    { wram } = h.a.mem;
  let pressed;
  do {
    yield* callSequence(h, events, routines, wait, FRAME_WAIT, true);
    yield* callSequence(h, events, routines, pad, PAD_WORD);
    yield* callSequence(h, events, routines, move, MOVE_GLOVE);
    yield () => {
      pressed = word(wram, PAD_PRESSED) & CHOICE_BUTTONS;
      ctx.a = pressed;
      setSignZero(ctx, pressed);
    };
  } while (pressed === 0);
}

// The object slot under the glove, or null when it points at none.
export function gloveTarget(wram) {
  return word(wram, GLOVE_TARGET_TAG) & WORD_SIGN ? null : word(wram, GLOVE_TARGET_OBJECT);
}

// Store the result word in DP 00.
const setResult = (h, value) => setWord(h.a.mem.wram, 0, value);
// Load A with a word and set its sign and zero.
const load = (ctx, value) => {
  ctx.a = value;
  setSignZero(ctx, value);
};

// 80:8D0B: choose the object under the action glove, without a reach check. DP 00 gets
// its slot or FFFF; a sequence that ends with the native's RTS.
export function* chooseObjectUnderGloveSequence(h, events, routines) {
  const { ctx } = h,
    { wram } = h.a.mem,
    sites = UNDER_GLOVE;
  yield* putGloveOnSequence(h, sites.putOn, PUT_ON_ACTION, GLOVE_LIMITS.action);
  yield* gloveFramesSequence(h, events, routines, sites.frames);
  let target;
  yield () => {
    target = gloveTarget(wram);
    if (target !== null) {
      // The slot waits on the stack while the glove is put away.
      load(ctx, target);
      h.pha();
    } else load(ctx, word(wram, GLOVE_TARGET_TAG));
  };
  if (target !== null) {
    yield* callSequence(h, events, routines, sites.awayChosen, PUT_AWAY);
    yield () => {
      h.pla();
      setResult(h, ctx.a);
    };
    yield* callSequence(h, events, routines, sites.padChosen, PAD_WORD);
  } else {
    yield* callSequence(h, events, routines, sites.awayNone, PUT_AWAY);
    yield () => {
      load(ctx, NO_CHOICE);
      setResult(h, NO_CHOICE);
    };
    yield* callSequence(h, events, routines, sites.padNone, PAD_WORD);
  }
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// The distance of two objects on one axis: the difference, made positive when its sign
// is set (so 8000 stays), and the subtraction's overflow.
function axisDistance(mem, offset, from, to) {
  const left = dataBankWord(mem, offset, from),
    right = dataBankWord(mem, offset, to),
    difference = (left - right) & WORD_MASK;
  return {
    distance: difference & WORD_SIGN ? -difference & WORD_MASK : difference,
    overflow: subtractOverflow(left, right, difference),
  };
}
// Whether the target is out of the glove's reach from the player figure: the summed X
// and Y distances (a word), or else the height distance, at least 81. DP 6B keeps the X
// distance; leaves X the player's slot, Y the target's, the carry of the last
// comparison and the overflow of the last addition or subtraction.
function outOfReach(h, target) {
  const { ctx } = h,
    { mem } = h.a,
    player = word(mem.wram, PLAYER_OBJECT),
    across = axisDistance(mem, OBJECT_X, player, target).distance,
    down = axisDistance(mem, OBJECT_Y, player, target).distance,
    sum = (down + across) & WORD_MASK;
  setWord(mem.wram, DP_SCRATCH, across);
  ctx.x = player;
  ctx.y = target;
  let far = sum >= GLOVE_REACH,
    overflow = addOverflow(down, across, sum);
  if (!far) {
    const height = axisDistance(mem, OBJECT_HEIGHT, player, target);
    far = height.distance >= GLOVE_REACH;
    overflow = height.overflow;
  }
  setFlag(ctx, FLAG_CARRY, far);
  setFlag(ctx, FLAG_OVERFLOW, overflow);
  return far;
}
// The out-of-reach notice's window, text and frames in the direct page; leaves A the
// frames.
function prepareOutOfReachNotice(h) {
  const { ctx } = h,
    { wram } = h.a.mem,
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
  load(ctx, notice.frames);
}
// 81:AEB0 at its call site: the window list redrawn from its first window (81:AD92).
function* redrawListSequence(h, events, routines, pc) {
  yield* dialogCallBody(
    h,
    pc,
    REDRAW_LIST,
    function* () {
      yield () => setWord(h.a.mem.wram, WINDOW_FIRST_INDEX, 0);
      yield* callSequence(h, events, routines, REDRAW_LIST_CALL, DRAW_LIST, true);
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
function* redrawUnlessMenuSequence(h, events, routines, pc) {
  let open;
  yield () => {
    const menu = word(h.a.mem.wram, MEMBER_MENU_ACTIVE);
    load(h.ctx, menu);
    open = menu !== 0;
  };
  if (!open) yield* redrawListSequence(h, events, routines, pc);
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
function* chooseInReachSequence(h, events, routines, pc) {
  yield* dialogCallBody(h, pc, SELECT_ENTRY, function* () {
    const { ctx } = h,
      { wram } = h.a.mem,
      sites = SELECT;
    yield* putGloveOnSequence(h, sites.putOn, PUT_ON_ACTION, GLOVE_LIMITS.action);
    yield* gloveFramesSequence(h, events, routines, sites.frames);
    let target, far;
    yield () => {
      target = gloveTarget(wram);
      if (target === null) {
        load(ctx, word(wram, GLOVE_TARGET_TAG));
        return;
      }
      far = outOfReach(h, target);
      if (far) prepareOutOfReachNotice(h);
    };
    if (target !== null && far) yield* callSequence(h, events, routines, sites.notice, SHOW_NOTICE);
    if (target !== null && !far) {
      yield* redrawUnlessMenuSequence(h, events, routines, sites.redrawChosen);
      yield () => {
        // The slot waits on the stack while the glove is put away.
        load(ctx, word(wram, GLOVE_TARGET_OBJECT));
        h.pha();
      };
      yield* callSequence(h, events, routines, sites.awayChosen, PUT_AWAY);
      yield () => {
        h.pla();
        setResult(h, ctx.a);
      };
      yield* callSequence(h, events, routines, sites.padChosen, PAD_WORD);
    } else {
      yield* callSequence(h, events, routines, sites.awayNone, PUT_AWAY);
      yield* redrawUnlessMenuSequence(h, events, routines, sites.redrawNone);
      yield () => {
        load(ctx, NO_CHOICE);
        setResult(h, NO_CHOICE);
      };
      yield* callSequence(h, events, routines, sites.padNone, PAD_WORD);
    }
    return yield* returnSequence(h);
  });
}
// 80:9BC6 without its RTS: the chosen slot becomes the object's number in DP 00 (FFFF
// stays); leaves Y the slot.
function* chooseNumberBodySequence(h, events, routines) {
  yield* chooseInReachSequence(h, events, routines, NUMBER_SELECT);
  yield () => {
    const { ctx } = h,
      { mem } = h.a,
      slot = word(mem.wram, 0);
    ctx.y = slot;
    setSignZero(ctx, slot);
    if (slot & WORD_SIGN) return;
    const number = dataBankWord(mem, OBJECT_NUMBER, slot);
    load(ctx, number);
    setResult(h, number);
  };
}
// 80:9BC6: choose an object in reach with the action glove; DP 00 gets its number or
// FFFF. A sequence that ends with the native's RTS.
export function* chooseObjectNumberSequence(h, events, routines) {
  yield* chooseNumberBodySequence(h, events, routines);
  return yield* returnSequence(h);
}
// Mark the glove choice as the script's while body runs (7E:1D6D FFFF, then 0).
function* scriptChoiceSequence(h, body) {
  yield () => {
    load(h.ctx, WORD_MASK);
    setWord(h.a.mem.wram, SCRIPT_GLOVE_CHOICE, WORD_MASK);
  };
  yield* body();
  yield () => setWord(h.a.mem.wram, SCRIPT_GLOVE_CHOICE, 0);
  return yield* returnSequence(h);
}
// 80:9BB9: 80:9BC6 as the script's choice.
export function* scriptChooseObjectNumberSequence(h, events, routines) {
  return yield* scriptChoiceSequence(h, () =>
    dialogCallBody(h, SCRIPT_NUMBER_SELECT, NUMBER_ENTRY, function* () {
      yield* chooseNumberBodySequence(h, events, routines);
      return yield* returnSequence(h);
    }),
  );
}
// 80:9C33: 80:9C40 (the slot) as the script's choice.
export function* scriptChooseObjectSequence(h, events, routines) {
  return yield* scriptChoiceSequence(h, () =>
    chooseInReachSequence(h, events, routines, SCRIPT_SELECT),
  );
}

// 81:AEB8 at its call site: the window list prepared (the window map unpacked 81:A9B2,
// its upload requested 81:ACB5) and its first window set after the last one.
function* prepareWindowListSequence(h, events, routines, pc) {
  yield* dialogCallBody(
    h,
    pc,
    PREPARE_LIST,
    function* () {
      yield* callSequence(h, events, routines, PREPARE_LIST, UNPACK_MAP, true);
      yield* callSequence(h, events, routines, PREPARE_UPLOAD, REQUEST_UPLOAD, true);
      let result;
      yield () => {
        const { wram } = h.a.mem,
          first = (word(wram, WINDOW_LAST_INDEX) + 1) & WORD_MASK;
        load(h.ctx, first);
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
export function* spellGloveTargetSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    sites = SPELL;
  let open;
  yield () => {
    const menu = word(wram, MEMBER_MENU_ACTIVE);
    load(ctx, menu);
    open = menu !== 0;
  };
  if (open) yield* callSequence(h, events, routines, sites.closeDialog, CLOSE_DIALOG);
  yield* prepareWindowListSequence(h, events, routines, sites.prepareList);
  yield* putGloveOnSequence(h, sites.putOn, PUT_ON_SPELL, GLOVE_LIMITS.spell);
  let target;
  for (;;) {
    yield* gloveFramesSequence(h, events, routines, sites.frames);
    let usable;
    yield () => {
      target = gloveTarget(wram);
      if (target === null) {
        load(ctx, word(wram, GLOVE_TARGET_TAG));
        return;
      }
      ctx.x = target;
      const flags = dataBankWord(mem, OBJECT_FLAGS, target);
      load(ctx, flags);
      usable = (flags & WORD_SIGN) !== 0;
    };
    if (target === null || usable) break;
  }
  if (target !== null) {
    yield* redrawUnlessMenuSequence(h, events, routines, sites.redrawChosen);
    yield () => {
      // The slot waits on the stack while the glove is put away.
      load(ctx, target);
      setWord(wram, SPELL_TARGET_OBJECT, target);
      h.pha();
    };
    yield* callSequence(h, events, routines, sites.awayChosen, PUT_AWAY);
    yield () => {
      h.pla();
      setResult(h, ctx.a);
    };
    yield* callSequence(h, events, routines, sites.padChosen, PAD_WORD);
  } else {
    yield* callSequence(h, events, routines, sites.awayNone, PUT_AWAY);
    yield* redrawUnlessMenuSequence(h, events, routines, sites.redrawNone);
    yield () => {
      load(ctx, NO_CHOICE);
      setWord(wram, SPELL_TARGET_OBJECT, NO_CHOICE);
      setResult(h, NO_CHOICE);
    };
    yield* callSequence(h, events, routines, sites.padNone, PAD_WORD);
  }
  return yield* returnSequence(h);
}

// The glove's place on the floor (80:C724 after the choice): the glove position's screen
// pixels (each word shifted right six times, across halved once more into DP A2, kept in
// DP A8 and A5) projected back with the camera and the object's height (the inverse of
// 80:BC36). Down: 900 plus the half pixel across less the camera Y, the pixel down and
// the height (with the borrow passed on), doubled, plus the camera X and halved; across:
// that plus 600 less the pixel across and the camera X. Returns both and the last
// carry and overflow.
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
  ]).value;
  const down = ((((raised << 1) & WORD_MASK) + cameraX) & WORD_MASK) >>> 1;
  const across = subtractChain((down + PLACE_X_BASE) & WORD_MASK, [pixelX, cameraX]);
  return { down, across: across.value, carry: across.carry, overflow: across.overflow };
}

// 80:C724: choose a place with the action glove for the object DP 00 to walk to. Its
// motion record (7E:4138, 7E:4190, 7E:41E8 and 7E:40E0 at the object's index) gets mode
// 0, then the glove's floor place and 1 as active; the window list is prepared before
// and redrawn after the choice. A sequence that ends with the native's RTS.
export function* choosePlaceWithGloveSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    sites = PLACE;
  yield () => {
    load(ctx, 0);
    ctx.x = word(wram, 0);
    setSignZero(ctx, ctx.x);
    // The object's index waits on the stack during the choice.
    h.phx();
    setWord(wram, MOTION_MODE + ctx.x, 0);
  };
  yield* prepareWindowListSequence(h, events, routines, sites.prepareList);
  yield* putGloveOnSequence(h, sites.putOn, PUT_ON_ACTION, GLOVE_LIMITS.action);
  yield* gloveFramesSequence(h, events, routines, sites.frames);
  yield* redrawListSequence(h, events, routines, sites.redraw);
  yield () => {
    h.plx();
    const object = ctx.x,
      { down, across, carry, overflow } = gloveFloorPlace(mem, object);
    setWord(wram, MOTION_Y + object, down);
    setWord(wram, MOTION_X + object, across);
    setWord(wram, MOTION_ACTIVE + object, 1);
    load(ctx, 1);
    setFlag(ctx, FLAG_CARRY, carry);
    setFlag(ctx, FLAG_OVERFLOW, overflow);
  };
  yield* callSequence(h, events, routines, sites.putAway, PUT_AWAY);
  return yield* returnSequence(h);
}
