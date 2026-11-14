import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderData } from '../src/render/data.mjs';
import { prepareTaskUpdates as prepare } from '../proof/task/updates.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskFixture } from './task-native-fixtures.mjs';
import { unchangedFailure, prepared, commit, writes, reads } from './task-native-test-support.mjs';
const roots = [8451044, 8451050, 8451056];
test('native updates keep full zero/signed/FFFF WORD wrap and high/low PHA addresses', () => {
  for (const entry of roots)
    for (const value of [0, 1, 0x7fff, 0x8000, 65535]) {
      const f = taskFixture(entry, { top: value }),
        p = commit(prepare, f),
        duplicate = entry === 0x80f3f0,
        expected = duplicate ? value : (value + (entry === 0x80f3e4 ? 1 : -1)) & 65535;
      assert.equal(p.result, expected);
      assert.deepEqual(
        writes(p),
        duplicate
          ? [
              [0x3f0, expected >>> 8],
              [0x3ef, expected & 255],
            ]
          : [
              [0x3f2, expected >>> 8],
              [0x3f1, expected & 255],
            ],
      );
      assert.equal(p.outputContext.s, duplicate ? 0x3ee : 0x3f0);
    }
});
test('increment own pointer alias uses both post-PHA bytes and fresh ignored opcodeHigh', () => {
  const f = taskFixture(0x80f3e4, { top: 0x12ff, d: 0x3f1 });
  f.data.seed(0x801304, [0xc2, 0xff]);
  const p = prepared(prepare, f);
  assert.equal(p.result, 0x1300);
  assert.equal(p.opcodeWord, 0xffc2);
  assert.ok(reads(p).includes(0x801304));
});
test('all admissible update statuses preserve C/V/I/decimal through value and flag wraps', () => {
  for (const entry of roots)
    for (let status = 0; status < 256; status++)
      if (!(status & 0x30)) {
        const p = prepared(prepare, taskFixture(entry, { top: 0xffff, status }));
        assert.equal(p.outputContext.status, status & ~0x82);
      }
});
test('task writes do not inherit implicit render-scratch permission outside explicit windows', () => {
  unchangedFailure(
    prepare,
    taskFixture(0x80f3e4, { s: 0xa5, writeWindows: [] }),
    {},
    'render_write_window_required',
  );
});
test('updates prepare is no-effect; missing sources and exhausted work are atomic for every entry', () => {
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
test('updates protected operand aliases and wrong observed PC are rejected before commit', () => {
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
test('updates output budget and explicit last-byte windows keep all writes back', () => {
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
test('updates stale/foreign/forged and reused plans never commit a context or second write', () => {
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
