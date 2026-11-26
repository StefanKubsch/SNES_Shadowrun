// The register-free picture back end of live play (src/video/picture-video.mjs,
// docs/FRAME-DESCRIPTION.md step 5): video interface calls and register data give the
// frame description, video memory and register reads the retired SNES back end
// (proof/video) gave; its results are frozen as hashes (removal plan step 5,
// docs/REGISTER-COMPAT-BOUNDARY.md). The golden traces replay every recorded frame
// through the picture back end; these cases also reach set-ups the scenarios do not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PictureBoundary } from '../src/video/picture-video.mjs';
import { BG_1, BG_2, BG_3 } from '../src/constants/ppu.mjs';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { flatMemory, newPicture } from './picture-fixture.mjs';
import {
  BG1SC,
  BG12NBA,
  CGADD,
  CGDATA,
  M7A,
  M7B,
  MPYL,
  RDVRAMH,
  TM,
  BG2HOFS,
  WH0,
} from '../src/constants/hardware-registers.mjs';

useLiftVectors(import.meta.url);

// Bytes from a seed (xorshift), for the memories the transfers copy.
function fill(bytes, at, length, seed) {
  let x = seed;
  for (let n = 0; n < length; n++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    bytes[at + n] = x & 0xff;
  }
}
// ROM and WRAM sources of the transfers below.
const ZERO = 0x81ff00,
  CHARACTERS = 0x908000,
  COLOURS = 0x918000,
  SPRITES = 0x928000,
  MAP = 0x7e4000,
  HDMA_TM = 0x7e5000,
  HDMA_EDGES = 0x7e5100,
  HDMA_SCROLL = 0x7e5200,
  TEXT_MASK = 0x7e2ae0;

// The picture back end over a memory with the transfer sources.
function setUp() {
  const m = flatMemory();
  fill(m.bytes, CHARACTERS, 0x8000, 7);
  fill(m.bytes, COLOURS, 0x200, 11);
  for (let n = 0; n < 0x200; n += 2) m.bytes[COLOURS + n + 1] &= 0x7f;
  fill(m.bytes, SPRITES, 0x220, 13);
  fill(m.bytes, MAP, 0x800, 17);
  // TM per line: 40 lines BG1+OBJ, then 1 line each BG1-3+OBJ (repeat) for 8 lines.
  m.bytes.set([40, 0x11, 0x88, 0x17, 0x13, 0x17, 0x15, 0x17, 0x13, 0x17, 0x11, 0], HDMA_TM);
  m.bytes.set([60, 10, 200, 0x82, 20, 120, 30, 100, 0], HDMA_EDGES);
  m.bytes.set([100, 0, 0, 0x81, 5, 1, 0], HDMA_SCROLL);
  const picture = newPicture(m);
  return { memory: m, picture, run: (f) => f(picture) };
}

// A mode 1 scene with every memory written, three layers, sprites and colour math.
function scene(p) {
  p.run((v) => {
    v.resetRegisters();
    v.setDisplay(0x80);
    v.clearVram(ZERO);
    v.copyToOam(SPRITES, 0x220);
    v.transfer(0, { to: 'cgram', address: 0, source: COLOURS, bytes: 0x200 }, [
      'mode',
      'target',
      'address',
      'source',
      'bank',
      'bytes',
      'start',
    ]);
    v.sendToVram(CHARACTERS, 0x4000, 0x0000, {});
    v.copyToVram(
      (
        (list) => () =>
          list.shift() ?? null
      )([
        { bytes: 0x800, increment: 0x80, source: MAP, address: 0x6000 },
        { bytes: 0x40, increment: 0x81, source: MAP, address: 0x6400 },
      ]),
    );
    v.setVramWords(0x6800, [0x1234, 0x2345]);
    v.fillVramWords(0x6900, 0x0042, 32);
    v.setVramIncrement(0x0080, 1);
    v.setVramAddress(0x6a00);
    v.writeVramBytes(0x11, 0x22);
    v.setUpVramTransfer(CHARACTERS + 0x4000, 0x1000, {});
    v.startVramTransfer(0x4000, {});
    v.sendSplitPicture(CHARACTERS, 0x400, 0x5000, {});
    v.setBgMode(0x19);
    v.setMapBase(BG_1, 0x60);
    v.setMapBase(BG_2, 0x65);
    v.setMapBase(BG_3, 0x6a);
    v.setCharacterBases(1, 0x20);
    v.setCharacterBases(3, 0x02);
    v.setScroll(BG_1, 0x123, 0x045);
    v.setHorizontalScroll(BG_2, 0x3ff);
    v.setVerticalScroll(BG_2, 7);
    v.setScrollBytes(BG_3, true, 0x10, 0xff);
    v.setObjectSelectByte(0x62);
    v.setMainLayers(0x17);
    v.setSubLayers(0x04);
    v.setColourSelect(0x02);
    v.setColourMathLayers(0x41);
    v.setFixedColour(0xe5);
    v.setColour(0, 0x7fff, {});
    v.setColours(16, 0x001f, 0x03e0);
    v.setDisplay(0x0f);
  });
}

test('the picture back end describes a scene as the SNES back end does', () => {
  const p = setUp();
  scene(p);
  const picture = p.picture.describe();
  assertFrozenRun({
    picture,
    oam: p.picture.oam,
    cgram: new Uint8Array(p.picture.palette.buffer),
  });
});

test('windows, H-DMA rows and the text read-back match the SNES back end', () => {
  const p = setUp();
  scene(p);
  p.run((v) => {
    v.setObjectSelect(0x0362, 0);
    v.setMainWindowLayers(0x01);
    v.setWindowAreas(0x02, 0, 0x20);
    v.setWindowLogicBytes(0, 0);
    v.setColourSelect(0x12);
    v.setUpDma(
      [
        [3, { to: 'mainLayers', source: HDMA_TM }],
        [4, { to: 'windowEdges', source: HDMA_EDGES }],
      ],
      ['modeAndTarget', 'source', 'bank'],
    );
    v.transfer(6, { to: 'bg2Scroll', source: HDMA_SCROLL }, ['mode', 'target', 'source', 'bank']);
    v.enableHdma(0x58);
  });
  const picture = p.picture.describe();
  assert.ok(picture.rows.some((row) => row?.some((change) => change[0] === 'scroll')));
  assertFrozenRun(picture);
  // The text read-back of channel 5 (81:A9E1) after its set-up by the font upload.
  p.run((v) => {
    v.enableHdmaWord(0, 0);
    v.setUpDma([[5, { to: 'vramRead', source: 0x7e0000 }]], ['mode', 'target', 'bank']);
    v.readVramToWram(0x6000, 16, TEXT_MASK & 0xffff, {});
  });
  assertFrozenRun(p.memory.bytes.slice(TEXT_MASK, TEXT_MASK + 16));
  assert.notDeepEqual(
    [...p.memory.bytes.subarray(TEXT_MASK, TEXT_MASK + 16)],
    new Array(16).fill(0),
  );
});

test('register data reaches the picture state as it reaches the PPU', () => {
  const p = setUp();
  scene(p);
  const registers = [
    [BG1SC, 0x61],
    [BG12NBA, 0x31],
    [TM, 0x13],
    [BG2HOFS, 0x34],
    [BG2HOFS, 0x01],
    [CGADD, 5],
    [CGDATA, 0x34],
    [CGDATA, 0x12],
    [WH0, 9],
  ];
  for (const [port, value] of registers) {
    p.picture.write(0, port, value, 1);
  }
  const picture = p.picture.describe();
  assertFrozenRun(picture);
  // The window tile multiplication: signed M7A times signed M7B.
  for (const [port, value] of [
    [M7A, 0xf0],
    [M7A, 0xff],
    [M7B, 0x07],
  ]) {
    p.picture.write(0, port, value, 1);
  }
  // -16 * 7 = -112 as a 24-bit product.
  assert.deepEqual(
    [0, 1, 2].map((n) => p.picture.readProduct(MPYL + n)),
    [0x90, 0xff, 0xff],
  );
  assertFrozenRun(p.picture.readVram(RDVRAMH));
});

test('the picture back end rejects what the renderer cannot draw', () => {
  const p = setUp();
  scene(p);
  p.picture.setBgMode(0x03);
  assert.throws(
    () => p.picture.describe(),
    (e) => e instanceof PictureBoundary && e.reason === 'picture_mode1_required',
  );
  p.picture.setBgMode(0x09);
  p.picture.setVramIncrement(0x84);
  assert.throws(
    () => p.picture.writeVramWords([0]),
    (e) => e.reason === 'picture_vram_remap_required',
  );
});
