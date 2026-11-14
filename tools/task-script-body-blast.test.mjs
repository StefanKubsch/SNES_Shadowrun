import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs, scriptBodyNativeSources } from '../proof/task/script-body-specs.mjs';
import {
  scriptBodyFixture,
  bodyCases,
  bodyWord as word,
  omitBodyBytes as omit,
} from './task-script-body-fixtures.mjs';
import {
  runWaitBodyFixture,
  resumeBodyFixture,
  waitBodyProbe,
} from './task-script-body-wait-fixtures.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
const specs = scriptBodySpecs.filter((s) => s.blastBody);
for (const s of specs)
  test(`Whole original${s.id.toString(16)} retains own byte/ROM roots, real7C/return-PHA/drop, distinct yield/readiness and END`, async () => {
    const report = JSON.parse(
      await readFile('analysis/render-task-script-bodies-blast-native.json'),
    );
    assert.equal(s.bytecode.length, s.id === 0x136 ? 41 : 37);
    assert.equal(s.instructions.length, s.id === 0x136 ? 26 : 24);
    for (const v of bodyCases(s)) {
      const { fixture: f, plan: p, segments } = runWaitBodyFixture(s, v),
        call = p.steps.find((p) => p.calleeEntry === 0x808e36);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.observedReadinessEntries, s.id === 0x136 ? 40 : 1);
      assert.equal(p.handlersExecuted, s.instructions.length);
      assert.deepEqual(
        p.bodyPCs,
        s.instructions.map((i) => i.pc),
      );
      assert.equal(call.arguments.wordPops, 2);
      assert.equal(call.metadataWord, 2);
      assert.equal(call.resultPushed, true);
      assert.equal(call.calleeReturnWord, 0xf508);
      assert.equal(call.calleeReturnTarget, 0x80f509);
      assert.equal(call.callee.visits, 44);
      assert.equal(word(f.data, 0x7e3f38), 65535);
      assert.equal(call.callee.affected, v.active === null || v.dx === 96 ? 0 : 1);
      if (v.name === 'damage-original-record') assert.equal(word(f.data, 0x7e4002), 4);
      if (v.name === 'damage-original-task-fallback') assert.equal(word(f.data, 0x800c62), 0x1a34);
      if (v.name === 'negative-task-WORD-store') assert.equal(word(f.data, 0x7f0001), 1);
      if (s.id === 0x136) {
        const a9 = p.steps.find((p) => p.calleeEntry === 0x80a835);
        assert.equal(a9.wordPops, 5);
        assert.equal(word(f.data, 0x7e3f7e), 184);
        assert.equal(
          segments.slice(1, -1).every((p) => (p.ioRequests?.length ?? 0) === 0),
          true,
        );
      } else
        assert.equal(
          p.steps.some((p) => p.calleeEntry === 0x80c46e),
          true,
        );
      assert.deepEqual(
        report.probes.find((p) => p.script_id === s.id && p.case === v.name),
        waitBodyProbe(s, v),
      );
    }
  });
test('Original1E8 full argument/local/native/record highs and late originalROM/budget/alias failures preserve the entire current segment', () => {
  const s = specs.find((s) => s.id === 0x1e8),
    f = scriptBodyFixture(s, { flags: 0xa000 }),
    p = prepared(start, f);
  for (let n = 0; n < s.bytecode.length + 3; n++)
    unchangedFailure(start, omit(f, s.scriptEntry + n), {}, 'render_source_required');
  for (const r of s.romReads)
    unchangedFailure(start, omit(f, r.address + 1), {}, 'render_source_required');
  for (const a of [0x801, 0x614, 0x8013c9])
    unchangedFailure(start, omit(f, a), {}, 'render_source_required');
  for (const native of scriptBodyNativeSources.filter((n) =>
    s.instructions.some((i) => p.bodyPCs.includes(i.pc) && i.opcode === 0x58 && i.operand === n.id),
  ))
    for (const a of native.anchors)
      unchangedFailure(start, omit(f, a.address + 1), {}, 'render_source_required');
  prepared(start, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(start, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  unchangedFailure(
    start,
    f,
    { protectedStackBytes: [...f.protectedStackBytes, 0x7e4002] },
    'task_stack_alias_required',
  );
  const high = scriptBodyFixture(s, { flags: 0xa000 });
  sampleWord(high.data, 0x800, 0xab10);
  const q = prepared(start, high);
  assert.equal(q.bodySuspended, true);
});
test('Original136 first prefix cannot count as complete; late7C failures keep forty prior committed readiness entries and no partial native writes', () => {
  const s = specs.find((s) => s.id === 0x136),
    f = scriptBodyFixture(s, { flags: 0xa000 });
  let p = prepared(start, f);
  assert.equal(p.bodyComplete, false);
  assert.equal(p.bodySuspended, true);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  for (let n = 0; n < 39; n++) {
    p = prepared(resume, resumeBodyFixture(s, f, p));
    assert.equal(p.segmentHandlers, 0);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
  }
  const ready = resumeBodyFixture(s, f, p),
    before = f.data.snapshot();
  unchangedFailure(
    resume,
    ready,
    { ioObservations: Object.freeze([]) },
    'task_io_observation_required',
  );
  assert.deepEqual(f.data.snapshot(), before);
  assert.equal(word(f.data, 0x7e4002), 5);
  assert.equal(word(f.data, 0x7e3f7e), 65535);
  const complete = prepared(resume, ready);
  assert.equal(complete.bodyComplete, true);
  assert.equal(complete.observedReadinessEntries, 40);
  assert.equal(commitTaskPlan(f.data, complete).handled, true);
  assert.equal(word(f.data, 0x7e4002), 4);
});
