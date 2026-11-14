import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderData } from '../src/render/data.mjs';
import { prepareTaskLocalWrites as prepare } from '../proof/task/local-writes.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskFixture } from './task-native-fixtures.mjs';
import { unchangedFailure, prepared, commit, writes, reads } from './task-native-test-support.mjs';
const roots = [8451014, 8451031];
test('native local writes preserve full index/source WORD and BYTE versus low/high output order', () => {
  for (const entry of roots)
    for (const index of [0, 255]) {
      const f = taskFixture(entry, { top: 0x80ff });
      f.data.seed(0x801204, [index, 0xf1, 0x99]);
      const p = commit(prepare, f),
        address = 0x213 + index;
      assert.equal(p.index, index);
      assert.equal(p.poppedWord, 0x80ff);
      assert.equal(p.outputContext.s, 0x3f2);
      assert.equal(p.outputContext.y, 6);
      assert.deepEqual(
        writes(p),
        entry === 0x80f3c6
          ? [[address, 255]]
          : [
              [address, 255],
              [address + 1, 128],
            ],
      );
      assert.ok(!reads(p).includes(address));
    }
});
test('local stores can replace next opcode and its ignoredHigh is read fresh afterwards', () => {
  for (const entry of roots) {
    const f = taskFixture(entry, { pointer: 0x22e, top: 0x3456 });
    f.data.seed(0x800232, [0x20, 0xcc, 0xaa]);
    const p = prepared(prepare, f);
    assert.equal(p.localAddress, 0x233);
    assert.equal(p.opcodeWord, entry === 0x80f3c6 ? 0xaa56 : 0x3456);
    assert.equal(p.outputContext.a, 0x56);
  }
});
test('local BYTE store needs no existing target data but late missing next opcodeHigh rolls back', () => {
  const f = taskFixture(0x80f3c6, { seedOpcode: false });
  f.data.seed(0x801204, [0, 0x14]);
  unchangedFailure(prepare, f, {}, 'render_source_required');
});
test('local writes preserve all admissible CVI/decimal flags after original SEP/REP sequence', () => {
  for (const entry of roots)
    for (let status = 0; status < 256; status++)
      if (!(status & 0x30)) {
        const p = prepared(prepare, taskFixture(entry, { status }));
        assert.equal(p.outputContext.status, status & ~0x82);
        assert.equal(p.outputContext.status & 0x30, 0);
      }
});
test('local-writes prepare is no-effect; missing sources and exhausted work are atomic for every entry', () => {
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
test('local-writes protected operand aliases and wrong observed PC are rejected before commit', () => {
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
test('local-writes output budget and explicit last-byte windows keep all writes back', () => {
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
test('local-writes stale/foreign/forged and reused plans never commit a context or second write', () => {
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
