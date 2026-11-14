import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskEndReturn as prepare } from '../proof/task/end-return.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskFixture } from './task-native-fixtures.mjs';
import { unchangedFailure, prepared, commit, writes, reads } from './task-native-test-support.mjs';
test('manual END full result WORD precedes fresh outer-S and intact RTS reads with one commit', () => {
  const f = taskFixture(0x80f4be),
    p = commit(prepare, f);
  assert.deepEqual(writes(p), [
    [0x800000, 0x34],
    [0x800001, 0x12],
  ]);
  assert.deepEqual(reads(p), [0x3f1, 0x3f2, 0x8001f2, 0x8001f3, 0x1f0, 0x1f1]);
  assert.equal(p.returnTarget, 0x80c20b);
  assert.equal(p.outputContext.s, 0x1f1);
  assert.equal(p.outputContext.d, 0);
  assert.equal(p.outputContext.a, 0);
  assert.equal(p.outputContext.x, f.context.x);
  assert.equal(p.outputContext.y, f.context.y);
  assert.equal(p.outputContext.status, 0x47);
});
test('END outer returnFFFF wraps to80:0000 without substituting a known caller', () => {
  const p = prepared(
    prepare,
    taskFixture(0x80f4be, { outerWord: 65535, top: 65535, status: 0xcf }),
  );
  assert.equal(p.returnTarget, 0x800000);
  assert.equal(p.outputContext.status, 0x4f);
  assert.equal(p.resultWord, 65535);
  assert.equal(p.targetExecuted, false);
});
test('END saved-S can alias original popped result bytes and must be read fresh', () => {
  const f = taskFixture(0x80f4be, { s: 0x1f1, top: 0x1ef });
  const p = prepared(prepare, f);
  assert.equal(p.resultWord, 0x1ef);
  assert.equal(p.savedOuterS, 0x1ef);
  assert.ok(
    p.accesses.findIndex((a) => a.label === 'fresh-saved-outer-S-low') >
      p.accesses.findIndex((a) => a.label === 'END-result-high'),
  );
});
test('END every admissible flag profile preserves C/V/I/decimal and X/Y/DBR', () => {
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30)) {
      const f = taskFixture(0x80f4be, { status }),
        p = prepared(prepare, f);
      assert.equal(p.outputContext.status, (status & ~0x82) | 2);
      assert.equal(p.outputContext.bank, 128);
    }
});
test('END missing/bad context, budgets, windows and protected owners are no-effect', () => {
  for (const [patch, reason] of [
    [{ context: {} }, 'task_context_required'],
    [{ maxWork: 0 }, 'task_work_budget_required'],
    [{ maxOutputBytes: 1 }, 'task_output_budget_required'],
    [{ protectedStackBytes: [] }, 'task_protected_stack_required'],
    [{ entry: 0 }, 'task_entry_required'],
  ])
    unchangedFailure(prepare, taskFixture(0x80f4be), patch, reason);
  unchangedFailure(
    prepare,
    taskFixture(0x80f4be, { writeWindows: [[0x7e0000, 0x7e0000]] }),
    {},
    'render_write_window_required',
  );
});
test('END late missing outer return source rolls back already planned result writes', () => {
  const f = taskFixture(0x80f4be, { savedOuterS: 0x1ef });
  f.data.seed(0x8001f2, [0xe0, 1]);
  unchangedFailure(
    prepare,
    f,
    { protectedStackBytes: [0x7e01e1, 0x7e01e2] },
    'render_source_required',
  );
});
test('END refuses a result store over the explicitly protected outer return', () => {
  const f = taskFixture(0x80f4be);
  unchangedFailure(
    prepare,
    f,
    { protectedStackBytes: [0x7e0000, 0x7e0001] },
    'task_stack_alias_required',
  );
});
test('manual END rejects foreign, forged, stale and already committed plans without effects', () => {
  const f = taskFixture(0x80f4be),
    other = taskFixture(0x80f4be),
    p = prepared(prepare, f),
    before = other.data.snapshot();
  assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  assert.deepEqual(other.data.snapshot(), before);
  f.data.seed(0x100, [1]);
  const after = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), after);
  const p2 = prepared(prepare, f);
  assert.equal(commitTaskPlan(f.data, p2).handled, true);
  const committed = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, p2).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), committed);
});
