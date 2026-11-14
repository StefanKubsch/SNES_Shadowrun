import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderData } from '../src/render/data.mjs';
import { prepareTaskConsumers as prepare } from '../proof/task/consumers.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskFixture } from './task-native-fixtures.mjs';
import { unchangedFailure, prepared, commit, writes, reads } from './task-native-test-support.mjs';
const roots = [8452283, 8451378, 8451387];
test('native Add/Subtract independent wrap/Carry/Overflow cases retain WORD stores and source S+2', () => {
  for (const [entry, left, right, value, cv] of [
    [0x80f532, 65535, 1, 0, 1],
    [0x80f532, 32767, 1, 32768, 64],
    [0x80f532, 32768, 32768, 0, 65],
    [0x80f53b, 0, 1, 65535, 0],
    [0x80f53b, 32767, 65535, 32768, 64],
    [0x80f53b, 32768, 1, 32767, 65],
    [0x80f53b, 65535, 65535, 0, 1],
  ]) {
    const f = taskFixture(entry, { top: right, left }),
      p = commit(prepare, f);
    assert.equal(p.value, value);
    assert.equal(p.outputContext.status & 0x41, cv);
    assert.equal(p.outputContext.s, 0x3f2);
    assert.deepEqual(writes(p), [
      [0x3f3, value & 255],
      [0x3f4, value >>> 8],
    ]);
  }
});
test('Drop reads full discardedWORD, performs no leftread/store and accepts decimal flags/output0', () => {
  const f = taskFixture(0x80f8bb, { status: 8 }),
    p = prepared(prepare, { ...f, maxOutputBytes: 0 });
  assert.deepEqual(reads(p), [0x3f1, 0x3f2, 0x200, 0x201, 0x801204, 0x801205]);
  assert.deepEqual(writes(p), []);
  assert.equal(p.outputContext.status, 8);
  assert.equal(p.discardedWord, 0x1234);
});
test('Subtract retains store-before-fresh-PLA order, Add freshly reads pointer after own left-store alias', () => {
  let f = taskFixture(0x80f53b),
    p = prepared(prepare, f);
  assert.deepEqual(
    p.accesses.slice(0, 8).map((a) => [a.kind, a.address]),
    [
      ['read', 0x3f3],
      ['read', 0x3f4],
      ['read', 0x3f1],
      ['read', 0x3f2],
      ['write', 0x3f3],
      ['write', 0x3f4],
      ['read', 0x3f1],
      ['read', 0x3f2],
    ],
  );
  f = taskFixture(0x80f532, { top: 1, left: 0x12ff, d: 0x3f3 });
  f.data.seed(0x801304, [0x14, 0x99]);
  p = prepared(prepare, f);
  assert.equal(p.value, 0x1300);
  assert.ok(reads(p).includes(0x801304));
});
test('Add/Subtract reject decimalFlag1 before any effect but Drop wraps bank00:SFFFF without a cap', () => {
  for (const entry of [0x80f532, 0x80f53b]) {
    const f = taskFixture(entry, { status: 8 });
    unchangedFailure(prepare, f, {}, 'task_binary_decimal_required');
  }
  const p = prepared(prepare, taskFixture(0x80f8bb, { s: 65535 }));
  assert.equal(p.outputContext.s, 1);
  assert.deepEqual(reads(p).slice(0, 2), [0, 1]);
});
test('consumers prepare is no-effect; missing sources and exhausted work are atomic for every entry', () => {
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
test('consumers protected operand aliases and wrong observed PC are rejected before commit', () => {
  for (const entry of roots) {
    const f = taskFixture(entry);
    unchangedFailure(
      prepare,
      f,
      { protectedStackBytes: [0x7e03f1, 0x7e03f2] },
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
test('consumers output budget and explicit last-byte windows keep all writes back', () => {
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
test('consumers stale/foreign/forged and reused plans never commit a context or second write', () => {
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
