import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { MouseControl } from '../src/browser/mouse-control.mjs';

// Mouse and back key (src/browser/mouse-control.mjs, ROM evidence in
// docs/CONTROLS.md) live from the title into the morgue. Menus: the wheel moves
// the cursor, a left click confirms with B (title menu 81:E14A takes only B or
// Start), Esc gives Select (status screen EA6E) but nothing in the title menu. Free play: a mouse move opens
// the glove through the original B path of the player control 80:E014 and
// places it under the mouse, also inside an object (BCBE/BE38); a keyboard
// direction closes it through A (E18D -> BCB2) and Jake walks.
const START = 0x1000,
  R = 0x0100,
  OPEN = 0x01d8;
test('mouse and back key drive menus and the glove', { timeout: 900000 }, () => {
  const input = {
      word: 0,
      keyDirections: 0,
      mouse: { seq: 0, x: 0, y: 0 },
      mouseBits: 0,
      buttons: 0,
      back: false,
      wheel: 0,
    },
    added = [];
  const game = new LiveGame(cartridge, {
    pad: (k) => {
      const out = control.pad(k, input);
      if (out !== input.word) added.push({ k, menu: control.menu, bits: out ^ input.word });
      return out;
    },
  });
  const control = new MouseControl(game),
    wram = game.memory.wram,
    word = (a) => wram[a] | (wram[a + 1] << 8);
  // One step can cover many NMIs (synchronous sections); phases wait for conditions.
  const run = (n) => {
      while (game.nmis < n) game.step();
    },
    after = (n) => run(game.nmis + n);
  const until = (condition, what, limit = 600) => {
    const end = game.nmis + limit;
    while (!condition()) {
      assert.ok(game.nmis < end, what);
      game.step();
    }
  };
  const playing = () => game.controlNmi >= game.nmis - 1;
  const press = (key, value, frames = 4) => {
    input[key] = value;
    after(frames);
    input[key] = key === 'back' ? false : 0;
    after(frames);
  };
  // Title: Start opens the menu; Esc and the right button do nothing there (no back
  // before the first player control; Select would move the cursor down); wheel down
  // and up, then a click starts a new game.
  run(3000);
  press('word', START);
  run(3200);
  press('back', true);
  press('buttons', 2);
  assert.deepEqual(
    added.filter((a) => a.bits !== START),
    [],
    'no Select from Esc or the right button in the title menu',
  );
  input.wheel = 1;
  after(10);
  input.wheel = 0;
  after(10);
  assert.deepEqual(
    added.filter((a) => a.bits !== START).map((a) => a.bits),
    [0x0400, 0x0400, 0x0800, 0x0800],
    'one wheel step is two frames of a direction',
  );
  press('buttons', 1);
  until(playing, 'player control after the click', 3000);
  assert.ok(
    added.some((a) => a.menu && a.bits === 0x8000),
    'left click in a menu gives B',
  );
  // Status screen (Start): the wheel moves the cursor, Esc gives Select and returns to play.
  assert.equal(game.dataOutsideBlank, 0);
  // The screen is set up about 100 NMIs after the press, as in the original (Mesen,
  // tools/mesen-live-room.test.mjs); the lifted screen takes them one step each.
  added.length = 0;
  const pressed = game.nmis;
  press('word', START);
  until(() => !playing(), 'status screen');
  run(pressed + 130);
  const cursor = word(0x1d97);
  input.wheel = 1;
  after(12);
  assert.equal(word(0x1d97), cursor + 2, 'menu cursor one entry down');
  assert.equal(game.dataOutsideBlank, 0);
  press('back', true);
  until(playing, 'back in play after Esc');
  // Leaving the status screen writes 64 VRAM words (128 data bytes) from the main program at
  // 80:9303. The port has no raster position and counts every write outside the NMI with the
  // display on; in Mesen the original writes them at scanline 229, inside VBlank, right after the
  // NMI (explore.lua vramwatch, docs/ROM-FREE.md), so the count is expected and not a fault.
  assert.equal(game.dataOutsideBlank, 128, 'status screen exit data writes outside the NMI');
  assert.ok(
    added.some((a) => a.menu && a.bits === 0x2000),
    'Esc gives Select in a menu',
  );
  // Free play: the wheel adds nothing, a mouse move opens the glove under the mouse.
  added.length = 0;
  after(10);
  input.wheel = 3;
  after(10);
  assert.equal(added.length, 0, 'no wheel steps in free play');
  input.mouse = { seq: 1, x: 60, y: 150 };
  after(3);
  assert.equal(word(OPEN), 0xffff, 'hand glove open');
  assert.deepEqual([word(0x01d4), word(0x01d6)], [60 << 8, 150 << 8], 'glove under the mouse');
  input.mouse = { seq: 2, x: 250, y: 1 };
  after(3);
  assert.deepEqual([word(0x01d4), word(0x01d6)], [239 << 8, 3 << 8], 'clamped like 80:BE6D');
  // Over an object (01DA) the glove follows the mouse inside it instead of snapping to the entry point.
  input.mouse = { seq: 3, x: 18, y: 28 };
  after(3);
  assert.equal(word(0x01da), 0x21, 'object under the glove');
  input.mouse = { seq: 4, x: 30, y: 30 };
  after(3);
  assert.deepEqual(
    [word(0x01d4), word(0x01d6), word(0x01da)],
    [30 << 8, 30 << 8, 0x21],
    'glove moves inside the object',
  );
  input.mouse = { seq: 5, x: 120, y: 60 };
  after(3);
  assert.ok(word(0x01da) & 0x8000, 'object released outside');
  const jake = wram.slice(0x0e00, 0x1000);
  input.word = input.keyDirections = R;
  after(4);
  assert.equal(word(OPEN), 0, 'closed by the keyboard direction');
  after(40);
  input.word = input.keyDirections = 0;
  after(10);
  assert.notDeepEqual(wram.slice(0x0e00, 0x1000), jake, 'Jake moved');
  assert.equal(word(OPEN), 0, 'no reopening without a new mouse move');
  // Esc closes an open glove in free play.
  input.mouse = { seq: 6, x: 100, y: 100 };
  after(3);
  assert.equal(word(OPEN), 0xffff);
  press('back', true);
  assert.equal(word(OPEN), 0, 'closed by Esc');
  assert.deepEqual(
    added.map((a) => a.bits),
    [0x8000, 0x0080, 0x8000, 0x0080],
    JSON.stringify(added),
  );
  assert.equal(game.dataOutsideBlank, 128, 'nothing outside blank after the status screen');
});
