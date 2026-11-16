import test from 'node:test';
import assert from 'node:assert/strict';
import * as direct from '../src/game/dialog-text.mjs';
import * as previous from '../proof/caller/dialog-text.mjs';
import { dialogTextRoutines } from '../src/system/native-dialog-text.mjs';
import { NATIVE_CALL_CONTINUATIONS } from '../src/system/native-call-continuation.mjs';
import { TOPIC_LIST, TOPIC_FLAGS } from '../src/data/wram.mjs';
import { textWindowSide, finishTextWindow, rendererTable } from './text-window-caller-harness.mjs';

function entry(key, text, topics = [], action = null) {
  const flags = topics.length | (action === null ? 0 : 0x80),
    words = action === null ? [text] : [action, text],
    bytes = words.flatMap((word) => [word & 0xff, word >>> 8]);
  return [key, 4 + topics.length + (action === null ? 0 : 2), flags, ...topics, ...bytes];
}

function run(module, name, variant, budget) {
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
    records = entry(42, 0x7074, [8, 5, 1], 0x1234);
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
  events.text = dialogTextRoutines(events);
  events.text.topic = (callee) => {
    const action = mem.read16(0x7e6000 + callee.ctx.y);
    assert.equal(action, 0x1234, 'action receives restored record position');
    side.calls.push(['action', action]);
  };
  if (name !== 'showDialogTextSequence') put(0, variant);
  const binding = rendererTable(side),
    table = new Map([[0x80fb39, binding.run]]);
  NATIVE_CALL_CONTINUATIONS.set(binding.run, binding);
  try {
    const renderer = module === direct ? side.render : table,
      sequence =
        name === 'showDialogTextSequence'
          ? module[name](h, events, events.text, renderer)
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
      assert.deepEqual(actual, run(previous, 'showDialogTextSequence', variant, budget));
      assert.equal(
        actual.calls.filter(([kind]) => kind === 'text').length,
        variant === 'missing' ? 0 : 1,
      );
      if (variant === 'topics and action') {
        assert.deepEqual([...actual.wram.slice(TOPIC_LIST, TOPIC_LIST + 5)], [1, 2, 5, 8, 0xff]);
        assert.deepEqual(actual.calls.at(-1), ['action', 0x1234]);
      }
    });
  for (const name of ['printWindowTextSequence', 'printTopicTextSequence'])
    for (const number of [0, 4])
      test(`script dialog renderer: ${name}, text ${number}, budget ${budget}`, () => {
        const actual = run(direct, name, number, budget);
        assert.deepEqual(actual, run(previous, name, number, budget));
        assert.equal(actual.calls.length, 1);
        assert.equal(actual.uploads.length, name === 'printTopicTextSequence' ? 1 : 0);
      });
}
