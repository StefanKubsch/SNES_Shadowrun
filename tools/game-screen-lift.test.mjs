// The lifted game screen set-up 80:9629 (src/game/game-screen.mjs) against the
// register-level reference (proof/game-reference/game-screen.mjs) in the live title
// cycle sessions that start a game (tools/live-title-cycle-plan.mjs): a new game and
// the attract game followed by a new game build the game screen through the room
// start. The room start calls the lifted set-up directly, so the reference side
// also runs the register-level start of a game (proof/game-reference/game-start.mjs),
// which calls the reference set-up through its original frame. Every NMI must be
// equal (tools/lift-compare.mjs, docs/MATRIX-LIFT.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { TITLE_CYCLE_PLANS, TITLE_CYCLE_IGNORED_WRAM } from './live-title-cycle-plan.mjs';
import { MAIN_INITIALIZE_ROUTINES } from '../src/task/main-initialize.mjs';
import { withGameStartReference } from '../proof/game-reference/game-start.mjs';
import { runAttractRounds } from '../src/task/main-frontend.mjs';
import { runGameStart, runNewGame, runNewGameState, runSaveLoad } from '../src/game/game-start.mjs';

const lifted = [
    MAIN_INITIALIZE_ROUTINES.get(0x809629),
    runGameStart,
    runNewGame,
    runNewGameState,
    runSaveLoad,
    runAttractRounds,
  ],
  reference = withGameStartReference(new Map()),
  sessions = [2, 4],
  // Diagnosis: GAME_SCREEN_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
  snapshotAt = Number(process.env.GAME_SCREEN_LIFT_FRAME ?? -1);

for (const n of sessions)
  test(
    `game screen session ${n}: the lifted set-up gives the same frames as the reference`,
    { timeout: 1800000 },
    async () => {
      const result = await compareLift({
        plan: TITLE_CYCLE_PLANS[n],
        lifted,
        reference,
        ignored: TITLE_CYCLE_IGNORED_WRAM,
        snapshotAt,
      });
      if (snapshotAt >= 0) console.log(result.bytes.join('\n'));
      assert.equal(result.frames, result.referenceFrames, 'frame count');
      assert.equal(result.first, -1, `NMI ${result.first}: ${result.parts.join(', ')} differ`);
      assert.ok(result.frames > 1000, 'frames compared: ' + result.frames);
    },
  );
