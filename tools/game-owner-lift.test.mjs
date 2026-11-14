// The lifted outer game owner (src/frontend/game-owner.mjs) against the
// register-level reference (proof/frontend-reference/game-owner.mjs) in the live
// title cycle sessions of tools/live-title-cycle-plan.mjs that enter a game (a new
// game and a saved game after Start in the title): every NMI must be equal
// (tools/lift-compare.mjs, docs/MATRIX-LIFT.md). The resume point A157 after a game
// is compared in tools/game-owner-lift-functions.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { TITLE_CYCLE_PLANS } from './live-title-cycle-plan.mjs';
import { START_MENU_IGNORED_WRAM } from './live-start-menu-plan.mjs';
import { runGameOwner } from '../src/frontend/game-owner.mjs';
import { GAME_OWNER_REFERENCE_ENTRIES } from '../proof/frontend-reference/game-owner.mjs';

const lifted = [runGameOwner],
  reference = new Map(GAME_OWNER_REFERENCE_ENTRIES),
  // The sessions with a new game and a saved game.
  sessions = [2, 3],
  // Diagnosis: GAME_OWNER_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
  snapshotAt = Number(process.env.GAME_OWNER_LIFT_FRAME ?? -1);

for (const n of sessions)
  test(
    `game owner session ${n}: the lifted owner gives the same frames as the reference`,
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
