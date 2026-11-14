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
import { recordActionsPCs } from './task-script-body-record-actions-fixtures.mjs';
import {
  runWaitBodyFixture,
  resumeBodyFixture,
  waitBodyProbe,
} from './task-script-body-wait-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { renderAddress } from '../src/render/data.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
const s = scriptBodySpecs.find((s) => s.id === 0x2b9),
  freeze = (xs) => Object.freeze(xs.map(Object.freeze));
test('Whole original2B9: null/full-WORD BMI, original three-option menu, both notices, Native80/C5 and actual END on every edge', async () => {
  const source = JSON.parse(
      await readFile('analysis/render-task-script-bodies-record-actions.json'),
    ),
    report = JSON.parse(
      await readFile('analysis/render-task-script-bodies-record-actions-native.json'),
    ),
    edges = new Set();
  assert.equal(
    source.proofs[0].original_text_sources.includes('Individually pinned original dictionary'),
    true,
  );
  for (const v of bodyCases(s)) {
    const { fixture: f, plan: p, segments } = runWaitBodyFixture(s, v),
      hasMenu = v.pointer !== 0 && !((v.record ?? 0) & 0x8000);
    assert.equal(p.bodyComplete, true);
    assert.equal(p.fullTaskBinding, false);
    assert.equal(p.returnTarget, 0x80c20b);
    assert.equal(p.resultWord, 0xbeef);
    assert.deepEqual(p.bodyPCs, recordActionsPCs(s, v));
    assert.equal(p.handlersExecuted, p.bodyPCs.length);
    for (let n = 1; n < p.bodyPCs.length; n++) edges.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
    const calls = p.steps.filter((p) => p.calleeEntry);
    assert.equal(calls.filter((p) => p.calleeEntry === 0x809ba0).length, Number(hasMenu));
    for (const call of calls.filter((p) => p.id !== 0x9f)) {
      assert.equal(call.calleeReturnWord, 0xf508);
      assert.equal(call.calleeReturnTarget, 0x80f509);
    }
    const menu = calls.find((p) => p.calleeEntry === 0x809ba0),
      c8 = calls.find((p) => p.calleeEntry === 0x80fec1);
    if (menu) {
      assert.equal(menu.callee.optionCount, 3);
      assert.equal(menu.callee.nativeResult, v.selected);
      assert.equal(menu.resultPushed, true);
    }
    assert.equal(Boolean(c8), Boolean(v.selected));
    if (c8) {
      assert.equal(c8.arguments.wordPops, 7);
      assert.equal(c8.callee.text.characters, v.selected === 0x80 ? 29 : 30);
      assert.equal(c8.callee.text.bits, v.selected === 0x80 ? 175 : 126);
      assert.equal(c8.callee.text.newlines, 0);
    }
    if (v.selected === 0x100) {
      assert.equal(segments.length, 2);
      assert.equal(p.observedReadinessEntries, 1);
      assert.equal(segments[0].bodyComplete, false);
      assert.equal(segments[0].inputObservationsUsed, 5);
      assert.equal(segments[0].observationsUsed, 34);
      assert.equal(segments[0].waitObservationsUsed, 97);
      assert.equal(segments[1].inputObservationsUsed, 0);
      assert.equal(segments[1].observationsUsed, 3);
      assert.equal(segments[1].waitObservationsUsed, 12);
      assert.equal(word(f.data, 0x801d63), 65535);
      assert.equal(word(f.data, 0x7e2fc8), 0xab42);
      assert.equal(word(f.data, 0x7e4003), 0x1538);
    } else assert.equal(segments.length, 1);
    // Every physical ROM text root is guarded, including the shared menu
    // dictionary and actual full-WORD reads before masks/font unpacking.
    for (const a of segments
      .flatMap((p) => p.accesses)
      .filter(
        (a) =>
          a.kind === 'read' &&
          (renderAddress(a.address) ?? 0) >= 0x800000 &&
          a.label === 'text-root-WORD-low',
      ))
      assert.ok(s.romReads.some((r) => r.address === a.address));
    assert.deepEqual(
      report.probes.find((p) => p.case === v.name),
      waitBodyProbe(s, v),
    );
  }
  assert.deepEqual([...edges].sort(), s.edges.map((e) => e.from + ':' + e.to).sort());
});
test('Original2B9: every header/body/following fetchhigh and all623 own ROM highs reject before any publication', () => {
  const f = fixture(s, bodyCases(s).at(-1)),
    p = prepared(start, f);
  assert.equal(s.romReads.length, 623);
  for (let n = 0; n < s.bytecode.length + 3; n++)
    unchangedFailure(start, omit(f, s.scriptEntry + n), {}, 'render_source_required');
  for (const r of s.romReads)
    unchangedFailure(start, omit(f, r.address + 1), {}, 'render_source_required');
  for (const id of [0xc6, 0x13, 0x80, 0x9f])
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
test('Original2B9: full C6 highbyte and local/argument WORD highs, zero pointer gate and slot BYTE truncation remain physical', () => {
  const v = bodyCases(s).find((v) => v.name === 'cancel'),
    f = fixture(s, v);
  unchangedFailure(start, omit(f, 0x7e4004), {}, 'render_source_required');
  unchangedFailure(start, omit(f, 0x614), {}, 'render_source_required');
  unchangedFailure(start, omit(f, 0x801), {}, 'render_source_required');
  const z = fixture(s, bodyCases(s)[0]);
  prepared(start, omit(z, 0x7e4003, 0x7e4004));
  const high = fixture(s, v);
  sampleWord(high.data, 0x800, 0xab10);
  const p = prepared(start, high);
  assert.deepEqual(p.bodyPCs, recordActionsPCs(s, v));
  assert.ok(p.accesses.some((a) => a.label === 'native-argument-PLA-low' && a.value === 16));
});
test('Original2B9: every menu IO/wait/control record is phase-specific; missing/reordered/extra/reset samples retain no effects', () => {
  const f = fixture(s, bodyCases(s).at(-1));
  for (let n = 0; n < f.ioObservations.length; n++)
    unchangedFailure(
      start,
      f,
      { ioObservations: freeze(f.ioObservations.filter((_, i) => i !== n)) },
      'task_io_observation_required',
    );
  for (let n = 0; n < f.waitObservations.length; n++)
    unchangedFailure(
      start,
      f,
      { waitObservations: freeze(f.waitObservations.filter((_, i) => i !== n)) },
      'task_wait_observation_required',
    );
  // Removing an earlier control changes navigation and therefore later
  // required wait/audio sites; removing either final control exhausts input.
  const missingInputReasons = [
    'task_wait_observation_required',
    'task_io_observation_required',
    'task_io_observation_required',
    'task_input_observation_required',
    'task_input_observation_required',
  ];
  for (let n = 0; n < f.inputObservations.length; n++)
    unchangedFailure(
      start,
      f,
      { inputObservations: freeze(f.inputObservations.filter((_, i) => i !== n)) },
      missingInputReasons[n],
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
    'task_wait_observation_unused',
  );
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
});
test('Original2B9: genuine latest committed9F/PEA/F509 supplies new C8 records; late C5 and field faults preserve menu/Native80 commit', () => {
  const f = fixture(s, bodyCases(s).at(-1)),
    p = prepared(start, f),
    uncommitted = resumeBodyFixture(s, f, p);
  unchangedFailure(resume, uncommitted, {}, 'task_script_body_continuation_required');
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  const next = resumeBodyFixture(s, f, p),
    q = prepared(resume, next);
  assert.equal(q.bodyComplete, true);
  assert.equal(next.ioObservations.length, 3);
  assert.equal(word(f.data, 0x801d63), 65535);
  assert.equal(word(f.data, 0x7e2fc8), 0xab40);
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
  unchangedFailure(
    resume,
    next,
    { ioObservations: f.ioObservations },
    'task_io_observation_required',
  );
  unchangedFailure(
    resume,
    next,
    { inputObservations: f.inputObservations },
    'task_input_observation_unused',
  );
  unchangedFailure(
    resume,
    next,
    { protectedStackBytes: [...next.protectedStackBytes, 0x7e4004] },
    'task_stack_alias_required',
  );
  unchangedFailure(
    resume,
    next,
    { protectedStackBytes: [...next.protectedStackBytes, 0x7e2fc8] },
    'task_stack_alias_required',
  );
  unchangedFailure(resume, next, { maxWork: q.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    resume,
    next,
    { maxOutputBytes: q.outputBytes - 1 },
    'task_output_budget_required',
  );
  unchangedFailure(
    resume,
    next,
    { continuation: { ...p } },
    'task_script_body_continuation_required',
  );
});
test('Original2B9: menu/Taskframe alias refetches a replaced stream, rejects sparse bytes or wrong pointer and withholds every menu effect', () => {
  const f = fixture(s, bodyCases(s).at(-1)),
    frame = 0x1d63;
  for (const [o, n] of [
    [0, (s.scriptEntry + 2) & 65535],
    [1, ((s.scriptEntry >>> 16) << 8) | (((s.scriptEntry + 2) >>> 8) & 255)],
    [3, 0],
    [7, 0x7ff],
    [9, s.id],
  ])
    sampleWord(f.data, frame + o, n);
  f.data.seed(frame + 0x13, [0xa5, 0xa5, 0xa5, 0xa5]);
  sampleWord(f.data, 0x800254, frame);
  f.context = Object.freeze({ ...f.context, d: frame });
  const p = unchangedFailure(start, f, {}, 'render_source_required');
  assert.equal(p.address, 0x7e0036);
  sampleWord(f.data, 0x7e0036, 0xa514);
  unchangedFailure(start, f, {}, 'task_script_body_pointer_required');
});
