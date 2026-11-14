import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import {
  scriptBodyFixture,
  bodyCases,
  bodyWord,
  omitBodyBytes,
} from './task-script-body-fixtures.mjs';
import {
  runWaitBodyFixture,
  waitBodyProbe,
  resumeBodyFixture,
} from './task-script-body-wait-fixtures.mjs';
import { actionsWaitPCs } from './task-script-body-actions-wait-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
const spec = scriptBodySpecs.find((s) => s.id === 0x2ab);
test('Whole original2AB: each original branch to complete menu or real Native9F suspension/readiness/result-PHA/END, with individual local/fetch sources', async () => {
  const source = JSON.parse(await readFile('analysis/render-task-script-bodies-actions-wait.json')),
    report = JSON.parse(
      await readFile('analysis/render-task-script-bodies-actions-wait-native.json'),
    ),
    seen = new Set();
  assert.equal(source.proofs.length, 1);
  assert.equal(source.proofs[0].body_control_flow_complete, true);
  assert.deepEqual(spec.header, [5, 4]);
  assert.equal(spec.argumentBytes, 4);
  assert.equal(spec.returnBytes, 2);
  for (const variant of bodyCases(spec)) {
    const f = scriptBodyFixture(spec, variant),
      first = prepared(start, f),
      menuPath = Boolean(variant.enabled & 255),
      all = runWaitBodyFixture(spec, variant),
      { plan: p, segments } = all;
    assert.equal(first.bodyComplete, menuPath);
    assert.equal(p.bodyComplete, true);
    assert.equal(p.fullTaskBinding, false);
    assert.deepEqual(p.bodyPCs, actionsWaitPCs(variant));
    assert.equal(p.handlersExecuted, p.bodyPCs.length);
    assert.equal(p.resultWord, menuPath ? variant.result : variant.event);
    assert.equal(p.returnTarget, 0x80c20b);
    assert.equal(p.targetExecuted, false);
    assert.equal(p.outputContext.s, menuPath ? 0xb01 : 0xaff);
    assert.equal(bodyWord(all.fixture.data, 0x7e0616), p.resultWord);
    assert.equal(all.fixture.data.readByte(0x7e0613).value, variant.enabled & 255);
    assert.equal(bodyWord(all.fixture.data, 0x7e0614), variant.flags ?? 0);
    if (menuPath) {
      assert.equal(segments.length, 1);
      assert.equal(p.inputObservationsUsed, 2);
      assert.equal(
        p.steps.some((s) => s.calleeEntry === 0x80c401),
        false,
      );
      const menu = p.steps.find((s) => s.calleeEntry === 0x809ba0);
      assert.equal(menu.arguments.wordPops, 1);
      assert.equal(menu.callee.nativeResult, variant.result);
      assert.equal(menu.calleeReturnWord, 0xf508);
      assert.equal(menu.metadataWord, 2);
      assert.equal(menu.resultPushed, true);
    } else {
      assert.equal(first.bodySuspended, true);
      assert.equal(first.savedContinuationWord, 0xf508);
      assert.equal(first.arguments, undefined);
      assert.equal(first.steps.at(-1).wordPops, 2);
      assert.equal(first.frontier, 'actual-native-wait-yield-target');
      assert.equal(p.observedReadinessEntries, 1);
      assert.equal(segments.length, 2);
      assert.equal(first.segmentHandlers, 7);
      assert.equal(p.segmentHandlers, 3);
      assert.deepEqual(
        all.observations
          .filter((o) => o.kind === 'synthetic-provider-event-byte')
          .map((o) => o.value),
        [variant.event],
      );
      assert.equal(bodyWord(all.fixture.data, 0x800ba4), 0);
      assert.equal(bodyWord(all.fixture.data, 0x800c04), 0);
    }
    for (let n = 1; n < p.bodyPCs.length; n++) seen.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
    assert.deepEqual(
      report.probes.find((p) => p.script_id === spec.id && p.case === variant.name),
      waitBodyProbe(spec, variant),
    );
  }
  assert.deepEqual([...seen].sort(), spec.edges.map((e) => e.from + ':' + e.to).sort());
});
test('Original2AB: uncommitted/forged prefixes, blocked Carry and current branded owner; no input/timer inferred from mask90', () => {
  const f = scriptBodyFixture(spec, { enabled: 0, event: 16 }),
    prefix = prepared(start, f);
  assert.equal(prefix.bodyComplete, false);
  const options = resumeBodyFixture(spec, f, prefix);
  unchangedFailure(resume, f, options, 'task_script_body_continuation_required');
  assert.equal(commitTaskPlan(f.data, prefix).handled, true);
  assert.equal(bodyWord(f.data, 0x800ba4), 0x90);
  assert.equal(bodyWord(f.data, 0x800c64), 0);
  unchangedFailure(
    resume,
    f,
    { ...options, continuation: { ...prefix } },
    'task_script_body_continuation_required',
  );
  const wait = menuRecords([{ pc: 0x81acbd, address: 0x8001f6, width: 2, value: 0 }]),
    input = menuRecords([{ pc: 0x809e1a, address: 0x8001ca, width: 2, value: 32 }]);
  unchangedFailure(
    resume,
    f,
    { ...options, waitObservations: wait },
    'task_wait_observation_unused',
  );
  unchangedFailure(
    resume,
    f,
    { ...options, inputObservations: input },
    'task_input_observation_unused',
  );
  const blocked = prepared(resume, options);
  assert.equal(blocked.bodyComplete, false);
  assert.equal(blocked.bodySuspended, true);
  assert.equal(blocked.segmentHandlers, 0);
  assert.equal(blocked.observedReadinessEntries, 1);
  assert.equal(bodyWord(f.data, 0x800ba4), 0x90);
  assert.equal(commitTaskPlan(f.data, blocked).handled, true);
  unchangedFailure(resume, f, options, 'task_script_body_continuation_required');
  const later = resumeBodyFixture(spec, f, blocked);
  f.data.seed(0x800c64, [1, 0]);
  const unrelated = prepared(resume, later);
  assert.equal(unrelated.bodyComplete, false);
  assert.equal(unrelated.segmentHandlers, 0);
  assert.equal(unrelated.observedReadinessEntries, 2);
  assert.equal(commitTaskPlan(f.data, unrelated).handled, true);
  const readyOptions = resumeBodyFixture(spec, f, unrelated);
  f.data.seed(0x800c64, [16, 0]);
  const complete = prepared(resume, readyOptions);
  assert.equal(complete.bodyComplete, true);
  assert.equal(complete.resultWord, 16);
  assert.equal(complete.observedReadinessEntries, 3);
  assert.equal(commitTaskPlan(f.data, complete).handled, true);
  assert.equal(bodyWord(f.data, 0x7e0616), 16);
});
test('Original2AB: source highs, exact global menu budgets and late reset or resumed END failure never publish partial effects', () => {
  const variant = { enabled: 1, flags: 16, held: 16, result: 16 },
    f = scriptBodyFixture(spec, variant),
    p = prepared(start, f);
  for (let n = 0; n < spec.bytecode.length + 3; n++)
    unchangedFailure(start, omitBodyBytes(f, spec.scriptEntry + n), {}, 'render_source_required');
  for (const address of [0x82d7df, 0x82da60, 0x82d984, 0x7e0602, 0x7e0803])
    unchangedFailure(start, omitBodyBytes(f, address), {}, 'render_source_required');
  unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(start, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  unchangedFailure(start, f, { maxHandlers: 11 }, 'task_script_body_handler_count_required');
  prepared(start, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(
    start,
    f,
    {
      inputObservations: menuRecords([
        f.inputObservations[0],
        { ...f.inputObservations[1], value: 0x3030 },
      ]),
    },
    'task_reset_source_required',
  );
  const waiting = scriptBodyFixture(spec, { enabled: 0, event: 128 }),
    prefix = prepared(start, waiting);
  assert.equal(commitTaskPlan(waiting.data, prefix).handled, true);
  const next = resumeBodyFixture(spec, waiting, prefix);
  waiting.data.seed(0x800c64, [128, 0]);
  const full = prepared(resume, next);
  unchangedFailure(
    resume,
    waiting,
    { ...next, maxWork: full.work - 1 },
    'task_work_budget_required',
  );
  unchangedFailure(
    resume,
    waiting,
    { ...next, maxOutputBytes: full.outputBytes - 1 },
    'task_output_budget_required',
  );
  waiting.data.seed((spec.scriptEntry + 2 + 30) & 0xffffff, [0x14]);
  const before = waiting.data.snapshot(),
    bad = resume(next);
  assert.equal(bad.handled, false);
  assert.equal(bad.reason, 'task_script_body_bytes_required');
  assert.equal(bad.byteWrites, undefined);
  assert.deepEqual(waiting.data.snapshot(), before);
});
