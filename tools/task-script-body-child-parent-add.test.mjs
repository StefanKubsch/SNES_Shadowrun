import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import { parentAddCases } from './task-script-body-child-parent-add-fixtures.mjs';
import {
  runChildFixture,
  childBodyProbe,
  childNextOptions,
} from './task-script-body-child-fixtures.mjs';
import { parentWaitSegmentDetails } from './task-script-body-child-parent-wait-fixtures.mjs';
import { scriptBodyFixture, bodyWord as word } from './task-script-body-fixtures.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyParentPostrun as parentPost,
  prepareTaskScriptBodyResume as resume,
  prepareTaskScriptBodyChildEnter as enter,
  prepareTaskScriptBodyChildPostrun as childPost,
  prepareTaskScriptBodyParentResume as parent,
} from '../proof/task/script-bodies.mjs';
import { commit, prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { validateChildBodyEvidence } from './progress.mjs';
const s = scriptBodySpecs.find((s) => s.id === 0x28c);
test('Whole28C owns four real WORD arguments, event128/count0, eight separately fresh BYTE5/7B adds, allocated4B and own late text/END', async () => {
  const native = JSON.parse(await readFile('analysis/render-task-script-bodies-child-native.json'));
  for (const v of parentAddCases()) {
    const { fixture: f, plan: p, segments } = runChildFixture(s, v),
      probe = childBodyProbe(s, v),
      prefix = probe.child_segments.find((p) => p.script_child_suspended),
      sum = v.low + v.reward,
      carry = sum > 65535,
      saturated = carry && v.high === 65535;
    assert.equal(segments.length, v.blocked ? 12 : 11);
    assert.equal(p.bodyComplete, true);
    assert.equal(p.resultWord, 0xbeef);
    assert.deepEqual(
      p.bodyPCs,
      s.instructions.map((i) => i.pc),
    );
    assert.deepEqual(probe.child_segments[0].parent_argument_words, [
      v.input,
      v.text,
      v.reward,
      v.increment,
    ]);
    assert.deepEqual(
      prefix.parent_accumulator_reads,
      Array.from({ length: 8 }, (_, n) => [0x7e3c11, (v.total + n * (v.increment & 255)) & 65535]),
    );
    assert.deepEqual(
      prefix.parent_accumulator_stores,
      Array.from({ length: 8 }, (_, n) => [
        0x7e3c11,
        (v.total + (n + 1) * (v.increment & 255)) & 65535,
      ]),
    );
    assert.equal(word(f.data, 0x7e3c11), (v.total + 8 * (v.increment & 255)) & 65535);
    assert.equal(word(f.data, 0x7e3c0d), saturated ? 65535 : sum & 65535);
    assert.equal(word(f.data, 0x7e3c0f), saturated ? 65535 : (v.high + Number(carry)) & 65535);
    assert.equal(p.childCompletion, v.heap - 35);
    assert.equal(p.childPostrun.continuationTarget, 0x80f495);
    assert.equal(p.childPostrun.resultPushed, false);
    assert.deepEqual(probe.child_segments.at(-1).parent_native_arguments, [
      { id: 0xc8, arguments: [2, 2, 28, 3, 0, v.text, 400] },
    ]);
    assert.equal(p.steps.at(-2).callee.text.glyphs, 10);
    assert.equal(p.outputContext.s, 0xb01);
    assert.equal(word(f.data, 0xb06), 0x91d0);
    assert.deepEqual(
      native.probes.find((p) => p.script_id === s.id && p.case === v.name),
      probe,
    );
  }
});
test('28C mask128 never becomes countdown128; other bits block and fresh wholeC1CA bit8080 resumes the actual parent', () => {
  const f = scriptBodyFixture(s, parentAddCases()[0]);
  let p = commit(start, f);
  p = commit(parentPost, childNextOptions(s, f, p));
  sampleWord(f.data, 0x800c64, 16);
  const next = childNextOptions(s, f, p),
    blocked = commit(resume, next);
  assert.equal(blocked.segmentHandlers, 0);
  assert.equal(blocked.returnTarget, 0x8091d1);
  assert.equal(word(f.data, 0x800c04), 0);
  assert.ok(!blocked.accesses.some((a) => a.kind === 'write' && a.address === 0x800c04));
  assert.equal(word(f.data, 0x800ba4), 128);
  sampleWord(f.data, 0x800c64, 0x8080);
  const ready = commit(resume, childNextOptions(s, f, blocked));
  assert.equal(ready.scriptChildSuspended, true);
  assert.equal(ready.parentReadiness.continuationTarget, 0x80f509);
  assert.equal(ready.parentReadiness.metadataWord, 2);
  assert.equal(ready.parentReadiness.automaticReadiness, false);
  assert.equal(parentWaitSegmentDetails(ready).parent_accumulator_reads.length, 8);
});
test('28C parent text after committed adds/child refetches fullWORDlocal1, preserves previous phases on observation/budget failures and rejects stale plan', () => {
  const v = parentAddCases()[4],
    f = scriptBodyFixture(s, v);
  let p = commit(start, f);
  p = commit(parentPost, childNextOptions(s, f, p));
  sampleWord(f.data, 0x800c64, 128);
  p = commit(resume, childNextOptions(s, f, p));
  p = commit(enter, childNextOptions(s, f, p));
  p = commit(childPost, childNextOptions(s, f, p));
  for (let n = 0; n < 5; n++) p = commit(resume, childNextOptions(s, f, p));
  const next = childNextOptions(s, f, p),
    q = prepared(parent, next);
  unchangedFailure(
    parent,
    next,
    { ioObservations: menuRecords([]) },
    'task_io_observation_required',
  );
  unchangedFailure(
    parent,
    next,
    { waitObservations: menuRecords([]) },
    'task_wait_observation_required',
  );
  unchangedFailure(parent, next, { maxWork: q.work - 1 }, 'task_work_budget_required');
  assert.equal(word(f.data, 0x7e3c11), (v.total + 8 * (v.increment & 255)) & 65535);
  assert.equal(word(f.data, 0x800ba4), 65535);
  sampleWord(f.data, 0x614, 491);
  const fresh = prepared(parent, next);
  assert.deepEqual(parentWaitSegmentDetails(fresh).parent_native_arguments, [
    { id: 0xc8, arguments: [2, 2, 28, 3, 0, 491, 400] },
  ]);
  assert.equal(commitTaskPlan(f.data, q).handled, false);
  assert.equal(commitTaskPlan(f.data, fresh).handled, true);
  assert.equal(word(f.data, 0x800ba4), 0);
});
test('28C canonical rejects borrowed two-wait/counter contract, cached or aggregated additions, argumenthigh/typedreturn/text/heap mutations', async () => {
  const source = JSON.parse(await readFile('analysis/render-task-script-bodies-child.json')),
    native = JSON.parse(await readFile('analysis/render-task-script-bodies-child-native.json')),
    child = JSON.parse(
      await readFile('analysis/render-task-script-bodies-audio-wait.json'),
    ).proofs.find((p) => p.script_id === 0x4b),
    proof = source.proofs.find((p) => p.script_id === s.id),
    probes = native.probes.filter((p) => p.script_id === s.id);
  validateChildBodyEvidence(proof, probes, child);
  const mutation = (change) => {
    const copy = structuredClone(probes);
    change(copy[6]);
    assert.throws(() => validateChildBodyEvidence(proof, copy, child));
  };
  mutation((p) => (p.child_segments[0].parent_argument_words[0] &= 255));
  mutation((p) => (p.child_segments[0].parent_wait_count_write[0] = 128));
  mutation((p) => (p.parent_status_samples[1].value = 16));
  mutation((p) => (p.child_segments[3].parent_result_phas[0] = 16));
  mutation((p) => (p.child_segments[3].parent_accumulator_reads[1][1] = p.parent_initial_total));
  mutation((p) => p.child_segments[3].parent_accumulator_stores.splice(0, 7));
  mutation(
    (p) =>
      (p.child_segments[3].parent_native_arguments[1].arguments[0] = p.parent_increment_argument),
  );
  mutation((p) => p.child_segments[3].native_calls[3].callee_return_word++);
  mutation((p) => p.child_segments.at(-1).parent_native_arguments[0].arguments[5]++);
  mutation((p) => p.child_segments.at(-1).wait_records[0].value++);
  mutation((p) => p.parent_final_total++);
  mutation((p) => p.child_header_result++);
  const altered = structuredClone(proof);
  altered.child_parent_wait_contract.parent_waits[0].mask = 16;
  assert.throws(() => validateChildBodyEvidence(altered, probes, child));
});
