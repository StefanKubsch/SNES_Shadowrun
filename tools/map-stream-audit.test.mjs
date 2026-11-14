import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditMapStreams, mapConsumerInventory } from './map-stream-audit.mjs';
import { inspectRom } from './rom.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { requireRomAddress, romOffset } from '../src/data/rom-bytes.mjs';
import { lzBits, lzDecode } from '../src/data/lz.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { unpackStreamLong } from '../src/task/native-unpack.mjs';

const json = (name) => JSON.parse(readFileSync(`assets/${name}.json`));
const result = await auditMapStreams();
const assets = json('vm-lz');
const lists = json('vm-scene-lists');
const tables = json('vm-tables');
const german = json('vm-texts-de');
const probe = JSON.parse(readFileSync('analysis/rom-vram.json'));
const packed = { streams: result.streams };
const bitsFor = lzBits((n) => cartridge.rom[romOffset(0x80a033 + n)]);

test('map audit joins every identity, aliases, transfer tails and language owners', () => {
  assert.equal(result.counts.streams, 27);
  assert.equal(result.counts.scene_sources, 18);
  assert.equal(result.counts.title_sources, 5);
  assert.equal(result.counts.direct_sources, 6);
  assert.equal(result.counts.language_maps, 3);
  assert.equal(result.counts.scene_commands_beyond_output, 10);
  assert.equal(result.counts.observed_sources, 17);
  assert.equal(
    result.streams.reduce((n, s) => n + s.output_bytes, 0),
    79680,
  );
  assert.equal(
    result.streams.reduce((n, s) => n + s.packed_slot_bytes, 0),
    10663,
  );
  assert.equal(
    result.streams.reduce((n, s) => n + s.word_read_margin_bytes, 0),
    11,
  );
  const row = (address) => result.streams.find((s) => s.address === address);
  assert.equal(row('87:E272').scene_commands.length, 3);
  assert.equal(row('81:FB0A').scene_commands[0].bytes_beyond_output, 128);
  assert.equal(row('84:FD2B').scene_commands[0].bytes_beyond_output, 448);
  assert.equal(row('85:FD38').role, 'credits-and-matrix-character-map');
  assert.equal(row('89:E14E').words, 16 * 1024);
  assert.equal(row('84:D8DD').title_consumers[0].destination, '7E:76A8');
  assert.equal(row('81:F803').observed.format, 'bytes');
});

test('all map words match the original ROM and native unpack with destination guards', () => {
  const { bytes, metadata } = inspectRom(readFileSync('Shadowrun (E).smc'));
  assert.equal(metadata.rom_sha256, assets.source_rom_sha256);
  for (const row of result.streams) {
    const cpu = requireRomAddress(row.address);
    const expected = lzDecode((n) => bytes[romOffset(cpu + 2 + n)], row.output_bytes, bitsFor).data;
    const words = assets.streams
      .find((s) => s.address === row.address)
      .words.join(' ')
      .split(/\s+/)
      .map((s) => parseInt(s, 16));
    assert.deepEqual(
      Uint8Array.from(words.flatMap((w) => [w & 255, w >>> 8])),
      expected,
      row.address,
    );
    const mem = new VmMemory(cartridge.rom);
    mem.present = cartridge.present;
    mem.wram.fill(0xa5);
    mem.write16(0x1ef1, 0x1234);
    const vm = {
      mem,
      a: cpu & 0xffff,
      x: 0x4000,
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
    assert.equal(unpacked.literalBytes + unpacked.referenceBytes, row.output_bytes, row.address);
    assert.deepEqual(mem.wram.slice(0x4000, 0x4000 + row.output_bytes), expected, row.address);
    assert.equal(mem.wram[0x3fff], 0xa5, row.address);
    assert.equal(mem.wram[0x4000 + row.output_bytes], 0xa5, row.address);
  }
  const title = tables.tables.find((t) => t.name === 'intro_unpacks');
  title.values.forEach((word, i) => {
    const offset = romOffset(0x81d85c + 2 * i);
    assert.equal(bytes[offset] | (bytes[offset + 1] << 8), parseInt(word, 16));
  });
});

test('map audit rejects missing consumers, altered sizes, duplicate identities and bad observations', () => {
  const inventory = (a = assets, l = lists, t = tables, g = german, p = probe) =>
    mapConsumerInventory(packed, a, l, t, g, p);
  const noLists = structuredClone(lists);
  for (const run of noLists.runs) for (const list of run.lists) list.commands = [];
  assert.throws(() => inventory(assets, noLists), /Missing static map consumer/);
  const bad = structuredClone(assets);
  bad.streams.find((s) => s.format === 'map').words = ['0000'];
  assert.throws(() => inventory(bad), /Map identity or output mismatch/);
  const duplicate = structuredClone(assets);
  duplicate.streams.push(duplicate.streams.find((s) => s.format === 'map'));
  assert.throws(() => inventory(duplicate), /Duplicate map identity/);
  const badProbe = structuredClone(probe);
  badProbe.streams.find((s) => s.source === '81:F803').length++;
  assert.throws(
    () => inventory(assets, lists, tables, german, badProbe),
    /Map observation mismatch/,
  );
  assert.throws(() => inventory(assets, lists, { tables: [] }), /Missing title unpack table/);
  const duplicatedGerman = structuredClone(german);
  duplicatedGerman.streams.push(german.streams.find((s) => s.english === '81:F803'));
  assert.throws(() => inventory(assets, lists, tables, duplicatedGerman), /Duplicate German map/);
});
