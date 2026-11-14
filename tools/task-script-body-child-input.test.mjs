import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { childInputBodySpecs as specs } from '../proof/task/script-body-child-input-specs.mjs';
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
import { inputWaitBodyPCs } from './task-script-body-input-wait-fixtures.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { validateChildBodyEvidence } from './progress.mjs';
const child = scriptBodySpecs.find((s) => s.id === 0x10e);
for (const s of specs)
  test(`Whole${s.id.toString(16)} owns its original argument and actual allocated child10E/C8/A3/CC97/END/release/F495`, async () => {
    const report = JSON.parse(
      await readFile('analysis/render-task-script-bodies-child-native.json'),
    );
    for (const v of childBodyCases(s)) {
      const { fixture: f, plan: p, segments } = runChildFixture(s, v),
        [prefix, c, finish] = segments,
        arg = s.instructions[0].operand;
      assert.equal(segments.length, 3);
      assert.equal(prefix.parentEntry.interpreterEntryExecuted, true);
      assert.equal(prefix.scriptChildSuspended, true);
      assert.equal(prefix.steps.at(-1).wordPops, 1);
      assert.equal(prefix.childFrame, 0x3d6);
      assert.equal(prefix.childSlot, 4);
      assert.equal(prefix.parentSlot, 2);
      assert.equal(prefix.bodyComplete, false);
      assert.equal(prefix.segmentHandlers, 2);
      assert.equal(c.childEntry.interpreterEntryExecuted, true);
      assert.equal(c.scriptId, 0x10e);
      assert.equal(c.frame, undefined);
      assert.equal(c.bodyComplete, true);
      assert.equal(c.bodySuspended, undefined);
      assert.deepEqual(c.bodyPCs, inputWaitBodyPCs(child, v));
      assert.equal(c.resultWord, v.heap - 39 - 4);
      assert.deepEqual(
        c.accesses.filter((a) => a.label.startsWith('END-result-PLA-')).map((a) => a.address),
        [0x3fd, 0x3fe],
      );
      assert.equal(word(f.data, 0x3e9), arg);
      assert.equal(word(f.data, 0x7e2de2), arg);
      assert.equal(word(f.data, 0x801ce9), 0x7fff);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.outputContext.s, 0xb01);
      assert.equal(p.outputContext.d, 0);
      assert.equal(word(f.data, 0xb06), 0x91d0);
      assert.equal(finish.childCompletion, v.heap - 43);
      assert.equal(finish.childPostrun.continuationTarget, 0x80f495);
      assert.equal(finish.childPostrun.metadataWord, 0);
      assert.equal(finish.childPostrun.resultPushed, false);
      assert.equal(finish.segmentHandlers, 1);
      assert.deepEqual(
        p.bodyPCs,
        s.instructions.map((i) => i.pc),
      );
      assert.equal(p.fullTaskBinding, false);
      assert.equal(word(f.data, 0x8003d2), 39);
      assert.equal(word(f.data, 0x80024e), 4);
      assert.equal(word(f.data, 0x80024c), 2);
      assert.equal(word(f.data, 0x800ba4), 0);
      assert.equal(word(f.data, 0x800374), 65535);
      const c8 = c.steps.find((n) => n.calleeEntry === 0x80fec1),
        a3 = c.steps.find((n) => n.calleeEntry === 0x80f953);
      assert.equal(!!c8, !!v.state);
      assert.equal(!!a3, !!v.state);
      if (v.state) {
        assert.equal(c8.arguments.wordPops, 7);
        assert.equal(c8.callee.text.glyphs, v.state <= 2 ? 55 : 26);
        assert.equal(a3.callee.iterations, v.repeated ? 2 : 1);
        assert.equal(a3.waitObservationsUsed, v.repeated ? 4 : 1);
        assert.equal(a3.inputObservationsUsed, v.repeated ? 2 : 1);
      }
      assert.deepEqual(
        report.probes.find((p) => p.script_id === s.id && p.case === v.name),
        childBodyProbe(s, v),
      );
    }
  });
test('Child10E committed parent survives late text/counter/input/END faults; fresh owner and observation chronology stay atomic', () => {
  const s = specs.find((s) => s.id === 0x16b),
    v = childBodyCases(s).find((v) => v.state === 3 && v.repeated && v.heap === 0x400),
    f = fixture(s, v),
    p = prepared(start, f),
    next = childNextOptions(s, f, p);
  unchangedFailure(
    start,
    f,
    { waitObservations: menuRecords([{ pc: 0x81b0a5, address: 0x7e1c76, width: 2, value: 6 }]) },
    'task_wait_observation_unused',
  );
  unchangedFailure(start, f, { inputObservations: f.childInput }, 'task_input_observation_unused');
  unchangedFailure(start, f, { inputObservations: [] }, 'task_input_observations_required');
  unchangedFailure(enter, next, {}, 'task_script_body_child_continuation_required');
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  unchangedFailure(
    enter,
    { ...next, continuation: { ...p } },
    {},
    'task_script_body_child_continuation_required',
  );
  unchangedFailure(
    enter,
    next,
    { context: Object.freeze({ ...next.context, s: next.context.s - 2 }) },
    'task_script_body_child_owner_required',
  );
  for (const [address, reason] of [
    [0x800375, 'task_script_body_child_owner_required'],
    [0x601, 'task_script_body_child_owner_required'],
    [0x3d8, 'task_script_body_child_owner_required'],
  ]) {
    const n = f.data.readByte(address).value;
    f.data.seed(address, [n ^ 1]);
    unchangedFailure(enter, next, {}, reason);
    f.data.seed(address, [n]);
  }
  const q = prepared(enter, next);
  for (const key of ['ioObservations', 'waitObservations', 'inputObservations']) {
    const reason =
      key === 'ioObservations'
        ? 'task_io_observation_required'
        : key === 'waitObservations'
          ? 'task_wait_observation_required'
          : 'task_input_observation_required';
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
      inputObservations: menuRecords([
        { ...next.inputObservations[0], value: 0x3030 },
        ...next.inputObservations.slice(1),
      ]),
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
  const rom = child.romReads.find((r) => r.address >= 0x800000),
    old = f.data.readByte(rom.address + 1).value;
  f.data.seed(rom.address + 1, [old ^ 1]);
  unchangedFailure(enter, next, {}, 'task_script_body_bytes_required');
  f.data.seed(rom.address + 1, [old]);
  const beforeStale = f.data.snapshot();
  assert.deepEqual(commitTaskPlan(f.data, q), { handled: false, reason: 'task_plan_stale' });
  assert.deepEqual(f.data.snapshot(), beforeStale);
  const done = commit(enter, next);
  unchangedFailure(enter, next, {}, 'task_script_body_child_continuation_required');
  const last = childNextOptions(s, f, done),
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
  const m = 0x82e623 + 0x10e,
    n = f.data.readByte(m + 1).value;
  f.data.seed(m + 1, [n ^ 1]);
  unchangedFailure(parent, last, {}, 'task_script_body_bytes_required');
  f.data.seed(m + 1, [n]);
  assert.equal(word(f.data, 0x3e9), 335);
  assert.equal(word(f.data, 0x7e2de2), 335);
});
test('Child10E receives fresh copied argument bytes and actual END split-header high, with no cached parent result', () => {
  const s = specs[0],
    v = childBodyCases(s).find((v) => v.state === 0 && !v.repeated && v.heap === 0x800),
    f = fixture(s, v),
    p = commit(start, f);
  // Explicit independent synthetic observations of the current physical bytes.
  f.data.seed(0x3fc, [0xca]);
  f.data.seed(0x3fe, [0xe0]);
  const q = commit(enter, childNextOptions(s, f, p));
  assert.equal(word(f.data, 0x3e9), 0xcadc);
  assert.equal(word(f.data, 0x7e2de2), 0xcadc);
  assert.equal(q.resultWord, 0xe0d5);
  const r = commit(parent, childNextOptions(s, f, q));
  assert.equal(r.childCompletion, 0xe0d5);
  assert.equal(r.resultWord, 0xbeef);
  assert.equal(r.childPostrun.resultPushed, false);
});
test('Child10E canonical admission rejects missing branches, false frame/argument/native identity and uncoupled observation evidence', async () => {
  const source = JSON.parse(await readFile('analysis/render-task-script-bodies-child.json')),
    native = JSON.parse(await readFile('analysis/render-task-script-bodies-child-native.json')),
    childSource = JSON.parse(
      await readFile('analysis/render-task-script-bodies-input-wait.json'),
    ).proofs.find((p) => p.script_id === 0x10e);
  for (const s of specs) {
    const proof = source.proofs.find((p) => p.script_id === s.id),
      probes = native.probes.filter((p) => p.script_id === s.id);
    validateChildBodyEvidence(proof, probes, childSource);
    const active = probes.findIndex((p) => p.child_state === 3 && p.child_repeated);
    for (const mutate of [
      (p) => (p.child_local ^= 0x100),
      (p) => (p.child_argument ^= 1),
      (p) => (p.child_native56_field ^= 1),
      (p) => (p.child_segments[1].native_calls[0].glyphs = 55),
      (p) => (p.child_segments[1].native_calls.at(-1).target = 0x80d985),
      (p) => (p.child_segments[1].input_records[0].address = 0x8001cc),
      (p) => (p.child_segments[1].wait_records.at(-1).value = 0),
      (p) => p.child_segments[1].body_pcs.splice(-2, 1),
      (p) => (p.child_header_result ^= 1),
    ]) {
      const changed = structuredClone(probes);
      mutate(changed[active]);
      assert.throws(() => validateChildBodyEvidence(proof, changed, childSource));
    }
    assert.throws(() =>
      validateChildBodyEvidence(
        proof,
        probes.filter((p) => p.child_state <= 2),
        childSource,
      ),
    );
  }
});
