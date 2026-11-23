import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseFromMenu,
  MENU,
  MENU_WITH_HOTKEYS,
  MENU_WITH_NUMBERS,
  MENU_WITH_NUMBERS_AT,
} from '../src/game/menu-choice.mjs';
import { waitForConfirmKey } from '../src/game/confirm-key.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { textWindowSide } from './text-window-caller-harness.mjs';
import * as W from '../src/data/wram.mjs';

const TOKENS = 0x6000,
  VALUES = 0x6100,
  WRAM_BANK = 0x7e,
  BLANK_TEXT = 0x707d,
  CONFIRM_SOUND = 0x4c,
  SOUND_TABLE = 0x80c4b3,
  STACK_START = 0x1e80,
  STACK_END = 0x1ef0,
  STACK_TOP = STACK_END - 1,
  FRAME_BRANCH = 0x81b0a9,
  ROWS = 7,
  VISIBLE_ROWS = 3,
  STEP_LIMIT = 20000,
  CANCELLED = 0xffff,
  REPEAT_FRAMES = 23;

function fixture(pads) {
  const side = textWindowSide(),
    { h, a, mem, put, events } = side;
  for (const [at, value] of [
    [0, 0],
    [2, 1],
    [4, 1],
    [6, VISIBLE_ROWS],
    [8, TOKENS],
    [W.DP_LIST_TOKEN_BANK, WRAM_BANK],
    [W.DP_LIST_VALUES, VALUES],
    [W.SOUND_LOADED_SET, mem.read16(SOUND_TABLE + CONFIRM_SOUND)],
  ])
    put(at, value);
  for (let row = 0; row < ROWS; row++) {
    put(TOKENS + 2 * row, BLANK_TEXT);
    put(VALUES + 2 * row, row === 2 ? W.PAD_R : 0);
  }
  Object.assign(h.ctx, { bank: WRAM_BANK, s: STACK_TOP });
  const context = { ...h.ctx },
    stack = mem.wram.slice(STACK_START, STACK_END);
  const unchanged = () => {
    assert.deepEqual(h.ctx, context);
    assert.deepEqual(mem.wram.slice(STACK_START, STACK_END), stack);
  };
  const forbidden = () => assert.fail('direct menus must not use CPU call/return helpers');
  h.push = h.pushByte = h.rts = h.rtl = a.pushWord = a.pullWord = forbidden;
  events.frameJobs = () => assert.fail('fixture services every live wait');
  const serviceUpload = events.interrupts.textWait;
  let input = 0;
  events.interrupts.textWait = (...args) => {
    unchanged();
    if (args[3] !== FRAME_BRANCH) return serviceUpload(...args);
    assert.ok(input < pads.length, 'bounded input');
    put(W.PAD_HELD, pads[input++]);
    put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
    return true;
  };
  return { ...side, unchanged, consumed: () => input };
}

function finish(side, sequence) {
  const runner = new SequenceRunner(sequence),
    before = side.mem.wram.slice();
  assert.equal(runner.run(0), WAIT_PAUSED);
  assert.deepEqual(side.mem.wram, before);
  let steps = 0;
  while (!runner.done) {
    runner.run(1);
    side.unchanged();
    assert.ok(++steps < STEP_LIMIT);
  }
  const completed = side.mem.wram.slice(),
    consumed = side.consumed();
  runner.run(STEP_LIMIT);
  assert.deepEqual(side.mem.wram, completed);
  assert.equal(side.consumed(), consumed);
  return runner.result;
}

const NAVIGATE = [
  W.PAD_DOWN,
  0,
  W.PAD_DOWN,
  0,
  W.PAD_R,
  0,
  W.PAD_L,
  0,
  ...Array(REPEAT_FRAMES).fill(W.PAD_DOWN),
  0,
  W.PAD_UP,
  0,
];
for (const entry of [MENU, MENU_WITH_HOTKEYS, MENU_WITH_NUMBERS, MENU_WITH_NUMBERS_AT]) {
  for (const cancel of [false, true])
    test(`direct menu preserves context and stack through paging/repeat: ${entry}, cancel ${cancel}`, () => {
      // Hotkeys use R, so navigation omits the page keys for that entry.
      const moves = entry === MENU_WITH_HOTKEYS ? [W.PAD_DOWN, 0] : NAVIGATE;
      const pads = [...moves, cancel ? W.PAD_SELECT : W.PAD_B],
        side = fixture(pads);
      const selected = finish(side, chooseFromMenu(side.h, side.events, undefined, entry, 2));
      assert.equal(side.consumed(), pads.length);
      assert.equal(selected, side.mem.read16(0));
      if (cancel) assert.equal(selected, CANCELLED);
      else assert.ok(selected < ROWS);
    });
}

test('a direct hotkey returns its row without a later confirm', () => {
  const side = fixture([W.PAD_R]);
  assert.equal(finish(side, chooseFromMenu(side.h, side.events, undefined, MENU_WITH_HOTKEYS)), 2);
  assert.equal(side.consumed(), 1);
});

for (const button of [W.PAD_B, W.PAD_Y, W.PAD_SELECT, W.PAD_A, W.PAD_X])
  test(`direct confirmation preserves context and requires a new press: ${button}`, () => {
    const pads = [button, 0, W.PAD_START, W.PAD_UP, W.PAD_R, button],
      side = fixture(pads);
    side.put(W.PAD_PREVIOUS, button);
    assert.equal(finish(side, waitForConfirmKey(side.h, side.events)), button);
    assert.equal(side.consumed(), pads.length);
  });

for (const menu of [false, true])
  test(`direct input failure cannot replay, menu ${menu}`, () => {
    const side = fixture([]),
      failure = new Error('input service failed');
    const service = side.events.interrupts.textWait;
    side.events.interrupts.textWait = (...args) => {
      if (args[3] === FRAME_BRANCH) throw failure;
      return service(...args);
    };
    const runner = new SequenceRunner(
      menu
        ? chooseFromMenu(side.h, side.events, undefined, MENU)
        : waitForConfirmKey(side.h, side.events),
    );
    assert.throws(
      () => runner.run(STEP_LIMIT),
      (error) => error === failure,
    );
    side.unchanged();
    assert.throws(
      () => runner.run(1),
      (error) => error.reason === 'native_call_failed',
    );
  });
