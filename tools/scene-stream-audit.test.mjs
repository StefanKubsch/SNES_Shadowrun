import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditSceneStreams, sceneConsumerInventory } from './scene-stream-audit.mjs';
import { encodeScene, decodeScene } from '../src/data/scenes.mjs';
import { readSceneTable } from '../src/data/lz-streams.mjs';
import { readRooms } from '../src/data/rooms.mjs';
import { inspectRom } from './rom.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { requireRomAddress, romOffset } from '../src/data/rom-bytes.mjs';
import { lzDecode, lzBits } from '../src/data/lz.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { loadScene } from '../src/task/main-scene-load.mjs';
import { SCENE_RECORD, SCENE_BACKDROP, DP_SCENE_RECORD } from '../src/task/wram.mjs';

const json = (name) => JSON.parse(readFileSync(`assets/vm-${name}.json`));
const result = await auditSceneStreams();
const assets = json('lz'),
  scenes = json('scenes'),
  rooms = json('rooms');
const types = json('objects'),
  tilesets = json('tilesets'),
  graphics = json('object-graphics');
const probe = JSON.parse(readFileSync('analysis/rom-vram.json')),
  german = json('texts-de');
const bits = lzBits((n) => cartridge.rom[romOffset(0x80a033 + n)]);

test('scene audit covers every source, header, room entry and dependency', () => {
  assert.deepEqual(result.counts, {
    streams: 165,
    output_bytes: 69854,
    packed_bytes: 47331,
    word_read_margins: 83,
    room_headers: 192,
    room_entries: 496,
    headers_without_entry: [75, 154, 177],
    scenes_without_header: 0,
    observed_sources: 14,
    shapes: 209,
    objects: 13574,
  });
  assert.ok(result.streams.every((s) => s.room_entry_indices.length));
  assert.equal(result.streams.filter((s) => s.room_header_indices.length > 1).length, 17);
  assert.equal(result.streams.filter((s) => s.room_entry_indices.length > 1).length, 132);
  assert.equal(result.streams.filter((s) => s.backdrop !== '0000').length, 3);
  for (const s of result.streams) {
    const scene = scenes.scenes[s.scene_index];
    assert.equal(
      s.layers.objects_46a8.count_offset + 1 + 5 * scene.objects_46a8.length,
      s.output_bytes,
    );
    for (const name of ['objects_76a8', 'objects_46a8']) {
      assert.equal(
        s.layers[name].type_counts.reduce((n, t) => n + t.count, 0),
        scene[name].length,
      );
      assert.equal(
        s.layers[name].collision_definition_boxes,
        scene[name]
          .filter((o) => o.x >= 0 && o.y >= 0 && o.z >= 0)
          .reduce((n, o) => n + types.types[o.type].boxes.length, 0),
      );
    }
  }
  for (const d of result.object_type_dependencies)
    assert.deepEqual(
      d.graphics.map((g) => g.index),
      [...new Set(types.types[d.type].parts.map((p) => p.graphic))].sort((a, b) => a - b),
    );
});

test('all scene bytes, room aliases and pointer table entries match the European ROM', () => {
  const { bytes, metadata } = inspectRom(readFileSync('Shadowrun (E).smc'));
  assert.equal(metadata.rom_sha256, scenes.source_rom_sha256);
  const read8 = (cpu) => bytes[romOffset(cpu)];
  const originalRooms = readRooms(read8);
  assert.deepEqual(originalRooms, { entries: rooms.entries, rooms: rooms.rooms });
  const table = readSceneTable(read8);
  for (const s of result.streams) {
    const cpu = requireRomAddress(s.address);
    assert.equal(table[s.scene_index], cpu);
    const expected = lzDecode((n) => read8(cpu + 2 + n), s.output_bytes, bits);
    const encoded = encodeScene(scenes.scenes[s.scene_index]);
    assert.deepEqual(encoded, expected.data, s.address);
    assert.deepEqual(decodeScene(encoded), decodeScene(expected.data), s.address);
    const at = romOffset(cpu);
    assert.deepEqual(
      cartridge.rom.slice(at, at + s.packed_slot_bytes + s.word_read_margin_bytes),
      new Uint8Array(bytes.subarray(at, at + s.packed_slot_bytes + s.word_read_margin_bytes)),
      s.address,
    );
  }
});

test('actual scene loader consumes every original record and preserves its output and trailing guard', () => {
  for (const s of result.streams) {
    const mem = new VmMemory(cartridge.rom, new Uint8Array(0x20000), null, cartridge.present);
    const end = (SCENE_RECORD & 65535) + s.output_bytes;
    mem.wram[0x10000 + end] = 0xa5;
    const a = new TaskAccessor({
      mem,
      a: s.scene_index,
      x: 0,
      y: 0,
      s: 0x1ef0,
      d: 0,
      dbr: 0x7e,
      p: 0,
      pc: 0xa518,
    });
    a.load();
    a.ctx.programBank = 0x80;
    // Track record reads separately from compressed-source refill margins.
    let lastRead = SCENE_RECORD - 1;
    const read = mem.read8.bind(mem);
    mem.read8 = (address) => {
      if (address >= SCENE_RECORD && address < 0x800000) lastRead = Math.max(lastRead, address);
      return read(address);
    };
    const h = dialogAccess(a);
    h.call(0x80a518, 0x81a117, () => loadScene(h), true);
    assert.equal(h.dp(DP_SCENE_RECORD), end, s.address);
    assert.deepEqual(
      mem.wram.slice(SCENE_RECORD - 0x7e0000, SCENE_RECORD - 0x7e0000 + s.output_bytes),
      encodeScene(scenes.scenes[s.scene_index]),
      s.address,
    );
    assert.equal(mem.wram[0x10000 + end], 0xa5, s.address);
    assert.equal(mem.read16(SCENE_BACKDROP), parseInt(s.backdrop, 16), s.address);
    // The final count or object-coordinate byte is read as a word, then masked.
    assert.equal(lastRead, SCENE_RECORD + s.output_bytes, s.address);
  }
});

test('scene audit rejects broken identities, room links, tilesets, objects, graphics and observations', () => {
  const packed = { streams: result.streams };
  const inventory = (
    s = scenes,
    r = rooms,
    t = types,
    ts = tilesets,
    g = graphics,
    p = probe,
    de = german,
  ) => sceneConsumerInventory(packed, assets, s, r, t, ts, g, p, de);
  const duplicate = structuredClone(scenes);
  const incompatible = structuredClone(scenes);
  incompatible.source_rom_sha256 = 'other-source';
  assert.throws(() => inventory(incompatible), /same European ROM/);
  duplicate.scenes[1].address = duplicate.scenes[0].address;
  assert.throws(() => inventory(duplicate), /Scene identities/);
  const badRoom = structuredClone(rooms);
  badRoom.rooms[0].scene = 165;
  assert.throws(() => inventory(scenes, badRoom), /Invalid scene in room header/);
  badRoom.rooms[0].scene = 0;
  badRoom.entries[0].room = 192;
  assert.throws(() => inventory(scenes, badRoom), /Invalid room entry/);
  const badTileset = structuredClone(scenes);
  badTileset.scenes[0].tileset = 6;
  assert.throws(() => inventory(badTileset), /Invalid scene tileset/);
  const badObject = structuredClone(scenes);
  badObject.scenes[0].objects_76a8[0].type = 548;
  assert.throws(() => inventory(badObject), /Invalid scene object type/);
  const badTypes = structuredClone(types);
  badTypes.types[0].parts[0].graphic = 658;
  assert.throws(() => inventory(scenes, rooms, badTypes), /Invalid object graphic/);
  const badProbe = structuredClone(probe);
  badProbe.streams.find((p) => p.source === result.streams.find((s) => s.observed).address)
    .length++;
  assert.throws(
    () => inventory(scenes, rooms, types, tilesets, graphics, badProbe),
    /Scene observation mismatch/,
  );
  const translated = structuredClone(german);
  translated.streams.push({ english: scenes.scenes[0].address });
  assert.throws(
    () => inventory(scenes, rooms, types, tilesets, graphics, probe, translated),
    /Unexpected scene language replacement/,
  );
});
