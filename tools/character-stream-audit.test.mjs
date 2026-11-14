import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditCharacterStreams, characterConsumerInventory } from './character-stream-audit.mjs';
import { inspectRom } from './rom.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { requireRomAddress, romOffset } from '../src/data/rom-bytes.mjs';
import { readBmp } from '../src/data/tiles.mjs';
import { sheetsToCharacters } from '../src/data/vram-tiles.mjs';
import { lzDecode, lzBits } from '../src/data/lz.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { unpackStreamLong } from '../src/task/native-unpack.mjs';

const readJson = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const result = await auditCharacterStreams();
const sourceAssets = readJson('assets/vm-lz.json');
const bitsFor = lzBits((n) => cartridge.rom[romOffset(0x80a033 + n)]);

test('character inventory accounts for every identity and consumer category', () => {
  assert.equal(result.streams.length, 58);
  assert.deepEqual(result.counts, {
    streams: 58,
    shared_sources: 56,
    language_fonts: 2,
    portrait_sources: 37,
    portrait_records: 139,
    scene_sources: 18,
    scene_commands_beyond_output: 23,
    observed_sources: 17,
  });
  assert.deepEqual(
    Object.fromEntries(
      ['bg2', 'bg4', 'obj4'].map((format) => [
        format,
        result.streams.filter((s) => s.format === format).length,
      ]),
    ),
    { bg2: 4, bg4: 11, obj4: 43 },
  );
});

test('all decoded outputs match original ROM bytes and actual native unpack', () => {
  const { bytes, metadata } = inspectRom(readFileSync('Shadowrun (E).smc'));
  assert.equal(metadata.rom_sha256, sourceAssets.source_rom_sha256);
  for (const row of result.streams) {
    const cpu = requireRomAddress(row.address);
    const length = row.output_bytes;
    const expected = lzDecode((n) => bytes[romOffset(cpu + 2 + n)], length, bitsFor).data;
    const mem = new VmMemory(cartridge.rom);
    mem.present = cartridge.present;
    mem.write16(0x1ef1, 0x1234);
    const vm = {
      mem,
      a: cpu & 0xffff,
      x: 0x2000,
      y: cpu >>> 16,
      s: 0x1ef0,
      d: 0,
      dbr: 0x80,
      p: 0,
      pc: 0x9f49,
    };
    const accessor = new TaskAccessor(vm);
    accessor.load();
    accessor.ctx.programBank = 0x80;
    const unpacked = unpackStreamLong(accessor, true, 0x809f49);
    assert.equal(unpacked.literalBytes + unpacked.referenceBytes, length, row.address);
    assert.deepEqual(mem.wram.slice(0x2000, 0x2000 + length), expected, row.address);
  }
});

test('each existing BMP sheet roundtrips streams at their audited origins', () => {
  for (const format of ['bg2', 'bg4', 'obj4']) {
    const rows = result.streams.filter((s) => s.format === format);
    const bmp = readBmp(readFileSync(new URL(`../assets/vm-lz-${format}.bmp`, import.meta.url)));
    let expectedY = 0;
    assert.equal(bmp.width, 128, format);
    assert.equal(
      bmp.height,
      rows.reduce((height, row) => height + Math.ceil(row.tiles / 16) * 8, 0),
      format,
    );
    const recovered = sheetsToCharacters(
      rows.map((s) => ({ format, tiles: s.tiles })),
      {
        [format]: { width: bmp.width, height: bmp.height, pixels: bmp.pixels },
      },
    );
    rows.forEach((row, i) => {
      const length = row.output_bytes;
      const cpu = requireRomAddress(row.address);
      const decoded = lzDecode((n) => cartridge.rom[romOffset(cpu + 2 + n)], length, bitsFor).data;
      assert.deepEqual(recovered[i], decoded, row.address);
      assert.equal(row.sheet_pixel_y, expectedY, row.address);
      expectedY += Math.ceil(row.tiles / 16) * 8;
    });
  }
});

test('German font overrides decode to their declared output sizes', () => {
  const translations = readJson('assets/vm-texts-de.json').streams;
  for (const [english, german, expected] of [
    ['81:F8B8', '81:F94F', 1344],
    ['85:FC15', '85:FC15', 896],
  ]) {
    const row = translations.find((s) => s.english === english);
    assert.equal(row.german, german);
    assert.equal(
      parseInt(row.bytes.slice(0, 2), 16) + 256 * parseInt(row.bytes.slice(2, 4), 16),
      expected,
    );
    const packed = Uint8Array.from(row.bytes.match(/../g), (hex) => parseInt(hex, 16));
    const found = lzDecode((n) => packed[n + 2], expected, bitsFor);
    const tokenOutput = found.tokens.reduce(
      (total, token) => total + (token.length === 1 ? token[0] : token[1]),
      0,
    );
    assert.equal(tokenOutput, expected, german);
    assert.equal(found.byteLength + 2, packed.length, german);
    const decoded = found.data;
    assert.equal(decoded.length, expected);
    assert.ok(
      decoded.some((byte) => byte !== 0),
      german,
    );
  }
});

test('inventory rejects missing static consumers, duplicate German sources, and bad observations', () => {
  const packed = { streams: result.streams.map((s) => ({ ...s })) };
  const assets = sourceAssets;
  const probe = readJson('analysis/rom-vram.json');
  const lists = readJson('assets/vm-scene-lists.json');
  const portraits = readJson('assets/vm-portraits.json');
  const german = readJson('assets/vm-texts-de.json');
  const target = assets.streams.find(
    (s) => result.streams.find((x) => x.scene_commands.length)?.address === s.address,
  );
  const noConsumers = structuredClone(lists);
  for (const run of noConsumers.runs)
    for (const list of run.lists)
      list.commands = list.commands.filter((c) => c.unpack !== target.address);
  assert.throws(
    () =>
      characterConsumerInventory(
        packed,
        assets,
        probe,
        noConsumers,
        { portraits: [] },
        { streams: [] },
      ),
    /Missing static character consumer/,
  );
  const duplicate = structuredClone(german);
  duplicate.streams.push({ ...duplicate.streams.find((s) => s.english === '81:F8B8') });
  assert.throws(
    () => characterConsumerInventory(packed, assets, probe, lists, portraits, duplicate),
    /Duplicate German source/,
  );
  const badProbe = structuredClone(probe);
  badProbe.streams[0].length++;
  assert.throws(
    () => characterConsumerInventory(packed, assets, badProbe, lists, portraits, german),
    /Character observation mismatch/,
  );
  const mismatched = structuredClone(assets);
  mismatched.streams[0].tiles++;
  assert.throws(
    () => characterConsumerInventory(packed, mismatched, probe, lists, portraits, german),
    /Character identity or output mismatch/,
  );
});
