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
import { bodyProbe } from './task-script-body-artifacts.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import { prepared, unchangedFailure, commit } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
const specs = scriptBodySpecs.filter((s) => s.selectionBody);
test('Whole original0F8 owns both WORD predicate branches, original199/19A text roots, actual9A zero-result resume and END', async () => {
  const s = specs.find((s) => s.id === 0xf8),
    report = JSON.parse(await readFile('analysis/render-task-script-bodies-selection-native.json'));
  assert.equal(s.bytecode.length, 43);
  assert.equal(s.instructions.length, 23);
  assert.equal(s.romReads.length, 550);
  for (const v of bodyCases(s)) {
    const f = scriptBodyFixture(s, v),
      p = commit(start, f),
      call = p.steps.find((p) => p.calleeEntry === 0x80933a);
    const zero = v.state19 === 255 && v.state05 !== 0 && (v.state18 !== 0 || (v.flag & 1) === 0);
    assert.equal(p.bodyComplete, true);
    assert.equal(p.resultWord, 0xbeef);
    assert.equal(p.returnTarget, 0x80c20b);
    assert.equal(p.handlersExecuted, zero ? 20 : 21);
    assert.equal(p.bodyPCs.includes(zero ? 40 : 32), true);
    assert.equal(p.bodyPCs.includes(zero ? 32 : 40), false);
    assert.equal(call.arguments.wordPops, 1);
    assert.equal(call.resultPushed, false);
    assert.equal(call.metadataWord, 0);
    assert.equal(call.calleeReturnTarget, 0x80f509);
    assert.ok(
      p.accesses.some(
        (a) => a.kind === 'read' && a.address === 0x80d9b8 + (zero ? 0x199 : 0x19a) * 2,
      ),
    );
    assert.equal(p.waitObservationsUsed, 11);
    assert.equal(p.observationsUsed, 3);
    assert.deepEqual(
      report.probes.find((p) => p.case === v.name),
      bodyProbe(s, v),
    );
  }
});
test('Whole original194 has own1A/CF/D1/2C/4D sources, genuine count12 or later0800 readiness, signed local result and END', async () => {
  const s = specs.find((s) => s.id === 0x194),
    report = JSON.parse(await readFile('analysis/render-task-script-bodies-selection-native.json'));
  assert.equal(s.bytecode.length, 39);
  assert.equal(s.instructions.length, 23);
  assert.equal(s.argumentBytes, 2);
  assert.equal(s.returnBytes, 2);
  for (const v of bodyCases(s)) {
    const { fixture: f, plan: p, segments } = runWaitBodyFixture(s, v),
      call = p.steps.find((p) => p.calleeEntry === 0x80bba0);
    assert.equal(p.bodyComplete, true);
    assert.equal(p.returnTarget, 0x80c20b);
    assert.equal(p.resultWord, v.event === 0x800 ? 65535 : 0);
    assert.equal(p.observedReadinessEntries, v.event === 0x800 ? 1 : 12);
    assert.equal(p.handlersExecuted, 23);
    assert.deepEqual(
      p.bodyPCs,
      s.instructions.map((i) => i.pc),
    );
    assert.equal(call.arguments.wordPops, 1);
    assert.equal(call.resultPushed, false);
    assert.equal(call.calleeReturnWord, 0xf508);
    assert.equal(word(f.data, 0x801038 + 16), 0);
    assert.equal(
      segments.slice(1, -1).every((p) => p.segmentHandlers === 0 && p.observationsUsed === 0),
      true,
    );
    assert.deepEqual(
      report.probes.find((p) => p.case === v.name),
      waitBodyProbe(s, v),
    );
  }
});
test('0F8 metadata/source/last-high/late-IO/wait/budget/frame failures withhold the entire body and failed194 resume preserves prior commits', () => {
  const s = specs.find((s) => s.id === 0xf8),
    f = scriptBodyFixture(s, bodyCases(s)[0]),
    p = prepared(start, f);
  for (const a of [s.scriptEntry + 44, 0x601, 0xb01, ...s.romReads.map((r) => r.address + 1)])
    unchangedFailure(start, omit(f, a), {}, 'render_source_required');
  for (const native of scriptBodyNativeSources.filter((n) =>
    s.instructions.some((i) => i.opcode === 0x58 && i.operand === n.id),
  ))
    for (const a of native.anchors)
      unchangedFailure(start, omit(f, a.address + 1), {}, 'render_source_required');
  unchangedFailure(
    start,
    f,
    { ioObservations: Object.freeze(f.ioObservations.slice(0, -1)) },
    'task_io_observation_required',
  );
  unchangedFailure(
    start,
    f,
    { waitObservations: Object.freeze(f.waitObservations.slice(0, -1)) },
    'task_wait_observation_required',
  );
  unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(start, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  prepared(start, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  for (const maxHandlers of [f.maxHandlers - 1, f.maxHandlers + 1])
    unchangedFailure(start, f, { maxHandlers }, 'task_script_body_handler_count_required');
  unchangedFailure(
    start,
    f,
    { context: Object.freeze({ ...f.context, y: 2 }) },
    'task_script_body_entry_required',
  );
  unchangedFailure(
    start,
    f,
    { context: Object.freeze({ ...f.context, bank: 0x80 }) },
    'task_script_body_pointer_required',
  );
  unchangedFailure(
    start,
    f,
    { protectedStackBytes: [...f.protectedStackBytes, 0x7e020a] },
    'task_stack_alias_required',
  );
  const bad = scriptBodyFixture(s, bodyCases(s)[0]);
  sampleWord(bad.data, 0x14, 0x600);
  unchangedFailure(start, bad, {}, 'render_source_required');
  const w = specs.find((s) => s.id === 0x194),
    g = scriptBodyFixture(w, bodyCases(w)[2]);
  let q = prepared(start, g);
  assert.equal(q.bodyComplete, false);
  assert.equal(commitTaskPlan(g.data, q).handled, true);
  for (let n = 0; n < 11; n++) {
    q = prepared(resume, resumeBodyFixture(w, g, q));
    assert.equal(q.bodyComplete, false);
    assert.equal(commitTaskPlan(g.data, q).handled, true);
  }
  const ready = resumeBodyFixture(w, g, q),
    before = g.data.snapshot();
  unchangedFailure(resume, ready, { maxOutputBytes: 0 }, 'task_output_budget_required');
  assert.deepEqual(g.data.snapshot(), before);
  const done = prepared(resume, ready);
  assert.equal(done.bodyComplete, true);
  assert.equal(done.observedReadinessEntries, 12);
});
