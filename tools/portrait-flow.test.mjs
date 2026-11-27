// Portrait uploads and window animation compose directly across every budget pause.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  transferPortraitTiles,
  uploadFirstPortrait,
  uploadSecondPortrait,
} from '../src/platform/portrait-tiles.mjs';
import { openPortraitWindow, closePortraitWindow } from '../src/game/portrait-window.mjs';
import { memberPortrait } from '../src/game/member-portrait.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { textWindowSide } from './text-window-caller-harness.mjs';
import { pictureState } from './lift-function-harness.mjs';
import * as W from '../src/data/wram.mjs';

const operations = [
  transferPortraitTiles,
  uploadFirstPortrait,
  uploadSecondPortrait,
  openPortraitWindow,
  closePortraitWindow,
  memberPortrait,
];

function fixture(jobs) {
  const side = textWindowSide(),
    { h, a, mem, put, events } = side;
  put(W.NMI_JOB_LISTS, jobs);
  put(W.RANDOM_STATE, 0xffff);
  put(W.DIALOG_RECORD_FLAGS, 0x80);
  put(W.MEMBER_PORTRAIT, 0x4e);
  Object.assign(h.ctx, { programBank: 0x84, bank: 0x81, pc: 0x5678, status: 0xa5, s: 0x1eef });
  const context = { ...h.ctx },
    stack = mem.wram.slice(0x1e80, 0x1ef0);
  const unchanged = () => {
    assert.deepEqual(h.ctx, context, 'portrait flow preserves the CPU context');
    assert.deepEqual(mem.wram.slice(0x1e80, 0x1ef0), stack, 'portrait flow preserves the stack');
  };
  const forbidden = () => assert.fail('portrait flow must not use CPU call or return helpers');
  h.push = h.pushByte = h.rts = h.rtl = a.pushWord = forbidden;
  const polls = [];
  let requests = 0;
  events.frameJobs = () => assert.fail('fixture services every wait');
  events.interrupts.textWait = (_h, _events, _status, branch) => {
    unchanged();
    polls.push(branch);
    if (branch === 0x80901f) {
      if (++requests % 3 === 0)
        put(W.PORTRAIT_DMA_REQUEST, mem.read16(W.PORTRAIT_DMA_REQUEST) | 0x8000);
    } else {
      assert.equal(branch, 0x81b0a9);
      put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
    }
    return true;
  };
  // Portrait channel set-ups (the 4 KiB of tiles from 7F:5250 on channel 0).
  const setUps = [],
    setUp = side.picture.setUpVramTransfer.bind(side.picture);
  side.picture.setUpVramTransfer = (...args) => {
    setUps.push(args[0]);
    return setUp(...args);
  };
  return { ...side, unchanged, polls, setUps };
}
// One portrait channel set-up, complete on channel 0.
function assertOnePortraitSetUp(side) {
  assert.deepEqual(side.setUps, [0x7f5250]);
  const c = side.picture.channels[0];
  assert.deepEqual([c.mode, c.port, c.bank, c.source, c.bytes], [1, 0x2118, 0x7f, 0x5250, 0x1000]);
}

for (const operation of operations) {
  for (const jobs of [0, 0x7fff, 0xffff])
    test(`${operation.name} preserves CPU context at every pause, jobs ${jobs}`, () => {
      const side = fixture(jobs),
        runner = new SequenceRunner(operation(side.h, side.events, 0));
      const before = side.mem.wram.slice();
      assert.equal(runner.run(0), WAIT_PAUSED);
      assert.deepEqual(side.mem.wram, before);
      let steps = 0;
      do {
        runner.run(1);
        side.unchanged();
        assert.ok(++steps < 1000, 'bounded portrait flow');
      } while (!runner.done);
      const tiles = side.polls.filter((branch) => branch === 0x80901f).length,
        frames = side.polls.filter((branch) => branch === 0x81b0a9).length;
      assert.equal(
        tiles,
        operation === memberPortrait ? 6 : operation.name.includes('Window') ? 0 : 3,
      );
      assert.equal(
        frames,
        operation === memberPortrait || operation.name.includes('Window') ? 11 : 0,
      );
      assert.equal(
        side.mem.read16(W.NMI_JOB_LISTS),
        operation === uploadSecondPortrait || operation === memberPortrait
          ? (jobs + 1) & 0xffff
          : jobs,
      );
      const completed = side.mem.wram.slice(),
        writes = side.writes.length,
        picture = pictureState(side.picture),
        polls = side.polls.length;
      runner.run(1000);
      assert.deepEqual(side.mem.wram, completed);
      assert.equal(side.writes.length, writes);
      assert.deepEqual(pictureState(side.picture), picture);
      assert.equal(side.polls.length, polls, 'completed portraits do not repeat waits');
    });

  test(`${operation.name} propagates wait failure without a CPU frame or replay`, () => {
    const side = fixture(0),
      failure = new Error('portrait wait failed');
    side.events.interrupts.textWait = () => {
      side.unchanged();
      throw failure;
    };
    const runner = new SequenceRunner(operation(side.h, side.events, 0));
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

for (const destination of [0x8000, 0xffff])
  test(`portrait destination ${destination} already has the completed-request bit`, () => {
    const side = fixture(0),
      runner = new SequenceRunner(transferPortraitTiles(side.h, side.events, destination));
    runner.run(100);
    assert.equal(runner.done, true);
    side.unchanged();
    assert.equal(side.polls.length, 0);
    assert.equal(side.mem.read16(W.PORTRAIT_DMA_REQUEST), destination);
    assertOnePortraitSetUp(side);
  });

test('a portrait transfer pauses once per actual frame without repeating its DMA setup', () => {
  const side = fixture(0),
    runner = new SequenceRunner(transferPortraitTiles(side.h, side.events, 0x800));
  let frames = 0;
  side.events.interrupts.textWait = () => false;
  side.events.frameJobs = () => {
    side.unchanged();
    if (++frames === 2) side.put(W.PORTRAIT_DMA_REQUEST, 0x8800);
  };
  assert.equal(runner.run(1000), WAIT_PAUSED);
  assert.equal(frames, 1);
  assert.equal(runner.run(1000), WAIT_PAUSED);
  assert.equal(frames, 2);
  runner.run(1000);
  assert.equal(runner.done, true);
  side.unchanged();
  assertOnePortraitSetUp(side);
});
