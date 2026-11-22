import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  describeSaveSlots,
  updateSaveDetails,
  parseSaveDetails,
  saveRoomName,
} from '../src/browser/save-details.mjs';
import { slotChecksum, SLOT_OFFSETS_FOUR } from '../src/game/save-slots.mjs';
import { mergeSave } from '../src/browser/save-file.mjs';
import { SRAM_SIZE_FOUR_SLOTS } from '../src/vm/memory.mjs';

const apartment = new Uint8Array(
    readFileSync(new URL('./mesen/saves/apartment.srm', import.meta.url)),
  ),
  FIRST_DATE = '2026-11-22T12:30:00.000Z',
  SECOND_DATE = '2026-11-22T13:00:00.000Z',
  APARTMENT_ROOM = 345,
  MORGUE_ROOM = 3,
  UNKNOWN_ROOM = 65535;
const copySlot = (bytes, slot) =>
  bytes.set(apartment.subarray(0, SLOT_OFFSETS_FOUR[1]), SLOT_OFFSETS_FOUR[slot]);

test('valid imported slots describe the saved room without inventing a date', () => {
  const result = describeSaveSlots(apartment);
  assert.equal(result[0].room, APARTMENT_ROOM);
  assert.equal(result[0].savedAt, null);
  assert.equal(result[1], null);
  assert.equal(saveRoomName(result[0].room, 'en'), 'Jake’s apartment');
  assert.equal(saveRoomName(result[0].room, 'de'), 'Jakes Apartment');
  assert.equal(saveRoomName(MORGUE_ROOM, 'de'), 'Leichenhalle');
  assert.equal(saveRoomName(UNKNOWN_ROOM, 'de'), null);
});

test('timestamps belong only to changed valid slots, with exact byte identity', () => {
  const bytes = new Uint8Array(SRAM_SIZE_FOUR_SLOTS);
  copySlot(bytes, 0);
  const details = updateSaveDetails(null, bytes, [], FIRST_DATE);
  copySlot(bytes, 2);
  const previous = bytes.slice();
  previous.fill(0, SLOT_OFFSETS_FOUR[2]);
  const next = updateSaveDetails(previous, bytes, details, SECOND_DATE),
    slots = describeSaveSlots(bytes, next);
  assert.equal(slots[0].savedAt, FIRST_DATE);
  assert.equal(slots[2].savedAt, SECOND_DATE);
  assert.equal(slots[1], null);
  assert.equal(slots[3], null);
  assert.deepEqual(updateSaveDetails(bytes, bytes, next, FIRST_DATE), next);
});

test('different imported bytes discard stale metadata even with a valid checksum', () => {
  const details = updateSaveDetails(null, apartment, [], FIRST_DATE),
    changed = apartment.slice();
  changed[2] ^= 1;
  const checksum = slotChecksum(changed, 0);
  new DataView(changed.buffer).setUint16(0, checksum, true);
  const result = describeSaveSlots(changed, details);
  assert.notEqual(result[0].room, APARTMENT_ROOM);
  assert.equal(result[0].savedAt, null);
  assert.equal(updateSaveDetails(apartment, changed, details)[0].savedAt, null);
  changed[2] ^= 1;
  assert.equal(describeSaveSlots(changed, details)[0], null, 'damaged checksum hides slot details');
});

test('two-slot saves preserve extra-slot dates; an eight KiB import removes them', () => {
  const four = new Uint8Array(SRAM_SIZE_FOUR_SLOTS);
  copySlot(four, 2);
  const details = updateSaveDetails(null, four, [], FIRST_DATE),
    merged = mergeSave(four, apartment),
    next = updateSaveDetails(four, merged, details, SECOND_DATE);
  assert.equal(describeSaveSlots(merged, next)[2].savedAt, FIRST_DATE);
  const imported = updateSaveDetails(merged, apartment, next);
  assert.equal(imported.length, 2);
  assert.equal(imported[0].savedAt, SECOND_DATE, 'identical imported slot retains known date');
});

test('old saves and malformed optional metadata stay readable', () => {
  for (const text of [null, '', '{', '{}', 'null']) assert.deepEqual(parseSaveDetails(text), []);
  for (const detail of [
    null,
    42,
    {},
    { savedAt: FIRST_DATE },
    { identity: describeSaveSlots(apartment)[0].identity, savedAt: 'invalid' },
  ]) {
    const details = parseSaveDetails(JSON.stringify([detail]));
    assert.equal(describeSaveSlots(apartment, details)[0].savedAt, null);
  }
  assert.deepEqual(describeSaveSlots(null), [null, null]);
});
