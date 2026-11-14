import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskVisitOpcodes as prepare } from '../proof/task/visit-opcodes.mjs';
import { prepareTaskVisitTail as tail } from '../proof/task/visit-tail.mjs';
import { prepareTaskVisit } from '../proof/task/visit-c1ca.mjs';
import { prepareTaskOpcodeSequence } from '../proof/task/opcode-sequence.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import {
  taskVisitOpcodesFixture as fixture,
  taskVisitTailFixture,
} from './task-visit-opcodes-fixtures.mjs';
import { visitWord as word } from './task-visit-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
const value = (f, a) => f.data.readByte(a).value | (f.data.readByte(a + 1).value << 8);
const drop = (f, address) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes) if (a !== renderAddress(address)) data.seed(a, [v]);
  return { ...f, data };
};
const context = (f, patch) => ({ ...f, context: Object.freeze({ ...f.context, ...patch }) });
for (const kind of ['end', 'push-end', 'native-end', 'yield', 'yield-resume-end']) {
  test(`bounded ${kind}: actual return joins, independent results, exact budgets and report reproduction`, async () => {
    const f = fixture(kind),
      p = prepared(prepare, f),
      r = JSON.parse(await readFile('analysis/render-task-visit-opcodes-native.json'));
    const probe = r.probes.filter((p) => p.limit === 'exact')[
      ['end', 'push-end', 'native-end', 'yield', 'yield-resume-end'].indexOf(kind)
    ];
    assert.deepEqual(probe.accesses, p.accesses);
    assert.deepEqual(probe.outputContext, p.outputContext);
    assert.deepEqual(probe.byteWrites, p.byteWrites);
    assert.equal(p.migratedReturns[0].raw, 0xc20a);
    assert.equal(p.fullTaskBinding, false);
    if (kind === 'yield') {
      assert.equal(p.frontier, '80:F390');
      assert.equal(p.outputContext.d, 0x3d6);
      assert.equal(p.outputContext.bank, 0x9c);
      assert.equal(p.outputContext.x, 0x14);
      assert.equal(p.handlersExecuted, 1);
      assert.equal(p.visits.at(-1).postrunOccurrenceProven, true);
    } else {
      assert.equal(p.returnTarget, 0x8091d1);
      assert.equal(p.returnTargetExecuted, false);
      assert.equal(p.outputContext.s, 0x701);
      assert.equal(p.outputContext.d, 0);
      assert.equal(p.outputContext.bank, 0x80);
      assert.equal(p.outputContext.a, 2);
      assert.equal(p.migratedReturns.at(-1).raw, 0xc1d8);
      assert.equal(p.visitReturned, true);
    }
    if (kind === 'yield-resume-end') {
      assert.deepEqual(
        p.steps.map((s) => s.opcode),
        [0x52, 0x14, 0x56, 0x14, 0x56],
      );
      assert.equal(p.migratedReturns.filter((r) => r.raw === 0xc20a).length, 3);
      assert.ok(p.visits.some((v) => v.continuationOccurrenceProven));
    }
    prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    if (kind !== 'yield') assert.equal(value(f, 0x800250), 2);
    if (kind === 'end') assert.equal(value(f, 0x800000), 0xbeef);
    if (kind === 'push-end') assert.equal(value(f, 0x800000), 0x5678);
    if (kind === 'yield-resume-end') assert.equal(value(f, 0x800000), 0x9876);
  });
}
test('F390 count stops before next target; fewer/more requested handlers do not invent a return', () => {
  const f = fixture('push-end'),
    p = prepared(prepare, { ...f, maxHandlers: 1 });
  assert.equal(p.frontier, '80:F390');
  assert.equal(p.steps[0].opcode, 0x14);
  assert.equal(p.outputContext.x, 0x56);
  assert.equal(p.migratedReturns.length, 0);
  unchangedFailure(prepare, fixture(), { maxHandlers: 2 }, 'task_visit_opcode_count_required');
  for (const maxHandlers of [0, -1, 1.5, undefined])
    unchangedFailure(prepare, fixture(), { maxHandlers }, 'task_handler_budget_required');
  unchangedFailure(prepare, context(fixture(), { d: 1 }), {}, 'task_visit_D0_required');
  unchangedFailure(
    prepare,
    context(fixture(), { status: 0x4c }),
    {},
    'task_binary_arithmetic_required',
  );
});
test('direct C1F9 and postrun C20B prove their own external root context', () => {
  const p = prepared(prepare, fixture('end', 0x80c1f9));
  assert.equal(p.returnTarget, 0x8091d1);
  assert.equal(p.migratedReturns.length, 1);
  const f = fixture('end', 0x80c20b);
  word(f, 0x800ba4, 65535);
  word(f, 0x800374, 2);
  const q = prepared(prepare, f);
  assert.equal(q.frontier, '80:F390');
  assert.equal(q.handlersExecuted, 1);
  assert.equal(q.visits.at(-1).interpreterEntryExecuted, true);
});
test('old separate entry APIs retain their explicit ownership boundaries', () => {
  const f = fixture(),
    v = prepared(prepareTaskVisit, f);
  assert.equal(v.frontier, '80:F390');
  assert.equal(v.dynamicDispatchExecuted, false);
  assert.equal(commitTaskPlan(f.data, v).handled, true);
  unchangedFailure(
    prepareTaskOpcodeSequence,
    { ...f, entry: 0x80f390, context: v.outputContext, maxHandlers: 1 },
    {},
    'task_outer_return_required',
  );
  const g = fixture();
  word(g, 0x80f30a, 0xf4bb);
  unchangedFailure(prepare, g, {}, 'task_opcode_target_required');
  word(g, 0x801204, 0xa554);
  word(g, 0x80f308, 0xf4bb);
  unchangedFailure(prepare, g, {}, 'task_visit_opcode_frontier_required');
});
test('argument writes can overwrite actual inner return bytes; no capability hides the changed WORD', () => {
  const f = context(fixture('native-end'), { s: 9 });
  f.protectedStackBytes = [0x7e000a, 0x7e000b];
  word(f, 10, 0x91d0);
  word(f, 0x82da4c + 68, 3);
  word(f, 0x3f1, 2);
  word(f, 0x3f3, 0);
  word(f, 0x3f5, 0x1234);
  word(f, 0x3f7, 0xbeef);
  unchangedFailure(prepare, f, {}, 'task_visit_inner_return_required');
});
test('an externally protected rawC20A does not substitute for the actual inner return owner', () => {
  const f = fixture();
  f.maxHandlers = 2;
  for (const [address, v] of [
    [0x800254, 0x1df],
    [0x1df, 0x1200],
    [0x1e0, 0x8012],
    [0x1e2, 4],
    [0x1e6, 0x3f0],
    [0x1e8, 0],
    [0x80f2e8, 0xf3d7],
    [0x3f1, 0x6ff],
    [0x3f3, 0xbeef],
    [0x700, 0xc20a],
  ])
    word(f, address, v);
  f.data.seed(0x801204, [0x34, 0, 0x56, 0xa5]);
  // This source-derived local store changes savedS to the external root pair.
  // Equal target bytes do not prove this invocation consumed its earned owner.
  unchangedFailure(prepare, f, {}, 'task_visit_postrun_source_required');
});
test('missing late highbytes, denied windows, forged root owners and observations discard every effect', () => {
  for (const address of [0x801205, 0x80f30b, 0x3f2, 0x800315, 0x8003d3, 0x800ba7, 0x701])
    unchangedFailure(prepare, drop(fixture(), address), {}, 'render_source_required');
  unchangedFailure(
    prepare,
    fixture(),
    { protectedStackBytes: [0x7e0702, 0x7e0703] },
    'task_outer_return_required',
  );
  const f = fixture(),
    data = createRenderData({
      writeWindows: [
        [0x7e0000, 0x7e024f],
        [0x7e0252, 0x7fffff],
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
test('stale, copied and foreign composed plans cannot publish partial returns', () => {
  const f = fixture('yield-resume-end'),
    p = prepared(prepare, f);
  assert.equal(commitTaskPlan(fixture().data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  f.data.seed(0x100, [1]);
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), before);
});
test('C1D9 tail: observed cursor, actual DBR80/root WORD, flags and wrapped return PC', () => {
  const f = taskVisitTailFixture(),
    p = prepared(tail, context(f, { bank: 0x7f, status: 0x45 }));
  assert.equal(p.outputContext.a, 0x4567);
  assert.equal(p.outputContext.bank, 0x80);
  assert.equal(p.outputContext.s, 0x701);
  assert.equal(p.outputContext.status, 0x45);
  assert.equal(p.returnTarget, 0x8091d1);
  const g = taskVisitTailFixture();
  word(g, 0x6fe, 0xff00);
  word(g, 0x700, 65535);
  const q = prepared(tail, g);
  assert.equal(q.outputContext.s, 0x701);
  assert.equal(q.returnTarget, 0x800000);
  assert.equal(q.outputContext.a, 0xff00);
  const wrapped = context(taskVisitTailFixture(), { s: 65534 });
  wrapped.protectedStackBytes = [0x7e0001, 0x7e0002];
  unchangedFailure(tail, wrapped, {}, 'render_write_window_required');
  unchangedFailure(tail, context(taskVisitTailFixture(), { d: 1 }), {}, 'task_visit_D0_required');
  unchangedFailure(tail, drop(taskVisitTailFixture(), 0x701), {}, 'render_source_required');
  unchangedFailure(tail, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(tail, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
});
