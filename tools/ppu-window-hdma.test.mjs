import test from 'node:test';
import assert from 'node:assert/strict';
import { PpuState, PpuBus } from '../src/video/ppu-state.mjs';
import { renderMode1Frame } from '../src/video/ppu-frame.mjs';
import { hdmaRows } from '../src/video/hdma.mjs';

// Synthetic fixtures for the manual contracts only; the original evidence is
// the live item list in mesen-live-room.test.mjs.
function fixture() {
  const p = new PpuState();
  for (const name of ['vramKnown', 'cgramKnown', 'oamKnown']) p[name].fill(1);
  for (const [port, value] of [
    [0x2100, 15],
    [0x2101, 0],
    [0x2103, 0],
    [0x2105, 1],
    [0x2106, 0],
    [0x2107, 0],
    [0x210b, 1],
    [0x212c, 1],
    [0x212e, 0],
    [0x2130, 0],
    [0x2131, 0],
    [0x2133, 0],
  ])
    p.writeByte(port, value);
  for (let port = 0x210d; port <= 0x210e; port++) {
    p.writeByte(port, 0);
    p.writeByte(port, 0);
  }
  // BG1: every pixel color 1 (red); all OBJ off the screen.
  for (let row = 0; row < 8; row++) p.vram[0x2000 + row * 2] = 0xff;
  p.cgram[2] = 31;
  for (let n = 0; n < 128; n++) p.oam[n * 4 + 1] = 240;
  return p;
}
const red = [255, 0, 0, 255],
  black = [0, 0, 0, 255];
const pixel = (frame, x, y) => Array.from(frame.subarray((y * 256 + x) * 4, (y * 256 + x) * 4 + 4));

// Book I chapter 6 (PDF 68), 2123-2129 (PDF 126), 212E (PDF 129): with TMW the
// BG is masked inside window 1 [left,right]; IN/OUT inverts; left>right is empty.
test('window 1 masks the main-screen BG inside its edges, inverted or empty', () => {
  const p = fixture();
  assert.deepEqual(pixel(renderMode1Frame(p), 15, 0), red);
  p.writeByte(0x212e, 1);
  p.writeByte(0x2123, 2);
  assert.throws(() => renderMode1Frame(p), /ppu_register_required/);
  p.writeByte(0x2126, 10);
  p.writeByte(0x2127, 20);
  let frame = renderMode1Frame(p);
  assert.deepEqual(
    [9, 10, 20, 21].map((x) => pixel(frame, x, 100)),
    [red, black, black, red],
  );
  p.writeByte(0x2123, 3);
  frame = renderMode1Frame(p);
  assert.deepEqual(
    [9, 10, 20, 21].map((x) => pixel(frame, x, 100)),
    [black, red, red, black],
  );
  p.writeByte(0x2123, 2);
  p.writeByte(0x2126, 21);
  assert.deepEqual(pixel(renderMode1Frame(p), 20, 0), red, 'left>right: no window');
  p.writeByte(0x2123, 0x0a);
  assert.throws(() => renderMode1Frame(p), /ppu_window_logic_source_required/);
  p.writeByte(0x2123, 2);
  p.writeByte(0x212e, 0x20);
  assert.throws(() => renderMode1Frame(p), /ppu_composition_source_required/);
});

// Appendix B-2 (PDF 220): absolute table, [C|lines] header; C=0 one unit for
// all lines, C=1 one unit per line, 0 ends. 43x0 mode 1 writes B, B+1 (PDF 149).
function hdmaBus(table) {
  const p = fixture(),
    wram = new Uint8Array(0x20000);
  wram.set(table, 0x1f3f);
  const bus = new PpuBus(
    {
      read8: (a) => {
        assert.equal(a >>> 16, 0x7e);
        return wram[a & 0xffff];
      },
    },
    p,
  );
  [1, 0x26, 0x3f, 0x1f, 0x7e].forEach((v, n) => bus.writeByte(0x4300 + n, v));
  p.writeByte(0x2123, 2);
  p.writeByte(0x212e, 1);
  return { p, bus, wram };
}
test('H-DMA rows follow the table format and drive the window edges per line', () => {
  const { p, bus } = hdmaBus([2, 10, 20, 0x82, 30, 40, 50, 60, 1, 0xff, 0, 0]);
  assert.equal(hdmaRows(bus), null);
  assert.throws(() => renderMode1Frame(p), /ppu_register_required/);
  bus.writeByte(0x420c, 1);
  assert.throws(() => renderMode1Frame(p), /ppu_hdma_source_required/);
  const rows = hdmaRows(bus);
  assert.deepEqual(rows.slice(0, 6), [
    [0x2126, 10, 0x2127, 20],
    [],
    [0x2126, 30, 0x2127, 40],
    [0x2126, 50, 0x2127, 60],
    [0x2126, 0xff, 0x2127, 0],
    [],
  ]);
  assert.ok(rows.slice(5).every((r) => !r.length));
  const frame = renderMode1Frame(p, { rows });
  assert.deepEqual(
    [
      [9, 0],
      [10, 0],
      [10, 1],
      [29, 2],
      [30, 2],
      [50, 3],
      [60, 3],
      [61, 3],
      [100, 4],
      [100, 200],
    ].map(([x, y]) => pixel(frame, x, y)),
    [red, black, black, red, black, black, black, red, red, red],
  );
});
test('H-DMA boundaries: channel conflict, unsupported tables and targets, disabled edges unknown', () => {
  let { p, bus } = hdmaBus([1, 10, 20, 0]);
  bus.writeByte(0x420c, 1);
  // PDF 143: a channel enabled in 420C must not be used for general DMA.
  assert.throws(() => bus.writeByte(0x420b, 1), /ppu_hdma_channel_conflict/);
  bus.writeByte(0x4300, 0x41);
  assert.throws(() => hdmaRows(bus), /ppu_hdma_indirect_source_required/);
  bus.writeByte(0x4300, 0x81);
  assert.throws(() => hdmaRows(bus), /ppu_hdma_direction_source_required/);
  bus.writeByte(0x4300, 5);
  assert.throws(() => hdmaRows(bus), /ppu_hdma_mode_source_required/);
  bus.writeByte(0x4300, 1);
  bus.writeByte(0x4301, 0x21);
  assert.throws(() => hdmaRows(bus), /ppu_hdma_target_source_required/);
  ({ p, bus } = hdmaBus([0x80, 10, 20, 0]));
  bus.writeByte(0x420c, 1);
  assert.throws(() => hdmaRows(bus), /ppu_hdma_line_count_source_required/);
  ({ p, bus } = hdmaBus([1, 10, 20, 0]));
  p.writeByte(0x2126, 1);
  p.writeByte(0x2127, 2);
  const writes = [];
  bus.beforeHdmaWrite = (port, value) => writes.push([port, value]);
  bus.writeByte(0x420c, 1);
  bus.writeByte(0x4302, 0x40);
  bus.writeByte(0x4310, 0);
  bus.writeByte(0x420c, 0);
  assert.deepEqual(writes, [
    [0x420c, 1],
    [0x4302, 0x40],
    [0x420c, 0],
  ]);
  assert.equal(
    p.registerKnown[0x26] + p.registerKnown[0x27],
    0,
    'last H-DMA edges are not tracked',
  );
});

// TM 212C (PDF 128) and BGnHOFS (PDF 119, written twice low/high, so mode 2)
// per line, as the credits sequence 81:CDF8 drives TM and BG2HOFS.
test('H-DMA switches main screen layers and scrolls a BG per line', () => {
  const p = fixture(),
    wram = new Uint8Array(0x20000);
  for (let row = 0; row < 8; row++) p.vram[0x2000 + row * 2] = 0x80; // pixel 0 of each tile red
  wram.set([1, 1, 1, 0, 1, 1, 0], 0x1f3f);
  wram.set([1, 3, 0, 1, 0, 0, 0x7f, 0x7f, 2, 0], 0x1f60);
  const bus = new PpuBus(
    {
      read8: (a) => {
        assert.equal(a >>> 16, 0x7e);
        return wram[a & 0xffff];
      },
    },
    p,
  );
  [0, 0x2c, 0x3f, 0x1f, 0x7e].forEach((v, n) => bus.writeByte(0x4300 + n, v));
  [2, 0x0d, 0x60, 0x1f, 0x7e].forEach((v, n) => bus.writeByte(0x4310 + n, v));
  bus.writeByte(0x420c, 3);
  const rows = hdmaRows(bus);
  assert.deepEqual(rows[0], [0x212c, 1, 0x210d, 3, 0x210d, 0]);
  const frame = renderMode1Frame(p, { rows });
  assert.deepEqual(
    [
      [5, 0],
      [0, 0],
      [0, 1],
      [5, 1],
      [0, 2],
      [1, 2],
    ].map(([x, y]) => pixel(frame, x, y)),
    [red, black, black, black, black, red],
    'row 0 scrolled by 3, row 1 BG off, row 2 by 0x27F',
  );
  assert.deepEqual(
    [2, 3, 200].map((y) => pixel(frame, 1, y)),
    [red, red, red],
    'last values stay for the following rows',
  );
  // A scroll word split across rows (mode 0) is not admitted.
  bus.writeByte(0x4310, 0);
  assert.throws(() => renderMode1Frame(p, { rows: hdmaRows(bus) }), /ppu_scroll_pair_required/);
  // Switching the channel off leaves the scroll word unknown.
  bus.writeByte(0x420c, 1);
  assert.equal(p.scrollKnown[0], 0);
});

// 2100 brightness (PDF 115): each 5-bit component c becomes floor(c*b/15); 0 and
// forced blank are black. The formula itself is the original evidence in
// mesen-live-room.test.mjs (fade-in after leaving the morgue).
test('screen brightness scales each 5-bit component by b/15', () => {
  const p = fixture();
  p.cgram[2] = 0xff;
  p.cgram[3] = 0x7f; // color 1: white, r=g=b=31
  for (const [b, v] of [
    [15, 255],
    [14, 231],
    [6, 99],
    [1, 16],
  ]) {
    p.writeByte(0x2100, b);
    assert.deepEqual(pixel(renderMode1Frame(p), 0, 0), [v, v, v, 255], 'brightness ' + b);
  }
  p.writeByte(0x2100, 0);
  assert.deepEqual(pixel(renderMode1Frame(p), 0, 0), black);
  p.writeByte(0x2100, 0x8f);
  assert.deepEqual(pixel(renderMode1Frame(p), 0, 0), black);
});

// Book I chapter 7 (PDF 69-73), 2130-2132 (PDF 130-132): colour math of the
// main screen with the fixed colour or the sub screen; a clear sub screen
// pixel adds the fixed colour without halving. The title's half addition of
// BG2 is compared with the original in live-game-over.test.mjs.
test('colour math adds or subtracts the fixed colour or the sub screen, halved only with sub screen data', () => {
  const level = (v) => (v << 3) | (v >>> 2);
  let p = fixture();
  p.writeByte(0x2131, 1);
  assert.throws(() => renderMode1Frame(p), /ppu_fixed_color_required/);
  p.writeByte(0x2132, 0x20 | 5);
  p.writeByte(0x2132, 0x40 | 10);
  p.writeByte(0x2132, 0x80);
  assert.deepEqual(pixel(renderMode1Frame(p), 3, 3), [255, level(10), 0, 255]);
  p.writeByte(0x2131, 0x81);
  assert.deepEqual(pixel(renderMode1Frame(p), 3, 3), [level(26), 0, 0, 255]);
  p.writeByte(0x2131, 0x41);
  assert.throws(() => renderMode1Frame(p), /ppu_color_math_half_source_required/);
  // Sub screen without data: the fixed colour, not halved.
  p.writeByte(0x2130, 2);
  p.writeByte(0x212d, 0);
  p.writeByte(0x212f, 0);
  assert.deepEqual(pixel(renderMode1Frame(p), 3, 3), [255, level(10), 0, 255]);
  // BG2 on the sub screen (colour 2, blue): (31+0)/2 and (0+31)/2.
  p.writeByte(0x2108, 4);
  p.writeByte(0x210b, 0x31);
  p.writeByte(0x210f, 0);
  p.writeByte(0x210f, 0);
  p.writeByte(0x2110, 0);
  p.writeByte(0x2110, 0);
  for (let row = 0; row < 8; row++) p.vram[0x6000 + row * 2 + 1] = 0xff;
  p.cgram[5] = 0x7c;
  p.writeByte(0x212d, 2);
  assert.deepEqual(pixel(renderMode1Frame(p), 3, 3), [level(15), 0, level(15), 255]);
  // CGWSEL 7-6 = 3: the main screen is black, then math (no half) adds the fixed colour.
  p = fixture();
  p.writeByte(0x2130, 0xc0);
  assert.deepEqual(pixel(renderMode1Frame(p), 3, 3), black);
  p.writeByte(0x2130, 1);
  assert.throws(() => renderMode1Frame(p), /ppu_composition_source_required/);
});
