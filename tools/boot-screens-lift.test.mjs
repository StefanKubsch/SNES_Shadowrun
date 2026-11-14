// Live comparison of the lifted boot screens 81:E7BC (src/frontend/boot-screens.mjs)
// with the register-level screens (`showBootScreens` in src/task/main-startup.mjs;
// docs/BOOT-SCREENS-LIFT.md). From the reset through both screens, the sound driver start
// and the settings check into the title: every NMI must give the same WRAM, VRAM,
// CGRAM, OAM, PPU registers, scroll, PPU write count and sound RAM. The second run has
// mono output and an invalid settings checksum, so the defaults are restored and the
// sound driver gets stereo (the comparison does not cover SRAM itself).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { CUTSCENE_IGNORED_WRAM } from './live-cutscene-plan.mjs';
import { runBootScreensLifted, showBootScreens } from '../src/task/main-startup.mjs';
import { SETTINGS_CHECKSUM, SETTINGS_STEREO } from '../src/task/wram.mjs';
import { BANK_SIZE } from '../src/constants/bits.mjs';

// The first command of the alley plan waits through the boot into the title.
const BOOT_PLAN = [['wait', 2989]];
// Diagnosis: BOOT_SCREENS_LIFT_FRAME=n lists the differing WRAM bytes at NMI n.
const snapshotAt = Number(process.env.BOOT_SCREENS_LIFT_FRAME ?? -1);
const badChecksum = () => {
  const sram = new Uint8Array(loadSave('apartment'));
  sram[SETTINGS_STEREO % BANK_SIZE] = 0;
  sram[SETTINGS_CHECKSUM % BANK_SIZE] ^= 1;
  return sram;
};

for (const [name, sram] of [
  ['valid settings', () => loadSave('apartment')],
  ['invalid settings checksum', badChecksum],
])
  test(`boot screens (${name}): the lifted screens give the same frames as the reference`, async () => {
    const result = await compareLift({
      plan: BOOT_PLAN,
      sram: sram(),
      lifted: [runBootScreensLifted],
      reference: new Map([[0x81e7bc, showBootScreens]]),
      ignored: CUTSCENE_IGNORED_WRAM,
      snapshotAt,
    });
    if (snapshotAt >= 0) console.log(result.bytes.join('\n'));
    assert.equal(result.frames, result.referenceFrames, 'frame count');
    assert.equal(result.first, -1, `NMI ${result.first}: ${result.parts.join(', ')} differ`);
    assert.ok(result.frames > 400, 'frames compared: ' + result.frames);
  });
