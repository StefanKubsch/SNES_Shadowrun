import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderData } from '../src/render/data.mjs';
import { prepareTaskBitLogic as prepare } from '../proof/task/bit-logic.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskFixture } from './task-native-fixtures.mjs';
import { unchangedFailure, prepared, commit, writes, reads } from './task-native-test-support.mjs';
const roots = [8451861, 8451869, 8451877, 8451885];
test('native bit logic independent patterns and unary complement use original store ordering', () => {
  for (const [entry, left, right, value] of [
    [0x80f715, 0xaaaa, 0x5555, 0],
    [0x80f71d, 0xaaaa, 0x5555, 65535],
    [0x80f725, 0xaaaa, 0xaaaa, 0],
    [0x80f715, 0x00ff, 0x0f0f, 0x000f],
    [0x80f71d, 0x00ff, 0x0f0f, 0x0fff],
    [0x80f725, 0x00ff, 0x0f0f, 0x0ff0],
    [0x80f72d, 0, 0x8000, 0x7fff],
  ]) {
    const f = taskFixture(entry, { top: right, left }),
      p = commit(prepare, f);
    assert.equal(p.value, value);
    assert.equal(p.outputContext.s, entry === 0x80f72d ? 0x3f0 : 0x3f2);
    assert.deepEqual(
      writes(p),
      entry === 0x80f72d
        ? [
            [0x3f2, value >>> 8],
            [0x3f1, value & 255],
          ]
        : [
            [0x3f3, value & 255],
            [0x3f4, value >>> 8],
          ],
    );
  }
});
test('NOT pointer alias is resolved after high/low PHA and C/V/decimal remain unchanged', () => {
  const f = taskFixture(0x80f72d, { top: 0xedff, d: 0x3f1, status: 0x4d });
  f.data.seed(0x801204, [0, 0xff]);
  const p = prepared(prepare, f);
  assert.equal(p.value, 0x1200);
  assert.equal(p.opcodeWord, 0xff00);
  assert.equal(p.outputContext.status, 0x4f);
});
test('logic all admissible statuses preserve CVI/decimal independently of operand NZ', () => {
  for (const entry of roots)
    for (let status = 0; status < 256; status++)
      if (!(status & 0x30)) {
        const p = prepared(prepare, taskFixture(entry, { top: 65535, left: 65535, status }));
        assert.equal(p.outputContext.status, status & ~0x82);
      }
});
test('bit-logic prepare is no-effect; missing sources and exhausted work are atomic for every entry', () => {
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
test('bit-logic protected operand aliases and wrong observed PC are rejected before commit', () => {
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
test('bit-logic output budget and explicit last-byte windows keep all writes back', () => {
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
test('bit-logic stale/foreign/forged and reused plans never commit a context or second write', () => {
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
