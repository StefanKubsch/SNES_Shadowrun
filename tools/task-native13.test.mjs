import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeOpcode9BA0 as prepare } from '../proof/task/native13-opcode.mjs';
import { prepareTaskNativeActions } from '../proof/task/native-actions.mjs';
import { prepareTaskNativeArguments } from '../proof/task/native-arguments.mjs';
import { prepareTaskNativeBridge } from '../proof/task/native-bridge.mjs';
import { prepareTaskNativeResume } from '../proof/task/native-resume.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskNative13Fixture as fixture } from './task-native13-fixtures.mjs';
import { taskActionsFixture } from './task-native-actions-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { seedWord } from './render-ad92-fixtures.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
const word = (p, address) => {
  const m = new Map(p.byteWrites);
  return m.get(address) | (m.get(address + 1) << 8);
};
test('Original Native58/13: one genuine pop, F508/whole99EB/F509/result-PHA/freshF390; exact separately observed plan chain', () => {
  for (const inputs of [
    { mask: 0 },
    {},
    { mask: 16, held: 16 },
    { mask: 0x80, held: 32 },
    { mask: 0x600 },
    { mask: 65535 },
  ]) {
    const f = fixture(inputs),
      p = prepared(prepare, f),
      root = prepared(prepareTaskNativeActions, taskActionsFixture(0x809ba0, inputs));
    assert.equal(p.arguments.wordPops, 1);
    assert.equal(p.arguments.metadataWord, 0x0201);
    assert.equal(p.arguments.id, 0x13);
    assert.equal(p.arguments.freshId, 0x13);
    assert.equal(p.calleeEntry, 0x809ba0);
    assert.equal(p.tablePointerWord, 0x9ba0);
    assert.equal(p.dispatchPointerWord, 0x9ba0);
    assert.equal(p.calleeReturnWord, 0xf508);
    assert.equal(p.calleeReturnTarget, 0x80f509);
    assert.equal(p.metadataWord, 2);
    assert.equal(p.resultPushed, true);
    assert.equal(p.outputContext.s, 0x3f0);
    assert.equal(p.outputContext.d, 0x1000);
    assert.equal(p.outputContext.bank, 0x80);
    assert.equal(p.outputContext.a, 0x14);
    assert.equal(p.outputContext.x, 0x14);
    assert.equal(p.outputContext.y, 6);
    assert.equal(p.outputContext.pc, 0xf390);
    assert.equal(p.frontier, '80:F390');
    assert.equal(p.calleeReturnTargetExecuted, true);
    assert.equal(p.dynamicDispatchExecuted, false);
    assert.equal(p.fullTaskBinding, false);
    assert.equal(p.callee.nativeResult, root.nativeResult);
    assert.equal(word(p, 0x7e03f1), root.nativeResult);
    assert.equal(word(p, 0x7e1003), 5);
    assert.equal(word(p, 0x7e1007), 0x3f2);
    assert.equal(word(p, 0x7e1009), 0x13);
    assert.equal(word(p, 0x7e01f2), 0x6ff);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(f.data.readByte(0x7e0700).value, 0x0a);
    assert.equal(f.data.readByte(0x7e0701).value, 0xc2);
    const g = fixture(inputs),
      prefix = prepared(prepareTaskNativeArguments, {
        ...g,
        ioMode: null,
        ioObservations: null,
        entry: 0x80f4cb,
        context: Object.freeze({ ...g.context, pc: 0xf4cb }),
      });
    assert.equal(commitTaskPlan(g.data, prefix).handled, true);
    const bridge = prepared(prepareTaskNativeBridge, {
      ...g,
      ioMode: null,
      ioObservations: null,
      entry: 0x80f4f6,
      context: prefix.outputContext,
    });
    assert.equal(commitTaskPlan(g.data, bridge).handled, true);
    // The separate observation declares the real original JMP(A2) target and
    // protects the actual F508 bytes for this standalone callee plan.
    const callee = prepared(prepareTaskNativeActions, {
      ...g,
      entry: 0x809ba0,
      protectedStackBytes: [0x7e06fe, 0x7e06ff],
      context: Object.freeze({ ...bridge.outputContext, pc: 0x9ba0 }),
    });
    assert.equal(commitTaskPlan(g.data, callee).handled, true);
    const resume = prepared(prepareTaskNativeResume, {
      ...g,
      ioMode: null,
      ioObservations: null,
      entry: 0x80f509,
      context: callee.outputContext,
    });
    assert.deepEqual(resume.outputContext, p.outputContext);
    assert.equal(p.work, prefix.work + bridge.work + callee.work + resume.work + 4);
  }
});
test('Original Native13: full-X, original slot/argument/return WORDs, freshA2 after actualJSR and freshID after all original writes', () => {
  const f = fixture();
  unchangedFailure(
    prepare,
    f,
    { context: Object.freeze({ ...f.context, x: 0xff58 }) },
    'task_native13_opcode_required',
  );
  for (const [address, value, reason] of [
    [0x80f30c, 0xf398, 'task_opcode_target_required'],
    [0x801204, 0x1414, 'task_native13_argument_source_required'],
    [0x82da5f, 0x0101, 'task_native13_argument_source_required'],
    [0x82da5f, 0, 'task_native13_argument_source_required'],
    [0x82d7de, 0x9ba1, 'task_native13_target_required'],
    [0x82d983, 0, 'task_native13_return_source_required'],
    [0x82d983, 1, 'task_native13_return_source_required'],
    [0x82d983, 0x102, 'task_native13_return_source_required'],
  ]) {
    const g = fixture();
    seedWord(g.data, address, value);
    if (address === 0x801204) seedWord(g.data, 0x82da60, 0);
    unchangedFailure(prepare, g, {}, reason);
  }
  const alias = unchangedFailure(
    prepare,
    fixture({ s: 0xa3 }),
    {},
    'task_native13_target_required',
  );
  assert.equal(alias.tablePointerWord, 0x9ba0);
  assert.equal(alias.pointerWord, 0xf508);
  for (const frame of [0x60, 0xa0, 0xc0]) {
    const q = unchangedFailure(prepare, fixture({ frame }), {}, 'task_native_resume_id_required');
    assert.equal(q.expectedNativeId, 0x13);
    assert.equal(q.nativeId, 0);
  }
});
test('Original Native13: actual argument/outer stacks, freshTaskD/bank/PC/pointer/result owners and discarded highbytes', () => {
  for (const frame of [0x1000, 0x1100, 0x1800])
    for (const operandS of [0x300, 0x3f0])
      for (const scriptBank of [0x80, 0x83]) {
        const f = fixture({ frame, operandS, scriptBank, mask: 16, held: 16 }),
          p = prepared(prepare, f);
        assert.equal(p.outputContext.d, frame);
        assert.equal(p.outputContext.s, operandS);
        assert.equal(p.outputContext.bank, scriptBank);
        assert.equal(word(p, 0x7e0000 + operandS + 1), 16);
      }
  const changed = fixture();
  changed.data.seed(0x801205, [0x56, 0xa5]);
  const p = prepared(prepare, changed);
  assert.equal(p.opcodeWord, 0xa556);
  assert.equal(p.outputContext.x, 0x56);
  const physical = fixture({ scriptBank: 0x7f, mask: 16 });
  seedWord(physical.data, 0, 0x80);
  const q = prepared(prepare, physical);
  assert.equal(q.callee.nativeResult, 0);
  assert.equal(word(q, 0x7f0000), 16);
  assert.equal(word(q, 0x7e03f1), 16);
  // Argument and result bank7F owner remains independently16; Native13 reads
  // actual DP00/7E and returns0 for its80 mask after cancel. No host bankcopy.
  for (const omit of [
    0x80f30d, 0x801205, 0x82da60, 0x82d7df, 0x82d984, 0x7e0263, 0x7e1002, 0x801206, 0x7e03f2,
  ])
    unchangedFailure(prepare, fixture({ omit }), {}, 'render_source_required');
  const wrong = fixture();
  seedWord(wrong.data, 0x800262, 0x1100);
  unchangedFailure(prepare, wrong, {}, 'render_source_required');
});
test('Original Native13: global chronological frozen device/wait/control records and exact cumulative budgets remain atomic', () => {
  const f = fixture({ mask: 16, held: 16 }),
    p = prepared(prepare, f);
  prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    prepare,
    f,
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  unchangedFailure(
    prepare,
    f,
    { ioObservations: menuRecords(f.ioObservations.slice(0, -1)) },
    'task_io_observation_required',
  );
  unchangedFailure(
    prepare,
    f,
    { ioObservations: menuRecords([...f.ioObservations, f.ioObservations.at(-1)]) },
    'task_io_observation_unused',
  );
  unchangedFailure(
    prepare,
    f,
    { waitObservations: menuRecords(f.waitObservations.slice(0, -1)) },
    'task_wait_observation_required',
  );
  unchangedFailure(
    prepare,
    f,
    { waitObservations: menuRecords([...f.waitObservations, f.waitObservations.at(-1)]) },
    'task_wait_observation_unused',
  );
  unchangedFailure(
    prepare,
    f,
    { protectedStackBytes: [0x7e0700, 0x7e0702] },
    'task_outer_return_required',
  );
  unchangedFailure(
    prepare,
    fixture({
      writeWindows: [
        [0x7e0000, 0x7e01f1],
        [0x7e01f4, 0x7fffff],
      ],
    }),
    {},
    'render_write_window_required',
  );
  const controls = menuRecords(
    [16, 0x3030].map((value) => ({ pc: 0x809e1a, address: 0x8001ca, width: 2, value })),
  );
  unchangedFailure(
    prepare,
    f,
    { inputMode: 'record-observations', inputObservations: controls },
    'task_reset_source_required',
  );
  unchangedFailure(
    prepare,
    f,
    { inputMode: 'record-observations', inputObservations: Object.freeze(Array(1)) },
    'task_input_observations_required',
  );
  assert.equal(commitTaskPlan(fixture().data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  f.data.seed(0, [1]);
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), before);
});
