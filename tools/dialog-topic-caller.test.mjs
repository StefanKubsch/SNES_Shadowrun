import test from 'node:test';
import assert from 'node:assert/strict';
import { dialogTopicSequence as direct } from '../src/game/dialog-text.mjs';
import { dialogTopicSequence as former } from '../proof/caller/dialog-topic.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import { NativeCallContinuation } from '../src/system/native-call-continuation.mjs';
import * as V from '../src/vm/layout.mjs';

function run(sequence, script, budget, hook = 'nested') {
  const side = textWindowSide(),
    { h, mem, put, events } = side;
  put(0x11, 0x6000);
  mem.wram[0x13] = 0x7e;
  put(0x6004, script);
  put(0x26, 0x40);
  h.ctx.y = 4;
  put(V.TASK_FREE_LIST, 0);
  put(V.TASK_NEXT, 2);
  put(V.TASK_NEXT + 2, 0xffff);
  put(V.TASK_LIST_HEAD, 0xffff);
  put(V.HEAP_SIZE_WORD, 0x700);
  put(V.HEAP_NEXT_WORD, 0);
  events.nestedRound = (target) => {
    assert.equal(target, 0x80c1ca);
    return new NativeCallContinuation(
      h.a,
      (function* () {
        yield () => {
          assert.equal(mem.read16(V.TASK_LIST_HEAD), 0);
          assert.equal(mem.read16(0), 0x40);
          side.calls.push([
            'visit',
            mem.read16(V.TASK_FRAME),
            mem.read16(0x7e0000 | (h.ctx.s + 1)),
          ]);
        };
        let result;
        yield () => {
          result = h.rts();
        };
        return result;
      })(),
    );
  };
  if (hook !== 'nested') {
    events.nestedRound = hook === 'null child' ? () => null : undefined;
    events.values = Object.freeze([7]);
    events.inputs = Object.freeze([8]);
    events.round = (target) => {
      assert.equal(target, 0x80c1ca);
      assert.equal(mem.read16(V.TASK_LIST_HEAD), 0);
      side.calls.push(['sync visit', mem.read16(0)]);
      h.rts();
      return { wait: [11, 12], input: [13] };
    };
  }
  const result = finishTextWindow(side, sequence(h, events), budget);
  return { ...result, values: events.values, inputs: events.inputs };
}
for (const budget of [1, 7])
  for (const script of [0x80, 0x10f])
    test(`dialog topic actual append: script ${script}, budget ${budget}`, () => {
      const actual = run(direct, script, budget);
      assert.deepEqual(actual, run(former, script, budget));
      assert.equal(actual.calls.length, 1);
      assert.equal(actual.calls[0][2], 0x91d6);
    });

for (const budget of [1, 7])
  for (const hook of ['sync', 'null child'])
    test(`dialog topic synchronous observation collection: ${hook}, budget ${budget}`, () => {
      const result = run(direct, 0x80, budget, hook);
      assert.deepEqual(result.values, [7, 11, 12]);
      assert.deepEqual(result.inputs, [8, 13]);
      assert.ok(Object.isFrozen(result.values) && Object.isFrozen(result.inputs));
      assert.deepEqual(result.calls, [['sync visit', 0x40]]);
    });

test('dialog topic without scheduler stops before task or argument changes', () => {
  const side = textWindowSide();
  const before = side.mem.wram.slice();
  const continuation = new NativeCallContinuation(side.a, direct(side.h, side.events));
  assert.throws(
    () => continuation.run(1),
    (error) => error.reason === 'task_dialog_topic_visit_open',
  );
  assert.deepEqual(side.mem.wram, before);
});
