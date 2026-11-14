import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs, scriptBodyNativeSources } from '../proof/task/script-body-specs.mjs';
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
const specs = scriptBodySpecs.filter(
    (s) =>
      s.audioWait &&
      !s.localWaitBody &&
      !s.multiAudioWait &&
      !s.random63Observations &&
      !s.directionBody &&
      !s.recordAndWaitBody,
  ),
  at = (id) => specs.find((s) => s.id === id);
const readiness = (spec, f, p) => resumeBodyFixture(spec, f, p);
for (const spec of specs)
  test(`Whole original audio/wait body${spec.id.toString(16)}: genuine yield/readiness/actualF508/F509/audio/release/END across committed observed segments`, async () => {
    const report = JSON.parse(
        await readFile('analysis/render-task-script-bodies-audio-wait-native.json'),
      ),
      edges = new Set();
    for (const variant of bodyCases(spec)) {
      const { fixture: f, plan: p, segments } = runWaitBodyFixture(spec, variant),
        pcs = spec.instructions.map((i) => i.pc),
        audioSegment = segments.find((s) =>
          s.accesses.some((a) => a.label === 'saved-ID-low' && a.value === 0x4c),
        ),
        audio = audioSegment.steps.find((s) => s.calleeEntry === 0x80c46e),
        voice = [0x99, 0x21a, 0x37a].includes(spec.id) ? 255 : 3,
        sound = spec.romReads.find((r) => r.address >= 0x80c4b3 && r.address < 0x80c520).value;
      assert.equal(p.bodyComplete, true);
      assert.equal(p.bodySuspended, undefined);
      assert.equal(p.fullTaskBinding, false);
      assert.deepEqual(p.bodyPCs, pcs);
      assert.equal(p.handlersExecuted, pcs.length);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.outputContext.s, 0xaff);
      assert.equal(p.outputContext.d, 0);
      assert.equal(p.outputContext.bank, spec.scriptEntry >>> 16);
      assert.equal(bodyWord(f.data, 0xb00), 0xc20a);
      assert.equal(p.observedReadinessEntries, spec.id === 0x4b ? 5 : spec.id === 0x149 ? 10 : 1);
      assert.equal(
        segments.filter((s) => s.segmentHandlers === 0).length,
        spec.id === 0x4b ? 4 : spec.id === 0x149 ? 9 : 0,
      );
      assert.equal(segments[0].bodyComplete, false);
      assert.equal(segments[0].bodySuspended, true);
      assert.equal(segments[0].frontier, 'actual-native-wait-yield-target');
      assert.equal(audio.arguments.wordPops, 4);
      assert.equal(audio.arguments.metadataWord, 0x0104);
      assert.equal(audio.calleeReturnWord, 0xf508);
      assert.equal(audio.calleeReturnTarget, 0x80f509);
      assert.equal(audio.metadataWord, 0);
      assert.equal(audio.resultPushed, false);
      assert.equal(audio.callee.sound, sound);
      assert.equal(audio.callee.voice, voice);
      assert.equal(
        audio.callee.loaderUsed,
        Boolean(sound & 32768) && variant.cachedSound !== sound,
      );
      assert.equal(
        audioSegment.observationsUsed,
        spec.id === 0x4b ? f.audioResumeObservations.length : f.ioObservations.length,
      );
      assert.equal(audioSegment.waitObservationsUsed, 0);
      assert.equal(audioSegment.inputObservationsUsed, 0);
      assert.equal(audioSegment, spec.id === 0x4b ? segments.at(-1) : segments[0]);
      if (spec.id !== 0x4b) {
        assert.equal(bodyWord(f.data, 0x7e3f38), 65535);
        assert.equal(bodyWord(f.data, 0x801410), 0x9235);
      }
      for (let n = 1; n < pcs.length; n++) edges.add(pcs[n - 1] + ':' + pcs[n]);
      assert.deepEqual(
        report.probes.find((r) => r.script_id === spec.id && r.case === variant.name),
        waitBodyProbe(spec, variant),
      );
    }
    assert.deepEqual([...edges].sort(), spec.edges.map((e) => e.from + ':' + e.to).sort());
  });
test('Audio/wait bodies: every original byte, all ROM WORD/table highs and reached native metadata highs remain mandatory at initial and later entry', () => {
  for (const spec of specs) {
    const f = scriptBodyFixture(spec),
      p = prepared(start, f);
    for (let n = 0; n < spec.bytecode.length + 3; n++)
      unchangedFailure(start, omitBodyBytes(f, spec.scriptEntry + n), {}, 'render_source_required');
    for (const r of spec.romReads)
      unchangedFailure(start, omitBodyBytes(f, r.address + 1), {}, 'render_source_required');
    for (const native of scriptBodyNativeSources.filter((n) =>
      p.bodyPCs.some((pc) =>
        spec.instructions.some((i) => i.pc === pc && i.opcode === 0x58 && i.operand === n.id),
      ),
    ))
      for (const a of native.anchors)
        unchangedFailure(start, omitBodyBytes(f, a.address + 1), {}, 'render_source_required');
    const uncommitted = readiness(spec, f, p);
    unchangedFailure(resume, uncommitted, {}, 'task_script_body_continuation_required');
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    const later = readiness(spec, f, p);
    const q = { ...p };
    unchangedFailure(resume, later, { continuation: q }, 'task_script_body_continuation_required');
    f.data.seed(spec.scriptEntry + spec.bytecode.length + 2, [spec.fetchTail ^ 1]);
    unchangedFailure(resume, later, {}, 'task_script_body_bytes_required');
  }
});
test('Original04B: count5 visits are independent observations, eventbit1 cannot replace countdown, count0 wraps toFFFF without invented guard', () => {
  const s = at(0x4b),
    r = runWaitBodyFixture(s, { event: 1 }),
    counts = r.segments
      .slice(1)
      .map(
        (p) =>
          p.accesses.find(
            (a) => a.kind === 'write' && a.address === 0x800c04 && a.label === 'visit-DBR-WORD-low',
          ).value,
      );
  assert.deepEqual(counts, [4, 3, 2, 1, 0]);
  assert.equal(r.segments.length, 6);
  assert.equal(r.observations.filter((o) => o.kind === 'synthetic-observed-C1F9').length, 5);
  const f = scriptBodyFixture(s),
    p = prepared(start, f);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  sampleWord(f.data, 0x800c04, 0);
  const later = readiness(s, f, p),
    q = prepared(resume, later);
  assert.equal(q.bodyComplete, false);
  assert.equal(q.bodySuspended, true);
  assert.equal(q.segmentHandlers, 0);
  assert.equal(commitTaskPlan(f.data, q).handled, true);
  assert.equal(bodyWord(f.data, 0x800c04), 65535);
});
test('Original04B: future audio records reject initial yield and blocked readiness; committed prefixes are incomplete and every unused wait/control record is rejected', () => {
  const s = at(0x4b),
    f = scriptBodyFixture(s),
    p = prepared(start, f);
  unchangedFailure(
    start,
    f,
    { ioObservations: f.audioResumeObservations },
    'task_io_observation_unused',
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  const later = readiness(s, f, p);
  assert.equal(later.ioObservations.length, 0);
  unchangedFailure(
    resume,
    later,
    { ioObservations: f.audioResumeObservations },
    'task_io_observation_unused',
  );
  unchangedFailure(
    resume,
    later,
    { waitObservations: menuRecords([{ pc: 0x81acaf, address: 0x8001f8, width: 2, value: 0 }]) },
    'task_wait_observation_unused',
  );
  unchangedFailure(
    resume,
    later,
    { inputObservations: menuRecords([{ pc: 0x809e1a, address: 0x8001ca, width: 2, value: 1 }]) },
    'task_input_observation_unused',
  );
  const q = prepared(resume, later);
  assert.equal(q.bodyComplete, false);
  assert.equal(q.segmentHandlers, 0);
  assert.equal(commitTaskPlan(f.data, q).handled, true);
  unchangedFailure(resume, later, {}, 'task_script_body_continuation_required');
});
test('Audio before yield: every device record and exact prefix budget is atomic; later entry cannot reuse consumed audio observations', () => {
  for (const s of specs.filter((s) => s.id !== 0x4b)) {
    const f = scriptBodyFixture(s),
      p = prepared(start, f);
    for (let n = 0; n < f.ioObservations.length; n++)
      unchangedFailure(
        start,
        f,
        { ioObservations: menuRecords(f.ioObservations.filter((_, i) => i !== n)) },
        'task_io_observation_required',
      );
    unchangedFailure(
      start,
      f,
      { ioObservations: menuRecords([...f.ioObservations, f.ioObservations.at(-1)]) },
      'task_io_observation_unused',
    );
    unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      start,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    const later = readiness(s, f, p);
    if (s.id !== 0x149) sampleWord(f.data, 0x800c64, 8);
    unchangedFailure(
      resume,
      later,
      { ioObservations: f.ioObservations },
      'task_io_observation_unused',
    );
  }
});
test('Audio after readiness: actual count1/realPEA/whole audio/END and all late IO/metadata/return/budget failures stay private within the resumed segment', () => {
  const s = at(0x4b),
    f = scriptBodyFixture(s);
  let p = prepared(start, f);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  for (let n = 0; n < 4; n++) {
    const next = prepared(resume, readiness(s, f, p));
    assert.equal(next.segmentHandlers, 0);
    assert.equal(commitTaskPlan(f.data, next).handled, true);
    p = next;
  }
  const later = readiness(s, f, p),
    q = prepared(resume, later);
  assert.equal(q.bodyComplete, true);
  assert.equal(q.observationsUsed, 5);
  for (let n = 0; n < later.ioObservations.length; n++)
    unchangedFailure(
      resume,
      later,
      { ioObservations: menuRecords(later.ioObservations.filter((_, i) => i !== n)) },
      'task_io_observation_required',
    );
  unchangedFailure(resume, later, { maxWork: q.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    resume,
    later,
    { maxOutputBytes: q.outputBytes - 1 },
    'task_output_budget_required',
  );
  unchangedFailure(
    resume,
    later,
    { maxHandlers: later.maxHandlers - 1 },
    'task_script_body_handler_count_required',
  );
  // Clone owner cannot inherit the committed body continuation capability.
  unchangedFailure(
    resume,
    omitBodyBytes(later, 0x82d9bd),
    {},
    'task_script_body_continuation_required',
  );
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, { ...q }).reason, 'task_plan_owner_required');
  assert.deepEqual(f.data.snapshot(), before);
  assert.equal(commitTaskPlan(f.data, q).handled, true);
  assert.equal(bodyWord(f.data, 0x800c04), 0);
});
test('OriginalB3: full WORD AND7FFE/OR8001 is retained before D2/audio and B9, without a BYTE mask or invented flags', () => {
  for (const motion of [0, 1, 0x7fff, 0x8000, 65535]) {
    const s = at(0x99),
      r = runWaitBodyFixture(s, { motion });
    assert.equal(bodyWord(r.fixture.data, 0x801410), (motion & 0x7ffe) | 0x8001);
  }
});
