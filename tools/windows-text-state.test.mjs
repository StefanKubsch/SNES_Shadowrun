import test from 'node:test';
import assert from 'node:assert/strict';
import { VmMemory, ROM_SIZE } from '../src/vm/memory.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { WINDOW_TEXT_FIELDS, windowsText, detachWindowsText } from '../src/state/windows-text.mjs';
import { CAMERA_MAP_FIELDS, detachCameraMaps } from '../src/state/camera-maps.mjs';
import { COLLISION_FIELDS } from '../src/state/collision.mjs';
import { OBJECT_FIELDS, OBJECT_SLOTS, writeStateByte } from '../src/state/objects.mjs';
import { toWram, restoreWram } from './to-wram.mjs';
import { newPicture, setLiveChannels } from './picture-fixture.mjs';
import { pictureState } from './lift-function-harness.mjs';
import { drawWindow } from '../src/game/window-list.mjs';
import { clearTextTiles } from '../src/game/game-nmi.mjs';
import { readBit } from '../src/game/text-print.mjs';
import * as W from '../src/data/wram.mjs';

const WRAM = 0x7e0000;
const memory = () => new VmMemory(new Uint8Array(ROM_SIZE));

test('window, text and menu fields import and project every entry without overlapping other owners', () => {
  const mem = memory();
  mem.wram.fill(0xa5);
  const before = mem.wram.slice(),
    table = detachWindowsText(mem.wram),
    occupied = new Set();
  for (const base of Object.values(OBJECT_FIELDS))
    for (let i = 0; i < OBJECT_SLOTS * 2; i++) occupied.add(base + i);
  for (const { base, count, stride } of Object.values(COLLISION_FIELDS))
    for (let i = 0; i < count; i++) for (let n = 0; n < 2; n++) occupied.add(base + i * stride + n);
  for (const { base, count, bytes } of Object.values(CAMERA_MAP_FIELDS))
    for (let i = 0; i < count * bytes; i++) occupied.add(base + i);
  for (const [name, { base, count, bytes }] of Object.entries(WINDOW_TEXT_FIELDS)) {
    assert.notEqual(table[name].buffer, mem.wram.buffer);
    for (let i = 0; i < count; i++) {
      assert.equal(table[name][i], bytes === 1 ? 0xa5 : 0xa5a5);
      table[name][i] = (0x1234 + i) & (bytes === 1 ? 0xff : 0xffff);
      for (let n = 0; n < bytes; n++) {
        const at = base + i * bytes + n;
        assert.equal(occupied.has(at), false, name + ':' + at.toString(16));
        occupied.add(at);
        assert.equal(mem.read8(WRAM + at), (table[name][i] >>> (n * 8)) & 0xff);
      }
    }
  }
  const snapshot = toWram(mem),
    target = memory();
  assert.deepEqual(mem.wram, before);
  assert.equal(detachWindowsText(mem.wram), table);
  detachWindowsText(target.wram);
  restoreWram(target, snapshot);
  assert.deepEqual(toWram(target), snapshot);
  assert.throws(() => restoreWram(target, new Uint8Array(1)), /wram_snapshot_size_required/);
  assert.deepEqual(toWram(target), snapshot);
});

test('menu lists, spell overlays, portrait edges and action overrides share one owner', () => {
  const mem = memory(),
    maps = detachCameraMaps(mem.wram),
    table = detachWindowsText(mem.wram);
  for (const [at, name, index] of [
    [W.KARMA_ROW_NAMES, 'listNames', 1],
    [W.KARMA_ROW_INDICES, 'listIndices', 1],
    [W.SPELL_MENU_LEVELS, 'listIndices', 8],
    [W.SPELL_MENU_LEADER_SCRIPTS, 'listIndices', 16],
    [W.SPELL_MENU_LEVEL_POINTERS, 'listIndices', 24],
    [W.KARMA_ROW_VALUES, 'listValues', 1],
    [W.STATUS_SUBMENU_WINDOW, 'menuWindows', 2],
    [W.ACTION_MENU_OVERRIDE, 'actionFlags', 7],
  ]) {
    mem.write16(WRAM + at, 0x1234);
    assert.equal(table[name][index], 0x1234);
    assert.equal(mem.read16(WRAM + at), 0x1234);
    assert.equal(mem.wram[at], 0);
  }
  mem.write16(WRAM + W.PORTRAIT_WINDOW_LEFT, 0x5678);
  assert.equal(table.portraitHdma[4], 0x78);
  assert.equal(table.portraitHdma[5], 0x56);
  // An odd word crosses the last list name into its first index word.
  mem.write16(WRAM + W.ITEM_MENU_ACTORS - 1, 0xabcd);
  assert.equal(table.listNames.at(-1), 0xcd00);
  assert.equal(table.listIndices[0], 0xab);
  // Low mirrors end at 2000, while the window fields start in full WRAM.
  mem.write16(0x800000 + W.MENU_SELECTION, 0x7654);
  assert.equal(table.selection[0], 0x7654);
  assert.equal(writeStateByte(mem.wram, W.TEXT_BUFFER, 0x156), 0x156);
  assert.equal(table.text[0], 0x56);
  mem.write16(WRAM + W.TEXT_MASK_BUFFER - 1, 0x9abc);
  assert.equal(table.map.at(-1), 0xbc00);
  assert.equal(table.mask[0], 0x9a);
  mem.write16(WRAM + W.MAP_ROW_BG1 - 1, 0x1122);
  assert.equal(table.mask.at(-1), 0x22);
  assert.equal(maps.rowBg1[0], 0x11);
  assert.equal(mem.wram[W.MAP_ROW_BG1], 0);
});

for (const index of [0, 0x1e])
  test('window border and text map drawing use detached fields at index ' + index, () => {
    const reference = memory(),
      live = memory();
    for (const [at, value] of [
      [W.WINDOW_MAP_OFFSET, 0x84],
      [W.WINDOW_COLUMNS, 5],
      [W.WINDOW_ROWS, 4],
      [W.WINDOW_ATTRIBUTES, 0x800],
      [W.WINDOW_TILE_INITIAL, 0x2030],
      [W.WINDOW_TILE_START, 0x2030],
      [W.WINDOW_TILE_COUNT, 3],
    ])
      reference.write16(WRAM + at + index, value);
    live.wram.set(reference.wram);
    detachWindowsText(live.wram);
    const before = live.wram.slice();
    drawWindow(reference.wram, index);
    drawWindow(live.wram, index);
    assert.deepEqual(toWram(live), reference.wram);
    assert.deepEqual(
      live.wram.subarray(W.WINDOW_MAP_OFFSET, W.SAVE_STATE_START),
      before.subarray(W.WINDOW_MAP_OFFSET, W.SAVE_STATE_START),
    );
  });

for (const bytes of [0x20, 0x1400, 0x1402])
  test('text DMA request consumption preserves detached requests for byte count ' + bytes, () => {
    const reference = memory(),
      live = memory(),
      calls = [];
    for (const [at, value] of [
      [W.TEXT_TILE_UPLOAD, 1],
      [W.TEXT_MAP_UPLOAD, 1],
      [W.TEXT_BUFFER_UPLOAD, 1],
      [W.TEXT_BUFFER_READBACK, 1],
      [W.TEXT_TILE_UPLOAD_BYTES, bytes],
      [W.TEXT_TILE_UPLOAD_ADDRESS, 0x5000],
      [W.TEXT_BUFFER_BYTES, 0x40],
      [W.TEXT_BUFFER_VRAM_ADDRESS, 0x6000],
    ])
      reference.write16(WRAM + at, value);
    live.wram.set(reference.wram);
    detachWindowsText(live.wram);
    const before = live.wram.slice();
    for (const mem of [reference, live]) {
      // The clear and read-back as the picture and WRAM they leave.
      const picture = setLiveChannels(newPicture(mem));
      clearTextTiles(mem.wram, picture);
      calls.push(pictureState(picture));
    }
    assert.deepEqual(calls[1], calls[0]);
    assert.deepEqual(toWram(live), reference.wram);
    assert.deepEqual(live.wram, before);
  });

test('text bit refills and exhaustion read independent decoder state', () => {
  const reference = memory(),
    live = memory();
  // Read source bytes through WRAM to also exercise an indirect native source.
  reference.write16(WRAM + W.TEXT_BUFFER, 0x815a);
  reference.write16(W.TEXT_SOURCE_POINTER, W.TEXT_BUFFER);
  reference.write8(W.TEXT_SOURCE_BANK, 0x7e);
  live.wram.set(reference.wram);
  detachWindowsText(live.wram);
  const before = live.wram.slice();
  for (let i = 0; i < 32; i++)
    assert.deepEqual(readBit(live, live.wram), readBit(reference, reference.wram));
  assert.deepEqual(toWram(live), reference.wram);
  assert.deepEqual(
    live.wram.subarray(W.TEXT_BITS_REMAINING, W.TEXT_BIT_BUFFER + 2),
    before.subarray(W.TEXT_BITS_REMAINING, W.TEXT_BIT_BUFFER + 2),
  );
});

test('only the normal live loop detaches windows, text and menus', () => {
  const mem = memory();
  assert.equal(windowsText(mem.wram), undefined);
  mem.write16(WRAM + W.WINDOW_COLUMNS, 0x1234);
  assert.equal(mem.wram[W.WINDOW_COLUMNS], 0x34);
  assert.deepEqual(toWram(mem), mem.wram);
  const game = new LiveGame(new Uint8Array(ROM_SIZE));
  windowsText(game.memory.wram).columns[0] = 0x1234;
  assert.equal(game.memory.read16(WRAM + W.WINDOW_COLUMNS), 0x1234);
  assert.equal(game.memory.wram[W.WINDOW_COLUMNS], 0);
});
