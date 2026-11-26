import test from 'node:test';
import assert from 'node:assert/strict';
import { newPicture, writeRegisters, oamBytes, frameOf, pixel } from './picture-fixture.mjs';

// VRAM read ports (PDF 121-122, 135) and OBJ rules (Book I chapters 19-20, PDF 89-91)
// on the register interface of the picture back end.

test('VRAM dummy and alternating read ports reproduce the buffered word sequence', () => {
  const p = newPicture();
  writeRegisters(p, [
    [0x2100, 128],
    [0x2115, 128],
  ]);
  p.vram.set([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc]);
  writeRegisters(p, [
    [0x2116, 0],
    [0x2117, 0],
  ]);
  assert.equal(p.readVram(0x213a), 0x34);
  assert.equal(p.vramAddress, 1);
  assert.deepEqual(
    [p.readVram(0x2139), p.readVram(0x213a), p.readVram(0x2139), p.readVram(0x213a)],
    [0x12, 0x34, 0x56, 0x78],
  );
  assert.equal(p.vramAddress, 3);
});
function fixture() {
  const p = newPicture();
  writeRegisters(p, [
    [0x2100, 15],
    [0x2101, 0],
    [0x2103, 0],
    [0x2105, 1],
    [0x2106, 0],
    [0x2107, 0x40],
    [0x210b, 1],
    [0x212c, 17],
    [0x212e, 0],
    [0x2130, 0x30],
    [0x2131, 0],
    [0x2133, 0],
  ]);
  for (let port = 0x210d; port <= 0x210e; port++)
    writeRegisters(p, [
      [port, 0],
      [port, 0],
    ]);
  p.sprites.y.fill(240);
  // The OAM bytes as a writable view of the sprite fields.
  Object.defineProperty(p, 'oam', { value: oamBytes(p) });
  return p;
}
test('OBJ selection precedes BG priority, with negative X, H/V flip and upper name table', () => {
  const p = fixture();
  p.cgram[258] = 31;
  p.cgram[290] = 0;
  p.cgram[291] = 0x7c;
  p.oam.set([0, 0, 0, 0x30, 0, 0, 1, 0x32]);
  p.vram[0] = 0x80;
  p.vram[32] = 0x80;
  assert.deepEqual(pixel(frameOf(p), 0, 0), [255, 0, 0, 255]);
  p.vram[0] = 0;
  assert.deepEqual(pixel(frameOf(p), 0, 0), [0, 0, 255, 255]);
  p.vram[0] = 0x80;
  // Lower OAM number wins even when its BG priority is lower.
  p.oam[3] = 0;
  p.vram[0x2002] = 0x80;
  p.cgram[2] = 0xe0;
  p.cgram[3] = 3;
  assert.deepEqual(pixel(frameOf(p), 0, 0), [0, 255, 0, 255]);
  p.writeRegister(0x212c, 16);
  p.oam[3] = 0xf0;
  assert.deepEqual(pixel(frameOf(p), 7, 7), [255, 0, 0, 255]);
  p.oam[0] = 255;
  p.oam[512] = 1;
  p.oam[3] = 0x30;
  p.vram[0] = 0x40;
  assert.deepEqual(pixel(frameOf(p), 0, 0), [255, 0, 0, 255]);
  p.oam[0] = 0;
  p.oam[512] = 0;
  p.oam[3] = 0x31;
  p.vram[8192] = 0x80;
  assert.deepEqual(pixel(frameOf(p), 0, 0), [255, 0, 0, 255]);
  p.writeRegister(0x2103, 128);
  assert.throws(() => frameOf(p), /picture_obj_rotation_required/);
});
test('large-tile row or column wrap', () => {
  const p = fixture();
  p.writeRegister(0x212c, 16);
  p.writeRegister(0x2101, 0);
  p.oam[512] = 2;
  p.oam[0] = p.oam[1] = 0;
  p.oam[2] = 15;
  p.oam[3] = 0x30;
  p.cgram[258] = 31;
  p.vram[0] = 0x80;
  p.vram[31 * 32] = 0x80;
  const frame = frameOf(p);
  assert.deepEqual(pixel(frame, 8, 0), [255, 0, 0, 255]);
  assert.deepEqual(pixel(frame, 0, 8), [255, 0, 0, 255]);
});
// Book I chapter 20 (PDF 91): 32 OBJ per line by smaller OBJ number; at most
// 34 on-screen 8x8 tiles, taken from the larger OBJ numbers down.
test('OBJ line limits: 33rd OBJ and tiles beyond 34 are not displayed', () => {
  const red = [255, 0, 0, 255],
    black = [0, 0, 0, 255];
  const p = fixture();
  p.writeRegister(0x212c, 16);
  p.writeRegister(0x2101, 0);
  p.cgram[258] = 31;
  p.vram[0] = 0x80;
  // OBJ 0-31 in range with a transparent tile, OBJ 32 opaque at (0,0).
  for (let n = 0; n < 33; n++) {
    p.oam[n * 4] = n < 32 ? 100 : 0;
    p.oam[n * 4 + 1] = 0;
    p.oam[n * 4 + 2] = n < 32 ? 1 : 0;
    p.oam[n * 4 + 3] = 0x30;
  }
  assert.deepEqual(pixel(frameOf(p), 0, 0), black, '33rd OBJ in range');
  p.oam[1] = 224;
  assert.deepEqual(pixel(frameOf(p), 0, 0), red, '32 OBJ in range');
  // 32x32/64x64: OBJ 1-4 (64 wide, transparent) 32 tiles, OBJ 5 at x 240 two tiles.
  for (let n = 0; n < 128; n++) p.oam[n * 4 + 1] = 224;
  p.oam.fill(0, 512);
  p.writeRegister(0x2101, 0xa0);
  for (let n = 0; n < 6; n++) {
    p.oam[n * 4] = n === 5 ? 240 : 0;
    p.oam[n * 4 + 1] = 0;
    p.oam[n * 4 + 2] = n ? 0x20 : 0;
    p.oam[n * 4 + 3] = 0x30;
    if (n && n < 5) p.oam[512 + (n >>> 2)] |= 2 << ((n & 3) * 2);
  }
  assert.deepEqual(pixel(frameOf(p), 0, 0), black, 'OBJ 0 beyond 34 tiles');
  // Without OBJ 5, OBJ 0 (32 wide) gets two of its four tiles: the model keeps the
  // leftmost on-screen tiles in screen order (Mesen2 comparison, docs/PPU-ROOM.md).
  p.oam[21] = 224;
  assert.deepEqual(pixel(frameOf(p), 0, 0), red, 'partial OBJ left tile');
  // H flip: screen x 0 shows character column 3 (VRAM 96, last pixel); x 31 (column 0) is not loaded.
  p.oam[3] |= 0x40;
  assert.deepEqual(pixel(frameOf(p), 31, 0), black, 'flipped right tile dropped');
  p.vram[96] = 1;
  assert.deepEqual(pixel(frameOf(p), 0, 0), red, 'flipped left tile kept');
});
