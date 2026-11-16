import test from 'node:test';
import assert from 'node:assert/strict';
import * as directAction from '../src/game/action-menu.mjs';
import * as formerAction from '../proof/caller/action-menu.mjs';
import * as directQuestion from '../src/game/yes-no-question.mjs';
import * as formerQuestion from '../proof/caller/yes-no-question.mjs';
import { openWindowSequence } from '../proof/caller/window-open.mjs';
import { releaseWindowSequence } from '../proof/caller/window-release.mjs';
import { chooseFromMenuSequence } from '../proof/caller/menu-choice.mjs';
import { runFrameWait, runPadPresses } from '../src/system/live-input-calls.mjs';
import { playSoundEffectRoutine } from '../src/apu/sound-effect.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
} from '../src/system/native-call-continuation.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import {
  ACTION_MENU_OVERRIDE,
  PAD_HELD,
  RANDOM_STATE,
  SOUND_LOADED_SET,
  WINDOW_ACTIVE,
} from '../src/data/wram.mjs';

function run(module, { mask, override = 0, pads, script = false }, budget) {
  const side = textWindowSide(),
    { h, a, mem, events, put } = side,
    question = module === directQuestion || module === formerQuestion;
  put(WINDOW_ACTIVE, 0xffff);
  put(SOUND_LOADED_SET, mem.read16(0x80c4b3 + 0x4c));
  put(ACTION_MENU_OVERRIDE, override);
  put(0, mask);
  if (question) {
    put(2, 6);
    put(4, 8);
  }
  h.ctx.a = mask;
  const serviceUpload = events.interrupts.textWait;
  let input = 0;
  events.interrupts.textWait = (callee, frameEvents, status, pc) => {
    if (pc !== 0x81b0a9) return serviceUpload(callee, frameEvents, status, pc);
    assert.ok(input < pads.length, 'bounded action input script');
    put(PAD_HELD, pads[input++]);
    put(RANDOM_STATE, mem.read16(RANDOM_STATE) + 1);
    return true;
  };
  const routines = new Map([
      [0x81b0a1, runFrameWait],
      [0x809e1a, runPadPresses],
      [0x80c46e, playSoundEffectRoutine],
    ]),
    bindings = [];
  function bind(target, body) {
    const run = () => assert.fail('callee must use its continuation');
    routines.set(target, run);
    bindings.push(run);
    NATIVE_CALL_CONTINUATIONS.set(run, {
      run,
      create: () => new NativeCallContinuation(a, body()),
    });
  }
  bind(0x80f963, () => openWindowSequence(h, events));
  bind(0x80a6a5, () => chooseFromMenuSequence(h, events, routines, 0x80a6a5));
  bind(0x80a6c7, () => chooseFromMenuSequence(h, events, routines, 0x80a6c7));
  bind(0x80fa3e, function* () {
    yield* releaseWindowSequence(h, events);
    let result;
    yield () => {
      result = h.rts();
    };
    return result;
  });
  bind(0x80fb39, () => side.render(h, events));
  try {
    const name = question
        ? 'askYesNoSequence'
        : script
          ? 'chooseScriptActionSequence'
          : 'chooseActionSequence',
      result = finishTextWindow(
        side,
        module[name](
          h,
          events,
          module === directAction || module === directQuestion ? side.render : routines,
        ),
        budget,
      );
    return { ...result, input, chosen: h.ctx.a };
  } finally {
    for (const run of bindings) NATIVE_CALL_CONTINUATIONS.delete(run);
  }
}

for (const budget of [1, 7])
  for (const [name, options, chosen] of [
    ['no actions', { mask: 0, pads: [] }, 0],
    ['exit', { mask: 0x80, pads: [0x8000] }, 0],
    ['examine hotkey', { mask: 0x80, pads: [0x20] }, 0x80],
    ['override', { mask: 0, override: 0x10, pads: [0x10] }, 0x10],
    ['cancel', { mask: 0x67f2, pads: [0x2000] }, 0],
    ['cast combined', { mask: 0x600, pads: [0x400, 0, 0x8000] }, 0x600],
    ['open only', { mask: 0x200, pads: [0x10] }, 0x200],
    ['close only', { mask: 0x400, pads: [0x10] }, 0x400],
    ['script clears override', { mask: 0x80, override: 0x10, pads: [0x20], script: true }, 0x80],
  ])
    test(`direct action menu: ${name}, budget ${budget}`, () => {
      const actual = run(directAction, options, budget);
      assert.deepEqual(actual, run(formerAction, options, budget));
      assert.equal(actual.chosen, chosen);
      assert.equal(actual.wram[ACTION_MENU_OVERRIDE], 0);
      if (!options.mask && !options.override) assert.equal(actual.uploads.length, 0);
      else assert.ok(actual.uploads.length >= 3, 'window opens and releases');
      if (options.script)
        assert.equal(actual.wram[0] | (actual.wram[1] << 8), chosen, 'script result');
    });

for (const budget of [1, 7])
  for (const [name, pads, answer] of [
    ['yes', [0x8000], 0xffff],
    ['no', [0x400, 0, 0x8000], 0],
    ['return to yes', [0x400, 0, 0x800, 0, 0x80], 0xffff],
    ['cancel', [0x2000], 0],
  ])
    test(`direct question: ${name}, budget ${budget}`, () => {
      const options = { mask: 0, pads },
        actual = run(directQuestion, options, budget);
      assert.deepEqual(actual, run(formerQuestion, options, budget));
      assert.equal(actual.wram[0] | (actual.wram[1] << 8), answer);
      assert.equal(actual.input, pads.length);
      assert.ok(actual.uploads.length >= 3, 'question opens and releases its window');
    });
