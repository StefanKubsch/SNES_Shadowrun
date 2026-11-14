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
import { sampleWord } from './render-f130-fixtures.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { prepareSlotSelection } from '../proof/state/slot-selection.mjs';
const s = scriptBodySpecs.find((s) => s.id === 0x3a4),
  actionData = createSlotActionData(JSON.parse(await readFile('assets/slot-action-data.json')));
test('Whole original3A4: full D1 selection and 81 fields, BYTE locals/actual arguments, genuine yield/observed event4/real resume/END in every individual caller variant', async () => {
  const report = JSON.parse(
    await readFile('analysis/render-task-script-bodies-slot-fields-native.json'),
  );
  for (const v of bodyCases(s)) {
    const { fixture: f, plan: p, segments } = runWaitBodyFixture(s, v),
      args = v.args ?? [16, v.index],
      slot = args[0] & 255,
      index = args[1] & 255;
    assert.equal(p.bodyComplete, true);
    assert.equal(p.fullTaskBinding, false);
    assert.equal(segments.length, 2);
    assert.equal(p.observedReadinessEntries, 1);
    assert.deepEqual(
      p.bodyPCs,
      s.instructions.map((i) => i.pc),
    );
    assert.equal(p.handlersExecuted, 13);
    assert.equal(p.resultWord, 0xbeef);
    assert.equal(p.outputContext.s, 0xaff);
    assert.equal(p.outputContext.d, 0);
    assert.equal(p.outputContext.bank, 0x9c);
    assert.equal(p.returnTarget, 0x80c20b);
    assert.equal(segments[0].bodyComplete, false);
    assert.equal(segments[0].frontier, 'actual-native-wait-yield-target');
    for (const c of segments[0].steps.filter((p) => [0x80a985, 0x80c6bf].includes(p.calleeEntry))) {
      assert.equal(c.wordPops, 2);
      assert.equal(c.resultPushed, false);
      assert.equal(c.calleeReturnWord, 0xf508);
      assert.equal(c.calleeReturnTarget, 0x80f509);
    }
    assert.equal(word(f.data, 0x613) & 255, slot);
    assert.equal(word(f.data, 0x614) & 255, index);
    const expected = prepareSlotSelection({
      selectionWord: 2,
      currentSelection: v.selectionEqual ? 2 : 65535,
      definitionWord: 11,
      currentIndex: v.currentAction ?? 0,
      actionData,
    });
    assert.equal(expected.handled, true);
    for (const [key, value] of Object.entries(expected.fields)) {
      const address =
        (key.startsWith('7E:')
          ? 0x7e0000 + parseInt(key.slice(3), 16)
          : 0x800000 + parseInt(key, 16)) + slot;
      assert.equal(word(f.data, address), value, key);
    }
    assert.equal(word(f.data, 0x7e4138 + slot), 0);
    assert.equal(word(f.data, 0x7e40e0 + slot), 1);
    assert.equal(
      word(f.data, 0x7e4190 + slot),
      (s.romReads.find((r) => r.address === 0x8d9001 + 6 * index).value * 4) & 65535,
    );
    assert.equal(
      word(f.data, 0x7e41e8 + slot),
      (s.romReads.find((r) => r.address === 0x8d9003 + 6 * index).value * 4) & 65535,
    );
    assert.deepEqual(
      report.probes.find((p) => p.case === v.name),
      waitBodyProbe(s, v),
    );
  }
});
test('Original3A4: every header/body/END fetchhigh, all22 ROM WORD highs, original native metadata highs and exact budgets are mandatory atomically', () => {
  const f = fixture(s),
    p = prepared(start, f);
  assert.equal(s.romReads.length, 22);
  for (let n = 0; n < s.bytecode.length + 3; n++)
    unchangedFailure(start, omit(f, s.scriptEntry + n), {}, 'render_source_required');
  for (const r of s.romReads)
    unchangedFailure(start, omit(f, r.address + 1), {}, 'render_source_required');
  for (const id of [0xd1, 0x81, 0x9f])
    for (const a of scriptBodyNativeSources.find((n) => n.id === id).anchors)
      unchangedFailure(start, omit(f, a.address + 1), {}, 'render_source_required');
  unchangedFailure(start, omit(f, 0x615), {}, 'render_source_required');
  unchangedFailure(start, omit(f, 0xf5), {}, 'render_source_required');
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
test('Original3A4: event-only mask4 leaves count0 unchanged at unrelated event1; ready event4 resumes only the latest genuinely committed prefix', () => {
  const f = fixture(s),
    p = prepared(start, f),
    uncommitted = resumeBodyFixture(s, f, p);
  unchangedFailure(resume, uncommitted, {}, 'task_script_body_continuation_required');
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(word(f.data, 0x800ba4), 4);
  assert.equal(word(f.data, 0x800c04), 0);
  sampleWord(f.data, 0x800c64, 1);
  const blockedOptions = resumeBodyFixture(s, f, p),
    q = prepared(resume, blockedOptions);
  assert.equal(q.bodyComplete, false);
  assert.equal(q.segmentHandlers, 0);
  assert.equal(commitTaskPlan(f.data, q).handled, true);
  assert.equal(word(f.data, 0x800c04), 0);
  unchangedFailure(
    resume,
    resumeBodyFixture(s, f, p),
    {},
    'task_script_body_continuation_required',
  );
  sampleWord(f.data, 0x800c64, 4);
  const ready = resumeBodyFixture(s, f, q);
  unchangedFailure(
    resume,
    { ...ready, continuation: { ...q } },
    {},
    'task_script_body_continuation_required',
  );
  const r = prepared(resume, ready);
  assert.equal(r.bodyComplete, true);
  assert.equal(r.observedReadinessEntries, 2);
  assert.equal(r.resultWord, 0xbeef);
});
test('Original3A4: independently observed latest continuation revalidates body/ROM/end/native metadata and late return source; failures leave committed D1/81 effects unchanged', () => {
  const f = fixture(s),
    p = prepared(start, f);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  sampleWord(f.data, 0x800c64, 4);
  const ready = resumeBodyFixture(s, f, p),
    originals = [
      [s.scriptEntry + 23, 1],
      [0x82da10, 0],
      [0x8ceda0, 0x88c6],
    ];
  for (const [address, value] of originals) {
    f.data.seed(address, [(value ^ 1) & 255]);
    unchangedFailure(resume, ready, {}, 'task_script_body_bytes_required');
    f.data.seed(address, [value & 255]);
  }
  const r = prepared(resume, ready);
  unchangedFailure(resume, ready, { maxWork: r.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    resume,
    ready,
    { maxOutputBytes: r.outputBytes - 1 },
    'task_output_budget_required',
  );
});
test('Original3A4: actual positive D1 workspace/frame alias replaces saved native metadata ownership and withholds all prefix effects', () => {
  const f = fixture(s);
  sampleWord(f.data, 0, 0xec1b);
  sampleWord(f.data, 1, 0x9cec);
  sampleWord(f.data, 3, 0);
  sampleWord(f.data, 7, 0x7ff);
  sampleWord(f.data, 9, s.id);
  f.data.seed(0x13, [0xa5, 0xa5, 0xa5]);
  sampleWord(f.data, 0x800254, 0);
  f.context = Object.freeze({ ...f.context, d: 0 });
  unchangedFailure(start, f, {}, 'task_script_body_native_metadata_required');
});
