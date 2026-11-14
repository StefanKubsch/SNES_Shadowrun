// The window releases of the room entry (lifted from 80:FA3E, 80:FF79, 80:BCB2 and
// 80:BE5B; register-level versions in src/task/native-render-compose.mjs,
// src/task/native-slot-release.mjs and src/task/native-dialog-portrait.mjs; the script
// natives call 80:FA3E lifted with lag-free frames, recorded runs register-level).
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
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { drawWindowListSequence } from './window-list.mjs';
import {
  NATIVE_CALL_CONTINUATIONS,
  NativeCallContinuation,
  dialogCallBody,
  drainNativeSequence,
} from '../task/native-call-continuation.mjs';
import {
  releaseWindowAdapter,
  releaseWindowSequence as releaseWindowReference,
} from '../task/native-render-compose.mjs';
import { dialogAccess } from '../task/native-dialog-support.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
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
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const NONE = WORD_MASK,
  DP_WINDOW = 0x00,
  // A JSR pushes the address of its last byte.
  JSR_LAST_BYTE = 2;
// Original call sites: the redraw in the release, the release in the notice windows
// and in the name window release, the name window release in the glove.
const RELEASE_WINDOW = 0x80fa3e,
  REDRAW_SITE = 0x80fa62,
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

// Release the window in the direct page word 00 (80:FA3E) and redraw the window list.
export function* releaseWindowSequence(h, events) {
  const { wram } = sceneRuntime(h);
  yield () => {
    const { ctx } = h;
    let x = word(wram, DP_WINDOW);
    setWord(wram, WINDOW_ACTIVE + x, 0);
    // X stays the window (or the window found below the last one), the carry is that of
    // CPX with the last index; a window list without windows leaves them so.
    const last = word(wram, WINDOW_LAST_INDEX);
    ctx.x = x;
    ctx.status = x >= last ? ctx.status | FLAG_CARRY : ctx.status & ~FLAG_CARRY;
    if (x !== last) return;
    // Down to the previous active window, or past the first (index FFFE).
    do x = (x - 2) & WORD_MASK;
    while (!(x & WORD_SIGN) && !word(wram, WINDOW_ACTIVE + x));
    const next = (x + 2) & WORD_MASK;
    setWord(wram, WINDOW_NEXT_TILE, word(wram, WINDOW_TILE_START + next));
    setWord(wram, WINDOW_LAST_INDEX, x);
    ctx.x = x;
  };
  yield* drawWindowListSequence(h, events, REDRAW_SITE);
}

// The release as called with JSR (80:FA3E), whose caller has pushed the frame; returns
// with its RTS as { rawReturnWord, returnTarget }.
function* releaseWindowCallSequence(h, events) {
  yield* releaseWindowSequence(h, events);
  let result;
  yield () => {
    const { ctx, a } = h,
      rawReturnWord = a.pullWord();
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    result = { rawReturnWord, returnTarget: (ctx.programBank << WORD_BITS) | ctx.pc };
  };
  return result;
}
// 80:FA3E as a sequence for the register-level callers (with their accessor a): lifted
// with the lag-free frame model; with recorded interrupt observations the register-level
// release (src/task/native-render-compose.mjs) replays them.
export const releaseWindowJsrSequence = (a, events) =>
  lagFree(events)
    ? releaseWindowCallSequence(dialogAccess(a), events)
    : releaseWindowReference(a, events, false);
// The routine for the callers' tables (target 80:FA3E), as releaseWindowJsrSequence.
export function runReleaseWindowCall(h, events) {
  if (!lagFree(events)) return releaseWindowAdapter(h, events);
  return drainNativeSequence(releaseWindowCallSequence(h, events));
}
// Other tables bind the register-level release to 80:FA3E, so this continuation is found
// by its run function.
NATIVE_CALL_CONTINUATIONS.set(runReleaseWindowCall, {
  run: runReleaseWindowCall,
  create: (call) =>
    lagFree(call.events)
      ? new NativeCallContinuation(call.h.a, releaseWindowCallSequence(call.h, call.events))
      : NATIVE_CALL_CONTINUATIONS.get(RELEASE_WINDOW).create(call),
});

// Release every used notice window, from the last slot down, and reset the first window
// index (80:FF79).
export function* releaseNoticeWindowsSequence(h, events) {
  const { wram } = sceneRuntime(h);
  for (let x = NOTICE_WINDOW_LAST; x >= 0; x -= 2) {
    const window = word(wram, NOTICE_WINDOWS + x);
    if (window & WORD_SIGN) continue;
    yield () => {
      setWord(wram, DP_WINDOW, window);
      h.a.pushWord(x);
    };
    yield* belowJsr(h, NOTICE_RELEASE_SITE, releaseWindowSequence(h, events));
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
export function* releaseGloveNameWindowSequence(h, events) {
  const { wram } = sceneRuntime(h);
  yield () => setWord(wram, DP_WINDOW, word(wram, GLOVE_NAME_WINDOW));
  yield* belowJsr(h, NAME_RELEASE_SITE, releaseWindowSequence(h, events));
  yield () => {
    setWord(wram, GLOVE_TARGET_TAG, NONE);
    setWord(wram, GLOVE_TARGET_OBJECT, NONE);
  };
}

// The name window release as called with JSR (80:BE5B), a sequence for the glove's
// movement and object search: leaves A FFFF with its sign and zero, and X, Y, the carry
// and the overflow of the window list's redraw, as the original; returns with its RTS.
export function* releaseNameWindowCallSequence(h, events) {
  yield* releaseGloveNameWindowSequence(h, events);
  let result;
  yield () => {
    const { ctx } = h;
    ctx.a = NONE;
    ctx.status = (ctx.status | FLAG_NEGATIVE) & ~FLAG_ZERO;
    result = h.rts();
  };
  return result;
}

// Put the glove away as called with JSR (80:BCB2), a sequence for the glove action:
// leaves A the target tag with its sign and zero, X, Y, the carry and the overflow
// unchanged without a target; with one, the registers of the name window release
// (releaseNameWindowCallSequence), which runs in its JSR frame. Returns with its RTS.
export function* putGloveAwayCallSequence(h, events) {
  const { wram } = sceneRuntime(h);
  let target = false;
  yield () => {
    const { ctx } = h;
    setWord(wram, GLOVE_KIND, 0);
    ctx.a = word(wram, GLOVE_TARGET_TAG);
    ctx.status = ctx.a & WORD_SIGN ? ctx.status | FLAG_NEGATIVE : ctx.status & ~FLAG_NEGATIVE;
    ctx.status = ctx.a === 0 ? ctx.status | FLAG_ZERO : ctx.status & ~FLAG_ZERO;
    target = !(ctx.a & WORD_SIGN);
  };
  if (target)
    yield* dialogCallBody(h, GLOVE_NAME_SITE, NAME_RELEASE_TARGET, () =>
      releaseNameWindowCallSequence(h, events),
    );
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// The notice windows' release as called with JSR (80:FF79), a sequence for the dialog:
// leaves A the last slot's window (FFFF when it was released), X FFFE with the sign set
// and Y, the carry and the overflow of the last release (or as they came), as the
// original. Returns with its RTS.
export function* releaseNoticeWindowsCallSequence(h, events) {
  const { ctx } = h,
    { wram } = sceneRuntime(h);
  for (let x = NOTICE_WINDOW_LAST; x >= 0; x -= 2) {
    const window = word(wram, NOTICE_WINDOWS + x);
    yield () => (ctx.a = window);
    if (window & WORD_SIGN) continue;
    yield () => {
      setWord(wram, DP_WINDOW, window);
      h.a.pushWord(x);
    };
    yield* belowJsr(h, NOTICE_RELEASE_SITE, releaseWindowSequence(h, events));
    yield () => {
      h.a.pullWord();
      ctx.a = NONE;
      setWord(wram, NOTICE_WINDOWS + x, NONE);
    };
  }
  let result;
  yield () => {
    setWord(wram, WINDOW_FIRST_INDEX, 0);
    ctx.x = -2 & WORD_MASK;
    ctx.status = (ctx.status | FLAG_NEGATIVE) & ~FLAG_ZERO;
    result = h.rts();
  };
  return result;
}

// The glove and the notice windows as the caller's JSRs at site.
export const putGloveAwayCall = (h, events, site) =>
  belowJsr(h, site, putGloveAwaySequence(h, events));
export const releaseNoticeWindowsCall = (h, events, site) =>
  belowJsr(h, site, releaseNoticeWindowsSequence(h, events));
