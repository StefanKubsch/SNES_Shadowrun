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
import {
  runWaitBodyFixture,
  resumeBodyFixture,
  waitBodyProbe,
} from './task-script-body-wait-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
const s = scriptBodySpecs.find((s) => s.id === 0x1a9);
test('Whole original1A9: one chronological audio/two-PPU ledger, all D2/cache paths, full motion WORDs, 120 genuine readiness entries and actual B9/END', async () => {
  const report = JSON.parse(await readFile('analysis/render-task-script-bodies-mixed-native.json'));
  for (const v of bodyCases(s)) {
    const { fixture: f, plan: p, segments } = runWaitBodyFixture(s, v),
      prefix = segments[0],
      audio = prefix.steps.find((s) => s.calleeEntry === 0x80c46e),
      rng = prefix.steps.filter((s) => s.calleeEntry === 0x80c560);
    assert.equal(p.bodyComplete, true);
    assert.equal(p.fullTaskBinding, false);
    assert.deepEqual(
      p.bodyPCs,
      s.instructions.map((i) => i.pc),
    );
    assert.equal(p.handlersExecuted, 36);
    assert.equal(p.observedReadinessEntries, 120);
    assert.equal(segments.length, 121);
    assert.equal(segments.filter((s) => s.segmentHandlers === 0).length, 119);
    assert.equal(prefix.observationsUsed, v.cachedSound === 0x8034 ? 11 : 14);
    assert.equal(audio.callee.sound, 0x8034);
    assert.equal(audio.callee.voice, 3);
    assert.equal(audio.callee.loaderUsed, v.cachedSound !== 0x8034);
    assert.equal(rng.length, 2);
    for (const r of rng) {
      assert.equal(r.arguments.wordPops, 0);
      assert.equal(r.arguments.metadataWord, 0x0100);
      assert.equal(r.metadataWord, 2);
      assert.equal(r.resultPushed, true);
      assert.equal(r.calleeReturnWord, 0xf508);
      assert.equal(r.calleeReturnTarget, 0x80f509);
    }
    assert.deepEqual(
      prefix.ioRequests
        .filter((r) => r.kind === 'read')
        .slice(-6)
        .map((r) => [r.pc, r.value]),
      [
        [0x80c566, 123],
        [0x80c572, 26],
        [0x80c57f, 1],
        [0x80c566, 123],
        [0x80c572, 143],
        [0x80c57f, 0],
      ],
    );
    assert.equal(
      segments.slice(1).every((p) => p.observationsUsed === 0 && p.ioRequests.length === 0),
      true,
    );
    assert.deepEqual(
      [0x800d30, 0x800d88, 0x800de0].map((a) => word(f.data, a)),
      [4, 65535, 5],
    );
    assert.equal(word(f.data, 0x801410), 0x9235);
    assert.equal(word(f.data, 0x801468), 0);
    assert.equal(word(f.data, 0x7e3f38), 65535);
    assert.equal(p.resultWord, 0xbeef);
    assert.equal(p.returnTarget, 0x80c20b);
    assert.equal(p.outputContext.s, 0xaff);
    assert.equal(p.outputContext.d, 0);
    assert.equal(p.outputContext.bank, 0x9e);
    assert.deepEqual(
      report.probes.find((p) => p.case === v.name),
      waitBodyProbe(s, v),
    );
  }
});
test('Original1A9: every original byte/fetchhigh/ROM WORD high and reached metadata high, ordered global samples and exact budgets are mandatory atomically', () => {
  const f = fixture(s),
    p = prepared(start, f);
  for (let n = 0; n < s.bytecode.length + 3; n++)
    unchangedFailure(start, omit(f, s.scriptEntry + n), {}, 'render_source_required');
  for (const r of s.romReads)
    unchangedFailure(start, omit(f, r.address + 1), {}, 'render_source_required');
  for (const id of new Set(
    s.instructions
      .filter((i) => i.opcode === 0x58 && p.bodyPCs.includes(i.pc))
      .map((i) => i.operand),
  ))
    for (const a of scriptBodyNativeSources.find((n) => n.id === id).anchors)
      unchangedFailure(start, omit(f, a.address + 1), {}, 'render_source_required');
  for (let n = 0; n < f.ioObservations.length; n++)
    unchangedFailure(
      start,
      f,
      { ioObservations: Object.freeze(f.ioObservations.filter((_, i) => i !== n)) },
      'task_io_observation_required',
    );
  unchangedFailure(
    start,
    f,
    { ioObservations: Object.freeze([...f.ioObservations, f.ioObservations[0]]) },
    'task_io_observation_unused',
  );
  unchangedFailure(
    start,
    f,
    {
      ioObservations: Object.freeze([
        ...f.ioObservations.slice(-6),
        ...f.ioObservations.slice(0, -6),
      ]),
    },
    'task_io_observation_required',
  );
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
test('Original1A9: real committed prefix capability, stale/forged/uncommitted rejection, no reused IO at blocked or ready C1F9, event1 does not replace counter120', () => {
  const f = fixture(s),
    p = prepared(start, f),
    uncommitted = resumeBodyFixture(s, f, p);
  unchangedFailure(resume, uncommitted, {}, 'task_script_body_continuation_required');
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  let latest = p;
  const first = resumeBodyFixture(s, f, latest);
  sampleWord(f.data, 0x800c64, 1);
  unchangedFailure(
    resume,
    first,
    { continuation: { ...latest } },
    'task_script_body_continuation_required',
  );
  unchangedFailure(
    resume,
    first,
    { ioObservations: f.ioObservations },
    'task_io_observation_unused',
  );
  for (let n = 1; n < 120; n++) {
    const next = prepared(resume, resumeBodyFixture(s, f, latest));
    assert.equal(next.segmentHandlers, 0);
    assert.equal(commitTaskPlan(f.data, next).handled, true);
    latest = next;
  }
  unchangedFailure(resume, first, {}, 'task_script_body_continuation_required');
  const ready = resumeBodyFixture(s, f, latest),
    done = prepared(resume, ready);
  assert.equal(done.bodyComplete, true);
  assert.equal(done.segmentHandlers, 4);
  unchangedFailure(
    resume,
    ready,
    { ioObservations: f.ioObservations },
    'task_io_observation_unused',
  );
  unchangedFailure(resume, ready, { maxWork: done.work - 1 }, 'task_work_budget_required');
  const b9 = scriptBodyNativeSources.find((n) => n.id === 0xb9).anchors[2],
    oldHigh = f.data.readByte(b9.address + 1).value;
  f.data.seed(b9.address + 1, [oldHigh ^ 1]);
  unchangedFailure(resume, ready, {}, 'task_script_body_bytes_required');
  f.data.seed(b9.address + 1, [oldHigh]);
  // The source mutation changes the version, so freshly prepare the valid
  // completion after restoring the observation before its real owner commit.
  const freshDone = prepared(resume, ready);
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, { ...done }).reason, 'task_plan_owner_required');
  assert.deepEqual(f.data.snapshot(), before);
  assert.equal(commitTaskPlan(f.data, freshDone).handled, true);
  assert.equal(word(f.data, 0x800c04), 0);
});
test('Original1A9: a late real voice-cache write changes saved4C ID and withholds every prior prefix effect', () => {
  const f = fixture(s),
    g = { ...f, context: Object.freeze({ ...f.context, d: 0x1cd9 }) };
  for (const [address, value] of [
    [0x1cd9, 0xb59a],
    [0x1cda, 0x9eb5],
    [0x1cdc, 0],
    [0x1ce0, 0x7ff],
    [0x1ce2, 0x1a9],
    [0x800254, 0x1cd9],
  ])
    sampleWord(f.data, address, value);
  f.data.seed(0x1cec, [0xa5, 0xa5]);
  const changed = unchangedFailure(start, g, {}, 'task_native_resume_id_required');
  assert.equal(changed.nativeId, 3);
});
test('Original1A9: real PPU state store aliases the live script pointer after successful cache audio; supplied wrong-stream bytes still cannot bypass the body guard', () => {
  const f = fixture(s, { cachedSound: 0x8034 });
  for (const [address, value] of [
    [0x1ce7, 0xb59a],
    [0x1ce8, 0x9eb5],
    [0x1cea, 0],
    [0x1cee, 0x7ff],
    [0x1cf0, 0x1a9],
    [0x800254, 0x1ce7],
  ])
    sampleWord(f.data, address, value);
  f.data.seed(0x1cfa, [0xa5, 0xa5]);
  const g = { ...f, context: Object.freeze({ ...f.context, d: 0x1ce7 }) };
  const failed = unchangedFailure(start, g, {}, 'render_source_required');
  assert.equal(failed.address, 0x9ef4ba);
  f.data.seed(0x9ef4ba, [0, 7]);
  unchangedFailure(start, g, {}, 'task_script_body_pointer_required');
});
