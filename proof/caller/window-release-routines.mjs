// The register-level routine forms of the window releases (moved from
// src/game/window-release.mjs): each runs the lifted release with the window list's
// registers and leaves A, X and the flags as the original, for register-level callers
// and their tables (the register-level 80:FA3E entry is in window-release.mjs here).
import {
  putGloveAwayCallSequence,
  releaseNameWindowCallSequence,
  releaseNoticeWindowsCallSequence,
} from '../../src/game/window-release.mjs';
import { GLOVE_TARGET_TAG, NOTICE_WINDOWS } from '../../src/data/wram.mjs';
import { BYTE_BITS, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

const NONE = WORD_MASK,
  NOTICE_LOOP_END = 0xfffe;
const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setSignZero = (ctx, value) => {
  ctx.status = value & WORD_SIGN ? ctx.status | FLAG_NEGATIVE : ctx.status & ~FLAG_NEGATIVE;
  ctx.status = value === 0 ? ctx.status | FLAG_ZERO : ctx.status & ~FLAG_ZERO;
};

// The name window release 80:BE5B leaves A FFFF with its sign and zero, and X, Y, the
// carry and the overflow of the window list's redraw, as the original.
export function* releaseNameWindowRoutineSequence(h, events) {
  const result = yield* releaseNameWindowCallSequence(h, events, true);
  h.ctx.a = NONE;
  setSignZero(h.ctx, NONE);
  return result;
}
// Putting the glove away (80:BCB2) leaves A the target tag with its sign and zero and X,
// Y, the carry and the overflow unchanged without a target; with one, the registers of
// the name window release.
export function* putGloveAwayRoutineSequence(h, events) {
  const tag = word(h.a.mem.wram, GLOVE_TARGET_TAG),
    result = yield* putGloveAwayCallSequence(h, events, releaseNameWindowRoutineSequence);
  if (tag & WORD_SIGN) {
    h.ctx.a = tag;
    setSignZero(h.ctx, tag);
  }
  return result;
}
// The notice windows' release (80:FF79) leaves A the last slot's window (FFFF when it
// was released), X FFFE with the sign set and Y, the carry and the overflow of the last
// release (or as they came).
export function* releaseNoticeWindowsRoutineSequence(h, events) {
  const result = yield* releaseNoticeWindowsCallSequence(h, events, true),
    { ctx } = h;
  ctx.a = word(h.a.mem.wram, NOTICE_WINDOWS);
  ctx.x = NOTICE_LOOP_END;
  setSignZero(ctx, NOTICE_LOOP_END);
  return result;
}
