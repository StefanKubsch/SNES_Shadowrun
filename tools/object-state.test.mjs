import { resetScenePalettes } from '../src/game/game-screen.mjs';
import { DMAP4, BBAD4 } from '../src/constants/hardware-registers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { VmMemory, ROM_SIZE } from '../src/vm/memory.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import {
  OBJECT_FIELDS,
  OBJECT_SLOTS,
  detachObjectStorage,
  objectTable,
  objectWord,
  setObjectWord,
  objectWordIn,
  setObjectWordIn,
  longObjectWord,
  readStateByte,
  writeStateByte,
} from '../src/state/objects.mjs';
import { toWram, restoreWram } from './to-wram.mjs';
import { queueVramCopy } from '../src/matrix/matrix-runtime.mjs';
import { hideAllSprites } from '../src/system/nmi.mjs';
import { DMA_RECORD_COUNT, OAM_SHADOW } from '../src/data/wram.mjs';
import { wramHash } from '../src/browser/recording.mjs';
import { fnv1a } from '../src/data/fnv.mjs';

const WRAM = 0x7e0000,
  MIRROR = 0x800000,
  HIGH_WRAM = 0x7f0000,
  NONE = 0xffff,
  INITIAL = 0xa5,
  LOW = 0x34,
  HIGH = 0x12,
  VALUE = (HIGH << 8) | LOW;
const memory = () => new VmMemory(new Uint8Array(ROM_SIZE));

test('detached fields import once, own their bytes and project without changing either store', () => {
  const mem = memory();
  mem.wram.fill(INITIAL);
  const before = mem.wram.slice(),
    objects = detachObjectStorage(mem.wram);
  for (const [name, base] of Object.entries(OBJECT_FIELDS)) {
    assert.notEqual(objects[name].buffer, mem.wram.buffer, name);
    assert.equal(objects[name][0], (INITIAL << 8) | INITIAL, name);
    objects[name][0] = VALUE;
    objects[name][OBJECT_SLOTS - 1] = NONE;
    const projected = toWram(mem);
    assert.equal(projected[base], LOW, name);
    assert.equal(projected[base + 1], HIGH, name);
    assert.equal(projected[base + (OBJECT_SLOTS - 1) * 2], NONE & 0xff, name);
  }
  assert.deepEqual(mem.wram, before);
  assert.equal(detachObjectStorage(mem.wram), objects);
  assert.equal(objects.x[0], VALUE);
  assert.deepEqual(toWram(mem), toWram(mem));
  assert.throws(() => toWram(mem, mem.wram), /projection_destination_aliases_state/);
  assert.equal(wramHash(mem.wram), fnv1a(toWram(mem)));
});

test('byte aliases, low mirrors and odd words reach the same detached objects', () => {
  const mem = memory(),
    objects = detachObjectStorage(mem.wram),
    base = OBJECT_FIELDS.x;
  objects.x[0] = VALUE;
  assert.equal(mem.read16(WRAM + base), VALUE);
  assert.equal(mem.read16(MIRROR + base), VALUE);
  mem.write8(MIRROR + base + 1, LOW);
  assert.equal(objects.x[0], (LOW << 8) | LOW);
  setObjectWordIn(mem.wram, 'x', 1, VALUE);
  assert.equal(objects.x[0], (LOW << 8) | LOW);
  assert.equal(objects.x[1], HIGH);
  assert.equal(objectWordIn(mem.wram, 'x', 1), VALUE);
  assert.equal(mem.wram[base], 0);
});

test('none retains the data-bank alias across two fields and the distinct long-bank read', () => {
  const mem = memory(),
    objects = detachObjectStorage(mem.wram),
    base = OBJECT_FIELDS.x;
  setObjectWord(mem, 'x', NONE, VALUE);
  assert.equal(objectWord(mem, 'x', NONE), VALUE);
  assert.equal(objects.velocityZ[OBJECT_SLOTS - 1], LOW << 8);
  assert.equal(objects.x[0], HIGH);
  mem.write16(HIGH_WRAM + base - 1, NONE);
  assert.equal(longObjectWord(mem, 'x', NONE), NONE);
  assert.equal(objectWord(mem, 'x', NONE), VALUE);
});

test('matrix DMA records and frontend OAM keep their object-field overlays', () => {
  const mem = memory();
  detachObjectStorage(mem.wram);
  queueVramCopy(mem.wram, VALUE, WRAM, 0);
  assert.equal(mem.read16(WRAM + DMA_RECORD_COUNT), VALUE);
  assert.equal(mem.wram[DMA_RECORD_COUNT], 0);
  hideAllSprites(mem.wram);
  assert.equal(readStateByte(mem.wram, OAM_SHADOW + 1), 0xf0);
  assert.equal(mem.wram[OAM_SHADOW + 1], 0);
});

test('legacy proof fixtures keep identity storage until explicitly detached', () => {
  const mem = memory(),
    table = objectTable(mem.wram);
  table.x[0] = VALUE;
  assert.equal(mem.wram[OBJECT_FIELDS.x], LOW);
  assert.deepEqual(toWram(mem), mem.wram);
});

test('legacy byte assignments preserve their value when chained across stores', () => {
  const mem = memory();
  detachObjectStorage(mem.wram);
  const result = writeStateByte(mem.wram, 0, writeStateByte(mem.wram, OBJECT_FIELDS.x, VALUE));
  assert.equal(result, VALUE);
  assert.equal(mem.wram[0], LOW);
  assert.equal(objectTable(mem.wram).x[0], LOW);
});

test('scene palette setup with WRAM as data bank retains its collision-field writes', () => {
  const mem = memory();
  detachObjectStorage(mem.wram);
  resetScenePalettes(mem.wram, { write: (at, value) => writeStateByte(mem.wram, at, value) });
  const objects = objectTable(mem.wram),
    index = (DMAP4 - OBJECT_FIELDS.boxY1) / Uint16Array.BYTES_PER_ELEMENT;
  assert.equal(objects.boxY1[index], mem.read16(WRAM + DMAP4));
  assert.equal(mem.read8(WRAM + BBAD4), 0x22);
  assert.equal(mem.wram[BBAD4], 0);
});

test('the shipped live loop uses independent object storage from construction', () => {
  const game = new LiveGame(new Uint8Array(ROM_SIZE));
  setObjectWord(game.memory, 'x', 0, VALUE);
  assert.equal(game.memory.read16(WRAM + OBJECT_FIELDS.x), VALUE);
  assert.equal(game.memory.wram[OBJECT_FIELDS.x], 0);
  assert.equal(toWram(game.memory)[OBJECT_FIELDS.x], LOW);
});

test('snapshot restore imports detached fields and validates before writing', () => {
  const first = memory(),
    second = memory();
  detachObjectStorage(first.wram);
  detachObjectStorage(second.wram);
  setObjectWord(first, 'x', 0, VALUE);
  const snapshot = toWram(first);
  restoreWram(second, snapshot);
  assert.equal(objectWord(second, 'x', 0), VALUE);
  assert.deepEqual(toWram(second), snapshot);
  assert.throws(() => restoreWram(second, new Uint8Array(1)), /wram_snapshot_size_required/);
  assert.deepEqual(toWram(second), snapshot);
});
