import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { showNoticeSequence as direct } from '../src/game/notice-show.mjs';
import { timeLimitJsr as directTimer } from '../proof/caller/jsr-forms.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import {
  NOTICE_WINDOWS,
  NOTICE_FRAMES,
  NOTICE_EFFECT_FRAMES,
  WINDOW_ACTIVE,
  WINDOW_COLUMNS,
  WINDOW_ROWS,
  WINDOW_TILE_START,
  WINDOW_TILE_COUNT,
  WINDOW_LAST_INDEX,
  WINDOW_NEXT_TILE,
  TIMER,
  TIMER_FRAMES,
} from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

function run(sequence, mode, budget, effect, timer) {
  const side = textWindowSide(),
    { h, events, put } = side;
  put(WINDOW_LAST_INDEX, 6);
  put(WINDOW_NEXT_TILE, 0x2200);
  for (let x = 0; x <= 6; x += 2) {
    put(WINDOW_ACTIVE + x, 1);
    put(WINDOW_COLUMNS + x, 14);
    put(WINDOW_ROWS + x, 8);
    put(WINDOW_TILE_START + x, 0x2027 + 72 * x);
    put(WINDOW_TILE_COUNT + x, 72);
    put(NOTICE_WINDOWS + x, mode === 'free' || (mode === 'mixed' && x === 4) ? 0xffff : x);
    put(NOTICE_FRAMES + x, mode === 'last' ? (x === 6 ? 1 : 20) : x === 2 || x === 4 ? 5 : 20);
  }
  for (const [at, value] of [
    [0, 8],
    [2, 2],
    [4, 17],
    [6, 4],
    [8, effect ? 0x400 : 0],
    [10, 4],
    [12, 180],
  ])
    put(at, value);
  if (timer) {
    put(TIMER, timer[0]);
    put(TIMER_FRAMES, timer[1]);
  }
  return finishTextWindow(side, sequence(h, events, side.render), budget);
}

for (const budget of [1, 7])
  for (const mode of ['free', 'mixed', 'ties', 'last'])
    for (const effect of [false, true])
      test(`direct notice: ${mode}, effect ${effect}, budget ${budget}`, () => {
        const actual = run(direct, mode, budget, effect);
        assertFrozenRun(actual);
        const slot = mode === 'free' || mode === 'last' ? 6 : mode === 'mixed' ? 4 : 2,
          word = (at) => actual.wram[at] | (actual.wram[at + 1] << 8);
        assert.equal(
          word(NOTICE_WINDOWS + slot),
          8,
          'selected notice slot receives the new window',
        );
        assert.equal(word(NOTICE_FRAMES + slot), 180);
        assert.equal(word(NOTICE_EFFECT_FRAMES), effect ? 30 : 0);
        assert.equal(actual.calls.length, 1);
        assert.ok(actual.uploads.length >= 2, 'opening and optional release upload their maps');
      });

for (const budget of [1, 7])
  for (const timer of [
    [0xffff, 0],
    [0, 0],
    [1, 1],
    [1, 0],
    [2, 0],
    [0, 33],
    [1, 65],
  ])
    test(`direct timer: hours ${timer[0]}, frames ${timer[1]}, budget ${budget}`, () => {
      const actual = run(directTimer, 'ties', budget, false, timer);
      assertFrozenRun(actual);
      const word = (at) => actual.wram[at] | (actual.wram[at + 1] << 8);
      if (timer[1] === 0 && timer[0] > 0 && timer[0] < 0x8000) {
        assert.equal(word(TIMER), timer[0] - 1);
        assert.equal(word(TIMER_FRAMES), 0xdd4);
        assert.equal(actual.calls.length, 3, 'notice, remaining number and suffix render');
        const number = actual.calls[1][2],
          end = number.indexOf(0);
        assert.equal(String.fromCharCode(...number.subarray(0, end)), String(timer[0]));
      } else {
        assert.equal(actual.calls.length, 0);
        assert.equal(word(TIMER_FRAMES), timer[1] > 0 ? timer[1] - 1 : timer[1]);
      }
    });
