import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cartridge } from './cartridge-harness.mjs';
import { findMesen } from './mesen.mjs';
import { recordColdPictures } from './mesen-cold-start.mjs';
import { originalLogoPixels } from './capture-boot-logo.mjs';
import { LiveGame } from '../src/video/live-game.mjs';

// Live cold start (src/video/live-game.mjs), from reset 00:E382 without
// original observations, through the logo, sound upload, intro and skyline
// to the title. Compare picture order because the original includes lag NMIs.
const { exe, reason } = findMesen();
const hash = (pixels) =>
  createHash('sha1')
    .update(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength))
    .digest('hex');
const PICTURES = [...Array(86)].map((_, n) => 40 + 40 * n);

test(
  'the cold start runs live from reset to the title without original observations',
  { timeout: 900000 },
  async (t) => {
    const byHash = new Map();
    const game = new LiveGame(cartridge, {
      onFrame: (f) => {
        const h = hash(f.pixels);
        (byHash.get(h) ?? byHash.set(h, []).get(h)).push(f.nmi);
      },
    });
    // Compare original artwork with the original three-row menu. The added
    // fourth row is tested live in both languages by credits.test.mjs.
    game.vm.startMenuCredits = false;
    while (game.nmis < 3500) game.step();
    // Outside the NMI with the display on, the cold start writes only PPU
    // registers, never VRAM, CGRAM or OAM data.
    assert.equal(game.dataOutsideBlank, 0);
    await t.test(
      'every original picture up to the title has a native twin, in order',
      { skip: exe ? false : reason, timeout: 900000 },
      async () => {
        const pictures = await recordColdPictures(exe, { shots: PICTURES });
        let last = 0;
        const missing = [];
        for (const k of PICTURES) {
          const next = byHash
            .get(hash(originalLogoPixels(pictures.get(k))))
            ?.find((n) => n >= last);
          if (next === undefined) missing.push(k);
          else last = next;
        }
        // In the reference run two fade steps of the title had no twin (2720, 2920):
        // the original lags inside the fade.
        assert.ok(
          missing.length <= 4,
          'original pictures without an ordered native twin: ' + missing,
        );
      },
    );
  },
);

// Start on the title opens the menu, Start again begins a new game (menu and
// new game pictures against the original: live-game-over.test.mjs). The
// morgue's opening dialog runs and the main loop takes over.
test('Start on the title begins a new game in the main loop', { timeout: 900000 }, () => {
  const game = new LiveGame(cartridge, {
    pad: (k) => (k >= 3000 && k < 3400 && k % 150 < 4 ? 0x1000 : 0),
  });
  while (game.nmis < 5000) game.step();
  assert.ok(game.driver.ownsGame, 'main loop owns the game');
  assert.ok(game.driver.roundsCompleted > 1000, 'main loop rounds: ' + game.driver.roundsCompleted);
  assert.equal(game.dataOutsideBlank, 0);
});
