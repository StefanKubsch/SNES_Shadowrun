import test from 'node:test';
import assert from 'node:assert/strict';
import { PpuState } from '../src/video/ppu-state.mjs';
import { renderMode1Frame } from '../src/video/ppu-frame.mjs';

const pixel = (frame, x, y) => Array.from(frame.subarray((y * 256 + x) * 4, (y * 256 + x) * 4 + 4));
function fixture({ mode = 0x11, sc = 0x00, h = 0, v = 0 } = {}) {
  const p = new PpuState();
  for (const name of ['vramKnown', 'cgramKnown', 'oamKnown']) p[name].fill(1);
  for (const [port, value] of [
    [0x2100, 15],
    [0x2105, mode],
    [0x2106, 0],
    [0x2107, sc],
    [0x2108, 4],
    [0x210b, 0x21],
    [0x212c, 1],
    [0x212e, 0],
    [0x2130, 0x30],
    [0x2131, 0],
    [0x2133, 0],
  ])
    p.writeByte(port, value);
  for (let port = 0x210d; port <= 0x2110; port++) {
    p.writeByte(port, 0);
    p.writeByte(port, 0);
  }
  if (h) {
    p.writeByte(0x210d, h & 255);
    p.writeByte(0x210d, h >>> 8);
  }
  if (v) {
    p.writeByte(0x210e, v & 255);
    p.writeByte(0x210e, v >>> 8);
  }
  return p;
}
function tile(p, name, plane) {
  const at = 0x2000 + name * 32;
  for (let y = 0; y < 8; y++) p.vram[at + y * 2 + (plane >>> 1) * 16 + (plane & 1)] = 0xff;
}
function color(p, n, value) {
  p.cgram[n * 2] = value & 255;
  p.cgram[n * 2 + 1] = value >>> 8;
}

test('16x16 BG cells select N, N+1, N+16 and N+17 with all four planes and palette', () => {
  const p = fixture();
  [0, 1, 16, 17].forEach((n, i) => tile(p, n, i));
  [31, 31 << 5, 31 << 10, 31 | (31 << 5) | (31 << 10)].forEach((c, i) =>
    color(p, 32 + (1 << i), c),
  );
  p.vram[0] = 0;
  p.vram[1] = 0x08; // palette 2
  const frame = renderMode1Frame(p);
  assert.deepEqual(pixel(frame, 0, 0), [255, 0, 0, 255]);
  assert.deepEqual(pixel(frame, 8, 0), [0, 255, 0, 255]);
  assert.deepEqual(pixel(frame, 0, 8), [0, 0, 255, 255]);
  assert.deepEqual(pixel(frame, 8, 8), [255, 255, 255, 255]);
});

test('16x16 name flips, 32/64-cell maps, scroll boundaries and ten-bit name wrap', () => {
  const scrolls = [8, 16, 511, 512, 1023],
    paletteColors = [31, 31 << 5, 31 << 10, 31 | (31 << 5)];
  for (const mapWidth of [32, 64])
    for (const mapHeight of [32, 64])
      for (const scroll of scrolls) {
        const p = fixture({
          sc: (mapWidth === 64 ? 1 : 0) | (mapHeight === 64 ? 2 : 0),
          h: scroll,
          v: scroll,
        });
        for (let y = 0; y < mapHeight; y++)
          for (let x = 0; x < mapWidth; x++) {
            const across = mapWidth === 64 ? 2 : 1,
              base = (y >>> 5) * across * 2048 + (y & 31) * 64 + (x >>> 5) * 2048 + (x & 31) * 2,
              palette = (x >= 32 ? 1 : 0) | (y >= 32 ? 2 : 0);
            p.vram[base] = 0;
            p.vram[base + 1] = palette << 2;
          }
        for (const name of [0, 1, 16, 17]) tile(p, name, 0);
        paletteColors.forEach((value, palette) => color(p, palette * 16 + 1, value));
        const mapX = Math.floor((scroll % (mapWidth * 16)) / 16),
          mapY = Math.floor(((scroll + 1) % (mapHeight * 16)) / 16),
          palette = (mapX >= 32 ? 1 : 0) | (mapY >= 32 ? 2 : 0),
          value = paletteColors[palette],
          expected = [value & 31, (value >>> 5) & 31, (value >>> 10) & 31].map(
            (component) => (component << 3) | (component >>> 2),
          );
        assert.deepEqual(
          pixel(renderMode1Frame(p), 0, 0),
          [...expected, 255],
          `${mapWidth}x${mapHeight}-cell map at scroll ${scroll}`,
        );
      }
});

test('horizontal and vertical flips reverse all 16x16 subtile quadrants across name 1023 wrap', () => {
  const p = fixture();
  [1023, 0, 15, 16].forEach((name, plane) => tile(p, name, plane));
  [31, 31 << 5, 31 << 10, 31 | (31 << 5) | (31 << 10)].forEach((value, plane) =>
    color(p, 16 + (1 << plane), value),
  );
  p.vram[0] = 0xff;
  p.vram[1] = 0xc7; // name 1023, palette 1, both flips
  const frame = renderMode1Frame(p);
  assert.deepEqual(pixel(frame, 0, 0), [255, 255, 255, 255]); // N+17 wraps to 16
  assert.deepEqual(pixel(frame, 8, 0), [0, 0, 255, 255]); // N+16 wraps to 15
  assert.deepEqual(pixel(frame, 0, 8), [0, 255, 0, 255]); // N+1 wraps to 0
  assert.deepEqual(pixel(frame, 8, 8), [255, 0, 0, 255]); // N remains 1023
});

test('per-row BG map base and size writes persist across following rows without changing PPU state', () => {
  const p = fixture({ mode: 0x11 });
  p.vram[0] = 1; // default name 1 at base 0
  p.vram[0x800] = 2; // switched name 2 at base 0x800
  tile(p, 1, 0);
  tile(p, 2, 1);
  color(p, 1, 31);
  color(p, 2, 31 << 5);
  const original = p.register(0x2107),
    rows = Array.from({ length: 224 }, () => []);
  rows[0] = [0x2107, 0x05]; // 64x32 map and alternate base
  rows[2] = [0x2107, original];
  const frame = renderMode1Frame(p, { rows });
  assert.deepEqual(pixel(frame, 0, 0), [0, 255, 0, 255]);
  assert.deepEqual(pixel(frame, 0, 1), [0, 255, 0, 255], 'row state carries forward');
  assert.deepEqual(pixel(frame, 0, 2), [255, 0, 0, 255], 'later row restores original map');
  assert.equal(p.register(0x2107), original, 'rendering leaves PPU register state untouched');
});

test('8x8 mode 1 remains supported and non-mode-1 modes remain rejected', () => {
  const p = fixture({ mode: 1 });
  p.vram[0x2002] = 0x80;
  color(p, 1, 31);
  assert.deepEqual(pixel(renderMode1Frame(p), 0, 0), [255, 0, 0, 255]);
  p.writeByte(0x2105, 0);
  assert.throws(() => renderMode1Frame(p), /ppu_mode1_required/);
});
