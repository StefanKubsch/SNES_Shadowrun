import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs, scriptBodyNativeSources } from '../proof/task/script-body-specs.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import {
  scriptBodyFixture as fixture,
  bodyCases,
  bodyWord as word,
  omitBodyBytes as omit,
} from './task-script-body-fixtures.mjs';
import { inputWaitBodyPCs } from './task-script-body-input-wait-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import {
  runWaitBodyFixture,
  resumeBodyFixture,
  waitBodyProbe,
} from './task-script-body-wait-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const specs = scriptBodySpecs.filter((s) => s.inputWaitBody),
  freeze = (xs) => Object.freeze(xs.map(Object.freeze));
test('Original10E/31C: every original branch/text/argument, independent A3 records, and actual END after direct execution or branded9F resume', async () => {
  const report = JSON.parse(
    await readFile('analysis/render-task-script-bodies-input-wait-native.json'),
  );
  for (const s of specs) {
    const edges = new Set();
    for (const v of bodyCases(s)) {
      const result = s.id === 0x31c ? runWaitBodyFixture(s, v) : null,
        f = result?.fixture ?? fixture(s, v),
        p = result?.plan ?? prepared(start, f);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.deepEqual(p.bodyPCs, inputWaitBodyPCs(s, v));
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.resultWord, 0xbeef);
      assert.deepEqual(
        report.probes.find((p) => p.script_id === s.id && p.case === v.name),
        result ? waitBodyProbe(s, v) : bodyProbe(s, v),
      );
      for (let n = 1; n < p.bodyPCs.length; n++) edges.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
      const a3 = p.steps.find((p) => p.calleeEntry === 0x80f953),
        c8 = p.steps.find((p) => p.calleeEntry === 0x80fec1),
        calls = s.id !== 0x10e || v.state !== 0;
      assert.equal(!!a3, calls);
      assert.equal(!!c8, calls);
      if (calls) {
        assert.equal(a3.callee.iterations, v.repeated ? 2 : 1);
        assert.equal(a3.waitObservationsUsed, v.repeated ? 4 : 1);
        assert.equal(a3.inputObservationsUsed, v.repeated ? 2 : 1);
        assert.equal(c8.callee.text.glyphs, s.id === 0x31c ? 21 : v.state <= 2 ? 55 : 26);
        assert.equal(c8.callee.text.newlines, 0);
        assert.equal(a3.calleeReturnWord, 0xf508);
        assert.equal(a3.resultPushed, false);
        assert.equal(c8.arguments.wordPops, 7);
      }
      if (s.id === 0x10e) {
        assert.equal(p.outputContext.s, 0xb01);
        commitTaskPlan(f.data, p);
        assert.equal(word(f.data, 0x7e2de2), v.input);
        assert.equal(word(f.data, 0x801ce9), 0x7fff);
      } else {
        assert.deepEqual(
          result.segments.map((s) => s.segmentHandlers),
          [12, 2],
        );
        assert.equal(result.segments[1].inputObservationsUsed, 0);
        assert.equal(result.segments[1].waitObservationsUsed, 0);
        assert.equal(p.outputContext.s, 0xaff);
      }
    }
    assert.deepEqual([...edges].sort(), s.edges.map((e) => e.from + ':' + e.to).sort());
  }
});
test('Original A3 bodies: global C8/counter/input ledger chronology, reset and exhausted budget withhold earlier text/body writes', () => {
  for (const s of specs) {
    const f = fixture(s, { state: 3, input: 0xcaff, repeated: true }),
      p = prepared(start, f);
    for (const key of ['ioObservations', 'waitObservations', 'inputObservations']) {
      const reason =
        key === 'ioObservations'
          ? 'task_io_observation_required'
          : key === 'waitObservations'
            ? 'task_wait_observation_required'
            : 'task_input_observation_required';
      // Equal counter polls may be absent in a different valid observation run;
      // test missing final required data rather than assume a fixed poll count.
      unchangedFailure(start, f, { [key]: freeze(f[key].slice(0, -1)) }, reason);
      unchangedFailure(
        start,
        f,
        { [key]: freeze([...f[key], f[key].at(-1)]) },
        reason.replace('_required', '_unused'),
      );
    }
    unchangedFailure(
      start,
      f,
      {
        inputObservations: freeze([
          { ...f.inputObservations[0], value: 0x3030 },
          ...f.inputObservations.slice(1),
        ]),
      },
      'task_reset_source_required',
    );
    unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      start,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    prepared(start, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    for (const a of scriptBodyNativeSources.find((n) => n.id === 0xa3).anchors)
      unchangedFailure(start, omit(f, a.address + 1), {}, 'render_source_required');
  }
});
test('Original31C: committed C8/A3 prefix survives late END and observations cannot be replayed into resume', () => {
  const s = specs.find((s) => s.id === 0x31c),
    f = fixture(s),
    p = prepared(start, f);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  const r = resumeBodyFixture(s, f, p);
  prepared(resume, r);
  unchangedFailure(
    resume,
    r,
    { inputObservations: f.inputObservations },
    'task_input_observation_unused',
  );
  unchangedFailure(
    resume,
    r,
    { waitObservations: freeze(f.waitObservations.filter((o) => o.pc === 0x81b0a5)) },
    'task_wait_observation_unused',
  );
  f.data.seed(s.scriptEntry + 2 + 24, [0]);
  unchangedFailure(resume, r, {}, 'task_script_body_bytes_required');
  assert.equal(word(f.data, 0x7e1c76), 6);
  assert.equal(word(f.data, 0x8001cc), 0x40);
});
