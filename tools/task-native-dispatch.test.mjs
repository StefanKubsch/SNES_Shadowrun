import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { taskDispatchFixture, taskNativeCallFixture } from './task-native-dispatch-fixtures.mjs';
import {
  prepareTaskNativeDispatch as dispatch,
  prepareTaskNativeCall as call,
} from '../proof/task/native-dispatch.mjs';
import { taskLeafSpecs } from './task-native-leaf-specs.mjs';
import { loadTaskNativeBlock } from './task-native-catalog.mjs';
import { seedTaskCreationFixture } from './task-native-create-fixtures.mjs';
import { seedTaskSmallFamilyFixture } from './task-native-small-fixtures.mjs';
import { seedTaskDistanceFixture } from './task-native-c68d-fixtures.mjs';
import { seedTaskDirectionFixture } from './task-native-d1d2-fixtures.mjs';
import { seedTaskM1dFixture } from './task-native-m1d-fixtures.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
const word = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const drop = (f, ...addresses) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes)
    if (!addresses.map(renderAddress).includes(a)) data.seed(a, [v]);
  return { ...f, data };
};
for (const spec of taskLeafSpecs) {
  const b = await loadTaskNativeBlock(spec.name);
  test(`F52F ${spec.name}: fresh actual pointer selects the independently bound native equation`, () => {
    const f = taskDispatchFixture(0x80f52f),
      g = b.fixture(spec.entry);
    word(f, 0xa2, spec.entry & 65535);
    if (spec.entry === 0x80d15c) {
      word(f, 0x801048, 3);
      word(f, 0x8011a8, 5);
    }
    if (spec.entry === 0x80aaaf) word(f, 0x8011a8, 3);
    if (spec.entry === 0x80d1d2) seedTaskDirectionFixture(f);
    if (spec.entry === 0x80a8f5) {
      word(f, 0x8012b0, 0);
      word(f, 0x8014b0, 0);
      word(f, 0x8014b2, 0x10);
    }
    if (spec.entry === 0x80a835) seedTaskCreationFixture(f);
    if (spec.entry === 0x80c68d) seedTaskDistanceFixture(f);
    if (spec.entry === 0x80cca4) word(f, 0x7e2de4, 0);
    seedTaskSmallFamilyFixture(f, spec.entry);
    seedTaskM1dFixture(f, spec.entry);
    const p = prepared(dispatch, f),
      q = prepared(b.prepare, g);
    assert.equal(p.calleeEntry, spec.entry);
    assert.equal(p.boundedNativeDispatchExecuted, true);
    assert.deepEqual(p.outputContext, q.outputContext);
    assert.deepEqual(p.byteWrites, q.byteWrites);
    assert.equal(p.work, q.work + 2);
    assert.equal(p.returnTargetExecuted, false);
  });
  test(`F4F6 ${spec.name}: bridge/callee/actualRTS/resume share a single atomic overlay`, () => {
    const f = taskNativeCallFixture(spec),
      p = prepared(call, f);
    assert.equal(p.calleeEntry, spec.entry);
    assert.equal(p.tablePointerWord, spec.entry & 65535);
    assert.equal(p.calleeReturnWord, 0xf508);
    assert.equal(p.calleeReturnTarget, 0x80f509);
    assert.equal(p.calleeReturnTargetExecuted, true);
    assert.equal(p.frontier, '80:F390');
    assert.equal(p.opcodeWord, 0xa514);
    assert.equal(p.outputContext.pc, 0xf390);
    assert.equal(p.outputContext.y, 5);
    assert.equal(p.outputContext.s, p.resultPushed ? 0x3ee : 0x3f0);
    assert.equal(p.fullTaskBinding, false);
    assert.equal(p.globalStackMinimum, null);
    const writes = p.accesses.filter((a) => a.kind === 'write');
    assert.deepEqual(
      writes.slice(0, 6).map((a) => [a.address, a.value]),
      [
        [0x6ff, 0x80],
        [0x6fe, 0x80],
        [0xa2, spec.entry & 255],
        [0xa3, (spec.entry >>> 8) & 255],
        [0x6ff, 0xf5],
        [0x6fe, 8],
      ],
    );
    assert.equal(
      p.accesses.find((a) => a.label === 'native-dispatch-fresh-pointer-low').value,
      spec.entry & 255,
    );
    assert.equal(commitTaskPlan(f.data, p).handled, true);
  });
}
test('F52F pointer comes from bank00 independently of incoming DBR, never from direct page', () => {
  const f = taskDispatchFixture(0x80f52f, { bank: 0x7f }),
    p = prepared(dispatch, f);
  assert.equal(p.outputContext.bank, 0x7f);
  assert.ok(
    p.accesses.some((a) => a.label === 'native-dispatch-fresh-pointer-low' && a.address === 0xa2),
  );
  unchangedFailure(
    dispatch,
    f,
    { context: Object.freeze({ ...f.context, d: 0x200 }) },
    'task_direct_page_zero_required',
  );
});
test('F52F unknown and incomplete pointers reject without writes or requests', () => {
  const f = taskDispatchFixture(0x80f52f);
  word(f, 0xa2, 0x1234);
  unchangedFailure(dispatch, f, {}, 'task_native_target_source_required');
  word(f, 0xa2, 0xca3a);
  unchangedFailure(dispatch, drop(f, 0xa3), {}, 'render_source_required');
  unchangedFailure(
    dispatch,
    f,
    { protectedStackBytes: [...f.protectedStackBytes, 0x7e00a2] },
    'task_stack_alias_required',
  );
});
test('bridge JSR overwrites A2: fresh F508 target is rejected, original table callee never selected', () => {
  const f = taskNativeCallFixture();
  f.context = Object.freeze({ ...f.context, a: 0xa3 });
  f.protectedStackBytes = [0x7e00a4, 0x7e00a5];
  const p = unchangedFailure(call, f, {}, 'task_native_target_source_required');
  assert.equal(p.calleeEntry, 0x80f508);
});
test('callee destination overwrites internal return frame: actualRTS mismatch discards the complete bridge', () => {
  const f = taskNativeCallFixture(taskLeafSpecs.find((s) => s.name === 'native-ca0d'));
  f.context = Object.freeze({ ...f.context, a: 0x1469 });
  f.protectedStackBytes = [0x7e146a, 0x7e146b];
  word(f, 0x146a, 0xc20a);
  const p = unchangedFailure(call, f, {}, 'task_native_resume_target_required');
  assert.equal(p.returnTarget, 0x800004);
});
test('late resume highmetadata/stream/outerstack/window/budget failures retain no earlier bridge or callee effects', () => {
  const f = taskNativeCallFixture(),
    p = prepared(call, f),
    metadata = 0x82d972;
  unchangedFailure(call, drop(f, metadata + 1), {}, 'render_source_required');
  unchangedFailure(call, drop(f, 0x801205), {}, 'render_source_required');
  unchangedFailure(call, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(call, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  prepared(call, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(
    call,
    f,
    { protectedStackBytes: [0x7e0800, 0x7e0801] },
    'task_outer_return_required',
  );
  const g = taskNativeCallFixture(),
    data = createRenderData({
      writeWindows: [
        [0x7e0000, 0x7e03ee],
        [0x7e03f0, 0x7e06ff],
      ],
    });
  for (const [a, v] of g.data.snapshot().bytes) data.seed(a, [v]);
  unchangedFailure(call, { ...g, data }, {}, 'render_write_window_required');
});
test('whole Native58 plans retain owner/version protection and one outer commit', () => {
  const f = taskNativeCallFixture(),
    p = prepared(call, f),
    g = taskNativeCallFixture();
  assert.equal(commitTaskPlan(g.data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  f.data.seed(0x100, [1]);
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), before);
  const q = commit(call, f);
  assert.equal(commitTaskPlan(f.data, q).reason, 'task_plan_stale');
});
test('reported synthetic whole-call probes cover each proved target and reproduce actual plans', async () => {
  const report = JSON.parse(await readFile('analysis/render-task-native-dispatch-native.json'));
  assert.equal(report.composition.entry, '80:F4F6');
  assert.equal(report.composition.probes.length, taskLeafSpecs.length * 3);
  for (const spec of taskLeafSpecs) {
    const rows = report.composition.probes.filter((p) => p.callee === spec.name);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((p) => p.synthetic));
    const p = prepared(call, taskNativeCallFixture(spec)),
      saved = rows.find((p) => p.handled);
    assert.deepEqual(saved.outputContext, p.outputContext);
    assert.deepEqual(saved.byteWrites, p.byteWrites);
    assert.equal(saved.work, p.work);
    assert.equal(saved.fullTaskBinding, false);
    assert.deepEqual(
      rows.filter((p) => !p.handled).map((p) => p.reason),
      ['task_work_budget_required', 'task_output_budget_required'],
    );
  }
});
