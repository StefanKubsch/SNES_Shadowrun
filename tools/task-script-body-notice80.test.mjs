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
const s = scriptBodySpecs.find((s) => s.id === 0x22a),
  freeze = (vs) => Object.freeze(vs.map(Object.freeze));
test('Original22A: original field pointer/BYTE mask/high preservation, whole80, independent9F resume, flag0400 C8 with35 original glyphs and END', async () => {
  const report = JSON.parse(
    await readFile('analysis/render-task-script-bodies-notice80-native.json'),
  );
  for (const v of bodyCases(s)) {
    const { fixture: f, plan: p, segments } = runWaitBodyFixture(s, v),
      [first, last] = segments,
      c8 = p.steps.find((p) => p.calleeEntry === 0x80fec1);
    assert.equal(p.bodyComplete, true);
    assert.equal(p.fullTaskBinding, false);
    assert.equal(p.observedReadinessEntries, 1);
    assert.deepEqual(p.bodyPCs, [0, 2, 5, 7, 9, 11, 12, 14, 15, 17, 20, 23, 25, 27, 29, 30, 32]);
    assert.equal(p.handlersExecuted, 17);
    assert.equal(segments.length, 2);
    assert.deepEqual(
      segments.map((p) => p.segmentHandlers),
      [7, 10],
    );
    assert.equal(word(f.data, 0x7e32b1), 0xab00 | (v.oldFlag | 128));
    assert.equal(word(f.data, 0x801d63), 65535);
    assert.equal(first.observationsUsed, 0);
    assert.equal(first.waitObservationsUsed, 0);
    assert.equal(first.nextPC, 14);
    for (const p of [first, last])
      for (const call of p.steps.filter((s) => s.calleeEntry && s.calleeEntry !== 0x80c401)) {
        assert.equal(call.calleeReturnWord, 0xf508);
        assert.equal(call.calleeReturnTarget, 0x80f509);
        assert.equal(call.resultPushed, false);
      }
    assert.deepEqual(
      last.accesses.filter((a) => a.label === 'native-argument-PLA-low').map((a) => a.value),
      [4, 4, 24, 3, 0, 16, 240],
    );
    assert.deepEqual(
      last.accesses.filter((a) => a.label === 'native-argument-PLA-high').map((a) => a.value),
      [0, 0, 0, 0, 4, 1, 0],
    );
    assert.equal(c8.callee.outcome, v.replace ? 'notice_replaced' : 'notice_inserted');
    assert.equal(c8.callee.allocated.outcome, 'capacity_end');
    assert.equal(c8.callee.text.glyphs, 35);
    assert.equal(c8.callee.text.characters, 35);
    assert.equal(c8.callee.text.bits, 168);
    assert.equal(c8.callee.text.rows, 280);
    assert.equal(c8.callee.text.newlines, 0);
    assert.ok(
      last.accesses.some(
        (a) =>
          a.kind === 'write' &&
          a.label === 'text-root-WORD-low' &&
          a.address === 0x800202 &&
          a.value === 30,
      ),
    );
    assert.equal(last.observationsUsed, 2);
    assert.equal(last.waitObservationsUsed, v.replace ? 11 : 10);
    assert.equal(p.returnTarget, 0x80c20b);
    assert.equal(p.resultWord, 0xbeef);
    assert.equal(p.outputContext.s, 0xaff);
    assert.deepEqual(
      report.probes.find((p) => p.script_id === s.id && p.case === v.name),
      waitBodyProbe(s, v),
    );
  }
});
test('Original22A: every body/fetchhigh and292 original ROM WORDs plus own0D/80/9F highs are required before prefix effects', () => {
  const f = fixture(s),
    p = prepared(start, f);
  assert.equal(s.romReads.length, 292);
  assert.equal(s.romReads.find((r) => r.address === 0x8dbba3).value, 0x32b0);
  for (let n = 0; n < s.bytecode.length + 3; n++)
    unchangedFailure(start, omit(f, s.scriptEntry + n), {}, 'render_source_required');
  for (const r of s.romReads)
    unchangedFailure(start, omit(f, r.address + 1), {}, 'render_source_required');
  for (const id of [0xd, 0x80, 0x9f])
    for (const a of scriptBodyNativeSources.find((n) => n.id === id).anchors)
      unchangedFailure(start, omit(f, a.address + 1), {}, 'render_source_required');
  prepared(start, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(start, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  unchangedFailure(
    start,
    f,
    { ioObservations: f.c8ResumeObservations.ioObservations },
    'task_io_observation_unused',
  );
  unchangedFailure(
    start,
    f,
    { waitObservations: f.c8ResumeObservations.waitObservations },
    'task_wait_observation_unused',
  );
});
test('Original22A: late C8/END/ROM/geometry/ledger/budget/owner failures preserve committed field and80 effects', () => {
  for (const replace of [false, true]) {
    const f = fixture(s, { oldFlag: 1, replace }),
      first = prepared(start, f);
    assert.equal(commitTaskPlan(f.data, first).handled, true);
    const last = resumeBodyFixture(s, f, first),
      p = prepared(resume, last);
    for (const key of ['ioObservations', 'waitObservations'])
      for (let n = 0; n < last[key].length; n++)
        unchangedFailure(
          resume,
          last,
          { [key]: freeze(last[key].filter((_, i) => i !== n)) },
          key === 'ioObservations'
            ? 'task_io_observation_required'
            : 'task_wait_observation_required',
        );
    unchangedFailure(resume, last, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      resume,
      last,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    unchangedFailure(
      resume,
      { ...last, continuation: { ...first } },
      {},
      'task_script_body_continuation_required',
    );
    for (const [a, v] of [
      [0x82da39, 0],
      [s.scriptEntry + 35, s.fetchTail],
      [s.romReads[0].address, s.romReads[0].value & 255],
    ]) {
      f.data.seed(a, [(v ^ 1) & 255]);
      unchangedFailure(resume, last, {}, 'task_script_body_bytes_required');
      f.data.seed(a, [v]);
    }
    assert.equal(word(f.data, 0x7e32b1), 0xab81);
    assert.equal(word(f.data, 0x801d63), 65535);
  }
  const f = omit(fixture(s), 0x7e2065),
    p = prepared(start, f);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  unchangedFailure(resume, resumeBodyFixture(s, f, p), {}, 'render_source_required');
  assert.equal(word(f.data, 0x7e32b1), 0xab80);
});
test('Original22A: Native80 changes actual saved-PC alias and even supplied wrong-stream bytes cannot authorize another edge', () => {
  const f = fixture(s),
    frame = 0x1d60;
  for (const [o, v] of [
    [0, 0xe31b],
    [1, 0x9be3],
    [3, 0],
    [7, 0x7ff],
    [9, s.id],
  ])
    sampleWord(f.data, frame + o, v);
  sampleWord(f.data, 0x800254, frame);
  f.context = Object.freeze({ ...f.context, d: frame });
  const failed = unchangedFailure(start, f, {}, 'render_source_required');
  assert.equal(failed.address, 0x9ce31a);
  sampleWord(f.data, 0x9ce31a, 0xa500);
  unchangedFailure(start, f, {}, 'task_script_body_edge_required');
});
