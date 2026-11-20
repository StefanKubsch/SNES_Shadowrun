import test from 'node:test';
import assert from 'node:assert/strict';
import { VmMemory, ROM_SIZE } from '../src/vm/memory.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import {
  COLLISION_FIELDS,
  collisionTable,
  detachCollisionStorage,
} from '../src/state/collision.mjs';
import { readStateByte, writeStateByte } from '../src/state/objects.mjs';
import { toWram, restoreWram } from '../proof/state/to-wram.mjs';
import { TILE_CACHE_NEXT, TILE_CACHE_KEYS, TILE_CACHE_DATA } from '../src/data/wram.mjs';
import { buildCollisionGrid } from '../src/game/collision-grid.mjs';

const WRAM = 0x7e0000,
  VALUE = 0x1234;
const memory = () => new VmMemory(new Uint8Array(ROM_SIZE));

test('all collision words import once and project independently, including odd owners', () => {
  const mem = memory();
  mem.wram.fill(0xa5);
  const before = mem.wram.slice(),
    table = detachCollisionStorage(mem.wram);
  for (const [name, { base, count, stride }] of Object.entries(COLLISION_FIELDS)) {
    assert.notEqual(table[name].buffer, mem.wram.buffer, name);
    for (let i = 0; i < count; i++) {
      assert.equal(table[name][i], 0xa5a5, `${name}:${i}`);
      table[name][i] = (VALUE + i) & 0xffff;
      assert.equal(mem.read16(WRAM + base + i * stride), table[name][i], `${name}:${i}`);
    }
  }
  const snapshot = toWram(mem);
  assert.deepEqual(mem.wram, before);
  assert.equal(detachCollisionStorage(mem.wram), table);
  assert.deepEqual(toWram(mem), snapshot);
  mem.wram.fill(0x5a);
  restoreWram(mem, snapshot);
  assert.deepEqual(toWram(mem), snapshot);
  assert.throws(() => restoreWram(mem, new Uint8Array(1)), /wram_snapshot_size_required/);
  assert.deepEqual(toWram(mem), snapshot);
});

test('byte writes and cross-field words retain tile cache aliases and assignment values', () => {
  const mem = memory(),
    table = detachCollisionStorage(mem.wram);
  for (const base of [TILE_CACHE_NEXT, TILE_CACHE_KEYS, TILE_CACHE_DATA]) {
    mem.write16(WRAM + base, VALUE);
    assert.equal(mem.read16(WRAM + base), VALUE);
    assert.equal(readStateByte(mem.wram, base), VALUE & 0xff);
    assert.equal(mem.wram[base], 0);
  }
  assert.equal(table.staticBoxEnd[0], VALUE);
  mem.write16(WRAM + TILE_CACHE_NEXT + 1, 0xabcd);
  assert.equal(table.staticBoxEnd[0], 0xcd34);
  assert.equal(table.staticNodeEnd[0], 0xab);
  assert.equal(writeStateByte(mem.wram, TILE_CACHE_NEXT, 0x156), 0x156);
  assert.equal(table.staticBoxEnd[0], 0xcd56);
});

test('owner gaps and bytes beyond each table keep their original storage', () => {
  const mem = memory(),
    table = detachCollisionStorage(mem.wram),
    { base, count, stride } = COLLISION_FIELDS.owners;
  mem.write8(WRAM + base + 2, 0x81);
  mem.write16(WRAM + base + stride, VALUE);
  mem.write16(WRAM + base + count * stride, 0xbeef);
  assert.equal(mem.wram[base + 2], 0x81);
  assert.equal(table.owners[1], VALUE);
  assert.equal(mem.read8(WRAM + base + 2), 0x81);
  assert.equal(mem.wram[base + count * stride], 0xef);
  assert.equal(mem.read16(WRAM + base + count * stride), 0xbeef);
  mem.write16(WRAM + 0xfffc, VALUE);
  assert.equal(mem.wram[0xfffc], VALUE & 0xff);
});

test('proof fixtures remain byte-backed and only the shipped loop detaches collision state', () => {
  const mem = memory();
  mem.write16(WRAM + TILE_CACHE_NEXT, VALUE);
  assert.equal(collisionTable(mem.wram), undefined);
  assert.equal(mem.wram[TILE_CACHE_NEXT], VALUE & 0xff);
  assert.deepEqual(toWram(mem), mem.wram);
  const game = new LiveGame(new Uint8Array(ROM_SIZE));
  collisionTable(game.memory.wram).staticBoxEnd[0] = VALUE;
  assert.equal(game.memory.read16(WRAM + TILE_CACHE_NEXT), VALUE);
  assert.equal(game.memory.wram[TILE_CACHE_NEXT], 0);
});

test('building a synthetic room grid produces the same state with detached storage', () => {
  const reference = memory(),
    live = memory();
  // Two empty object lists and three room lists: one plain box, then two empty lists.
  for (const mem of [reference, live]) {
    mem.write16(WRAM + 0x77, 0x5000);
    mem.write8(WRAM + 0x79, 0x7e);
    mem.write16(WRAM + 0x9a, 0x5100);
    mem.write8(WRAM + 0x9c, 0x7e);
    mem.write8(WRAM + 0x5100, 1);
    for (const [i, value] of [10, 20, 0, 30, 40, 5].entries())
      mem.write16(WRAM + 0x5101 + i * 2, value);
  }
  const table = detachCollisionStorage(live.wram);
  buildCollisionGrid(reference, reference.wram);
  buildCollisionGrid(live, live.wram);
  assert.equal(table.x0[0], 10);
  assert.equal(table.staticBoxEnd[0], 12);
  assert.equal(table.staticNodeEnd[0], 2);
  assert.equal(live.wram[COLLISION_FIELDS.x0.base], 0);
  assert.deepEqual(toWram(live), reference.wram);
});
