// The movement of the action and spell glove (lifted from 80:BE6D; register-level
// version in src/task/native-glove.mjs, which the glove natives keep calling).
//
// While a glove is out (7E:01D8 not zero), the held directions on the pad move it:
// right and down accelerate its speed by 30 per frame up to 300 (a speed going the
// other way starts again from 0), left and up likewise down to -300, and no button
// on an axis stops it there. Its position moves by the speed and stays in 0300..EF00
// across and 0300..CE00 down (the high bytes are the screen pixels). While a
// direction is held, a glove that pointed at an object lets it go (80:BE5B, the name
// window closes; lifted in src/game/window-release.mjs); at rest, the glove looks for an
// object under it (80:BCBE, lifted in src/game/object-search.mjs, which opens the name
// window). Both run through their frames; the scheduler round starts with the flags the
// release leaves, which the lifted window list produces as the original.
//
// The glove action 80:BF3B follows in the main loop and may return at once, so the
// scheduler round 80:C1E3 starts with what this routine leaves where no callee runs
// last: A, its sign and zero, X (the directions shifted right once), the overflow of
// the position addition down and the carry of its comparison with CE01. The object
// search reads that carry too.
import { dialogCallBody } from '../task/native-call-continuation.mjs';
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
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

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
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const signAndZero = (ctx, value) => {
  flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  flag(ctx, FLAG_ZERO, value === 0);
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
// The position on one axis moved by the speed and kept in 0300..limit; with the
// overflow of the addition and the carry of the comparison with limit + 1.
function axisPosition(position, speed, limit) {
  const sum = (position + speed) & WORD_MASK,
    raised = Math.max(sum, POSITION_MIN),
    carry = raised >= limit + 1;
  return {
    position: carry ? limit : raised,
    overflow: (~(position ^ speed) & (position ^ sum) & WORD_SIGN) !== 0,
    carry,
  };
}

// Move the glove (80:BE6D), a sequence for a native call continuation: h the main
// loop's access (data bank 80), events its frame events, routines the table of the
// register-level callees of the object search and the release.
export function* gloveMoveSequence(h, events, routines) {
  const { ctx } = h,
    { wram } = h.a.mem;
  let next = 'return';
  yield () => {
    const kind = word(wram, GLOVE_KIND);
    if (!kind) {
      ctx.a = 0;
      signAndZero(ctx, 0);
      return;
    }
    const directions = () => (word(wram, PAD_HELD) & PAD_DIRECTIONS) >>> BYTE_BITS,
      held = directions();
    setWord(wram, GLOVE_SPEED_X, axisSpeed(word(wram, GLOVE_SPEED_X), held & RIGHT, held & LEFT));
    setWord(wram, GLOVE_SPEED_Y, axisSpeed(word(wram, GLOVE_SPEED_Y), held & DOWN, held & UP));
    const x = axisPosition(word(wram, GLOVE_X), word(wram, GLOVE_SPEED_X), LIMIT_X);
    setWord(wram, GLOVE_X, x.position);
    const y = axisPosition(word(wram, GLOVE_Y), word(wram, GLOVE_SPEED_Y), LIMIT_Y);
    setWord(wram, GLOVE_Y, y.position);
    ctx.x = held >>> 1;
    flag(ctx, FLAG_OVERFLOW, y.overflow);
    flag(ctx, FLAG_CARRY, y.carry);
    // The directions are read again, as the original does.
    if (!directions()) {
      ctx.a = 0;
      signAndZero(ctx, 0);
      next = 'search';
      return;
    }
    const tag = word(wram, GLOVE_TARGET_TAG);
    ctx.a = tag;
    signAndZero(ctx, tag);
    if (!(tag & WORD_SIGN)) next = 'release';
  };
  if (next === 'search')
    yield* dialogCallBody(h, SEARCH_CALL, SEARCH_TARGET, () =>
      objectSearchSequence(h, events, routines),
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
