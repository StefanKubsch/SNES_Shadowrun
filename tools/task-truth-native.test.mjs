import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderData } from '../src/render/data.mjs';
import { prepareTaskTruth as prepare } from '../proof/task/truth.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskFixture } from './task-native-fixtures.mjs';
import { unchangedFailure, prepared, commit, writes, reads } from './task-native-test-support.mjs';
const roots = [8452287, 8452163, 8452223];
test('native Boolean zero has no store/window requirement and nonzero always writesFFFF', () => {
  for (const value of [0, 1, 0x7fff, 0x8000, 65535]) {
    const f = taskFixture(0x80f8bf, {
        top: value,
        writeWindows: value ? [[0x7e03f1, 0x7e03f2]] : [],
      }),
      p = prepared(prepare, { ...f, maxOutputBytes: value ? 2 : 0 });
    assert.equal(p.result, value ? 65535 : 0);
    assert.equal(p.operandStore, value !== 0);
    assert.equal(p.outputContext.s, 0x3f0);
    assert.deepEqual(
      writes(p),
      value
        ? [
            [0x3f1, 255],
            [0x3f2, 255],
          ]
        : [],
    );
    assert.deepEqual(reads(p).slice(0, 2), [0x3f1, 0x3f2]);
  }
});
test('truth comparison Carry comes from right>=left independently of FFFF/0000 result', () => {
  for (const entry of [0x80f843, 0x80f87f])
    for (const [left, right] of [
      [0, 0],
      [0, 65535],
      [65535, 0],
      [0x8000, 0x8000],
      [1, 0],
      [0, 1],
    ]) {
      const p = commit(prepare, taskFixture(entry, { left, top: right })),
        truth = entry === 0x80f843 ? left === right : left !== right;
      assert.equal(p.result, truth ? 65535 : 0);
      assert.equal(p.outputContext.status & 1, Number(right >= left));
      assert.equal(p.outputContext.s, 0x3f2);
      assert.equal(p.outputContext.status & 0x4c, 0x44);
    }
});
test('Boolean store can replace its own DP pointer and fresh opcode flags are independent of truth', () => {
  const f = taskFixture(0x80f8bf, { top: 1, d: 0x3f1 });
  f.data.seed(0x810003, [0, 0xff]);
  const p = prepared(prepare, f);
  assert.equal(p.result, 65535);
  assert.equal(p.opcodeWord, 0xff00);
  assert.equal(p.outputContext.status, 0x47);
  assert.ok(reads(p).includes(0x810003));
});
test('truth prepare is no-effect; missing sources and exhausted work are atomic for every entry', () => {
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
test('truth protected operand aliases and wrong observed PC are rejected before commit', () => {
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
test('truth output budget and explicit last-byte windows keep all writes back', () => {
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
test('truth stale/foreign/forged and reused plans never commit a context or second write', () => {
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
