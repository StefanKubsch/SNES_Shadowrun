import { readStateByte, writeStateByte } from '../state/objects.mjs';
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
// The calls are JSRs within bank 80 (the redraw a JSL). Their return words and the slot
// index the notice windows push around a release lie only in free stack bytes and are
// kept in locals. The redraw and upload wait compose directly without frames.
// Each release passes its window in the direct page word
// 00, as the original. Window indices are game-sized
// (below 0100), so the tables are read in bank 7E.
//
// Registers (user decision 2026-11-17): the call forms leave no A, X or flags of their
// own. The register forms for register-level callers live in
// proof/caller/window-release.mjs.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { drawWindowListSequence } from './window-list.mjs';
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

const NONE = WORD_MASK,
  DP_WINDOW = 0x00;
const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// Release the window in the direct page word 00 (80:FA3E) and redraw the window list.
export function* releaseWindowSequence(h, events) {
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
  yield* drawWindowListSequence(h, events);
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
// The live release entered with a caller-provided JSR frame. Recorded callers
// use the independently retained sequence in proof/caller/window-release.mjs.
export const releaseWindowJsrSequence = (a, events) =>
  releaseWindowCallSequence(dialogAccess(a), events);
// Release every used notice window, from the last slot down, and reset the first window
// index (80:FF79).
export function* releaseNoticeWindowsSequence(h, events) {
  const { wram } = sceneRuntime(h);
  for (let x = NOTICE_WINDOW_LAST; x >= 0; x -= 2) {
    const window = word(wram, NOTICE_WINDOWS + x);
    if (window & WORD_SIGN) continue;
    yield () => setWord(wram, DP_WINDOW, window);
    yield* releaseWindowSequence(h, events);
    yield () => setWord(wram, NOTICE_WINDOWS + x, NONE);
  }
  yield () => setWord(wram, WINDOW_FIRST_INDEX, 0);
}

// Put the glove away (80:BCB2); with a target under it, release the target's name
// window and forget the target (80:BE5B).
export function* putGloveAwaySequence(h, events) {
  const { wram } = sceneRuntime(h);
  yield () => setWord(wram, GLOVE_KIND, 0);
  if (word(wram, GLOVE_TARGET_TAG) & WORD_SIGN) return;
  yield* releaseGloveNameWindowSequence(h, events);
}
// Release the name window of the glove's target and forget the target (80:BE5B); the
// glove movement (src/game/glove-move.mjs) runs it in its JSR frame.
export function* releaseGloveNameWindowSequence(h, events) {
  const { wram } = sceneRuntime(h);
  yield () => setWord(wram, DP_WINDOW, word(wram, GLOVE_NAME_WINDOW));
  yield* releaseWindowSequence(h, events);
  yield () => {
    setWord(wram, GLOVE_TARGET_TAG, NONE);
    setWord(wram, GLOVE_TARGET_OBJECT, NONE);
  };
}

// The name window release as called with JSR (80:BE5B), a sequence for the glove's
// movement and object search; returns with its RTS.
export function* releaseNameWindowCallSequence(h, events) {
  yield* releaseGloveNameWindowSequence(h, events);
  return yield* rts(h);
}

// Compatibility JSR entry: cleanup composes directly, then consumes the outer RTS.
export function* putGloveAwayCallSequence(h, events) {
  yield* putGloveAwaySequence(h, events);
  return yield* rts(h);
}

// The notice windows' release as called with JSR (80:FF79), a sequence for the dialog.
// Returns with its RTS.
export function* releaseNoticeWindowsCallSequence(h, events, outerReturn = true) {
  yield* releaseNoticeWindowsSequence(h, events);
  if (outerReturn) return yield* rts(h);
}
function* rts(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
