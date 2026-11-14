// The lifted matrix (src/matrix) against the register-level reference
// (proof/matrix-reference): the seven sessions of tools/live-matrix.test.mjs run
// once with each, and every NMI compares the game state (WRAM outside the stack
// and the direct page scratch), the PPU state, the number of PPU writes and the
// sound RAM (tools/lift-compare.mjs). docs/MATRIX-LIFT.md describes what "the same
// result" means.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { IGNORED_WRAM, PLAN } from './live-matrix-plan.mjs';
import { playMatrixScene } from '../src/task/main-scene.mjs';
import { handleMatrixNmi } from '../src/matrix/matrix-scene.mjs';
import { MATRIX_REFERENCE_ROUTINES } from '../proof/matrix-reference/matrix-scene-loop.mjs';

// Diagnosis: MATRIX_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
const snapshotAt = Number(process.env.MATRIX_LIFT_FRAME ?? -1);

test(
  'the lifted matrix gives the same frames as the register-level reference',
  { timeout: 1800000 },
  async () => {
    const result = await compareLift({
      plan: PLAN,
      lifted: [playMatrixScene, handleMatrixNmi],
      reference: MATRIX_REFERENCE_ROUTINES,
      ignored: IGNORED_WRAM,
      snapshotAt,
    });
    if (snapshotAt >= 0) console.log(result.bytes.join('\n'));
    assert.equal(result.frames, result.referenceFrames, 'frame count');
    assert.equal(result.first, -1, `NMI ${result.first}: ${result.parts.join(', ')} differ`);
    assert.ok(result.frames > 20000, 'frames compared: ' + result.frames);
  },
);
