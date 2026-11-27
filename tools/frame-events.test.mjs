import test from 'node:test';
import assert from 'node:assert/strict';
// The lag-free frame model (src/vm/frame-events.mjs): blocking branches, its
// boundaries, recorded device streams and the PPU multiplier. The cases that ran the
// register-level wait loops, game NMI and random routine went with proof/ (user
// decision 2026-11-27).
import {
  LagFreeFrames,
  LiveDevices,
  BLOCKING_BRANCHES,
  PAD_BUTTONS,
} from '../src/vm/frame-events.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { DialogTestMemory, rom } from './task-native-dialog-harness.mjs';

// No NMI handler runs in these cases.
const NO_NMI_ROUTINES = new Map();
const romAt = (address) => rom[((address >>> 16) & 0x7f) * 0x8000 + (address & 0x7fff)];
// Synthetic WRAM; not a PAL timing fixture.
function side({
  bank = 0x80,
  pad = 0x8000,
  nmitimen = 0x81,
  pc = 0x81b0a1,
  returnBank = 0x80,
} = {}) {
  const mem = new DialogTestMemory(new Uint8Array(0x20000), null, rom);
  for (const [at, value] of [
    [0x6e, 0xc152],
    [0x1c76, 0xffff],
    [0x140, 0xffff],
    [0xcd8, 1],
    [0x1ca, 0x1111],
  ])
    mem.write16(at, value);
  mem.write8(0x70, 0x80);
  const a = new TaskAccessor({
    mem,
    a: 0xbead,
    x: 0xabcd,
    y: 0x3456,
    s: 0x1eed,
    d: 0,
    dbr: bank,
    p: 0x41,
    pc: pc & 65535,
  });
  a.load();
  a.ctx.e = 0;
  a.ctx.programBank = pc >>> 16;
  const h = dialogAccess(a);
  // The caller's long JSL frame, returned by the original RTL.
  h.pushByte(returnBank);
  a.pushWord(0x1234);
  const pads = [];
  const frames = new LagFreeFrames({
    nmitimen: nmitimen ?? undefined,
    pad: () => {
      pads.push(pad);
      return pad;
    },
  });
  a.devices = new LiveDevices(frames, NO_NMI_ROUTINES);
  a.io = Object.freeze([]);
  a.trace = [];
  return {
    mem,
    a,
    h,
    frames,
    pads,
    events: { interrupts: frames, interruptRoutines: NO_NMI_ROUTINES },
  };
}
test('every blocking branch is the original backward branch onto its read, with the ROM condition', () => {
  const conditions = { 0xf0: [2, true], 0xd0: [2, false], 0x10: [0x80, false] };
  for (const [pc, loops] of BLOCKING_BRANCHES) {
    const [flag, set] = conditions[romAt(pc)] ?? assert.fail(pc.toString(16)),
      offset = romAt(pc + 1) - 256,
      read = pc + 2 + offset;
    assert.ok(offset < 0 && [0xad, 0xcf].includes(romAt(read)), pc.toString(16));
    assert.equal(loops(set ? flag : 0), true);
    assert.equal(loops(set ? 0 : flag), false);
  }
  // C118 LDA 4210 is followed by TSC; 9E0B LDA 4212 by AND #0001 / BNE; 9E13 LDA 4218.
  assert.deepEqual(
    [0xc118, 0xc119, 0xc11a, 0xc11b].map((o) => romAt(o)),
    [0xad, 0x10, 0x42, 0x3b],
  );
  assert.deepEqual(
    [...Array(10)].map((_, n) => romAt(0x809e0b + n)),
    [0xad, 0x12, 0x42, 0x29, 0x01, 0x00, 0xd0, 0xf8, 0xad, 0x18],
  );
  assert.equal(PAD_BUTTONS, 0xfff0);
});

test('NMITIMEN, pad words and nested NMIs are boundaries, never assumptions', () => {
  // The original writes NMITIMEN through the device port; a later wait uses it.
  const v = side({ nmitimen: null });
  v.a.devices.write(0x80ffff, 0x804200, 0x81, 1);
  assert.equal(v.frames.nmitimen, 0x81);
  v.a.devices.write(0x80ffff, 0x7e4200, 0x00, 1);
  assert.equal(v.frames.nmitimen, 0x81);
  v.a.devices.write(0x80ffff, 0x0041ff, 0x0100, 2);
  assert.equal(v.frames.nmitimen, 0x01);
  const nested = new LagFreeFrames({ nmitimen: 0x81 });
  nested.enterNmi();
  assert.throws(
    () => nested.nmiAt(2, 0x81b0a9),
    (e) => e.reason === 'frame_nested_nmi',
  );
  // Outside an NMI and for any other read the live source has no answer.
  assert.equal(nested.read(0x4218, 2, 0x809e13), 0x0000);
  nested.leaveNmi();
  assert.equal(nested.read(0x4218, 2, 0x809e13), undefined);
  nested.enterNmi();
  for (const [address, width, pc] of [
    [0x4212, 1, 0x809e0b],
    [0x4212, 2, 0x81eec2],
    [0x2140, 1, 0x81f00e],
    [0x4219, 2, 0x809e13],
  ])
    assert.equal(nested.read(address, width, pc), undefined);
  assert.throws(
    () => new LagFreeFrames({ nmitimen: 256 }),
    (e) => e.reason === 'frame_nmitimen_required',
  );
  assert.throws(
    () => new LiveDevices(nested, null),
    (e) => e.reason === 'frame_devices_required',
  );
});

test('recorded device streams are consumed before a live device answers', () => {
  const v = side();
  v.a.io = Object.freeze([{ pc: 0x809e0b, address: 0x804212, width: 2, value: 1 }]);
  // The first read must match its record; a mismatch is not replaced by the live source.
  v.a.ctx.bank = 0x80;
  v.frames.enterNmi();
  assert.throws(
    () => v.a.absoluteRead(0x4218, 2, 0x809e13),
    (e) => e.reason === 'device_observation_required',
  );
  assert.equal(v.a.absoluteRead(0x4212, 2, 0x809e0b), 1);
  assert.equal(v.a.absoluteRead(0x4212, 2, 0x809e0b), 0);
});

test('the PPU multiplier is signed 16 x 8 bits and rejects an interleaved latch', async () => {
  const { newPicture, writeRegisters } = await import('./picture-fixture.mjs');
  const operands = (a, b) => {
    const p = newPicture();
    writeRegisters(p, [
      [0x211b, a & 255],
      [0x211b, a >>> 8],
      [0x211c, b],
    ]);
    return p;
  };
  const product = (a, b) => {
    const p = operands(a, b);
    return [0x2134, 0x2135, 0x2136]
      .map((port) => p.readProduct(port))
      .reduce((x, v, n) => x | (v << (8 * n)), 0);
  };
  // Book I PDF 124/134: two's complement operands and 24-bit result.
  for (const [a, b, expected] of [
    [0x0003, 0x05, 15],
    [0xffff, 0x02, 0xfffffe],
    [0x8000, 0x80, 0x400000],
    [0x7fff, 0x7f, 0x3f7f81],
    [0x1234, 0xff, 0xffedcc],
  ])
    assert.equal(product(a, b), expected, a.toString(16) + '*' + b.toString(16));
  const p = newPicture();
  p.writeRegister(0x211b, 1);
  assert.throws(
    () => p.writeRegister(0x211c, 1),
    (e) => e.reason === 'picture_multiplier_pair_required',
  );
  // Live devices answer 2134 from the picture hardware; without it the text mask DMA
  // is a boundary.
  const q = operands(7, 6);
  const frames = new LagFreeFrames({ nmitimen: 0x81 }),
    live = new LiveDevices(frames, NO_NMI_ROUTINES, {
      bus: { write() {}, readProduct: (port) => q.readProduct(port) },
    });
  assert.equal(live.read(0x802134, 2, 0x80fa01), 42);
  assert.equal(live.read(0x802136, 1, 0x80fa19), 0);
  assert.equal(live.read(0x7e2134, 2, 0x80fa01), undefined);
  const bare = new LiveDevices(frames, NO_NMI_ROUTINES);
  assert.throws(
    () => bare.write(0x81aa93, 0x80420b, 0x20, 1),
    (e) => e.reason === 'frame_text_dma_device_required',
  );
  bare.write(0x81aa40, 0x80420b, 0x80, 1);
  assert.equal(bare.read(0x802134, 2, 0x80fa01), undefined);
});
