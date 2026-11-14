import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { findMesen } from './mesen.mjs';
import { recordLiveRoom, alignLiveNmis, inCpuStack, gameContext } from './mesen-live-room.mjs';
import { originalLogoPixels } from './capture-boot-logo.mjs';
import { rom } from './task-native-dialog-harness.mjs';
import { ObservedRoom } from '../proof/video/room-observed.mjs';
import { renderMode1Frame } from '../src/video/ppu-frame.mjs';
import { ppuFromMesen } from './mesen-ppu-state.mjs';
import { livePlanDriver } from './live-plan-driver.mjs';
import { MORGUE_EXIT_PLAN } from './mesen-f390-oracle.mjs';

// M5: the same pad words per NMI after the end of the room recording. WRAM may differ
// in hardware interrupt frames and in free stack bytes below S, which lifted code does
// not produce (docs/MATRIX-LIFT.md).
const { exe, reason } = findMesen();
function nativeLive(pads, rounds, keep = new Set()) {
  const bundle = JSON.parse(gunzipSync(readFileSync('assets/room-observations.json.gz')));
  const room = new ObservedRoom(rom, bundle);
  room.finish();
  const ctx = room.vm.natives.accessor.ctx,
    nmis = [],
    pixels = new Map();
  const frames = room.live({
    pad: (k) => pads[k] ?? 0,
    onFrame: (f) => {
      nmis.push({
        k: f.nmi,
        pc: (ctx.programBank << 16) | ctx.pc,
        s: ctx.s,
        raster: f.rasterWrites,
        hdma: room.bus.ppu.hdmaEnabled,
      });
      pixels.set(f.nmi, f.pixels);
      if (!keep.has(f.nmi - 2)) pixels.delete(f.nmi - 2);
    },
  });
  while (room.driver.roundsCompleted < bundle.rounds + rounds) room.stepLive();
  room.vm.natives.accessor.load();
  ctx.e = room.vm.e;
  const state = {
    context: { ...ctx },
    nmis: frames.nmis,
    wram: room.memory.wram.slice(),
    sram: room.memory.sram.slice(),
    vram: room.bus.ppu.vram.slice(),
    cgram: room.bus.ppu.cgram.slice(),
    oam: room.bus.ppu.oam.slice(),
  };
  while (frames.nmis <= state.nmis) room.stepLive();
  return { ...state, frames: nmis, pixels };
}
async function both(pads, rounds, shots = []) {
  const original = await recordLiveRoom(exe, pads, rounds, { shots }),
    native = nativeLive(
      pads,
      rounds,
      new Set(shots.length ? Array.from({ length: Math.max(...shots) + 1 }, (_, k) => k) : []),
    );
  assert.deepEqual(
    original.stop,
    { nmis: 2273, frame: 2475 },
    'same stop point as the room recording',
  );
  // Each pad word is polled in the frame of its NMI, before that NMI.
  original.polls.forEach((p, i) => {
    assert.equal(p.k, i);
    assert.equal(p.inNmi, false);
    if (original.nmis[i]) assert.equal(p.frame, original.nmis[i].frame);
  });
  return {
    original,
    native,
    ...alignLiveNmis(
      original.nmis.filter((o) => o.k < original.context.nmis),
      native.frames,
    ),
  };
}
// Idle, down, right, left: 85 main loop returns, before the first lag frame.
const MOVE = [
  ...Array(15).fill(0),
  ...Array(30).fill(0x0400),
  ...Array(20).fill(0x0100),
  ...Array(20).fill(0x0200),
];
test(
  'first room live input matches the original exactly while it has no lag frame',
  { skip: exe ? false : reason, timeout: 900000 },
  async () => {
    const { original, native, frameBytes, moved, lag } = await both(MOVE, 85);
    assert.deepEqual(lag, [], 'no original lag frame in this sequence');
    assert.ok(native.frames.every((f) => f.raster === 0));
    const { nmis, ...context } = original.context;
    assert.equal(native.nmis, nmis);
    assert.deepEqual(gameContext(native.context), gameContext(context));
    const diff = [];
    for (let n = 0; n < 0x20000; n++) if (native.wram[n] !== original.wram[n]) diff.push(n);
    const unexplained = diff.filter((n) => !frameBytes.has(n) && !inCpuStack(n));
    assert.deepEqual(
      unexplained.map((n) => n.toString(16)),
      [],
      'WRAM differs outside hardware frames and free stack bytes',
    );
    assert.equal((native.wram[0x1cb] << 8) | native.wram[0x1ca], 0x0200);
    for (const name of ['sram', 'vram', 'cgram', 'oam'])
      assert.deepEqual(native[name], original[name], name);
    assert.equal(original.frame.scanline, 225);
    assert.deepEqual(
      native.pixels.get(original.frame.k),
      originalLogoPixels(original.frame),
      'live frame ' + original.frame.k,
    );
    console.log(
      JSON.stringify({
        nmis,
        moved: moved.length,
        frameBytesDiffering: diff.length,
        frame: original.frame.k,
      }),
    );
  },
);
// Select opens the group overview (E014/ED3C, F963 window product from the
// PPU multiplier, FB39 text mask read back from VRAM by channel 5); B closes it.
const SELECT = [
  ...Array(20).fill(0),
  ...Array(6).fill(0x2000),
  ...Array(64).fill(0),
  ...Array(6).fill(0x8000),
  ...Array(20).fill(0),
];
test(
  'the live group overview uses the PPU multiplier and VRAM text mask like the original',
  { skip: exe ? false : reason, timeout: 900000 },
  async () => {
    const { original, native, frameBytes, moved, lag } = await both(SELECT, 60);
    assert.deepEqual(
      lag.map((o) => [o.k, o.pc.toString(16), o.reason]),
      [],
      'no original lag frame in this sequence',
    );
    const { nmis, ...context } = original.context;
    assert.equal(native.nmis, nmis);
    assert.deepEqual(gameContext(native.context), gameContext(context));
    const diff = [];
    for (let n = 0; n < 0x20000; n++) if (native.wram[n] !== original.wram[n]) diff.push(n);
    const unexplained = diff.filter((n) => !frameBytes.has(n) && !inCpuStack(n));
    assert.deepEqual(
      unexplained.map((n) => n.toString(16)),
      [],
      'WRAM differs outside hardware frames and free stack bytes',
    );
    for (const name of ['sram', 'vram', 'cgram', 'oam'])
      assert.deepEqual(native[name], original[name], name);
    assert.deepEqual(
      native.pixels.get(original.frame.k),
      originalLogoPixels(original.frame),
      'live frame ' + original.frame.k,
    );
    console.log(JSON.stringify({ nmis, moved: moved.length, frame: original.frame.k }));
  },
);
// Y opens the item list (E014/EA8E): the status window E433 drives the edges of
// window 1 by H-DMA channel 0 (table 80:E480 at 7E1F3F, Book I appendix B-2),
// BG1/BG2 are masked inside it (212E), and its 64x64 OBJ exceed the 32 OBJ and
// 34 tiles of a line (chapter 20) in pictures 81-83; B closes it. Those
// pictures also have PPU writes in work code (raster unknown; the original's
// varies between recordings), and the original takes lag frames from NMI 81 on.
// So a picture is compared at its own NMI only while the menu rests, and the
// opening pictures must occur in the native sequence.
const ITEMS = [
  ...Array(20).fill(0),
  ...Array(6).fill(0x4000),
  ...Array(124).fill(0),
  ...Array(6).fill(0x8000),
];
test(
  'the live item list with H-DMA window and OBJ line limits matches the original',
  { skip: exe ? false : reason, timeout: 900000 },
  async () => {
    const shots = [90, 95, 150, 160];
    const { original, native, lag } = await both(ITEMS, 40, shots);
    assert.deepEqual(
      lag.map((o) => o.k),
      [
        81, 82, 83, 84, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 153, 154, 165, 166, 167,
        168, 169, 170, 189,
      ],
    );
    assert.deepEqual(
      native.frames.filter((f) => f.k >= 81 && f.k <= 83).map((f) => f.raster),
      [3, 1, 4],
    );
    assert.ok(native.frames.filter((f) => f.k >= 140 && f.k <= 160).every((f) => f.raster === 0));
    assert.deepEqual(
      native.frames
        .filter((f) => f.hdma)
        .map((f) => f.k)
        .filter((k, i, a) => !i || a[i - 1] !== k - 1),
      [84],
      'one H-DMA period',
    );
    const picture = (k) => originalLogoPixels(original.pictures.get(k));
    for (const k of [150, 160])
      assert.deepEqual(native.pixels.get(k), picture(k), 'resting picture ' + k);
    for (const k of [90, 95])
      assert.ok(
        [...native.pixels.values()].some((p) => Buffer.from(p).equals(Buffer.from(picture(k)))),
        'opening picture ' + k,
      );
    closedLikeOriginal(original, native);
  },
);
// After closing a menu: the same state, except the lag NMIs the original took
// (two here) in the NMI counters 1C76/1C78/1CBA and stale interrupt frame bytes below S.
function closedLikeOriginal(original, native) {
  const { nmis, ...context } = original.context;
  assert.equal(nmis, native.nmis + 2);
  assert.deepEqual(gameContext(native.context), gameContext(context));
  const diff = [];
  for (let n = 0; n < 0x20000; n++) if (native.wram[n] !== original.wram[n]) diff.push(n);
  assert.ok(
    diff.every(
      (n) =>
        ([0x1c76, 0x1c78, 0x1cba].includes(n) && original.wram[n] === native.wram[n] + 2) ||
        inCpuStack(n),
    ),
    'WRAM ' + diff.map((n) => n.toString(16)).join(),
  );
  for (const name of ['sram', 'vram', 'cgram', 'oam'])
    assert.deepEqual(native[name], original[name], name);
  assert.deepEqual(
    native.pixels.get(native.nmis),
    originalLogoPixels(original.frame),
    'final frame',
  );
}
// R after walking right: A985/D15C reads its record pointer through [DP00] from
// 8C:6AA1, where nothing is mapped; the original gets the open bus (8C, 8C).
const OPEN_BUS = [...Array(11).fill(0x100), 0x10, ...Array(20).fill(0x8000)];
test(
  'the open-bus record pointer read after R matches the original',
  { skip: exe ? false : reason, timeout: 900000 },
  async () => {
    const { original, native, frameBytes, lag } = await both(OPEN_BUS, 40);
    assert.deepEqual(lag, [], 'no original lag frame in this sequence');
    const { nmis, ...context } = original.context;
    assert.equal(native.nmis, nmis);
    assert.deepEqual(gameContext(native.context), gameContext(context));
    const diff = [];
    for (let n = 0; n < 0x20000; n++) if (native.wram[n] !== original.wram[n]) diff.push(n);
    const unexplained = diff.filter((n) => !frameBytes.has(n) && !inCpuStack(n));
    assert.deepEqual(
      unexplained.map((n) => n.toString(16)),
      [],
      'WRAM differs outside hardware frames and free stack bytes',
    );
    for (const name of ['sram', 'vram', 'cgram', 'oam'])
      assert.deepEqual(native[name], original[name], name);
    assert.deepEqual(
      native.pixels.get(original.frame.k),
      originalLogoPixels(original.frame),
      'live frame ' + original.frame.k,
    );
  },
);
// Start opens the status screen (E014/EA89, OBJ beyond the line limits while
// it is set up), B closes it: the resting picture and the state afterwards.
const STATUS = [
  ...Array(20).fill(0),
  ...Array(6).fill(0x1000),
  ...Array(150).fill(0),
  ...Array(6).fill(0x8000),
];
test(
  'the live status screen matches the original while resting and after closing',
  { skip: exe ? false : reason, timeout: 900000 },
  async () => {
    const { original, native, lag } = await both(STATUS, 40, [150]);
    assert.deepEqual(
      lag.map((o) => o.k),
      [81, 82, 83, 84, 94, 95, 96, 97, 112, 113, 179, 180, 191, 192, 193, 194, 195, 196, 215],
    );
    assert.deepEqual(
      native.frames.filter((f) => f.raster).map((f) => f.k),
      [23, 81, 82, 83, 94, 191, 194],
    );
    assert.deepEqual(
      native.pixels.get(150),
      originalLogoPixels(original.pictures.get(150)),
      'resting picture',
    );
    closedLikeOriginal(original, native);
  },
);
// Leaving the morgue live (MORGUE_EXIT_PLAN, glove closed-loop on the native
// state): forced blank while the hallway loads, then a fade-in over 2100
// brightness 1-14 (Book I PDF 115: 16 steps, no digital formula). The original
// has 19 more lag NMIs on this way, so its game state differs from the native
// one; the pictures are checked against the native renderer on the original's
// own PPU state (mesen-ppu-state.mjs): each 5-bit component c gives c*b/15.
// Mesen's picture at an end of frame is sometimes still the previous frame
// (seen in transitions); a picture must equal the rendering of the PPU state
// at its own end of frame or at the one before.
test(
  'leaving the morgue live, and the fade-in brightness of the original PPU state',
  { skip: exe ? false : reason, timeout: 900000 },
  async () => {
    const bundle = JSON.parse(gunzipSync(readFileSync('assets/room-observations.json.gz')));
    const room = new ObservedRoom(rom, bundle);
    room.finish();
    const driver = livePlanDriver(MORGUE_EXIT_PLAN, room.memory.wram),
      brightness = [];
    const frames = room.live({
      pad: driver.pad,
      onFrame: (f) => (brightness[f.nmi] = room.bus.ppu.registers[0]),
    });
    while (frames.nmis < 2400) room.stepLive({ mainBudget: 4096, opcodeBudget: 4096 });
    assert.ok(driver.done(), 'whole plan played');
    const fade = brightness.map((b, k) => [k, b]).filter(([k, b]) => k > 2000 && b !== 15);
    assert.ok(
      fade.some(([, b]) => b === 0x80) &&
        [...Array(14)].every((_, n) => fade.some(([, b]) => b === n + 1)),
      'forced blank, then brightness 1-14',
    );
    const shots = [...Array(34)].map((_, n) => 2118 + n).concat([2300]);
    const original = await recordLiveRoom(
      exe,
      driver.pads,
      room.driver.roundsCompleted - bundle.rounds,
      { shots, shotPpu: true },
    );
    const current = new Set(),
      same = (a, b) => Buffer.from(a.buffer).equals(Buffer.from(b.buffer));
    let previous = null;
    for (const k of shots) {
      const picture = original.pictures.get(k),
        expected = originalLogoPixels(picture),
        own = renderMode1Frame(ppuFromMesen(picture.ppu), { objects: true });
      if (same(expected, own)) {
        if (picture.ppu.fields.forcedBlank === 'false')
          current.add(Number(picture.ppu.fields.screenBrightness));
      } else
        assert.ok(
          previous?.k === k - 1 && same(expected, previous.own),
          'picture ' + k + ' is neither its own nor the previous end of frame',
        );
      previous = { k, own };
    }
    assert.ok(
      current.has(15) && [...current].filter((b) => b > 0 && b < 15).length >= 10,
      'own pictures at most fade brightnesses: ' + [...current],
    );
  },
);
// Known model limit: the original takes live NMI 95 inside work code at
// 80:9F34 even without input; the lag-free model reaches that NMI at ACB2.
test(
  'the original lag frame after the room recording is reported, not hidden',
  { skip: exe ? false : reason, timeout: 900000 },
  async () => {
    const { original, native, lag } = await both(Array(120).fill(0), 120);
    assert.deepEqual(
      lag.map((o) => [o.k, o.pc, o.s, o.reason]),
      [
        [95, 0x809f34, 0x125, 'position'],
        [96, 0x81acb2, 0x12e, 'position'],
      ],
    );
    assert.equal(original.context.nmis, native.nmis + 1);
  },
);
