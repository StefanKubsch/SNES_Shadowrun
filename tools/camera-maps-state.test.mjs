import test from 'node:test';
import assert from 'node:assert/strict';
import { VmMemory, ROM_SIZE } from '../src/vm/memory.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { CAMERA_MAP_FIELDS, cameraMaps, detachCameraMaps } from '../src/state/camera-maps.mjs';
import { readStateByte, writeStateByte, fillStateBytes } from '../src/state/objects.mjs';
import { COLLISION_FIELDS } from '../src/state/collision.mjs';
import { OBJECT_FIELDS, OBJECT_SLOTS } from '../src/state/objects.mjs';
import { toWram, restoreWram } from './to-wram.mjs';
import { updateTileBuffers, uploadMapEdges } from '../src/game/camera-scroll.mjs';
import {
  CAMERA_X,
  CAMERA_Y,
  CAMERA_SPEED_X,
  CAMERA_SPEED_Y,
  CAMERA_BOX,
  SCENE_LAYER_HIGH,
  SCENE_LAYER_BYTES,
  MENU_FONT_TILES,
  MENU_TILEMAP,
  TITLE_PALETTE,
  TILE_STACK_FIRST,
  TILE_STACK_LAST,
} from '../src/data/wram.mjs';

const WRAM = 0x7e0000,
  VALUE = 0x1234;
const memory = () => new VmMemory(new Uint8Array(ROM_SIZE));

test('camera and map fields own disjoint bytes and import and project every entry', () => {
  const mem = memory();
  mem.wram.fill(0xa5);
  const before = mem.wram.slice(),
    table = detachCameraMaps(mem.wram),
    occupied = new Set();
  for (const base of Object.values(OBJECT_FIELDS))
    for (let n = 0; n < OBJECT_SLOTS * 2; n++) occupied.add(base + n);
  for (const { base, count, stride } of Object.values(COLLISION_FIELDS))
    for (let i = 0; i < count; i++) for (let n = 0; n < 2; n++) occupied.add(base + i * stride + n);
  for (const [name, { base, count, bytes }] of Object.entries(CAMERA_MAP_FIELDS)) {
    assert.notEqual(table[name].buffer, mem.wram.buffer);
    for (let i = 0; i < count; i++) {
      assert.equal(table[name][i], bytes === 1 ? 0xa5 : 0xa5a5);
      table[name][i] = (VALUE + i) & (bytes === 1 ? 0xff : 0xffff);
      for (let n = 0; n < bytes; n++) {
        const at = base + i * bytes + n;
        assert.equal(occupied.has(at), false, name + ':' + at.toString(16));
        occupied.add(at);
        assert.equal(mem.read8(WRAM + at), (table[name][i] >>> (n * 8)) & 0xff);
      }
    }
  }
  const snapshot = toWram(mem);
  assert.deepEqual(mem.wram, before);
  assert.equal(detachCameraMaps(mem.wram), table);
  assert.deepEqual(toWram(mem), snapshot);
  const target = memory();
  detachCameraMaps(target.wram);
  restoreWram(target, snapshot);
  assert.deepEqual(toWram(target), snapshot);
  assert.throws(() => restoreWram(target, new Uint8Array(1)), /wram_snapshot_size_required/);
  assert.deepEqual(toWram(target), snapshot);
});

test('frontend aliases, odd menu words and stack boundary words share the detached fields', () => {
  const mem = memory(),
    table = detachCameraMaps(mem.wram);
  for (const at of [MENU_FONT_TILES, MENU_TILEMAP, TITLE_PALETTE]) {
    mem.write16(at, VALUE);
    assert.equal(mem.read16(at), VALUE);
    assert.equal(mem.wram[at - WRAM], 0);
  }
  assert.equal(table.layerHigh[0], VALUE);
  const menuOffset = MENU_TILEMAP - WRAM - CAMERA_MAP_FIELDS.layerLow.base;
  assert.equal(table.layerLow[menuOffset >>> 1], 0x3400);
  assert.equal(table.layerLow[(menuOffset >>> 1) + 1], 0x12);
  mem.write16(WRAM + TILE_STACK_FIRST + TILE_STACK_LAST + 1, VALUE);
  assert.equal(table.stackFirst.at(-1), 0x3400);
  assert.equal(table.stackSecond[0], 0x12);
  assert.equal(writeStateByte(mem.wram, SCENE_LAYER_HIGH, 0x156), 0x156);
  assert.equal(readStateByte(mem.wram, SCENE_LAYER_HIGH), 0x56);
  fillStateBytes(mem.wram, 0, SCENE_LAYER_HIGH, SCENE_LAYER_HIGH + 2 * SCENE_LAYER_BYTES);
  assert.ok(table.layerHigh.every((v) => v === 0));
  assert.ok(table.layerLow.every((v) => v === 0));
});

test('camera box is exactly three bytes and its odd high word crosses pointer and bank', () => {
  const mem = memory(),
    table = detachCameraMaps(mem.wram);
  mem.write16(WRAM + CAMERA_BOX, VALUE);
  mem.write16(WRAM + CAMERA_BOX + 1, 0x8a56);
  assert.deepEqual([...table.box], [0x34, 0x56, 0x8a]);
  assert.equal(mem.read16(WRAM + CAMERA_BOX + 1), 0x8a56);
  assert.equal(mem.read16(0x800000 + CAMERA_BOX + 1), 0x8a56);
  mem.write16(WRAM + CAMERA_BOX + 2, 0x9abc);
  assert.equal(table.box[2], 0xbc);
  assert.equal(mem.wram[CAMERA_BOX + 3], 0x9a);
});

for (const [x, y, dx, dy] of [
  [31, 31, 4, 4],
  [65, 65, -4, -4],
  [0, 0, -4, -4],
  [0x7ff, 0x47b, 4, 4],
])
  test('camera movement and edge uploads retain state at ' + [x, y, dx, dy], () => {
    const reference = memory(),
      live = memory();
    // Deterministic layer data exercises all copy offsets, including wrapped edges.
    for (let n = 0; n < 2 * SCENE_LAYER_BYTES; n++)
      reference.wram[SCENE_LAYER_HIGH + n] = (n * 13 + 7) & 0xff;
    for (const [at, value] of [
      [CAMERA_X, x],
      [CAMERA_Y, y],
      [CAMERA_SPEED_X, dx & 0xffff],
      [CAMERA_SPEED_Y, dy & 0xffff],
    ])
      reference.write16(WRAM + at, value);
    live.wram.set(reference.wram);
    detachCameraMaps(live.wram);
    const rawBefore = live.wram.slice(),
      writes = [];
    for (const mem of [reference, live]) {
      updateTileBuffers(mem.wram);
      const sent = [];
      uploadMapEdges(mem.wram, { write: (...args) => sent.push(args) });
      writes.push(sent);
    }
    assert.deepEqual(toWram(live), reference.wram);
    assert.deepEqual(writes[1], writes[0]);
    for (const { base, count, bytes } of Object.values(CAMERA_MAP_FIELDS))
      assert.deepEqual(
        live.wram.subarray(base, base + count * bytes),
        rawBefore.subarray(base, base + count * bytes),
      );
  });

test('only the normal live loop detaches camera and tile maps', () => {
  const mem = memory();
  assert.equal(cameraMaps(mem.wram), undefined);
  mem.write16(WRAM + CAMERA_X, VALUE);
  assert.equal(mem.wram[CAMERA_X], 0x34);
  assert.deepEqual(toWram(mem), mem.wram);
  const game = new LiveGame(new Uint8Array(ROM_SIZE));
  cameraMaps(game.memory.wram).x[0] = VALUE;
  assert.equal(game.memory.read16(WRAM + CAMERA_X), VALUE);
  assert.equal(game.memory.wram[CAMERA_X], 0);
});
