import test from 'node:test';
import assert from 'node:assert/strict';
import { waitStatus } from '../src/system/wait-status.mjs';
import { waitForCounterWord, waitForFrame } from '../src/system/frame-wait.mjs';
import { openWindow } from '../src/game/window-open.mjs';
import { drawWindowListSequence } from '../src/game/window-list.mjs';
import { drawTextBuffer } from '../src/game/text-draw.mjs';
import { transferPortraitTiles } from '../src/platform/portrait-tiles.mjs';
import { reloadObjectTiles } from '../src/game/object-tiles.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { accessorPort } from '../src/system/hardware-port.mjs';
import { textWindowSide } from './text-window-caller-harness.mjs';
import * as W from '../src/data/wram.mjs';

test('wait status gives the branch condition bits and needs no CPU context', () => {
  const h = new Proxy({}, { get: () => assert.fail('wait status read CPU context') });
  for (const [clear, set] of [
    [0x82, 0x21],
    [0xa0, 3],
    [0xa2, 0],
    [0xa2, 0x80],
  ]) {
    assert.equal(waitStatus(h, {}, clear, set), set);
    assert.equal(waitStatus(h, { frameJobs: () => {} }, clear, set), set);
  }
});

const operations = [
  (h, e) => waitForCounterWord(h, e),
  (h, e) => waitForFrame(h, e, accessorPort(h.a)),
  (h, e) => openWindow(h, e),
  (h, e) => drawWindowListSequence(h, e),
  (h, e) => drawTextBuffer(h, e),
  (h, e) => transferPortraitTiles(h, e, 0),
  (h, e) => reloadObjectTiles(h, e),
];

for (const [index, operation] of operations.entries())
  test(`live wait graph ${index} runs without CPU status or stack access`, () => {
    const side = textWindowSide(),
      { a, mem, put, events } = side;
    const h = { a };
    a.dataBank = 0x80;
    Object.defineProperty(h, 'ctx', { get: () => assert.fail('wait read CPU context') });
    put(W.NMITIMEN_SHADOW, 0x80);
    put(W.RANDOM_STATE, 0xffff);
    put(W.DRAW_LIST_INDEX, 0);
    put(W.DRAW_LIST, 0);
    put(W.WINDOW_ACTIVE, 0xffff);
    put(0, 1);
    put(2, 1);
    put(4, 3);
    put(6, 3);
    put(8, 0);
    mem.wram[W.TEXT_BUFFER] = 0;
    const serviceUpload = events.interrupts.textWait;
    let polls = 0;
    events.frameJobs = () => assert.fail('fixture services every wait');
    events.interrupts.textWait = (...args) => {
      polls++;
      const pc = args[3];
      if (pc === 0x81b0a9 || pc === 0x81eed1) {
        put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
      } else if (pc === 0x80901f) put(W.PORTRAIT_DMA_REQUEST, 0x8000);
      else if (pc === 0x80ae0f) put(W.NMI_JOB_LISTS, 0);
      else return serviceUpload(...args);
      return true;
    };
    const runner = new SequenceRunner(operation(h, events));
    const before = mem.wram.slice();
    assert.equal(runner.run(0), WAIT_PAUSED);
    assert.deepEqual(mem.wram, before);
    let steps = 0;
    while (!runner.done) {
      runner.run(1);
      assert.ok(++steps < 20000);
    }
    assert.ok(polls > 0);
    const completed = mem.wram.slice();
    runner.run(7);
    assert.deepEqual(mem.wram, completed);
  });
