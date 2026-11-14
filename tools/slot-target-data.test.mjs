import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createSlotTargetData, isSlotTargetData } from '../proof/state/slot-target-data.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const asset = JSON.parse(await readFile(new URL('../assets/slot-target-data.json', import.meta.url), 'utf8'));
const fixture = () => ({ ...asset, bytes: Array(65536).fill(0) });

test('Every complete word in both target windows matches the original 65536 extracted bytes and fixed digest', () => {
  const bytes = Buffer.from(asset.bytes);assert.deepEqual(bytes, rom.subarray(0xC8000, 0xD8000));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '3cf9400a3398abd462952b91d7b0ad3b107ab8da5d787f5e3bc4d3e87ba620a2');
  assert.equal(asset.dataSha256, '3cf9400a3398abd462952b91d7b0ad3b107ab8da5d787f5e3bc4d3e87ba620a2');
  const data = createSlotTargetData(asset);
  for (const bank of [0x99, 0x9A]) for (let word = 0x8000; word < 0xFFFF; word++) {
    const offset = (bank - 0x99) * 0x8000 + word - 0x8000;
    assert.deepEqual(data.readWord(bank << 16 | word), { available: true, value: bytes.readUInt16LE(offset) });
  }
});

test('Long-indexed words preserve bank carry and reject lower halves, last-byte-only reads and outside banks', () => {
  const data = createSlotTargetData(asset);
  for (const pointer of [0x988000, 0x997FFF, 0x99FFFF, 0x9A0000, 0x9A7FFF, 0x9AFFFF, 0x9B8000, 0xFFFFFF]) assert.deepEqual(data.readWord(pointer), { available: false, reason: 'slot_target_data_window_required' });
  assert.equal(data.readWord(0x99FFFF, 1).available, false); // 9A:0000, not9A:8000
  assert.deepEqual(data.readWord(0x99FFFF, 0x8001), data.readWord(0x9A8000));
  assert.deepEqual(data.readWord(0x998000, 0x8000), { available: false, reason: 'slot_target_data_window_required' });
  for (const pointer of [-1, 0x1000000, 1.5, null, '998000']) assert.throws(() => data.readWord(pointer), /Invalid/);
  for (const index of [-1, 65536, undefined, 1.5]) if (index !== undefined) assert.throws(() => data.readWord(0x998000, index), /Invalid/);
});

test('The two full count reads retain only low bytes and add14*count+1 for all byte counts in either bank', () => {
  for (const bank of [0x99, 0x9A]) for (let firstCount = 0; firstCount < 256; firstCount++) {
    const secondCount = 255 - firstCount;const source = fixture();const base = (bank - 0x99) * 0x8000;
    const intermediate = 14 * firstCount + 1;
    source.bytes[base] = firstCount;source.bytes[base + 1] = 0xFF;
    source.bytes[base + intermediate] = secondCount;source.bytes[base + intermediate + 1] = 0xFF;
    const result = createSlotTargetData(source).deriveF3From9D(bank << 16 | 0x8000);
    assert.deepEqual(result, { available: true, pointer: bank << 16 | 0x8000 + 14 * 255 + 2,
      intermediatePointer: bank << 16 | 0x8000 + intermediate, firstCount, secondCount });
  }
});

test('Count reads and low-word pointer overflow keep the F5 bank and never fabricate a high read byte', () => {
  const source = fixture();source.bytes[0x7FEE] = 2;
  assert.deepEqual(createSlotTargetData(source).deriveF3From9D(0x99FFEE), { available: false, reason: 'slot_target_data_window_required' });
  source.bytes[0x7FF0] = 0;source.bytes[0x7FF1] = 2;
  const data = createSlotTargetData(source);
  assert.deepEqual(data.deriveF3From9D(0x99FFF0), { available: true, pointer: 0x99000E, intermediatePointer: 0x99FFF1, firstCount: 0, secondCount: 2 });
  assert.equal(data.readWord(0x99000E, 1).available, false);
  assert.equal(data.deriveF3From9D(0x99FFFF).available, false);
});

test('Explicit9D data probe derives the real F3 bytes without asserting a scene lifecycle', () => {
  const data = createSlotTargetData(asset);
  assert.deepEqual(data.deriveF3From9D(0x99807E), { available: true, pointer: 0x99811A, intermediatePointer: 0x99807F, firstCount: 0, secondCount: 11 });
  assert.deepEqual([1, 3, 5].map(index => data.readWord(0x99811A, index).value), [0xF201, 0xE301, 0x4001]);
});

test('Target assets and descriptions are copied, branding and malformed metadata/bytes fail explicitly', () => {
  const source = { ...asset, bytes: [...asset.bytes] };const data = createSlotTargetData(source);
  const before = data.readWord(0x998000);source.bytes[0] ^= 255;
  data.describe().sourceCpuWindows[0] = '9A:0000';assert.deepEqual(data.readWord(0x998000), before);
  assert.equal(isSlotTargetData(data), true);assert.equal(isSlotTargetData({ readWord() {} }), false);
  for (const source of [{ ...asset, format: 'other' }, { ...asset, romSha256: 'other' }, { ...asset, sourceRomOffset: '0D0000' }, { ...asset, sourceCpuWindows: '99:8000' }, { ...asset, sourceCpuWindows: ['9A:8000-FFFF','99:8000-FFFF'] }, { ...asset, bytes: new Array(65536) }, { ...asset, bytes: [0] }, { ...asset, bytes: [...asset.bytes.slice(0, -1), 256] }]) assert.throws(() => createSlotTargetData(source), /Invalid slot target data/);
});
