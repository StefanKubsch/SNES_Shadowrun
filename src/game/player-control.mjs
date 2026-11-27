import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The player's control for one frame (lifted from the script native 80:E014;
// register-level version in proof/replay/native-player-control.mjs, which recorded waits
// and inputs replay).
//
// DP 00 is the leader 7E:0CC2 at the start and 0 or the aim's result at the end.
// Select shows the party status (80:ED3C), Start the status screen (80:EA89) and Y its
// item list at once (80:EA8E). Without a glove the pad turns and walks the leader
// (80:DEC7) unless B, A, X, L or R is newly pressed: A puts on the crosshair (80:BC80;
// without a weapon the notice "You are not armed yet!"), X the spell glove (80:BC99;
// without a selected spell "No spell selected!"), B, L or R the action glove (80:BC67),
// each with the leader's action (80:A985). With a glove the leader faces it (80:DF6B);
// while aiming, a held A or X gives the newly pressed aim buttons in DP 00 (both
// buttons for Summon spirit and for a weapon of kind 1 over a hittable target), B, L or
// R ends the aim and takes the glove off (80:BCB2), as A or X do without an aim, and B,
// L or R do without a tagged object. All callees compose directly through their
// original frames.
//
// Registers (user decision 2026-11-17): game state only; the routine and its turns
// (the JSR form of 80:AAAF) leave no A, X, Y or flags, and the result is in DP 00.
import { openWindow } from './window-open.mjs';
import { printText } from './text-print.mjs';
import { waitForConfirmKey } from './confirm-key.mjs';
import { selectObjectAnimation, turnObject } from './object-turn.mjs';
import { releaseWindowSequence, putGloveAwaySequence } from './window-release.mjs';
import { START_ENTRY, ITEMS_ENTRY, statusScreen } from './status-screen.mjs';
import { partyStatus } from './party-status.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { segmentSequence } from '../system/sequence-runner.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import { placeGloveOverPlayer } from './glove-target.mjs';
import { GLOVE_LIMITS } from '../script/native-glove-crosshair-limits.mjs';
import {
  AIM_ACTION,
  AIM_BUTTONS,
  CAMERA_ROTATION_SRAM,
  DIRECTION_MASK,
  DP_FACING_GLOVE_X,
  DP_FACING_GLOVE_Y,
  DP_FACING_SIGN_X,
  DP_FACING_SIGN_Y,
  DP_FACING_SIZE_X,
  DP_FACING_SIZE_Y,
  FACING_DIRECTIONS,
  GLOVE_BUTTONS,
  GLOVE_FACING,
  HEAVY_AIM_ACTION,
  HEAVY_WEAPON_DAMAGE,
  NO_DIRECTION,
  NOTICE_WINDOW,
  PAD_DIRECTION_TABLE,
  RELEASE_BUTTONS,
  SPELL_ACTION,
  SPELL_NOTICE,
  SUMMON_SPIRIT_SCRIPT,
  WALK_ACTION,
  WALK_STEP_X,
  WALK_STEP_Y,
  WEAPON_NOTICE,
} from '../data/native-player-control.mjs';
import {
  AIM_ACTION_NEXT,
  AIM_TARGET_OBJECT,
  AIMING_SPELL,
  AIMING_WEAPON,
  CAMERA_X,
  CAMERA_Y,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  GLOVE_BASE_X,
  GLOVE_BASE_Y,
  GLOVE_KIND,
  GLOVE_LIMIT_KIND,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  GLOVE_X,
  GLOVE_Y,
  PAD_A,
  PAD_DIRECTIONS,
  PAD_HELD,
  PAD_PRESSED,
  PAD_SELECT,
  PAD_START,
  PAD_X,
  PAD_Y,
  PLAYER_IDLE,
  PLAYER_OBJECT,
  RUNNER_WEAPON,
  RUNNER_WEAPON_KIND,
  SELECTED_SPELL_SCRIPT,
} from '../data/wram.mjs';
import { fitListWindow } from '../data/menu-layout.mjs';
import { aimReleaseFixed } from './bugfixes.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { objectWord, setObjectWord } from '../state/objects.mjs';

// The callees and their call sites.
// The idle action, the set mark and the weapon kind whose aim takes both buttons.
const IDLE = 0,
  MARK_SET = WORD_MASK,
  TWO_BUTTON_WEAPON = 1,
  PIXEL_SHIFT = 2;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
const negative = (value) => (value & WORD_SIGN) !== 0;
// left - right - borrow and left + right + carry on words.
const subtract = (left, right, carry = true) => (left - right - (carry ? 0 : 1)) & WORD_MASK;
const add = (left, right, carry = false) => (left + right + (carry ? 1 : 0)) & WORD_MASK;
const magnitude = (value) => (negative(value) ? -value & WORD_MASK : value);

// 80:DEC7: the leader Y walks by the pad's directions (80:DF4B, turned by the camera's
// rotation word in SRAM and kept even) with the steps of 80:DF27 and 80:DF39 and
// turns that way (80:AAAF); without a direction the idle action is set once.
function* walkByPadSequence(h, player) {
  const { mem } = h.a,
    { wram } = mem;
  let direction, idle;
  yield () => {
    const pressed = word(wram, PAD_HELD) & PAD_DIRECTIONS,
      entry = dataBankWord(mem, PAD_DIRECTION_TABLE, pressed >>> (BYTE_BITS - 1));
    direction = entry;
    if (entry < NO_DIRECTION) {
      const rotation = mem.read16(CAMERA_ROTATION_SRAM),
        turned = subtract(subtract(entry, rotation), rotation);
      direction = turned & DIRECTION_MASK;
    }
    setObjectWord(mem, 'velocityX', player, dataBankWord(mem, WALK_STEP_X, direction));
    setObjectWord(mem, 'velocityY', player, dataBankWord(mem, WALK_STEP_Y, direction));
    idle = word(wram, PLAYER_IDLE);
  };
  if (direction === NO_DIRECTION) {
    if (idle) return;
    yield () => setWord(wram, 2, IDLE);
    yield* segmentSequence(() => selectObjectAnimation(h.a.mem, h.a.mem.wram));
    yield () => setWord(wram, PLAYER_IDLE, MARK_SET);
    return;
  }
  if (idle) {
    yield () => setWord(wram, 2, WALK_ACTION);
    yield* segmentSequence(() => selectObjectAnimation(h.a.mem, h.a.mem.wram));
    yield () => setWord(wram, PLAYER_IDLE, 0);
  }
  yield () => {
    setWord(wram, 2, direction >>> 1);
    setWord(wram, 0, word(wram, PLAYER_OBJECT));
  };
  yield* segmentSequence(() => turnObject(h.a.mem, h.a.mem.wram));
}

// 80:BC67, 80:BC80 or 80:BC99: the glove over the leader (80:BC36) with its limits and
// kind.
function putGloveOn(h, [baseX, baseY, kind]) {
  const { wram } = h.a.mem;
  placeGloveOverPlayer(h);
  setWord(wram, GLOVE_BASE_X, baseX);
  setWord(wram, GLOVE_BASE_Y, baseY);
  setWord(wram, GLOVE_LIMIT_KIND, kind);
  setWord(wram, GLOVE_KIND, kind);
}

// 80:DF6B: the leader faces the glove (80:AAAF with the leader in DP 00 and the
// direction in DP 02): the leader's screen position as 80:BC36 projects it against the
// glove's pixel (its position over 4), compared on the dominant axis or on both.
function* faceGloveSequence(h) {
  const { mem } = h.a,
    { wram } = mem;
  yield () => {
    const gloveX = word(wram, GLOVE_X) >>> PIXEL_SHIFT,
      gloveY = word(wram, GLOVE_Y) >>> PIXEL_SHIFT,
      player = word(wram, PLAYER_OBJECT),
      field = (name) => objectWord(mem, name, player);
    setWord(wram, DP_FACING_GLOVE_X, gloveX);
    setWord(wram, DP_FACING_GLOVE_Y, gloveY);
    let down = subtract(GLOVE_FACING.yBase, field('diagonal'));
    down = subtract(down, field('height'));
    down = subtract(down, word(wram, CAMERA_Y));
    down = subtract(down, GLOVE_FACING.yOffset, false);
    down = subtract((down << GLOVE_FACING.shift) & WORD_MASK, gloveY);
    let across = add(GLOVE_FACING.xBase, field('y'));
    across = subtract(across, field('x'));
    across = subtract(across, word(wram, CAMERA_X));
    across = subtract((across << GLOVE_FACING.shift) & WORD_MASK, gloveX);
    const signY = negative(down) ? down : 0,
      signX = negative(across) ? across : 0,
      sizeY = magnitude(down),
      sizeX = magnitude(across);
    setWord(wram, DP_FACING_SIGN_X, signX);
    setWord(wram, DP_FACING_SIGN_Y, signY);
    setWord(wram, DP_FACING_SIZE_Y, sizeY);
    setWord(wram, DP_FACING_SIZE_X, sizeX);
    let directions,
      sign = signY;
    if (sizeY >>> 1 >= sizeX) directions = FACING_DIRECTIONS.vertical;
    else if (sizeX >>> 1 >= sizeY) {
      directions = FACING_DIRECTIONS.horizontal;
      sign = signX;
    } else {
      directions = signX
        ? FACING_DIRECTIONS.diagonalNegativeX
        : FACING_DIRECTIONS.diagonalPositiveX;
    }
    const [ifSet, ifZero] = directions;
    setWord(wram, 0, player);
    setWord(wram, 2, sign ? ifSet : ifZero);
  };
  yield* segmentSequence(() => turnObject(h.a.mem, h.a.mem.wram));
}

// A notice with its window, text, direct key wait and release, then
// the leader in DP 00 and the neutral action.
function* noticeSequence(h, events, notice, renderBuffer) {
  const { mem } = h.a,
    { wram } = mem;
  yield () => {
    setWord(wram, DP_WINDOW_LEFT, NOTICE_WINDOW.left);
    setWord(wram, DP_WINDOW_TOP, NOTICE_WINDOW.top);
    setWord(wram, DP_WINDOW_COLUMNS, notice.columns);
    setWord(wram, DP_WINDOW_ROWS, NOTICE_WINDOW.rows);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
    // Another language fits the window to the text.
    fitListWindow(mem, [notice.text], { column: 0 });
  };
  yield* openWindow(h, events);
  yield () => setWord(wram, 2, notice.text);
  yield* printText(h, events, renderBuffer);
  yield* waitForConfirmKey(h, events);
  yield* releaseWindowSequence(h, events);
  yield () => setWord(wram, 0, word(wram, PLAYER_OBJECT));
  yield* neutralSequence(h);
}
// The neutral action (80:A985 with DP 02 = 0).
function* neutralSequence(h) {
  yield () => setWord(h.a.mem.wram, 2, IDLE);
  yield* segmentSequence(() => selectObjectAnimation(h.a.mem, h.a.mem.wram));
}

// The aim's result with A or X held (80:E13E); returns it.
function aimResult(h) {
  const { mem } = h.a,
    { wram } = mem,
    pressed = (mask) => word(wram, PAD_PRESSED) & mask;
  // Both buttons: the held A or the newly pressed X.
  const both = () => pressed(PAD_X) | (word(wram, PAD_HELD) & PAD_A);
  if (word(wram, AIMING_SPELL) && word(wram, SELECTED_SPELL_SCRIPT) === SUMMON_SPIRIT_SCRIPT)
    return both();
  if (!negative(word(wram, GLOVE_TARGET_TAG))) {
    const target = word(wram, GLOVE_TARGET_OBJECT);
    if (negative(objectWord(mem, 'flags', target))) {
      setWord(wram, AIM_TARGET_OBJECT, target);
      if (readStateByte(wram, RUNNER_WEAPON_KIND) === TWO_BUTTON_WEAPON) return both();
      return pressed(AIM_BUTTONS);
    }
  }
  return pressed(PAD_A);
}

// 80:E014: one frame of the player's control (see above). A sequence that ends with the
// native's RTS.
export function* controlPlayerSequence(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    { wram } = mem;
  const finish = function* (result = 0) {
    yield () => setWord(wram, 0, result);
  };
  let path, player;
  yield () => {
    const pressed = word(wram, PAD_PRESSED);
    player = word(wram, PLAYER_OBJECT);
    setWord(wram, 0, player);
    const test = (mask) => (pressed & mask) !== 0;
    if (test(PAD_SELECT)) path = 'party';
    else if (test(PAD_START)) path = 'status';
    else if (test(PAD_Y)) path = 'items';
    else path = word(wram, GLOVE_KIND) ? 'glove' : 'free';
  };
  if (path === 'party') {
    yield* partyStatus(h, events, renderBuffer);
    return yield* finish();
  }
  if (path === 'status') {
    yield* statusScreen(h, events, START_ENTRY, renderBuffer);
    return yield* finish();
  }
  if (path === 'items') {
    yield* statusScreen(h, events, ITEMS_ENTRY, renderBuffer);
    return yield* finish();
  }
  if (path === 'free') return yield* freeSequence(h, events, finish, renderBuffer, player);
  return yield* gloveSequence(h, events, finish);
}

// Without a glove (80:E04B).
function* freeSequence(h, events, finish, renderBuffer, player) {
  const { mem } = h.a,
    { wram } = mem,
    pressed = word(wram, PAD_PRESSED);
  const test = (mask) => (pressed & mask) !== 0;
  if (!test(GLOVE_BUTTONS)) {
    yield* walkByPadSequence(h, player);
    return yield* finish();
  }
  yield () => {
    if (word(wram, PLAYER_IDLE)) return;
    setWord(wram, PLAYER_IDLE, MARK_SET);
    setObjectWord(mem, 'velocityX', player, 0);
    setObjectWord(mem, 'velocityY', player, 0);
  };
  if (test(PAD_A)) {
    let armed;
    yield () => {
      armed = !negative(word(wram, RUNNER_WEAPON));
      if (!armed) return;
      putGloveOn(h, GLOVE_LIMITS.crosshair);
      const heavy = readStateByte(wram, RUNNER_WEAPON_KIND + 1) >= HEAVY_WEAPON_DAMAGE,
        action = heavy ? HEAVY_AIM_ACTION : AIM_ACTION;
      setWord(wram, 2, action);
      setWord(wram, AIM_ACTION_NEXT, action + 1);
      setWord(wram, AIMING_WEAPON, MARK_SET);
    };
    if (!armed) {
      yield* noticeSequence(h, events, WEAPON_NOTICE, renderBuffer);
      return yield* finish();
    }
    yield* segmentSequence(() => selectObjectAnimation(h.a.mem, h.a.mem.wram));
    return yield* finish();
  }
  if (test(PAD_X)) {
    let selected;
    yield () => {
      selected = word(wram, SELECTED_SPELL_SCRIPT) !== 0;
      if (!selected) return;
      putGloveOn(h, GLOVE_LIMITS.spell);
      setWord(wram, AIMING_SPELL, MARK_SET);
      setWord(wram, 2, SPELL_ACTION);
    };
    if (!selected) {
      yield* noticeSequence(h, events, SPELL_NOTICE, renderBuffer);
      return yield* finish();
    }
    yield* segmentSequence(() => selectObjectAnimation(h.a.mem, h.a.mem.wram));
    return yield* finish();
  }
  yield () => putGloveOn(h, GLOVE_LIMITS.action);
  yield* neutralSequence(h);
  return yield* finish();
}

// With a glove (80:E12B).
function* gloveSequence(h, events, finish) {
  const { wram } = h.a.mem;
  yield* faceGloveSequence(h);
  let step;
  yield () => {
    const pressed = word(wram, PAD_PRESSED),
      aiming = word(wram, AIMING_WEAPON) | word(wram, AIMING_SPELL);
    // B, L or R end the aim and take the glove off; without one nothing happens.
    const release = () => (pressed & RELEASE_BUTTONS ? 'end' : 'done');
    if (!aiming) {
      if (pressed & AIM_BUTTONS) return (step = 'away');
      step = negative(word(wram, GLOVE_TARGET_TAG)) ? release() : 'done';
      return;
    }
    const held = word(wram, PAD_HELD) & AIM_BUTTONS;
    if (!held) return (step = release());
    step = 'aim';
  };
  if (step === 'aim') {
    let result;
    yield () => {
      result = aimResult(h);
    };
    return yield* finish(result);
  }
  if (step === 'end') {
    yield () => {
      setWord(wram, AIMING_WEAPON, 0);
      setWord(wram, AIMING_SPELL, 0);
      setWord(wram, 2, IDLE);
      // 80:E1AA selects the idle action for the object in DP 00 without reloading it.
      // A turn in this frame (80:AAAF through 80:A985) left the leader's action entry
      // pointer there; the original then indexes the object tables with it, reading
      // bank 80 code bytes kept in the data package, and the leader keeps the aim
      // (docs/BUGFIXES.md). The correction reloads the leader first.
      if (aimReleaseFixed(h.a)) setWord(wram, 0, word(wram, PLAYER_OBJECT));
    };
    yield* segmentSequence(() => selectObjectAnimation(h.a.mem, h.a.mem.wram));
  }
  if (step === 'end' || step === 'away') yield* putGloveAwaySequence(h, events);
  return yield* finish();
}
