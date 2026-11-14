import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderData } from '../src/render/data.mjs';
import { prepareTaskLocalReads as prepare } from '../proof/task/local-reads.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskFixture } from './task-native-fixtures.mjs';
import { unchangedFailure, prepared, commit, writes, reads } from './task-native-test-support.mjs';
const roots = [8450977, 8451001, 8452299];
test('native local BYTE/WORD reads use full LowX index and both bank00 local bytes', () => {
  for (const entry of roots) {
    const f = taskFixture(entry),
      p = commit(prepare, f),
      direct = entry === 0x80f8cb,
      value = direct ? 0xfe : entry === 0x80f3b9 ? 0xabcd : 0xcd;
    assert.equal(p.value, value);
    assert.equal(p.index, direct ? null : 0x14);
    assert.deepEqual(writes(p), [
      [0x3f0, value >>> 8],
      [0x3ef, value & 255],
    ]);
    assert.equal(p.outputContext.y, direct ? 5 : 6);
    assert.equal(p.outputContext.s, 0x3ee);
    assert.ok(reads(p).includes(direct ? 0x213 : 0x227));
  }
});
test('local indexed offsets0/FF need full operandHigh and WORDlocalHigh even after byte mask', () => {
  for (const entry of [0x80f3a1, 0x80f3b9])
    for (const index of [0, 255]) {
      const f = taskFixture(entry);
      f.data.seed(0x801204, [index, 0xf1, 0xff]);
      f.data.seed(0x213 + index, [0x80, 0x99]);
      const p = prepared(prepare, f);
      assert.equal(p.index, index);
      assert.equal(p.value, entry === 0x80f3a1 ? 0x80 : 0x9980);
      assert.ok(reads(p).includes(0x214 + index));
    }
});
test('unindexedC2 has no operand pointer read and its PHA may change next opcode before refetch', () => {
  const f = taskFixture(0x80f8cb, { pointer: 0x3eb }),
    p = prepared(prepare, f);
  assert.equal(p.value, 0xfe);
  assert.equal(p.opcodeWord, 0x00fe);
  assert.deepEqual(reads(p).slice(0, 2), [0x213, 0x214]);
  assert.equal(p.outputContext.a, 0xfe);
});
test('local-reads prepare is no-effect; missing sources and exhausted work are atomic for every entry', () => {
  for (const entry of roots) {
    const f = taskFixture(entry);
    prepared(prepare, f);
    unchangedFailure(prepare, f, { maxWork: 0 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      taskFixture(entry, { seedOpcode: false }),
      {},
      'render_source_required',
    );
  }
});
test('local-reads protected operand aliases and wrong observed PC are rejected before commit', () => {
  for (const entry of roots) {
    const f = taskFixture(entry);
    unchangedFailure(
      prepare,
      f,
      { protectedStackBytes: [8258544, 8258543] },
      'task_stack_alias_required',
    );
    unchangedFailure(
      prepare,
      f,
      { context: Object.freeze({ ...f.context, pc: 0 }) },
      'task_context_required',
    );
  }
});
test('local-reads output budget and explicit last-byte windows keep all writes back', () => {
  for (const entry of roots)
    if (entry !== 0x80f8bb) {
      unchangedFailure(
        prepare,
        taskFixture(entry),
        { maxOutputBytes: 0 },
        'task_output_budget_required',
      );
      unchangedFailure(
        prepare,
        taskFixture(entry, { writeWindows: [] }),
        {},
        'render_write_window_required',
      );
    }
});
test('local-reads stale/foreign/forged and reused plans never commit a context or second write', () => {
  const f = taskFixture(roots[0]),
    p = prepared(prepare, f),
    other = taskFixture(roots[0]);
  assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  f.data.seed(0x100, [1]);
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), before);
  const p2 = prepared(prepare, f);
  assert.equal(commitTaskPlan(f.data, p2).handled, true);
  const after = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, p2).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), after);
});
