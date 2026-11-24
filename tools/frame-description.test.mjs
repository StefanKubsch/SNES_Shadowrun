// The picture renderer draws a frame description without PPU registers
// (docs/FRAME-DESCRIPTION.md). The golden traces prove that the SNES back end's
// description renders every recorded frame unchanged; these cases pin the
// description format itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  renderFrame,
  BLANK_FRAME,
  CLIP_NEVER,
  NO_WINDOW,
  WINDOW_AREAS,
} from '../src/video/frame-renderer.mjs';
import { RGBA_BYTES, SCREEN_HEIGHT, SCREEN_WIDTH } from '../src/constants/ppu.mjs';

const VRAM_BYTES = 0x10000,
  MAX_BRIGHTNESS = 15;
// 15-bit BGR colours: pure red and pure blue.
const RED = 0x001f,
  BLUE = 0x7c00;

// A description with only a backdrop; overrides replace fields.
function frame(overrides = {}) {
  const palette = new Int32Array(256);
  palette[0] = BLUE;
  return {
    blank: false,
    brightness: MAX_BRIGHTNESS,
    main: 0,
    sub: 0,
    mainWindows: 0,
    subWindows: 0,
    windowAreas: new Array(WINDOW_AREAS).fill(NO_WINDOW),
    edges: new Int16Array(4).fill(-1),
    clip: CLIP_NEVER,
    math: null,
    palette,
    vram: new Uint8Array(VRAM_BYTES),
    layers: [],
    objects: { base: 0, gap: 0, sprites: [] },
    rows: null,
    ...overrides,
  };
}
const pixel = (pixels, x, y) => [
  ...pixels.subarray((y * SCREEN_WIDTH + x) * RGBA_BYTES, (y * SCREEN_WIDTH + x + 1) * RGBA_BYTES),
];

test('the renderer imports no PPU model or register', () => {
  const source = fs.readFileSync(
    new URL('../src/video/frame-renderer.mjs', import.meta.url),
    'utf8',
  );
  const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['../constants/bits.mjs', '../constants/ppu.mjs']);
});

test('a blank frame is opaque black', () => {
  const pixels = renderFrame(BLANK_FRAME);
  assert.equal(pixels.length, SCREEN_WIDTH * SCREEN_HEIGHT * RGBA_BYTES);
  assert.deepEqual(pixel(pixels, 0, 0), [0, 0, 0, 255]);
  assert.deepEqual(pixel(pixels, 255, 223), [0, 0, 0, 255]);
});

test('the backdrop fills a frame without layers, scaled by brightness', () => {
  assert.deepEqual(pixel(renderFrame(frame()), 17, 99), [0, 0, 255, 255]);
  // Brightness 7 of 15: component 31 becomes 14, output (14 << 3) | (14 >> 2).
  assert.deepEqual(pixel(renderFrame(frame({ brightness: 7 })), 17, 99), [0, 0, 115, 255]);
});

test('a BG layer draws its map cell and a row change scrolls it', () => {
  const vram = new Uint8Array(VRAM_BYTES),
    palette = new Int32Array(256);
  palette[0] = BLUE;
  palette[1] = RED;
  // Map at 0: the cell in column 1 of every map row names character 1 (palette 0);
  // characters from 0x1000, 2bpp: character 1, every row's plane 0 all set
  // (colour index 1). A map row has 32 two-byte cells.
  for (let row = 0; row < 32; row++) vram[row * 64 + 2] = 1;
  for (let row = 0; row < 8; row++) vram[0x1000 + 16 + row * 2] = 0xff;
  const layer = {
    layer: 0,
    base: 0,
    across: 1,
    width: 256,
    height: 256,
    chars: 0x1000,
    bpp: 2,
    large: false,
    h: 0,
    v: 0,
    low: 1,
    high: 3,
  };
  const rows = new Array(SCREEN_HEIGHT).fill(null);
  rows[100] = [['scroll', 0, 0, 8]];
  const description = frame({ main: 1, palette, vram, layers: [layer], rows });
  const pixels = renderFrame(description);
  assert.deepEqual(pixel(pixels, 7, 0), [0, 0, 255, 255]);
  assert.deepEqual(pixel(pixels, 8, 0), [255, 0, 0, 255]);
  // From row 100 on the layer is scrolled 8 pixels left.
  assert.deepEqual(pixel(pixels, 0, 100), [255, 0, 0, 255]);
  assert.deepEqual(pixel(pixels, 8, 100), [0, 0, 255, 255]);
  // Rendering leaves the description unchanged.
  assert.equal(layer.h, 0);
  assert.deepEqual(renderFrame(description), pixels);
});
