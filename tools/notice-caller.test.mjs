import test from 'node:test';
import assert from 'node:assert/strict';
import { showNoticeSequence as direct } from '../src/game/notice-show.mjs';
import { showNoticeSequence as former } from '../proof/caller/notice-show.mjs';
import { openWindowSequence as formerOpen } from '../proof/caller/window-open.mjs';
import { printTextSequence as formerText } from '../proof/caller/text-print.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
} from '../src/system/native-call-continuation.mjs';
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
} from '../src/data/wram.mjs';

function run(sequence, mode, budget, effect) {
  const side = textWindowSide(),
    { h, a, events, put } = side;
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
  const routines = new Map(),
    bindings = [];
  function bind(target, body) {
    const run = () => assert.fail('callee must retain cooperative continuation'),
      binding = { run, create: () => new NativeCallContinuation(a, body()) };
    routines.set(target, run);
    bindings.push(run);
    NATIVE_CALL_CONTINUATIONS.set(run, binding);
  }
  bind(0x80f963, () => formerOpen(h, events));
  bind(0x80fe69, () => formerText(h, events, routines));
  bind(0x80fb39, () => side.render(h, events));
  try {
    return finishTextWindow(
      side,
      sequence(h, events, sequence === direct ? side.render : routines),
      budget,
    );
  } finally {
    for (const run of bindings) NATIVE_CALL_CONTINUATIONS.delete(run);
  }
}

for (const budget of [1, 7])
  for (const mode of ['free', 'mixed', 'ties', 'last'])
    for (const effect of [false, true])
      test(`direct notice: ${mode}, effect ${effect}, budget ${budget}`, () => {
        const actual = run(direct, mode, budget, effect);
        assert.deepEqual(actual, run(former, mode, budget, effect));
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
