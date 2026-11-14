// OBJ time over with a partly loaded OBJ (35's time over, docs/PPU-ROOM.md).
// Book I does not say which tiles of a partly loaded OBJ remain. A synthetic LoROM
// shows Mesen2's choice: the leftmost on-screen tiles, in screen order whatever the
// H flip. The native renderer is checked against the same CGRAM, VRAM and OAM.
// Group A (OBJ y 50): OBJ 0 is 16x16 at x 100, left tile red and right tile green,
// followed by 16 16x16 fillers and one 8x8 filler (33 tiles), so OBJ 0 gets one of
// its two tiles on lines 50-57. Group B (y 100) repeats it with H flip (OBJ 18).
// Group C (y 150) shows OBJ 36 alone as a control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findMesen, prepareScript, runMesen } from './mesen.mjs';
import { PpuState } from '../src/video/ppu-state.mjs';
import { renderMode1Frame } from '../src/video/ppu-frame.mjs';

const CGRAM_SOURCE = 0x1000,
  OAM_SOURCE = 0x1400,
  VRAM_SOURCE = 0x2000;

function timeOverMemory() {
  const cgram = new Uint8Array(512);
  const colour = (index, value) => {
    cgram[index * 2] = value & 0xff;
    cgram[index * 2 + 1] = value >> 8;
  };
  colour(129, 0x001f); // red
  colour(130, 0x03e0); // green
  colour(131, 0x7c00); // blue
  const vram = new Uint8Array(64 * 32);
  const solid = (tile, index) => {
    for (let row = 0; row < 8; row++) {
      if (index & 1) vram[tile * 32 + row * 2] = 0xff;
      if (index & 2) vram[tile * 32 + row * 2 + 1] = 0xff;
    }
  };
  for (const tile of [0x20, 0x30]) solid(tile, 1);
  for (const tile of [0x21, 0x31]) solid(tile, 2);
  for (const tile of [0x04, 0x05, 0x14, 0x15]) solid(tile, 3);
  const oam = new Uint8Array(544);
  for (let n = 0; n < 128; n++) oam[n * 4 + 1] = 240;
  const set = (n, x, y, name, attr, large) => {
    oam.set([x, y, name, attr], n * 4);
    if (large) oam[512 + (n >> 2)] |= 2 << ((n & 3) * 2);
  };
  const group = (first, y, flip) => {
    set(first, 100, y, 0x20, 0x30 | (flip ? 0x40 : 0), true);
    for (let k = 1; k <= 16; k++) set(first + k, 200, y, 0x04, 0x30, true);
    set(first + 17, 230, y, 0x04, 0x30, false);
  };
  group(0, 50, false);
  group(18, 100, true);
  set(36, 100, 150, 0x20, 0x30, true);
  return { cgram, vram, oam };
}

// 65816 program: forced blank, mode 1, OBJSEL 0, DMA of CGRAM, OAM and VRAM,
// main screen OBJ only, full brightness, endless loop. No NMI or IRQ.
function timeOverRom() {
  const rom = new Uint8Array(0x8000),
    code = [],
    emit = (...bytes) => code.push(...bytes);
  emit(0x78, 0x18, 0xfb, 0xc2, 0x10, 0xe2, 0x20); // SEI CLC XCE REP #$10 SEP #$20
  emit(0xa9, 0x8f, 0x8d, 0x00, 0x21); // INIDISP forced blank
  emit(0xa9, 0x01, 0x8d, 0x05, 0x21); // BGMODE 1
  emit(0x9c, 0x01, 0x21); // OBJSEL 0: 8x8 and 16x16
  const dma = (mode, port, source, size) => {
    const address = 0x8000 + source;
    emit(0xa9, mode, 0x8d, 0x00, 0x43, 0xa9, port, 0x8d, 0x01, 0x43);
    emit(0xa2, address & 0xff, address >> 8, 0x8e, 0x02, 0x43, 0xa9, 0x00, 0x8d, 0x04, 0x43);
    emit(0xa2, size & 0xff, size >> 8, 0x8e, 0x05, 0x43, 0xa9, 0x01, 0x8d, 0x0b, 0x42);
  };
  const { cgram, vram, oam } = timeOverMemory();
  emit(0x9c, 0x21, 0x21);
  dma(0x00, 0x22, CGRAM_SOURCE, cgram.length);
  emit(0x9c, 0x02, 0x21, 0x9c, 0x03, 0x21);
  dma(0x00, 0x04, OAM_SOURCE, oam.length);
  emit(0xa9, 0x80, 0x8d, 0x15, 0x21, 0x9c, 0x16, 0x21, 0x9c, 0x17, 0x21);
  dma(0x01, 0x18, VRAM_SOURCE, vram.length);
  emit(0xa9, 0x10, 0x8d, 0x2c, 0x21); // TM: OBJ only
  emit(0xa9, 0x0f, 0x8d, 0x00, 0x21); // full brightness
  emit(0x80, 0xfe); // BRA *
  rom.set(code, 0);
  rom.set(cgram, CGRAM_SOURCE);
  rom.set(oam, OAM_SOURCE);
  rom.set(vram, VRAM_SOURCE);
  const title = 'TIME OVER TEST       ';
  for (let i = 0; i < title.length; i++) rom[0x7fc0 + i] = title.charCodeAt(i);
  rom.set([0x20, 0x00, 0x08, 0x00, 0x01], 0x7fd5); // LoROM, ROM only, 256 KiB, Europe
  rom.set([0x00, 0x80], 0x7ffc); // emulation reset vector $8000
  rom.set([0xff, 0xff, 0x00, 0x00], 0x7fdc);
  let sum = 0;
  for (const byte of rom) sum += byte;
  sum &= 0xffff;
  rom.set([~sum & 0xff, (~sum >> 8) & 0xff, sum & 0xff, sum >> 8], 0x7fdc);
  return rom;
}

// Colour runs of one picture row as "start-end:rrggbb" (black omitted).
function runs(colourAt, width) {
  const out = [];
  let last = null,
    start = 0;
  for (let x = 0; x <= width; x++) {
    const c = x < width ? colourAt(x) : -1;
    if (c === last) continue;
    if (last) out.push(`${start}-${x - 1}:${last.toString(16).padStart(6, '0')}`);
    last = c;
    start = x;
  }
  return out.join(' ');
}
// Successive distinct non-empty row patterns; independent of the picture's line offset.
const sequence = (rows) => rows.filter((r, i) => r && r !== rows[i - 1]);

function nativeRows() {
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
    [0x212c, 0x10],
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
  const { cgram, vram, oam } = timeOverMemory();
  p.cgram.set(cgram);
  p.vram.set(vram);
  p.oam.set(oam);
  const frame = renderMode1Frame(p, { objects: true });
  return Array.from({ length: 224 }, (_, y) =>
    runs((x) => {
      const at = (y * 256 + x) * 4;
      return (frame[at] << 16) | (frame[at + 1] << 8) | frame[at + 2];
    }, 256),
  );
}

// What Mesen2 showed when the case was made (2026-11-10, Mesen 2.2.1).
const EXPECTED = [
  '100-107:ff0000 200-215:0000ff 230-237:0000ff',
  '100-107:ff0000 108-115:00ff00 200-215:0000ff',
  '100-107:00ff00 200-215:0000ff 230-237:0000ff',
  '100-107:00ff00 108-115:ff0000 200-215:0000ff',
  '100-107:ff0000 108-115:00ff00',
];

test('native OBJ time over keeps the leftmost on-screen tiles of a partly loaded OBJ', () => {
  assert.deepEqual(sequence(nativeRows()), EXPECTED);
});

const { exe, reason } = findMesen();
test(
  'Mesen2 OBJ time over: partly loaded OBJ keeps its leftmost on-screen tiles',
  { skip: exe ? false : `Mesen not available: ${reason}` },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'snes-time-over-')),
      rom = join(dir, 'time-over.smc');
    writeFileSync(rom, timeOverRom());
    const rows = [];
    try {
      const result = await runMesen(
        exe,
        rom,
        prepareScript('time-over.lua', {}),
        (line) => {
          const m = /^ROW (\d+) (.*)$/.exec(line);
          if (m) rows[+m[1]] = m[2];
        },
        { timeoutMs: 60000 },
      );
      assert.equal(result.code, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    assert.deepEqual(sequence(Array.from(rows, (r) => r ?? '')), EXPECTED);
  },
);
