import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskVisit as prepare } from '../proof/task/visit-c1ca.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskVisitFixture as fixture, visitWord as word } from './task-visit-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
const value = (f, a) => f.data.readByte(a).value | (f.data.readByte(a + 1).value << 8);
const context = (f, patch) => ({ ...f, context: Object.freeze({ ...f.context, ...patch }) });
const drop = (f, address) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes) if (a !== renderAddress(address)) data.seed(a, [v]);
  return { ...f, data };
};
test('C1CA negative tail preserves actual DBR and restores cursor value, real outer RTS', () => {
  const f = fixture(0x80c1ca, 'negative-tail'),
    p = prepared(prepare, f);
  assert.equal(p.returnTarget, 0x8091d1);
  assert.equal(p.outputContext.a, 2);
  assert.equal(p.outputContext.x, 65535);
  assert.equal(p.outputContext.s, 0x701);
  assert.equal(p.outputContext.bank, 0x80);
  assert.equal(p.visitReturned, true);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(value(f, 0x800250), 2);
  const g = context(fixture(0x80c1ca, 'negative-tail'), { bank: 0x7f });
  word(g, 0x7f0250, 0x4567);
  word(g, 0x7f024c, 0xffff);
  const q = prepared(prepare, g);
  assert.equal(q.outputContext.bank, 0x7f);
  assert.equal(q.outputContext.a, 0x4567);
  assert.equal(commitTaskPlan(g.data, q).handled, true);
  assert.equal(value(g, 0x7f0250), 0x4567);
});
test('C1CA actual blocked helper moves predecessor, consumes inner RTS and forces return DBR80', () => {
  const f = fixture(),
    p = prepared(prepare, f);
  assert.equal(p.outputContext.status, 0x44);
  assert.equal(p.outputContext.x, 2);
  assert.equal(p.returnTarget, 0x8091d1);
  assert.ok(p.accesses.some((a) => a.label === 'visit-inner-RTS-low'));
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(value(f, 0x800250), 2);
  const g = context(fixture(), { bank: 0x7f });
  for (const [a, v] of [
    [0x250, 0x1234],
    [0x24c, 2],
    [0xba4, 0x1000],
    [0x314, 4],
  ])
    word(g, 0x7f0000 + a, v);
  const q = prepared(prepare, g);
  assert.equal(q.outputContext.bank, 0x80);
  assert.equal(commitTaskPlan(g.data, q).handled, true);
  assert.equal(value(g, 0x7f0250), 4);
  assert.equal(value(g, 0x800250), 0x1234);
});
test('C3C9 all status gates preserve scratch or compute original events/countdown and carry', () => {
  for (const [status, events, count, ready, next] of [
    [0, 0, 5, true, 5],
    [0x8000, 0, 5, false, 5],
    [0x1000, 0, 5, false, 5],
    [2, 2, 5, true, 5],
    [2, 0, 5, false, 5],
    [1, 0, 1, true, 0],
    [1, 0, 0, false, 65535],
    [1, 0, 2, false, 1],
    [0x4002, 0x4000, 8, true, 8],
  ]) {
    const f = fixture(0x80c3c9);
    word(f, 0x800ba4, status);
    word(f, 0x800c64, events);
    word(f, 0x800c04, count);
    word(f, 0, 0xbeef);
    word(f, 0x71, 0x4567);
    const p = prepared(prepare, f);
    assert.equal(Boolean(p.outputContext.status & 1), ready);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(value(f, 0x800c04), next);
    assert.equal(value(f, 0x800ba4), ready ? 0 : status);
    if (status === 0 || status & 0x9000) assert.equal(value(f, 0), 0xbeef);
  }
});
test('ready visit enters F378 with actual two PLB bytes, saved S, full opcode high and no target dispatch', () => {
  const f = fixture(0x80c1ca, 'ready'),
    p = prepared(prepare, f);
  assert.equal(p.frontier, '80:F390');
  assert.equal(p.visitReturned, false);
  assert.equal(p.dynamicDispatchExecuted, false);
  assert.equal(p.opcodeWord, 0xa514);
  assert.equal(p.outputContext.d, 0x200);
  assert.equal(p.outputContext.s, 0x3f0);
  assert.equal(p.outputContext.y, 5);
  assert.equal(p.outputContext.bank, 0x80);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(value(f, 0x8001f2), 0x6f9);
});
test('fresh stored rawF494 actually RTSes to F495 and resumes on the same overlay', () => {
  const f = fixture(0x80c1ca, 'resume'),
    p = prepared(prepare, f);
  assert.equal(p.continuationTarget, 0x80f495);
  assert.equal(p.continuationOccurrenceProven, true);
  assert.equal(p.frontier, '80:F390');
  assert.equal(p.metadataWord, 0);
  assert.equal(p.resultPushed, false);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(value(f, 0x8001f2), 0x6f9);
  for (const raw of [0xf508, 0xffff, 0x1234]) {
    const g = fixture(0x80c1ca, 'resume');
    word(g, 0x8002b4, raw);
    unchangedFailure(prepare, g, {}, 'task_visit_continuation_source_required');
  }
});
test('C20B retains status, removes actual heap bit and repairs free/link/tail bytes', () => {
  const f = fixture(0x80c20b, 'post-kept'),
    p = prepared(prepare, f);
  assert.equal(p.visitReturned, true);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(value(f, 0x800250), 4);
  assert.equal(value(f, 0x80024e), 8);
  const g = fixture(0x80c20b, 'post-remove');
  word(g, 0x800254, 0x3d6);
  const q = prepared(prepare, g);
  assert.equal(commitTaskPlan(g.data, q).handled, true);
  assert.equal(value(g, 0x8003d2), 0x40);
  assert.equal(value(g, 0x80024e), 2);
  assert.equal(value(g, 0x800314), 8);
  assert.equal(value(g, 0x800376), 65535);
  assert.equal(value(g, 0x80024c), 4);
});
test('negative postrun selects successor and enters F378 without readiness or continuation read', () => {
  const f = fixture(0x80c20b);
  word(f, 0x800ba4, 0xffff);
  word(f, 0x800374, 4);
  word(f, 0x800256, 0x200);
  const p = prepared(prepare, f);
  assert.equal(p.frontier, '80:F390');
  assert.equal(p.interpreterEntryExecuted, true);
  assert.equal(
    p.accesses.some((a) => a.address === 0x8002b6),
    false,
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(value(f, 0x800250), 4);
});
test('negative parent after release clears its fresh status and directly resumes F495', () => {
  const f = fixture(0x80c20b, 'post-remove');
  word(f, 0x800254, 0x3d6);
  word(f, 0x800ba6, 0xffff);
  word(f, 0x8002b6, 0xf494);
  word(f, 0x800256, 0x200);
  const p = prepared(prepare, f);
  assert.equal(p.continuationOccurrenceProven, true);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(value(f, 0x800ba6), 0);
});
test('all five entries enforce exact cumulative budgets and atomic highbyte/window/owner/context failures', () => {
  for (const entry of [0x80c1ca, 0x80c1f9, 0x80c20b, 0x80c3c9, 0x80c396]) {
    const f = fixture(entry),
      p = prepared(prepare, f);
    prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    if (p.outputBytes)
      unchangedFailure(
        prepare,
        f,
        { maxOutputBytes: p.outputBytes - 1 },
        'task_output_budget_required',
      );
    unchangedFailure(
      prepare,
      f,
      { protectedStackBytes: [0x7e0702, 0x7e0703] },
      'task_outer_return_required',
    );
    unchangedFailure(prepare, context(f, { d: 1 }), {}, 'task_visit_D0_required');
    unchangedFailure(prepare, context(f, { status: 0x4c }), {}, 'task_binary_arithmetic_required');
  }
  const f = fixture(0x80c1ca, 'resume');
  for (const address of [0x800251, 0x80024d, 0x800ba5, 0x8002b5, 0x801205, 0x82e630])
    unchangedFailure(prepare, drop(f, address), {}, 'render_source_required');
  const g = fixture(),
    data = createRenderData({
      writeWindows: [
        [0x7e0000, 0x7e024f],
        [0x7e0252, 0x7fffff],
      ],
    });
  for (const [a, v] of g.data.snapshot().bytes) data.seed(a, [v]);
  unchangedFailure(prepare, { ...g, data }, {}, 'render_write_window_required');
});
test('live stack aliases, full indexes/bank carry and stale/foreign/copied plans remain explicit', () => {
  const f = fixture(0x80c3c9);
  f.context = Object.freeze({ ...f.context, x: 0xffff, bank: 0x7e });
  word(f, 0x7f0ba1, 0);
  prepared(prepare, f);
  const g = fixture(),
    p = prepared(prepare, g);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(g.data, { ...p }).reason, 'task_plan_owner_required');
  g.data.seed(0x100, [1]);
  const before = g.data.snapshot();
  assert.equal(commitTaskPlan(g.data, p).reason, 'task_plan_stale');
  assert.deepEqual(g.data.snapshot(), before);
  const h = context(fixture(), { s: 0x75 });
  h.protectedStackBytes = [0x7e0076, 0x7e0077];
  word(h, 0x76, 0x91d0);
  word(h, 0x800ba4, 2);
  unchangedFailure(prepare, h, {}, 'task_visit_return_target_required');
});
