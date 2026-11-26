import test from 'node:test';
import assert from 'node:assert/strict';
import { flatMemory, newPicture, writeRegisters, frameOf, pixel } from './picture-fixture.mjs';

// Large BG cells (Book I chapter 5 and 2105/2107, PDF 116-118) on the register
// interface of the picture back end.
const HDMA_TABLE = 0x7e1f3f;
function fixture({ mode = 0x11, sc = 0x00, h = 0, v = 0, memory } = {}) {
  const p = newPicture(memory);
  writeRegisters(p, [
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
  ]);
  for (let port = 0x210d; port <= 0x2110; port++)
    writeRegisters(p, [
      [port, 0],
      [port, 0],
    ]);
  if (h)
    writeRegisters(p, [
      [0x210d, h & 255],
      [0x210d, h >>> 8],
    ]);
  if (v)
    writeRegisters(p, [
      [0x210e, v & 255],
      [0x210e, v >>> 8],
    ]);
  return p;
}
function tile(p, name, plane) {
  const at = 0x2000 + name * 32;
  for (let y = 0; y < 8; y++) p.vram[at + y * 2 + (plane >>> 1) * 16 + (plane & 1)] = 0xff;
}
function color(p, n, value) {
  p.palette[n] = value;
}

test('16x16 BG cells select N, N+1, N+16 and N+17 with all four planes and palette', () => {
  const p = fixture();
  [0, 1, 16, 17].forEach((n, i) => tile(p, n, i));
  [31, 31 << 5, 31 << 10, 31 | (31 << 5) | (31 << 10)].forEach((c, i) =>
    color(p, 32 + (1 << i), c),
  );
  p.vram[0] = 0;
  p.vram[1] = 0x08; // palette 2
  const frame = frameOf(p);
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
          pixel(frameOf(p), 0, 0),
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
  const frame = frameOf(p);
  assert.deepEqual(pixel(frame, 0, 0), [255, 255, 255, 255]); // N+17 wraps to 16
  assert.deepEqual(pixel(frame, 8, 0), [0, 0, 255, 255]); // N+16 wraps to 15
  assert.deepEqual(pixel(frame, 0, 8), [0, 255, 0, 255]); // N+1 wraps to 0
  assert.deepEqual(pixel(frame, 8, 8), [255, 0, 0, 255]); // N remains 1023
});

// H-DMA mode 0 to BG1SC (Appendix B-2, PDF 220): row 0 switches to the 64x32 map at
// 0x800, row 2 restores the original.
test('per-row BG map base and size writes persist across following rows without changing the picture state', () => {
  const memory = flatMemory();
  const p = fixture({ mode: 0x11, memory });
  p.vram[0] = 1; // default name 1 at base 0
  p.vram[0x800] = 2; // switched name 2 at base 0x800
  tile(p, 1, 0);
  tile(p, 2, 1);
  color(p, 1, 31);
  color(p, 2, 31 << 5);
  const original = { ...p.layers[0] };
  memory.bytes.set([2, 0x05, 1, 0x00, 0], HDMA_TABLE);
  writeRegisters(p, [
    [0x4300, 0],
    [0x4301, 0x07],
    [0x4302, HDMA_TABLE & 255],
    [0x4303, (HDMA_TABLE >>> 8) & 255],
    [0x4304, HDMA_TABLE >>> 16],
    [0x420c, 1],
  ]);
  const frame = frameOf(p);
  assert.deepEqual(pixel(frame, 0, 0), [0, 255, 0, 255]);
  assert.deepEqual(pixel(frame, 0, 1), [0, 255, 0, 255], 'row state carries forward');
  assert.deepEqual(pixel(frame, 0, 2), [255, 0, 0, 255], 'later row restores original map');
  assert.deepEqual(p.layers[0], original, 'rendering leaves the picture state untouched');
});

test('8x8 mode 1 remains supported and non-mode-1 modes remain rejected', () => {
  const p = fixture({ mode: 1 });
  p.vram[0x2002] = 0x80;
  color(p, 1, 31);
  assert.deepEqual(pixel(frameOf(p), 0, 0), [255, 0, 0, 255]);
  p.writeRegister(0x2105, 0);
  assert.throws(() => frameOf(p), /picture_mode1_required/);
});
