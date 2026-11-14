// Fluid controls (gameplay key fluidControls, docs/CONTROLS.md): after a shot the
// original's player control 80:E014 pauses for 10 to 30 frames. The mouse control
// took more than six frames without it for an action list and dropped mouse moves,
// so the crosshair stood still (user recording 2026-11-13, runs of 12 to 29 frames).
// With the key, an open crosshair or spell pointer keeps following the mouse; the
// hand in an action list and recordings without the key keep the original handling.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MouseControl } from '../src/browser/mouse-control.mjs';
import {
  DEFAULT_GAMEPLAY,
  ORIGINAL_GAMEPLAY,
  gameplaySettings,
  storedGameplay,
} from '../src/game/bugfixes.mjs';

const OPEN = 0x01d8,
  GLOVE_X = 0x01d5,
  GLOVE_Y = 0x01d7,
  TARGET = 0x01da,
  CROSSHAIR = 0xfffe,
  SPELL = 0xfffd,
  HAND = 0xffff,
  // The player control last ran ten frames ago (after a shot).
  PAUSED = 10;

function moveAfterShot(open, gameplay) {
  const wram = new Uint8Array(0x20000),
    game = { memory: { wram }, controlNmi: 100 - PAUSED, choosing: false, gameplay };
  wram[OPEN] = open & 0xff;
  wram[OPEN + 1] = open >>> 8;
  wram[TARGET] = 0xff;
  wram[TARGET + 1] = 0xff;
  const control = new MouseControl(game);
  control.pad(100, { mouse: { seq: 1, x: 120, y: 90 } });
  return [wram[GLOVE_X], wram[GLOVE_Y]];
}

test('with fluid controls the crosshair and the spell pointer follow the mouse after a shot', () => {
  const fluid = gameplaySettings({ ...ORIGINAL_GAMEPLAY, fluidControls: true });
  assert.deepEqual(moveAfterShot(CROSSHAIR, fluid), [120, 90]);
  assert.deepEqual(moveAfterShot(SPELL, fluid), [120, 90]);
  // The hand without player control is an action list: the mouse does not move it.
  assert.deepEqual(moveAfterShot(HAND, fluid), [0, 0]);
  // Without the key (recordings before it) the crosshair keeps the original pause.
  assert.deepEqual(moveAfterShot(CROSSHAIR, gameplaySettings(ORIGINAL_GAMEPLAY)), [0, 0]);
});

test('fluid controls are on by default and kept off for recordings without the key', () => {
  assert.equal(DEFAULT_GAMEPLAY.fluidControls, true);
  assert.equal(ORIGINAL_GAMEPLAY.fluidControls, false);
  const { fluidControls, ...without } = ORIGINAL_GAMEPLAY;
  assert.equal(fluidControls, false);
  assert.equal(gameplaySettings(without).fluidControls, false);
  assert.equal(storedGameplay(JSON.stringify(without)).fluidControls, true);
  assert.throws(
    () => gameplaySettings({ ...DEFAULT_GAMEPLAY, fluidControls: 1 }),
    /gameplay_settings_required/,
  );
});
