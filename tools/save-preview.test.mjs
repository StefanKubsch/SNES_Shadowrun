import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SavePreview,
  PREVIEW_WIDTH,
  PREVIEW_HEIGHT,
  encodeSavePreview,
  previewRoomKeys,
} from '../src/browser/save-preview.mjs';
import { SCREEN_WIDTH, SCREEN_HEIGHT, RGBA_BYTES } from '../src/constants/ppu.mjs';
import { ROOM, WINDOW_LAST_INDEX, GLOVE_KIND, SCENE_REQUEST, TIMER } from '../src/data/wram.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory, SRAM_SIZE } from '../src/vm/memory.mjs';
import { SaveWatch } from '../src/browser/save-file.mjs';
import { saveGame } from '../src/game/save-slots.mjs';

test('completed identical saves notify once after a stable frame through the actual save routine', () => {
  const memory = new VmMemory(
      cartridge.rom,
      undefined,
      new Uint8Array(SRAM_SIZE),
      cartridge.present,
    ),
    watch = new SaveWatch(memory.sram);
  memory.onSaveSlot = (slot) => watch.request(slot);
  saveGame(memory, 0, false);
  assert.equal(watch.check(), null);
  const first = watch.check();
  assert.ok(first);
  assert.deepEqual(watch.completedSlots, [0]);
  assert.equal(watch.check(), null);
  saveGame(memory, 0, false);
  assert.equal(watch.check(), null);
  assert.deepEqual(watch.check(), first, 'byte-identical second save still reaches the page');
  assert.deepEqual(watch.completedSlots, [0]);
  assert.equal(watch.check(), null);
});

function fixture() {
  const wram = new Uint8Array(0x20000),
    view = new DataView(wram.buffer),
    set = (at, value) => view.setUint16(at, value, true),
    game = { memory: { wram }, controlNmi: 10, nmis: 10, choosing: false },
    pixels = new Uint8ClampedArray(SCREEN_WIDTH * SCREEN_HEIGHT * RGBA_BYTES);
  set(ROOM, 345);
  set(WINDOW_LAST_INDEX, 0xfffe);
  set(SCENE_REQUEST, 0xffff);
  set(TIMER, 0xffff);
  for (let i = 0; i < pixels.length; i++) pixels[i] = i % 251;
  return { game, pixels, set };
}

test('the preview downsamples raw RGBA without changing or retaining transferred frame buffers', () => {
  const { game, pixels } = fixture(),
    preview = new SavePreview(),
    before = pixels.slice();
  assert.equal(preview.take(), null);
  preview.observe(game, pixels);
  const result = preview.take();
  assert.equal(result.room, 345);
  assert.equal(result.pixels.length, PREVIEW_WIDTH * PREVIEW_HEIGHT * RGBA_BYTES);
  for (let y = 0; y < PREVIEW_HEIGHT; y++)
    for (let x = 0; x < PREVIEW_WIDTH; x++) {
      const from = (y * 2 * SCREEN_WIDTH + x * 2) * RGBA_BYTES,
        to = (y * PREVIEW_WIDTH + x) * RGBA_BYTES;
      assert.deepEqual(
        result.pixels.subarray(to, to + RGBA_BYTES),
        pixels.subarray(from, from + RGBA_BYTES),
      );
    }
  assert.deepEqual(pixels, before);
  structuredClone(pixels, { transfer: [pixels.buffer] });
  result.pixels.fill(0);
  assert.notDeepEqual(preview.take().pixels, result.pixels);
});

test('menus, glove, target choice and loss of control retain the earlier room image', () => {
  for (const block of [
    ({ set }) => set(WINDOW_LAST_INDEX, 0),
    ({ set }) => set(GLOVE_KIND, 0xffff),
    ({ game }) => {
      game.choosing = true;
    },
    ({ game }) => {
      game.nmis += 5;
    },
    ({ set }) => set(SCENE_REQUEST, 0x7fff),
  ]) {
    const f = fixture(),
      preview = new SavePreview();
    preview.observe(f.game, f.pixels);
    const clean = preview.take();
    block(f);
    f.pixels.fill(0);
    preview.observe(f.game, f.pixels);
    assert.deepEqual(preview.take(), clean);
  }
});

test('a different room discards the earlier image even when its first frame is a dialog', () => {
  const { game, pixels, set } = fixture(),
    preview = new SavePreview();
  preview.observe(game, pixels);
  set(ROOM, 346);
  set(WINDOW_LAST_INDEX, 0);
  preview.observe(game, pixels);
  assert.equal(preview.take(), null);
  set(WINDOW_LAST_INDEX, 0xfffe);
  preview.observe(game, pixels);
  assert.equal(preview.take().room, 346);
});

test('the bed return can use the matching earlier view, with only two recent rooms retained', () => {
  const { game, pixels, set } = fixture(),
    preview = new SavePreview();
  preview.observe(game, pixels);
  const apartment = preview.take();
  set(ROOM, 347);
  pixels.fill(0);
  preview.observe(game, pixels);
  set(ROOM, 345);
  set(WINDOW_LAST_INDEX, 0);
  preview.observe(game, pixels);
  assert.deepEqual(preview.take(), apartment);
  set(WINDOW_LAST_INDEX, 0xfffe);
  for (const room of [348, 349]) {
    set(ROOM, room);
    preview.observe(game, pixels);
  }
  set(ROOM, 345);
  set(WINDOW_LAST_INDEX, 0);
  preview.observe(game, pixels);
  assert.equal(preview.take(), null);
});

test('the reported bed save entry 170 reuses the same room view captured through entry 335', () => {
  const memory = new VmMemory(cartridge.rom, undefined, null, cartridge.present),
    keys = previewRoomKeys((at) => memory.read8(at)),
    { game, pixels, set } = fixture(),
    preview = new SavePreview(keys);
  assert.equal(keys[170], keys[335], 'original room table entries share the same header');
  assert.notEqual(keys[170], keys[171]);
  set(ROOM, 335);
  preview.observe(game, pixels);
  const original = preview.take();
  set(ROOM, 171);
  pixels.fill(0);
  preview.observe(game, pixels);
  set(ROOM, 170);
  set(WINDOW_LAST_INDEX, 0);
  preview.observe(game, pixels);
  assert.equal(preview.take(170).room, 170, 'notification uses the saved entrance entry');
  assert.deepEqual(preview.take(170).pixels, original.pixels);
  assert.notDeepEqual(preview.take(171).pixels, original.pixels);
  assert.equal(preview.take(keys.length), null, 'invalid entries cannot borrow a picture');
});

test('missing captures and unavailable canvas encoding do not block saving', () => {
  assert.equal(encodeSavePreview(null, {}), null);
  assert.equal(encodeSavePreview({ pixels: new Uint8Array(1) }, {}), null);
  assert.equal(
    encodeSavePreview(
      { pixels: new Uint8ClampedArray(PREVIEW_WIDTH * PREVIEW_HEIGHT * RGBA_BYTES) },
      {
        createElement() {
          throw Error('unavailable');
        },
      },
    ),
    null,
  );
});
