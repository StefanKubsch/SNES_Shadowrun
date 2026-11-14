import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  scriptOpcodeSpecs,
  taskScriptOpcodeFixture as fixture,
  taskScriptResumeFixture,
} from './task-script-opcode-fixtures.mjs';
import {
  prepareTaskScriptOpcode52 as prepare,
  prepareTaskScriptOpcodeSequence as sequence,
  prepareTaskOpcode52 as prefix52,
} from '../proof/task/opcode-sequence.mjs';
import * as bindings from '../proof/task/script-opcode-bindings.mjs';
import { prepareTaskScriptArguments } from '../proof/task/script-arguments.mjs';
import { prepareTaskScriptYield } from '../proof/task/script-yield.mjs';
import { prepareTaskScriptResume } from '../proof/task/script-resume.mjs';
import { prepareTaskNativeResume } from '../proof/task/native-resume.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
const word = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const drop = (f, ...addresses) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows }),
    omit = new Set(addresses.map(renderAddress));
  for (const [a, v] of f.data.snapshot().bytes) if (!omit.has(a)) data.seed(a, [v]);
  return { ...f, data };
};
const value = (f, a) => {
  const bytes = new Map(f.data.snapshot().bytes),
    p = renderAddress(a);
  return bytes.get(p) | (bytes.get(renderAddress(a + 1)) << 8);
};
const context = (f, patch) => ({ ...f, context: Object.freeze({ ...f.context, ...patch }) });
for (const s of scriptOpcodeSpecs) {
  const id = s.id.toString(16).padStart(3, '0'),
    binding = bindings['prepareTaskScriptOpcode' + id.toUpperCase()];
  test(`Script52 ID${s.id}: original header allocates the independently expected frame and yields actual outer return`, () => {
    const f = fixture(s),
      p = prepared(binding, f),
      size = s.header[0] + s.header[1] + 23,
      argBytes = s.argument & 255;
    assert.equal(p.steps[0].id, s.id);
    assert.equal(p.steps[0].wordPops, argBytes / 2);
    assert.equal(p.frontier, 'actual-outer-yield-target');
    assert.equal(p.steps[0].returnTarget, 0x80c20b);
    assert.equal(p.steps[0].returnTargetExecuted, false);
    assert.equal(p.outputContext.a, 0xf494);
    assert.equal(p.outputContext.x, 2);
    assert.equal(p.outputContext.y, 65535);
    assert.equal(p.outputContext.s, 0x701);
    assert.equal(p.outputContext.pc, 0xc20b);
    assert.equal(p.outputContext.d, 0);
    assert.equal(p.outputContext.bank, 0x80);
    assert.equal(p.outputContext.status, 0x84);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(value(f, 0x8003d2), 0x8000 | size);
    assert.equal(value(f, 0x8003d4), size + 4);
    assert.equal(value(f, 0x8003d2 + size + 4), 256 - size - 4);
    assert.equal(value(f, 0x8003d4 + size + 4), 0);
    assert.equal(value(f, 0x800254), 0x3d6);
    assert.equal(value(f, 0x80024e), 4);
    assert.equal(value(f, 0x80024c), 2);
    assert.equal(value(f, 0x800314), 0);
    assert.equal(value(f, 0x800374), 65535);
    assert.equal(value(f, 0x800372), 2);
    assert.equal(value(f, 0x800ba2), 65535);
    assert.equal(value(f, 0x8002b2), 0xf494);
    assert.equal(value(f, 0x8003d6), s.pointer + 2);
    assert.equal(value(f, 0x8003d8), s.bank & 255);
    assert.equal(value(f, 0x8003d9), 0);
    assert.equal(value(f, 0x8003db), 0x3e7);
    assert.equal(value(f, 0x8003dd), 0x3d6 + size - 1 - argBytes);
    for (let n = 0; n < argBytes / 2; n++)
      assert.equal(value(f, 0x8003d6 + size - argBytes + 2 * n), 0x110 + n);
  });
  test(`Script52 ID${s.id}: whole plan matches separate physical prefix/yield plans with fresh reads`, () => {
    const f = fixture(s),
      p = prepared(binding, f),
      g = fixture(s);
    const q = prepared(
      prepareTaskScriptArguments,
      context({ ...g, entry: 0x80f460 }, { pc: 0xf460 }),
    );
    assert.equal(commitTaskPlan(g.data, q).handled, true);
    const r = prepared(prepareTaskScriptYield, { ...g, entry: 0x80f488, context: q.outputContext });
    assert.equal(commitTaskPlan(g.data, r).handled, true);
    assert.deepEqual(p.accesses.slice(2), [...q.accesses, ...r.accesses]);
    assert.deepEqual(p.outputContext, r.outputContext);
    assert.equal(p.work, q.work + r.work + 2);
    assert.equal(p.outputBytes, q.outputBytes + r.outputBytes);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.deepEqual(f.data.snapshot().bytes, g.data.snapshot().bytes);
  });
  test(`Script52 ID${s.id}: original highbytes, late windows/budgets, private ID mismatch and report reproduction`, async () => {
    const f = fixture(s),
      p = prepared(binding, f),
      r = JSON.parse(await readFile(`analysis/render-task-script-opcode-${id}-native.json`));
    assert.deepEqual(r.probes[0].accesses, p.accesses);
    assert.deepEqual(r.probes[0].outputContext, p.outputContext);
    assert.deepEqual(r.probes[0].byteWrites, p.byteWrites);
    for (const address of [
      0x801205,
      0x82e9cd + s.id,
      0x82db29 + s.id,
      0x82ded2 + 2 * s.id,
      parseInt(s.entry.replace(':', ''), 16) + 1,
      0x800251,
      0x800373,
      0x700,
      0x701,
      ...Array.from({ length: (s.argument & 255) / 2 }, (_, n) => 0x3f2 + 2 * n),
    ])
      unchangedFailure(binding, drop(f, address), {}, 'render_source_required');
    unchangedFailure(binding, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      binding,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    prepared(binding, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    const wrong = fixture(s);
    word(wrong, 0x801204, s.id === 0 ? 1 : 0);
    word(wrong, 0x82e9cc + (s.id === 0 ? 1 : 0), 0);
    unchangedFailure(binding, wrong, {}, 'task_script_ID_required');
    const data = createRenderData({
      writeWindows: [
        [0x7e0000, 0x7e02b1],
        [0x7e02b4, 0x7fffff],
      ],
    });
    for (const [a, v] of f.data.snapshot().bytes) data.seed(a, [v]);
    unchangedFailure(binding, { ...f, data }, {}, 'render_write_window_required');
  });
}
test('Script52 is explicit and terminal; existing prefix52 still ends before TCS', () => {
  const f = fixture();
  assert.equal(prepared(prefix52, f).frontier, '80:F488');
  unchangedFailure(prefix52, f, { maxHandlers: 2 }, 'task_opcode_continuation_source_required');
  unchangedFailure(prepare, f, { maxHandlers: 2 }, 'task_opcode_continuation_source_required');
  unchangedFailure(sequence, f, { maxHandlers: 0 }, 'task_handler_budget_required');
  unchangedFailure(prepare, context(f, { status: 0x4d }), {}, 'task_binary_arithmetic_required');
  unchangedFailure(
    prepare,
    f,
    { protectedStackBytes: [0x7e0800, 0x7e0801] },
    'task_outer_return_required',
  );
});
test('C242 preserves negative skip, coalescing, split threshold and real heap exhaustion without a success guard', () => {
  const skip = fixture();
  word(skip, 0x8003d2, 0x8001);
  word(skip, 0x8003d4, 0x100);
  word(skip, 0x8004d2, 0x100);
  word(skip, 0x8004d4, 0);
  const p = prepared(prepare, skip);
  assert.equal(commitTaskPlan(skip.data, p).handled, true);
  assert.equal(value(skip, 0x800254), 0x4d6);
  const merged = fixture();
  word(merged, 0x8003d2, 20);
  word(merged, 0x8003d4, 0x100);
  word(merged, 0x8004d2, 25);
  word(merged, 0x8004d4, 0);
  const q = prepared(prepare, merged);
  assert.equal(commitTaskPlan(merged.data, q).handled, true);
  assert.equal(value(merged, 0x8003d2), 0x8029);
  assert.equal(value(merged, 0x8003d2 + 45), 4);
  const exact = fixture();
  word(exact, 0x8003d2, 45);
  const r = prepared(prepare, exact);
  assert.equal(commitTaskPlan(exact.data, r).handled, true);
  assert.equal(value(exact, 0x8003d2), 0x802d);
  assert.equal(value(exact, 0x8003d4), 0);
  const exhausted = fixture();
  word(exhausted, 0x8003d2, 0x8000);
  const t = prepared(prepare, exhausted);
  assert.equal(commitTaskPlan(exhausted.data, t).handled, true);
  assert.equal(value(exhausted, 0x800254), 0);
});
test('cyclic heap data spends the explicit cumulative work budget and discards prior writes', () => {
  const f = fixture();
  word(f, 0x8003d2, 0x8000);
  word(f, 0x8003d4, 0x100);
  word(f, 0x8004d2, 0x8000);
  word(f, 0x8004d4, 0x100);
  unchangedFailure(prepare, f, { maxWork: 500 }, 'task_work_budget_required');
});
test('actual inner heap/frame/caller return alias writes never substitute a host return', () => {
  const f = fixture();
  f.context = Object.freeze({ ...f.context, s: 0x3f0 });
  word(f, 0x8001f2, 0x76);
  f.protectedStackBytes = [0x7e0077, 0x7e0078];
  word(f, 0x77, 0xc20a);
  // Frame JSR occupies73..76; original bank/pointer scratch stores replace it.
  unchangedFailure(prepare, f, {}, 'task_script_return_target_required');
});
test('parent=child aliases use changed successor; full negative free slot remains an actual indexed source', () => {
  const f = fixture();
  word(f, 0x800250, 2);
  word(f, 0x800374, 65535);
  const p = prepared(prepare, f);
  assert.equal(p.outputContext.y, 2);
  assert.equal(p.outputContext.a, 2);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(value(f, 0x800314), 2);
  const g = fixture();
  word(g, 0x80024e, 65535);
  word(g, 0x800250, 0);
  word(g, 0x810371, 65535);
  const q = prepared(prepare, g);
  assert.equal(q.outputContext.x, 65535);
  assert.equal(commitTaskPlan(g.data, q).handled, true);
  assert.equal(value(g, 0x810311), 0);
});
test('stale/foreign/copied plans cannot publish yielded state', () => {
  const f = fixture(),
    p = prepared(prepare, f);
  assert.equal(commitTaskPlan(fixture().data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  f.data.seed(0x100, [1]);
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), before);
});
test('script argument writes replace saved ID before full fresh bank/header/frame lookups', () => {
  const f = fixture();
  f.context = Object.freeze({ ...f.context, d: 0 });
  word(f, 0, 0x1200);
  word(f, 0x82e9cc, 12);
  for (let n = 0; n < 6; n++) word(f, 0x3f1 + 2 * n, n === 4 ? 0x2000 : n === 5 ? 0 : 0x110 + n);
  const next = scriptOpcodeSpecs.find((s) => s.id === 32);
  word(f, 0x82e9cc + 32, 0);
  word(f, 0x82db28 + 32, next.bank);
  word(f, 0x82ded1 + 64, next.pointer);
  f.data.seed(parseInt(next.entry.replace(':', ''), 16), next.header);
  const p = prepared(bindings.prepareTaskScriptOpcode000, f);
  assert.equal(p.steps[0].id, 0);
  assert.equal(p.steps[0].wordPops, 6);
  assert.equal(
    p.accesses.find((a) => a.label === 'script-pointer-table-WORD-low').address,
    0x82ded1 + 64,
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(value(f, 0x8003d6), next.pointer + 2);
});
test('actual argument DBR differs from bridgeDBR80; frame copies freshly observed bank80 workspace', () => {
  const f = fixture();
  f.context = Object.freeze({ ...f.context, bank: 0x7f });
  word(f, 0x7f01f2, 0x6ff);
  word(f, 0x7f1204, 0);
  word(f, 0x810000, 0xbeef);
  const p = prepared(prepare, f);
  assert.equal(p.outputContext.bank, 0x80);
  assert.equal(p.accesses.find((a) => a.label === 'argument-workspace-low').address, 0x7f0000);
  assert.equal(p.accesses.find((a) => a.label === 'script-frame-argument-copy-low').value, 0xef);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(value(f, 0x7f0000), 0x110);
  assert.equal(value(f, 0x8003fd), 0xbeef);
});
test('preceding opcode effects feed Script52 on one overlay and any further requested handler discards the whole yield', () => {
  const f = fixture();
  f.context = Object.freeze({ ...f.context, x: 0x86 });
  word(f, 0x80f33a, 0xf3e4);
  f.data.seed(0x801204, [0x52, 0, 0, 0x14]);
  const p = prepared(sequence, { ...f, maxHandlers: 2 });
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0x86, 0x52],
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(value(f, 0x8003fd), 0x111);
  const g = fixture();
  g.context = Object.freeze({ ...g.context, x: 0x86 });
  word(g, 0x80f33a, 0xf3e4);
  g.data.seed(0x801204, [0x52, 0, 0, 0x14]);
  unchangedFailure(sequence, g, { maxHandlers: 3 }, 'task_opcode_continuation_source_required');
  unchangedFailure(
    sequence,
    g,
    { maxHandlers: 2, maxWork: p.work - 1 },
    'task_work_budget_required',
  );
  unchangedFailure(
    sequence,
    g,
    { maxHandlers: 2, maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
});
test('unused observation streams and odd argument counts remain no-effect boundaries', () => {
  const f = fixture();
  unchangedFailure(
    prepare,
    f,
    {
      ioMode: 'record-requests',
      ioObservations: Object.freeze([
        Object.freeze({ pc: 0x80f584, address: 0x804216, width: 2, value: 1 }),
      ]),
    },
    'task_io_observation_unused',
  );
  word(f, 0x82e9cc, 1);
  for (let n = 0; n < 30; n++) word(f, 0x3f1 + 2 * n, n);
  unchangedFailure(prepare, f, { maxWork: 50 }, 'task_work_budget_required');
});
for (const s of scriptOpcodeSpecs) {
  test(`Script52 ID${s.id}: separately observed F495 reads original full return metadata and gates only its low byte`, () => {
    const f = taskScriptResumeFixture(),
      address = 0x82e623 + s.id;
    word(f, 0x209, s.id);
    word(f, address, s.returnMetadata);
    const p = prepared(prepareTaskScriptResume, f),
      pushed = (s.returnMetadata & 255) !== 0;
    assert.equal(p.metadataWord, s.returnMetadata);
    assert.equal(p.resultPushed, pushed);
    assert.equal(p.resumeOccurrenceProven, false);
    assert.equal(p.outputContext.s, pushed ? 0x3ee : 0x3f0);
    assert.equal(
      p.accesses.find((a) => a.label === 'resume-return-metadata-WORD-low').address,
      address,
    );
    assert.equal(
      p.accesses.find((a) => a.label === 'resume-return-metadata-WORD-high').address,
      address + 1,
    );
    unchangedFailure(prepareTaskScriptResume, drop(f, address), {}, 'render_source_required');
    unchangedFailure(prepareTaskScriptResume, drop(f, address + 1), {}, 'render_source_required');
    unchangedFailure(
      prepareTaskScriptResume,
      f,
      { maxWork: p.work - 1 },
      'task_work_budget_required',
    );
    unchangedFailure(
      prepareTaskScriptResume,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    if (pushed) assert.equal(value(f, 0x3ef), 0x4567);
  });
}

test('actual later script resume shares physical equation with native resume but uses original script return metadata', () => {
  const f = taskScriptResumeFixture(),
    p = prepared(prepareTaskScriptResume, f),
    g = taskScriptResumeFixture();
  word(g, 0x82d97c, 2);
  const q = prepared(prepareTaskNativeResume, context({ ...g, entry: 0x80f509 }, { pc: 0xf509 }));
  assert.deepEqual(p.outputContext, q.outputContext);
  assert.equal(p.outputContext.s, 0x3ee);
  assert.equal(p.outputContext.y, 5);
  assert.equal(p.outputContext.x, 0x14);
  assert.equal(p.resumeOccurrenceProven, false);
  assert.equal(p.outputContext.bank, 0x80);
  assert.equal(
    p.accesses.find((a) => a.label === 'resume-return-metadata-WORD-low').address,
    0x82e62f,
  );
  unchangedFailure(
    prepareTaskScriptResume,
    drop(taskScriptResumeFixture(), 0x82e630),
    {},
    'render_source_required',
  );
  unchangedFailure(
    prepareTaskScriptResume,
    drop(taskScriptResumeFixture(), 0x801205),
    {},
    'render_source_required',
  );
  unchangedFailure(
    prepareTaskScriptResume,
    f,
    { maxWork: p.work - 1 },
    'task_work_budget_required',
  );
  unchangedFailure(
    prepareTaskScriptResume,
    f,
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
});
test('later script result/PEI/store aliases retain fresh savedPC/pointer/S/metadata reads', () => {
  const f = taskScriptResumeFixture();
  word(f, 0x207, 0x204);
  word(f, 0x800000, 0x9234);
  word(f, 0x80a434, 0xa514);
  const p = prepared(prepareTaskScriptResume, f);
  assert.equal(p.outputContext.y, 0x9235);
  assert.equal(p.outputContext.x, 0x14);
  const g = taskScriptResumeFixture();
  word(g, 0x207, 0x201);
  word(g, 0x800000, 0x9234);
  word(g, 0x809238, 0xa514);
  const q = prepared(prepareTaskScriptResume, g);
  assert.equal(q.outputContext.y, 5);
  assert.equal(q.outputContext.x, 0x14);
  const h = taskScriptResumeFixture();
  word(h, 0x82e62f, 0xff00);
  const r = prepared(prepareTaskScriptResume, h);
  assert.equal(r.resultPushed, false);
  assert.equal(r.outputContext.s, 0x3f0);
});
