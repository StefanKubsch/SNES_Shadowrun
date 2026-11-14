// The lifted intro (src/intro) against the register-level reference
// (proof/intro-reference) in the live sessions of tools/live-intro-plan.mjs: every
// NMI must be equal (tools/lift-compare.mjs, docs/MATRIX-LIFT.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { INTRO_IGNORED_WRAM, INTRO_PLAN } from './live-intro-plan.mjs';
import { playIntro } from '../src/task/main-scene.mjs';
import { handleIntroNmi } from '../src/intro/intro-scene.mjs';
import { INTRO_REFERENCE_ROUTINES } from '../proof/intro-reference/intro-scene.mjs';
import { INTRO_SETUP_REFERENCE_ENTRIES } from '../proof/intro-reference/intro-routines.mjs';

const TARGETS = [0x81dfe7, 0x81df0e],
  // The reference intro also calls the register-level set-up routines.
  reference = new Map([
    ...INTRO_SETUP_REFERENCE_ENTRIES,
    ...TARGETS.map((target) => [target, INTRO_REFERENCE_ROUTINES.get(target)]),
  ]),
  // Diagnosis: INTRO_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
  snapshotAt = Number(process.env.INTRO_LIFT_FRAME ?? -1);

test(
  'the lifted intro gives the same frames as the register-level reference',
  { timeout: 1800000 },
  async () => {
    const result = await compareLift({
      plan: INTRO_PLAN,
      lifted: [playIntro, handleIntroNmi],
      reference,
      ignored: INTRO_IGNORED_WRAM,
      snapshotAt,
    });
    if (snapshotAt >= 0) console.log(result.bytes.join('\n'));
    assert.equal(result.frames, result.referenceFrames, 'frame count');
    assert.equal(result.first, -1, `NMI ${result.first}: ${result.parts.join(', ')} differ`);
    assert.ok(result.frames > 6000, 'frames compared: ' + result.frames);
  },
);
