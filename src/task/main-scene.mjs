import {
  installSceneNmiAndClearPalette,
  setSceneScreenRegisters,
  interpretSceneList,
  unpackStreamForBank81,
  unpackPortraitForBank81,
  enableNmiAndJoypad,
  setNmiEnable,
  sendOamBuffer,
} from './main-scene-video.mjs';
import {
  waitForFrame,
  waitFrames,
  fadeInScreen,
  fadeOutScreen,
  readJoypadLong,
  readJoypad,
} from './main-scene-wait.mjs';
import { sendApuCommandRoutine, setMusicModeRoutine } from '../apu/audio-routines.mjs';
import { randomBelow, randomBelowLong } from './native-random.mjs';
import { handleMatrixNmi, matrixSceneSequence } from '../matrix/matrix-scene.mjs';
import { cutsceneSequence, handleCutsceneNmi } from '../cutscene/cutscene-scene.mjs';
import { introSequence, setUpGameAudioRoutine } from '../intro/intro-scene.mjs';
import { MAIN_UPKEEP_ROUTINES } from './main-loop-upkeep.mjs';
import { INTRO_NMI_ROUTINES } from './main-intro-nmi.mjs';
import { GAME_NMI_ROUTINES } from './main-game-nmi.mjs';
import { GAME_NMI_LIFTED_JOBS } from '../game/game-nmi.mjs';
import { ObservedWaitContinuation } from './main-wait-interrupt.mjs';
import { TRANSITION_ROUTINES } from './main-transition.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from './native-call-continuation.mjs';

import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
// CDF8 and Matrix setup, control and object display with observed waits.
// No NMI/DMA/frame execution is inferred.

export const MAIN_SCENE_ROUTINES = new Map([
  ...TRANSITION_ROUTINES,
  // The lifted matrix (src/matrix) and the shared routines it calls.
  [0x81bec3, handleMatrixNmi],
  [0x81ed8b, sendOamBuffer],
  [0x80f290, readJoypadLong],
  [0x80f2a8, randomBelowLong],
  [0x80c51f, (h) => randomBelow(h.a, false)],
  ...INTRO_NMI_ROUTINES,
  ...GAME_NMI_ROUTINES,
  // The lifted jobs of the game NMI handler (src/game/game-nmi.mjs).
  ...GAME_NMI_LIFTED_JOBS,
  [0x81eb97, installSceneNmiAndClearPalette],
  [0x81ebe9, setSceneScreenRegisters],
  [0x81ec16, interpretSceneList],
  [0x80f2a0, unpackStreamForBank81],
  [0x80f2a4, unpackPortraitForBank81],
  [0x81eb7b, enableNmiAndJoypad],
  [0x81eb89, setNmiEnable],
  // The lifted audio (src/apu/audio-routines.mjs); the song start 81:F229 and the
  // sample loader 81:F130 with its helpers have no register-level caller left in
  // src (references: proof/apu-reference/audio-routines.mjs).
  [0x81ef47, setMusicModeRoutine],
  [0x81f007, sendApuCommandRoutine],
  [0x809e1a, MAIN_UPKEEP_ROUTINES.get(0x809e1a)],
  [0x80f298, readInputLong],
  [0x81eebb, waitForFrame],
  [0x81eed5, waitFrames],
  [0x81eedd, fadeInScreen],
  [0x81eef1, fadeOutScreen],
  // The lifted cutscenes (src/cutscene).
  [0x81d479, handleCutsceneNmi],
  [0x80f290, readJoypadLong],
  [0x809e0b, readJoypad],
  [0x81cdf8, playCutscene],
  // The lifted intro (src/intro); its register-level set-up routines are references
  // (proof/intro-reference/intro-routines.mjs). The outer owner 80:A141 still calls
  // the game's audio 81:EF63.
  [0x81dfe7, playIntro],
  [0x81ef63, setUpGameAudioRoutine],
]);
// 80:F298: long form of 9E1A (PHP/REP, JSR 9E1A, PLP, RTL).
export function readInputLong(h, events, routines = MAIN_SCENE_ROUTINES) {
  return drainNativeSequence(readInputLongSequence(h, events, routines));
}
function* readInputLongSequence(h, events, routines) {
  let result;
  yield () => {
    h.php();
    h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  };
  yield* nativeCallSequence(h, events, routines, 0x80f29b, 0x809e1a);
  yield () => {
    h.plp();
    result = h.rtl();
  };
  return result;
}
NATIVE_CALL_CONTINUATIONS.set(0x80f298, {
  run: readInputLong,
  create: ({ h, events, routines = MAIN_SCENE_ROUTINES }) =>
    new NativeCallContinuation(h.a, readInputLongSequence(h, events, routines)),
});
NATIVE_CALL_CONTINUATIONS.set(0x809e1a, {
  run: MAIN_UPKEEP_ROUTINES.get(0x809e1a),
  create: ({ h, events }) =>
    events?.interrupts === undefined ? null : new ObservedWaitContinuation(h, events, 0x809e1a),
});
// 81:CDF8: play the cutscene in A with the argument in X (src/cutscene/cutscene-scene.mjs).
export function playCutscene(h, events, routines = MAIN_SCENE_ROUTINES) {
  return drainNativeSequence(cutsceneSequence(h, events, routines));
}
NATIVE_CALL_CONTINUATIONS.set(0x81cdf8, {
  run: playCutscene,
  create: ({ h, events, routines = MAIN_SCENE_ROUTINES }) =>
    new NativeCallContinuation(h.a, cutsceneSequence(h, events, routines)),
});
// 81:DFE7: play the intro (src/intro/intro-scene.mjs).
export function playIntro(h, events, routines = MAIN_SCENE_ROUTINES) {
  return drainNativeSequence(introSequence(h, events, routines));
}
NATIVE_CALL_CONTINUATIONS.set(0x81dfe7, {
  run: playIntro,
  create: ({ h, events, routines = MAIN_SCENE_ROUTINES }) =>
    new NativeCallContinuation(h.a, introSequence(h, events, routines)),
});

// 81:C3CA: play the matrix until the decker jacks out (src/matrix/matrix-scene.mjs).
export function playMatrixScene(h, events, routines = MAIN_SCENE_ROUTINES) {
  return drainNativeSequence(matrixSceneSequence(h, events, routines));
}
NATIVE_CALL_CONTINUATIONS.set(0x81c3ca, {
  run: playMatrixScene,
  create: ({ h, events, routines = MAIN_SCENE_ROUTINES }) =>
    new NativeCallContinuation(h.a, matrixSceneSequence(h, events, routines)),
});
