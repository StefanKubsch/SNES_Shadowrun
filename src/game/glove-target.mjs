// Choose an object, spell target or floor destination with the active glove.
// Selection locals survive window and input waits; shared state is read live.
import { gloveState } from '../state/glove.mjs';
import { workspaceMemory } from '../state/workspace.mjs';
import { requestUploadCall, resetWindowList } from './window-list.mjs';
import { unpackWindowMap } from './game-screen.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { gloveMove } from './glove-move.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { closeDialog } from './dialog-screen.mjs';
import { showNotice } from './notice-show.mjs';
import { putGloveAwaySequence } from './window-release.mjs';
import { takePad } from '../system/live-input-calls.mjs';
import { waitForCounterWord } from '../system/frame-wait.mjs';
import { segmentSequence } from '../system/sequence-runner.mjs';
import { GLOVE_LIMITS, GLOVE_OVER_PLAYER } from '../script/native-glove-crosshair-limits.mjs';
import { PAD_A, PAD_B, PAD_X, PAD_Y } from '../data/wram.mjs';
import { GLOVE_REACH, OUT_OF_REACH_NOTICE } from '../data/native-glove-target.mjs';
import { BYTE_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { objectWord, setObjectWordIn } from '../state/objects.mjs';

// The choice ends on a newly pressed A, B, X or Y.
const CHOICE_BUTTONS = PAD_A | PAD_B | PAD_X | PAD_Y;
// The result word without a choice.
export const NO_CHOICE = WORD_MASK;
// The glove positions keep the screen pixel in the high byte: the projected value is
// shifted right twice and its bytes swapped.
const POSITION_SHIFT = 2;
// The place choice's screen pixels of the glove (its position words shifted right six
// times) in the direct page, and the bases of its projection back onto the floor.
const PIXEL_SHIFT = 6,
  PLACE_Y_BASE = 0x900,
  PLACE_X_BASE = 0x600;

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
    glove = gloveState(mem),
    player = glove.player,
    field = (name) => objectWord(mem, name, player);
  const down = subtractChain(GLOVE_OVER_PLAYER.yBase, [
    field('diagonal'),
    field('height'),
    glove.camera.y,
    GLOVE_OVER_PLAYER.yOffset,
  ]);
  glove.y = swapBytes(down >>> POSITION_SHIFT);
  const across = subtractChain((GLOVE_OVER_PLAYER.xBase + field('y')) & WORD_MASK, [
    field('x'),
    glove.camera.x,
    GLOVE_OVER_PLAYER.xOffset,
  ]);
  glove.x = swapBytes(across >>> POSITION_SHIFT);
}

// Put the glove on (80:BC67 action, 80:BC99 spell) without the JSR frames of the entry
// and of 80:BC36 (their return words lie only in free stack bytes): the position over
// the player figure, the kind's projection bases and the kind itself.
function putGloveOn(h, limits) {
  placeGloveOverPlayer(h);
  setGloveLimits(h.a.mem, limits);
}

// Each frame the direct counter wait, pad word and glove movement run until a
// choosing button is newly pressed. The glove movement
// receives the name renderer.
export function* gloveFramesSequence(h, events, renderBuffer) {
  const glove = gloveState(h.a.mem);
  let pressed;
  do {
    yield* waitForCounterWord(h, events);
    yield* segmentSequence(() => takePad(h, events));
    yield* gloveMove(h, events, renderBuffer);
    yield () => {
      pressed = glove.pressed & CHOICE_BUTTONS;
    };
  } while (pressed === 0);
}

// The object slot under the glove, or null when it points at none.
export function gloveTarget(wram) {
  const glove = gloveState(workspaceMemory(wram));
  return glove.targetTag & WORD_SIGN ? null : glove.targetObject;
}

// Store the result word in DP 00.
const setResult = (h, value) => (gloveState(h.a.mem).result = value);
// The original keeps the chosen slot on the stack while the glove is put away (PHA,
// PLA); that word lies only in free stack bytes, and the slot is kept in a local here
// (game state only, user decision 2026-11-17).

// 80:8D0B: choose the object under the action glove, without a reach check. DP 00 gets
// its slot or FFFF; a sequence that ends with the native's RTS.
export function* chooseObjectUnderGloveSequence(h, events, renderBuffer = drawTextBuffer) {
  yield () => putGloveOn(h, GLOVE_LIMITS.action);
  yield* gloveFramesSequence(h, events, renderBuffer);
  let target;
  yield () => {
    target = gloveTarget(h.a.mem.wram);
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
}

// The distance of two objects on one axis: the difference, made positive when its sign
// is set (so 8000 stays).
function axisDistance(mem, name, from, to) {
  const difference = (objectWord(mem, name, from) - objectWord(mem, name, to)) & WORD_MASK;
  return difference & WORD_SIGN ? -difference & WORD_MASK : difference;
}
// Whether the target is out of the glove's reach from the player figure: the summed X
// and Y distances (a word), or else the height distance, at least 81. DP 6B keeps the X
// distance.
function outOfReach(h, target) {
  const { mem } = h.a,
    glove = gloveState(mem),
    player = glove.player,
    across = axisDistance(mem, 'x', player, target),
    down = axisDistance(mem, 'y', player, target),
    sum = (down + across) & WORD_MASK;
  glove.actionScratch = across;
  return sum >= GLOVE_REACH || axisDistance(mem, 'height', player, target) >= GLOVE_REACH;
}
// The out-of-reach notice's window, text and frames in the direct page.
function prepareOutOfReachNotice(h) {
  const glove = gloveState(h.a.mem),
    notice = OUT_OF_REACH_NOTICE;
  Object.assign(glove.windows.opening, {
    left: notice.left,
    top: notice.left,
    columns: notice.columns,
    rows: notice.rows,
    attributes: 0,
  });
  glove.notices.textNumber = 0;
  glove.notices.frames = notice.frames;
}
// The window list is redrawn from its first window (81:AEB0 without its JSL frame)
// unless a member menu is open.
function* redrawUnlessMenuSequence(h, events) {
  let open;
  yield () => {
    open = gloveState(h.a.mem).memberMenuActive !== 0;
  };
  if (!open) yield* resetWindowList(h, events);
}

// 80:9C40 without the JSR frame of its callers 80:9BC6 and 80:9C33 (the return word
// lies only in free stack bytes): choose an object in
// reach with the action glove; DP 00 gets its slot or FFFF.
function* chooseInReach(h, events, renderBuffer) {
  const { wram } = h.a.mem,
    glove = gloveState(h.a.mem);
  yield () => putGloveOn(h, GLOVE_LIMITS.action);
  yield* gloveFramesSequence(h, events, renderBuffer);
  let target, far;
  yield () => {
    target = gloveTarget(wram);
    if (target === null) return;
    far = outOfReach(h, target);
    if (far) prepareOutOfReachNotice(h);
  };
  if (target !== null && far) yield* showNotice(h, events);
  if (target !== null && !far) {
    yield* redrawUnlessMenuSequence(h, events);
    let chosen;
    yield () => {
      chosen = glove.targetObject;
    };
    yield* putGloveAwaySequence(h, events);
    yield () => setResult(h, chosen);
    yield* segmentSequence(() => takePad(h, events));
  } else {
    yield* putGloveAwaySequence(h, events);
    yield* redrawUnlessMenuSequence(h, events);
    yield () => setResult(h, NO_CHOICE);
    yield* segmentSequence(() => takePad(h, events));
  }
}
// 80:9BC6 without its RTS: the chosen slot becomes the object's number in DP 00 (FFFF
// stays).
function* chooseNumberBodySequence(h, events, renderBuffer) {
  yield* chooseInReach(h, events, renderBuffer);
  yield () => {
    const { mem } = h.a,
      slot = gloveState(mem).result;
    if (!(slot & WORD_SIGN)) setResult(h, objectWord(mem, 'number', slot));
  };
}
// 80:9BC6: choose an object in reach with the action glove; DP 00 gets its number or
// FFFF. A sequence that ends with the native's RTS.
export function* chooseObjectNumberSequence(h, events, renderBuffer = drawTextBuffer) {
  yield* chooseNumberBodySequence(h, events, renderBuffer);
}
// Mark the glove choice as the script's while body runs (7E:1D6D FFFF, then 0).
function* scriptChoiceSequence(h, body) {
  const glove = gloveState(h.a.mem);
  yield () => (glove.scriptChoice = WORD_MASK);
  yield* body();
  yield () => (glove.scriptChoice = 0);
}
// 80:9BB9: 80:9BC6 as the script's choice, without the JSR frame of 80:9BC6 (its
// return word lies only in free stack bytes).
export function* scriptChooseObjectNumberSequence(h, events, renderBuffer = drawTextBuffer) {
  return yield* scriptChoiceSequence(h, () => chooseNumberBodySequence(h, events, renderBuffer));
}
// 80:9C33: 80:9C40 (the slot) as the script's choice.
export function* scriptChooseObjectSequence(h, events, renderBuffer = drawTextBuffer) {
  return yield* scriptChoiceSequence(h, () => chooseInReach(h, events, renderBuffer));
}

// 81:AEB8: unpack the window map, await its upload, then put the first window
// after the last one. All three steps compose without CPU call frames.
export function* prepareWindowListSequence(h, events) {
  yield () => unpackWindowMap(sceneRuntime(h));
  yield* requestUploadCall(h, events);
  yield () => {
    const glove = gloveState(h.a.mem);
    glove.windows.firstIndex = glove.windows.lastIndex + 1;
  };
}

// 80:9BD3: choose the spell's target with the spell glove; an open member menu's dialog
// is closed first (80:92C5) and the window list prepared. Objects without bit 15 of
// their flags cannot be chosen (the glove stays out); the chosen slot or FFFF goes to
// DP 00 and 7E:1FD2. A sequence that ends with the native's RTS.
export function* spellGloveTargetSequence(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    { wram } = mem,
    glove = gloveState(mem);
  let open;
  yield () => {
    open = glove.memberMenuActive !== 0;
  };
  if (open) yield* closeDialog(h, events);
  yield* prepareWindowListSequence(h, events);
  yield () => putGloveOn(h, GLOVE_LIMITS.spell);
  let target;
  for (;;) {
    yield* gloveFramesSequence(h, events, renderBuffer);
    let usable;
    yield () => {
      target = gloveTarget(wram);
      if (target === null) return;
      usable = (objectWord(mem, 'flags', target) & WORD_SIGN) !== 0;
    };
    if (target === null || usable) break;
  }
  if (target !== null) {
    yield* redrawUnlessMenuSequence(h, events);
    yield () => {
      glove.spellTarget = target;
    };
    yield* putGloveAwaySequence(h, events);
    yield () => setResult(h, target);
    yield* segmentSequence(() => takePad(h, events));
  } else {
    yield* putGloveAwaySequence(h, events);
    yield* redrawUnlessMenuSequence(h, events);
    yield () => {
      glove.spellTarget = NO_CHOICE;
      setResult(h, NO_CHOICE);
    };
    yield* segmentSequence(() => takePad(h, events));
  }
}

// The glove's place on the floor (80:C724 after the choice): the glove position's screen
// pixels (each word shifted right six times, across halved once more into DP A2, kept in
// DP A8 and A5) projected back with the camera and the object's height (the inverse of
// 80:BC36). Down: 900 plus the half pixel across less the camera Y, the pixel down and
// the height (with the borrow passed on), doubled, plus the camera X and halved; across:
// that plus 600 less the pixel across and the camera X. Returns both.
function gloveFloorPlace(mem, object) {
  const glove = gloveState(mem),
    pixelX = glove.x >>> PIXEL_SHIFT,
    halfPixelX = pixelX >>> 1,
    pixelY = glove.y >>> PIXEL_SHIFT,
    cameraX = glove.camera.x;
  glove.place.pixelX = pixelX;
  glove.place.halfPixelX = halfPixelX;
  glove.place.pixelY = pixelY;
  const raised = subtractChain((PLACE_Y_BASE + halfPixelX) & WORD_MASK, [
    glove.camera.y,
    pixelY,
    objectWord(mem, 'height', object),
  ]);
  const down = ((((raised << 1) & WORD_MASK) + cameraX) & WORD_MASK) >>> 1;
  const across = subtractChain((down + PLACE_X_BASE) & WORD_MASK, [pixelX, cameraX]);
  return { down, across };
}

// 80:C724: choose a place with the action glove for the object DP 00 to walk to. Its
// motion record (7E:4138, 7E:4190, 7E:41E8 and 7E:40E0 at the object's index) gets mode
// 0, then the glove's floor place and 1 as active; the window list is prepared before
// and redrawn after the choice. A sequence that ends with the native's RTS.
export function* choosePlaceWithGloveSequence(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    { wram } = mem,
    glove = gloveState(mem);
  let object;
  yield () => {
    // The original keeps the object's index on the stack during the choice.
    object = glove.result;
    setObjectWordIn(wram, 'motionMode', object, 0);
  };
  yield* prepareWindowListSequence(h, events);
  yield () => putGloveOn(h, GLOVE_LIMITS.action);
  yield* gloveFramesSequence(h, events, renderBuffer);
  yield* resetWindowList(h, events);
  yield () => {
    const { down, across } = gloveFloorPlace(mem, object);
    setObjectWordIn(wram, 'motionY', object, down);
    setObjectWordIn(wram, 'motionX', object, across);
    setObjectWordIn(wram, 'motionActive', object, 1);
  };
  yield* putGloveAwaySequence(h, events);
}

// 80:BC83 and 80:BC9C (the script natives' tails of 80:BC80 and 80:BC99): the projection
// bases and the kind of a GLOVE_LIMITS entry, and the kind as the active glove kind.
export function setGloveLimits(mem, [baseX, baseY, kind]) {
  const glove = gloveState(mem);
  glove.baseX = baseX;
  glove.baseY = baseY;
  glove.limitKind = kind;
  glove.kind = kind;
}
