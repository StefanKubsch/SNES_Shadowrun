import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createSlotActionData, isSlotActionData } from '../proof/state/slot-action-data.mjs';

const asset = JSON.parse(await readFile(new URL('../assets/slot-action-data.json', import.meta.url), 'utf8'));
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));

test('The exported fixed bank window equals all 32768 original bytes and its recorded source hash', async () => {
  const original = rom.subarray(0x60000, 0x68000);
  assert.deepEqual(asset.bytes, [...original]);
  const report = JSON.parse(await readFile(new URL('../analysis/slot-action-data.json', import.meta.url), 'utf8'));
  assert.equal(report.selected_sha256, createHash('sha256').update(original).digest('hex'));
  assert.equal(report.window.sourceCpu, '8C:8000');
  assert.equal(report.window.sourceRomOffset, '060000');
});

test('Every 16-bit definition word keeps wrapped X indexing and full table-address addition; uncovered banks stay unavailable', () => {
  const data = createSlotActionData(asset);
  for (let definition = 0; definition <= 0xFFFF; definition++) {
    const effective = 0x8CED8A + ((definition << 1) & 0xFFFF);
    const actual = data.readDefinitionPointer(definition);
    if (effective + 1 > 0x8CFFFF) assert.deepEqual(actual, { available: false, reason: 'slot_action_data_window_required' });
    else {
      assert.equal(actual.available, true);
      assert.equal(actual.value, rom.readUInt16LE(0x60000 + effective - 0x8C8000));
      assert.equal(actual.byteOffset, effective - 0x8C8000);
    }
  }
  assert.equal(data.readDefinitionPointer(0).value, 0x8000);
  assert.equal(data.readDefinitionPointer(11).value, 0x88C6);
  assert.deepEqual(data.readDefinitionPointer(0x800B), data.readDefinitionPointer(11));
});

test('All source-bank byte and word addresses read the actual ROM and never manufacture a final second byte', () => {
  const data = createSlotActionData(asset);
  for (let pointer = 0x8000; pointer <= 0xFFFF; pointer++) {
    const offset = 0x60000 + pointer - 0x8000;
    assert.equal(data.readDataByte(pointer).value, rom[offset]);
    if (pointer < 0xFFFF) assert.equal(data.readDataWord(pointer).value, rom.readUInt16LE(offset));
    else assert.deepEqual(data.readDataWord(pointer), { available: false, reason: 'slot_action_data_window_required' });
  }
});

test('Long indexed sums use 16-bit Y but do not wrap effective low words into bank 8C; low-bank data remains a boundary', () => {
  const data = createSlotActionData(asset);
  for (const [pointer, index, expected] of [[0, 0x8000, 0x8000], [0x7FFF, 1, 0x8000], [0x8000, 0x7FFF, 0xFFFF], [0xFFFF, 0, 0xFFFF], [0x8000, 0x8000, null], [0xFFFF, 1, null], [0xFFFF, 0xFFFF, null], [0, 0x7FFF, null]]) {
    const result = data.readDataByte(pointer, index);
    if (expected === null) assert.equal(result.available, false);
    else assert.equal(result.value, rom[0x60000 + expected - 0x8000]);
  }
  assert.equal(data.readDataWord(0xFFFE).available, true);
  assert.equal(data.readDataWord(0x7FFF, 1).available, true);
  assert.equal(data.readDataWord(0x8000, 0x7FFF).available, false);
});

test('Data provenance, exact extent, byte contents and every input are validated; frozen providers and copied metadata cannot mutate source', () => {
  const data = createSlotActionData(asset);
  assert.equal(isSlotActionData(data), true);
  assert.equal(isSlotActionData({}), false);
  assert.throws(() => { data.readDataByte = () => ({ value: 0 }); }, TypeError);
  const metadata = data.describe(); metadata.sourceCpu = '00:0000';
  assert.equal(data.describe().sourceCpu, '8C:8000');
  for (const entry of [{ ...asset, format: 'wrong' }, { ...asset, romSha256: 'wrong' }, { ...asset, sourceCpu: '8C:0000' }, { ...asset, sourceRomOffset: '000000' }, { ...asset, bytes: asset.bytes.slice(1) }, { ...asset, bytes: [...asset.bytes, 0] }, { ...asset, bytes: new Array(0x8000) }, { ...asset, bytes: [256, ...asset.bytes.slice(1)] }]) assert.throws(() => createSlotActionData(entry), /Invalid slot action data/);
  for (const value of [-1, 65536, 1.5, NaN, null, '0']) {
    assert.throws(() => data.readDefinitionPointer(value), /definition word/);
    assert.throws(() => data.readDataByte(value), /data index/);
    assert.throws(() => data.readDataWord(0x8000, value), /data index/);
  }
  const source = structuredClone(asset);
  const copied = createSlotActionData(source);
  const known = copied.readDataWord(0x8000);
  source.bytes[0] ^= 255;
  assert.deepEqual(copied.readDataWord(0x8000), known);
  const result = copied.readDefinitionPointer(11); result.value = 0;
  assert.equal(copied.readDefinitionPointer(11).value, 0x88C6);
});

test('Original helper instructions prove table indexing, indirect word reads and the separate byte-mode 6A data operations', () => {
  assert.equal(rom.subarray(0x2995, 0x29A4).toString('hex').toUpperCase(), 'BF283F7E0AAAA5020A7F8AED8C8500');
  assert.equal(rom.subarray(0x29AD, 0x29B9).toString('hex').toUpperCase(), 'A70085046908009990108508');
  assert.equal(rom.subarray(0x2AE9, 0x2AFC).toString('hex').toUpperCase(), '38E220BDF011F708BC98111877089DF011C220');
});
