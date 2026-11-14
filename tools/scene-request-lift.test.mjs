// The lifted scene request 80:CC4B of the main loop (src/game/scene-request.mjs)
// against the register-level reference (proof/game-reference/scene-request.mjs),
// docs/SCENE-REQUEST-LIFT.md: every NMI must be equal (tools/lift-compare.mjs,
// docs/MATRIX-LIFT.md). The lifted request calls the lifted game screen set-up
// 80:9629 and room entry 80:A4BF directly, so the reference side runs the
// register-level request, set-up and entry through their original frames.
// - The matrix sessions (tools/live-matrix-plan.mjs): each matrix request plays the
//   matrix, writes the decker's health back and enters the room again.
// - The cutscene sessions (tools/live-cutscene-plan.mjs): each request plays a
//   cutscene and enters the room again.
// - Room changes only (7FFF), as the debug room's "Open" asks for them
//   (src/browser/debug-room.mjs): from the apartment save into the debug room
//   entry D2, back to the apartment entry 159 and into the first room.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { IGNORED_WRAM as MATRIX_IGNORED_WRAM, PLAN as MATRIX_PLAN } from './live-matrix-plan.mjs';
import { CUTSCENE_IGNORED_WRAM, CUTSCENE_PLAN } from './live-cutscene-plan.mjs';
import { processSceneRequest } from '../src/game/scene-request.mjs';
import { enterRoom } from '../src/task/main-transition.mjs';
import { MAIN_INITIALIZE_ROUTINES } from '../src/task/main-initialize.mjs';
import { SCENE_REQUEST_REFERENCE_ENTRIES } from '../proof/game-reference/scene-request.mjs';
import { ROOM_ENTRY_REFERENCE_ENTRIES } from '../proof/game-reference/room-entry.mjs';
import { GAME_SCREEN_REFERENCE_ENTRIES } from '../proof/game-reference/game-screen.mjs';

// The title start of tools/live-cutscene-plan.mjs, then three room changes.
const REQUEST = 0x1ce9,
  ROOM = 0x2de2,
  ROOM_ONLY = 0x7fff,
  ROOM_FRAMES = 600,
  ROOM_PLAN = [
    ...CUTSCENE_PLAN.slice(0, 5),
    ...[0xd2, 0x159, 3].flatMap((room) => [
      ['poke', ROOM, room],
      ['poke', REQUEST, ROOM_ONLY],
      ['wait', ROOM_FRAMES],
    ]),
  ];

const lifted = [processSceneRequest, enterRoom, MAIN_INITIALIZE_ROUTINES.get(0x809629)],
  reference = new Map([
    ...SCENE_REQUEST_REFERENCE_ENTRIES,
    ...ROOM_ENTRY_REFERENCE_ENTRIES,
    ...GAME_SCREEN_REFERENCE_ENTRIES,
  ]),
  // Diagnosis: SCENE_REQUEST_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
  snapshotAt = Number(process.env.SCENE_REQUEST_LIFT_FRAME ?? -1);

for (const [name, plan, ignored, minimum] of [
  ['matrix', MATRIX_PLAN, MATRIX_IGNORED_WRAM, 20000],
  ['cutscene', CUTSCENE_PLAN, CUTSCENE_IGNORED_WRAM, 15000],
  ['room change', ROOM_PLAN, CUTSCENE_IGNORED_WRAM, 5000],
])
  test(
    `scene request in the ${name} sessions: the lifted request gives the same frames as the reference`,
    { timeout: 1800000 },
    async () => {
      const result = await compareLift({ plan, lifted, reference, ignored, snapshotAt });
      if (snapshotAt >= 0) console.log(result.bytes.join('\n'));
      assert.equal(result.frames, result.referenceFrames, 'frame count');
      assert.equal(result.first, -1, `NMI ${result.first}: ${result.parts.join(', ')} differ`);
      assert.ok(result.frames > minimum, 'frames compared: ' + result.frames);
    },
  );
