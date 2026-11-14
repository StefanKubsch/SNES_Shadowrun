import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeOpcodeFEC1 } from '../proof/task/native-c8-opcode.mjs';
import { prepareTaskNativeFEC1 } from '../proof/task/native-fec1.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskNativeC8Fixture } from './task-native-c8-fixtures.mjs';
import { renderAddress } from '../src/render/data.mjs';
import { taskFEC1Fixture } from './task-native-fec1-fixtures.mjs';
import { heldWord } from './render-be6d-fixtures.mjs';
const freeze = (values) => Object.freeze(values.map((o) => Object.freeze(o)));
const prepare = (f, patch = {}) => {
  const before = f.data.snapshot(),
    p = prepareTaskNativeOpcodeFEC1({ ...f, ...patch });
  assert.deepEqual(f.data.snapshot(), before);
  return p;
};
const word = (p, address) => {
  const m = new Map(p.byteWrites);
  return m.get(address) | (m.get(address + 1) << 8);
};
test('Original Native58/C8: exactly seven real pops, actual F508/wholeFEC1/ID0000/F509, one commit before nextF390', () => {
  for (const inputs of [
    {},
    { cursor: 0 },
    { occupied: [4, 4, 4, 4] },
    { cursor: 0, occupied: [4, 4, 4, 4], activeAF1F: true },
  ]) {
    const f = taskNativeC8Fixture(inputs),
      p = prepare(f);
    assert.equal(p.handled, true, JSON.stringify(p));
    assert.equal(p.arguments.wordPops, 7);
    assert.equal(p.arguments.metadataWord, 7);
    assert.equal(p.arguments.id, 0xc8);
    assert.equal(p.arguments.freshId, 0xc8);
    assert.equal(p.calleeEntry, 0x80fec1);
    assert.equal(p.tablePointerWord, 0xfec1);
    assert.equal(p.dispatchPointerWord, 0xfec1);
    assert.equal(p.calleeReturnWord, 0xf508);
    assert.equal(p.calleeReturnTarget, 0x80f509);
    assert.equal(p.metadataWord, 0);
    assert.equal(p.resultPushed, false);
    const { status, ...context } = p.outputContext;
    assert.deepEqual(context, {
      a: 0x14,
      x: 0x14,
      y: 6,
      s: 0x3fe,
      d: 0x1000,
      bank: 0x80,
      e: 0,
      programBank: 0x80,
      pc: 0xf390,
    });
    assert.equal(p.frontier, '80:F390');
    assert.equal(p.dynamicDispatchExecuted, false);
    assert.equal(p.calleeReturnTargetExecuted, true);
    assert.equal(p.fullTaskBinding, false);
    const independent = prepareTaskNativeFEC1(taskFEC1Fixture(inputs));
    assert.equal(independent.handled, true);
    assert.equal(status, independent.outputContext.status & ~0x82);
    assert.deepEqual(
      [p.callee.outcome, p.callee.allocation, p.callee.slot, p.callee.visits],
      [independent.outcome, independent.allocation, independent.slot, independent.visits],
    );
    const writes = new Map(p.byteWrites);
    for (const [address, value] of independent.byteWrites)
      if (address < 0x7e06e0 || address > 0x7e0701)
        assert.equal(writes.get(address), value, `@${address.toString(16)}`);
    assert.equal(word(p, 0x7e1003), 5);
    assert.equal(word(p, 0x7e1007), 0x3fe);
    assert.equal(word(p, 0x7e1009), 0xc8);
    assert.equal(word(p, 0x7e01f2), 0x6ff);
    assert.deepEqual(
      p.accesses.filter((e) => e.label === 'native-argument-PLA-low').map((e) => e.value),
      [2, 2, 10, 8, 0, 0, 60],
    );
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(f.data.readByte(0x7e0700).value, 0x0a);
    assert.equal(f.data.readByte(0x7e0701).value, 0xc2);
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  }
});
test('Original NativeC8: full-X/slot/argument/fresh-ID/original pointer and return WORDs cannot substitute source', () => {
  assert.equal(
    prepare(taskNativeC8Fixture(), {
      context: Object.freeze({ ...taskNativeC8Fixture().context, x: 0xff58 }),
    }).reason,
    'task_native_c8_opcode_required',
  );
  for (const [address, value, reason] of [
    [0x80f30c, 0xf398, 'task_opcode_target_required'],
    [0x801204, 0x14c9, 'task_native_c8_argument_source_required'],
    [0x82db14, 0x0107, 'task_native_c8_argument_source_required'],
    [0x82db14, 0, 'task_native_c8_argument_source_required'],
    [0x82d948, 0xca3a, 'task_native_c8_target_required'],
    [0x82da38, 0x100, 'task_native_c8_return_source_required'],
    [0x82da38, 1, 'task_native_c8_return_source_required'],
  ]) {
    const f = taskNativeC8Fixture();
    heldWord(f.data, address, value);
    if (address === 0x801204) heldWord(f.data, 0x82db15, 0);
    assert.equal(prepare(f).reason, reason);
  }
  const alias = prepare(taskNativeC8Fixture({ s: 0xa3 }));
  assert.equal(alias.reason, 'task_native_c8_target_required');
  assert.equal(alias.tablePointerWord, 0xfec1);
  assert.equal(alias.pointerWord, 0xf508);
  const id = prepare(taskNativeC8Fixture({ frame: 0xc0, cursor: 0 }));
  assert.equal(id.reason, 'task_native_resume_id_required');
  assert.equal(id.expectedNativeId, 0xc8);
});
test('Original NativeC8: actual saved operand S/Task PC and next opcode stay independently fresh after all helper stores', () => {
  for (const frame of [0x1000, 0x1100, 0x1800])
    for (const operandS of [0x300, 0x3f0]) {
      const f = taskNativeC8Fixture({ frame, operandS }),
        p = prepare(f);
      assert.equal(p.handled, true);
      assert.equal(p.outputContext.d, frame);
      assert.equal(p.outputContext.s, operandS + 14);
    }
  const f = taskNativeC8Fixture();
  f.data.seed(0x801205, [0x56, 0xa5]);
  const p = prepare(f);
  assert.equal(p.handled, true);
  assert.equal(p.opcodeWord, 0xa556);
  assert.equal(p.outputContext.x, 0x56);
  assert.equal(p.outputContext.pc, 0xf390);
  const bad = taskNativeC8Fixture();
  heldWord(bad.data, 0x800262, 0x1100);
  assert.equal(prepare(bad).reason, 'render_source_required');
});
test('Original NativeC8: all discarded metadata/pointer/header highbytes and late opcode reads are required atomically', () => {
  for (const omit of [
    0x80f30d, 0x801205, 0x82db15, 0x82d949, 0x82da39, 0x7e0263, 0x7e1002, 0x801206, 0x7e03fe,
    0x9d8011,
  ]) {
    const p = prepare(taskNativeC8Fixture({ omit }));
    assert.equal(p.reason, 'render_source_required');
    assert.equal(p.address, renderAddress(omit));
  }
});
test('Original NativeC8: global chronological observations and real outer owner/window/budget/commit failures are atomic', () => {
  const f = taskNativeC8Fixture({ cursor: 0, occupied: [4, 4, 4, 4], activeAF1F: true }),
    p = prepare(f);
  assert.equal(p.handled, true);
  assert.equal(prepare(f, { maxWork: p.work - 1 }).reason, 'task_work_budget_required');
  assert.equal(
    prepare(f, { maxOutputBytes: p.outputBytes - 1 }).reason,
    'task_output_budget_required',
  );
  assert.equal(
    prepare(f, { ioObservations: freeze(f.ioObservations.slice(0, -1)) }).reason,
    'task_io_observation_required',
  );
  assert.equal(
    prepare(f, { waitObservations: freeze(f.waitObservations.slice(0, -1)) }).reason,
    'task_wait_observation_required',
  );
  assert.equal(
    prepare(f, { ioObservations: freeze([...f.ioObservations, f.ioObservations.at(-1)]) }).reason,
    'task_io_observation_unused',
  );
  assert.equal(
    prepare(f, { waitObservations: freeze([...f.waitObservations, f.waitObservations.at(-1)]) })
      .reason,
    'task_wait_observation_unused',
  );
  assert.equal(
    prepare(f, { protectedStackBytes: [0x7e0700, 0x7e0702] }).reason,
    'task_outer_return_required',
  );
  const other = taskNativeC8Fixture();
  assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
  f.data.seed(0, [1]);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  const limited = taskNativeC8Fixture({
    writeWindows: [
      [0x7e0000, 0x7e01f1],
      [0x7e01f4, 0x7fffff],
    ],
  });
  assert.equal(prepare(limited).reason, 'render_write_window_required');
});
