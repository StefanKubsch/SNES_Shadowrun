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
import { counterBodyPCs } from './task-script-body-counter-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
const s = scriptBodySpecs.find((s) => s.id === 0x3a3),
  flags = new Map([
    [2, 356],
    [3, 363],
    [4, 370],
    [5, 376],
  ]);
test('Whole original3A3: full WORD state, all original branches, conditional32 counter, BYTE field clear and three actual state WORDs to END', async () => {
  const report = JSON.parse(
      await readFile('analysis/render-task-script-bodies-counter-native.json'),
    ),
    edges = new Set();
  for (const v of bodyCases(s)) {
    const f = fixture(s, v),
      p = prepared(prepare, f);
    assert.equal(p.bodyComplete, true);
    assert.equal(p.fullTaskBinding, false);
    assert.deepEqual(p.bodyPCs, counterBodyPCs(s, v));
    assert.equal(p.returnTarget, 0x80c20b);
    assert.equal(p.resultWord, 0xbeef);
    assert.equal(p.outputContext.s, 0xb01);
    assert.equal(p.steps.filter((s) => s.calleeEntry === 0x80cca4).length, Number(v.state === 2));
    for (const call of p.steps.filter((p) => p.calleeEntry)) {
      assert.equal(call.calleeReturnWord, 0xf508);
      assert.equal(call.calleeReturnTarget, 0x80f509);
    }
    assert.deepEqual(
      report.probes.find((p) => p.script_id === s.id && p.case === v.name),
      bodyProbe(s, v),
    );
    assert.ok(!p.accesses.some((a) => a.kind === 'read' && a.address === 0x7e3996));
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(word(f.data, 0x7e2de4), v.state === 2 ? Math.max(32, v.previous) : v.previous);
    assert.equal(word(f.data, 0x7e3996), 0xab00);
    assert.equal(word(f.data, 0x801ce9), 3);
    assert.equal(word(f.data, 0x801ceb), (v.state - 1) & 65535);
    assert.equal(word(f.data, 0x7e2de2), flags.get(v.state) ?? v.local0);
    for (let n = 1; n < p.bodyPCs.length; n++) edges.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
  }
  assert.deepEqual([...edges].sort(), s.edges.map((e) => e.from + ':' + e.to).sort());
  for (const local0 of [0, 1, 65535]) {
    const f = fixture(s, { state: 258, local0 }),
      p = prepared(prepare, f);
    commitTaskPlan(f.data, p);
    assert.equal(word(f.data, 0x7e2de2), local0);
  }
});
test('Original3A3: all own source/highs and Native57/DB/60/54 contracts, actual no-preread field write, exact limits and protected late destination', () => {
  const f = fixture(s, { state: 2, previous: 0 }),
    p = prepared(prepare, f);
  for (let n = 0; n < s.bytecode.length + 3; n++)
    unchangedFailure(prepare, omit(f, s.scriptEntry + n), {}, 'render_source_required');
  for (const r of s.romReads)
    unchangedFailure(prepare, omit(f, r.address + 1), {}, 'render_source_required');
  for (const id of [0x57, 0xdb, 0x60, 0x54])
    for (const a of scriptBodyNativeSources.find((n) => n.id === id).anchors)
      unchangedFailure(prepare, omit(f, a.address + 1), {}, 'render_source_required');
  prepared(prepare, omit(f, 0x7e3996, 0x7e3997));
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
    { protectedStackBytes: [...f.protectedStackBytes, 0x7e1ce9] },
    'task_stack_alias_required',
  );
});
test('Original3A3: fresh Native54 saved-PC alias invalidates the late edge and withholds earlier conditional DB and field writes', () => {
  const f = fixture(s, { state: 2 }),
    frame = 0x1ce6;
  for (const [o, v] of [
    [0, 0xf7ae],
    [1, 0x82f7],
    [3, 0],
    [7, 0x7ff],
    [9, s.id],
  ])
    sampleWord(f.data, frame + o, v);
  for (const [o, v] of [
    [0x13, 0xa5a5],
    [0x15, 0xa5a5],
  ])
    sampleWord(f.data, frame + o, v);
  sampleWord(f.data, 0x800254, frame);
  f.context = Object.freeze({ ...f.context, d: frame });
  unchangedFailure(prepare, f, {}, 'task_script_body_edge_required');
});
