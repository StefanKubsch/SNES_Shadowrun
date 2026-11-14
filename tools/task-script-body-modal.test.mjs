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
import { modalBodyPCs } from './task-script-body-modal-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import { prepareTaskScriptBody as start } from '../proof/task/script-bodies.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
const specs = scriptBodySpecs.filter(
    (s) => s.modalBody && !s.scriptChildBody && !s.tierBody && !s.localBody,
  ),
  fieldSpecs = new Map([
    [0x04d, [0xb05, 1]],
    [0x0c3, [0x23e, 128]],
    [0x0c8, [0xcbe, 128]],
    [0x0d7, [0x1b66, 8]],
    [0x0e3, [0xcbe, 1]],
    [0x118, [0x1b66, 4]],
    [0x143, [0xdd6, 1]],
    [0x162, [0xcbe, 128]],
    [0x1e6, [0x317, 128]],
    [0x1ed, [0x7fc, 8]],
  ]);
for (const s of specs)
  test(`Whole original modal ${s.id.toString(16)} owns every forward edge, original text/record sources, global observations and END`, async () => {
    const report = JSON.parse(
        await readFile('analysis/render-task-script-bodies-modal-native.json'),
      ),
      edges = new Set();
    for (const v of bodyCases(s)) {
      const f = scriptBodyFixture(s, v),
        p = commit(start, f),
        pcs = modalBodyPCs(s, v);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.resultWord, 0xbeef);
      assert.deepEqual(p.bodyPCs, pcs);
      assert.equal(p.handlersExecuted, pcs.length);
      assert.equal(p.waitObservationsUsed, f.waitObservations.length);
      assert.equal(p.inputObservationsUsed, f.inputObservations.length);
      assert.equal(p.observationsUsed, f.ioObservations.length);
      for (let n = 1; n < pcs.length; n++) edges.add(pcs[n - 1] + ':' + pcs[n]);
      assert.deepEqual(
        report.probes.find((p) => p.script_id === s.id && p.case === v.name),
        bodyProbe(s, v),
      );
      for (const call of p.steps.filter((p) =>
        [0x80cd43, 0x80cd20, 0x80cbf7, 0x80935b, 0x80933a].includes(p.calleeEntry),
      )) {
        assert.equal(call.calleeReturnWord, 0xf508);
        assert.equal(call.calleeReturnTarget, 0x80f509);
        assert.equal(call.resultPushed, [0x80cd43, 0x80cd20].includes(call.calleeEntry));
      }
      const success =
        v.confirm &&
        (v.low !== 0 || v.high === 1) &&
        p.steps.some((p) => p.calleeEntry === 0x80cd43) &&
        pcs.some((pc) => s.instructions.find((i) => i.pc === pc)?.operand === 0x0d);
      if (success && fieldSpecs.has(s.id)) {
        const [record, mask] = fieldSpecs.get(s.id),
          pointer = s.romReads.find((r) => r.address === 0x8db020 + record).value;
        assert.equal(f.data.readByte(0x7e0001 + pointer).value & mask, mask);
      }
      if (s.id === 0x04d && success) assert.equal(word(f.data, 0x7e2fca), 0x08b2);
      if (s.id === 0x0a4 && v.confirm) assert.equal(word(f.data, 0x7e3457), 0x08b2);
      if (s.id === 0x381)
        assert.ok(p.accesses.some((a) => a.kind === 'read' && a.address === 0x8dbb3a));
    }
    assert.deepEqual([...edges].sort(), s.edges.map((e) => e.from + ':' + e.to).sort());
  });
test('Modal whole-body metadata/high/late IO/wait/input/budget/count/owner failures withhold every store and stale commits reject', () => {
  const s = specs.find((s) => s.id === 0x04d),
    f = scriptBodyFixture(s, bodyCases(s)[0]),
    p = prepared(start, f);
  for (const a of [
    s.scriptEntry + 2 + s.bytecode.length,
    0xb01,
    s.romReads[0].address + 1,
    s.romReads.at(-1).address + 1,
  ])
    unchangedFailure(start, omit(f, a), {}, 'render_source_required');
  for (const n of scriptBodyNativeSources.filter((n) =>
    s.instructions.some((i) => i.opcode === 0x58 && i.operand === n.id),
  ))
    for (const a of n.anchors)
      unchangedFailure(start, omit(f, a.address + 1), {}, 'render_source_required');
  for (const [key, reason] of [
    ['inputObservations', 'task_input_observation_required'],
    ['waitObservations', 'task_wait_observation_required'],
    ['ioObservations', 'task_io_observation_required'],
  ])
    unchangedFailure(start, f, { [key]: menuRecords(f[key].slice(0, -1)) }, reason);
  unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(start, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  prepared(start, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  for (const maxHandlers of [f.maxHandlers - 1, f.maxHandlers + 1])
    unchangedFailure(start, f, { maxHandlers }, 'task_script_body_handler_count_required');
  unchangedFailure(
    start,
    f,
    { protectedStackBytes: [...f.protectedStackBytes, 0x7e020a] },
    'task_stack_alias_required',
  );
  f.data.seed(0x7e3c0d, [0]);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
});
