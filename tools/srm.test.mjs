import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VmMemory, ROM_SIZE } from '../src/vm/memory.mjs';
import { detachSceneRoom, SCENE_ROOM_FIELDS } from '../src/state/scene-room.mjs';
import { detachCombat, COMBAT_FIELDS } from '../src/state/combat.mjs';
import { savedGameState } from '../src/state/saved-game.mjs';
import { toWram } from './to-wram.mjs';
import {
  SAVED_FIELDS,
  SAVED_BYTES,
  SRAM_SIZE,
  SRAM_SIZE_FOUR_SLOTS,
  SLOT_OFFSETS_FOUR,
  serializeGame,
  restoreGame,
  writeSaveSlot,
  readSaveSlot,
  inspectSaveSlot,
  occupiedSlots,
  slotChecksum,
  readSaveSettings,
  writeSaveSettings,
  settingsChecksum,
  settingsValid,
  storeSettingsChecksum,
} from '../src/storage/srm.mjs';
import { SAVE_STATE_START, WRAM } from '../src/data/wram.mjs';

const APARTMENT = readFileSync(new URL('mesen/saves/apartment.srm', import.meta.url)),
  PATTERN_MULTIPLIER = 13,
  PATTERN_BIAS = 7,
  BYTE_MASK = 0xff,
  WORD_VALUE = 0xa537,
  SETTINGS_START = 0x1ffc;
const memory = () => new VmMemory(new Uint8Array(ROM_SIZE));

test('the save schema covers every file byte exactly once and agrees with its state owners', () => {
  const occupied = new Uint8Array(SAVED_BYTES),
    owners = { scene: SCENE_ROOM_FIELDS, combat: COMBAT_FIELDS };
  for (const [owner, name, offset, count, width, stride = width] of SAVED_FIELDS) {
    const field = owners[owner][name];
    assert.equal(count, field.count, name);
    assert.equal(width, field.bytes, name);
    for (let i = 0; i < count; i++)
      for (let byte = 0; byte < width; byte++) {
        const at = offset + i * stride + byte;
        assert.ok(at < SAVED_BYTES, name);
        assert.equal(occupied[at]++, 0, name);
        assert.equal(field.base + i * field.stride + byte, SAVE_STATE_START + at, name);
      }
  }
  assert.ok(occupied.every((value) => value === 1));
});

for (const detached of [false, true]) {
  test(`the Mesen save round-trips byte for byte (${detached ? 'live arrays' : 'raw fixture'})`, () => {
    const mem = memory();
    if (detached) {
      detachSceneRoom(mem.wram);
      detachCombat(mem.wram);
    }
    const state = savedGameState(mem),
      before = toWram(mem),
      original = APARTMENT.subarray(0, SAVED_BYTES);
    readSaveSlot(APARTMENT, 0, state);
    const projected = toWram(mem);
    assert.deepEqual(
      projected.subarray(SAVE_STATE_START, SAVE_STATE_START + SAVED_BYTES),
      new Uint8Array(original),
    );
    assert.deepEqual(projected.subarray(0, SAVE_STATE_START), before.subarray(0, SAVE_STATE_START));
    assert.deepEqual(
      projected.subarray(SAVE_STATE_START + SAVED_BYTES),
      before.subarray(SAVE_STATE_START + SAVED_BYTES),
    );
    assert.deepEqual(serializeGame(state), new Uint8Array(original));
    assert.equal(inspectSaveSlot(APARTMENT, 0).room, 345);
    assert.equal(inspectSaveSlot(APARTMENT, 0).valid, true);
    if (detached) assert.deepEqual(mem.wram, before, 'raw bytes are not refreshed');
  });
}

test('all four slots preserve other slots, padding and global options', () => {
  const mem = memory();
  detachSceneRoom(mem.wram);
  detachCombat(mem.wram);
  for (let i = 0; i < SAVED_BYTES; i++)
    mem.write8(WRAM + SAVE_STATE_START + i, (i * PATTERN_MULTIPLIER + PATTERN_BIAS) & BYTE_MASK);
  const state = savedGameState(mem),
    before = toWram(mem),
    expected = before.slice(SAVE_STATE_START, SAVE_STATE_START + SAVED_BYTES),
    checksum = slotChecksum(expected, 0);
  expected[0] = checksum & BYTE_MASK;
  expected[1] = checksum >>> 8;
  assert.deepEqual(
    serializeGame(state),
    expected,
    'every projected byte has its original file position',
  );
  const sram = new Uint8Array(SRAM_SIZE_FOUR_SLOTS).fill(BYTE_MASK);
  for (let slot = 0; slot < SLOT_OFFSETS_FOUR.length; slot++) {
    const previous = sram.slice(),
      offset = SLOT_OFFSETS_FOUR[slot];
    writeSaveSlot(sram, slot, state, true);
    assert.deepEqual(sram.subarray(offset, offset + SAVED_BYTES), expected);
    assert.deepEqual(sram.subarray(0, offset), previous.subarray(0, offset));
    assert.deepEqual(sram.subarray(offset + SAVED_BYTES), previous.subarray(offset + SAVED_BYTES));
  }
  assert.deepEqual(occupiedSlots(sram), [true, true, true, true]);
  assert.deepEqual(
    toWram(mem),
    before,
    'saving leaves all game state, including the header, alone',
  );
  assert.deepEqual(sram.subarray(SETTINGS_START, SRAM_SIZE), new Uint8Array(4).fill(BYTE_MASK));
});

test('invalid slots, short images and failed serialization leave state and saves untouched', () => {
  const mem = memory(),
    state = savedGameState(mem),
    sram = new Uint8Array(SRAM_SIZE),
    before = toWram(mem);
  for (const slot of [-1, 2, 4, 0.5, NaN]) {
    assert.throws(() => writeSaveSlot(sram, slot, state), RangeError);
    assert.throws(() => readSaveSlot(sram, slot, state), RangeError);
  }
  assert.throws(() => readSaveSlot(sram, 2, state, true), /incomplete/);
  assert.throws(() => restoreGame(state, new Uint8Array(SAVED_BYTES - 1)), /size/);
  assert.throws(
    () =>
      writeSaveSlot(sram, 0, {
        get() {
          throw new Error('read failed');
        },
      }),
    /read failed/,
  );
  assert.deepEqual(toWram(mem), before);
  assert.deepEqual(sram, new Uint8Array(SRAM_SIZE));
  assert.deepEqual(occupiedSlots(new Uint8Array(1)), [false, false]);
});

test('global settings preserve their original checksum, byte masks and overlapping word reads', () => {
  const sram = new Uint8Array(APARTMENT),
    before = sram.slice();
  assert.ok(settingsValid(sram), 'original settings checksum');
  writeSaveSettings(sram, { stereo: WORD_VALUE, control: 1, music: 3 });
  const settings = readSaveSettings(sram);
  assert.equal(settings.stereo, WORD_VALUE & BYTE_MASK);
  assert.equal(settings.control, 1);
  assert.equal(settings.music, 3);
  assert.equal(settings.outputControlWord, (WORD_VALUE & BYTE_MASK) | (1 << 8));
  assert.equal(settings.controlMusicWord, 1 | (3 << 8));
  storeSettingsChecksum(sram);
  assert.ok(settingsValid(sram));
  assert.equal(readSaveSettings(sram).musicWord, 3 | (settingsChecksum(sram) << 8));
  assert.deepEqual(sram.subarray(0, SETTINGS_START), before.subarray(0, SETTINGS_START));
  sram[SETTINGS_START] ^= 1;
  assert.equal(settingsValid(sram), false);
});
