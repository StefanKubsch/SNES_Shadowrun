import test from 'node:test';
import assert from 'node:assert/strict';
import { flatMemory, newPicture, writeRegisters, frameOf, pixel } from './picture-fixture.mjs';

// Synthetic fixtures for the manual contracts only, on the register interface of the
// picture back end; the original evidence is the live item list in
// mesen-live-room.test.mjs.
const HDMA_TABLE = 0x7e1f3f,
  HDMA_SECOND_TABLE = 0x7e1f60;
function fixture(memory) {
  const p = newPicture(memory);
  writeRegisters(p, [
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
  ]);
  for (let port = 0x210d; port <= 0x210e; port++)
    writeRegisters(p, [
      [port, 0],
      [port, 0],
    ]);
  // BG1: every pixel color 1 (red); all OBJ off the screen.
  for (let row = 0; row < 8; row++) p.vram[0x2000 + row * 2] = 0xff;
  p.cgram[2] = 31;
  p.sprites.y.fill(240);
  return p;
}
const red = [255, 0, 0, 255],
  black = [0, 0, 0, 255];
// Channel registers 43x0-43x4: parameters, B-bus port and the table address.
const channel = (p, n, mode, port, table) =>
  [mode, port, table & 255, (table >>> 8) & 255, table >>> 16].forEach((v, k) =>
    p.writeRegister(0x4300 + n * 16 + k, v),
  );

// Book I chapter 6 (PDF 68), 2123-2129 (PDF 126), 212E (PDF 129): with TMW the
// BG is masked inside window 1 [left,right]; IN/OUT inverts; left>right is empty.
test('window 1 masks the main-screen BG inside its edges, inverted or empty', () => {
  const p = fixture();
  assert.deepEqual(pixel(frameOf(p), 15, 0), red);
  writeRegisters(p, [
    [0x212e, 1],
    [0x2123, 2],
    [0x2126, 10],
    [0x2127, 20],
  ]);
  let frame = frameOf(p);
  assert.deepEqual(
    [9, 10, 20, 21].map((x) => pixel(frame, x, 100)),
    [red, black, black, red],
  );
  p.writeRegister(0x2123, 3);
  frame = frameOf(p);
  assert.deepEqual(
    [9, 10, 20, 21].map((x) => pixel(frame, x, 100)),
    [black, red, red, black],
  );
  p.writeRegister(0x2123, 2);
  p.writeRegister(0x2126, 21);
  assert.deepEqual(pixel(frameOf(p), 20, 0), red, 'left>right: no window');
  p.writeRegister(0x2123, 0x0a);
  assert.throws(() => frameOf(p), /picture_window_logic_required/);
  p.writeRegister(0x2123, 2);
  p.writeRegister(0x212e, 0x20);
  assert.throws(() => frameOf(p), /picture_composition_required/);
});

// Appendix B-2 (PDF 220): absolute table, [C|lines] header; C=0 one unit for
// all lines, C=1 one unit per line, 0 ends. 43x0 mode 1 writes B, B+1 (PDF 149).
function hdmaPicture(table) {
  const memory = flatMemory(),
    p = fixture(memory);
  memory.bytes.set(table, HDMA_TABLE);
  channel(p, 0, 1, 0x26, HDMA_TABLE);
  writeRegisters(p, [
    [0x2123, 2],
    [0x212e, 1],
  ]);
  return p;
}
test('H-DMA rows follow the table format and drive the window edges per line', () => {
  const p = hdmaPicture([2, 10, 20, 0x82, 30, 40, 50, 60, 1, 0xff, 0, 0]);
  assert.equal(p.describe().rows, null);
  p.writeRegister(0x420c, 1);
  const { rows } = p.describe(),
    edges = (left, right) => [
      ['edge', 0, left],
      ['edge', 1, right],
    ];
  assert.deepEqual(rows.slice(0, 6), [
    edges(10, 20),
    [],
    edges(30, 40),
    edges(50, 60),
    edges(0xff, 0),
    [],
  ]);
  assert.ok(rows.slice(5).every((r) => !r.length));
  const frame = frameOf(p);
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
test('H-DMA boundaries: channel conflict, unsupported tables and targets', () => {
  let p = hdmaPicture([1, 10, 20, 0]);
  p.writeRegister(0x420c, 1);
  // PDF 143: a channel enabled in 420C must not be used for general DMA.
  assert.throws(() => p.writeRegister(0x420b, 1), /picture_hdma_channel_conflict/);
  for (const mode of [0x41, 0x81, 5]) {
    p.writeRegister(0x4300, mode);
    assert.throws(() => p.describe(), /picture_hdma_mode_required/, `mode ${mode}`);
  }
  p.writeRegister(0x4300, 1);
  p.writeRegister(0x4301, 0x21);
  assert.throws(() => p.describe(), /picture_hdma_target_required/);
  p = hdmaPicture([0x80, 10, 20, 0]);
  p.writeRegister(0x420c, 1);
  assert.throws(() => p.describe(), /picture_hdma_line_count_required/);
});

// TM 212C (PDF 128) and BGnHOFS (PDF 119, written twice low/high, so mode 2)
// per line, as the credits sequence 81:CDF8 drives TM and BG2HOFS.
test('H-DMA switches main screen layers and scrolls a BG per line', () => {
  const memory = flatMemory(),
    p = fixture(memory);
  for (let row = 0; row < 8; row++) p.vram[0x2000 + row * 2] = 0x80; // pixel 0 of each tile red
  memory.bytes.set([1, 1, 1, 0, 1, 1, 0], HDMA_TABLE);
  memory.bytes.set([1, 3, 0, 1, 0, 0, 0x7f, 0x7f, 2, 0], HDMA_SECOND_TABLE);
  channel(p, 0, 0, 0x2c, HDMA_TABLE);
  channel(p, 1, 2, 0x0d, HDMA_SECOND_TABLE);
  p.writeRegister(0x420c, 3);
  assert.deepEqual(p.describe().rows[0], [
    ['main', 1],
    ['scroll', 0, 0, 3],
  ]);
  const frame = frameOf(p);
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
  p.writeRegister(0x4310, 0);
  assert.throws(() => frameOf(p), /picture_scroll_pair_required/);
});

// 2100 brightness (PDF 115): each 5-bit component c becomes floor(c*b/15); 0 and
// forced blank are black. The formula itself is the original evidence in
// mesen-live-room.test.mjs (fade-in after leaving the morgue).
test('screen brightness scales each 5-bit component by b/15', () => {
  const p = fixture();
  p.palette[1] = 0x7fff; // color 1: white, r=g=b=31
  for (const [b, v] of [
    [15, 255],
    [14, 231],
    [6, 99],
    [1, 16],
  ]) {
    p.writeRegister(0x2100, b);
    assert.deepEqual(pixel(frameOf(p), 0, 0), [v, v, v, 255], 'brightness ' + b);
  }
  p.writeRegister(0x2100, 0);
  assert.deepEqual(pixel(frameOf(p), 0, 0), black);
  p.writeRegister(0x2100, 0x8f);
  assert.deepEqual(pixel(frameOf(p), 0, 0), black);
});

// Book I chapter 7 (PDF 69-73), 2130-2132 (PDF 130-132): colour math of the
// main screen with the fixed colour or the sub screen; a clear sub screen
// pixel adds the fixed colour without halving. The title's half addition of
// BG2 is compared with the original in live-game-over.test.mjs.
test('colour math adds or subtracts the fixed colour or the sub screen, halved only with sub screen data', () => {
  const level = (v) => (v << 3) | (v >>> 2);
  let p = fixture();
  writeRegisters(p, [
    [0x2131, 1],
    [0x2132, 0x20 | 5],
    [0x2132, 0x40 | 10],
    [0x2132, 0x80],
  ]);
  assert.deepEqual(pixel(frameOf(p), 3, 3), [255, level(10), 0, 255]);
  p.writeRegister(0x2131, 0x81);
  assert.deepEqual(pixel(frameOf(p), 3, 3), [level(26), 0, 0, 255]);
  p.writeRegister(0x2131, 0x41);
  assert.throws(() => frameOf(p), /picture_colour_math_half_required/);
  // Sub screen without data: the fixed colour, not halved.
  writeRegisters(p, [
    [0x2130, 2],
    [0x212d, 0],
    [0x212f, 0],
  ]);
  assert.deepEqual(pixel(frameOf(p), 3, 3), [255, level(10), 0, 255]);
  // BG2 on the sub screen (colour 2, blue): (31+0)/2 and (0+31)/2.
  writeRegisters(p, [
    [0x2108, 4],
    [0x210b, 0x31],
    [0x210f, 0],
    [0x210f, 0],
    [0x2110, 0],
    [0x2110, 0],
  ]);
  for (let row = 0; row < 8; row++) p.vram[0x6000 + row * 2 + 1] = 0xff;
  p.cgram[5] = 0x7c;
  p.writeRegister(0x212d, 2);
  assert.deepEqual(pixel(frameOf(p), 3, 3), [level(15), 0, level(15), 255]);
  // CGWSEL 7-6 = 3: the main screen is black, then math (no half) adds the fixed colour.
  p = fixture();
  p.writeRegister(0x2130, 0xc0);
  assert.deepEqual(pixel(frameOf(p), 3, 3), black);
  p.writeRegister(0x2130, 1);
  assert.throws(() => frameOf(p), /picture_composition_required/);
});
