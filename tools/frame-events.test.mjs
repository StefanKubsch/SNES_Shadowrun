import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LagFreeFrames,
  LiveDevices,
  BLOCKING_BRANCHES,
  PAD_BUTTONS,
  counterBytes,
} from '../src/vm/frame-events.mjs';
import { runInterruptWordWait } from '../proof/system/main-word-wait.mjs';
import {
  waitForRandomStateChangeWithInterrupts,
  ObservedWaitContinuation,
} from '../proof/system/main-wait-interrupt.mjs';
import { waitWord } from '../proof/system/native-dialog-portrait.mjs';
import { GAME_NMI_ROUTINES } from '../proof/replay/main-game-nmi.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { DialogTestMemory, rom } from './task-native-dialog-harness.mjs';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { ObservedRoom } from '../proof/video/room-observed.mjs';

const romAt = (address) => rom[((address >>> 16) & 0x7f) * 0x8000 + (address & 0x7fff)];
// Synthetic WRAM for the original game NMI C152; not a PAL timing fixture.
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
  a.devices = new LiveDevices(frames, GAME_NMI_ROUTINES);
  a.io = Object.freeze([]);
  a.trace = [];
  return {
    mem,
    a,
    h,
    frames,
    pads,
    events: { interrupts: frames, interruptRoutines: GAME_NMI_ROUTINES },
  };
}
// The same original wait with explicit records and device observations.
function recorded(nmiAt, { bank = 0x80, pad = 0x8000 } = {}) {
  const v = side({ bank, pad });
  const records = [
    [0x81b0a1, false],
    ...(nmiAt === 0x81b0a5
      ? [
          [0x81b0a5, true],
          [0x81b0a9, false],
        ]
      : [
          [0x81b0a5, false],
          [0x81b0a9, true],
          [0x81b0a5, false],
          [0x81b0a9, false],
        ]),
    [0x81b0ab, false],
  ];
  v.events = {
    interrupts: Object.freeze(records.map(([pc, nmi]) => Object.freeze({ pc, nmi }))),
    interruptIndex: 0,
    interruptRoutines: GAME_NMI_ROUTINES,
  };
  // Bits outside the documented contract differ from the live answers on purpose.
  v.a.io = Object.freeze([
    ...(bank === 0x7e
      ? []
      : [{ pc: 0x00c118, address: (bank << 16) | 0x4210, width: 2, value: 0x7f82 }]),
    { pc: 0x809e0b, address: 0x4212, width: 2, value: 0xfffe },
    { pc: 0x809e13, address: 0x4218, width: 2, value: pad },
  ]);
  v.a.devices = { write() {} };
  return v;
}
const snapshot = (v) => ({ ctx: { ...v.a.ctx }, wram: v.mem.wram.slice() });
const trace = (v) => v.a.trace.filter((o) => o.kind === 'write');

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

test('lag-free B0A1 equals the original record with its NMI at the same branch, for every DBR', () => {
  for (const bank of [0, 0x80, 0x81, 0x7e]) {
    const live = side({ bank }),
      rec = recorded(0x81b0a9, { bank });
    waitForRandomStateChangeWithInterrupts(live.h, live.events);
    waitForRandomStateChangeWithInterrupts(rec.h, rec.events);
    assert.deepEqual(snapshot(live), snapshot(rec));
    assert.deepEqual(trace(live), trace(rec));
    assert.equal(rec.events.interruptIndex, rec.events.interrupts.length);
    assert.equal(rec.a.ioIndex, rec.a.io.length);
    assert.equal(live.frames.nmis, 1);
    assert.deepEqual(live.pads, [0x8000]);
    assert.equal(live.mem.read16(0x1ca), 0x8000);
    assert.equal(live.a.ctx.programBank, 0x80);
    assert.equal(live.a.ctx.pc, 0x1235);
    assert.equal(live.frames.inNmi, false);
  }
});

test('another NMI position in the same loop differs only in the hardware frame below S', () => {
  const at = recorded(0x81b0a5),
    branch = side();
  waitForRandomStateChangeWithInterrupts(at.h, at.events);
  waitForRandomStateChangeWithInterrupts(branch.h, branch.events);
  assert.deepEqual(at.a.ctx, branch.a.ctx);
  const s = 0x1eed - 3,
    diff = [];
  for (let n = 0; n < 0x20000; n++) if (at.mem.wram[n] !== branch.mem.wram[n]) diff.push(n);
  // PB, PCH, PCL, P pushed at S..S-3 before the handler switches to 1CBB.
  assert.ok(
    diff.length > 0 && diff.every((n) => n >= s - 3 && n <= s),
    diff.map((n) => n.toString(16)).join(),
  );
});

test('non-blocking reads take no NMI; inline waits take one NMI per blocked iteration', () => {
  const free = side({ pc: 0x81acaf });
  free.mem.write16(0x1f8, 0);
  runInterruptWordWait(free.h, free.events, 0x81acaf);
  assert.equal(free.frames.nmis, 0);
  assert.equal(free.mem.read16(0x1c76), 0xffff);
  // 8FBA in the NMI stores FFFF to 0140; BPL at 901F then falls through.
  const inline = side({ pc: 0x80901c });
  inline.mem.write16(0x140, 0);
  inline.a.ctx.programBank = 0x80;
  waitWord(inline.h, inline.events, 0x80901c, 0x140);
  assert.equal(inline.frames.nmis, 1);
  assert.equal(inline.mem.read16(0x140), 0xffff);
  assert.equal(inline.mem.read16(0x1c76), 0);
  assert.equal(inline.a.ctx.pc, 0x901f);
});

test('the resumable wait owner matches the synchronous lag-free result at budget one', () => {
  const sync = side(),
    cont = side();
  waitForRandomStateChangeWithInterrupts(sync.h, sync.events);
  const c = new ObservedWaitContinuation(cont.h, cont.events, 0x81b0a1);
  assert.equal(c.run(0), WAIT_PAUSED);
  let pauses = 0;
  while (c.run(1) === WAIT_PAUSED) assert.ok(++pauses < 500);
  assert.ok(pauses > 10);
  assert.deepEqual(snapshot(cont), snapshot(sync));
  assert.deepEqual(trace(cont), trace(sync));
  assert.deepEqual(cont.pads, [0x8000]);
  assert.equal(c.run(5), WAIT_RETURNED);
});

test('NMITIMEN, pad words and nested NMIs are boundaries, never assumptions', () => {
  for (const [nmitimen, reason] of [
    [null, 'frame_nmitimen_required'],
    [0x01, 'frame_nmi_disabled'],
    [0x80, 'frame_joypad_disabled'],
  ]) {
    const v = side({ nmitimen });
    assert.throws(
      () => waitForRandomStateChangeWithInterrupts(v.h, v.events),
      (e) => e.reason === reason,
    );
  }
  for (const pad of [0x0001, 0x10000, -1, 0.5]) {
    const v = side({ pad });
    assert.throws(
      () => waitForRandomStateChangeWithInterrupts(v.h, v.events),
      (e) => e.reason === 'frame_pad_word_required',
    );
  }
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

// Not an original comparison: the lag-free model continues the same native
// owner after the complete first-room replay with a live pad.
const bundle = JSON.parse(gunzipSync(readFileSync('assets/room-observations.json.gz')));
function liveRoom(padAt, count) {
  const room = new ObservedRoom(rom, bundle);
  assert.throws(
    () => room.live({ pad: () => 0 }),
    (e) => e.reason === 'room_replay_incomplete',
  );
  room.finish();
  const hashes = [],
    raster = [];
  let nmi = 0;
  const frames = room.live({
    pad: (k) => padAt(k),
    onFrame: (f) => {
      assert.equal(f.nmi, nmi);
      nmi++;
      hashes.push(createHash('sha256').update(f.pixels).digest('hex'));
      raster.push(f.rasterWrites);
    },
  });
  assert.equal(frames.nmitimen, 0x81);
  assert.throws(
    () => room.live({ pad: () => 0 }),
    (e) => e.reason === 'room_replay_incomplete',
  );
  while (frames.nmis < count) room.stepLive();
  return { room, frames, hashes, raster, wram: room.memory.wram.slice() };
}
test('the first room continues live with lag-free frames and a live pad', () => {
  const down = (at) => (at < 40 ? 0 : 0x0400),
    a = liveRoom(down, 160),
    b = liveRoom(down, 160),
    idle = liveRoom(() => 0, 160);
  // NMITIMEN comes from the replay's own last write (0x81 at 80:9671).
  assert.equal(a.hashes.length, 160);
  assert.deepEqual(a.hashes, b.hashes);
  assert.deepEqual(a.wram, b.wram);
  assert.ok(a.raster.every((n) => n === 0));
  assert.deepEqual(a.hashes.slice(0, 41), idle.hashes.slice(0, 41));
  assert.notDeepEqual(a.hashes.slice(41), idle.hashes.slice(41));
  assert.notDeepEqual(a.wram, idle.wram);
  // 9E0B stored the last latched live word at 01CA.
  assert.equal((a.room.memory.wram[0x1cb] << 8) | a.room.memory.wram[0x1ca], 0x0400);
  assert.throws(
    () => new ObservedRoom(rom, bundle).stepLive(),
    (e) => e.reason === 'room_live_required',
  );
});

test('the PPU multiplier is signed 16 x 8 bits and rejects an interleaved latch', async () => {
  const { PpuState } = await import('../src/video/ppu-state.mjs');
  const product = (a, b) => {
    const p = new PpuState();
    p.writeByte(0x211b, a & 255);
    p.writeByte(0x211b, a >>> 8);
    p.writeByte(0x211c, b);
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
  const p = new PpuState();
  assert.throws(
    () => p.readProduct(0x2134),
    (e) => e.reason === 'ppu_multiplier_operands_required',
  );
  p.writeByte(0x211b, 1);
  assert.throws(
    () => p.writeByte(0x211c, 1),
    (e) => e.reason === 'ppu_multiplier_latch_required',
  );
  // Live devices answer 2134 from the picture hardware (here the PPU model); without
  // a PPU the text mask DMA is a boundary.
  const q = new PpuState();
  q.writeByte(0x211b, 7);
  q.writeByte(0x211b, 0);
  q.writeByte(0x211c, 6);
  const frames = new LagFreeFrames({ nmitimen: 0x81 }),
    live = new LiveDevices(frames, GAME_NMI_ROUTINES, {
      bus: { ppu: q, write() {}, readProduct: (port) => q.readProduct(port) },
    });
  assert.equal(live.read(0x802134, 2, 0x80fa01), 42);
  assert.equal(live.read(0x802136, 1, 0x80fa19), 0);
  assert.equal(live.read(0x7e2134, 2, 0x80fa01), undefined);
  const bare = new LiveDevices(frames, GAME_NMI_ROUTINES);
  assert.throws(
    () => bare.write(0x81aa93, 0x80420b, 0x20, 1),
    (e) => e.reason === 'frame_text_dma_device_required',
  );
  bare.write(0x81aa40, 0x80420b, 0x80, 1);
  assert.equal(bare.read(0x802134, 2, 0x80fa01), undefined);
});

test('the live random substitute feeds only the two used counter bytes of C560', async () => {
  const { randomBelow } = await import('../proof/replay/native-random.mjs');
  // ROM: C566 LDA 2137, C569 LDA C58D,Y (dead read); C572 EOR 213C; C57F EOR 213D.
  assert.deepEqual(
    [0xc566, 0xc569, 0xc572, 0xc57f].map((o) => romAt(0x800000 | o)),
    [0xad, 0xb9, 0x4d, 0x4d],
  );
  assert.deepEqual(
    [0xc567, 0xc568, 0xc573, 0xc574, 0xc580, 0xc581].map((o) => romAt(0x800000 | o)),
    [0x37, 0x21, 0x3c, 0x21, 0x3d, 0x21],
  );
  // Five rolls on the same WRAM: the counter bytes reach the high byte and
  // the next state 1CE8, so they change later rolls, not the first low byte.
  const roll = (counter, limit = 6) => {
    const v = side({ pc: 0x80c51f });
    v.a.ctx.bank = 0x80;
    const reads = [],
      values = [];
    let attempts = 0;
    v.a.devices = new LiveDevices(v.frames, GAME_NMI_ROUTINES, {
      counter: (port, pc) => {
        const b = counter();
        reads.push([port, pc]);
        return b;
      },
    });
    for (let n = 0; n < 5; n++) {
      v.a.ctx.programBank = 0x80;
      v.a.ctx.pc = 0xc51f;
      v.mem.write16(0, limit);
      v.a.pushWord(0x4321);
      attempts += randomBelow(v.a).attempts;
      values.push(v.mem.read16(0));
      assert.equal(v.a.ctx.pc, 0x4322);
    }
    return { value: values.join(), values, state: v.mem.read8(0x1ce8), attempts, reads };
  };
  const a = roll(counterBytes()),
    b = roll(counterBytes()),
    c = roll(counterBytes(7));
  assert.deepEqual(a, b, 'same seed, same rolls');
  assert.ok(a.values.every((v) => v <= 6));
  assert.equal(a.reads.length, 2 * a.attempts);
  assert.ok(
    a.reads.every(([port, pc], n) =>
      n % 2 ? port === 0x213d && pc === 0x80c57f : port === 0x213c && pc === 0x80c572,
    ),
  );
  // Explicit original bytes (oracle mode) drive the same equations.
  const bytes = [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0];
  let i = 0;
  assert.deepEqual(
    roll(() => bytes[i++ % 8]),
    ((i = 0), roll(() => bytes[i++ % 8])),
  );
  const values = new Set();
  for (let seed = 1; seed < 40; seed++) values.add(roll(counterBytes(seed)).value);
  assert.ok(values.size > 3, 'different seeds give different rolls ' + [...values]);
  assert.throws(
    () => roll(() => 256),
    (e) => e.reason === 'frame_counter_byte_required',
  );
  assert.throws(
    () => counterBytes(0),
    (e) => e.reason === 'frame_counter_seed_required',
  );
  assert.ok(c.values.every((v) => v <= 6));
});
