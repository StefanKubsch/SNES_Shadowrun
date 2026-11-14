// Register-level reference of the title cycle 80:A18C, the attract game 80:A168 and
// its owner 80:96F3 (the lifted versions are src/frontend/title-cycle.mjs).
import {
  CREDITS_ARGUMENT,
  CREDITS_SEQUENCE,
  endingMusic,
  markMenuCredits,
  musicSilent,
  takeCreditsRequest,
} from '../../src/game/credits.mjs';
import { frontendCallSequence } from '../../src/task/main-frontend-text.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  dialogCallBody,
  drainNativeSequence,
} from '../../src/task/native-call-continuation.mjs';
import {
  FRONTEND_ROUTINES,
  attractRoundsSequence,
  runAttractRounds,
} from '../../src/task/main-frontend.mjs';
import { INTRO_SETUP_REFERENCE_ENTRIES } from '../intro-reference/intro-routines.mjs';
import { GAME_OWNER_REFERENCE_ENTRIES, runMenuGameMarker } from './game-owner.mjs';
import { taskStop } from '../../src/task/plan.mjs';
import { FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import { CODE_BANK_PAIR } from '../../src/constants/memory-map.mjs';

const bank80 = (h) => {
  h.push(CODE_BANK_PAIR, 2);
  h.plb();
  h.plb();
};
// Sound directory of the title and start menu (98:FFFA + 3, src/data/sound.mjs).
const TITLE_SOUND_DIRECTORY = 3;
// The title song (81:F229), started by the attract loop.
const SONG_TITLE = 1;
// The start menu result of a cancel (81:E14A).
const MENU_CANCELLED = 0xfffe;
// The room of the attract game (80:A4BF enters it).
const ATTRACT_ROOM = 0xab;
const sequenceCall =
  (h, e, r) =>
  (pc, target, long = false) =>
    frontendCallSequence(h, e, r, pc, target, long);

// The attract game A168: 96F3 owns the demo's main loop and its rounds.
function runFrontendAttractGame(h, e, r = referenceRoutines()) {
  return drainNativeSequence(frontendAttractGameSequence(h, e, r));
}
function* frontendAttractGameSequence(h, e, r) {
  const call = sequenceCall(h, e, r);
  yield* call(0x80a168, 0x81ef63, true);
  yield* call(0x80a16c, 0x8096f3, true);
  bank80(h);
  yield* call(0x80a175, 0x81eb97, true);
  h.load(0);
  yield* call(0x80a17c, 0x81f229, true);
  h.load(TITLE_SOUND_DIRECTORY);
  yield* call(0x80a183, 0x81f092, true);
  yield* call(0x80a187, 0x81ddb1, true);
  return h.rts();
}
// Original routine $80:A18C.
function runTitleCycle(h, e, r = referenceRoutines()) {
  return drainNativeSequence(titleCycleSequence(h, e, r));
}
function* titleCycleSequence(h, e, r) {
  const { ctx } = h,
    call = sequenceCall(h, e, r);
  h.php();
  h.pha();
  bank80(h);
  h.load(0);
  yield* call(0x80a196, 0x81f229, true);
  h.load(TITLE_SOUND_DIRECTORY);
  yield* call(0x80a19d, 0x81f092, true);
  h.pla();
  let at;
  if (ctx.status & FLAG_ZERO) {
    yield* call(0x80a1a4, 0x81ddb1, true);
    h.load(SONG_TITLE);
    yield* call(0x80a1ab, 0x81f229, true);
    at = 0x80a1d6;
  } else {
    yield* call(0x80a1b1, 0x81d694, true);
    if (ctx.status & FLAG_ZERO) {
      h.load(1);
      yield* call(0x80a1ba, 0x81e14a, true);
    } else {
      h.load(0);
      yield* call(0x80a1c7, 0x81e14a, true);
    }
    at = 0x80a1cb;
  }
  // The port's credits from the start menu (src/game/credits.mjs), with the frame
  // of the attract game's call at A1D0 (see src/frontend/title-cycle.mjs).
  const credits = function* () {
    const silent = musicSilent(h.a.mem.wram);
    if (silent) {
      yield* call(0x80a1d0, 0x81ef63, true);
      bank80(h);
      h.load(endingMusic(h.a.mem));
      yield* call(0x80a1d0, 0x81ef47, true);
    }
    h.load(CREDITS_SEQUENCE);
    h.index('x', CREDITS_ARGUMENT);
    markMenuCredits(h.a.vm, true);
    yield* call(0x80a1d0, 0x81cdf8, true);
    markMenuCredits(h.a.vm, false);
    if (silent) {
      bank80(h);
      yield* call(0x80a1d0, 0x81ef94, true);
      h.load(0);
      yield* call(0x80a1d0, 0x81f229, true);
      h.load(TITLE_SOUND_DIRECTORY);
      yield* call(0x80a1d0, 0x81f092, true);
    }
  };
  for (;;) {
    if (at === 0x80a1d6) {
      h.load(0);
      yield* call(at, 0x81e14a, true);
      h.cmp(MENU_CANCELLED);
      if (!(ctx.status & FLAG_ZERO)) break;
      if (takeCreditsRequest(h.a.vm)) {
        yield* credits();
        continue;
      }
      yield* call(0x80a1c0, 0x81d694, true);
      h.load(0);
      yield* call(0x80a1c7, 0x81e14a, true);
    }
    h.cmp(MENU_CANCELLED);
    if (!(ctx.status & FLAG_ZERO)) break;
    if (takeCreditsRequest(h.a.vm)) yield* credits();
    else yield* call(0x80a1d0, 0x80a168);
    at = 0x80a1d6;
  }
  bank80(h);
  h.plp();
  return h.rts();
}
// Attract game, called from A168. The original 96FC JSR owns the complete
// main loop until either real RTS; the following 96FF RTL owns A16C's frame.
export function playAttractGame(h, e, r = referenceRoutines()) {
  return drainNativeSequence(frontendAttractLoopSequence(h, e, r));
}
// Original routine $80:96F3.
function* frontendAttractLoopSequence(h, e, r) {
  const call = sequenceCall(h, e, r);
  yield* call(0x8096f3, 0x80e24e);
  yield* call(0x8096f6, 0x80960d);
  h.load(ATTRACT_ROOM);
  const run = r.get(0x809699);
  if (!run) taskStop('main_loop_frontier', { target: 0x809699 });
  if (run === runAttractRounds)
    yield* dialogCallBody(h, 0x8096fc, 0x809699, () => attractRoundsSequence(h, e, r));
  else yield* call(0x8096fc, 0x809699);
  return h.rtl();
}

const REFERENCE = [
  [0x80a18c, runTitleCycle, titleCycleSequence],
  [0x80a168, runFrontendAttractGame, frontendAttractGameSequence],
  [0x8096f3, playAttractGame, frontendAttractLoopSequence],
];
export const TITLE_CYCLE_REFERENCE_ENTRIES = [
  ...INTRO_SETUP_REFERENCE_ENTRIES,
  // The no-countdown marker the demo owner 96F3 calls.
  [0x80e24e, runMenuGameMarker],
  ...REFERENCE.map(([target, run]) => [target, run]),
];
// The frontend routines with these references (built on first use: the task tables
// and this module import each other).
let routines = null;
function referenceRoutines() {
  routines ??= new Map([
    ...FRONTEND_ROUTINES,
    ...TITLE_CYCLE_REFERENCE_ENTRIES,
    ...GAME_OWNER_REFERENCE_ENTRIES,
  ]);
  return routines;
}
for (const [, run, sequence] of REFERENCE)
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events, routines = referenceRoutines() }) =>
      new NativeCallContinuation(h.a, sequence(h, events, routines)),
  });
