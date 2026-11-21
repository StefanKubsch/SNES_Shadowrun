import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSceneSequence } from '../src/game/scene-load.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { createSide } from './lift-function-harness.mjs';

for (const scene of [0, 3, 164])
  test(`scene ${scene} initializes without a CPU context at every budget boundary`, () => {
    const { a } = createSide({ seed: 1, wram: new Uint8Array(0x20000) }, new Map());
    const before = { ...a.ctx };
    const stack = a.mem.wram.slice(0x100, 0x1ca);
    const h = {
      a,
      get ctx() {
        throw new Error('scene initialization must not read or write CPU context');
      },
    };
    const runner = new SequenceRunner(loadSceneSequence(h, scene));
    const memory = a.mem.wram.slice();
    assert.equal(runner.run(0), WAIT_PAUSED);
    assert.deepEqual(a.mem.wram, memory);
    do {
      runner.run(1);
      assert.deepEqual(a.ctx, before);
      assert.deepEqual(a.mem.wram.slice(0x100, 0x1ca), stack);
    } while (!runner.done);
    const completed = a.mem.wram.slice();
    runner.run(10);
    assert.deepEqual(a.mem.wram, completed, 'completed initialization is not replayed');
  });
