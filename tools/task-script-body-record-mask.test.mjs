import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs, scriptBodyNativeSources } from '../proof/task/script-body-specs.mjs';
import { prepareTaskScriptBody as prepare } from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import {
  scriptBodyFixture as fixture,
  bodyCases,
  bodyWord as word,
  omitBodyBytes as omit,
} from './task-script-body-fixtures.mjs';
import { recordMaskBodyPCs } from './task-script-body-record-mask-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
const spec = scriptBodySpecs.find((s) => s.recordMaskBody),
  put = (f, a, v) => sampleWord(f.data, a, v);
test('Original391: every original edge, both real END results, full record read and BYTE-only AND with eight whole direction outcomes', async () => {
  const report = JSON.parse(
      await readFile('analysis/render-task-script-bodies-record-mask-native.json'),
    ),
    edges = new Set();
  for (const v of bodyCases(spec)) {
    const f = fixture(spec, v),
      p = prepared(prepare, f),
      full = v.pointer !== 0 && !!(v.flag & 0x80);
    assert.equal(p.bodyComplete, true);
    assert.equal(p.fullTaskBinding, false);
    assert.equal(p.resultWord, full ? 65535 : 0);
    assert.deepEqual(p.bodyPCs, recordMaskBodyPCs(spec, v));
    assert.equal(p.handlersExecuted, full ? 20 : 11);
    assert.equal(p.returnTarget, 0x80c20b);
    for (const call of p.steps.filter((p) => p.calleeEntry)) {
      assert.equal(call.calleeReturnWord, 0xf508);
      assert.equal(call.calleeReturnTarget, 0x80f509);
    }
    const mask = p.steps.find((p) => p.id === 0x7a),
      direction = p.steps.find((p) => p.id === 0x6c);
    assert.equal(!!mask, full);
    assert.equal(!!direction, full);
    if (full) {
      assert.equal(mask.wordPops, 2);
      assert.equal(mask.resultPushed, false);
      assert.equal(direction.wordPops, 1);
    } else
      assert.equal(
        p.steps.some((p) => p.id === 0xb9),
        true,
      );
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(word(f.data, 0x7e4001), 0xab00 | (full ? v.flag & 0x7f : v.flag));
    assert.equal(word(f.data, 0x801468), full ? 0xbeef : 0xbeaf);
    if (full) assert.equal(word(f.data, 0x8011a8), v.direction);
    else assert.equal(word(f.data, 0x7e3f38), 65535);
    for (let n = 1; n < p.bodyPCs.length; n++) edges.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
    assert.deepEqual(
      report.probes.find((p) => p.script_id === spec.id && p.case === v.name),
      bodyProbe(spec, v),
    );
  }
  assert.deepEqual([...edges].sort(), spec.edges.map((e) => e.from + ':' + e.to).sort());
});
test('Original391: every original byte/ROM high, full Local0/record/pointer highs and exact cumulative handler/work/output limits are mandatory', () => {
  const f = fixture(spec, { flag: 0x80, dx: 4, dy: -4, direction: 3 }),
    p = prepared(prepare, f);
  for (let n = 0; n < spec.bytecode.length + 3; n++)
    unchangedFailure(prepare, omit(f, spec.scriptEntry + n), {}, 'render_source_required');
  for (const r of spec.romReads)
    unchangedFailure(prepare, omit(f, r.address + 1), {}, 'render_source_required');
  for (const a of [0x614, 0x8013b9, 0x7e4002])
    unchangedFailure(prepare, omit(f, a), {}, 'render_source_required');
  for (const branch of [f, fixture(spec, { flag: 0 })]) {
    const actual = prepared(prepare, branch);
    for (const n of scriptBodyNativeSources.filter((n) =>
      actual.steps.some((step) => step.id === n.id),
    ))
      for (const a of n.anchors)
        unchangedFailure(prepare, omit(branch, a.address + 1), {}, 'render_source_required');
  }
  prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    prepare,
    f,
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  unchangedFailure(
    prepare,
    f,
    { maxHandlers: f.maxHandlers - 1 },
    'task_script_body_handler_count_required',
  );
});
test('Original391: argument/local highs truncate only after full reads, late coordinate and protected return failures retain no earlier effects', () => {
  const v = { flag: 0xff, dx: -4, dy: -4, direction: 5, slot: 0xab10 },
    f = fixture(spec, v),
    p = prepared(prepare, f);
  assert.equal(p.resultWord, 65535);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(word(f.data, 0x7e4001), 0xab7f);
  assert.equal(word(f.data, 0x8011a8), 5);
  assert.equal(word(f.data, 0x613), 0xa510);
  const fresh = fixture(spec, { flag: 0x80, dx: 4, dy: 4, direction: 1 }),
    before = fresh.data.snapshot();
  unchangedFailure(prepare, omit(fresh, 0x800cc3), {}, 'render_source_required');
  unchangedFailure(prepare, omit(fresh, 0xb01), {}, 'render_source_required');
  unchangedFailure(
    prepare,
    fresh,
    { protectedStackBytes: [...fresh.protectedStackBytes, 0x7e4001] },
    'task_stack_alias_required',
  );
  assert.deepEqual(fresh.data.snapshot(), before);
  assert.equal(word(fresh.data, 0x7e4001), 0xab80);
  assert.equal(word(fresh.data, 0x801468), 0xbeaf);
  const stale = prepared(prepare, fresh);
  put(fresh, 0x800cc2, 0x10);
  const changed = fresh.data.snapshot();
  assert.equal(commitTaskPlan(fresh.data, stale).reason, 'task_plan_stale');
  assert.deepEqual(fresh.data.snapshot(), changed);
});
