import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs, scriptBodyNativeSources } from '../proof/task/script-body-specs.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import {
  scriptBodyFixture as fixture,
  bodyCases,
  bodyWord as word,
  omitBodyBytes as omit,
} from './task-script-body-fixtures.mjs';
import {
  runWaitBodyFixture,
  resumeBodyFixture,
  waitBodyProbe,
} from './task-script-body-wait-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
const s = scriptBodySpecs.find((s) => s.id === 0x253),
  freeze = (values) => Object.freeze(values.map((v) => Object.freeze(v)));
test('Whole original253: A7 zero pops, independent9F count1 yield/readiness, original seven C8 pops and seven original text glyphs to actual END', async () => {
  const report = JSON.parse(await readFile('analysis/render-task-script-bodies-clear-native.json'));
  for (const v of bodyCases(s)) {
    const { fixture: f, plan: p, segments } = runWaitBodyFixture(s, v),
      [prefix, last] = segments,
      a7 = p.steps.find((s) => s.calleeEntry === 0x80ff79),
      c8 = p.steps.find((s) => s.calleeEntry === 0x80fec1);
    assert.equal(p.bodyComplete, true);
    assert.equal(p.fullTaskBinding, false);
    assert.equal(segments.length, 2);
    assert.equal(p.observedReadinessEntries, 1);
    assert.deepEqual(p.bodyPCs, [0, 2, 4, 5, 7, 8, 10, 12, 13, 15, 17, 19, 21, 23]);
    assert.equal(p.handlersExecuted, 14);
    assert.equal(p.outputContext.s, 0xaff);
    assert.equal(p.outputContext.d, 0);
    assert.equal(p.outputContext.bank, 0x9b);
    assert.equal(p.returnTarget, 0x80c20b);
    assert.equal(p.resultWord, 0xbeef);
    assert.equal(prefix.bodySuspended, true);
    assert.equal(prefix.segmentHandlers, 4);
    assert.equal(last.segmentHandlers, 10);
    assert.equal(a7.arguments.wordPops, 0);
    assert.equal(a7.arguments.metadataWord, 0x100);
    assert.equal(a7.resultPushed, false);
    assert.equal(a7.callee.calls.length, (v.slots ?? []).filter((v) => !(v & 32768)).length);
    for (const c of [a7, c8]) {
      assert.equal(c.calleeReturnWord, 0xf508);
      assert.equal(c.calleeReturnTarget, 0x80f509);
      assert.equal(c.resultPushed, false);
    }
    assert.equal(c8.arguments.wordPops, 7);
    assert.equal(c8.arguments.metadataWord, 7);
    assert.equal(c8.callee.outcome, 'notice_inserted');
    assert.equal(c8.callee.text.characters, 7);
    assert.equal(c8.callee.text.glyphs, 7);
    assert.equal(c8.callee.text.bits, 52);
    const pops = last.accesses
      .filter((a) => a.label === 'native-argument-PLA-low')
      .map((a) => a.value);
    assert.deepEqual(pops, [2, 23, 9, 3, 0, 19, 1]);
    assert.ok(
      last.accesses
        .filter((a) => a.label === 'native-argument-PLA-high')
        .every((a) => a.value === 0),
    );
    assert.equal(word(f.data, 0x7e021c), 2);
    assert.equal(word(f.data, 0x800224), 1);
    assert.equal(last.observationsUsed, 2);
    assert.equal(last.waitObservationsUsed, 10);
    assert.deepEqual(
      report.probes.find((p) => p.script_id === s.id && p.case === v.name),
      waitBodyProbe(s, v),
    );
  }
});
test('Original253: every body/fetchhigh and all156 original ROM WORDs plus A7 metadata highs are required before any effect', () => {
  const f = fixture(s, bodyCases(s)[3]),
    p = prepared(start, f);
  assert.equal(s.romReads.length, 156);
  for (let n = 0; n < s.bytecode.length + 3; n++)
    unchangedFailure(start, omit(f, s.scriptEntry + n), {}, 'render_source_required');
  for (const r of s.romReads)
    unchangedFailure(start, omit(f, r.address + 1), {}, 'render_source_required');
  for (const id of [0xa7, 0x9f])
    for (const a of scriptBodyNativeSources.find((n) => n.id === id).anchors)
      unchangedFailure(start, omit(f, a.address + 1), {}, 'render_source_required');
  prepared(start, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(start, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  unchangedFailure(
    start,
    f,
    { maxHandlers: f.maxHandlers - 1 },
    'task_script_body_handler_count_required',
  );
});
test('Original253: future/reordered/missing IO/wait observations cannot cross A7 yield; independently supplied C8 uses a new ledger', () => {
  const f = fixture(s, bodyCases(s)[3]);
  prepared(start, f);
  for (let n = 0; n < f.ioObservations.length; n++)
    unchangedFailure(
      start,
      f,
      { ioObservations: freeze(f.ioObservations.filter((_, i) => i !== n)) },
      'task_io_observation_required',
    );
  unchangedFailure(
    start,
    f,
    {
      ioObservations: freeze([
        f.ioObservations[1],
        f.ioObservations[0],
        ...f.ioObservations.slice(2),
      ]),
    },
    'task_io_observation_required',
  );
  unchangedFailure(
    start,
    f,
    { ioObservations: freeze([...f.ioObservations, ...f.c8ResumeObservations.ioObservations]) },
    'task_io_observation_unused',
  );
  unchangedFailure(
    start,
    f,
    {
      waitObservations: freeze([...f.waitObservations, ...f.c8ResumeObservations.waitObservations]),
    },
    'task_wait_observations_required',
  );
  const p = prepared(start, f);
  unchangedFailure(
    resume,
    resumeBodyFixture(s, f, p),
    {},
    'task_script_body_continuation_required',
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(word(f.data, 0x800ba4), 1);
  assert.equal(word(f.data, 0x800c04), 1);
  const next = resumeBodyFixture(s, f, p),
    q = prepared(resume, next);
  assert.equal(q.bodyComplete, true);
  unchangedFailure(
    resume,
    next,
    { ioObservations: f.ioObservations },
    'task_io_observation_required',
  );
  unchangedFailure(
    resume,
    next,
    { waitObservations: f.waitObservations },
    'task_wait_observation_required',
  );
  for (let n = 0; n < next.ioObservations.length; n++)
    unchangedFailure(
      resume,
      next,
      { ioObservations: freeze(next.ioObservations.filter((_, i) => i !== n)) },
      'task_io_observation_required',
    );
  for (let n = 0; n < next.waitObservations.length; n++)
    unchangedFailure(
      resume,
      next,
      { waitObservations: freeze(next.waitObservations.filter((_, i) => i !== n)) },
      'task_wait_observation_required',
    );
  unchangedFailure(resume, next, { maxWork: q.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    resume,
    next,
    { maxOutputBytes: q.outputBytes - 1 },
    'task_output_budget_required',
  );
});
test('Original253: late C8 metadata/END/ROM/owner errors preserve already committed A7 effects and require genuine latest suspension', () => {
  const f = fixture(s, bodyCases(s)[2]),
    p = prepared(start, f);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  const next = resumeBodyFixture(s, f, p);
  unchangedFailure(
    resume,
    { ...next, continuation: { ...p } },
    {},
    'task_script_body_continuation_required',
  );
  const originals = [
    [0x82da39, 0],
    [s.scriptEntry + 26, s.fetchTail],
    [s.romReads[0].address, s.romReads[0].value & 255],
  ];
  for (const [a, v] of originals) {
    f.data.seed(a, [(v ^ 1) & 255]);
    unchangedFailure(resume, next, {}, 'task_script_body_bytes_required');
    f.data.seed(a, [v]);
  }
  assert.equal(word(f.data, 0x7e0216), 65535);
  prepared(resume, next);
  const other = fixture(s);
  unchangedFailure(
    resume,
    { ...next, data: other.data },
    {},
    'task_script_body_continuation_required',
  );
  sampleWord(f.data, 0x800254, 0x602);
  unchangedFailure(resume, next, {}, 'task_script_body_wait_owner_required');
});
test('Original253: real A7 STZ/Taskframe alias reads replaced pointer and rejects even extra wrong-stream bytes atomically', () => {
  const f = fixture(s);
  for (const [offset, value] of [
    [0, 0xedfa],
    [1, 0x9bed],
    [3, 0],
    [7, 0x7ff],
    [9, s.id],
  ])
    sampleWord(f.data, 0x200 + offset, value);
  sampleWord(f.data, 0x800254, 0x200);
  f.context = Object.freeze({ ...f.context, d: 0x200 });
  unchangedFailure(start, f, {}, 'task_script_body_pointer_required');
  f.data.seed(0x9b0002, [0, 1]);
  unchangedFailure(start, f, {}, 'task_script_body_pointer_required');
});
