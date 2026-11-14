import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { rom } from './task-native-dialog-harness.mjs';
import { ObservedRoom, roomInterrupts } from '../proof/video/room-observed.mjs';
import { PpuState } from '../src/video/ppu-state.mjs';
import { renderMode1Frame } from '../src/video/ppu-frame.mjs';

test('room counter polls preserve both instructions and NMI occurrence', () => {
  const result = roomInterrupts([-2, 0x81eecd, 0x81eed1, 0x180fd21]);
  assert.deepEqual(
    result.map((o) => [o.pc, o.nmi]),
    [
      [0x81eecd, false],
      [0x81eed1, false],
      [0x81eecd, false],
      [0x81eed1, false],
      [0x80fd21, true],
    ],
  );
  assert.ok(Object.isFrozen(result) && result.every(Object.isFrozen));
  assert.throws(() => roomInterrupts([-1, 0x81eecd, 0x81eed2]), /room_poll_record_required/);
});
test('VRAM dummy and alternating read ports reproduce the buffered word sequence', () => {
  const p = new PpuState();
  p.writeByte(0x2100, 128);
  p.writeByte(0x2115, 128);
  p.vramKnown.fill(1);
  p.vram.set([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc]);
  p.writeByte(0x2116, 0);
  p.writeByte(0x2117, 0);
  assert.equal(p.readVram(0x213a), 0x34);
  assert.equal(p.vramAddress, 1);
  assert.deepEqual(
    [p.readVram(0x2139), p.readVram(0x213a), p.readVram(0x2139), p.readVram(0x213a)],
    [0x12, 0x34, 0x56, 0x78],
  );
  assert.equal(p.vramAddress, 3);
});
function fixture() {
  const p = new PpuState();
  for (const name of ['vramKnown', 'cgramKnown', 'oamKnown']) p[name].fill(1);
  for (const [port, value] of [
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
  ])
    p.writeByte(port, value);
  for (let port = 0x210d; port <= 0x210e; port++) {
    p.writeByte(port, 0);
    p.writeByte(port, 0);
  }
  for (let n = 0; n < 128; n++) p.oam[n * 4 + 1] = 240;
  return p;
}
const pixel = (frame, x, y) => Array.from(frame.subarray((y * 256 + x) * 4, (y * 256 + x) * 4 + 4));
test('OBJ selection precedes BG priority, with negative X, H/V flip and upper name table', () => {
  const p = fixture();
  p.cgram[258] = 31;
  p.cgram[290] = 0;
  p.cgram[291] = 0x7c;
  p.oam.set([0, 0, 0, 0x30, 0, 0, 1, 0x32]);
  p.vram[0] = 0x80;
  p.vram[32] = 0x80;
  assert.throws(() => renderMode1Frame(p), /ppu_visible_obj_source_required/);
  assert.deepEqual(pixel(renderMode1Frame(p, { objects: true }), 0, 0), [255, 0, 0, 255]);
  p.vram[0] = 0;
  assert.deepEqual(pixel(renderMode1Frame(p, { objects: true }), 0, 0), [0, 0, 255, 255]);
  p.vram[0] = 0x80;
  // Lower OAM number wins even when its BG priority is lower.
  p.oam[3] = 0;
  p.vram[0x2002] = 0x80;
  p.cgram[2] = 0xe0;
  p.cgram[3] = 3;
  assert.deepEqual(pixel(renderMode1Frame(p, { objects: true }), 0, 0), [0, 255, 0, 255]);
  p.writeByte(0x212c, 16);
  p.oam[3] = 0xf0;
  assert.deepEqual(pixel(renderMode1Frame(p, { objects: true }), 7, 7), [255, 0, 0, 255]);
  p.oam[0] = 255;
  p.oam[512] = 1;
  p.oam[3] = 0x30;
  p.vram[0] = 0x40;
  assert.deepEqual(pixel(renderMode1Frame(p, { objects: true }), 0, 0), [255, 0, 0, 255]);
  p.oam[0] = 0;
  p.oam[512] = 0;
  p.oam[3] = 0x31;
  p.vram[8192] = 0x80;
  assert.deepEqual(pixel(renderMode1Frame(p, { objects: true }), 0, 0), [255, 0, 0, 255]);
  p.writeByte(0x2103, 128);
  assert.throws(() => renderMode1Frame(p, { objects: true }), /ppu_obj_rotation_source_required/);
});
test('large-tile row or column wrap', () => {
  const p = fixture();
  p.writeByte(0x212c, 16);
  p.writeByte(0x2101, 0);
  p.oam[512] = 2;
  p.oam[0] = p.oam[1] = 0;
  p.oam[2] = 15;
  p.oam[3] = 0x30;
  p.cgram[258] = 31;
  p.vram[0] = 0x80;
  p.vram[31 * 32] = 0x80;
  const frame = renderMode1Frame(p, { objects: true });
  assert.deepEqual(pixel(frame, 8, 0), [255, 0, 0, 255]);
  assert.deepEqual(pixel(frame, 0, 8), [255, 0, 0, 255]);
});
// Book I chapter 20 (PDF 91): 32 OBJ per line by smaller OBJ number; at most
// 34 on-screen 8x8 tiles, taken from the larger OBJ numbers down.
test('OBJ line limits: 33rd OBJ and tiles beyond 34 are not displayed', () => {
  const red = [255, 0, 0, 255],
    black = [0, 0, 0, 255];
  const p = fixture();
  p.writeByte(0x212c, 16);
  p.writeByte(0x2101, 0);
  p.cgram[258] = 31;
  p.vram[0] = 0x80;
  // OBJ 0-31 in range with a transparent tile, OBJ 32 opaque at (0,0).
  for (let n = 0; n < 33; n++) {
    p.oam[n * 4] = n < 32 ? 100 : 0;
    p.oam[n * 4 + 1] = 0;
    p.oam[n * 4 + 2] = n < 32 ? 1 : 0;
    p.oam[n * 4 + 3] = 0x30;
  }
  assert.deepEqual(pixel(renderMode1Frame(p, { objects: true }), 0, 0), black, '33rd OBJ in range');
  p.oam[1] = 224;
  assert.deepEqual(pixel(renderMode1Frame(p, { objects: true }), 0, 0), red, '32 OBJ in range');
  // 32x32/64x64: OBJ 1-4 (64 wide, transparent) 32 tiles, OBJ 5 at x 240 two tiles.
  for (let n = 0; n < 128; n++) p.oam[n * 4 + 1] = 224;
  p.oam.fill(0, 512);
  p.writeByte(0x2101, 0xa0);
  for (let n = 0; n < 6; n++) {
    p.oam[n * 4] = n === 5 ? 240 : 0;
    p.oam[n * 4 + 1] = 0;
    p.oam[n * 4 + 2] = n ? 0x20 : 0;
    p.oam[n * 4 + 3] = 0x30;
    if (n && n < 5) p.oam[512 + (n >>> 2)] |= 2 << ((n & 3) * 2);
  }
  assert.deepEqual(
    pixel(renderMode1Frame(p, { objects: true }), 0, 0),
    black,
    'OBJ 0 beyond 34 tiles',
  );
  // Without OBJ 5, OBJ 0 (32 wide) gets two of its four tiles: the model keeps the
  // leftmost on-screen tiles in screen order (Mesen2 comparison, docs/PPU-ROOM.md).
  p.oam[21] = 224;
  assert.deepEqual(
    pixel(renderMode1Frame(p, { objects: true }), 0, 0),
    red,
    'partial OBJ left tile',
  );
  // H flip: screen x 0 shows character column 3 (VRAM 96, last pixel); x 31 (column 0) is not loaded.
  p.oam[3] |= 0x40;
  assert.deepEqual(
    pixel(renderMode1Frame(p, { objects: true }), 31, 0),
    black,
    'flipped right tile dropped',
  );
  p.vram[96] = 1;
  assert.deepEqual(
    pixel(renderMode1Frame(p, { objects: true }), 0, 0),
    red,
    'flipped left tile kept',
  );
});
test('recorded blank windows are required and fully consumed by the cold room replay', () => {
  const bundle = JSON.parse(gunzipSync(readFileSync('assets/room-observations.json.gz')));
  const windows = bundle.windows.map((w) => ({ ...w }));
  windows[0].start++;
  assert.throws(
    () => new ObservedRoom(rom, { ...bundle, windows }),
    /ppu_original_write_window_required/,
  );
  windows[0] = { ...bundle.windows[0], blank: 0 };
  assert.throws(
    () => new ObservedRoom(rom, { ...bundle, windows }).step(),
    /ppu_original_blank_state_required|ppu_observed_write_window_required/,
  );
  const frames = bundle.frames.map((f) => ({ ...f }));
  frames[1].writes = frames[0].writes;
  assert.throws(
    () => new ObservedRoom(rom, { ...bundle, frames }),
    /room_frame_observation_required/,
  );
});
