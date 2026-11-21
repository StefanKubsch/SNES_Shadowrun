import test from 'node:test';
import assert from 'node:assert/strict';
import {
  drawWindowListSequence,
  requestUploadCall,
  resetWindowList,
} from '../src/game/window-list.mjs';
import { openWindow, requestTileClear } from '../src/game/window-open.mjs';
import {
  releaseWindowSequence,
  releaseNoticeWindowsSequence,
  putGloveAwaySequence,
} from '../src/game/window-release.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { LagFreeFrames } from '../src/vm/frame-events.mjs';
import { prepareWindowListSequence } from '../src/game/glove-target.mjs';
import { createSide } from './lift-function-harness.mjs';
import { windowMapSource } from './lift-window-samples.mjs';
import * as W from '../src/data/wram.mjs';

function fixture(request) {
  const side = createSide({ seed: 1, wram: new Uint8Array(0x20000) }, new Map());
  const { mem, h, a } = side;
  windowMapSource(mem.wram, mem);
  const put = (at, value) => mem.write16(0x7e0000 | at, value);
  for (const [at, value] of [
    [W.WINDOW_LAST_INDEX, 0],
    [W.WINDOW_ACTIVE, 1],
    [W.WINDOW_COLUMNS, 3],
    [W.WINDOW_ROWS, 3],
    [W.WINDOW_TILE_START, 0x2027],
    [W.WINDOW_TILE_INITIAL, 0x2027],
    [W.WINDOW_TILE_COUNT, 1],
    [W.WINDOW_NEXT_TILE, 0x2028],
    [W.GLOVE_TARGET_TAG, 0],
    [W.GLOVE_NAME_WINDOW, 0],
    [W.TEXT_MAP_UPLOAD, request],
    [W.TEXT_TILE_UPLOAD, request],
    [0, 1],
    [2, 1],
    [4, 3],
    [6, 3],
    [8, 0x2400],
  ])
    put(at, value);
  for (let at = 0; at <= W.NOTICE_WINDOW_LAST; at += 2)
    put(W.NOTICE_WINDOWS + at, at === 0 ? 0 : 0xffff);
  // Release/tile-clear entry uses window zero; opening replaces these arguments.
  put(0, 0);
  const read = a.devices.read;
  a.devices.read = (address, width) => ((address & 0xffff) === 0x2134 ? 1 : read(address, width));
  Object.assign(h.ctx, { programBank: 0x84, bank: 0x81, pc: 0x5678, status: 0xa5 });
  const context = { ...h.ctx };
  const stack = mem.wram.slice(0x100, 0x1ca);
  const unchanged = () => {
    assert.deepEqual(h.ctx, context, 'window flow preserves every CPU register');
    assert.deepEqual(mem.wram.slice(0x100, 0x1ca), stack, 'window flow never writes the CPU stack');
  };
  const polls = [];
  const frames = new LagFreeFrames({ nmitimen: 0x80 });
  const events = {
    interrupts: frames,
    frameJobs: () => assert.fail('fixture services text waits'),
  };
  frames.textWait = (_h, _events, _status, branch) => {
    unchanged();
    const at = branch === 0x81acb2 ? W.TEXT_MAP_UPLOAD : W.TEXT_TILE_UPLOAD;
    assert.ok(branch === 0x81acb2 || branch === 0x81acc0);
    assert.notEqual(mem.read16(at), 0);
    polls.push(branch);
    put(at, 0);
    return true;
  };
  return { ...side, put, events, frames, polls, unchanged };
}

const operations = [
  requestUploadCall,
  drawWindowListSequence,
  resetWindowList,
  openWindow,
  requestTileClear,
  releaseWindowSequence,
  releaseNoticeWindowsSequence,
  putGloveAwaySequence,
  prepareWindowListSequence,
];

for (const operation of operations)
  for (const request of [0, 0xfffe, 0xffff])
    test(`${operation.name} composes without CPU frames, request ${request}`, () => {
      const side = fixture(request);
      const runner = new SequenceRunner(operation(side.h, side.events));
      const before = side.mem.wram.slice();
      assert.equal(runner.run(0), WAIT_PAUSED);
      assert.deepEqual(side.mem.wram, before);
      let steps = 0;
      do {
        runner.run(1);
        side.unchanged();
        assert.ok(++steps < 100, 'bounded window lifecycle');
      } while (!runner.done);
      const tileRequest = operation === openWindow || operation === requestTileClear;
      const mapRequest = operation !== requestTileClear;
      const expected = request === 0xffff ? 0 : Number(tileRequest) + Number(mapRequest);
      assert.equal(side.polls.length, expected, 'each nonzero request is serviced once');
      if (operation === prepareWindowListSequence)
        assert.equal(
          side.mem.read16(W.WINDOW_FIRST_INDEX),
          1,
          'first window follows the last after upload',
        );
      const completed = side.mem.wram.slice();
      runner.run(10);
      assert.deepEqual(side.mem.wram, completed, 'completed calls do not issue more uploads');
    });

for (const operation of [drawWindowListSequence, openWindow, prepareWindowListSequence])
  test(`${operation.name} preserves the caller context when upload service fails`, () => {
    const side = fixture(0);
    const failure = new Error('upload failed');
    side.frames.textWait = () => {
      side.unchanged();
      throw failure;
    };
    const runner = new SequenceRunner(operation(side.h, side.events));
    assert.throws(
      () => runner.run(100),
      (error) => error === failure,
    );
    side.unchanged();
    assert.throws(
      () => runner.run(100),
      (error) => error.reason === 'native_call_failed',
    );
  });
