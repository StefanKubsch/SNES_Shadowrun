// Move the active glove, release a marked object while moving, and search at rest.
import { gloveState } from '../state/glove.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { objectSearch } from './object-search.mjs';
import { releaseGloveNameWindowSequence } from './window-release.mjs';
import { PAD_DIRECTIONS } from '../data/wram.mjs';
import { BYTE_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

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

export function* gloveMove(h, events, renderBuffer = drawTextBuffer) {
  const glove = gloveState(h.a.mem);
  let next = 'return';
  yield () => {
    if (!glove.kind) return;
    const directions = () => (glove.held & PAD_DIRECTIONS) >>> BYTE_BITS,
      held = directions();
    glove.speedX = axisSpeed(glove.speedX, held & RIGHT, held & LEFT);
    glove.speedY = axisSpeed(glove.speedY, held & DOWN, held & UP);
    glove.x = axisPosition(glove.x, glove.speedX, LIMIT_X);
    glove.y = axisPosition(glove.y, glove.speedY, LIMIT_Y);
    // The directions are read again, as the original does.
    if (!directions()) next = 'search';
    else if (!(glove.targetTag & WORD_SIGN)) next = 'release';
  };
  if (next === 'search') yield* objectSearch(h, events, renderBuffer);
  else if (next === 'release') yield* releaseGloveNameWindowSequence(h, events);
}
