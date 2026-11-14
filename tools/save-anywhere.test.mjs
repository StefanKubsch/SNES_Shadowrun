import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { MouseControl } from '../src/browser/mouse-control.mjs';
import {
  Recorder,
  parseRecording,
  replayRecording,
  unpackInput,
} from '../src/browser/recording.mjs';
import { counterBytes } from '../src/vm/frame-events.mjs';
import { SAVE_SLOT_EVENTS, saveAnywhereReachable, saveToSlot } from '../src/game/save-anywhere.mjs';

// Save anywhere (src/game/save-anywhere.mjs, docs/SAVING.md): the original slot
// save 81:B17D outside the bed menu. Mesen save game apartment (slot 1), title
// "Start saved game", "Resume game 1" (or 2 with one more DOWN), then Jake walks right.
const START = 0x1000,
  DOWN = 0x0400,
  RIGHT = 0x0100,
  SLOT = 0x0ffe,
  BLOCK = 0x2de0,
  SIZE = 0x0f28;
const title = (slot) => (k) =>
  (k >= 3000 && k < 3004) || (k >= 3300 && k < 3304) || (k >= 3600 && k < 3604)
    ? START
    : (k >= 3150 && k < 3154) || (slot === 1 && k >= 3450 && k < 3454)
      ? DOWN
      : 0;
const walk = (k) => (k < 4000 ? title(0)(k) : k < 4100 ? RIGHT : 0);
const word = (bytes, at) => bytes[at] | (bytes[at + 1] << 8);
const position = (wram) => {
  const object = word(wram, 0x0cc2);
  return [word(wram, 0x0e28 + object), word(wram, 0x0e80 + object)];
};

test(
  'a save anywhere writes only the slot and loads through the title menu',
  { timeout: 900000 },
  () => {
    const loaded = new Uint8Array(loadSave('apartment'));
    const game = new LiveGame(cartridge, { sram: loaded, pad: walk });
    while (game.nmis < 3000) game.step();
    assert.equal(saveAnywhereReachable(game), false, 'not in the title menu');
    while (game.nmis < 4200) game.step();
    assert.ok(saveAnywhereReachable(game), 'Jake moves freely');
    const wram = game.memory.wram,
      before = wram.slice(),
      walked = position(wram);
    saveToSlot(game, 1);
    assert.deepEqual(wram, before, 'the WRAM, including direct page and stack, is unchanged');
    const sram = game.memory.sram;
    assert.deepEqual(sram.subarray(0, SLOT), loaded.subarray(0, SLOT), 'slot 1 unchanged');
    assert.deepEqual(sram.subarray(SLOT + 2, SLOT + SIZE), wram.subarray(BLOCK + 2, BLOCK + SIZE));
    assert.deepEqual(sram.subarray(0x1ffc), loaded.subarray(0x1ffc), 'options unchanged');

    // "Resume game 2" accepts the checksum and restores the block; Jake enters the
    // room at its entry 2DE2 as after a bed save, not at the walked position.
    const again = new LiveGame(cartridge, { sram: sram.slice(), pad: title(1) });
    while (again.nmis < 4000) again.step();
    assert.ok(saveAnywhereReachable(again));
    const resumed = again.memory.wram;
    assert.deepEqual(
      resumed.subarray(BLOCK + 4, BLOCK + SIZE),
      sram.subarray(SLOT + 4, SLOT + SIZE),
    );
    assert.notDeepEqual(position(resumed), walked);
  },
);

// The worker records the request as a page event before the pad read
// (src/browser/game-worker.mjs); the replay repeats the save.
test('a recorded save anywhere replays to the same SRAM', { timeout: 900000 }, () => {
  const seed = 0x1234567,
    sram = new Uint8Array(loadSave('apartment')),
    recorder = new Recorder(seed, sram);
  let control = null,
    saved = false;
  const game = new LiveGame(cartridge, {
    sram,
    counter: counterBytes(seed),
    pad: (k) => {
      if (!saved && k >= 4200 && saveAnywhereReachable(game)) {
        saved = true;
        recorder.event(SAVE_SLOT_EVENTS[1]);
        saveToSlot(game, 1);
      }
      const values = [walk(k), 0, 0, 0, 0];
      recorder.input(k, values);
      return control.pad(k, unpackInput(...values));
    },
    onFrame: (f) => recorder.frame(f.nmi, game.memory.wram),
  });
  control = new MouseControl(game);
  while (game.nmis < 4400) game.step();
  assert.ok(saved);
  const replay = replayRecording(cartridge, parseRecording(JSON.stringify(recorder)));
  assert.equal(replay.mismatch, null);
  assert.deepEqual(replay.game.memory.sram, game.memory.sram);
  assert.notDeepEqual(game.memory.sram, sram);
});
