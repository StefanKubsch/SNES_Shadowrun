import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { childCountdownBodySpecs } from '../proof/task/script-body-child-countdown-specs.mjs';
import {
  scriptBodyFixture as fixture,
  bodyWord as word,
  omitBodyBytes as omit,
} from './task-script-body-fixtures.mjs';
import {
  childBodyCases,
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
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { validateChildBodyEvidence } from './progress.mjs';
const specs = childCountdownBodySpecs.filter((s) => !s.countdownBranchParent),
  at = (id) => specs.find((s) => s.id === id),
  put = (f, a, n) => f.data.seed(a, [n & 255, n >>> 8]);
function yielded(s, f) {
  let p = commit(start, f);
  p = commit(enter, childNextOptions(s, f, p));
  return commit(post, childNextOptions(s, f, p));
}
for (const s of specs)
  test(`Whole${s.id.toString(16)} proves own BYTE caller, actual allocated child countdown/return/record or entity release and parent END`, async () => {
    const report = JSON.parse(
      await readFile('analysis/render-task-script-bodies-child-native.json'),
    );
    for (const v of childBodyCases(s)) {
      const { fixture: f, plan: p, segments } = runChildFixture(s, v),
        record = s.childId === 0x6f,
        count = record ? 1 : 2,
        frame = record ? 29 : 28,
        first = segments[0],
        child = segments.at(-2),
        ready = segments.slice(3, -1);
      assert.equal(segments.length, count + 4);
      assert.equal(first.scriptChildSuspended, true);
      assert.equal(first.childFrame, 0x3d6);
      assert.equal(first.steps.at(-1).wordPops, 1);
      assert.equal(first.parentSlot, 2);
      assert.equal(first.childSlot, 4);
      assert.equal(f.data.readByte(0x613).value, v.input & 255);
      const copied = new Map(first.byteWrites),
        argumentAddress = 0x7e03d6 + frame - 2;
      assert.equal(
        copied.get(argumentAddress) | (copied.get(argumentAddress + 1) << 8),
        record ? 5978 : v.input & 255,
      );
      assert.equal(segments[1].bodySuspended, true);
      assert.equal(segments[1].segmentHandlers, 4);
      assert.equal(segments[2].childPostrunReturned, true);
      assert.equal(segments[2].returnTarget, 0x8091d1);
      assert.equal(segments[2].outputContext.s, 0xb07);
      assert.deepEqual(
        ready.map((p) => p.observedReadinessEntries),
        Array.from({ length: count }, (_, i) => i + 1),
      );
      assert.deepEqual(
        ready.map((p) => p.segmentHandlers),
        record ? [5] : [0, 6],
      );
      assert.ok(
        ready.every((p) =>
          p.accesses.some((a) => a.kind === 'write' && a.address === 0x800250 && a.value === 4),
        ),
      );
      assert.equal(child.bodyComplete, true);
      assert.equal(child.resultWord, v.heap - frame - 4);
      assert.deepEqual(
        child.accesses.filter((a) => a.label.startsWith('END-result-PLA-')).map((a) => a.address),
        [0x3d6 + frame, 0x3d7 + frame],
      );
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.childCompletion, child.resultWord);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.outputContext.s, 0xb01);
      assert.equal(p.outputContext.d, 0);
      assert.equal(word(f.data, 0xb06), 0x91d0);
      assert.equal(p.childPostrun.continuationTarget, 0x80f495);
      assert.equal(p.childPostrun.metadataWord, 0);
      assert.equal(p.childPostrun.resultPushed, false);
      assert.deepEqual(
        p.bodyPCs,
        s.instructions.map((i) => i.pc),
      );
      assert.equal(word(f.data, 0x8003d2), frame);
      assert.equal(word(f.data, 0x80024e), 4);
      assert.equal(word(f.data, 0x80024c), 2);
      assert.equal(word(f.data, 0x800ba4), 0);
      assert.equal(word(f.data, 0x800374), 65535);
      if (record) {
        assert.equal(word(f.data, 0x3e9), 5978);
        assert.equal(f.data.readByte(0x7e384c).value, v.flags | 2);
        assert.ok(child.accesses.some((a) => a.address === 0x8dc77b && a.value === 56));
      } else {
        const slot = v.input & 255;
        assert.equal(f.data.readByte(0x3e9).value, slot);
        assert.equal(word(f.data, 0x801d6b), 65535);
        assert.equal(word(f.data, 0x801038 + slot), 65535);
        assert.equal(word(f.data, 0x7e3f28 + slot), 65535);
        assert.equal(word(f.data, 0x8014b0), ((v.tail ?? 4) - 2) & 65535);
        assert.equal(word(f.data, 0x800d1c), (v.free + v.nodes) & 65535);
        if (v.nodes) {
          assert.equal(word(f.data, 0x800d1e), 0x400);
          assert.equal(word(f.data, 0x8012f8 + slot), 65535);
          assert.deepEqual(
            [0x200, 0x300, 0x400].map((n) => word(f.data, 0x801564 + n)),
            [0x500, 0x200, 0x300],
          );
        }
        if (s.id !== 0x2ee) {
          const c8 = first.steps.find((p) => p.calleeEntry === 0x80fec1);
          assert.equal(c8.arguments.wordPops, 7);
          assert.equal(c8.callee.text.glyphs, 19);
          assert.equal(c8.callee.text.newlines, 1);
        }
      }
      assert.deepEqual(
        report.probes.find((p) => p.script_id === s.id && p.case === v.name),
        childBodyProbe(s, v),
      );
    }
  });
test('Allocated countdown children reject unowned visits, late ROM/list/high faults, unused observations and stale plans atomically', () => {
  for (const s of specs) {
    const v = childBodyCases(s)[2],
      f = fixture(s, v),
      first = commit(start, f),
      entry = childNextOptions(s, f, first);
    unchangedFailure(
      enter,
      { ...entry, continuation: { ...first } },
      {},
      'task_script_body_child_continuation_required',
    );
    unchangedFailure(
      enter,
      entry,
      { waitObservations: menuRecords([{ pc: 0x81acc3, address: 0x7e01fa, width: 2, value: 0 }]) },
      'task_wait_observation_unused',
    );
    unchangedFailure(
      enter,
      entry,
      { inputObservations: menuRecords([{ pc: 0x809e1a, address: 0x8001ca, width: 2, value: 0 }]) },
      'task_input_observation_unused',
    );
    unchangedFailure(enter, entry, { inputObservations: [] }, 'task_input_observations_required');
    let p = commit(enter, entry);
    const postOptions = childNextOptions(s, f, p);
    unchangedFailure(
      parent,
      { ...postOptions, scriptId: s.id },
      {},
      'task_script_body_child_completion_required',
    );
    p = commit(post, postOptions);
    if (s.childId === 0xd2) {
      const blocked = childNextOptions(s, f, p);
      unchangedFailure(
        resume,
        blocked,
        {
          waitObservations: menuRecords([{ pc: 0x81acc3, address: 0x7e01fa, width: 2, value: 0 }]),
        },
        'task_wait_observation_unused',
      );
      unchangedFailure(
        resume,
        blocked,
        {
          inputObservations: menuRecords([{ pc: 0x809e1a, address: 0x8001ca, width: 2, value: 0 }]),
        },
        'task_input_observation_unused',
      );
      p = commit(resume, blocked);
      assert.equal(p.segmentHandlers, 0);
      assert.equal(word(f.data, 0x800c06), 1);
    }
    const next = childNextOptions(s, f, p),
      q = prepared(resume, next);
    unchangedFailure(resume, next, { maxWork: q.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      resume,
      next,
      { maxOutputBytes: q.outputBytes - 1 },
      'task_output_budget_required',
    );
    unchangedFailure(
      resume,
      next,
      { waitObservations: menuRecords([{ pc: 0x81acc3, address: 0x7e01fa, width: 2, value: 0 }]) },
      'task_wait_observation_unused',
    );
    unchangedFailure(
      resume,
      next,
      { inputObservations: menuRecords([{ pc: 0x809e1a, address: 0x8001ca, width: 2, value: 0 }]) },
      'task_input_observation_unused',
    );
    const address = s.childId === 0x6f ? 0x8dc77b : 0x801764,
      old = f.data.readByte(address).value;
    f.data.seed(address, [old ^ 1]);
    if (s.childId === 0x6f) unchangedFailure(resume, next, {}, 'task_script_body_bytes_required');
    else {
      put(f, 0x8012a0 + (v.input & 255), 65535);
      put(f, 0x800d1e, 0x200);
      put(f, 0x801764, 0x200);
      unchangedFailure(
        resume,
        next,
        { maxWork: 1000, maxOutputBytes: 20000 },
        'task_work_budget_required',
      );
      put(f, 0x8012a0 + (v.input & 255), v.nodes);
      put(f, 0x800d1e, 0x500);
      put(f, 0x801764, 0x300);
    }
    f.data.seed(address, [old]);
    const before = f.data.snapshot();
    assert.deepEqual(commitTaskPlan(f.data, q), { handled: false, reason: 'task_plan_stale' });
    assert.deepEqual(f.data.snapshot(), before);
    const done = commit(resume, next),
      finish = childNextOptions(s, f, done),
      r = prepared(parent, finish);
    unchangedFailure(parent, finish, { maxWork: r.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      parent,
      finish,
      { maxOutputBytes: r.outputBytes - 1 },
      'task_output_budget_required',
    );
    const metadata = 0x82e623 + s.childId,
      n = f.data.readByte(metadata + 1).value;
    f.data.seed(metadata + 1, [n ^ 1]);
    unchangedFailure(parent, finish, {}, 'task_script_body_bytes_required');
    f.data.seed(metadata + 1, [n]);
  }
});
test('Child0D2 C2 requires its fresh following WORD highbyte while masking it, and END consumes its own changed heapheader high', () => {
  const s = at(0x2ee),
    v = childBodyCases(s)[0],
    missing = omit(fixture(s, v), 0x3ea);
  let p = yielded(s, missing);
  p = commit(resume, childNextOptions(s, missing, p));
  unchangedFailure(resume, childNextOptions(s, missing, p), {}, 'render_source_required');
  const f = fixture(s, v);
  p = yielded(s, f);
  p = commit(resume, childNextOptions(s, f, p));
  f.data.seed(0x3ea, [0xff]);
  f.data.seed(0x3f3, [0xe0]);
  const q = commit(resume, childNextOptions(s, f, p));
  assert.equal(word(f.data, 0x7e3f28 + 0x10), 65535);
  assert.equal(q.resultWord, 0xe0e0);
  assert.ok(q.accesses.some((a) => a.kind === 'read' && a.address === 0x3ea && a.value === 255));
  const r = commit(parent, childNextOptions(s, f, q));
  assert.equal(r.childCompletion, 0xe0e0);
  assert.equal(r.resultWord, 0xbeef);
  assert.equal(r.childPostrun.resultPushed, false);
});
test('Child6F actual flag read retains current BYTE bits and fresh heapheader high after committed yield', () => {
  const s = at(0xb7),
    v = childBodyCases(s)[0],
    f = fixture(s, v),
    p = yielded(s, f);
  f.data.seed(0x7e384c, [0x81]);
  f.data.seed(0x3f4, [0xe0]);
  const q = commit(resume, childNextOptions(s, f, p));
  assert.equal(f.data.readByte(0x7e384c).value, 0x83);
  assert.equal(q.resultWord, 0xe0df);
  const r = commit(parent, childNextOptions(s, f, q));
  assert.equal(r.childCompletion, 0xe0df);
  assert.equal(r.resultWord, 0xbeef);
});
test('Canonical countdown admission rejects isolated argument, real yield/countdown/write, entity/record and parent text-ledger mutations', async () => {
  const source = JSON.parse(await readFile('analysis/render-task-script-bodies-child.json')),
    native = JSON.parse(await readFile('analysis/render-task-script-bodies-child-native.json'));
  for (const s of specs) {
    const proof = source.proofs.find((p) => p.script_id === s.id),
      childSource = JSON.parse(await readFile(proof.child_source_contract)),
      child = childSource.proofs.find((p) => p.script_id === s.childId),
      probes = native.probes.filter((p) => p.script_id === s.id);
    validateChildBodyEvidence(proof, probes, child);
    const mutations = [
      (p) => (p.parent_input_word ^= 1),
      (p) => (p.child_argument_word ^= 1),
      (p) => (p.child_segments[1].native_calls[0].saved_continuation_word ^= 1),
      (p) => (p.child_segments[1].byte_writes.find(([a]) => a === 0x7e0ba6)[1] ^= 1),
      (p) => (p.child_segments[3].byte_writes.find(([a]) => a === 0x7e0c06)[1] ^= 1),
      (p) => (p.child_segments[3].byte_writes.find(([a]) => a === 0x7e0250)[1] ^= 1),
      (p) => (p.child_segments.at(-2).native_calls[1].callee_return_word ^= 1),
      ...(s.childId === 0x6f
        ? [(p) => (p.child_record_pointer ^= 1), (p) => (p.child_record_flags ^= 1)]
        : [
            (p) => (p.child_free_count ^= 1),
            (p) => (p.child_list_words[0] ^= 1),
            (p) => (p.child_released_field ^= 1),
            (p) => (p.child_global_word ^= 1),
          ]),
      ...(s.id !== 0xb7 && s.id !== 0x2ee
        ? [
            (p) => (p.child_segments[0].native_calls[0].glyphs ^= 1),
            (p) => {
              const a = p.child_segments[0];
              a.io_records[0].value = 1;
              a.io_requests.find((r) => r.kind === 'read').value = 1;
            },
            (p) => {
              const a = p.child_segments[0];
              a.wait_records = [];
              a.wait_observations_used = 0;
              a.native_calls[0].wait_observations_used = 0;
            },
          ]
        : []),
    ];
    for (const [n, mutate] of mutations.entries()) {
      const changed = structuredClone(probes);
      mutate(changed[0]);
      assert.throws(
        () => validateChildBodyEvidence(proof, changed, child),
        `Script${s.id.toString(16)} isolated mutation${n}`,
      );
    }
    if (s.childId === 0xd2) {
      const changed = structuredClone(probes),
        linked = changed.find((p) => p.child_initial_node_count === 3);
      linked.child_node_links[0] ^= 1;
      assert.throws(() => validateChildBodyEvidence(proof, changed, child));
    }
  }
});
