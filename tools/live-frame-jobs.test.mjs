import test from 'node:test';
import assert from 'node:assert/strict';
import { runFrameJobs } from '../src/system/live-frame-jobs.mjs';
import { nmiAtBranch } from '../src/system/frame-wait.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../src/system/native-wait-continuation.mjs';
import { LagFreeFrames, LiveDevices } from '../src/vm/frame-events.mjs';
import { interruptEventsOf } from '../src/vm/devices.mjs';
import { DialogTestMemory } from './task-native-dialog-harness.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../src/constants/cpu-flags.mjs';

function side({ frameJobs, nmitimen = 0x81, apu = null } = {}) {
  const mem = new DialogTestMemory(new Uint8Array(0x20000));
  const a = { mem };
  Object.defineProperty(a, 'ctx', {
    get() {
      throw new Error('live frame must not access CPU context');
    },
  });
  const frames = new LagFreeFrames({ nmitimen, apu });
  const devices = new LiveDevices(frames, new Map(), { frameJobs });
  const events = interruptEventsOf(devices.take(0), 0);
  return { mem, a, frames, events, h: { a } };
}

for (const carry of [0, 1]) {
  test(`live frame pauses once and passes carry ${carry} without CPU ownership`, () => {
    let calls = 0;
    const v = side({
      frameJobs(a, input) {
        assert.equal(a, v.a);
        assert.equal(input, carry);
        assert.equal(v.frames.inNmi, true);
        calls++;
      },
    });
    const order = [];
    v.frames.onNmi = () => order.push(calls);
    const runner = new SequenceRunner(
      nmiAtBranch(v.h, v.events, 0x81b0a9, FLAG_ZERO | (carry ? FLAG_CARRY : 0)),
    );
    assert.equal(runner.run(0), WAIT_PAUSED);
    assert.equal(v.frames.nmis, 0);
    assert.equal(runner.run(100), WAIT_PAUSED);
    assert.equal(v.frames.nmis, 1);
    assert.equal(v.frames.inNmi, false);
    assert.equal(calls, 1);
    assert.deepEqual(order, [0]);
    assert.equal(runner.run(100), WAIT_RETURNED);
    assert.equal(runner.run(100), WAIT_RETURNED);
    assert.equal(calls, 1);
  });
}

test('boot frame increments the counter with no vector, CPU stack or NMI save writes', () => {
  const v = side({ frameJobs: runFrameJobs });
  v.mem.write16(0x6e, 0xe839);
  v.mem.write8(0x70, 0x81);
  v.mem.write16(0x1c76, 0xffff);
  const before = v.mem.wram.slice();
  const runner = new SequenceRunner(nmiAtBranch(v.h, v.events, 0x81b0a9, FLAG_ZERO));
  assert.equal(runner.run(100), WAIT_PAUSED);
  before[0x1c76] = before[0x1c77] = 0;
  assert.deepEqual(v.mem.wram, before);
  assert.equal(runner.run(100), WAIT_RETURNED);
});

test('live frame rejects unknown jobs and closes the device interval after failure', () => {
  const v = side({ frameJobs: runFrameJobs });
  const runner = new SequenceRunner(nmiAtBranch(v.h, v.events, 0x81b0a9, FLAG_ZERO));
  const before = v.mem.wram.slice();
  assert.throws(
    () => runner.run(100),
    (e) => e.reason === 'live_frame_callback_frontier',
  );
  assert.equal(v.frames.inNmi, false);
  assert.deepEqual(v.mem.wram, before);
  assert.throws(
    () => runner.run(100),
    (e) => e.reason === 'native_call_failed',
  );
  assert.equal(v.frames.nmis, 1);
});

test('instant text and disabled-NMI audio waits do not dispatch a frame', () => {
  const dispatched = () => assert.fail('unexpected frame');
  const v = side({ frameJobs: dispatched });
  v.frames.textWait = () => true;
  const instant = new SequenceRunner(nmiAtBranch(v.h, v.events, 0x81acb2, 0));
  assert.equal(instant.run(100), WAIT_RETURNED);
  assert.equal(v.frames.nmis, 0);

  let samples = 0;
  const audio = side({
    frameJobs: dispatched,
    nmitimen: 0,
    apu: { advance: (n) => (samples += n) },
  });
  const beat = new SequenceRunner(nmiAtBranch(audio.h, audio.events, 0x81d6bd, 0));
  assert.equal(beat.run(100), WAIT_RETURNED);
  assert.equal(samples, 1);
  assert.equal(audio.frames.audioSamples, 1);
  assert.equal(audio.frames.nmis, 0);
});

test('the recorded compatibility channel does not acquire live frame jobs', () => {
  const frames = new LagFreeFrames();
  const devices = new LiveDevices(frames, new Map());
  assert.equal(Object.hasOwn(interruptEventsOf(devices.take(0), 0), 'frameJobs'), false);
  assert.throws(
    () => new LiveDevices(frames, new Map(), { frameJobs: {} }),
    (e) => e.reason === 'frame_devices_required',
  );
});
