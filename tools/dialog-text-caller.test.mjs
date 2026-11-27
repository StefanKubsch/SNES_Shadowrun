import { drawTextBufferSequence as drawTextBuffer } from '../src/game/text-draw.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import * as liftedText from '../src/game/dialog-text.mjs';
import { showDialogTextJsr } from './register-forms/jsr-forms.mjs';
import * as V from '../src/vm/layout.mjs';
import { NATIVE_CALL_CONTINUATIONS } from './register-forms/native-call-continuation.mjs';
import { TOPIC_LIST, TOPIC_FLAGS } from '../src/data/wram.mjs';
import { textWindowSide, finishTextWindow, rendererTable } from './text-window-caller-harness.mjs';

useLiftVectors(import.meta.url);

// The lifted module with its RTS and RTL forms (tools/register-forms/jsr-forms.mjs), named as the
// former.
const direct = { ...liftedText, showDialogTextSequence: showDialogTextJsr };

function entry(key, text, topics = [], action = null) {
  const flags = topics.length | (action === null ? 0 : 0x80),
    words = action === null ? [text] : [action, text],
    bytes = words.flatMap((word) => [word & 0xff, word >>> 8]);
  return [key, 4 + topics.length + (action === null ? 0 : 2), flags, ...topics, ...bytes];
}

function run(module, name, variant, budget, realDrawing = false) {
  const side = textWindowSide(),
    { h, mem, events, put } = side;
  put(0x11, 0x6000);
  mem.wram[0x13] = 0x7e;
  put(0x14, 0);
  mem.wram.set([2, 8, 0xff], TOPIC_LIST);
  mem.wram.set([3, 4], TOPIC_FLAGS);
  let records = entry(0xff, 0x707d),
    key = 0xffff;
  if (variant === 'talk') {
    records = entry(0xfe, 0x7077);
    key = 0xfffe;
  }
  if (variant === 'topics and action') {
    records = entry(42, 0x7074, [8, 5, 1], 0x80);
    key = 42;
  }
  if (variant === 'fallback') {
    records = entry(0xfd, 0x707a);
    key = 77;
  }
  if (variant === 'missing') {
    records = [];
    key = 77;
  }
  mem.wram.set([0, 0, 0, 0, ...records, 0xf8], 0x6000);
  h.ctx.a = key;
  if (variant === 'topics and action') {
    put(V.TASK_FREE_LIST, 0);
    put(V.TASK_NEXT, 2);
    put(V.TASK_NEXT + 2, 0xffff);
    put(V.TASK_LIST_HEAD, 0xffff);
    put(V.HEAP_SIZE_WORD, 0x700);
    put(V.HEAP_NEXT_WORD, 0);
  }
  events.round = (target) => {
    assert.equal(target, 0x80c1ca);
    assert.equal(mem.read16(V.TASK_LIST_HEAD), 0);
    side.calls.push(['action', 0x80]);
  };
  if (name !== 'showDialogTextSequence') put(0, variant);
  if (realDrawing) side.render = drawTextBuffer;
  if (module === direct)
    Object.defineProperty(events, 'text', {
      get: () => assert.fail('live text must not read legacy services'),
    });
  const binding = rendererTable(side),
    table = new Map([[0x80fb39, binding.run]]);
  NATIVE_CALL_CONTINUATIONS.set(binding.run, binding);
  try {
    const renderer = module === direct ? (realDrawing ? undefined : side.render) : table,
      sequence =
        name === 'showDialogTextSequence'
          ? module === direct
            ? module[name](h, events, renderer, h.ctx.a)
            : module[name](h, events, events.text, renderer)
          : module[name](h, events, renderer);
    return finishTextWindow(side, sequence, budget);
  } finally {
    NATIVE_CALL_CONTINUATIONS.delete(binding.run);
  }
}

for (const budget of [1, 7]) {
  for (const variant of ['greeting', 'talk', 'topics and action', 'fallback', 'missing'])
    test(`dialog renderer: ${variant}, budget ${budget}`, () => {
      const actual = run(direct, 'showDialogTextSequence', variant, budget);
      assertFrozenRun(actual);
      assert.equal(
        actual.calls.filter(([kind]) => kind === 'text').length,
        variant === 'missing' ? 0 : 1,
      );
      if (variant === 'topics and action') {
        assert.deepEqual([...actual.wram.slice(TOPIC_LIST, TOPIC_LIST + 5)], [1, 2, 5, 8, 0xff]);
        assert.deepEqual(actual.calls.at(-1), ['action', 0x80]);
      }
    });
  for (const name of ['printWindowTextSequence', 'printTopicTextSequence'])
    for (const number of [0, 4])
      test(`script dialog renderer: ${name}, text ${number}, budget ${budget}`, () => {
        const actual = run(direct, name, number, budget);
        assertFrozenRun(actual);
        assert.equal(actual.calls.length, 1);
        assert.equal(actual.uploads.length, name === 'printTopicTextSequence' ? 1 : 0);
      });
}

for (const budget of [1, 7])
  for (const variant of ['greeting', 'talk', 'fallback', 'missing'])
    test(`dialog text default glyphs: ${variant}, budget ${budget}`, () => {
      assertFrozenRun(run(direct, 'showDialogTextSequence', variant, budget, true));
    });
