// Register-level glove release 80:BCB2 and name window release 80:BE5B that only
// the dialog and glove references call; the game releases the glove through
// src/game/window-release.mjs.
import { releaseWindowAdapter } from './native-render-compose.mjs';
import { nativeCallSequence } from './native-call-sequences.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from '../../src/system/native-call-continuation.mjs';
import {
  GLOVE_KIND,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  GLOVE_NAME_WINDOW,
} from '../../src/data/wram.mjs';
import { WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_NEGATIVE } from '../../src/constants/cpu-flags.mjs';
import './dialog-register-helpers.mjs';

// 80:BCB2: glove off ($01D8 = 0); a non-negative $01DA frees the buffer $01DC via BE5B (FA3E).
export function putGloveAway(h, events, routines = null) {
  const r =
    routines === null
      ? RELEASE_ROUTINES
      : new Map([
          [0x80be5b, releaseGloveNameWindow],
          [0x80fa3e, () => routines.fa3e(h.a)],
        ]);
  return drainNativeSequence(gloveReleaseSequence(h, events, r));
}
// Original routine $80:BCB2.
function* gloveReleaseSequence(h, events, routines) {
  let result;
  yield () => {
    h.write(h.abs(GLOVE_KIND), 0);
    h.load(h.read(h.abs(GLOVE_TARGET_TAG)));
  };
  if (!(h.ctx.status & FLAG_NEGATIVE))
    yield* nativeCallSequence(h, events, routines, 0x80bcba, 0x80be5b);
  yield () => {
    result = h.rts();
  };
  return result;
}
// 80:BE5B: release the glove's name window through FA3E and clear the glove target.
export function releaseGloveNameWindow(h, events, routines = RELEASE_ROUTINES) {
  return drainNativeSequence(releaseGloveNameWindowSequence(h, events, routines));
}
export function* releaseGloveNameWindowSequence(h, events, routines) {
  let result;
  yield () => {
    h.load(h.read(h.abs(GLOVE_NAME_WINDOW)));
    h.dpWrite(0, h.ctx.a);
  };
  yield* nativeCallSequence(h, events, routines, 0x80be60, 0x80fa3e);
  yield () => {
    h.load(WORD_MASK);
    h.write(h.abs(GLOVE_TARGET_TAG), h.ctx.a);
    h.write(h.abs(GLOVE_TARGET_OBJECT), h.ctx.a);
    result = h.rts();
  };
  return result;
}
export const putGloveAwayAdapter = (h, e) => putGloveAway(h, e);
const RELEASE_ROUTINES = new Map([
  [0x80be5b, releaseGloveNameWindow],
  [0x80fa3e, releaseWindowAdapter],
]);
NATIVE_CALL_CONTINUATIONS.set(0x80bcb2, {
  run: putGloveAwayAdapter,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, gloveReleaseSequence(h, events, RELEASE_ROUTINES)),
});
NATIVE_CALL_CONTINUATIONS.set(0x80be5b, {
  run: releaseGloveNameWindow,
  create: ({ h, events, routines = RELEASE_ROUTINES }) =>
    new NativeCallContinuation(h.a, releaseGloveNameWindowSequence(h, events, routines)),
});
