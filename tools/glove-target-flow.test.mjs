import test from 'node:test';
import assert from 'node:assert/strict';
import * as glove from '../src/game/glove-target.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { textWindowSide } from './text-window-caller-harness.mjs';
import * as W from '../src/data/wram.mjs';

const choices = [
  glove.chooseObjectUnderGloveSequence,
  glove.chooseObjectNumberSequence,
  glove.scriptChooseObjectNumberSequence,
  glove.scriptChooseObjectSequence,
  glove.spellGloveTargetSequence,
  glove.choosePlaceWithGloveSequence,
];

function fixture(request, delay) {
  const side = textWindowSide(),
    { h, mem, put, events } = side;
  put(W.DRAW_LIST_INDEX, 0xffff);
  put(W.GLOVE_TARGET_TAG, 0xffff);
  put(W.GLOVE_NAME_WINDOW, 0xffff);
  put(W.TEXT_MAP_UPLOAD, request);
  Object.assign(h.ctx, { programBank: 0x84, bank: 0x81, pc: 0x5678, status: 0xa5 });
  const context = { ...h.ctx },
    stack = mem.wram.slice(0x100, 0x1ca);
  const unchanged = () => {
    assert.deepEqual(h.ctx, context, 'choice preserves every CPU register');
    assert.deepEqual(mem.wram.slice(0x100, 0x1ca), stack, 'choice never writes the CPU stack');
  };
  const service = events.interrupts.textWait;
  let input = 0;
  events.frameJobs = () => assert.fail('fixture services every wait');
  events.interrupts.textWait = (...args) => {
    unchanged();
    if (args[3] !== 0x81b0a9) return service(...args);
    assert.ok(input <= delay, 'one input per frame');
    put(W.PAD_HELD, input++ === delay ? W.PAD_A : 0);
    put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
    return true;
  };
  return { ...side, unchanged, input: () => input };
}

for (const operation of choices) {
  for (const request of [0, 0xfffe, 0xffff])
    for (const delay of [0, 1])
      test(`${operation.name} composes preparation and frames directly, request ${request}, delay ${delay}`, () => {
        const side = fixture(request, delay),
          runner = new SequenceRunner(operation(side.h, side.events, undefined, false));
        const before = side.mem.wram.slice();
        assert.equal(runner.run(0), WAIT_PAUSED);
        assert.deepEqual(side.mem.wram, before);
        let steps = 0;
        do {
          runner.run(1);
          side.unchanged();
          assert.ok(++steps < 1000, 'bounded choice');
        } while (!runner.done);
        assert.equal(side.input(), delay + 1);
        assert.equal(side.mem.read16(W.GLOVE_KIND), 0);
        assert.equal(
          side.mem.read16(0),
          operation === glove.choosePlaceWithGloveSequence ? 0 : 0xffff,
        );
        if (operation === glove.choosePlaceWithGloveSequence)
          assert.equal(side.mem.read16(0x7e0000 | W.MOTION_ACTIVE), 1);
        const completed = side.mem.wram.slice();
        runner.run(1000);
        assert.deepEqual(side.mem.wram, completed);
        assert.equal(side.input(), delay + 1, 'completion never consumes more input');
      });

  test(`${operation.name} preserves CPU context and rejects replay after wait failure`, () => {
    const side = fixture(0, 0),
      failure = new Error('choice wait failed');
    side.events.interrupts.textWait = () => {
      side.unchanged();
      throw failure;
    };
    const runner = new SequenceRunner(operation(side.h, side.events, undefined, false));
    assert.throws(
      () => runner.run(1000),
      (error) => error === failure,
    );
    side.unchanged();
    assert.throws(
      () => runner.run(1000),
      (error) => error.reason === 'native_call_failed',
    );
  });
}
