import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  exportSaveBundle,
  importSaveBundle,
  importSaveFile,
  MAX_SAVE_IMPORT_BYTES,
} from '../src/browser/save-bundle.mjs';
import { updateSaveDetails, describeSaveSlots } from '../src/browser/save-details.mjs';
import { SRAM_SIZE_FOUR_SLOTS } from '../src/vm/memory.mjs';
import { SLOT_OFFSETS_FOUR, slotChecksum } from '../src/game/save-slots.mjs';

const apartment = new Uint8Array(
    readFileSync(new URL('./mesen/saves/apartment.srm', import.meta.url)),
  ),
  DATE = '2026-11-22T12:00:00.000Z',
  IMAGE = 'data:image/png;base64,AAAA';
const parse = (bytes) => JSON.parse(new TextDecoder().decode(bytes));
const encode = (value) => new TextEncoder().encode(JSON.stringify(value));

for (const four of [false, true])
  test(`bundle round trip preserves every SRAM byte, picture and date (${four ? 4 : 2} slots)`, () => {
    const save = four ? new Uint8Array(SRAM_SIZE_FOUR_SLOTS) : apartment.slice();
    if (four)
      for (const offset of SLOT_OFFSETS_FOUR)
        save.set(apartment.subarray(0, SLOT_OFFSETS_FOUR[1]), offset);
    const details = updateSaveDetails(null, save, [], DATE, { room: 345, image: IMAGE }),
      before = save.slice(),
      exported = exportSaveBundle(save, details),
      restored = importSaveFile(exported, 'Backup.shadowrun');
    assert.ok(exported.length < MAX_SAVE_IMPORT_BYTES);
    assert.deepEqual(restored.save, before);
    assert.deepEqual(restored.details, details);
    assert.deepEqual(save, before, 'export does not save or modify game data');
    assert.equal(describeSaveSlots(restored.save, restored.details)[0].preview, IMAGE);
  });

test('raw .srm imports remain independent of browser metadata', () => {
  const imported = importSaveFile(apartment, 'Backup.SRM');
  assert.deepEqual(imported.save, apartment);
  assert.notEqual(imported.save, apartment);
  assert.equal(imported.details, null);
  assert.throws(() => importSaveFile(apartment, 'Backup.zip'), { code: 'saveImportFormat' });
});

test('old and mismatched local metadata do not attach a picture to a different save on export', () => {
  const details = updateSaveDetails(null, apartment, [], DATE, { room: 345, image: IMAGE }),
    changed = apartment.slice();
  changed[2] ^= 1;
  new DataView(changed.buffer).setUint16(0, slotChecksum(changed, 0), true);
  const restored = importSaveBundle(exportSaveBundle(changed, details));
  assert.equal(restored.details[0].preview, null);
  assert.equal(restored.details[0].savedAt, null);
  assert.equal(importSaveBundle(exportSaveBundle(apartment, [])).details[0].preview, null);
});

test('invalid bundles are rejected as a whole before any caller can replace stored data', () => {
  const valid = parse(
    exportSaveBundle(
      apartment,
      updateSaveDetails(null, apartment, [], DATE, { room: 345, image: IMAGE }),
    ),
  );
  const invalid = [
    (value) => {
      value.format = 'another-game';
    },
    (value) => {
      value.sram = 'AAAA';
    },
    (value) => {
      value.sram += '\n';
    },
    (value) => {
      value.slots.pop();
    },
    (value) => {
      value.slots[0].identity = 'wrong';
    },
    (value) => {
      value.slots[0].savedAt = 'not a date';
    },
    (value) => {
      value.slots[0].preview = 'https://example.com/image.png';
    },
    (value) => {
      value.slots[1] = value.slots[0];
    },
  ];
  for (const mutate of invalid) {
    const value = structuredClone(valid);
    mutate(value);
    assert.throws(() => importSaveBundle(encode(value)), { code: 'saveBundleInvalid' });
  }
  valid.version++;
  assert.throws(() => importSaveBundle(encode(valid)), { code: 'saveBundleVersion' });
  for (const bytes of [
    new Uint8Array(),
    new TextEncoder().encode('{'),
    new Uint8Array(MAX_SAVE_IMPORT_BYTES + 1),
  ]) {
    assert.throws(() => importSaveBundle(bytes), { code: 'saveBundleInvalid' });
  }
  assert.throws(
    () => importSaveFile(new Uint8Array(apartment.length), 'Broken.shadowrun'),
    { code: 'saveBundleInvalid' },
    'a malformed bundle with raw SRAM size is never imported as raw data',
  );
});
