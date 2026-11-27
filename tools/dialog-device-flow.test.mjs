// Object tile restoration and dialog closing compose their device waits directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reloadObjectTiles } from '../src/game/object-tiles.mjs';
import { closeDialog, talk } from '../src/game/dialog-talk.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { textWindowSide } from './text-window-caller-harness.mjs';
import * as W from '../src/data/wram.mjs';

function fixture({ tiles = 1, upload = 0, pending = false, jobs = 0 } = {}) {
  const side = textWindowSide(),
    { h, a, mem, put, events } = side,
    serviceUpload = events.interrupts.textWait;
  for (const [at, value] of [
    [W.DRAW_LIST_INDEX, 0],
    [W.DRAW_LIST, 0],
    [W.OBJECT_ACTION_DIRECTIONS, 0x9000],
    [W.OBJECT_FRAME_OFFSET, 2],
    [W.OBJECT_VRAM_SLOT_COUNT, pending ? 0 : tiles],
    [W.OBJECT_VRAM_SLOT_HEAD, 0],
    [W.VRAM_SLOT_NEXT, 2],
    [W.VRAM_SLOT_COUNT, 0],
    [W.OBJECT_PICTURE_CHANGE, pending ? 0x9000 : 0],
    [W.DP_VRAM_UPLOAD_INDEX, upload],
    [W.NMI_JOB_LISTS, jobs],
    [W.RANDOM_STATE, 0xffff],
    [W.HDMAEN_SHADOW, 0xff],
    [W.PAD_HELD, W.PAD_A],
  ])
    put(at, value);
  // The stream identifies a picture; both halves have explicit tile source words.
  // A pending picture needs one slot, made available by the first counter wait.
  const read = mem.read8.bind(mem),
    stream = [0x00, 0x10],
    picture = [0x41, 0x23, 0x82, 0x45];
  mem.read8 = (address) => {
    if (address >= 0x8c9000 && address < 0x8c9000 + stream.length)
      return stream[address - 0x8c9000];
    if (address >= 0x9b9001 && address < 0x9b9001 + picture.length)
      return picture[address - 0x9b9001];
    if (address >= 0x9c9000 && address < 0x9c9010)
      return address === 0x9c9000 ? 1 : (picture[address - 0x9c9001] ?? 0);
    return read(address);
  };
  // Dialog close rebuilds the sprite list; this fixture keeps its object hidden.
  put(W.OBJECT_FLAGS, 0x80);
  Object.assign(h.ctx, { programBank: 0x84, bank: 0x81, pc: 0x5678, status: 0xa5, s: 0x1eef });
  const context = { ...h.ctx },
    stack = mem.wram.slice(0x1e80, 0x1ef0);
  const unchanged = () => {
    assert.deepEqual(h.ctx, context, 'device composition preserves the CPU context');
    assert.deepEqual(
      mem.wram.slice(0x1e80, 0x1ef0),
      stack,
      'device composition preserves the stack',
    );
  };
  const forbidden = () => assert.fail('device composition must not use CPU call or return helpers');
  h.push = h.pushByte = h.rts = h.rtl = a.pushWord = forbidden;
  const polls = [],
    counts = new Map();
  events.frameJobs = () => assert.fail('fixture services every wait');
  events.interrupts.textWait = (_h, _events, _status, branch) => {
    unchanged();
    const count = (counts.get(branch) ?? 0) + 1;
    counts.set(branch, count);
    polls.push({ branch, upload: mem.read16(W.DP_VRAM_UPLOAD_INDEX) });
    if (branch === 0x81b0a9) {
      put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
      if (pending && mem.read16(W.OBJECT_PICTURE_CHANGE) && mem.read16(W.NMI_JOB_LISTS))
        put(W.VRAM_SLOT_COUNT, 8);
    } else {
      assert.ok(branch === 0x80ae61 || branch === 0x80ae0f);
      if (count % 2 === 0) {
        put(W.NMI_JOB_LISTS, 0);
        put(W.DP_VRAM_UPLOAD_INDEX, 0);
      }
    }
    return true;
  };
  return { ...side, unchanged, polls, counts, serviceUpload };
}

for (const operation of [reloadObjectTiles, closeDialog]) {
  for (const options of [
    { tiles: 0 },
    { tiles: 1 },
    { tiles: 1, upload: 0x4c },
    { tiles: 1, upload: 0xffff },
    { pending: true },
    { tiles: 0, jobs: 0xffff },
  ])
    test(`${operation.name} composes device waits directly: ${JSON.stringify(options)}`, () => {
      const side = fixture(options),
        runner = new SequenceRunner(operation(side.h, side.events));
      const before = side.mem.wram.slice();
      assert.equal(runner.run(0), WAIT_PAUSED);
      assert.deepEqual(side.mem.wram, before);
      let steps = 0;
      do {
        runner.run(1);
        side.unchanged();
        assert.ok(++steps < 1000, 'bounded device flow');
      } while (!runner.done);
      assert.equal(side.counts.get(0x80ae61) ?? 0, options.upload === 0x4c ? 2 : 0);
      assert.equal(side.counts.get(0x80ae0f) ?? 0, options.jobs === 0xffff ? 0 : 2);
      assert.equal(
        side.counts.get(0x81b0a9) ?? 0,
        (operation === closeDialog ? 12 : 0) + (options.pending ? 1 : 0),
      );
      if (operation === closeDialog) {
        assert.equal(side.mem.read16(W.TMW_SHADOW), 0);
        assert.equal(side.mem.wram[W.HDMAEN_SHADOW], 0xfe);
        assert.equal(side.mem.read16(W.PAD_PRESSED), W.PAD_A);
      }
      const completed = side.mem.wram.slice(),
        polls = side.polls.length,
        writes = side.writes.length;
      runner.run(1000);
      assert.deepEqual(side.mem.wram, completed);
      assert.equal(side.polls.length, polls);
      assert.equal(side.writes.length, writes);
    });

  for (const branch of [0x80ae61, 0x80ae0f, 0x81b0a9])
    test(`${operation.name} rejects replay after device failure at ${branch.toString(16)}`, () => {
      const side = fixture(branch === 0x81b0a9 ? { pending: true } : { upload: 0x4c }),
        service = side.events.interrupts.textWait,
        failure = new Error('device wait failed');
      side.events.interrupts.textWait = (...args) => {
        side.unchanged();
        if (args[3] === branch) throw failure;
        return service(...args);
      };
      const runner = new SequenceRunner(operation(side.h, side.events));
      assert.throws(
        () => runner.run(1000),
        (error) => error === failure,
      );
      side.unchanged();
      assert.throws(
        () => runner.run(1000),
        (error) => error.reason === 'native_call_failed',
      );
    });
}

for (const failGreeting of [false, true])
  test(`the talk prefix composes portrait and greeting waits directly, failure ${failGreeting}`, () => {
    const side = fixture({ tiles: 0 }),
      { h, mem, put, events } = side;
    put(W.GLOVE_TARGET_TAG, 0xffff);
    put(W.WINDOW_ACTIVE, 0xffff);
    for (let slot = 0; slot <= W.NOTICE_WINDOW_LAST; slot += 2)
      put(W.NOTICE_WINDOWS + slot, 0xffff);
    const service = side.serviceUpload,
      failure = new Error('greeting wait failed');
    let frames = 0,
      transfers = 0;
    events.interrupts.textWait = (...args) => {
      side.unchanged();
      const branch = args[3];
      if (branch === 0x80901f) {
        transfers++;
        put(W.PORTRAIT_DMA_REQUEST, mem.read16(W.PORTRAIT_DMA_REQUEST) | 0x8000);
      } else if (branch === 0x81b0a9) {
        if (++frames === 12 && failGreeting) throw failure;
        put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
      } else return service(...args);
      return true;
    };
    const runner = new SequenceRunner(talk(h, events, undefined, 0x40, 0));
    const advance = () => {
      let steps = 0;
      // Eleven opening frames and sixty-one greeting frames, before the menu.
      while (frames < 72) {
        runner.run(1);
        side.unchanged();
        assert.ok(++steps < 2000, 'bounded talk prefix');
      }
    };
    if (failGreeting) {
      assert.throws(advance, (error) => error === failure);
      assert.throws(
        () => runner.run(1000),
        (error) => error.reason === 'native_call_failed',
      );
    } else advance();
    side.unchanged();
    assert.equal(transfers, 2);
    assert.equal(frames, failGreeting ? 12 : 72);
  });
