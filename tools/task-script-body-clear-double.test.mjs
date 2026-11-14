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
const specs = scriptBodySpecs.filter((s) => s.doubleClearWait),
  freeze = (vs) => Object.freeze(vs.map(Object.freeze));
const expected = new Map([
  [0xf9, { pops: [2, 23, 7, 3, 0, 15, 1], glyphs: 7, bits: 50, words: 162 }],
  [0x1fb, { pops: [2, 23, 9, 3, 0, 18, 1], glyphs: 9, bits: 49, words: 176 }],
  [0x240, { pops: [2, 23, 8, 3, 0, 16, 1], glyphs: 8, bits: 48, words: 166 }],
]);
for (const spec of specs) {
  const e = expected.get(spec.id);
  test(`Whole original${spec.id.toString(16)}: two separate real committed yields/readiness/resumes, own Native80/A7/C8 and actual END`, async () => {
    const report = JSON.parse(
      await readFile('analysis/render-task-script-bodies-clear-native.json'),
    );
    for (const v of bodyCases(spec)) {
      const { fixture: f, plan: p, segments } = runWaitBodyFixture(spec, v),
        [first, middle, last] = segments;
      assert.equal(segments.length, 3);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.equal(p.observedReadinessEntries, 2);
      assert.deepEqual(
        p.bodyPCs,
        [0, 2, 4, 5, 7, 8, 10, 12, 13, 15, 16, 18, 20, 21, 23, 25, 27, 29, 31],
      );
      assert.equal(p.handlersExecuted, 19);
      assert.deepEqual(
        segments.map((s) => s.segmentHandlers),
        [4, 5, 10],
      );
      assert.deepEqual(
        segments.map((s) => s.bodySuspended ?? false),
        [true, true, false],
      );
      assert.equal(first.nextPC, 7);
      assert.equal(middle.nextPC, 15);
      for (const s of [first, middle]) {
        assert.equal(s.steps.at(-1).calleeEntry, 0x80c401);
        for (const label of ['wait-mask-store-low', 'wait-count-store-low'])
          assert.equal(s.accesses.find((a) => a.label === label).value, 1);
      }
      const n80 = p.steps.find((s) => s.calleeEntry === 0x80cdcf),
        a7 = p.steps.find((s) => s.calleeEntry === 0x80ff79),
        c8 = p.steps.find((s) => s.calleeEntry === 0x80fec1);
      assert.equal(n80.wordPops, 0);
      assert.equal(a7.arguments.wordPops, 0);
      assert.equal(c8.arguments.wordPops, 7);
      for (const c of [n80, a7, c8]) {
        assert.equal(c.resultPushed, false);
        assert.equal(c.calleeReturnWord, 0xf508);
        assert.equal(c.calleeReturnTarget, 0x80f509);
      }
      assert.equal(a7.callee.calls.length, v.slots.filter((v) => !(v & 32768)).length);
      assert.equal(c8.callee.text.glyphs, e.glyphs);
      assert.equal(c8.callee.text.characters, e.glyphs);
      assert.equal(c8.callee.text.bits, e.bits);
      assert.deepEqual(
        last.accesses.filter((a) => a.label === 'native-argument-PLA-low').map((a) => a.value),
        e.pops,
      );
      assert.ok(
        last.accesses
          .filter((a) => a.label === 'native-argument-PLA-high')
          .every((a) => a.value === 0),
      );
      assert.equal(first.observationsUsed, 0);
      assert.equal(first.waitObservationsUsed, 0);
      assert.equal(last.observationsUsed, 2);
      assert.equal(last.waitObservationsUsed, 10);
      assert.equal(word(f.data, 0x801d63), 65535);
      assert.equal(word(f.data, 0x7e021c), 2);
      assert.equal(p.outputContext.s, 0xaff);
      assert.equal(p.outputContext.d, 0);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.resultWord, 0xbeef);
      assert.deepEqual(
        report.probes.find((p) => p.script_id === spec.id && p.case === v.name),
        waitBodyProbe(spec, v),
      );
    }
  });
  test(`Original${spec.id.toString(16)}: all own ROM/header/body/table/high sources and exact first-segment limits required before effects`, () => {
    const f = fixture(spec, bodyCases(spec)[3]),
      p = prepared(start, f);
    assert.equal(spec.romReads.length, e.words);
    for (let n = 0; n < spec.bytecode.length + 3; n++)
      unchangedFailure(start, omit(f, spec.scriptEntry + n), {}, 'render_source_required');
    for (const r of spec.romReads)
      unchangedFailure(start, omit(f, r.address + 1), {}, 'render_source_required');
    for (const id of [0x80, 0x9f])
      for (const a of scriptBodyNativeSources.find((n) => n.id === id).anchors)
        unchangedFailure(start, omit(f, a.address + 1), {}, 'render_source_required');
    prepared(start, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      start,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    unchangedFailure(
      start,
      f,
      { maxHandlers: f.maxHandlers - 1 },
      'task_script_body_handler_count_required',
    );
  });
  test(`Original${spec.id.toString(16)}: each future ledger belongs only to its actual segment; late failures preserve both committed prefixes`, () => {
    const f = fixture(spec, bodyCases(spec)[3]);
    unchangedFailure(
      start,
      f,
      { ioObservations: f.a7ResumeObservations.ioObservations },
      'task_io_observation_unused',
    );
    unchangedFailure(
      start,
      f,
      { waitObservations: f.a7ResumeObservations.waitObservations },
      'task_wait_observation_unused',
    );
    const first = prepared(start, f);
    unchangedFailure(
      resume,
      resumeBodyFixture(spec, f, first),
      {},
      'task_script_body_continuation_required',
    );
    assert.equal(commitTaskPlan(f.data, first).handled, true);
    assert.equal(word(f.data, 0x801d63), 65535);
    const mid = resumeBodyFixture(spec, f, first),
      middle = prepared(resume, mid);
    for (let n = 0; n < mid.ioObservations.length; n++)
      unchangedFailure(
        resume,
        mid,
        { ioObservations: freeze(mid.ioObservations.filter((_, i) => i !== n)) },
        'task_io_observation_required',
      );
    unchangedFailure(
      resume,
      mid,
      { ioObservations: freeze([...mid.ioObservations, ...f.c8ResumeObservations.ioObservations]) },
      'task_io_observation_unused',
    );
    unchangedFailure(
      resume,
      mid,
      { waitObservations: f.c8ResumeObservations.waitObservations },
      'task_wait_observations_required',
    );
    unchangedFailure(resume, mid, { maxWork: middle.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      resume,
      mid,
      { maxOutputBytes: middle.outputBytes - 1 },
      'task_output_budget_required',
    );
    assert.equal(commitTaskPlan(f.data, middle).handled, true);
    assert.equal(word(f.data, 0x7e021c), 65535);
    const last = resumeBodyFixture(spec, f, middle),
      p = prepared(resume, last);
    unchangedFailure(
      resume,
      { ...last, continuation: first },
      {},
      'task_script_body_continuation_required',
    );
    unchangedFailure(
      resume,
      { ...last, continuation: { ...middle } },
      {},
      'task_script_body_continuation_required',
    );
    unchangedFailure(
      resume,
      { ...last, data: fixture(spec).data },
      {},
      'task_script_body_continuation_required',
    );
    unchangedFailure(
      resume,
      last,
      { ioObservations: mid.ioObservations },
      'task_io_observation_required',
    );
    unchangedFailure(
      resume,
      last,
      { waitObservations: mid.waitObservations },
      'task_wait_observation_required',
    );
    for (let n = 0; n < last.ioObservations.length; n++)
      unchangedFailure(
        resume,
        last,
        { ioObservations: freeze(last.ioObservations.filter((_, i) => i !== n)) },
        'task_io_observation_required',
      );
    for (let n = 0; n < last.waitObservations.length; n++)
      unchangedFailure(
        resume,
        last,
        { waitObservations: freeze(last.waitObservations.filter((_, i) => i !== n)) },
        'task_wait_observation_required',
      );
    unchangedFailure(resume, last, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      resume,
      last,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    for (const [a, v] of [
      [0x82da39, 0],
      [spec.scriptEntry + 34, spec.fetchTail],
      [spec.romReads[0].address, spec.romReads[0].value & 255],
    ]) {
      f.data.seed(a, [(v ^ 1) & 255]);
      unchangedFailure(resume, last, {}, 'task_script_body_bytes_required');
      f.data.seed(a, [v]);
    }
    assert.equal(word(f.data, 0x7e021c), 65535);
    assert.equal(word(f.data, 0x801d63), 65535);
    prepared(resume, last);
    sampleWord(f.data, 0x800254, 0x602);
    unchangedFailure(resume, last, {}, 'task_script_body_wait_owner_required');
  });
  test(`Original${spec.id.toString(16)}: actual Native80/Taskframe pointer alias refetches changed bytes and atomically rejects`, () => {
    const f = fixture(spec),
      frame = 0x1d63;
    for (const [o, v] of [
      [0, (spec.scriptEntry + 2) & 65535],
      [1, 0x9bed],
      [3, 0],
      [7, 0x7ff],
      [9, spec.id],
    ])
      sampleWord(f.data, frame + o, v);
    sampleWord(f.data, 0x800254, frame);
    f.context = Object.freeze({ ...f.context, d: frame });
    unchangedFailure(start, f, {}, 'task_script_body_pointer_required');
  });
  test(`Original${spec.id.toString(16)}: late A7 STZ/Taskframe pointer alias rejects its new phase and preserves committed Native80`, () => {
    const f = fixture(spec),
      frame = 0x200;
    for (const [o, v] of [
      [0, (spec.scriptEntry + 2) & 65535],
      [1, 0x9bed],
      [3, 0],
      [7, 0x7ff],
      [9, spec.id],
    ])
      sampleWord(f.data, frame + o, v);
    sampleWord(f.data, 0x800254, frame);
    f.context = Object.freeze({ ...f.context, d: frame });
    const first = prepared(start, f);
    assert.equal(commitTaskPlan(f.data, first).handled, true);
    const mid = resumeBodyFixture(spec, f, first);
    unchangedFailure(resume, mid, {}, 'task_script_body_pointer_required');
    assert.equal(word(f.data, 0x801d63), 65535);
    assert.equal(word(f.data, frame), (spec.scriptEntry + 2) & 65535);
  });
}
