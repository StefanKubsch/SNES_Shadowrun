// The window releases of the room entry (lifted from 80:FA3E, 80:FF79, 80:BCB2 and
// 80:BE5B; register-level versions in proof/system/native-render-compose.mjs,
// proof/replay/native-slot-release.mjs and src/system/native-dialog-portrait.mjs; the script
// natives call the live release; recorded callers remain in proof/caller/).
//
// A window is released by clearing its active word; releasing the last window moves
// the last index down to the previous active one and the next free tile back to the
// start of the window after it. The window list is redrawn after every release
// (window-list.mjs), so each release requests a window map upload and waits for the
// NMI. The notice windows release every used notice slot; putting the glove away
// releases the name window of the glove's target.
//
// The calls are JSRs within bank 80 (the redraw a JSL); their return words, and the
// slot index the notice windows push around a release, lie on the stack as in the
// original: the NMI of the upload wait writes below them. Each release passes its
// window in the direct page word 00, as the original. Window indices are game-sized
// (below 0100), so the tables are read in bank 7E.
//
// Registers (user decision 2026-11-17): the call forms leave no A, X or flags of their
// own; the routine forms (releaseNameWindowRoutineSequence and the others) keep the
// original's registers for register-level callers.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { drawWindowListSequence } from './window-list.mjs';
import {
  NATIVE_CALL_CONTINUATIONS,
  NativeCallContinuation,
  dialogCallBody,
  drainNativeSequence,
} from '../system/native-call-continuation.mjs';
import { dialogAccess } from '../system/native-dialog-support.mjs';
import {
  GLOVE_KIND,
  GLOVE_NAME_WINDOW,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  NOTICE_WINDOWS,
  NOTICE_WINDOW_LAST,
  WINDOW_ACTIVE,
  WINDOW_FIRST_INDEX,
  WINDOW_LAST_INDEX,
  WINDOW_NEXT_TILE,
  WINDOW_TILE_START,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const NOTICE_LOOP_END = 0xfffe,
  NONE = WORD_MASK,
  DP_WINDOW = 0x00,
  // A JSR pushes the address of its last byte.
  JSR_LAST_BYTE = 2;
// Original call sites: the redraw in the release, the release in the notice windows
// and in the name window release, the name window release in the glove.
const REDRAW_SITE = 0x80fa62,
  NOTICE_RELEASE_SITE = 0x80ff85,
  NAME_RELEASE_SITE = 0x80be60,
  GLOVE_NAME_SITE = 0x80bcba,
  NAME_RELEASE_TARGET = 0x80be5b;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Run sequence below the return word of a JSR at site.
function* belowJsr(h, site, sequence) {
  yield () => h.a.pushWord((site + JSR_LAST_BYTE) & WORD_MASK);
  yield* sequence;
  yield () => h.a.pullWord();
}

// Release the window in the direct page word 00 (80:FA3E) and redraw the window list;
// with registers the list leaves the original's X, Y, carry and overflow.
export function* releaseWindowSequence(h, events, registers = false) {
  const { wram } = sceneRuntime(h);
  yield () => {
    let x = word(wram, DP_WINDOW);
    setWord(wram, WINDOW_ACTIVE + x, 0);
    if (x !== word(wram, WINDOW_LAST_INDEX)) return;
    // Down to the previous active window, or past the first (index FFFE).
    do x = (x - 2) & WORD_MASK;
    while (!(x & WORD_SIGN) && !word(wram, WINDOW_ACTIVE + x));
    const next = (x + 2) & WORD_MASK;
    setWord(wram, WINDOW_NEXT_TILE, word(wram, WINDOW_TILE_START + next));
    setWord(wram, WINDOW_LAST_INDEX, x);
  };
  yield* drawWindowListSequence(h, events, REDRAW_SITE, registers);
}

// The release as called with JSR (80:FA3E), whose caller has pushed the frame; returns
// with its RTS as { rawReturnWord, returnTarget }.
function* releaseWindowCallSequence(h, events, registers = false) {
  yield* releaseWindowSequence(h, events, registers);
  let result;
  yield () => {
    const { ctx, a } = h,
      rawReturnWord = a.pullWord();
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    result = { rawReturnWord, returnTarget: (ctx.programBank << WORD_BITS) | ctx.pc };
  };
  return result;
}
// The live release entered with a caller-provided JSR frame. Recorded callers
// use the independently retained sequence in proof/caller/window-release.mjs.
export const releaseWindowJsrSequence = (a, events) =>
  releaseWindowCallSequence(dialogAccess(a), events);
// The routine for the callers' tables (target 80:FA3E), as releaseWindowJsrSequence.
export function runReleaseWindowCall(h, events) {
  return drainNativeSequence(releaseWindowCallSequence(h, events, true));
}
// Other tables bind the register-level release to 80:FA3E, so this continuation is found
// by its run function.
NATIVE_CALL_CONTINUATIONS.set(runReleaseWindowCall, {
  run: runReleaseWindowCall,
  create: (call) =>
    new NativeCallContinuation(call.h.a, releaseWindowCallSequence(call.h, call.events, true)),
});

// Release every used notice window, from the last slot down, and reset the first window
// index (80:FF79).
export function* releaseNoticeWindowsSequence(h, events, registers = false) {
  const { wram } = sceneRuntime(h);
  for (let x = NOTICE_WINDOW_LAST; x >= 0; x -= 2) {
    const window = word(wram, NOTICE_WINDOWS + x);
    if (window & WORD_SIGN) continue;
    yield () => {
      setWord(wram, DP_WINDOW, window);
      h.a.pushWord(x);
    };
    yield* belowJsr(h, NOTICE_RELEASE_SITE, releaseWindowSequence(h, events, registers));
    yield () => {
      h.a.pullWord();
      setWord(wram, NOTICE_WINDOWS + x, NONE);
    };
  }
  yield () => setWord(wram, WINDOW_FIRST_INDEX, 0);
}

// Put the glove away (80:BCB2); with a target under it, release the target's name
// window and forget the target (80:BE5B).
export function* putGloveAwaySequence(h, events) {
  const { wram } = sceneRuntime(h);
  yield () => setWord(wram, GLOVE_KIND, 0);
  if (word(wram, GLOVE_TARGET_TAG) & WORD_SIGN) return;
  yield* belowJsr(h, GLOVE_NAME_SITE, releaseGloveNameWindowSequence(h, events));
}
// Release the name window of the glove's target and forget the target (80:BE5B); the
// glove movement (src/game/glove-move.mjs) runs it in its JSR frame.
export function* releaseGloveNameWindowSequence(h, events, registers = false) {
  const { wram } = sceneRuntime(h);
  yield () => setWord(wram, DP_WINDOW, word(wram, GLOVE_NAME_WINDOW));
  yield* belowJsr(h, NAME_RELEASE_SITE, releaseWindowSequence(h, events, registers));
  yield () => {
    setWord(wram, GLOVE_TARGET_TAG, NONE);
    setWord(wram, GLOVE_TARGET_OBJECT, NONE);
  };
}

// The name window release as called with JSR (80:BE5B), a sequence for the glove's
// movement and object search; returns with its RTS.
export function* releaseNameWindowCallSequence(h, events, registers = false) {
  yield* releaseGloveNameWindowSequence(h, events, registers);
  return yield* rts(h);
}

// Put the glove away as called with JSR (80:BCB2), a sequence for the glove action;
// the name window release runs in its JSR frame. Returns with its RTS.
export function* putGloveAwayCallSequence(h, events, release = releaseNameWindowCallSequence) {
  const { wram } = sceneRuntime(h);
  let target = false;
  yield () => {
    setWord(wram, GLOVE_KIND, 0);
    target = !(word(wram, GLOVE_TARGET_TAG) & WORD_SIGN);
  };
  if (target)
    yield* dialogCallBody(h, GLOVE_NAME_SITE, NAME_RELEASE_TARGET, () => release(h, events));
  return yield* rts(h);
}

// The notice windows' release as called with JSR (80:FF79), a sequence for the dialog.
// Returns with its RTS.
export function* releaseNoticeWindowsCallSequence(h, events, registers = false) {
  yield* releaseNoticeWindowsSequence(h, events, registers);
  return yield* rts(h);
}
function* rts(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// Register forms for register-level callers. The name window release leaves A FFFF
// with its sign and zero, and X, Y, the carry and the overflow of the window list's
// redraw, as the original.
const setSignZero = (ctx, value) => {
  ctx.status = value & WORD_SIGN ? ctx.status | FLAG_NEGATIVE : ctx.status & ~FLAG_NEGATIVE;
  ctx.status = value === 0 ? ctx.status | FLAG_ZERO : ctx.status & ~FLAG_ZERO;
};
export function* releaseNameWindowRoutineSequence(h, events) {
  const result = yield* releaseNameWindowCallSequence(h, events, true);
  h.ctx.a = NONE;
  setSignZero(h.ctx, NONE);
  return result;
}
// Putting the glove away leaves A the target tag with its sign and zero and X, Y, the
// carry and the overflow unchanged without a target; with one, the registers of the
// name window release.
export function* putGloveAwayRoutineSequence(h, events) {
  const tag = word(sceneRuntime(h).wram, GLOVE_TARGET_TAG),
    result = yield* putGloveAwayCallSequence(h, events, releaseNameWindowRoutineSequence);
  if (tag & WORD_SIGN) {
    h.ctx.a = tag;
    setSignZero(h.ctx, tag);
  }
  return result;
}
// The notice windows' release leaves A the last slot's window (FFFF when it was
// released), X FFFE with the sign set and Y, the carry and the overflow of the last
// release (or as they came).
export function* releaseNoticeWindowsRoutineSequence(h, events) {
  const result = yield* releaseNoticeWindowsCallSequence(h, events, true),
    { ctx } = h;
  ctx.a = word(sceneRuntime(h).wram, NOTICE_WINDOWS);
  ctx.x = NOTICE_LOOP_END;
  setSignZero(ctx, NOTICE_LOOP_END);
  return result;
}

// The glove and the notice windows as the caller's JSRs at site.
export const putGloveAwayCall = (h, events, site) =>
  belowJsr(h, site, putGloveAwaySequence(h, events));
export const releaseNoticeWindowsCall = (h, events, site) =>
  belowJsr(h, site, releaseNoticeWindowsSequence(h, events));
