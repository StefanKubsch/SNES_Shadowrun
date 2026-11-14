import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { taskOpcodeSpecs } from './task-opcode-specs.mjs';
import { taskOpcodeFixture } from './task-opcode-fixtures.mjs';
import * as native from '../proof/task/opcode-sequence.mjs';
import { prepareTaskOpcodeTarget as target } from '../proof/task/opcode-target.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { taskModulePath } from './task-native-catalog.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
const sequence = native.prepareTaskOpcodeSequence;
const drop = (f, ...addresses) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes)
    if (!addresses.map(renderAddress).includes(a)) data.seed(a, [v]);
  return { ...f, data };
};
const context = (f, patch) => ({ ...f, context: Object.freeze({ ...f.context, ...patch }) });
for (const spec of taskOpcodeSpecs) {
  const prepare = native[spec.exportName],
    standalone = (await import(`../${taskModulePath(spec.family)}`))['prepareTask' + spec.suffix];
  test(`${spec.name}: checked original dispatch composes the existing equation byte-for-byte with full context and ordered accesses`, () => {
    const f = taskOpcodeFixture(spec),
      p = prepared(prepare, f),
      q = prepared(standalone, {
        ...f,
        entry: spec.target,
        context: Object.freeze({ ...f.context, pc: spec.target & 65535 }),
      });
    assert.deepEqual(p.outputContext, q.outputContext);
    assert.deepEqual(p.byteWrites, q.byteWrites);
    assert.deepEqual(p.accesses.slice(2), q.accesses);
    assert.equal(p.work, q.work + 2);
    assert.equal(p.outputBytes, q.outputBytes);
    assert.equal(p.steps[0].target, spec.target);
    assert.equal(p.handlersExecuted, 1);
    assert.equal(p.boundedOpcodeDispatchExecuted, true);
    assert.equal(p.fullTaskBinding, false);
    assert.deepEqual(
      p.accesses.slice(0, 2).map((a) => [a.address, a.value]),
      [
        [0x80f2b4 + spec.opcode, spec.target & 255],
        [0x80f2b5 + spec.opcode, (spec.target >>> 8) & 255],
      ],
    );
  });
  test(`${spec.name}: missing sourceHigh, changed table and exact cumulative budgets keep all earlier writes private`, () => {
    const f = taskOpcodeFixture(spec),
      p = prepared(prepare, f);
    unchangedFailure(prepare, context(f, { x: 0x100 }), {}, 'task_opcode_entry_required');
    unchangedFailure(prepare, drop(f, 0x80f2b5 + spec.opcode), {}, 'render_source_required');
    const last = p.accesses.findLast((a) => a.kind === 'read');
    unchangedFailure(prepare, drop(f, last.address), {}, 'render_source_required');
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    if (p.outputBytes)
      unchangedFailure(
        prepare,
        f,
        { maxOutputBytes: p.outputBytes - 1 },
        'task_output_budget_required',
      );
    prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    const changed = taskOpcodeFixture(spec);
    changed.data.seed(0x80f2b4 + spec.opcode, [0]);
    unchangedFailure(prepare, changed, {}, 'task_opcode_target_required');
    const access = p.accesses.find((a) => renderAddress(a.address)?.toString(16).startsWith('7e'));
    if (access)
      unchangedFailure(
        prepare,
        f,
        { protectedStackBytes: [...f.protectedStackBytes, renderAddress(access.address)] },
        'task_stack_alias_required',
      );
  });
  test(`${spec.name}: source-linked report reproduces the checked plan and preserves owner/version protection`, async () => {
    const f = taskOpcodeFixture(spec),
      p = prepared(prepare, f),
      report = JSON.parse(await readFile(`analysis/render-task-${spec.name}-native.json`));
    assert.deepEqual(report.probes[0].outputContext, p.outputContext);
    assert.deepEqual(report.probes[0].byteWrites, p.byteWrites);
    assert.equal(report.probes[0].work, p.work);
    assert.equal(report.probes[1].reason, 'task_work_budget_required');
    assert.ok(report.probes.every((p) => p.synthetic));
    assert.equal(
      commitTaskPlan(taskOpcodeFixture(spec).data, p).reason,
      'task_plan_owner_required',
    );
    assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
    f.data.seed(0x100, [1]);
    const before = f.data.snapshot();
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
    assert.deepEqual(f.data.snapshot(), before);
  });
}
test('target reader keeps full X, bank80 and wrap16 independently of actual D/DBR/A/Y/S/status', () => {
  for (const x of [1, 0x100, 0xd4b, 0xd4c, 0xffff]) {
    const f = context(taskOpcodeFixture(), {
      x,
      d: 0xffff,
      bank: 0x7f,
      a: 0x8000,
      y: 65535,
      status: 0xcf,
    });
    const low = 0x800000 | ((0xf2b4 + x) & 65535),
      high = 0x800000 | ((0xf2b5 + x) & 65535);
    f.data.seed(low, [0x34]);
    f.data.seed(high, [0x12]);
    const p = prepared(target, f);
    assert.deepEqual(p.outputContext, { ...f.context, pc: 0x1234 });
    assert.equal(p.target, 0x801234);
    assert.deepEqual(
      p.accesses.map((a) => a.address),
      [low, high],
    );
    assert.equal(p.work, 2);
    assert.equal(p.outputBytes, 0);
    assert.deepEqual(p.byteWrites, []);
    unchangedFailure(target, drop(f, high), {}, 'render_source_required');
  }
});
const chain = () => {
  const f = taskOpcodeFixture();
  f.data.seed(0x801204, [0x86, 0xba, 0x5c, 0xbe, 0x14, 0xa5]);
  return { ...f, maxHandlers: 5 };
};
test('five source-proved handlers share actual operand writes and Carry, one overlay and one outer commit', () => {
  const f = chain(),
    p = prepared(sequence, f);
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0xc0, 0x86, 0xba, 0x5c, 0xbe],
  );
  assert.equal(p.outputContext.s, 0x3ee);
  assert.equal(p.outputContext.y, 9);
  assert.equal(p.outputContext.a, 0x14);
  assert.equal(p.outputContext.x, 0x14);
  assert.equal(p.outputContext.status, 0x04);
  assert.equal(p.handlersExecuted, 5);
  assert.equal(p.steps[3].left, 1);
  assert.equal(p.steps[3].right, 1);
  assert.equal(p.steps[3].value, 2);
  assert.equal(p.steps[4].value, 2);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  const bytes = new Map(f.data.snapshot().bytes);
  assert.equal(bytes.get(0x7e03ef), 255);
  assert.equal(bytes.get(0x7e03f0), 255);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
});
test('explicit handler count stops before reading/executing the next target, without guessing a termination condition', () => {
  const f = chain();
  f.data.seed(0x801208, [0x5a]);
  f.data.seed(0x80f30e, [0x6a, 0xc3]);
  const p = prepared(sequence, f);
  assert.equal(p.outputContext.x, 0x5a);
  assert.equal(p.nextTargetExecuted, false);
  unchangedFailure(sequence, f, { maxHandlers: 6 }, 'task_opcode_target_required');
  for (const maxHandlers of [undefined, 0, -1, 1.5, Infinity])
    unchangedFailure(sequence, f, { maxHandlers }, 'task_handler_budget_required');
});
test('late unbound, changed table, missing highbyte, stack owner, write window and cumulative budget discard the entire chain', () => {
  const f = chain(),
    p = prepared(sequence, f);
  unchangedFailure(sequence, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    sequence,
    f,
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  unchangedFailure(sequence, drop(f, 0x801209), {}, 'render_source_required');
  unchangedFailure(sequence, drop(f, 0x80f2b5 + 0xbe), {}, 'render_source_required');
  const changed = chain();
  changed.data.seed(0x80f2b4 + 0xbe, [0]);
  unchangedFailure(sequence, changed, {}, 'task_opcode_target_required');
  unchangedFailure(
    sequence,
    f,
    { protectedStackBytes: [...f.protectedStackBytes, 0x7e03ed] },
    'task_stack_alias_required',
  );
  const limited = createRenderData({ writeWindows: [[0x7e03ef, 0x7e03f0]] });
  for (const [a, v] of f.data.snapshot().bytes) limited.seed(a, [v]);
  unchangedFailure(sequence, { ...f, data: limited }, {}, 'render_write_window_required');
  const unbound = chain();
  unbound.data.seed(0x801205, [0x5a]);
  unbound.data.seed(0x80f30e, [0x6a, 0xc3]);
  unchangedFailure(sequence, unbound, {}, 'task_opcode_target_required');
  prepared(sequence, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
});
test('each later fetch sees all own pointer writes; neither cached pointer nor prefetched opcode survives', () => {
  const f = taskOpcodeFixture(null, { d: 0x3ef });
  f.data.seed(0x800004, [0x86, 0x14, 0xbc, 0xa5]);
  const p = prepared(sequence, { ...f, maxHandlers: 2 });
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0xc0, 0x86],
  );
  assert.equal(p.outputContext.x, 0xbc);
  assert.equal(p.steps[1].value, 0);
  assert.equal(p.steps[1].result, 1);
  assert.deepEqual(
    p.accesses.filter((a) => a.label === 'fresh-next-opcode-pointer-low').map((a) => a.value),
    [0, 1],
  );
  assert.deepEqual(
    p.accesses.filter((a) => a.label === 'fresh-next-opcode-low').map((a) => a.address),
    [0x800004, 0x800006],
  );
});
test('unbound full-X, odd and alias slots read their actual bytes and stop without index normalization', () => {
  for (const x of [1, 0x100, 0xc4]) {
    const f = context(taskOpcodeFixture(), { x });
    const low = 0x800000 | ((0xf2b4 + x) & 65535);
    f.data.seed(low, [0x43, 0xf8]);
    const p = unchangedFailure(sequence, f, {}, 'task_opcode_source_required');
    assert.equal(p.opcode, x);
    assert.equal(p.target, 0x80f843);
  }
});
test('binary premise applies only to the actual arithmetic handler and fails after earlier pushes atomically', () => {
  const f = context(chain(), { status: 0x4d });
  unchangedFailure(sequence, f, {}, 'task_binary_decimal_required');
  prepared(sequence, { ...f, maxHandlers: 3 });
});
test('shift count zero skips value reads, while full 65535 iterations remain budgeted through composition', () => {
  for (const opcode of [0x7a, 0x7c]) {
    const spec = taskOpcodeSpecs.find((s) => s.opcode === opcode),
      f = taskOpcodeFixture(spec, { top: 0 }),
      p = prepared(sequence, drop(f, 0x3f3, 0x3f4));
    assert.equal(p.steps[0].iterations, 0);
    assert.equal(p.steps[0].valueWordRead, false);
    const g = taskOpcodeFixture(spec, { top: 65535, left: 0x8001 }),
      q = prepared(sequence, g);
    assert.equal(q.steps[0].iterations, 65535);
    assert.equal(q.steps[0].result, 0);
    unchangedFailure(sequence, g, { maxWork: q.work - 1 }, 'task_work_budget_required');
  }
});
test('reported five-handler probes reproduce the independently checked full composition and late failures', async () => {
  const report = JSON.parse(await readFile('analysis/render-task-opcode-dispatch-native.json')),
    p = prepared(sequence, chain()),
    rows = report.composition.probes;
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.synthetic));
  assert.deepEqual(rows[0].outputContext, p.outputContext);
  assert.deepEqual(rows[0].byteWrites, p.byteWrites);
  assert.deepEqual(rows[0].steps, p.steps);
  assert.equal(rows[0].work, p.work);
  assert.deepEqual(
    rows.slice(1).map((r) => r.reason),
    ['task_work_budget_required', 'task_output_budget_required'],
  );
});
