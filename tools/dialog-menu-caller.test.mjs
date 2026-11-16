import { drawTextBufferSequence as formerDraw } from '../proof/caller/text-draw.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as direct from '../src/game/dialog-menus.mjs';
import * as previous from '../proof/caller/dialog-menus.mjs';
import { dialogTextRoutines } from '../src/system/native-dialog-text.mjs';
import { runFrameWait, runPadPresses } from '../src/system/live-input-calls.mjs';
import { playSoundEffectRoutine } from '../src/apu/sound-effect.mjs';
import { NATIVE_CALL_CONTINUATIONS } from '../src/system/native-call-continuation.mjs';
import { textWindowSide, finishTextWindow, rendererTable } from './text-window-caller-harness.mjs';
import {
  TOPIC_LIST,
  TOPIC_FLAGS,
  PAD_HELD,
  RANDOM_STATE,
  SOUND_LOADED_SET,
  DIALOG_END,
  WINDOW_ACTIVE,
} from '../src/data/wram.mjs';

function run(module, variant, budget, realDrawing = false) {
  const side = textWindowSide(),
    { h, mem, events, put } = side,
    topic = variant.startsWith('topic') || variant === 'empty' || variant === 'flagged',
    pads = variant.endsWith('cancel')
      ? [0x2000]
      : variant === 'topic single confirm'
        ? [0x8000]
        : [0x400, 0, 0x8000];
  put(0x17, 0);
  put(WINDOW_ACTIVE, 0xffff);
  put(SOUND_LOADED_SET, mem.read16(0x80c4b3 + 0x4c));
  mem.wram.set(
    variant === 'empty'
      ? [0xff]
      : variant === 'topic single confirm'
        ? [8, 0xff]
        : variant === 'topic sparse confirm'
          ? [2, 5, 8, 0xff]
          : [2, 8, 0xff],
    TOPIC_LIST,
  );
  mem.wram.set(
    variant === 'flagged' ? [1, 1] : variant === 'topic sparse confirm' ? [1, 0, 0] : [0, 0],
    TOPIC_FLAGS,
  );
  events.text = dialogTextRoutines(events);
  const serviceUpload = events.interrupts.textWait;
  let input = 0;
  events.interrupts.textWait = (callee, frameEvents, status, pc) => {
    if (pc !== 0x81b0a9) return serviceUpload(callee, frameEvents, status, pc);
    assert.ok(input < pads.length, 'bounded dialog input sequence');
    put(PAD_HELD, pads[input++]);
    put(RANDOM_STATE, mem.read16(RANDOM_STATE) + 1);
    return true;
  };
  if (realDrawing) side.render = formerDraw;
  const binding = rendererTable(side),
    table = new Map([
      [0x81b0a1, runFrameWait],
      [0x809e1a, runPadPresses],
      [0x80c46e, playSoundEffectRoutine],
      [0x80fb39, binding.run],
    ]);
  NATIVE_CALL_CONTINUATIONS.set(binding.run, binding);
  try {
    const name = topic ? 'chooseDialogTopicSequence' : 'chooseDialogActionSequence',
      result = finishTextWindow(
        side,
        module[name](
          h,
          events,
          events.text,
          module === direct ? (realDrawing ? undefined : side.render) : table,
        ),
        budget,
      );
    return { ...result, input };
  } finally {
    NATIVE_CALL_CONTINUATIONS.delete(binding.run);
  }
}

for (const budget of [1, 7])
  for (const variant of [
    'main confirm',
    'main cancel',
    'topic confirm',
    'topic cancel',
    'topic single confirm',
    'topic sparse confirm',
    'empty',
    'flagged',
  ])
    test(`live dialog menu: ${variant}, budget ${budget}`, () => {
      const actual = run(direct, variant, budget);
      assert.deepEqual(actual, run(previous, variant, budget));
      const word = (at) => actual.wram[at] | (actual.wram[at + 1] << 8),
        absent = variant === 'empty' || variant === 'flagged',
        cancelled = variant.endsWith('cancel');
      assert.equal(
        word(0),
        absent || cancelled
          ? 0xffff
          : variant === 'topic single confirm'
            ? 0
            : variant === 'topic sparse confirm'
              ? 2
              : 1,
      );
      assert.equal(word(DIALOG_END), cancelled ? 0xffff : 0);
      assert.equal(
        actual.input,
        absent ? 0 : cancelled || variant === 'topic single confirm' ? 1 : 3,
      );
      if (absent) assert.equal(actual.uploads.length, 0);
      if (variant.startsWith('topic'))
        assert.ok(actual.uploads.length >= 3, 'topic window opens and releases');
    });

for (const budget of [1, 7])
  for (const variant of ['main confirm', 'main cancel', 'topic confirm'])
    test(`default live dialog renderer: ${variant}, budget ${budget}`, () => {
      assert.deepEqual(run(direct, variant, budget, true), run(previous, variant, budget, true));
    });
