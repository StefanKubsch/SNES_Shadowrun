import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { livePlanDriver } from './live-plan-driver.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { readText, readTextTree } from '../src/data/texts.mjs';
import { PORT_TEXTS, buildPortExtension, PORT_BASE } from '../src/data/port-extension.mjs';
import { saveAnywhereReachable, saveToSlot } from '../src/game/save-anywhere.mjs';
import { occupiedSlots, slotChecksum } from '../src/game/save-slots.mjs';
import { ORIGINAL_GAMEPLAY } from '../src/game/bugfixes.mjs';
import { importSave, mergeSave, saveToText, storedSave } from '../src/browser/save-file.mjs';

// Four save slots (fourSaveSlots, src/game/save-slots.mjs, docs/SAVING.md).
const FOUR = { ...ORIGINAL_GAMEPLAY, fourSaveSlots: true },
  START = 0x1000,
  DOWN = 0x0400,
  SLOT_4 = 0x2ffe,
  BLOCK = 0x2de0,
  SIZE = 0x0f28;
// Title: "Start saved game", then `downs` presses in the saved games menu
// (disabled rows are skipped), then START.
const title = (downs) => (k) =>
  (k >= 3000 && k < 3004) || (k >= 3300 && k < 3304) || (k >= 3600 && k < 3604)
    ? START
    : (k >= 3150 && k < 3154) || (downs > 0 && k >= 3450 && k < 3454)
      ? DOWN
      : 0;
// Bed menu as in live-save.test.mjs, four DOWN presses: "Save game 4".
const BED_SAVE_4 = [
  ['press', 'b'],
  ['glove', 122, 155],
  ['wait', 8],
  ['press', 'b', 40],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['wait', 400],
  ['press', 'down', 20],
  ['press', 'b', 80],
  ['wait', 60],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'down', 20],
  ['press', 'b', 120],
  ['wait', 60],
];

test('the port bank holds the four-slot texts in the original text format', () => {
  const memory = new VmMemory(cartridge.rom, undefined, null, cartridge.present),
    read16 = (at) => memory.read16(at),
    extension = buildPortExtension(read16),
    tree = readTextTree(read16),
    read8 = (at) => extension.bytes[at - PORT_BASE];
  for (const { id, text } of PORT_TEXTS) {
    assert.ok(id > 0 && id < tree.length * 4, 'reserved ids point into the tree');
    assert.equal(readText(read8, tree, extension.texts.get(id)).text, text);
  }
  const items = Array.from(
    { length: 6 },
    (_, i) => read8(PORT_BASE + 2 * i) | (read8(PORT_BASE + 2 * i + 1) << 8),
  );
  assert.deepEqual(items, [0x7088, 0x7411, 0x7419, 0x0100, 0x0101, 0]);
});

test('without the option the game keeps 8 KiB, two slots and no port bank', () => {
  const sram = new Uint8Array(0x4000).fill(7),
    game = new LiveGame(cartridge, { sram });
  assert.equal(game.memory.sram.length, 0x2000);
  assert.equal(game.memory.extension, null);
  assert.throws(() => saveToSlot(game, 2), RangeError);
  const four = new LiveGame(cartridge, { sram: sram.subarray(0, 0x2000), gameplay: FOUR });
  assert.equal(four.memory.sram.length, 0x4000);
  assert.deepEqual(four.memory.sram.subarray(0x2000), new Uint8Array(0x2000), 'slots 3/4 empty');
});

test('with four slots the bed saves slot 4 and the title loads it', { timeout: 900000 }, () => {
  const loaded = new Uint8Array(loadSave('apartment'));
  let driver = null;
  const game = new LiveGame(cartridge, {
    gameplay: FOUR,
    sram: loaded,
    pad: (k) => {
      if (k < 5000) return title(0)(k);
      driver ??= livePlanDriver(BED_SAVE_4, game.memory.wram, () => game.driver.roundsCompleted);
      return driver.pad(k);
    },
  });
  while (!driver?.done()) game.step();
  const sram = game.memory.sram,
    differs = [];
  for (let i = 0; i < 0x0ffe; i++) if (sram[SLOT_4 + i] !== loaded[i]) differs.push(i);
  assert.deepEqual(differs, [0, 1, 0x24c], 'slot 4 holds the loaded state');
  assert.deepEqual(sram.subarray(0, 0x2000), loaded, 'the original 8 KiB are unchanged');
  assert.equal(game.dataOutsideBlank, 0);
  // The page's slot dots use the same rule as the title menu below.
  assert.deepEqual(occupiedSlots(sram), [true, false, false, true]);

  // Slots 2 and 3 are empty and disabled, so one DOWN reaches "Resume game 4".
  const again = new LiveGame(cartridge, { gameplay: FOUR, sram: sram.slice(), pad: title(1) });
  while (again.nmis < 4000) again.step();
  assert.ok(saveAnywhereReachable(again));
  assert.deepEqual(
    again.memory.wram.subarray(BLOCK + 4, BLOCK + SIZE),
    sram.subarray(SLOT_4 + 4, SLOT_4 + SIZE),
  );
  // Save anywhere reaches slot 3 with the option.
  saveToSlot(again, 2);
  assert.deepEqual(
    again.memory.sram.subarray(0x2000 + 2, 0x2000 + SIZE),
    again.memory.wram.subarray(BLOCK + 2, BLOCK + SIZE),
  );
  assert.deepEqual(occupiedSlots(again.memory.sram), [true, false, true, true]);
});

// The page reads slot occupancy with a port of 81:B12C/B1AB (save-slots.mjs).
test('slot occupancy follows the game checksum of each slot', () => {
  const apartment = new Uint8Array(loadSave('apartment'));
  assert.deepEqual(occupiedSlots(apartment), [true, false], 'Mesen save: game 1 only');
  assert.equal(slotChecksum(apartment, 0), apartment[0] | (apartment[1] << 8));
  const damaged = apartment.slice();
  damaged[0x0100] ^= 1;
  assert.deepEqual(occupiedSlots(damaged), [false, false], 'one changed byte empties the slot');
  // Zero-filled slots 3/4 of a 16 KiB image fail the checksum, as in the title menu.
  const four = new Uint8Array(0x4000);
  four.set(apartment);
  assert.deepEqual(occupiedSlots(four), [true, false, false, false]);
  assert.deepEqual(occupiedSlots(null), [false, false]);
});

test('the page keeps slots 3/4 apart and merges 8 KiB saves into them', () => {
  const four = Uint8Array.from({ length: 0x4000 }, (_, i) => i & 255),
    text = (bytes) => saveToText(bytes);
  assert.deepEqual(storedSave(text(four.subarray(0, 0x2000)), text(four.subarray(0x2000))), four);
  assert.deepEqual(storedSave(text(four.subarray(0, 0x2000)), null), four.subarray(0, 0x2000));
  assert.equal(storedSave(null, text(four.subarray(0x2000))), null);
  const original = new Uint8Array(0x2000).fill(9),
    merged = mergeSave(four, original);
  assert.deepEqual(merged.subarray(0, 0x2000), original);
  assert.deepEqual(merged.subarray(0x2000), four.subarray(0x2000), 'slots 3/4 kept');
  assert.equal(mergeSave(null, original), original);
  assert.deepEqual(importSave(four), four);
  assert.throws(() => importSave(new Uint8Array(0x3000)), /8192 bytes/);
});
