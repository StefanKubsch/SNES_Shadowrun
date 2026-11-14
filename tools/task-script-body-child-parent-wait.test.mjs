import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { childParentWaitBodySpecs as specs } from '../proof/task/script-body-child-parent-wait-specs.mjs';
import {
  parentWaitCases,
  parentWaitChoice,
  parentWaitPCs,
  parentWaitText,
  parentWaitReward,
} from './task-script-body-child-parent-wait-fixtures.mjs';
import {
  scriptBodyFixture,
  bodyWord as word,
  omitBodyBytes as omit,
} from './task-script-body-fixtures.mjs';
import {
  childBodyProbe,
  runChildFixture,
  childNextOptions,
} from './task-script-body-child-fixtures.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyParentPostrun as parentPost,
  prepareTaskScriptBodyResume as resume,
  prepareTaskScriptBodyChildEnter as enter,
  prepareTaskScriptBodyChildPostrun as childPost,
  prepareTaskScriptBodyParentResume as finish,
} from '../proof/task/script-bodies.mjs';
import { commit, prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { validateChildBodyEvidence } from './progress.mjs';
for (const s of specs)
  test(`Whole${s.id.toString(16)} owns actual parent9F C1CA/C1D8/C20B/C1D9, count1/event0010 and allocated4B/reward/B9/END`, async () => {
    const native = JSON.parse(
      await readFile('analysis/render-task-script-bodies-child-native.json'),
    );
    for (const v of parentWaitCases()) {
      const { fixture: f, plan: p, segments, statusSamples } = runChildFixture(s, v),
        first = segments[0],
        prefix = segments.find((p) => p.scriptChildSuspended),
        rootEvents = v.blocked ? [0, 16] : [16],
        children = segments.filter((p) => p.scriptId === 0x4b),
        reward = parentWaitReward(s, v),
        sum = v.low + reward,
        carry = sum > 65535,
        saturated = carry && v.high === 65535,
        low = saturated ? 65535 : sum & 65535,
        high = saturated ? 65535 : (v.high + Number(carry)) & 65535;
      assert.equal(segments.length, v.blocked ? 14 : 13);
      assert.deepEqual(p.bodyPCs, parentWaitPCs(s, v));
      assert.equal(p.bodyComplete, true);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(first.segmentHandlers, 12);
      assert.equal(first.parentEntry.interpreterEntryExecuted, true);
      assert.equal(first.nextPC, 19);
      assert.equal(word(f.data, 0x614), parentWaitChoice(v));
      assert.equal(word(f.data, 0x616), parentWaitText(s, v));
      assert.equal(segments[1].parentPostrunReturned, true);
      assert.equal(segments[1].returnTarget, 0x8091d1);
      assert.equal(segments[1].outputContext.s, 0xb07);
      assert.ok(
        segments[1].accesses.some(
          (a) => a.label.includes('parent-actual-C1CA-JSR-body') && a.value === 0xd8,
        ),
      );
      assert.equal(segments[2].parentReadiness.continuationTarget, 0x80f509);
      assert.equal(segments[2].parentReadiness.metadataWord, 2);
      assert.equal(segments[2].nextPC, 28);
      assert.equal(segments[2].parentReadiness.resultPushed, true);
      assert.equal(segments[3].parentPostrunReturned, true);
      assert.deepEqual(
        statusSamples.map((r) => r.value),
        rootEvents,
      );
      assert.ok(statusSamples.every((r) => r.synthetic && r.address === 0x800c64));
      if (v.blocked) {
        assert.equal(segments[4].segmentHandlers, 0);
        assert.equal(segments[4].returnTarget, 0x8091d1);
        assert.ok(!segments[4].accesses.some((a) => a.kind === 'write' && a.address === 0x800c04));
        assert.equal(segments[4].observationsUsed, 0);
      }
      assert.equal(prefix.parentReadiness.continuationTarget, 0x80f509);
      assert.equal(prefix.parentReadiness.automaticReadiness, false);
      assert.equal(prefix.steps.at(-2).callee.text.glyphs, 10);
      assert.equal(prefix.observationsUsed, 2);
      assert.equal(prefix.waitObservationsUsed, 10);
      assert.equal(children.length, 7);
      assert.deepEqual(
        children
          .slice(2)
          .map(
            (p) =>
              p.accesses.find(
                (a) =>
                  a.kind === 'write' && a.address === 0x800c06 && a.label === 'visit-DBR-WORD-low',
              ).value,
          ),
        [4, 3, 2, 1, 0],
      );
      assert.equal(p.childCompletion, v.heap - 35);
      assert.equal(p.childPostrun.continuationTarget, 0x80f495);
      assert.equal(p.childPostrun.resultPushed, false);
      assert.equal(word(f.data, 0x7e3c0d), low);
      assert.equal(word(f.data, 0x7e3c0f), high);
      assert.equal(word(f.data, 0x8012a0 + (v.input & 255)), 0);
      assert.equal(p.outputContext.s, 0xb01);
      assert.equal(p.outputContext.d, 0);
      assert.equal(word(f.data, 0xb06), 0x91d0);
      assert.equal(word(f.data, 0x800ba4), 0);
      assert.equal(word(f.data, 0x800374), 65535);
      assert.equal(word(f.data, 0x8003d2), 31);
      assert.deepEqual(
        native.probes.find((p) => p.script_id === s.id && p.case === v.name),
        childBodyProbe(s, v),
      );
    }
  });
test('Parentwait private caller brands require actual latest committed parent prefix/postrun, fresh C1D8 and wholeC1CA entry', () => {
  const s = specs[0],
    v = parentWaitCases()[0],
    f = scriptBodyFixture(s, v),
    p = prepared(start, f),
    next = childNextOptions(s, f, p);
  unchangedFailure(parentPost, next, {}, 'task_script_body_parent_wait_continuation_required');
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  unchangedFailure(
    resume,
    { ...next, entry: 0x80c1ca, context: Object.freeze({ ...next.context, pc: 0xc1ca, s: 0xb05 }) },
    {},
    'task_script_body_parent_postrun_required',
  );
  unchangedFailure(childPost, next, {}, 'task_script_body_child_continuation_required');
  unchangedFailure(
    parentPost,
    { ...next, continuation: { ...p } },
    {},
    'task_script_body_parent_wait_continuation_required',
  );
  for (const address of [0x601, 0x603, 0x609, 0x800255, 0x8002b5, 0x800ba5]) {
    const old = f.data.readByte(address).value;
    f.data.seed(address, [old ^ 1]);
    unchangedFailure(parentPost, next, {}, 'task_script_body_parent_wait_owner_required');
    f.data.seed(address, [old]);
  }
  const raw = f.data.readByte(0xb03).value;
  f.data.seed(0xb03, [raw ^ 1]);
  unchangedFailure(parentPost, next, {}, 'task_script_body_parent_caller_return_required');
  f.data.seed(0xb03, [raw]);
  const q = prepared(parentPost, next);
  unchangedFailure(parentPost, next, { maxWork: q.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    parentPost,
    next,
    { maxOutputBytes: q.outputBytes - 1 },
    'task_output_budget_required',
  );
  unchangedFailure(
    parentPost,
    next,
    { ioObservations: f.ioObservations },
    'task_io_observation_unused',
  );
  assert.equal(commitTaskPlan(f.data, q).handled, true);
  const ready = childNextOptions(s, f, q);
  unchangedFailure(
    resume,
    { ...ready, entry: 0x80c1f9, context: Object.freeze({ ...ready.context, pc: 0xc1f9, x: 2 }) },
    {},
    'task_entry_required',
  );
  unchangedFailure(
    resume,
    ready,
    { context: Object.freeze({ ...ready.context, s: ready.context.s - 2 }) },
    'task_script_body_parent_wait_owner_required',
  );
  assert.equal(commit(resume, ready).nextPC, 28);
  unchangedFailure(parentPost, next, {}, 'task_script_body_parent_wait_continuation_required');
});
test('Parent event readiness never decrements Count0, accepts independently changed fullWORD event bits and preserves prior commits on text failure', () => {
  const s = specs[1],
    f = scriptBodyFixture(s, parentWaitCases()[2]);
  let p = commit(start, f);
  p = commit(parentPost, childNextOptions(s, f, p));
  p = commit(resume, childNextOptions(s, f, p));
  p = commit(parentPost, childNextOptions(s, f, p));
  const blocked = childNextOptions(s, f, p),
    b = prepared(resume, {
      ...blocked,
      ioObservations: menuRecords([]),
      waitObservations: menuRecords([]),
    });
  assert.equal(b.segmentHandlers, 0);
  assert.equal(b.parentReadiness.returnTarget, 0x8091d1);
  assert.equal(word(f.data, 0x800c04), 0);
  assert.ok(!b.accesses.some((a) => a.kind === 'write' && a.address === 0x800c04));
  assert.equal(commitTaskPlan(f.data, b).handled, true);
  const next = childNextOptions(s, f, b);
  sampleWord(f.data, 0x800c64, 1);
  const unrelated = commit(resume, {
    ...next,
    ioObservations: menuRecords([]),
    waitObservations: menuRecords([]),
  });
  assert.equal(unrelated.segmentHandlers, 0);
  assert.equal(word(f.data, 0x800ba4), 16);
  assert.equal(word(f.data, 0x800c04), 0);
  sampleWord(f.data, 0x800c64, 0x8010);
  const ready = childNextOptions(s, f, unrelated),
    q = prepared(resume, ready);
  unchangedFailure(
    resume,
    ready,
    { ioObservations: menuRecords([]) },
    'task_io_observation_required',
  );
  unchangedFailure(
    resume,
    ready,
    { waitObservations: menuRecords([]) },
    'task_wait_observation_required',
  );
  unchangedFailure(resume, ready, { maxWork: q.work - 1 }, 'task_work_budget_required');
  assert.equal(word(f.data, 0x8003d2), 0x800);
  assert.equal(word(f.data, 0x800ba4), 16);
  assert.equal(commitTaskPlan(f.data, q).handled, true);
  assert.equal(q.scriptChildSuspended, true);
  assert.equal(word(f.data, 0x800ba4), 65535);
  assert.equal(word(f.data, 0x800c04), 0);
});
test('Parentwait source/canonical coupling rejects isolated phase/mask/count/status/Native9F/typedreturn/reward/IO/heap mutations', async () => {
  const source = JSON.parse(await readFile('analysis/render-task-script-bodies-child.json')),
    native = JSON.parse(await readFile('analysis/render-task-script-bodies-child-native.json')),
    audio = JSON.parse(await readFile('analysis/render-task-script-bodies-audio-wait.json')),
    child = audio.proofs.find((p) => p.script_id === 0x4b);
  for (const s of specs) {
    const proof = source.proofs.find((p) => p.script_id === s.id),
      probes = native.probes.filter((p) => p.script_id === s.id);
    assert.equal(validateChildBodyEvidence(proof, probes, child), undefined);
    const mutation = (change) => {
      const copy = structuredClone(probes);
      change(copy[2]);
      assert.throws(() => validateChildBodyEvidence(proof, copy, child));
    };
    mutation((p) => (p.child_segments[0].parent_argument_word ^= 256));
    mutation((p) => (p.child_segments[0].parent_wait_mask_write[0] = 16));
    mutation((p) => p.child_segments[0].parent_native_arguments[1].arguments[0]++);
    mutation((p) => (p.child_segments[1].parent_postrun_returned = false));
    mutation((p) => (p.child_segments[2].parent_readiness.metadataWord ^= 256));
    mutation((p) => (p.child_segments[2].parent_wait_count_write[0] = 16));
    mutation((p) => p.child_segments[2].native_calls[2].saved_continuation_word++);
    mutation((p) => (p.child_segments[4].parent_countdown = 65535));
    mutation((p) => (p.parent_status_samples[1].value = 1));
    mutation((p) => (p.child_segments[5].parent_result_phas[0] = 1));
    mutation((p) => p.child_segments[5].native_calls.at(-1).word_pops--);
    mutation((p) => (p.child_segments[5].wait_records[0].value = 1));
    mutation((p) => p.parent_currency_high++);
    mutation((p) => p.child_segments.at(-1).parent_native_arguments[0].arguments[0]++);
    mutation((p) => p.child_header_result++);
    assert.throws(
      () =>
        validateChildBodyEvidence(
          proof,
          probes.filter((p) =>
            s.id === 0x15c ? [2, 3].includes(p.parent_counter_low) : p.parent_counter_low !== 1,
          ),
          child,
        ),
      /edge/,
    );
  }
});
