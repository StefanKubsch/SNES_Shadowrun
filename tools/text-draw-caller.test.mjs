import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { drawTextBufferSequence as direct } from '../src/game/text-draw.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import {
  TEXT_BUFFER,
  TEXT_BUFFER_READBACK,
  TEXT_BUFFER_UPLOAD,
  WINDOW_STYLE,
  WINDOW_CURSOR_TILE,
  WINDOW_CURSOR_PIXEL,
  WINDOW_LEFT_PIXEL,
} from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

function run(sequence, budget, style, request, variant) {
  const side = textWindowSide(),
    { h, mem, put } = side;
  h.ctx.bank = 0x7e;
  put(WINDOW_STYLE, style);
  put(TEXT_BUFFER_READBACK, request);
  put(TEXT_BUFFER_UPLOAD, request);
  put(WINDOW_CURSOR_TILE, variant === 'wrap' ? 0x2060 : 0x2027);
  put(WINDOW_CURSOR_PIXEL, variant === 'wrap' ? 7 : 0);
  put(WINDOW_LEFT_PIXEL, variant === 'wrap' ? 3 : 0);
  const text =
    variant === 'empty'
      ? ''
      : variant === 'wrap'
        ? 'Long words wrap around the window. |Bold| lower case and more words.'
        : variant === 'long'
          ? // A word wider than the line at the line's start: the line break runs with
            // nothing drawn and takes its window from the index X still holds.
            'W'.repeat(40) + ' end.'
          : 'A |bold| word.';
  mem.wram.set(
    [...text].map((c) => c.charCodeAt(0)),
    TEXT_BUFFER,
  );
  mem.wram[TEXT_BUFFER + text.length] = 0;
  return finishTextWindow(side, sequence(h, side.events), budget);
}

for (const budget of [1, 7])
  for (const variant of ['empty', 'plain', 'wrap', 'long'])
    for (const style of [0, 8, 0x10, 0x20, 0x40, 0x60, 0x80, 0xb8])
      test(`live glyph uploads: ${variant}, style ${style}, budget ${budget}`, () => {
        for (const request of [0, 0xfffe, 0xffff]) {
          const actual = run(direct, budget, style, request, variant);
          assertFrozenRun(actual);
          if (request === 0xffff)
            assert.ok(
              !actual.uploads.some(([pc]) => pc === 0x81accc),
              'wrapping read-back needs no wait',
            );
          else
            assert.ok(
              actual.uploads.some(([pc]) => pc === 0x81accc),
              'initial tile read-back waits',
            );
        }
      });
