import test from 'node:test';
import assert from 'node:assert/strict';
import * as direct from '../src/game/dialog-talk.mjs';
import * as former from '../proof/caller/dialog-talk.mjs';
import { closePortraitWindowSequence } from '../proof/caller/portrait-window.mjs';
import { runFrameWait, runPadPresses } from '../src/system/live-input-calls.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
} from '../src/system/native-call-continuation.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import {
  DIALOG_HDMA_TABLE,
  HDMAEN_SHADOW,
  TMW_SHADOW,
  RANDOM_STATE,
  PAD_HELD,
  PAD_PRESSED,
} from '../src/data/wram.mjs';

function runClose(module, shadow, counter, held, budget) {
  const side = textWindowSide(),
    { h, a, mem, put, events } = side;
  // Keep nested call frames away from the live HDMA fields at 01C4.
  h.ctx.s = 0x1eef;
  put(HDMAEN_SHADOW, shadow);
  put(TMW_SHADOW, 15);
  put(RANDOM_STATE, counter);
  put(PAD_HELD, held);
  events.interrupts.textWait = (_h, _events, _status, pc) => {
    assert.equal(pc, 0x81b0a9);
    side.calls.push([
      'frame',
      h.ctx.x,
      mem.wram[HDMAEN_SHADOW],
      mem.wram.slice(DIALOG_HDMA_TABLE, DIALOG_HDMA_TABLE + 16),
    ]);
    put(RANDOM_STATE, mem.read16(RANDOM_STATE) + 1);
    return true;
  };
  const portrait = () => assert.fail('portrait must resume cooperatively');
  const table = new Map([
    [0x808f97, portrait],
    [0x81b0a1, runFrameWait],
    [0x809e1a, runPadPresses],
    ...[0x80adf4, 0x80b8de].map((target) => [
      target,
      (callee) => {
        side.calls.push([target, callee.ctx.a]);
        return callee.rts();
      },
    ]),
  ]);
  NATIVE_CALL_CONTINUATIONS.set(portrait, {
    run: portrait,
    create: () => new NativeCallContinuation(a, closePortraitWindowSequence(h, events, table)),
  });
  try {
    let pressed, finalShadow;
    function* sequence() {
      const result = yield* module.closeDialogSequence(h, events, table);
      pressed = mem.read16(PAD_PRESSED);
      finalShadow = mem.wram[HDMAEN_SHADOW];
      return result;
    }
    const result = finishTextWindow(side, sequence(), budget);
    result.wram.fill(0, 0x1e80, 0x1ef0);
    return { ...result, pressed, finalShadow };
  } finally {
    NATIVE_CALL_CONTINUATIONS.delete(portrait);
  }
}
for (const budget of [1, 7])
  for (const shadow of [0, 1, 0xfe, 0xff])
    for (const counter of [0, 0xffff])
      for (const held of [0, 0x8000, 0x000f])
        test(`dialog close: shadow ${shadow}, counter ${counter}, pad ${held}, budget ${budget}`, () => {
          const actual = runClose(direct, shadow, counter, held, budget);
          assert.deepEqual(actual, runClose(former, shadow, counter, held, budget));
          assert.equal(actual.calls.filter((call) => call[0] === 'frame').length, 12);
          assert.equal(actual.finalShadow, shadow & ~1);
          assert.equal(actual.writes.length, 17, 'OBJSEL and both complete font DMA setups');
        });
