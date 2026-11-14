// The lifted start menu (src/frontend/start-menu.mjs) against the register-level
// reference (proof/frontend-reference/start-menu.mjs) in the live sessions of
// tools/live-start-menu-plan.mjs: every NMI must be equal (tools/lift-compare.mjs,
// docs/MATRIX-LIFT.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { START_MENU_IGNORED_WRAM, START_MENU_PLANS } from './live-start-menu-plan.mjs';
import { openStartMenu } from '../src/task/main-frontend-menu.mjs';
import { handleStartMenuNmi } from '../src/frontend/start-menu.mjs';
import { START_MENU_REFERENCE_ENTRIES } from '../proof/frontend-reference/start-menu.mjs';

const lifted = [openStartMenu, handleStartMenuNmi],
  reference = new Map(START_MENU_REFERENCE_ENTRIES),
  // Diagnosis: START_MENU_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
  snapshotAt = Number(process.env.START_MENU_LIFT_FRAME ?? -1);

START_MENU_PLANS.forEach((plan, n) =>
  test(
    `start menu session ${n}: the lifted menu gives the same frames as the reference`,
    { timeout: 1800000 },
    async () => {
      const result = await compareLift({
        plan,
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
  ),
);
