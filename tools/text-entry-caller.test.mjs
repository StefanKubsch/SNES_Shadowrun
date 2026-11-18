import test from 'node:test';
import assert from 'node:assert/strict';
import { runPrintNumber, runPrintText } from '../proof/caller/upkeep-routines.mjs';
import { printNumberSequence as formerNumber } from '../proof/caller/window-text.mjs';
import { printTextSequence as formerText } from '../proof/caller/text-print.mjs';
import { drawTextBufferSequence as formerDraw } from '../proof/caller/text-draw.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
} from '../src/system/native-call-continuation.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import { TEXT_BUFFER_READBACK, TEXT_BUFFER_UPLOAD, WINDOW_STYLE } from '../src/data/wram.mjs';

function run(entry, former, value, budget, style, request, synchronous, translated) {
  const side = textWindowSide(),
    { h, put, events } = side;
  put(2, value);
  put(WINDOW_STYLE, style);
  put(TEXT_BUFFER_READBACK, request);
  put(TEXT_BUFFER_UPLOAD, request);
  if (translated) side.mem.language = new Map([[value, Uint8Array.from(translated)]]);
  const routines = { get: () => assert.fail('live entry must own its renderer') };
  let sequence;
  if (former) {
    const draw = () => assert.fail('former renderer must pause');
    const factory = {
      run: draw,
      create: () => new NativeCallContinuation(h.a, formerDraw(h, events)),
    };
    NATIVE_CALL_CONTINUATIONS.set(draw, factory);
    sequence = former(h, events, new Map([[0x80fb39, draw]]));
    // The sequence owns the factory until finishTextWindow has drained its children.
    try {
      return finishTextWindow(side, sequence, budget);
    } finally {
      NATIVE_CALL_CONTINUATIONS.delete(draw);
    }
  }
  sequence = (function* () {
    return yield synchronous
      ? () => entry(h, events, routines)
      : { continuation: NATIVE_CALL_CONTINUATIONS.get(entry).create({ h, events, routines }) };
  })();
  return finishTextWindow(side, sequence, budget);
}

for (const budget of [1, 7])
  for (const value of [0, 1, 9, 10, 99, 100, 9999, 10000, 65535])
    for (const synchronous of [false, true])
      test(`number register entry: ${value}, budget ${budget}, synchronous ${synchronous}`, () => {
        for (const [style, request] of [
          [0, 0],
          [0x60, 0xfffe],
          [0xb8, 0xffff],
        ]) {
          assert.deepEqual(
            run(runPrintNumber, null, value, budget, style, request, synchronous),
            run(null, formerNumber, value, budget, style, request),
          );
        }
      });

for (const budget of [1, 7])
  for (const id of [0x7074, 0x707d, 0x7446, 0x8000, 0x7077])
    for (const translated of [undefined, [], [65, 32, 124, 66, 111, 108, 100, 124]])
      for (const synchronous of [false, true])
        test(`text register entry: ${id}, budget ${budget}, translation ${translated}, synchronous ${synchronous}`, () => {
          for (const [style, request] of [
            [0, 0],
            [0x60, 0xfffe],
            [0xb8, 0xffff],
          ]) {
            assert.deepEqual(
              run(runPrintText, null, id, budget, style, request, synchronous, translated),
              run(null, formerText, id, budget, style, request, undefined, translated),
            );
          }
        });
