import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import { prepareTaskScriptBody as prepare } from '../proof/task/script-bodies.mjs';
import {
  scriptBodyFixture,
  bodyCases,
  bodyWord,
  omitBodyBytes,
} from './task-script-body-fixtures.mjs';
import { actionsBodyArguments, actionsBodyPCs } from './task-script-body-actions-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
const specs = scriptBodySpecs.filter(
  (s) => s.native13Observations && !s.native13Wait && !s.audioObservations && !s.recordActionsBody,
);
for (const spec of specs)
  test(`Whole original actions/C8 body${spec.id.toString(16)}: individual original bytes/headers/tables, both edges, complete menu/C8/release/END`, async () => {
    const report = JSON.parse(
        await readFile('analysis/render-task-script-bodies-actions-native.json'),
      ),
      seen = new Set();
    for (const variant of bodyCases(spec)) {
      const f = scriptBodyFixture(spec, variant),
        p = prepared(prepare, f),
        hasC8 = variant.held === 32,
        menu = p.steps.find((s) => s.calleeEntry === 0x809ba0),
        c8 = p.steps.find((s) => s.calleeEntry === 0x80fec1);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.deepEqual(p.bodyPCs, actionsBodyPCs(variant));
      assert.equal(p.handlersExecuted, p.bodyPCs.length);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.targetExecuted, false);
      assert.equal(p.outputContext.s, 0xb01);
      assert.equal(p.outputContext.d, 0);
      assert.equal(p.outputContext.bank, spec.scriptEntry >>> 16);
      assert.equal(menu.arguments.wordPops, 1);
      assert.equal(menu.arguments.metadataWord, 0x201);
      assert.equal(menu.metadataWord, 2);
      assert.equal(menu.resultPushed, true);
      assert.equal(menu.calleeReturnWord, 0xf508);
      assert.equal(menu.calleeReturnTarget, 0x80f509);
      assert.equal(menu.callee.nativeResult, hasC8 ? 128 : 0);
      assert.equal(menu.callee.menu, variant.held & 0x2000 ? 'menu_cancelled' : 'menu_confirmed');
      assert.equal(Boolean(c8), hasC8);
      assert.equal(p.steps.findLast((s) => s.calleeEntry).calleeEntry, 0x80a8f5);
      assert.equal(p.inputObservationsUsed, 2);
      assert.equal(p.observationsUsed, f.ioObservations.length);
      assert.equal(p.waitObservationsUsed, f.waitObservations.length);
      if (c8) {
        const args = actionsBodyArguments.get(spec.id);
        assert.equal(c8.arguments.wordPops, 7);
        assert.equal(c8.metadataWord, 0);
        assert.equal(c8.resultPushed, false);
        assert.equal(c8.calleeReturnWord, 0xf508);
        assert.equal(c8.calleeReturnTarget, 0x80f509);
        assert.equal(c8.callee.allocation, 0);
        assert.equal(c8.callee.outcome, variant.occupied ? 'notice_replaced' : 'notice_inserted');
        assert.equal(c8.callee.slot, variant.occupied ? 0 : 6);
        const start = p.accesses.findIndex((r) => r.label === 'saved-ID-low' && r.value === 0xc8),
          records = p.accesses.slice(start);
        assert.deepEqual(
          records
            .filter((r) => r.label === 'native-argument-PLA-low')
            .slice(0, 7)
            .map((r) => r.value),
          args.map((v) => v & 255),
        );
        assert.deepEqual(
          records
            .filter((r) => r.label === 'native-argument-PLA-high')
            .slice(0, 7)
            .map((r) => r.value),
          args.map((v) => v >>> 8),
        );
      }
      for (let n = 1; n < p.bodyPCs.length; n++) seen.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
      assert.equal(commitTaskPlan(f.data, p).handled, true);
      assert.equal(bodyWord(f.data, 0x7e3f38), 65535);
      if (c8) assert.equal(bodyWord(f.data, 0x7e021e + c8.callee.slot), 240);
      assert.deepEqual(
        report.probes.find((p) => p.script_id === spec.id && p.case === variant.name),
        bodyProbe(spec, variant),
      );
    }
    assert.deepEqual([...seen].sort(), spec.edges.map((e) => e.from + ':' + e.to).sort());
  });
test('Original actions bodies: every initial ROM/header/tail byte and required metadata highbyte is independently required before effects', () => {
  for (const spec of specs) {
    const f = scriptBodyFixture(spec, { name: 'action-hotkey', held: 32 });
    for (let n = 0; n < spec.bytecode.length + 3; n++)
      unchangedFailure(
        prepare,
        omitBodyBytes(f, spec.scriptEntry + n),
        {},
        'render_source_required',
      );
    for (const address of [0x82d7df, 0x82da60, 0x82d984, 0x82d949, 0x82db15, 0x82da39, 0x7e0602])
      unchangedFailure(prepare, omitBodyBytes(f, address), {}, 'render_source_required');
  }
});
test('Original actions bodies: every device/wait/control record, source order and exact cumulative body budgets are atomic', () => {
  for (const spec of specs) {
    const f = scriptBodyFixture(spec, {
        name: 'action-hotkey-replacement',
        held: 32,
        occupied: [4, 4, 4, 4],
      }),
      p = prepared(prepare, f);
    for (let n = 0; n < f.ioObservations.length; n++)
      unchangedFailure(
        prepare,
        f,
        { ioObservations: menuRecords(f.ioObservations.filter((_, i) => i !== n)) },
        'task_io_observation_required',
      );
    for (let n = 0; n < f.waitObservations.length; n++)
      unchangedFailure(
        prepare,
        f,
        { waitObservations: menuRecords(f.waitObservations.filter((_, i) => i !== n)) },
        'task_wait_observation_required',
      );
    for (let n = 0; n < f.inputObservations.length; n++)
      unchangedFailure(
        prepare,
        f,
        { inputObservations: menuRecords(f.inputObservations.filter((_, i) => i !== n)) },
        'task_input_observation_required',
      );
    unchangedFailure(
      prepare,
      f,
      { ioObservations: menuRecords([...f.ioObservations, f.ioObservations.at(-1)]) },
      'task_io_observation_unused',
    );
    unchangedFailure(
      prepare,
      f,
      { waitObservations: menuRecords([...f.waitObservations, f.waitObservations.at(-1)]) },
      'task_wait_observation_unused',
    );
    unchangedFailure(
      prepare,
      f,
      { inputObservations: menuRecords([...f.inputObservations, f.inputObservations.at(-1)]) },
      'task_input_observation_unused',
    );
    unchangedFailure(
      prepare,
      f,
      {
        inputObservations: menuRecords([
          f.inputObservations[0],
          { ...f.inputObservations[1], value: 0x3030 },
        ]),
      },
      'task_reset_source_required',
    );
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
    prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  }
});
test('Original actions bodies: missing late END return and unused future C8 events withhold all menu/audio/notice effects', () => {
  const spec = specs[0],
    full = scriptBodyFixture(spec, { held: 32 }),
    p = prepared(prepare, full);
  unchangedFailure(prepare, omitBodyBytes(full, 0xb01), {}, 'render_source_required');
  const cancelled = scriptBodyFixture(spec, { held: 0x2000 });
  unchangedFailure(
    prepare,
    cancelled,
    { waitObservations: full.waitObservations },
    'task_wait_observation_unused',
  );
  const other = scriptBodyFixture(spec, { held: 32 });
  assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(full.data, { ...p }).reason, 'task_plan_owner_required');
  full.data.seed(0x100, [1]);
  const before = full.data.snapshot();
  assert.equal(commitTaskPlan(full.data, p).reason, 'task_plan_stale');
  assert.deepEqual(full.data.snapshot(), before);
});
