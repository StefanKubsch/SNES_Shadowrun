import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  prepareTaskVisitStatusOpcodes as prepare,
  prepareTaskVisitOpcodes as old,
} from '../proof/task/visit-opcodes.mjs';
import { prepareTaskOpcodeSequence } from '../proof/task/opcode-sequence.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import {
  taskVisitStatusFixture as fixture,
  statusOpcodeSpecs,
} from './task-visit-status-fixtures.mjs';
import { taskVisitOpcodesFixture } from './task-visit-opcodes-fixtures.mjs';
import { taskStatusReturnFixture } from './task-status-return-fixtures.mjs';
import { visitWord as word } from './task-visit-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
const drop = (f, address) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes) if (a !== renderAddress(address)) data.seed(a, [v]);
  return { ...f, data };
};
for (const s of statusOpcodeSpecs) {
  test(`current-stack status Visit ${s.name}: actual owner, D/DBR, independent status bytes and exact budgets`, async () => {
    const f = fixture(s.opcode),
      p = prepared(prepare, f),
      report = JSON.parse(await readFile('analysis/render-task-visit-status-opcodes-native.json'));
    assert.deepEqual(
      p.steps.map((s) => s.opcode),
      [s.opcode],
    );
    assert.equal(p.steps[0].returnS, 0x6f9);
    assert.equal(p.steps[0].outerReturnWord, 0xc20a);
    assert.equal(p.steps[0].index, 0x1200);
    assert.equal(p.steps[0].firstValue, 0xfb);
    assert.equal(p.steps[0].secondValue, 0xfb);
    assert.equal(p.outputContext.d, 0x3d6);
    assert.equal(p.outputContext.bank, 0x80);
    // C396 SBC has no overflow, then CPX task2/cursor4 clears Carry;
    // final cursor PLA2 clears N/Z. Original interrupt bit remains set.
    assert.equal(p.outputContext.s, 0x701);
    assert.equal(p.outputContext.a, 2);
    assert.equal(p.outputContext.status, 4);
    assert.equal(p.returnTarget, 0x8091d1);
    assert.deepEqual(
      p.migratedReturns.map((r) => r.raw),
      [0xc20a, 0xc1d8],
    );
    assert.equal(p.steps[0].statusPrefixExecuted, s.family === 'trap-prefix' ? true : undefined);
    const probe = report.probes.find((p) => p.opcode === s.opcode && p.limit === 'exact');
    assert.deepEqual(probe.accesses, p.accesses);
    assert.deepEqual(probe.outputContext, p.outputContext);
    assert.deepEqual(probe.byteWrites, p.byteWrites);
    assert.equal(
      p.accesses.some((a) => a.label === 'intact-current-stack-return-migrated-inner-low'),
      true,
    );
    assert.equal(
      p.accesses.some((a) => a.label === 'saved-outer-S-low'),
      false,
    );
    prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    unchangedFailure(prepare, f, { maxHandlers: 2 }, 'task_visit_opcode_count_required');
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(f.data.readByte(0x8001be).value, 0xfb);
    assert.equal(f.data.readByte(0x8001c0).value, 0xfb);
  });
}
test('current operand S and saved outer S remain separate fresh sources; equal external rawC20A is insufficient', () => {
  const f = fixture();
  word(f, 0x8001f2, 0x1234); // F378 really overwrites this; no inferred savedS read by F927.
  const p = prepared(prepare, f);
  assert.equal(p.steps[0].returnS, 0x6f9);
  const g = fixture();
  word(g, 0x3dd, 0x6ff);
  word(g, 0x700, 0xc20a);
  unchangedFailure(prepare, g, {}, 'task_visit_postrun_source_required');
  const h = taskVisitOpcodesFixture();
  word(h, 0x801204, 0xa506);
  word(h, 0x80f2ba, 0xf927);
  h.data.seed(0x8001be, [1]);
  h.data.seed(0x8001c0, [2]);
  unchangedFailure(prepare, h, {}, 'task_outer_return_required');
});
test('a push changes current S and cannot manufacture a status return; prior writes are discarded', () => {
  const f = fixture();
  f.data.seed(0x801204, [0x14, 0x34, 0x12, 6, 0xa5]);
  word(f, 0x80f2c8, 0xf3b1);
  unchangedFailure(prepare, f, { maxHandlers: 2 }, 'task_outer_return_required');
});
test('C1F9 current-stack return keeps actual D; standalone and old Visit APIs retain their premises', () => {
  const p = prepared(prepare, fixture(0x54, 0x80c1f9));
  assert.equal(p.steps[0].returnS, 0x6fd);
  assert.equal(p.outputContext.d, 0x3d6);
  assert.equal(p.outputContext.s, 0x701);
  assert.equal(p.returnTarget, 0x8091d1);
  unchangedFailure(old, fixture(), {}, 'task_opcode_status_return_source_required');
  unchangedFailure(old, fixture(0x54), {}, 'task_visit_opcode_frontier_required');
  const f = taskStatusReturnFixture();
  f.entry = 0x80f390;
  f.context = Object.freeze({ ...f.context, pc: 0xf390, x: 0x54 });
  word(f, 0x80f308, 0xf4bb);
  const q = prepared(prepareTaskOpcodeSequence, { ...f, maxHandlers: 1 });
  assert.equal(q.frontier, '80:F927');
});
test('negative DP pointer is latched; status stores preserve original branch behavior and D', () => {
  const f = fixture();
  word(f, 0x3d6, 0x9200);
  word(f, 0x3d7, 0x8092);
  word(f, 0x809204, 0xa506);
  const p = prepared(prepare, f);
  assert.equal(p.steps[0].index, 0x9200);
  assert.equal(p.steps[0].firstValue, 255);
  assert.equal(p.steps[0].secondValue, 251);
  assert.equal(p.outputContext.d, 0x3d6);
});
test('negative task status reaches a new F378 with real TCD and a second earned current-stack return', () => {
  const f = fixture();
  for (const [a, v] of [
    [0x800374, 4],
    [0x800256, 0x600],
    [0x600, 0x1400],
    [0x601, 0x8014],
    [0x603, 4],
    [0x607, 0x6f9],
    [0x609, 0],
    [0x801404, 0xa506],
    [0x800ba6, 2],
    [0x800316, 0xffff],
  ])
    word(f, a, v);
  // Real push/state-WORD writes make status negative after initial readiness,
  // then restore current S to its earned owner before the first F927.
  f.data.seed(0x801204, [0x14, 0xff, 0xff, 0x36, 0xa4, 0x0b, 6, 0xa5]);
  word(f, 0x80f2c8, 0xf3b1);
  word(f, 0x80f2ea, 0xf902);
  const first = prepared(prepare, { ...f, maxHandlers: 3 });
  assert.equal(first.frontier, '80:F390');
  assert.equal(first.outputContext.d, 0x600);
  assert.equal(first.outputContext.x, 6);
  assert.equal(first.handlersExecuted, 3);
  const p = prepared(prepare, { ...f, maxHandlers: 4 });
  assert.equal(p.outputContext.d, 0x600);
  assert.deepEqual(
    p.steps.filter((s) => s.opcode === 6).map((s) => s.index),
    [0x1200, 0x1400],
  );
  assert.deepEqual(
    p.migratedReturns.map((r) => r.raw),
    [0xc20a, 0xc20a, 0xc1d8],
  );
  assert.equal(p.returnTarget, 0x8091d1);
  unchangedFailure(
    prepare,
    f,
    { maxHandlers: 4, maxWork: p.work - 1 },
    'task_work_budget_required',
  );
});
test('late missing sources and denied status windows discard stack/status/task effects', () => {
  for (const address of [0x8001be, 0x8001c0, 0x801205, 0x80f2bb, 0x800ba7, 0x701])
    unchangedFailure(prepare, drop(fixture(), address), {}, 'render_source_required');
  const f = fixture(),
    data = createRenderData({
      writeWindows: [
        [0x7e0000, 0x7e01bf],
        [0x7e01c1, 0x7fffff],
      ],
    });
  for (const [a, v] of f.data.snapshot().bytes) data.seed(a, [v]);
  unchangedFailure(prepare, { ...f, data }, {}, 'render_write_window_required');
  unchangedFailure(
    prepare,
    fixture(),
    {
      ioMode: 'record-requests',
      ioObservations: Object.freeze([
        Object.freeze({ pc: 0x80f584, address: 0x804216, width: 2, value: 1 }),
      ]),
    },
    'task_io_observation_unused',
  );
});
test('version, copied-plan and provider ownership still govern the whole status Visit', () => {
  const f = fixture(),
    p = prepared(prepare, f);
  assert.equal(commitTaskPlan(fixture().data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  f.data.seed(0x100, [1]);
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), before);
});
