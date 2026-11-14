import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { childPropertyBodySpecs } from '../proof/task/script-body-child-property-specs.mjs';
import {
  propertyParentCases,
  propertyParentCalled,
  propertyParentPCs,
  propertyParentSegmentDetails,
} from './task-script-body-child-property-fixtures.mjs';
import {
  scriptBodyFixture,
  bodyWord as word,
  omitBodyBytes as omit,
} from './task-script-body-fixtures.mjs';
import {
  runChildFixture,
  childNextOptions,
  childBodyProbe,
} from './task-script-body-child-fixtures.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyChildEnter as enter,
  prepareTaskScriptBodyChildPostrun as post,
  prepareTaskScriptBodyResume as resume,
  prepareTaskScriptBodyParentResume as parent,
} from '../proof/task/script-bodies.mjs';
import { commit, prepared, unchangedFailure } from './task-native-test-support.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { validateChildBodyEvidence } from './progress.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const s = childPropertyBodySpecs[0];
test('Whole0D1 actualWORD getter/strict property branch owns complete allocated4B versus parent text/input, fresh74 and ownEND', async () => {
  const report = JSON.parse(await readFile('analysis/render-task-script-bodies-child-native.json'));
  for (const v of propertyParentCases()) {
    const called = propertyParentCalled(v),
      { fixture: f, plan: p, segments } = runChildFixture(s, v),
      first = segments[0],
      last = segments.at(-1),
      probe = childBodyProbe(s, v),
      pointer = s.romReads.find((r) => r.address === 0x8db020 + v.index).value;
    assert.equal(p.bodyComplete, true);
    assert.deepEqual(p.bodyPCs, propertyParentPCs(v));
    assert.equal(p.resultWord, 0xbeef);
    assert.equal(p.outputContext.s, 0xb01);
    assert.equal(p.outputContext.d, 0);
    assert.equal(word(f.data, 0xb06), 0x91d0);
    assert.equal(segments.length, called ? 9 : 1);
    assert.equal(first.scriptChildSuspended ?? false, called);
    assert.equal(word(f.data, 0x613), v.index);
    assert.deepEqual(probe.child_segments[0].parent_getter_results, [called ? 0 : 65535]);
    assert.deepEqual(probe.child_segments[0].parent_native_arguments[0], {
      id: 0x42,
      arguments: [2226, v.index],
    });
    assert.ok(first.readAddresses.includes(0x8db021 + v.index));
    if (pointer) assert.ok(first.readAddresses.includes(0x7e0004 + pointer));
    const calls = last.steps.filter((p) => p.calleeEntry),
      c8 = calls.find((p) => p.calleeEntry === 0x80fec1),
      a3 = calls.at(-1);
    assert.equal(c8.arguments.wordPops, 7);
    assert.equal(c8.callee.text.glyphs, called ? 19 : 25);
    assert.equal(c8.callee.text.newlines, 0);
    assert.equal(a3.calleeEntry, 0x80f953);
    assert.equal(a3.callee.iterations, v.repeated ? 2 : 1);
    assert.equal(a3.resultPushed, false);
    assert.equal(last.observationsUsed, 2);
    assert.equal(last.waitObservationsUsed, v.repeated ? 14 : 11);
    assert.equal(last.inputObservationsUsed, v.repeated ? 2 : 1);
    assert.ok(calls.every((n) => n.calleeReturnWord === 0xf508));
    if (called) {
      assert.equal(first.handlersExecuted, 6);
      assert.equal(last.segmentHandlers, 13);
      assert.equal(p.childCompletion, v.heap - 35);
      assert.deepEqual(
        segments
          .slice(3, 8)
          .map(
            (p) =>
              p.accesses.find(
                (a) =>
                  a.kind === 'write' && a.address === 0x800c06 && a.label === 'visit-DBR-WORD-low',
              ).value,
          ),
        [4, 3, 2, 1, 0],
      );
      assert.equal(segments[2].returnTarget, 0x8091d1);
      assert.equal(word(f.data, 0x8003d2), 31);
      assert.equal(p.childPostrun.continuationTarget, 0x80f495);
      assert.equal(p.childPostrun.resultPushed, false);
      assert.equal(word(f.data, 0x800ba4), 0);
      assert.equal(word(f.data, 0x800374), 65535);
      const setter = probe.child_segments.at(-1).parent_native_arguments[0];
      assert.deepEqual(setter.arguments, [v.index, 2226]);
      assert.deepEqual(
        setter.property_writes,
        pointer
          ? [
              [0x7e0003 + pointer, 178],
              [0x7e0004 + pointer, 8],
            ]
          : [],
      );
      assert.equal(first.observationsUsed, 0);
      assert.equal(first.waitObservationsUsed, 0);
      assert.equal(first.inputObservationsUsed, 0);
      const child = segments[7],
        audio = child.steps.find((n) => n.calleeEntry === 0x80c46e);
      assert.equal(audio.arguments.wordPops, 4);
      assert.equal(audio.resultPushed, false);
      const id = child.accesses.findIndex(
          (a) => a.kind === 'write' && a.label === 'saved-ID-low' && a.value === 0x4c,
        ),
        argumentsWritten = child.accesses
          .slice(id)
          .filter((a) => a.kind === 'write' && a.label === 'native-argument-workspace-low');
      assert.deepEqual(
        argumentsWritten.map(
          (a, n) => a.value | (child.accesses[child.accesses.indexOf(a) + 1].value << 8),
        ),
        [65535, 56, 255, 3],
      );
    } else {
      assert.equal(p.childCompletion, undefined);
      assert.equal(word(f.data, 0x8003d2), v.heap);
      assert.equal(
        calls.some((n) => n.calleeEntry === 0x80cbf7),
        false,
      );
    }
    assert.deepEqual(
      report.probes.find((p) => p.script_id === s.id && p.case === v.name),
      probe,
    );
  }
});
test('Parent0D1 getter WORDhigh and each text/final counter/input boundary are required atomically before any commit', () => {
  const v = propertyParentCases()[2],
    f = scriptBodyFixture(s, v),
    p = prepared(start, f),
    pointer = s.romReads.find((r) => r.address === 0x8db030).value;
  unchangedFailure(start, omit(f, 0x7e0004 + pointer), {}, 'render_source_required');
  unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(start, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  for (const [key, reason] of [
    ['ioObservations', 'task_io_observation_required'],
    ['waitObservations', 'task_wait_observation_required'],
    ['inputObservations', 'task_input_observation_required'],
  ])
    for (const n of key === 'ioObservations' ? f[key].map((_, n) => n) : [f[key].length - 1])
      unchangedFailure(start, f, { [key]: menuRecords(f[key].filter((_, k) => k !== n)) }, reason);
  unchangedFailure(
    start,
    f,
    { inputObservations: menuRecords([...f.inputObservations, f.inputObservations.at(-1)]) },
    'task_input_observation_unused',
  );
});
test('Parent0D1 suffix freshly reloads fullWORD local/original pointer after actualChildEND and fails without spending that committed child', () => {
  const v = propertyParentCases()[4],
    f = scriptBodyFixture(s, v);
  let p = commit(start, f);
  p = commit(enter, childNextOptions(s, f, p));
  p = commit(post, childNextOptions(s, f, p));
  for (let n = 0; n < 5; n++) p = commit(resume, childNextOptions(s, f, p));
  const next = childNextOptions(s, f, p),
    q = prepared(parent, next);
  unchangedFailure(parent, next, { maxWork: q.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    parent,
    next,
    { maxOutputBytes: q.outputBytes - 1 },
    'task_output_budget_required',
  );
  for (const [key, reason] of [
    ['ioObservations', 'task_io_observation_required'],
    ['waitObservations', 'task_wait_observation_required'],
    ['inputObservations', 'task_input_observation_required'],
  ])
    unchangedFailure(parent, next, { [key]: menuRecords([]) }, reason);
  const snapshot = f.data.snapshot();
  f.data.seed(0x7e0613, [1, 16]);
  const changed = prepared(parent, next),
    setter = propertyParentSegmentDetails(changed).parent_native_arguments[0];
  assert.deepEqual(setter.arguments, [0x1001, 2226]);
  assert.deepEqual(setter.property_writes, [
    [0x7e00aa, 178],
    [0x7e00ab, 8],
  ]);
  const result = commitTaskPlan(f.data, q);
  assert.equal(result.handled, false);
  assert.equal(word(f.data, 0x800ba4), 65535);
  assert.equal(word(f.data, 0x800374), 4);
  assert.equal(snapshot.bytes.find(([a]) => a === 0x7e0613)[1], 16);
  assert.equal(commitTaskPlan(f.data, changed).handled, true);
  assert.equal(word(f.data, 0x800ba4), 0);
});
test('Parent0D1 canonical source evidence rejects isolated property/argument/result/store/text/ledger drift and missing equality branch', async () => {
  const source = JSON.parse(await readFile('analysis/render-task-script-bodies-child.json')),
    native = JSON.parse(await readFile('analysis/render-task-script-bodies-child-native.json')),
    childSource = JSON.parse(await readFile('analysis/render-task-script-bodies-audio-wait.json')),
    proof = source.proofs.find((p) => p.script_id === s.id),
    child = childSource.proofs.find((p) => p.script_id === 0x4b),
    probes = native.probes.filter((p) => p.script_id === s.id);
  assert.equal(validateChildBodyEvidence(proof, probes, child), undefined);
  const mutate = (change) => {
    const copy = structuredClone(probes);
    change(copy);
    assert.throws(() => validateChildBodyEvidence(proof, copy, child));
  };
  mutate((p) => (p[0].parent_record_index = 0));
  mutate((p) => (p[0].parent_initial_property = 0x18b2));
  mutate((p) => (p[0].child_segments[0].parent_getter_results = [0]));
  mutate((p) => p[0].child_segments[0].parent_native_arguments[0].arguments.reverse());
  mutate((p) => (p[4].child_segments.at(-1).parent_native_arguments[0].property_writes[1][1] ^= 1));
  mutate((p) => p[0].child_segments[0].native_calls[1].glyphs--);
  mutate((p) => p[2].child_segments[0].native_calls[2].iterations--);
  mutate((p) => (p[2].child_segments[0].input_records[1].value = 0));
  mutate((p) => (p[0].child_segments[0].wait_records[2].value = 5));
  mutate((p) => (p[4].child_segments[0].native_calls[0].result_pushed = false));
  assert.throws(
    () =>
      validateChildBodyEvidence(
        proof,
        probes.filter((p) => p.parent_called_child),
        child,
      ),
    /edge/,
  );
});
