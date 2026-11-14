// The lifted room entry 80:A4BF (src/game/room-entry.mjs) against the register-level
// reference (proof/game-reference/room-entry.mjs), docs/ROOM-ENTRY-LIFT.md: every NMI
// must be equal (tools/lift-compare.mjs, docs/MATRIX-LIFT.md).
// - The title cycle sessions that start a game (tools/live-title-cycle-plan.mjs): a
//   new game, a saved game and the attract game. The lifted room start calls the
//   lifted entry directly, so the reference side also runs the register-level start
//   of a game, which calls the reference entry through its original frame.
// The scene request of the main loop (80:CC90) calls the lifted entry directly; its
// sessions compare the entry with the full reference in
// tools/scene-request-lift.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { TITLE_CYCLE_PLANS, TITLE_CYCLE_IGNORED_WRAM } from './live-title-cycle-plan.mjs';
import { enterRoom } from '../src/task/main-transition.mjs';
import { runAttractRounds } from '../src/task/main-frontend.mjs';
import { runGameStart, runNewGame, runNewGameState, runSaveLoad } from '../src/game/game-start.mjs';
import { GAME_START_REFERENCE_ENTRIES } from '../proof/game-reference/game-start.mjs';
import { ROOM_ENTRY_REFERENCE_ENTRIES } from '../proof/game-reference/room-entry.mjs';

const START_LIFTED = [
    enterRoom,
    runGameStart,
    runNewGame,
    runNewGameState,
    runSaveLoad,
    runAttractRounds,
  ],
  START_REFERENCE = new Map([...GAME_START_REFERENCE_ENTRIES, ...ROOM_ENTRY_REFERENCE_ENTRIES]),
  sessions = [2, 3, 4],
  // Diagnosis: ROOM_ENTRY_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
  snapshotAt = Number(process.env.ROOM_ENTRY_LIFT_FRAME ?? -1);

async function compare(plan, lifted, reference, ignored, minimum) {
  const result = await compareLift({ plan, lifted, reference, ignored, snapshotAt });
  if (snapshotAt >= 0) console.log(result.bytes.join('\n'));
  assert.equal(result.frames, result.referenceFrames, 'frame count');
  assert.equal(result.first, -1, `NMI ${result.first}: ${result.parts.join(', ')} differ`);
  assert.ok(result.frames > minimum, 'frames compared: ' + result.frames);
}

for (const n of sessions)
  test(
    `room entry session ${n}: the lifted entry gives the same frames as the reference`,
    { timeout: 1800000 },
    () =>
      compare(TITLE_CYCLE_PLANS[n], START_LIFTED, START_REFERENCE, TITLE_CYCLE_IGNORED_WRAM, 1000),
  );
