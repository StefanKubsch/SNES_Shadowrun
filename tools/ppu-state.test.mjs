import test from 'node:test';
import assert from 'node:assert/strict';
import { newPicture, writeRegisters, frameOf, pixel } from './picture-fixture.mjs';

// Synthetic fixtures check the manual's port/bitplane contracts only (Book I chapter
// 27: 2115-2119 PDF 121-122, 2121-2122 PDF 125, DMA PDF 143 and 149-152), on the
// register interface of the picture back end. The separate boot-logo-browser test
// establishes actual cold original evidence.
test('VRAM word wrap and CGRAM byte pairs keep byte order', () => {
  const p = newPicture();
  writeRegisters(p, [
    [0x2100, 0x80],
    [0x2115, 0x80],
    [0x2116, 255],
    [0x2117, 255],
    [0x2118, 0x12],
    [0x2119, 0x34],
  ]);
  assert.equal(p.vramAddress, 0);
  assert.deepEqual(Array.from(p.vram.subarray(65534)), [0x12, 0x34]);
  writeRegisters(p, [
    [0x2121, 255],
    [0x2122, 0x56],
  ]);
  assert.equal(p.palette[255], 0, 'the low byte waits for its high byte');
  p.writeRegister(0x2122, 0xff);
  assert.deepEqual(Array.from(p.cgram.subarray(510)), [0x56, 0x7f]);
  assert.equal(p.colourIndex, 0);
  p.writeRegister(0x2115, 4);
  assert.throws(() => p.writeRegister(0x2118, 0), /picture_vram_remap_required/);
});
test('DMA with a fixed source and zero byte count copies all 65536 bytes from memory', () => {
  let reads = 0;
  const p = newPicture({
    read8(address) {
      assert.equal(address, 0x808000);
      reads++;
      return 0x5a;
    },
  });
  writeRegisters(p, [
    [0x2100, 128],
    [0x2115, 128],
    [0x2116, 0],
    [0x2117, 0],
  ]);
  [9, 0x18, 0, 0x80, 0x80, 0, 0].forEach((value, n) => p.write(0x123456, 0x804300 + n, value, 1));
  p.write(0x123456, 0x80420b, 1, 1);
  assert.equal(reads, 65536);
  assert.ok(p.vram.every((v) => v === 0x5a));
  assert.equal(p.vramAddress, 0x8000);
  const c = p.channels[0];
  assert.deepEqual([c.source, c.bank, c.bytes], [0x8000, 0x80, 0]);
});
function fixture() {
  const p = newPicture();
  writeRegisters(p, [
    [0x2100, 15],
    [0x2105, 1],
    [0x2106, 0],
    [0x2107, 0],
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
  return p;
}
test('mode 1 bitplanes use the manual BG row origin, tile flips and BG priority', () => {
  const p = fixture();
  p.vram[0x2002] = 0x80;
  p.cgram[2] = 31;
  let frame = frameOf(p);
  assert.deepEqual(pixel(frame, 0, 0), [255, 0, 0, 255]);
  assert.deepEqual(pixel(frame, 1, 0), [0, 0, 0, 255]);
  p.vram[1] = 0xc0;
  frame = frameOf(p);
  assert.deepEqual(pixel(frame, 7, 5), [255, 0, 0, 255]);
  assert.deepEqual(pixel(frame, 0, 0), [0, 0, 0, 255]);
  p.vram[1] = 0;
  p.vram[0x4002] = 0x80;
  p.vram[0x801] = 0x24;
  p.cgram[35] = 0x7c;
  p.writeRegister(0x212c, 3);
  assert.deepEqual(pixel(frameOf(p), 0, 0), [0, 0, 255, 255]);
  p.vram[0x801] = 4;
  assert.deepEqual(pixel(frameOf(p), 0, 0), [255, 0, 0, 255]);
});
