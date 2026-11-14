import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskPush as prepare } from '../proof/task/push.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskFixture } from './task-native-fixtures.mjs';
import { unchangedFailure, prepared, commit, writes, reads } from './task-native-test-support.mjs';
const roots = [0x80f393, 0x80f398, 0x80f3b1],
  widths = [0, 1, 2];
test('native push0/u8/u16 ordered high/low outputs and fresh WORD fetch stop before F390', () => {
  roots.forEach((entry, i) => {
    const f = taskFixture(entry),
      p = commit(prepare, f),
      value = i === 0 ? 0 : i === 1 ? 0x14 : 0xa514;
    assert.deepEqual(writes(p), [
      [0x3f0, value >>> 8],
      [0x3ef, value & 255],
    ]);
    assert.equal(p.outputContext.s, 0x3ee);
    assert.equal(p.outputContext.y, 5 + widths[i]);
    assert.equal(p.outputContext.a, i === 1 ? 0xa5 : 0x14);
    assert.equal(p.frontier, '80:F390');
    assert.equal(p.dynamicDispatchExecuted, false);
    assert.equal(p.outputContext.d, 0x200);
    assert.equal(p.outputContext.bank, 128);
    assert.equal(p.globalStackMinimum, null);
  });
});
test('pushu8 full operand highbyte is required even though the stored WORD is masked', () => {
  for (let low = 0; low < 256; low++)
    for (const high of [0, 0x80, 255]) {
      const f = taskFixture(0x80f398);
      f.data.seed(0x801204, [low, high, 0x99]);
      const p = prepared(prepare, f);
      assert.equal(p.pushedWord, low);
      assert.deepEqual(writes(p), [
        [0x3f0, 0],
        [0x3ef, low],
      ]);
    }
  const f = taskFixture(0x80f398, { seedOpcode: false });
  f.data.seed(0x801204, [7]);
  unchangedFailure(prepare, f, {}, 'render_source_required');
});
test('pushu16 keeps full values and WORD-Y wrap independently from 24bit stream addresses', () => {
  for (const v of [0, 255, 256, 0x7fff, 0x8000, 65535]) {
    const f = taskFixture(0x80f3b1);
    f.data.seed(0x801204, [v & 255, v >>> 8]);
    assert.equal(prepared(prepare, f).pushedWord, v);
  }
  const f = taskFixture(0x80f3b1, { pointer: 0x8001, y: 65535 });
  f.data.seed(0x808002, [0xc2, 0xff]);
  const p = prepared(prepare, f);
  assert.equal(p.pushedWord, 0xa514);
  assert.equal(p.outputContext.y, 2);
  assert.equal(p.outputContext.a, 0xc2);
  assert.ok(reads(p).includes(0x818000));
  assert.ok(reads(p).includes(0x808002));
});
test('push0 needs no operand preread and observes its own pointer alias after both writes', () => {
  const f = taskFixture(0x80f393, { d: 0x3f0, pointer: 0x1220 });
  f.data.seed(0x3f0, [0x20, 0x12]);
  f.data.seed(0x801204, [0xa2, 0xff]);
  const p = prepared(prepare, f);
  assert.equal(p.outputContext.a, 0xa2);
  assert.deepEqual(reads(p), [0x3f0, 0x3f1, 0x801204, 0x801205]);
  assert.deepEqual(
    p.accesses.slice(0, 2).map((a) => a.kind),
    ['write', 'write'],
  );
});
test('push0 can overwrite its next opcode and fresh masked fetch sees WORD0000', () => {
  const f = taskFixture(0x80f393, { pointer: 0x3eb });
  const p = prepared(prepare, f);
  assert.equal(p.opcodeWord, 0);
  assert.equal(p.outputContext.a, 0);
  assert.equal(p.outputContext.status, 0x47);
  assert.equal(p.outputContext.x, 0);
});
test('all admissible push flags preserve C/V/I/decimal through final fresh zero opcode', () => {
  for (const entry of roots)
    for (let status = 0; status < 256; status++)
      if (!(status & 0x30)) {
        const f = taskFixture(entry, { status }),
          width = entry === roots[0] ? 0 : entry === roots[1] ? 1 : 2;
        f.data.seed(0x801204 + width, [0, 0xff]);
        const p = prepared(prepare, f);
        assert.equal(p.outputContext.status, (status & ~0x82) | 2);
      }
});
test('push late missing opcode highbyte, last write window and output/work budget failures have no effects', () => {
  const f = taskFixture(0x80f393, { seedOpcode: false });
  f.data.seed(0x801204, [0x14]);
  unchangedFailure(prepare, f, {}, 'render_source_required');
  for (const entry of roots) {
    unchangedFailure(
      prepare,
      taskFixture(entry),
      { maxOutputBytes: 1 },
      'task_output_budget_required',
    );
    unchangedFailure(prepare, taskFixture(entry), { maxWork: 0 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      taskFixture(entry, { writeWindows: [[0x7e03f0, 0x7e03f0]] }),
      {},
      'render_write_window_required',
    );
  }
});
test('push refuses protected byte aliases and unsupported bank00 wrap writes without a stack cap', () => {
  unchangedFailure(
    prepare,
    taskFixture(0x80f393),
    { protectedStackBytes: [0x7e03f0, 0x7e03ef] },
    'task_stack_alias_required',
  );
  unchangedFailure(prepare, taskFixture(0x80f393, { s: 0 }), {}, 'render_write_window_required');
});
test('push requires frozen complete observed context and explicit limits', () => {
  const f = taskFixture(0x80f393);
  for (const [patch, reason] of [
    [{ context: { ...f.context } }, 'task_context_required'],
    [{ context: Object.freeze({ ...f.context, pc: 0 }) }, 'task_context_required'],
    [{ context: Object.freeze({ ...f.context, status: 0x30 }) }, 'task_context_required'],
    [{ context: Object.freeze({ ...f.context, e: 1 }) }, 'task_context_required'],
    [{ maxWork: undefined }, 'task_budget_required'],
    [{ data: {} }, 'task_data_required'],
  ])
    unchangedFailure(prepare, f, patch, reason);
});
test('push forged/foreign/stale plans do not expose a committable output context', () => {
  const f = taskFixture(roots[0]),
    p = prepared(prepare, f),
    other = taskFixture(roots[0]);
  assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  f.data.seed(0x100, [1]);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
});
