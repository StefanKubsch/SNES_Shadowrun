import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import {
  scriptBodyFixture,
  bodyCases,
  bodyWord,
  omitBodyBytes,
} from './task-script-body-fixtures.mjs';
import {
  runWaitBodyFixture,
  resumeBodyFixture,
  waitBodyProbe,
} from './task-script-body-wait-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
const spec = scriptBodySpecs.find((s) => s.id === 0x16e);
function prefixBefore(target) {
  const f = scriptBodyFixture(spec);
  let p = prepared(start, f);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  for (let n = 1; n < target; n++) {
    if (bodyWord(f.data, 0x800ba4) === 8) sampleWord(f.data, 0x800c64, 8);
    p = prepared(resume, resumeBodyFixture(spec, f, p));
    assert.equal(commitTaskPlan(f.data, p).handled, true);
  }
  return { f, p, later: resumeBodyFixture(spec, f, p) };
}
test('Original16E: all full paths retain 11 genuine yields, 1391 observed readiness entries and three separately observed audio calls', async () => {
  const report = JSON.parse(
    await readFile('analysis/render-task-script-bodies-audio-multi-native.json'),
  );
  for (const variant of bodyCases(spec)) {
    const { fixture: f, plan: p, segments, observations } = runWaitBodyFixture(spec, variant);
    assert.equal(p.bodyComplete, true);
    assert.equal(p.fullTaskBinding, false);
    assert.deepEqual(
      p.bodyPCs,
      spec.instructions.map((i) => i.pc),
    );
    assert.equal(p.handlersExecuted, 117);
    assert.equal(segments.length, 1392);
    assert.equal(p.observedReadinessEntries, 1391);
    assert.equal(
      spec.instructions.filter((i) => i.opcode === 0x58 && i.operand === 0x9f).length,
      11,
    );
    assert.deepEqual(
      observations.filter((o) => o.kind === 'synthetic-provider-event-byte').map((o) => o.value),
      [8],
    );
    const audio = segments
      .map((p, n) => ({ p, n }))
      .filter(({ p }) => p.accesses.some((a) => a.label === 'saved-ID-low' && a.value === 0x4c));
    assert.deepEqual(
      audio.map(({ n }) => n),
      [660, 770, 971],
    );
    assert.deepEqual(
      audio.map(({ p }) => p.observationsUsed),
      [5, variant.cachedSound === 0x8031 ? 4 : 7, 4],
    );
    const calls = p.steps.filter((s) => s.calleeEntry === 0x80c46e);
    assert.deepEqual(
      calls.map((c) => c.callee.sound),
      [0x20, 0x8031, 0x1e],
    );
    assert.deepEqual(
      calls.map((c) => c.callee.voiceCacheHit),
      [false, true, true],
    );
    for (const c of calls) {
      assert.equal(c.callee.voice, 255);
      assert.equal(c.arguments.wordPops, 4);
      assert.equal(c.calleeReturnWord, 0xf508);
      assert.equal(c.calleeReturnTarget, 0x80f509);
      assert.equal(c.resultPushed, false);
    }
    assert.equal(p.resultWord, 0xbeef);
    assert.equal(p.returnTarget, 0x80c20b);
    assert.equal(bodyWord(f.data, 0x801468), 0xbeaf);
    assert.deepEqual(
      [0x800d30, 0x800d88, 0x800de0].map((a) => bodyWord(f.data, a)),
      [0, 4, 0],
    );
    assert.deepEqual(
      report.probes.find((r) => r.case === variant.name),
      waitBodyProbe(spec, variant),
    );
  }
});
test('Original16E: five A9 arguments create definition00DA with wrapped coordinates and the unvisited original03A5 frame', () => {
  const { fixture: f, plan: p } = runWaitBodyFixture(spec),
    create = p.steps.find((s) => s.calleeEntry === 0x80a835);
  assert.equal(create.wordPops, 5);
  assert.equal(create.resultPushed, true);
  assert.equal(create.metadataWord, 2);
  assert.equal(create.calleeReturnWord, 0xf508);
  assert.equal(create.calleeReturnTarget, 0x80f509);
  assert.deepEqual(
    [0x7e3f7e, 0x800e7e, 0x800ed6, 0x800f2e, 0x8014ae].map((a) => bodyWord(f.data, a)),
    [218, 0xffbc, 20, 48, 0],
  );
  assert.equal(bodyWord(f.data, 0x8013a6), 4);
  assert.equal(bodyWord(f.data, 0x8014b2), 86);
  assert.equal(bodyWord(f.data, 0x8003d6), 0xfee4);
  assert.equal(bodyWord(f.data, 0x8003d8), 0x9e);
  assert.equal(p.bodyPCs.includes(194), false);
  assert.equal(bodyWord(f.data, 0x800d88), 4);
  assert.equal(spec.romReads.find((r) => r.address === 0x8cf4d0).value, 0);
  assert.equal(spec.romReads.find((r) => r.address === 0x82e61b).value, 0xfee2);
});
test('Original16E: every ROM WORD high including callback metadata and END-fetch-high is mandatory before initial yield', () => {
  const f = scriptBodyFixture(spec);
  for (const r of spec.romReads)
    unchangedFailure(start, omitBodyBytes(f, r.address + 1), {}, 'render_source_required');
  for (const a of [spec.scriptEntry, spec.scriptEntry + 1, spec.scriptEntry + 196])
    unchangedFailure(start, omitBodyBytes(f, a), {}, 'render_source_required');
});
test('Original16E: future audio cannot be spent by initial or blocked entry and only the latest committed prefix resumes', () => {
  const f = scriptBodyFixture(spec),
    p = prepared(start, f);
  unchangedFailure(
    start,
    f,
    { ioObservations: f.audioResumeByPC[36] },
    'task_io_observation_unused',
  );
  unchangedFailure(
    resume,
    resumeBodyFixture(spec, f, p),
    {},
    'task_script_body_continuation_required',
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  const later = resumeBodyFixture(spec, f, p);
  unchangedFailure(
    resume,
    later,
    { continuation: { ...p } },
    'task_script_body_continuation_required',
  );
  unchangedFailure(
    resume,
    later,
    { ioObservations: f.audioResumeByPC[36] },
    'task_io_observation_unused',
  );
  const q = prepared(resume, later);
  assert.equal(q.segmentHandlers, 0);
  assert.equal(commitTaskPlan(f.data, q).handled, true);
  unchangedFailure(resume, later, {}, 'task_script_body_continuation_required');
});
test('Original16E: every late audio observation and segment budget failure preserves earlier committed effects', () => {
  const { f, p, later } = prefixBefore(770),
    q = prepared(resume, later);
  assert.equal(bodyWord(f.data, 0x801468), 0xbeaf);
  assert.equal(later.ioObservations.length, 7);
  for (let n = 0; n < later.ioObservations.length; n++)
    unchangedFailure(
      resume,
      later,
      { ioObservations: menuRecords(later.ioObservations.filter((_, i) => i !== n)) },
      'task_io_observation_required',
    );
  unchangedFailure(
    resume,
    later,
    { ioObservations: f.audioResumeByPC[36] },
    'task_io_observation_required',
  );
  unchangedFailure(resume, later, { maxWork: q.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    resume,
    later,
    { maxOutputBytes: q.outputBytes - 1 },
    'task_output_budget_required',
  );
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, { ...q }).reason, 'task_plan_owner_required');
  assert.deepEqual(f.data.snapshot(), before);
  assert.equal(commitTaskPlan(f.data, q).handled, true);
  assert.equal(p.bodyComplete, false);
  assert.equal(q.bodyComplete, false);
});
test('Original16E: motion stores do not manufacture event8 readiness and timer zero still wraps toFFFF', () => {
  const { f, later } = prefixBefore(891),
    blocked = prepared(resume, later);
  assert.equal(blocked.segmentHandlers, 0);
  assert.equal(blocked.bodyComplete, false);
  sampleWord(f.data, 0x800c64, 8);
  const ready = prepared(resume, later);
  assert.ok(ready.segmentHandlers > 0);
  const initial = scriptBodyFixture(spec),
    p = prepared(start, initial);
  assert.equal(commitTaskPlan(initial.data, p).handled, true);
  sampleWord(initial.data, 0x800c04, 0);
  const q = prepared(resume, resumeBodyFixture(spec, initial, p));
  assert.equal(q.segmentHandlers, 0);
  assert.equal(commitTaskPlan(initial.data, q).handled, true);
  assert.equal(bodyWord(initial.data, 0x800c04), 65535);
});
