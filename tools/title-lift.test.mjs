// The lifted title (src/frontend/title.mjs) against the register-level reference
// (proof/frontend-reference/title.mjs) in the live sessions of
// tools/live-title-plan.mjs: every NMI must be equal (tools/lift-compare.mjs,
// docs/MATRIX-LIFT.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { TITLE_IGNORED_WRAM, TITLE_PLANS } from './live-title-plan.mjs';
import { playTitle } from '../src/task/main-frontend-menu.mjs';
import {
  handlePanObjects,
  handlePrologueNmi,
  handleTitleObjectsNmi,
  handleTitlePanNmi,
  handleTitleScrollNmi,
} from '../src/frontend/title.mjs';
import { TITLE_REFERENCE_ENTRIES } from '../proof/frontend-reference/title.mjs';

const lifted = [
    playTitle,
    handlePrologueNmi,
    handleTitlePanNmi,
    handleTitleScrollNmi,
    handleTitleObjectsNmi,
    handlePanObjects,
  ],
  reference = new Map(TITLE_REFERENCE_ENTRIES),
  // Diagnosis: TITLE_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
  snapshotAt = Number(process.env.TITLE_LIFT_FRAME ?? -1);

TITLE_PLANS.forEach((plan, n) =>
  test(
    `title session ${n}: the lifted title gives the same frames as the reference`,
    { timeout: 900000 },
    async () => {
      const result = await compareLift({
        plan,
        lifted,
        reference,
        ignored: TITLE_IGNORED_WRAM,
        snapshotAt,
      });
      if (snapshotAt >= 0) console.log(result.bytes.join('\n'));
      assert.equal(result.frames, result.referenceFrames, 'frame count');
      assert.equal(result.first, -1, `NMI ${result.first}: ${result.parts.join(', ')} differ`);
      assert.ok(result.frames > 1000, 'frames compared: ' + result.frames);
    },
  ),
);
