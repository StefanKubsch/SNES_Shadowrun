import test from 'node:test';
import assert from 'node:assert/strict';
import { drawTextBuffer } from '../src/game/text-draw.mjs';
import { printText } from '../src/game/text-print.mjs';
import { printNumber } from '../src/game/window-text.mjs';
import { decimalNumber } from '../src/game/decimal-number.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { textWindowSide } from './text-window-caller-harness.mjs';
import * as W from '../src/data/wram.mjs';

function fixture(operation, request) {
  const side = textWindowSide(),
    { h, mem, put, events } = side;
  put(2, operation === printText ? 0x7074 : 0xffff);
  put(4, operation === decimalNumber ? 0xffff : 0);
  put(W.TEXT_BUFFER_READBACK, request);
  put(W.TEXT_BUFFER_UPLOAD, request);
  mem.wram.set(new TextEncoder().encode('Words wrap. |Bold| text.\0'), W.TEXT_BUFFER);
  Object.assign(h.ctx, { programBank: 0x84, bank: 0x81, pc: 0x5678, status: 0xa5 });
  const context = { ...h.ctx },
    stack = mem.wram.slice(0x100, 0x1ca);
  const unchanged = () => {
    assert.deepEqual(h.ctx, context, 'text flow preserves every CPU register');
    assert.deepEqual(mem.wram.slice(0x100, 0x1ca), stack, 'text flow never writes the CPU stack');
  };
  const service = events.interrupts.textWait;
  events.frameJobs = () => assert.fail('fixture services text uploads');
  events.interrupts.textWait = (...args) => {
    unchanged();
    return service(...args);
  };
  return { ...side, unchanged };
}

for (const operation of [drawTextBuffer, printText, printNumber, decimalNumber]) {
  for (const request of [0, 0xfffe, 0xffff])
    test(`${operation.name} preserves CPU context at every pause, request ${request}`, () => {
      const side = fixture(operation, request),
        runner = new SequenceRunner(operation(side.h, side.events));
      const before = side.mem.wram.slice();
      assert.equal(runner.run(0), WAIT_PAUSED);
      assert.deepEqual(side.mem.wram, before);
      let steps = 0;
      do {
        runner.run(1);
        side.unchanged();
        assert.ok(++steps < 10000, 'bounded rendering');
      } while (!runner.done);
      assert.equal(
        side.uploads.filter(([pc]) => pc === 0x81accc).length,
        request === 0xffff ? 0 : 1,
      );
      const completed = side.mem.wram.slice(),
        uploads = side.uploads.length;
      runner.run(100);
      assert.deepEqual(side.mem.wram, completed);
      assert.equal(side.uploads.length, uploads, 'completed text is never uploaded twice');
    });

  test(`${operation.name} preserves CPU context and rejects replay after upload failure`, () => {
    const side = fixture(operation, 0),
      failure = new Error('text upload failed');
    side.events.interrupts.textWait = () => {
      side.unchanged();
      throw failure;
    };
    const runner = new SequenceRunner(operation(side.h, side.events));
    assert.throws(
      () => runner.run(10000),
      (error) => error === failure,
    );
    side.unchanged();
    assert.throws(
      () => runner.run(10000),
      (error) => error.reason === 'native_call_failed',
    );
  });
}
