// Instant text (docs/INSTANT-TEXT.md): the status menu in the morgue settles to
// the same picture and video memory with and without the option, and the
// option removes the frames of the four text waits 81:ACAF/ACBD/ACC3/ACC9.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cartridge } from './cartridge-harness.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { counterBytes } from '../src/vm/frame-events.mjs';
import { ORIGINAL_GAMEPLAY } from '../src/game/bugfixes.mjs';

const TEXT_WAIT_BRANCHES = new Set([0x81acb2, 0x81acc0, 0x81acc6, 0x81accc]);
// Same start as tools/status-menu-language.test.mjs: three Start presses in
// the frontend, Jake controllable in the morgue by NMI 5100.
const START = 0x1000,
  START_PRESSES = [3000, 3300, 3600],
  IN_MORGUE = 5100,
  SETTLE = 120;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function openStatusMenu(instantText) {
  let game,
    pixels = null,
    pressUntil = 0;
  game = new LiveGame(cartridge, {
    counter: counterBytes(0x1234567),
    gameplay: { ...ORIGINAL_GAMEPLAY, instantText },
    onFrame: (frame) => {
      pixels = frame.pixels;
    },
    pad: (k) => (START_PRESSES.some((at) => k >= at && k < at + 4) || k < pressUntil ? START : 0),
  });
  while (game.nmis < IN_MORGUE) game.step();
  const waits = new Map(),
    frames = game.frames,
    nmiAt = frames.nmiAt.bind(frames);
  frames.nmiAt = (status, pc) => {
    const nmi = nmiAt(status, pc);
    if (nmi) waits.set(pc, (waits.get(pc) ?? 0) + 1);
    return nmi;
  };
  pressUntil = game.nmis + 2;
  const end = game.nmis + SETTLE;
  while (game.nmis < end) game.step();
  const textFrames = [...waits].reduce((n, [pc, c]) => n + (TEXT_WAIT_BRANCHES.has(pc) ? c : 0), 0);
  return {
    textFrames,
    menu: game.memory.read16(0x1f62),
    picture: hash(pixels),
    vram: hash(game.bus.ppu.vram),
    outside: game.dataOutsideBlank,
  };
}

test(
  'instant text keeps the status menu picture and skips the text transfer frames',
  { timeout: 300000 },
  () => {
    const original = openStatusMenu(false),
      instant = openStatusMenu(true);
    assert.ok(original.textFrames > 60, `original text frames: ${original.textFrames}`);
    assert.equal(instant.textFrames, 0);
    assert.equal(instant.menu, original.menu);
    assert.equal(instant.picture, original.picture);
    assert.equal(instant.vram, original.vram);
    assert.equal(instant.outside, 0);
    assert.equal(original.outside, 0);
  },
);
