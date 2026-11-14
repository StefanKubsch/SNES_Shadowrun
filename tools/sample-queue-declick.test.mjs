// The browser sample queue's declick (src/browser/sample-queue.mjs): a break in the
// signal (running empty, starting again, dropping queued pairs) glides from the last
// output value instead of stepping, the prebuffer doubles after the queue ran empty
// while playing (up to its maximum), and an unbroken stream passes unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SampleQueue } from '../src/browser/sample-queue.mjs';

const LOUD = 16000,
  // The largest step between two output samples a glide may take at full scale.
  MAX_STEP = 0.01;
const block = (pairs, value) => Int16Array.from({ length: pairs * 2 }, () => value);
function render(queue, pairs) {
  const left = new Float32Array(pairs),
    right = new Float32Array(pairs);
  queue.fill(left, right);
  return left;
}
const largestStep = (samples, last = 0) => {
  let step = 0;
  for (const v of samples) {
    step = Math.max(step, Math.abs(v - last));
    last = v;
  }
  return step;
};

test('running empty, starting and dropping glide instead of stepping', () => {
  const q = new SampleQueue({ prebuffer: 64, limit: 4096 });
  q.push(block(1000, LOUD));
  const start = render(q, 1000);
  assert.ok(largestStep(start) < MAX_STEP, 'the start fades in');
  assert.ok(Math.abs(start.at(-1) - LOUD / 0x8000) < 0.001, 'then plays the signal');
  // The queue runs empty while playing: the output decays to silence.
  const empty = render(q, 2000);
  assert.ok(largestStep(empty, start.at(-1)) < MAX_STEP, 'the underrun fades out');
  assert.ok(Math.abs(empty.at(-1)) < 0.001, 'to silence');
  assert.equal(q.underruns, 1);
  // A jump inside the stream from dropped pairs glides as well.
  q.push(block(200, -LOUD));
  const again = render(q, 128);
  assert.ok(largestStep(again, empty.at(-1)) < MAX_STEP);
  q.push(block(5000, LOUD));
  const dropped = render(q, 400);
  assert.ok(q.dropped > 0, 'pairs were dropped');
  assert.ok(largestStep(dropped, again.at(-1)) < 2 * MAX_STEP, 'the drop glides');
});

test('the prebuffer doubles after an underrun, up to 80 ms, not at the first start', () => {
  const q = new SampleQueue();
  assert.equal(q.prebuffer, 1280);
  q.push(block(1280, LOUD));
  render(q, 1280);
  assert.equal(q.prebuffer, 1280, 'the first start keeps 40 ms');
  render(q, 10);
  assert.equal(q.prebuffer, 2560, 'an underrun doubles it');
  q.push(block(2560, LOUD));
  render(q, 2600);
  assert.equal(q.prebuffer, 2560, 'capped at 80 ms');
});

test('an unbroken stream after the fade-in passes unchanged', () => {
  const q = new SampleQueue({ prebuffer: 2, limit: 100000 }),
    signal = Int16Array.from({ length: 20000 }, (_, i) => Math.round(8000 * Math.sin(i / 7)));
  q.push(signal);
  const left = render(q, 10000);
  // After about 1000 pairs the start's offset has decayed below one LSB.
  for (let i = 1500; i < 10000; i++) assert.ok(Math.abs(left[i] - signal[2 * i] / 0x8000) < 1e-4);
});
