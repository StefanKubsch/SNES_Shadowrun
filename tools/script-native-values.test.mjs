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
import { setObjectWordIn } from '../src/state/objects.mjs';
import { OBJECT_LAST_SLOT } from '../src/data/wram.mjs';

function fixture() {
  const mem = new VmMemory(cartridge.rom, new Uint8Array(0x20000), null, cartridge.present);
  const natives = new ScriptNatives(mem, { admitted: nativeTargetEntries, implementation });
  const scheduler = new Scheduler(mem);
  // The remaining scheduler entry adapter owns the visit; the leaf must never
  // allocate or touch a TaskAccessor, even with an unusable outer stack value.
  natives.stacks.push(NaN);
  natives.accessor = () => assert.fail('ordinary leaf allocated a CPU accessor');
  const call = (target, args) => {
    let id = 0;
    while (nativeTarget(mem, id) !== target) {
      assert.ok(id < 0x100, 'native pointer must exist');
      id++;
    }
    return natives.call(id, args, scheduler, 0);
  };
  return { mem, natives, scheduler, call };
}

test('script leaves return values without CPU entry registers or a return stack', () => {
  const { mem, natives, call } = fixture();
  for (const slot of [0, 2, OBJECT_LAST_SLOT, 0xffff]) {
    assert.equal(call(0x80ca0d, [slot, 0x1234]), slot);
    assert.equal(call(0x80ca05, [slot]), 0x1234);
  }
  assert.equal(natives.accessors.length, 0);
  assert.equal(natives.depth, 0);
  assert.equal(natives.calls, 8);
  assert.equal('ctx' in natives.leaf, false);
  assert.equal(mem.read16Bank0(0), 0x1234);
});

test('object creation appends its script through ordinary task services', () => {
  const { mem, scheduler, call } = fixture();
  for (let slot = 0; slot <= OBJECT_LAST_SLOT; slot += 2)
    setObjectWordIn(mem.wram, 'kind', slot, 0xffff);
  // Script 0 is used only as a task allocation here; its bytecode is not run.
  assert.equal(call(0x80a835, [0, 10, 20, 30, 0]), OBJECT_LAST_SLOT);
  assert.equal(call(0x80a959, [OBJECT_LAST_SLOT]), 10);
  assert.ok(scheduler.tasks);
  assert.equal(scheduler.slots.filter((slot) => slot.task).length, 1);
});
