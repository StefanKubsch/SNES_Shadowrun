// The lifted audio table entries 81:F007, 81:EF47 (src/apu/audio-routines.mjs) and
// 80:C46E (src/apu/sound-effect.mjs) against the register-level references
// (proof/apu-reference/audio-routines.mjs) in the live title cycle session that
// boots, plays the attract game and starts a new game from it
// (tools/live-title-cycle-plan.mjs, session 4): the boot sends its driver commands,
// the room starts change the music and the main loop upkeep plays sound effects
// through these entries. Every NMI must be equal (tools/lift-compare.mjs,
// docs/MATRIX-LIFT.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { TITLE_CYCLE_PLANS, TITLE_CYCLE_IGNORED_WRAM } from './live-title-cycle-plan.mjs';
import { sendApuCommandRoutine, setMusicModeRoutine } from '../src/apu/audio-routines.mjs';
import { playSoundEffectRoutine } from '../src/apu/sound-effect.mjs';
import { AUDIO_REFERENCE_ENTRIES } from '../proof/apu-reference/audio-routines.mjs';

const lifted = [sendApuCommandRoutine, setMusicModeRoutine, playSoundEffectRoutine],
  reference = new Map(AUDIO_REFERENCE_ENTRIES),
  session = 4,
  // Diagnosis: AUDIO_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
  snapshotAt = Number(process.env.AUDIO_LIFT_FRAME ?? -1);

test(
  `audio session ${session}: the lifted entries give the same frames as the reference`,
  { timeout: 1800000 },
  async () => {
    const result = await compareLift({
      plan: TITLE_CYCLE_PLANS[session],
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
