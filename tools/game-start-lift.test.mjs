// The lifted start of a game (src/game/game-start.mjs) against the register-level
// reference (proof/game-reference/game-start.mjs) in the live title cycle sessions
// of tools/live-title-cycle-plan.mjs that start a game: a new game and a saved game
// after Start in the title, and the attract game followed by a new game: every NMI
// must be equal (tools/lift-compare.mjs, docs/MATRIX-LIFT.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { TITLE_CYCLE_PLANS } from './live-title-cycle-plan.mjs';
import { START_MENU_IGNORED_WRAM } from './live-start-menu-plan.mjs';
import { runAttractRounds } from '../src/task/main-frontend.mjs';
import { runGameStart, runNewGame, runNewGameState, runSaveLoad } from '../src/game/game-start.mjs';
import { GAME_START_REFERENCE_ENTRIES } from '../proof/game-reference/game-start.mjs';

const lifted = [runGameStart, runNewGame, runNewGameState, runSaveLoad, runAttractRounds],
  reference = new Map(GAME_START_REFERENCE_ENTRIES),
  // The sessions with a new game, a saved game, and the attract game.
  sessions = [2, 3, 4],
  // Diagnosis: GAME_START_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
  snapshotAt = Number(process.env.GAME_START_LIFT_FRAME ?? -1);

for (const n of sessions)
  test(
    `game start session ${n}: the lifted start gives the same frames as the reference`,
    { timeout: 1800000 },
    async () => {
      const result = await compareLift({
        plan: TITLE_CYCLE_PLANS[n],
        lifted,
        reference,
        ignored: START_MENU_IGNORED_WRAM,
        snapshotAt,
      });
      if (snapshotAt >= 0) console.log(result.bytes.join('\n'));
      assert.equal(result.frames, result.referenceFrames, 'frame count');
      assert.equal(result.first, -1, `NMI ${result.first}: ${result.parts.join(', ')} differ`);
      assert.ok(result.frames > 1000, 'frames compared: ' + result.frames);
    },
  );
