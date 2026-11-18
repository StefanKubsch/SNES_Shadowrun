// The routine table of the lifted main loop's callees (moved from src/vm/main-loop.mjs;
// the live main loop composes them directly and looks up no routine table). Register-
// level callers and the tests that check the bindings use it.
import {
  runCameraFollow,
  runColourEffect,
  runFormationStep,
  runFrameWait,
  runGloveAction,
  runGloveMove,
  runHitShake,
  runNoticeTimeouts,
  runObjectMotion,
  runPadPresses,
  runPaletteCycles,
  runPlayerZones,
  runSpriteList,
  runTileBuffers,
  runTimeLimit,
} from '../../src/game/main-upkeep.mjs';
import { processSceneRequest } from '../../src/game/scene-request.mjs';

export const MAIN_LOOP_ROUTINES = new Map([
  [0x808000, runPlayerZones], // zones around the player figure: append a task or change the scene
  [0x80cc4b, processSceneRequest],
  [0x80de94, runHitShake],
  [0x80afc4, runObjectMotion],
  [0x80bad5, runFormationStep],
  [0x818c2e, runCameraFollow],
  [0x818a91, runTileBuffers],
  [0x80b8de, runSpriteList],
  [0x80ff14, runNoticeTimeouts],
  [0x80e270, runTimeLimit],
  [0x81b0a1, runFrameWait],
  [0x818877, runColourEffect],
  [0x818076, runPaletteCycles],
  [0x809e1a, runPadPresses],
  [0x80be6d, runGloveMove],
  [0x80bf3b, runGloveAction],
]);
