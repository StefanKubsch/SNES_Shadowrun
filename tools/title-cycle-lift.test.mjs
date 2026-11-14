// The lifted title cycle and attract game (src/frontend/title-cycle.mjs) against the
// register-level reference (proof/frontend-reference/title-cycle.mjs) in the live
// sessions of tools/live-title-cycle-plan.mjs: every NMI must be equal
// (tools/lift-compare.mjs, docs/MATRIX-LIFT.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { TITLE_CYCLE_IGNORED_WRAM, TITLE_CYCLE_PLANS } from './live-title-cycle-plan.mjs';
import { playAttractDemo, runAttractGame, runTitleCycle } from '../src/frontend/title-cycle.mjs';
import { TITLE_CYCLE_REFERENCE_ENTRIES } from '../proof/frontend-reference/title-cycle.mjs';

const lifted = [runTitleCycle, runAttractGame, playAttractDemo],
  reference = new Map(TITLE_CYCLE_REFERENCE_ENTRIES),
  // Diagnosis: TITLE_CYCLE_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
  snapshotAt = Number(process.env.TITLE_CYCLE_LIFT_FRAME ?? -1);

TITLE_CYCLE_PLANS.forEach((plan, n) =>
  test(
    `title cycle session ${n}: the lifted cycle gives the same frames as the reference`,
    { timeout: 1800000 },
    async () => {
      const result = await compareLift({
        plan,
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
  ),
);
