import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The object turn (lifted from 80:AAAF with the animation selection 80:A985;
// register-level versions in proof/script/native-object-turn.mjs, which the other callers
// still use).
//
// An object (slot in the direct page word 00) turns to the direction in word 02. Its
// action record (src/data/actions.mjs) gives one byte per direction: the offset of the
// direction's first frame. When the object plays a short animation (1 to 7F frames),
// the frame offset moves by the difference of the two directions' offsets, which
// keeps the frame phase, and the animation clock restarts. Otherwise its last
// selected animation, if any, is selected again for the new direction.
//
// The selection takes the kind's action list at ACTION_TABLE, the record of the
// action and its eight direction offsets, and loads the object's animation fields
// from the record: speed, frame count (bit 7 flipped: loop), palette, the signed box
// and its height. It leaves the direct page words as the original: the list entry
// pointer 00, the record 04, the direction offsets 08 and the bank words 02, 06 and
// 0A (8C); the turn's fast path leaves 08 and 0A.
//
// The records lie in bank 8C. A pointer into 2000-7FFF of a bank with a system area
// that hits no register reads the open bus: the pointer's bank byte
// (src/system/open-bus.mjs). Only a damaged object reaches it.
//
// The fields the original reads through its data bank 80 are reached the same way
// (src/system/data-bank.mjs): a slot past them, such as FFFF, reads the WRAM mirror of
// bank 81 or what lies above, as the original. The return words of the JSR to the turn and of its JSR to
// the selection lie on the stack as in the original.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { isOpenBus } from '../system/open-bus.mjs';
import { ANIMATION_CLOCK_START } from '../data/wram.mjs';
import { ACTION_TABLE } from '../data/actions.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  HIGH_BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { objectWord, objectWordIn, setObjectWord, setObjectWordIn } from '../state/objects.mjs';

const NONE = WORD_MASK;
// The direct page: the object and the direction (or selection), then the long
// pointers to the list entry, the record and its direction offsets.
const DP_OBJECT = 0,
  DP_ARGUMENT = 2,
  DP_ENTRY = 0,
  DP_ENTRY_BANK = 2,
  DP_RECORD = 4,
  DP_RECORD_BANK = 6,
  DP_FRAMES = 8,
  DP_FRAMES_BANK = 0x0a;
// The record: speed, frame count, palette, the box (four signed bytes), its height,
// then the direction offsets.
const ACTION_BANK = ACTION_TABLE >>> WORD_BITS,
  RECORD_FRAME_COUNT = 1,
  RECORD_PALETTE = 2,
  RECORD_BOX = 3,
  RECORD_BOX_HEIGHT = 7,
  RECORD_DIRECTIONS = 8,
  FRAME_LOOP_FLAG = 0x80;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
// A byte of bank 8C at pointer + offset (which may cross into the next bank).
function actionByte(mem, pointer, offset) {
  const address = ((ACTION_BANK << WORD_BITS) + pointer + offset) & LONG_MASK;
  return isOpenBus(address) ? ACTION_BANK : mem.read8(address);
}
const actionWord = (mem, pointer, offset) =>
  actionByte(mem, pointer, offset) | (actionByte(mem, pointer, offset + 1) << BYTE_BITS);
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
const signedByte = (value) => (value & BYTE_SIGN ? value | HIGH_BYTE_MASK : value);

// Select the animation in word 02 for the object in word 00 (80:A985) after the
// original's check for an unchanged selection (selectObjectAnimation), or as the turn
// calls it (the turn has set the object's selection to none).
function selectAnimation(mem, wram) {
  const slot = word(wram, DP_OBJECT),
    selection = word(wram, DP_ARGUMENT);
  setObjectWord(mem, 'selection', slot, selection);
  // The entry of the kind's list: the selection doubled (ASL, its bit 15 to the carry)
  // plus the list word with that carry; the record's direction offsets take the carry
  // of that sum.
  const kindOffset = (objectWordIn(wram, 'kind', slot) << 1) & WORD_MASK,
    sum =
      ((selection << 1) & WORD_MASK) +
      readWord(mem, ACTION_TABLE + kindOffset) +
      (selection >>> (WORD_BITS - 1)),
    entry = sum & WORD_MASK;
  setWord(wram, DP_ENTRY, entry);
  for (const at of [DP_ENTRY_BANK, DP_RECORD_BANK, DP_FRAMES_BANK]) setWord(wram, at, ACTION_BANK);
  const record = actionWord(mem, entry, 0),
    directions = (record + RECORD_DIRECTIONS + (sum >>> WORD_BITS)) & WORD_MASK;
  setWord(wram, DP_RECORD, record);
  setObjectWord(mem, 'actionDirections', slot, directions);
  setWord(wram, DP_FRAMES, directions);
  const byte = (offset) => actionByte(mem, record, offset);
  setObjectWord(
    mem,
    'frameOffset',
    slot,
    actionByte(mem, directions, objectWord(mem, 'direction', slot)),
  );
  setObjectWordIn(wram, 'animationSpeed', slot, byte(0));
  setObjectWord(mem, 'frameCount', slot, byte(RECORD_FRAME_COUNT) ^ FRAME_LOOP_FLAG);
  setObjectWordIn(wram, 'frameRepeats', slot, 1);
  setObjectWord(mem, 'palette', slot, byte(RECORD_PALETTE));
  ['boxX1', 'boxX2', 'boxY1', 'boxY2'].forEach((name, n) =>
    setObjectWordIn(wram, name, slot, signedByte(byte(RECORD_BOX + n))),
  );
  setObjectWordIn(wram, 'boxHeight', slot, byte(RECORD_BOX_HEIGHT));
  setObjectWordIn(wram, 'animationClock', slot, ANIMATION_CLOCK_START);
  setObjectWord(mem, 'pictureChange', slot, NONE);
}

// Select the animation in word 02 for the object in word 00 unless it is already
// selected (80:A985 as 80:D15C calls it).
export function selectObjectAnimation(mem, wram) {
  const slot = word(wram, DP_OBJECT);
  if (word(wram, DP_ARGUMENT) === objectWord(mem, 'selection', slot)) return;
  selectAnimation(mem, wram);
}

// Turn the object in word 00 to the direction in word 02 (80:AAAF). Game state only
// (user decision 2026-11-17): it leaves no registers and no return words in free stack
// bytes; the register-level reference is turnRegisters in
// proof/script/native-object-turn.mjs.
export function turnObject(mem, wram) {
  const slot = word(wram, DP_OBJECT),
    direction = word(wram, DP_ARGUMENT);
  const before = objectWord(mem, 'direction', slot);
  // An unchanged direction or no selection to repeat.
  if (before === direction) return;
  setObjectWord(mem, 'direction', slot, direction);
  const frames = objectWord(mem, 'frameCount', slot);
  if (frames === 0 || frames >= FRAME_LOOP_FLAG) {
    const selection = objectWord(mem, 'selection', slot);
    if (selection === NONE) return;
    // The original sets the object's selection to none first, which the selection
    // then replaces (for a slot far out of range the word may alias another).
    setWord(wram, DP_ARGUMENT, selection & ~WORD_SIGN);
    setObjectWord(mem, 'selection', slot, NONE);
    // The selection's check for an unchanged selection: it holds only where that word
    // did not take the write (ROM above the WRAM mirror).
    if (word(wram, DP_ARGUMENT) !== objectWord(mem, 'selection', slot)) selectAnimation(mem, wram);
    return;
  }
  const directions = objectWord(mem, 'actionDirections', slot);
  setWord(wram, DP_FRAMES, directions);
  setWord(wram, DP_FRAMES_BANK, ACTION_BANK);
  // The frame offset's byte keeps its phase: the 8-bit SBC and ADC of the two offsets.
  const frameOffset = objectWord(mem, 'frameOffset', slot),
    back = (frameOffset - actionByte(mem, directions, before)) & BYTE_MASK,
    forward = actionByte(mem, directions, direction);
  setObjectWord(
    mem,
    'frameOffset',
    slot,
    (frameOffset & ~BYTE_MASK) | ((back + forward) & BYTE_MASK),
  );
  setObjectWordIn(wram, 'animationClock', slot, ANIMATION_CLOCK_START);
  setObjectWord(mem, 'pictureChange', slot, NONE);
}

// The turn on the scene runtime of h.
export function turnObjectCall(h) {
  const { mem, wram } = sceneRuntime(h);
  turnObject(mem, wram);
}

// The animation selection's RTS form (80:A985) for register-level callers is
// selectAnimationJsr in tools/register-forms/jsr-forms.mjs.
