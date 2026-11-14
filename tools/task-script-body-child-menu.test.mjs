import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { childMenuBodySpecs as specs } from '../proof/task/script-body-child-menu-specs.mjs';
import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyChildEnter as enter,
  prepareTaskScriptBodyParentResume as parent,
} from '../proof/task/script-bodies.mjs';
import { scriptBodyFixture as fixture, bodyWord as word } from './task-script-body-fixtures.mjs';
import {
  childBodyCases,
  childNextOptions,
  runChildFixture,
  childBodyProbe,
} from './task-script-body-child-fixtures.mjs';
import { modalBodyPCs } from './task-script-body-modal-fixtures.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { validateChildBodyEvidence } from './progress.mjs';
const child = scriptBodySpecs.find((s) => s.id === 0xc8);
for (const s of specs)
  test(`Whole${s.id.toString(16)} proves own threeWORD arguments, allocated0C8 menu/payment/text/record/END and actual parent release`, async () => {
    const report = JSON.parse(
      await readFile('analysis/render-task-script-bodies-child-native.json'),
    );
    for (const v of childBodyCases(s)) {
      const { fixture: f, plan: p, segments } = runChildFixture(s, v),
        [prefix, c, finish] = segments,
        args = s.instructions
          .slice(0, 3)
          .map((i) => i.operand)
          .reverse(),
        [record, price] = args,
        funded = v.low >= price || (v.high ?? 0) !== 0,
        paid = v.confirm && funded;
      assert.equal(segments.length, 3);
      assert.equal(prefix.parentEntry.interpreterEntryExecuted, true);
      assert.equal(prefix.steps.at(-1).wordPops, 3);
      assert.equal(prefix.segmentHandlers, 4);
      assert.equal(prefix.bodyComplete, false);
      assert.equal(prefix.scriptChildSuspended, true);
      assert.equal(prefix.childFrame, 0x3d6);
      assert.equal(prefix.childSlot, 4);
      assert.equal(prefix.parentSlot, 2);
      assert.equal(c.childEntry.interpreterEntryExecuted, true);
      assert.equal(c.bodyComplete, true);
      assert.equal(c.scriptId, 0xc8);
      assert.deepEqual(c.bodyPCs, modalBodyPCs(child, v));
      assert.equal(c.resultWord, v.heap - 37);
      assert.deepEqual(
        c.accesses.filter((a) => a.label.startsWith('END-result-PLA-')).map((a) => a.address),
        [0x3f7, 0x3f8],
      );
      assert.deepEqual(
        [0x3e9, 0x3eb, 0x3ed].map((a) => word(f.data, a)),
        args,
      );
      assert.equal(word(f.data, 0x7e3c0d), paid ? (v.low - price) & 65535 : v.low);
      assert.equal(
        word(f.data, 0x7e3c0f),
        paid ? ((v.high ?? 0) - Number(v.low < price)) & 65535 : (v.high ?? 0),
      );
      const calls = c.steps.filter((n) => n.calleeEntry),
        targets = paid
          ? [0x80cd43, 0x80cd20, 0x80cdcf, 0x80cbb3]
          : v.confirm
            ? [0x80cd43, 0x80cd20, 0x80933a]
            : [0x80cd43, 0x80933a];
      assert.deepEqual(
        calls.map((n) => n.calleeEntry),
        targets,
      );
      assert.ok(
        calls.every((n) => n.calleeReturnWord === 0xf508 && n.calleeReturnTarget === 0x80f509),
      );
      if (paid) {
        assert.equal(word(f.data, 0x801d63), 65535);
        const pointer = child.romReads.find((r) => r.address === 0x8db020 + record).value,
          read = c.accesses.find(
            (a) =>
              a.kind === 'read' &&
              a.label === 'leaf-record-BYTE' &&
              a.address === 0x7e0001 + pointer,
          );
        assert.ok(read);
        assert.equal(f.data.readByte(0x7e0001 + pointer).value, read.value | 128);
        assert.ok(
          c.accesses.some(
            (a) =>
              a.kind === 'read' &&
              a.address === 0x8db021 + record &&
              a.label === 'leaf-long-WORD-high',
          ),
        );
      }
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.outputContext.s, 0xb01);
      assert.equal(p.outputContext.d, 0);
      assert.equal(word(f.data, 0xb06), 0x91d0);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.deepEqual(
        p.bodyPCs,
        s.instructions.map((i) => i.pc),
      );
      assert.equal(finish.childCompletion, v.heap - 37);
      assert.equal(finish.childPostrun.continuationTarget, 0x80f495);
      assert.equal(finish.childPostrun.metadataWord, 0);
      assert.equal(finish.childPostrun.resultPushed, false);
      assert.equal(finish.segmentHandlers, 1);
      assert.equal(word(f.data, 0x8003d2), 33);
      assert.equal(word(f.data, 0x80024e), 4);
      assert.equal(word(f.data, 0x80024c), 2);
      assert.equal(word(f.data, 0x800ba4), 0);
      assert.equal(word(f.data, 0x800374), 65535);
      assert.deepEqual(
        report.probes.find((p) => p.script_id === s.id && p.case === v.name),
        childBodyProbe(s, v),
      );
    }
  });
test('Committed threeWORD parent survives late menu/audio/text/record source, typed observations and nested return/budget faults', () => {
  const s = specs.find((s) => s.id === 0x16a),
    v = childBodyCases(s).find((v) => v.name === 'exact-price-heap-400'),
    f = fixture(s, v),
    p = prepared(start, f),
    next = childNextOptions(s, f, p);
  unchangedFailure(enter, next, {}, 'task_script_body_child_continuation_required');
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  unchangedFailure(
    enter,
    { ...next, continuation: { ...p } },
    {},
    'task_script_body_child_continuation_required',
  );
  const q = prepared(enter, next);
  for (const [key, reason] of [
    ['ioObservations', 'task_io_observation_required'],
    ['waitObservations', 'task_wait_observation_required'],
    ['inputObservations', 'task_input_observation_required'],
  ]) {
    unchangedFailure(enter, next, { [key]: menuRecords(next[key].slice(0, -1)) }, reason);
    unchangedFailure(
      enter,
      next,
      { [key]: menuRecords([...next[key], next[key].at(-1)]) },
      reason.replace('_required', '_unused'),
    );
  }
  unchangedFailure(
    enter,
    next,
    {
      inputObservations: menuRecords(
        next.inputObservations.map((r, n) => (n ? r : { ...r, value: 0x3030 })),
      ),
    },
    'task_reset_source_required',
  );
  unchangedFailure(enter, next, { maxWork: q.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    enter,
    next,
    { maxOutputBytes: q.outputBytes - 1 },
    'task_output_budget_required',
  );
  const lookup = 0x8db020 + s.instructions[2].operand,
    n = f.data.readByte(lookup + 1).value;
  f.data.seed(lookup + 1, [n ^ 1]);
  unchangedFailure(enter, next, {}, 'task_script_body_bytes_required');
  f.data.seed(lookup + 1, [n]);
  const before = f.data.snapshot();
  assert.deepEqual(commitTaskPlan(f.data, q), { handled: false, reason: 'task_plan_stale' });
  assert.deepEqual(f.data.snapshot(), before);
  const done = commit(enter, next),
    last = childNextOptions(s, f, done),
    r = prepared(parent, last);
  unchangedFailure(parent, last, { waitObservations: f.childWait }, 'task_wait_observation_unused');
  unchangedFailure(
    parent,
    last,
    { inputObservations: f.childInput },
    'task_input_observation_unused',
  );
  unchangedFailure(parent, last, { maxWork: r.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    parent,
    last,
    { maxOutputBytes: r.outputBytes - 1 },
    'task_output_budget_required',
  );
  const metadata = 0x82e623 + 0xc8,
    old = f.data.readByte(metadata + 1).value;
  f.data.seed(metadata + 1, [old ^ 1]);
  unchangedFailure(parent, last, {}, 'task_script_body_bytes_required');
  f.data.seed(metadata + 1, [old]);
});
test('Child0C8 cancellation reads fresh copied local text WORD and fresh heapheader high without cached result or parent PHA', () => {
  const s = specs[0],
    v = childBodyCases(s).find((v) => v.name === 'cancel-funded-heap-800'),
    f = fixture(s, v),
    p = commit(start, f);
  // Independently declared current physical samples, no original external writer inferred.
  f.data.seed(0x3f8, [0xe0]);
  const q = commit(enter, childNextOptions(s, f, p));
  assert.equal(q.resultWord, 0xe0db);
  assert.equal(word(f.data, 0x3ed), 405);
  assert.ok(
    q.accesses.some(
      (a) =>
        a.kind === 'read' && a.label === 'local-WORD-high' && a.address === 0x3ee && a.value === 1,
    ),
  );
  const r = commit(parent, childNextOptions(s, f, q));
  assert.equal(r.childCompletion, 0xe0db);
  assert.equal(r.resultWord, 0xbeef);
  assert.equal(r.childPostrun.resultPushed, false);
});
test('Canonical child0C8 admission rejects wrong original prices/args/pointer/payment/branch/return and uncoupled input evidence', async () => {
  const source = JSON.parse(await readFile('analysis/render-task-script-bodies-child.json')),
    native = JSON.parse(await readFile('analysis/render-task-script-bodies-child-native.json')),
    childSource = JSON.parse(
      await readFile('analysis/render-task-script-bodies-modal.json'),
    ).proofs.find((p) => p.script_id === 0xc8);
  for (const s of specs) {
    const proof = source.proofs.find((p) => p.script_id === s.id),
      probes = native.probes.filter((p) => p.script_id === s.id);
    validateChildBodyEvidence(proof, probes, childSource);
    const at = probes.findIndex((p) => p.case === 'exact-price-heap-800');
    for (const mutate of [
      (p) => (p.child_local_words[1] = p.child_local_words[1] === 100 ? 101 : 100),
      (p) => (p.child_argument_words[0] ^= 1),
      (p) => (p.child_record_pointer ^= 0x100),
      (p) => (p.child_currency_low ^= 1),
      (p) => (p.child_currency_high = 1),
      (p) => (p.child_record_flag = 0),
      (p) => (p.child_record_flag ^= 1),
      (p) => (p.child_record_flag = 0x180),
      (p) => (p.child_segments[1].native_calls[1].callee_return_word ^= 0x100),
      (p) => (p.child_segments[1].input_records[0].address = 0x8001cc),
      (p) => p.child_segments[1].body_pcs.splice(-2, 1),
      (p) => (p.child_header_result ^= 1),
      (p) => {
        p.child_segments[1].input_records = [];
        p.child_segments[1].input_observations_used = 0;
        p.child_segments[1].native_calls[0].input_observations_used = 0;
      },
    ]) {
      const changed = structuredClone(probes);
      mutate(changed[at]);
      assert.throws(() => validateChildBodyEvidence(proof, changed, childSource));
    }
    assert.throws(() =>
      validateChildBodyEvidence(
        proof,
        probes.filter((p) => p.child_confirm && p.child_initial_low >= s.instructions[1].operand),
        childSource,
      ),
    );
  }
});
