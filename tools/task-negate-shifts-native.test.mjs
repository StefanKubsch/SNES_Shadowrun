import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderData } from '../src/render/data.mjs';
import { prepareTaskNegateShifts as prepare } from '../proof/task/negate-shifts.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskFixture } from './task-native-fixtures.mjs';
import { unchangedFailure, prepared, commit, writes, reads } from './task-native-test-support.mjs';
const roots = [8451828, 8451837, 8451849];
test('native negate preserves full8000 and FFFF wrap without binary-only requirement', () => {
  for (const [v, r] of [
    [0, 0],
    [1, 65535],
    [32768, 32768],
    [65535, 1],
  ]) {
    const p = prepared(prepare, taskFixture(0x80f6f4, { top: v, status: 0x4d }));
    assert.equal(p.result, r);
    assert.equal(p.outputContext.s, 0x3f0);
    assert.equal(p.outputContext.status, 0x4d);
  }
});
test('zero shift has no value owner/read/write and preserves incoming Carry/output0', () => {
  for (const entry of [0x80f6fd, 0x80f709])
    for (const carry of [0, 1]) {
      const f = taskFixture(entry, { top: 0, status: carry });
      f.data = createRenderData({ writeWindows: [] });
      f.data.seed(0x3f1, [0, 0]);
      f.data.seed(0x200, [0, 0x12]);
      f.data.seed(0x801204, [0x14, 0xff]);
      const p = prepared(prepare, { ...f, maxOutputBytes: 0 });
      assert.deepEqual(reads(p), [0x3f1, 0x3f2, 0x200, 0x201, 0x801204, 0x801205]);
      assert.deepEqual(writes(p), []);
      assert.equal(p.valueWordRead, false);
      assert.equal(p.outputContext.status & 1, carry);
      assert.equal(p.work, 6);
    }
});
test('full shift counts including16/17/8000/FFFF never exit early on result0; finalCarry matches source bits', () => {
  for (const entry of [0x80f6fd, 0x80f709])
    for (const count of [1, 15, 16, 17, 31, 32768, 65535]) {
      const p = prepared(prepare, taskFixture(entry, { top: count, left: 0x8001 })),
        left = entry === 0x80f6fd,
        result =
          count >= 16 ? 0 : left ? (0x8001 * 2 ** count) % 65536 : Math.floor(0x8001 / 2 ** count),
        carry = count > 16 ? 0 : Math.floor(0x8001 / 2 ** (left ? 16 - count : count - 1)) % 2;
      assert.equal(p.result, result);
      assert.equal(p.iterations, count);
      assert.equal(p.outputContext.status & 1, carry);
      assert.equal(p.work, 3 * count + 10);
      assert.equal(p.outputContext.s, 0x3f2);
      assert.deepEqual(writes(p), [
        [0x3f4, result >>> 8],
        [0x3f3, result & 255],
      ]);
    }
});
test('full-loop work failure at last next-opcode byte leaves all shifts and PHA writes uncommitted', () => {
  const f = taskFixture(0x80f6fd, { top: 65535, left: 1 });
  unchangedFailure(prepare, f, { maxWork: 3 * 65535 + 9 }, 'task_work_budget_required');
});
test('negate-shifts prepare is no-effect; missing sources and exhausted work are atomic for every entry', () => {
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
test('negate-shifts protected operand aliases and wrong observed PC are rejected before commit', () => {
  for (const entry of roots) {
    const f = taskFixture(entry);
    unchangedFailure(
      prepare,
      f,
      { protectedStackBytes: [8258545, 8258546] },
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
test('negate-shifts output budget and explicit last-byte windows keep all writes back', () => {
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
test('negate-shifts stale/foreign/forged and reused plans never commit a context or second write', () => {
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
