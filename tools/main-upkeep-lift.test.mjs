// The main loop's lifted upkeep (src/game/main-upkeep.mjs: the colour effect
// 81:8877, the palette cycles 81:8076, the hit shake 80:DE94, the notice time limits
// 80:FF14, the formation step 80:BAD5, the camera follow 81:8C2E, the tile
// buffers 81:8A91, the time limit 80:E270, the glove action 80:BF3B, the word wait
// 81:B0A1, the pad word 80:9E1A, the glove movement 80:BE6D, the zones 80:8000, the
// motion pass 80:AFC4 and the sprite list 80:B8DE) against the
// register-level references (proof/game-reference/main-upkeep.mjs, main-camera.mjs,
// main-timer.mjs and main-glove-action.mjs), docs/MAIN-LOOP-LIFT.md: every NMI must be
// equal (tools/lift-compare.mjs, docs/MATRIX-LIFT.md). The session is the alley plan
// of tools/live-alley-plan.mjs: from the title and the apartment save through the
// streets into the alley, where the orc shoots, the Beretta picked up (notices) and
// equipped, and shots with the crosshair.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { PLAN } from './live-alley-plan.mjs';
import { CUTSCENE_IGNORED_WRAM } from './live-cutscene-plan.mjs';
import {
  runCameraFollow,
  runColourEffect,
  runFormationStep,
  runTileBuffers,
  runHitShake,
  runNoticeTimeouts,
  runPaletteCycles,
  runTimeLimit,
  runGloveAction,
  runFrameWait,
  runPadPresses,
  runGloveMove,
  runPlayerZones,
  runObjectMotion,
  runSpriteList,
} from '../src/game/main-upkeep.mjs';
import { MAIN_CAMERA_REFERENCE_ENTRIES } from '../proof/game-reference/main-camera.mjs';
import { MAIN_UPKEEP_REFERENCE_ENTRIES } from '../proof/game-reference/main-upkeep.mjs';
import { MAIN_UPKEEP_ROUTINES } from '../src/task/main-loop-upkeep.mjs';
import { moveGlove } from '../src/task/native-glove.mjs';
import { checkPlayerZones } from '../src/task/main-zone-gate.mjs';
import { moveAndAnimateObjects } from '../src/task/main-loop-motion.mjs';
import { buildSpriteList } from '../src/task/native-scene-sprites.mjs';
import { MAIN_TIMER_REFERENCE_ENTRIES } from '../proof/game-reference/main-timer.mjs';
import { MAIN_GLOVE_ACTION_REFERENCE_ENTRIES } from '../proof/game-reference/main-glove-action.mjs';

// Diagnosis: MAIN_UPKEEP_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
const snapshotAt = Number(process.env.MAIN_UPKEEP_LIFT_FRAME ?? -1);

test(
  'main loop upkeep: the lifted routines give the same frames as the reference',
  { timeout: 1800000 },
  async () => {
    const result = await compareLift({
      plan: PLAN,
      lifted: [
        runColourEffect,
        runPaletteCycles,
        runHitShake,
        runNoticeTimeouts,
        runFormationStep,
        runCameraFollow,
        runTileBuffers,
        runTimeLimit,
        runGloveAction,
        runFrameWait,
        runPadPresses,
        runGloveMove,
        runPlayerZones,
        runObjectMotion,
        runSpriteList,
      ],
      reference: new Map([
        ...MAIN_UPKEEP_REFERENCE_ENTRIES,
        ...MAIN_CAMERA_REFERENCE_ENTRIES,
        ...MAIN_TIMER_REFERENCE_ENTRIES,
        ...MAIN_GLOVE_ACTION_REFERENCE_ENTRIES,
        // The register-level word wait and pad word, stepped by instruction.
        [0x81b0a1, MAIN_UPKEEP_ROUTINES.get(0x81b0a1)],
        [0x809e1a, MAIN_UPKEEP_ROUTINES.get(0x809e1a)],
        [0x80be6d, moveGlove],
        [0x808000, checkPlayerZones],
        [0x80afc4, moveAndAnimateObjects],
        [0x80b8de, buildSpriteList],
      ]),
      ignored: CUTSCENE_IGNORED_WRAM,
      snapshotAt,
    });
    if (snapshotAt >= 0) console.log(result.bytes.join('\n'));
    assert.equal(result.frames, result.referenceFrames, 'frame count');
    assert.equal(result.first, -1, `NMI ${result.first}: ${result.parts.join(', ')} differ`);
    assert.ok(result.frames > 8000, 'frames compared: ' + result.frames);
  },
);
