import { drawTextBufferSequence as drawTextBuffer } from '../src/game/text-draw.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import * as liftedMenus from '../src/game/dialog-menus.mjs';
import { chooseDialogActionJsr, chooseDialogTopicJsr } from './register-forms/jsr-forms.mjs';
import { runFrameWait, runPadPresses } from './register-forms/input-routines.mjs';
import { playSoundEffectJsr } from './register-forms/jsr-forms.mjs';
import { NATIVE_CALL_CONTINUATIONS } from './register-forms/native-call-continuation.mjs';
import { textWindowSide, finishTextWindow, rendererTable } from './text-window-caller-harness.mjs';
import {
  TOPIC_LIST,
  TOPIC_FLAGS,
  PAD_HELD,
  RANDOM_STATE,
  SOUND_LOADED_SET,
  DIALOG_END,
  WINDOW_ACTIVE,
  TEXT_MAP_UPLOAD,
} from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

// The lifted module with its RTS and RTL forms (tools/register-forms/jsr-forms.mjs), named as the
// former.
const direct = {
  ...liftedMenus,
  chooseDialogActionSequence: chooseDialogActionJsr,
  chooseDialogTopicSequence: chooseDialogTopicJsr,
};

function run(module, variant, budget, realDrawing = false, counter = 0) {
  const side = textWindowSide(),
    { h, mem, events, put } = side,
    topic = variant.startsWith('topic') || variant === 'empty' || variant === 'flagged',
    pads = variant.endsWith('cancel')
      ? [0x2000]
      : variant === 'topic single confirm'
        ? [0x8000]
        : variant === 'topic page confirm'
          ? [...Array.from({ length: 10 }, () => [0x400, 0]).flat(), 0x8000]
          : [0x400, 0, 0x8000];
  put(0x17, 0);
  put(TEXT_MAP_UPLOAD, counter);
  put(WINDOW_ACTIVE, 0xffff);
  put(SOUND_LOADED_SET, mem.read16(0x80c4b3 + 0x4c));
  mem.wram.set(
    variant === 'empty'
      ? [0xff]
      : variant === 'topic page confirm'
        ? [...Array.from({ length: 12 }, (_, n) => n + 2), 0xff]
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
  const serviceUpload = events.interrupts.textWait;
  let input = 0;
  events.interrupts.textWait = (callee, frameEvents, status, pc) => {
    if (pc !== 0x81b0a9) return serviceUpload(callee, frameEvents, status, pc);
    assert.ok(input < pads.length, 'bounded dialog input sequence');
    put(PAD_HELD, pads[input++]);
    put(RANDOM_STATE, mem.read16(RANDOM_STATE) + 1);
    return true;
  };
  if (realDrawing) side.render = drawTextBuffer;
  if (module === direct)
    Object.defineProperty(events, 'text', {
      get: () => assert.fail('live menu must not read legacy services'),
    });
  const binding = rendererTable(side),
    table = new Map([
      [0x81b0a1, runFrameWait],
      [0x809e1a, runPadPresses],
      [0x80c46e, playSoundEffectJsr],
      [0x80fb39, binding.run],
    ]);
  NATIVE_CALL_CONTINUATIONS.set(binding.run, binding);
  try {
    const name = topic ? 'chooseDialogTopicSequence' : 'chooseDialogActionSequence',
      result = finishTextWindow(
        side,
        module === direct
          ? module[name](h, events, realDrawing ? undefined : side.render)
          : module[name](h, events, events.text, table),
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
    'topic page confirm',
    'empty',
    'flagged',
  ])
    test(`live dialog menu: ${variant}, budget ${budget}`, () => {
      const actual = run(direct, variant, budget);
      assertFrozenRun(actual);
      const word = (at) => actual.wram[at] | (actual.wram[at + 1] << 8),
        absent = variant === 'empty' || variant === 'flagged',
        cancelled = variant.endsWith('cancel');
      assert.equal(
        word(0),
        absent || cancelled
          ? 0xffff
          : variant === 'topic page confirm'
            ? 10
            : variant === 'topic single confirm'
              ? 0
              : variant === 'topic sparse confirm'
                ? 2
                : 1,
      );
      assert.equal(word(DIALOG_END), cancelled ? 0xffff : 0);
      assert.equal(
        actual.input,
        absent
          ? 0
          : cancelled || variant === 'topic single confirm'
            ? 1
            : variant === 'topic page confirm'
              ? 21
              : 3,
      );
      if (absent) assert.equal(actual.uploads.length, 0);
      if (variant.startsWith('topic'))
        assert.ok(actual.uploads.length >= 3, 'topic window opens and releases');
    });

for (const budget of [1, 7])
  for (const variant of ['main confirm', 'main cancel', 'topic confirm'])
    test(`default live dialog renderer: ${variant}, budget ${budget}`, () => {
      assertFrozenRun(run(direct, variant, budget, true));
    });

for (const budget of [1, 7])
  for (const counter of [0xfffe, 0xffff])
    for (const variant of ['topic confirm', 'topic cancel'])
      test(`dialog topic release upload wrap: ${variant}, counter ${counter}, budget ${budget}`, () => {
        const actual = run(direct, variant, budget, false, counter);
        assertFrozenRun(actual);
        assert.equal(actual.wram[TEXT_MAP_UPLOAD] | (actual.wram[TEXT_MAP_UPLOAD + 1] << 8), 0);
      });
