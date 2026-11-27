import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { ScriptNatives, nativeTarget } from '../src/script/natives.mjs';
import {
  nativeTarget as implementation,
  nativeTargetEntries,
} from '../src/script/native-targets.mjs';
import { Scheduler } from '../src/script/scheduler.mjs';
import { LagFreeFrames } from '../src/vm/frame-events.mjs';
// These calls take the register-level native path without value services, so they
// install the compatibility entries (docs/REGISTER-COMPAT-BOUNDARY.md).
import './register-forms/native-dialog-support.mjs';

function fixture(target, args, budget, unused = false) {
  const mem = new VmMemory(cartridge.rom, new Uint8Array(0x20000), null, cartridge.present);
  const devices = {
    take: () => ({ io: unused ? [{}] : [], wait: [], input: [], interrupts: new LagFreeFrames() }),
  };
  const natives = new ScriptNatives(mem, {
    admitted: nativeTargetEntries,
    implementation,
    devices,
  });
  const scheduler = new Scheduler(mem);
  scheduler.slots[0].task = { pc: 0 };
  // Inner window/device callees still use CPU workspace. These no-op routes
  // exercise the script boundary without entering those remaining adapters.
  natives.stacks.push(0x1c80);
  const accessor = natives.accessor.bind(natives);
  natives.accessor = () => {
    const a = accessor();
    a.pushWord = a.pullWord = () => assert.fail('script boundary used a CPU frame');
    return a;
  };
  natives.workBudget = budget;
  let id = 0;
  while (nativeTarget(mem, id) !== target) {
    assert.ok(id < 0x100);
    id++;
  }
  return { mem, natives, result: natives.call(id, args, scheduler, 0) };
}

for (const budget of [1, 7, Infinity])
  for (const [target, args, expected] of [
    [0x808e36, [0, 0], 0],
    [0x808ab5, [0, 0xffff], 0],
  ])
    test(`script native ${target.toString(16)} returns without an outer CPU frame, budget ${budget}`, () => {
      const { mem, natives, result } = fixture(target, args, budget);
      if (budget === Infinity) assert.equal(result, expected);
      else {
        const a = natives.accessors[0];
        let steps = 0;
        for (;;) {
          Object.assign(a.ctx, { s: NaN, pc: NaN, programBank: NaN });
          if (result.resume()) break;
          assert.ok(++steps < 1000);
          assert.equal(a.io, null);
        }
        assert.equal(result.result, expected);
        assert.ok(Number.isNaN(a.ctx.s));
        assert.ok(Number.isNaN(a.ctx.pc));
        const snapshot = mem.wram.slice();
        assert.equal(result.resume(), true);
        assert.deepEqual(mem.wram, snapshot);
      }
      assert.equal(natives.depth, 0);
      assert.equal(natives.calls, 1);
      assert.equal(natives.accessors[0].io, null);
    });

test('failed waiting script natives release their accessor once and cannot replay', () => {
  const { natives, result } = fixture(0x808e36, [0, 0], 1, true);
  assert.throws(
    () => {
      while (!result.resume()) {
        /* Reach the actual finish. */
      }
    },
    { reason: 'device_observation_unused' },
  );
  assert.equal(natives.depth, 0);
  assert.equal(natives.accessors[0].io, null);
  assert.throws(() => result.resume(), { reason: 'script_native_failed' });
  assert.equal(natives.depth, 0);
});
