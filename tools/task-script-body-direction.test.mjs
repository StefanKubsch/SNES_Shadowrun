import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs, scriptBodyNativeSources } from '../proof/task/script-body-specs.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { createRenderData } from '../src/render/data.mjs';
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
import { directionBodyPCs } from './task-script-body-direction-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
const specs = scriptBodySpecs.filter((s) => s.directionBody),
  at = (id) => specs.find((s) => s.id === id);
function ready(s, v, nextPC, omitted = []) {
  const f = omit(scriptBodyFixture(s, v), ...omitted);
  let p = prepared(start, f);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  for (let n = 0; n < 700; n++) {
    const options = resumeBodyFixture(s, f, p);
    if (p.nextPC === nextPC && word(f.data, 0x800c04) === 1) return { f, p, options };
    p = prepared(resume, options);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.notEqual(p.bodyComplete, true);
  }
  throw Error('Missing declared original readiness');
}
for (const s of specs)
  test(`Whole original direction body${s.id.toString(16)}: all eight outcomes, actual countdown phases and every original edge through END`, async () => {
    const report = JSON.parse(
        await readFile('analysis/render-task-script-bodies-direction-native.json'),
      ),
      edges = new Set();
    for (const v of bodyCases(s)) {
      const r = runWaitBodyFixture(s, v),
        p = r.plan,
        hasDirection = v.direction !== undefined;
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.deepEqual(p.bodyPCs, directionBodyPCs(s, v));
      assert.equal(p.handlersExecuted, p.bodyPCs.length);
      const direction = p.steps.find((p) => p.calleeEntry === 0x80d1d2);
      assert.equal(!!direction, hasDirection);
      if (direction) {
        assert.equal(direction.wordPops, 1);
        assert.equal(direction.resultPushed, false);
        assert.equal(direction.calleeReturnWord, 0xf508);
        assert.equal(direction.calleeReturnTarget, 0x80f509);
        assert.equal(word(r.fixture.data, 0x8011a8), v.direction);
      }
      const readiness = hasDirection ? (s.id === 0x21b ? 120 : 525) : 0;
      assert.equal(p.observedReadinessEntries ?? 0, readiness);
      assert.equal(r.segments.length, readiness + 1);
      assert.equal(
        r.segments.filter((p) => p.bodySuspended && p.segmentHandlers === 0).length,
        hasDirection ? (s.id === 0x21b ? 119 : 523) : 0,
      );
      const active = r.segments.filter((p) => p.segmentHandlers > 0 || p.bodyComplete);
      if (s.id === 0x21b && hasDirection) {
        const audio = p.steps.find((p) => p.calleeEntry === 0x80c46e);
        assert.equal(audio.arguments.wordPops, 4);
        assert.equal(audio.callee.sound, 32);
        assert.equal(audio.callee.voice, 3);
        assert.deepEqual(
          active.map((p) => [p.segmentHandlers, p.observationsUsed, p.waitObservationsUsed]),
          [
            [12, 0, 0],
            [12, 4, 0],
          ],
        );
        assert.equal(word(r.fixture.data, 0x801360), 65535);
      } else if (s.id === 0x229) {
        const notice = p.steps.find((p) => p.calleeEntry === 0x80fec1);
        assert.equal(notice.callee.allocation, 14);
        assert.equal(notice.callee.text.glyphs, 47);
        assert.equal(notice.callee.text.bits, 201);
        assert.equal(notice.callee.text.newlines, 0);
        assert.deepEqual(
          active.map((p) => [p.segmentHandlers, p.observationsUsed, p.waitObservationsUsed]),
          [
            [8, 0, 0],
            [12, 2, 10],
            [4, 0, 0],
          ],
        );
      } else {
        assert.equal(word(r.fixture.data, 0x7e3f38), 65535);
        assert.equal(p.observationsUsed, 0);
      }
      for (let n = 1; n < p.bodyPCs.length; n++) edges.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
      assert.deepEqual(
        report.probes.find((p) => p.script_id === s.id && p.case === v.name),
        waitBodyProbe(s, v),
      );
    }
    assert.deepEqual([...edges].sort(), s.edges.map((e) => e.from + ':' + e.to).sort());
  });
test('Direction bodies: every original body/header/fetch high and reached ROM root high is independently mandatory before effects', () => {
  for (const s of specs) {
    const f = scriptBodyFixture(
        s,
        bodyCases(s).find((v) => v.direction === 1),
      ),
      p = prepared(start, f);
    for (let n = 0; n < s.bytecode.length + 3; n++)
      unchangedFailure(start, omit(f, s.scriptEntry + n), {}, 'render_source_required');
    for (const r of s.romReads)
      unchangedFailure(start, omit(f, r.address + 1), {}, 'render_source_required');
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
    for (const native of scriptBodyNativeSources.filter((n) =>
      p.steps.some((step) => step.id === n.id),
    ))
      for (const a of native.anchors)
        unchangedFailure(start, omit(f, a.address + 1), {}, 'render_source_required');
  }
});
test('Direction bodies: future audio/notice observations reject initial and blocked prefixes; branded committed count1 entry is required', () => {
  for (const s of specs) {
    const v = bodyCases(s).find((v) => v.direction === 1),
      f = scriptBodyFixture(s, v),
      p = prepared(start, f),
      future = s.audioWait ? f.audioResumeObservations : f.c8ResumeObservations.ioObservations;
    unchangedFailure(start, f, { ioObservations: future }, 'task_io_observation_unused');
    unchangedFailure(
      resume,
      resumeBodyFixture(s, f, p),
      {},
      'task_script_body_continuation_required',
    );
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    const options = resumeBodyFixture(s, f, p);
    assert.equal(options.ioObservations.length, 0);
    unchangedFailure(resume, options, { ioObservations: future }, 'task_io_observation_unused');
    const blocked = prepared(resume, options);
    assert.equal(blocked.segmentHandlers, 0);
    assert.equal(blocked.bodyComplete, false);
    assert.equal(commitTaskPlan(f.data, blocked).handled, true);
    unchangedFailure(resume, options, {}, 'task_script_body_continuation_required');
  }
});
test('Direction bodies: every reached audio/notice device and wait record is required in its own ready phase and late failure preserves prior commits', () => {
  for (const s of specs) {
    const { f, p, options } = ready(
        s,
        { name: 'direction1', guard: 0x8000, dx: 4, dy: 4, direction: 1 },
        s.id === 0x21b ? 22 : 15,
      ),
      q = prepared(resume, options),
      before = f.data.snapshot();
    for (let n = 0; n < options.ioObservations.length; n++)
      unchangedFailure(
        resume,
        options,
        { ioObservations: menuRecords(options.ioObservations.filter((_, i) => i !== n)) },
        'task_io_observation_required',
      );
    for (let n = 0; n < options.waitObservations.length; n++)
      unchangedFailure(
        resume,
        options,
        { waitObservations: menuRecords(options.waitObservations.filter((_, i) => i !== n)) },
        'task_wait_observation_required',
      );
    unchangedFailure(
      resume,
      options,
      { ioObservations: menuRecords([...options.ioObservations, options.ioObservations.at(-1)]) },
      'task_io_observation_unused',
    );
    unchangedFailure(resume, options, { maxWork: q.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      resume,
      options,
      { maxOutputBytes: q.outputBytes - 1 },
      'task_output_budget_required',
    );
    unchangedFailure(
      resume,
      options,
      { continuation: { ...p } },
      'task_script_body_continuation_required',
    );
    assert.deepEqual(f.data.snapshot(), before);
  }
});
test('Direction bodies: late Native6C metadata highs, fresh coordinate high and foreign copied owner withhold the whole final segment', () => {
  const s = at(0x229),
    v = { name: 'direction7', guard: 0x8000, dx: -4, dy: 4, direction: 7 };
  for (const address of [
    ...scriptBodyNativeSources.find((s) => s.id === 0x6c).anchors.map((a) => a.address + 1),
    0x800cc3,
    0x800e49,
  ]) {
    // The missing future byte is absent from the same owner from its start;
    // earlier original phases must finish before that byte is actually needed.
    const { f, options } = ready(s, v, 39, [address]),
      before = f.data.snapshot();
    unchangedFailure(resume, options, {}, 'render_source_required');
    assert.deepEqual(f.data.snapshot(), before);
    assert.equal(word(f.data, 0x7e021e + 6), 180);
  }
  const { f, options } = ready(s, v, 39),
    before = f.data.snapshot();
  // Copying even all committed notice bytes conveys no resume authority.
  const limited = createRenderData({
    writeWindows: [
      [0x7e0000, 0x7e00a7],
      [0x7e00aa, 0x7fffff],
    ],
  });
  for (const [a, v] of before.bytes) limited.seed(a, [v]);
  // A copied owner is rejected before any source-specific resume can run.
  unchangedFailure(
    resume,
    { ...options, data: limited },
    {},
    'task_script_body_continuation_required',
  );
  assert.deepEqual(f.data.snapshot(), before);
  assert.equal(word(f.data, 0x7e021e + 6), 180);
});
