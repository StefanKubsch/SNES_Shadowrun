import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativeOpcodeSpecs } from './task-native-opcode-specs.mjs';
import { taskLeafSpecs } from './task-native-leaf-specs.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { arithmeticObservations } from './task-arithmetic-native-fixtures.mjs';
import {
  prepareTaskNativeOpcodeSequence as sequence,
  prepareTaskNativeOpcode58 as native58,
  prepareTaskOpcode58 as prefix58,
} from '../proof/task/opcode-sequence.mjs';
import * as bindings from '../proof/task/native-opcode-bindings.mjs';
import { prepareTaskNativeArguments as prefix } from '../proof/task/native-arguments.mjs';
import { prepareTaskNativeCall as call } from '../proof/task/native-dispatch.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
const word = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const context = (f, patch) => ({ ...f, context: Object.freeze({ ...f.context, ...patch }) });
const drop = (f, ...addresses) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows }),
    omit = new Set(addresses.map(renderAddress));
  for (const [a, v] of f.data.snapshot().bytes) if (!omit.has(a)) data.seed(a, [v]);
  return { ...f, data };
};
for (const s of nativeOpcodeSpecs) {
  const prepare = bindings[s.exportName];
  test(`full Native58 ${s.name}: independent existing prefix and bridge-call plans reproduce the atomic composition`, () => {
    const f = taskNativeOpcodeFixture(s),
      p = prepared(prepare, f),
      g = taskNativeOpcodeFixture(s);
    const q = prepared(prefix, context({ ...g, entry: 0x80f4cb }, { pc: 0xf4cb }));
    assert.equal(commitTaskPlan(g.data, q).handled, true);
    const r = prepared(call, { ...g, entry: 0x80f4f6, context: q.outputContext });
    assert.equal(commitTaskPlan(g.data, r).handled, true);
    assert.deepEqual(p.outputContext, r.outputContext);
    assert.equal(p.work, q.work + r.work + 2);
    assert.equal(p.outputBytes, q.outputBytes + r.outputBytes);
    assert.deepEqual(p.accesses.slice(2), [...q.accesses, ...r.accesses]);
    assert.equal(p.steps[0].calleeEntry, s.entry);
    assert.equal(
      p.steps[0].wordPops,
      parseInt(s.anchors.find((a) => a.kind === 'argument-metadata').hex.slice(0, 2), 16),
    );
    assert.equal(p.steps[0].calleeReturnWord, 0xf508);
    assert.equal(p.steps[0].calleeReturnTarget, 0x80f509);
    assert.equal(p.steps[0].stackMigrationExecuted, true);
    assert.equal(p.outputContext.d, 0x200);
    assert.equal(p.outputContext.bank, 0x80);
    assert.equal(
      p.outputContext.s,
      0x3f0 + 2 * p.steps[0].wordPops - (p.steps[0].resultPushed ? 2 : 0),
    );
    assert.equal(p.outputContext.y, 6);
    assert.equal(p.outputContext.x, 0x14);
    assert.equal(p.outputContext.pc, 0xf390);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.deepEqual(f.data.snapshot().bytes, g.data.snapshot().bytes);
  });
  test(`full Native58 ${s.name}: highbytes, physical stack owners, exact budgets and write windows remain atomic`, () => {
    const f = taskNativeOpcodeFixture(s),
      p = prepared(prepare, f);
    for (const missing of [
      0x801205,
      0x82da4d + s.id,
      0x82d7b9 + 2 * s.id,
      0x82d971 + s.id,
      0x801206,
      0x263,
    ])
      unchangedFailure(prepare, drop(f, missing), {}, 'render_source_required');
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    unchangedFailure(
      prepare,
      f,
      { protectedStackBytes: [0x7e0800, 0x7e0801] },
      'task_outer_return_required',
    );
    unchangedFailure(
      prepare,
      f,
      { protectedStackBytes: [...f.protectedStackBytes, 0x7e0203] },
      'task_stack_alias_required',
    );
    const g = taskNativeOpcodeFixture(s),
      data = createRenderData({
        writeWindows: [
          [0x7e0000, 0x7e0690],
          [0x7e0700, 0x7fffff],
        ],
      });
    for (const [a, v] of g.data.snapshot().bytes) data.seed(a, [v]);
    unchangedFailure(prepare, { ...g, data }, {}, 'render_write_window_required');
  });
  test(`full Native58 ${s.name}: private wrong-target effects and source-linked probe reproduction`, async () => {
    const f = taskNativeOpcodeFixture(s),
      p = prepared(prepare, f),
      other = nativeOpcodeSpecs.find((t) => t.entry !== s.entry);
    word(f, 0x82d7b8 + 2 * s.id, other.entry & 65535);
    unchangedFailure(prepare, f, {}, 'task_native_opcode_target_required');
    const report = JSON.parse(
      await readFile(`analysis/render-task-${s.compositionName}-native.json`),
    );
    assert.deepEqual(report.probes[0].outputContext, p.outputContext);
    assert.deepEqual(report.probes[0].accesses, p.accesses);
    assert.deepEqual(report.probes[0].byteWrites, p.byteWrites);
    assert.equal(report.probes[0].work, p.work);
    assert.deepEqual(
      report.probes.slice(1).map((p) => p.reason),
      ['task_work_budget_required', 'task_output_budget_required'],
    );
    assert.ok(report.probes.every((p) => p.synthetic));
    assert.equal(report.full_task_binding, false);
    assert.equal(report.global_stack_minimum, null);
    const g = taskNativeOpcodeFixture(s),
      q = prepared(prepare, g);
    assert.equal(
      commitTaskPlan(taskNativeOpcodeFixture(s).data, q).reason,
      'task_plan_owner_required',
    );
    assert.equal(commitTaskPlan(g.data, { ...q }).reason, 'task_plan_owner_required');
    g.data.seed(0x100, [1]);
    const before = g.data.snapshot();
    assert.equal(commitTaskPlan(g.data, q).reason, 'task_plan_stale');
    assert.deepEqual(g.data.snapshot(), before);
  });
}

test('full Native58 is explicit; the earlier prefix API still stops before migration', () => {
  const f = taskNativeOpcodeFixture(),
    p = prepared(prefix58, f);
  assert.equal(p.frontier, '80:F4F6');
  assert.equal(p.steps[0].stackMigrationExecuted, false);
  unchangedFailure(prefix58, f, { maxHandlers: 2 }, 'task_opcode_continuation_source_required');
  for (const maxHandlers of [undefined, 0, -1, 1.5, Infinity])
    unchangedFailure(sequence, f, { maxHandlers }, 'task_handler_budget_required');
  unchangedFailure(native58, context(f, { x: 0x14 }), {}, 'task_opcode_entry_required');
});
test('full Native58 composition admits exactly the separately renewed targets', () => {
  for (const s of taskLeafSpecs.filter(
    (s) => !nativeOpcodeSpecs.some((p) => p.entry === s.entry),
  )) {
    const f = taskNativeOpcodeFixture(s);
    unchangedFailure(sequence, f, {}, 'task_native_opcode_target_source_required');
  }
  const f = taskNativeOpcodeFixture();
  word(f, 0x82d7bc, 0x1234);
  unchangedFailure(sequence, f, {}, 'task_native_opcode_target_source_required');
});
test('fresh inner return pointer uses JSR writes even if they replace the earlier A2 table store', () => {
  const f = taskNativeOpcodeFixture();
  word(f, 0x8001f2, 0xa3);
  f.protectedStackBytes = [0x7e00a4, 0x7e00a5];
  const p = unchangedFailure(sequence, f, {}, 'task_native_opcode_target_source_required');
  assert.equal(p.calleeEntry, 0x80f508);
});
test('actual callee writes can replace the inner RTS; no inferred successful return or live effects', () => {
  const f = taskNativeOpcodeFixture(nativeOpcodeSpecs.find((s) => s.name === 'native-ca0d'));
  word(f, 0x8001f2, 0x1469);
  word(f, 0x146a, 0xc20a);
  f.protectedStackBytes = [0x7e146a, 0x7e146b];
  const p = unchangedFailure(sequence, f, {}, 'task_native_resume_target_required');
  assert.equal(p.returnTarget, 0x800004);
});
test('full Native58 result is the next handler physical operand, on one overlay and one commit', () => {
  const f = taskNativeOpcodeFixture();
  f.data.seed(0x801205, [0x86, 0x14, 0xa5]);
  const p = prepared(sequence, { ...f, maxHandlers: 2 });
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0x58, 0x86],
  );
  assert.equal(p.steps[1].value, 0x34);
  assert.equal(p.steps[1].result, 0x35);
  assert.equal(p.outputContext.s, 0x3f0);
  assert.equal(p.outputContext.y, 7);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  unchangedFailure(
    sequence,
    drop(taskNativeOpcodeFixture(), 0x801206),
    { maxHandlers: 2 },
    'render_source_required',
  );
});
function twoCalls() {
  const f = taskNativeOpcodeFixture(),
    second = nativeOpcodeSpecs.find((s) => s.name === 'native-9e5f');
  f.data.seed(0x801205, [0x58, second.id, 0x14, 0xa5]);
  word(f, 0x82d7b8 + second.id * 2, second.entry & 65535);
  for (const a of second.anchors.filter((a) => a.kind !== 'pointer'))
    f.data.seed(a.start, Buffer.from(a.hex, 'hex'));
  return { ...f, maxHandlers: 2 };
}
test('two Native58 calls reuse fresh saved S/PC/ID and protected outer frame without host caching', () => {
  const f = twoCalls(),
    p = prepared(sequence, f);
  assert.deepEqual(
    p.steps.map((s) => s.calleeEntry),
    [0x80ca3a, 0x809e5f],
  );
  assert.equal(p.outputContext.y, 8);
  assert.equal(p.outputContext.x, 0x14);
  assert.equal(p.outputContext.s, 0x3ee);
  assert.deepEqual(
    p.accesses.filter((a) => a.label === 'resume-fresh-native-ID-low').map((a) => a.value),
    [2, 97],
  );
  assert.deepEqual(
    p.accesses.filter((a) => a.label === 'fresh-outer-S-low').map((a) => a.value),
    [0xff, 0xff],
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  unchangedFailure(sequence, drop(twoCalls(), 0x82d9d2), {}, 'render_source_required');
  unchangedFailure(sequence, twoCalls(), { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    sequence,
    twoCalls(),
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
});
test('outer observation ownership remains cumulative; unused records discard the full Native58 sequence', () => {
  const f = twoCalls();
  unchangedFailure(
    sequence,
    f,
    {
      ioMode: 'record-requests',
      ioObservations: Object.freeze([
        Object.freeze({ pc: 0x80f584, address: 0x804216, width: 2, value: 1 }),
      ]),
    },
    'task_io_observation_unused',
  );
  const p = prepared(sequence, {
    ...f,
    ioMode: 'record-requests',
    ioObservations: Object.freeze([]),
  });
  assert.deepEqual(p.ioRequests, []);
});
test('255 arguments use the full original low metadata count and fresh outer S after workspace stores', () => {
  const f = taskNativeOpcodeFixture(nativeOpcodeSpecs.find((s) => s.name === 'native-9e5f'));
  f.data.seed(0x82daad, [255, 0xa5]);
  for (let n = 0; n < 255; n++) word(f, 0x3f1 + 2 * n, n === 249 ? 0x6ff : n);
  const p = prepared(sequence, f);
  assert.equal(p.steps[0].wordPops, 255);
  assert.equal(p.outputContext.s, 0x5ec);
  assert.equal(p.accesses.filter((a) => a.label === 'native-argument-workspace-low').length, 255);
  assert.equal(p.accesses.find((a) => a.label === 'fresh-outer-S-low').value, 0xff);
  assert.equal(p.accesses.find((a) => a.label === 'fresh-outer-S-high').value, 6);
  unchangedFailure(sequence, drop(f, 0x5ee), {}, 'render_source_required');
  unchangedFailure(
    sequence,
    f,
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
});
test('argument workspace replaces saved ID: fresh full WORD ASL wraps and keeps original bit15 Carry', () => {
  const f = taskNativeOpcodeFixture();
  f.context = Object.freeze({ ...f.context, d: 0 });
  word(f, 0, 0x1200);
  f.data.seed(0x82da4e, [6, 0xa5]);
  word(f, 0x3f9, 0x0100);
  word(f, 0x3fb, 0x80);
  word(f, 0x82d7ba, 0x9e5f);
  const p = prepared(sequence, f);
  assert.equal(p.steps[0].id, 2);
  assert.equal(p.steps[0].freshId, 0x8001);
  assert.equal(p.steps[0].wordPops, 6);
  assert.equal(p.steps[0].calleeEntry, 0x809e5f);
  assert.equal(p.outputContext.status & 1, 1);
  assert.deepEqual(
    p.accesses
      .filter((a) => a.label === 'fresh-native-ID-low' || a.label === 'fresh-native-ID-high')
      .map((a) => a.value),
    [1, 0x80],
  );
  unchangedFailure(
    bindings.prepareTaskNativeOpcodeCA3A,
    f,
    {},
    'task_native_opcode_target_required',
  );
});
test('return result PHA replaces saved PC before its mandatory fresh read', () => {
  const f = taskNativeOpcodeFixture(nativeOpcodeSpecs.find((s) => s.name === 'native-9e5f'));
  f.context = Object.freeze({ ...f.context, s: 0x204 });
  word(f, 0x80d0ef, 0xa514);
  const p = prepared(sequence, f);
  assert.equal(p.outputContext.y, 0xbef0);
  assert.equal(p.outputContext.x, 0x14);
  assert.equal(p.accesses.find((a) => a.label === 'resume-fresh-PC-low').value, 0xef);
  assert.equal(p.accesses.find((a) => a.label === 'resume-fresh-PC-high').value, 0xbe);
  unchangedFailure(sequence, drop(f, 0x80d0f0), {}, 'render_source_required');
});
test('return result PHA replaces stream pointer before its mandatory fresh F389 read', () => {
  const f = taskNativeOpcodeFixture(nativeOpcodeSpecs.find((s) => s.name === 'native-9e5f'));
  f.context = Object.freeze({ ...f.context, s: 0x201 });
  word(f, 0x80bef4, 0xa514);
  const p = prepared(sequence, f);
  assert.equal(p.outputContext.y, 6);
  assert.equal(p.outputContext.x, 0x14);
  assert.deepEqual(
    p.accesses
      .filter(
        (a) =>
          a.label === 'fresh-next-opcode-pointer-low' ||
          a.label === 'fresh-next-opcode-pointer-high',
      )
      .map((a) => a.value),
    [0xef, 0xbe],
  );
  unchangedFailure(sequence, drop(f, 0x80bef5), {}, 'render_source_required');
});
test('Native58 and later multiply consume one chronological observation stream and discard late IO failures', () => {
  const make = () => {
    const f = taskNativeOpcodeFixture(nativeOpcodeSpecs.find((s) => s.name === 'native-9e5f'));
    f.data.seed(0x801205, [0x60, 0xbe, 0xa5]);
    return {
      ...f,
      maxHandlers: 2,
      ioMode: 'record-requests',
      ioObservations: arithmeticObservations(0x80f581),
    };
  };
  const f = make(),
    p = prepared(sequence, f);
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0x58, 0x60],
  );
  assert.equal(p.observationsUsed, 4);
  assert.deepEqual(
    p.ioRequests.filter((r) => r.kind === 'read').map(({ kind, ...r }) => r),
    f.ioObservations,
  );
  unchangedFailure(
    sequence,
    make(),
    { ioObservations: Object.freeze(f.ioObservations.slice(0, -1)) },
    'task_io_observation_required',
  );
  unchangedFailure(
    sequence,
    make(),
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  unchangedFailure(sequence, make(), { maxWork: p.work - 1 }, 'task_work_budget_required');
});
test('actual argument DBR and restored resume DBR remain distinct from the bridge local DBR80', () => {
  const f = taskNativeOpcodeFixture();
  f.context = Object.freeze({ ...f.context, bank: 0x7f });
  word(f, 0x201, 0x7f12);
  word(f, 0x7f01f2, 0x6ff);
  f.data.seed(0x7f1204, [2, 0x14, 0xa5]);
  const p = prepared(sequence, f);
  assert.equal(p.steps[0].calleeEntry, 0x80ca3a);
  assert.equal(p.outputContext.bank, 0x7f);
  assert.equal(
    p.accesses.find((a) => a.label === 'native-argument-workspace-low').address,
    0x7f0000,
  );
  assert.equal(p.accesses.find((a) => a.label === 'resume-fresh-result-low').address, 0x7f0000);
  assert.equal(p.accesses.find((a) => a.label === 'resume-fresh-result-low').value, 0x10);
  assert.equal(p.accesses.find((a) => a.label === 'fresh-next-opcode-low').address, 0x7f1205);
  unchangedFailure(sequence, drop(f, 0x7f1206), {}, 'render_source_required');
});
