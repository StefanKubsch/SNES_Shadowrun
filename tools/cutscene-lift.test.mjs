// The lifted cutscenes (src/cutscene) against the register-level reference
// (proof/cutscene-reference) in the live sessions of tools/live-cutscene-plan.mjs:
// every NMI must be equal (tools/lift-compare.mjs, docs/MATRIX-LIFT.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { CUTSCENE_IGNORED_WRAM, CUTSCENE_PLAN } from './live-cutscene-plan.mjs';
import { playCutscene } from '../src/task/main-scene.mjs';
import { handleCutsceneNmi } from '../src/cutscene/cutscene-scene.mjs';
import { CUTSCENE_REFERENCE_ROUTINES } from '../proof/cutscene-reference/cutscene-scene.mjs';

const TARGETS = [0x81cdf8, 0x81cf72, 0x81cf79, 0x81d4e8, 0x81d37d, 0x81d479],
  reference = new Map(TARGETS.map((target) => [target, CUTSCENE_REFERENCE_ROUTINES.get(target)])),
  // Diagnosis: CUTSCENE_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
  snapshotAt = Number(process.env.CUTSCENE_LIFT_FRAME ?? -1);

test(
  'the lifted cutscenes give the same frames as the register-level reference',
  { timeout: 1800000 },
  async () => {
    const result = await compareLift({
      plan: CUTSCENE_PLAN,
      lifted: [playCutscene, handleCutsceneNmi],
      reference,
      ignored: CUTSCENE_IGNORED_WRAM,
      snapshotAt,
    });
    if (snapshotAt >= 0) console.log(result.bytes.join('\n'));
    assert.equal(result.frames, result.referenceFrames, 'frame count');
    assert.equal(result.first, -1, `NMI ${result.first}: ${result.parts.join(', ')} differ`);
    assert.ok(result.frames > 15000, 'frames compared: ' + result.frames);
  },
);
