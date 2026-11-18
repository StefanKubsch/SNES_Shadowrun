// The movement of the action and spell glove (lifted from 80:BE6D; register-level
// version in proof/replay/native-glove.mjs, which the glove natives keep calling).
//
// While a glove is out (7E:01D8 not zero), the held directions on the pad move it:
// right and down accelerate its speed by 30 per frame up to 300 (a speed going the
// other way starts again from 0), left and up likewise down to -300, and no button
// on an axis stops it there. Its position moves by the speed and stays in 0300..EF00
// across and 0300..CE00 down (the high bytes are the screen pixels). While a
// direction is held, a glove that pointed at an object lets it go (80:BE5B, the name
// window closes; lifted in src/game/window-release.mjs); at rest, the glove looks for an
// object under it (80:BCBE, lifted in src/game/object-search.mjs, which opens the name
// window). Both run through their frames.
//
// Registers (user decision 2026-11-17): game state only; the routine leaves no A, X, Y
// or flags (the glove action, the object search and the scheduler round read none).
import { dialogCallBody } from '../system/native-call-continuation.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { objectSearchSequence } from './object-search.mjs';
import { releaseNameWindowCallSequence } from './window-release.mjs';
import {
  GLOVE_KIND,
  GLOVE_SPEED_X,
  GLOVE_SPEED_Y,
  GLOVE_TARGET_TAG,
  GLOVE_X,
  GLOVE_Y,
  PAD_DIRECTIONS,
  PAD_HELD,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const ACCELERATION = 0x30,
  MAX_SPEED = 0x300,
  MIN_SPEED = -MAX_SPEED & WORD_MASK,
  POSITION_MIN = 0x300,
  LIMIT_X = 0xef00,
  LIMIT_Y = 0xce00;
// The pad's direction bits after the byte swap: right, left, down, up.
const RIGHT = 1,
  LEFT = 2,
  DOWN = 4,
  UP = 8;
// Original call sites.
const RELEASE_CALL = 0x80bf33,
  RELEASE_TARGET = 0x80be5b,
  SEARCH_CALL = 0x80bf37,
  SEARCH_TARGET = 0x80bcbe;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// The speed on one axis: forward (right or down) up to 300, back down to -300, or none.
function axisSpeed(speed, forward, back) {
  if (forward) {
    const faster = ((speed & WORD_SIGN ? 0 : speed) + ACCELERATION) & WORD_MASK;
    return faster >= MAX_SPEED ? MAX_SPEED : faster;
  }
  if (back) {
    const faster = ((speed & WORD_SIGN ? speed : 0) - ACCELERATION) & WORD_MASK;
    return faster < MIN_SPEED ? MIN_SPEED : faster;
  }
  return 0;
}
// The position on one axis moved by the speed and kept in 0300..limit.
function axisPosition(position, speed, limit) {
  return Math.min(Math.max((position + speed) & WORD_MASK, POSITION_MIN), limit);
}

// Move the glove (80:BE6D), a sequence for a native call continuation: h the main
// loop's access (data bank 80), events its frame events, renderBuffer the
// text-buffer renderer used for an object name.
export function* gloveMoveSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { wram } = h.a.mem;
  let next = 'return';
  yield () => {
    if (!word(wram, GLOVE_KIND)) return;
    const directions = () => (word(wram, PAD_HELD) & PAD_DIRECTIONS) >>> BYTE_BITS,
      held = directions();
    setWord(wram, GLOVE_SPEED_X, axisSpeed(word(wram, GLOVE_SPEED_X), held & RIGHT, held & LEFT));
    setWord(wram, GLOVE_SPEED_Y, axisSpeed(word(wram, GLOVE_SPEED_Y), held & DOWN, held & UP));
    setWord(wram, GLOVE_X, axisPosition(word(wram, GLOVE_X), word(wram, GLOVE_SPEED_X), LIMIT_X));
    setWord(wram, GLOVE_Y, axisPosition(word(wram, GLOVE_Y), word(wram, GLOVE_SPEED_Y), LIMIT_Y));
    // The directions are read again, as the original does.
    if (!directions()) next = 'search';
    else if (!(word(wram, GLOVE_TARGET_TAG) & WORD_SIGN)) next = 'release';
  };
  if (next === 'search')
    yield* dialogCallBody(h, SEARCH_CALL, SEARCH_TARGET, () =>
      objectSearchSequence(h, events, renderBuffer),
    );
  else if (next === 'release')
    yield* dialogCallBody(h, RELEASE_CALL, RELEASE_TARGET, () =>
      releaseNameWindowCallSequence(h, events),
    );
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
