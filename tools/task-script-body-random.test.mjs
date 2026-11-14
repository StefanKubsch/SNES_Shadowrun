import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs, scriptBodyNativeSources } from '../proof/task/script-body-specs.mjs';
import { prepareTaskScriptBody as prepare } from '../proof/task/script-bodies.mjs';
import {
  scriptBodyFixture as fixture,
  bodyCases,
  bodyWord as word,
  omitBodyBytes as omit,
} from './task-script-body-fixtures.mjs';
import { randomBodyPCs } from './task-script-body-random-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
const specs = scriptBodySpecs.filter((s) => s.randomObservations),
  at = (id) => specs.find((s) => s.id === id);
for (const s of specs)
  test(`Whole original random body${s.id.toString(16)}: every complete path, original Native3E/real returns and individually ordered PPU samples`, async () => {
    const report = JSON.parse(
        await readFile('analysis/render-task-script-bodies-random-native.json'),
      ),
      edges = new Set();
    for (const v of bodyCases(s)) {
      const f = fixture(s, v),
        p = prepared(prepare, f),
        pcs = randomBodyPCs(s, v),
        rng = p.steps.find((s) => s.calleeEntry === 0x80c51f);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.deepEqual(p.bodyPCs, pcs);
      assert.equal(p.handlersExecuted, pcs.length);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.outputContext.s, 0xb01);
      assert.equal(rng.arguments.wordPops, 1);
      assert.equal(rng.arguments.metadataWord, 0x0201);
      assert.equal(rng.metadataWord, 2);
      assert.equal(rng.resultPushed, true);
      assert.equal(rng.calleeReturnWord, 0xf508);
      assert.equal(rng.calleeReturnTarget, 0x80f509);
      assert.equal(p.observationsUsed, v.retry ? (s.id === 0x7e ? 9 : 6) : 3);
      assert.equal(commitTaskPlan(f.data, p).handled, true);
      if (s.id === 0x7e) {
        const success = pcs.includes(19);
        assert.equal(p.resultWord, success ? 65535 : 0);
        assert.equal(word(f.data, 0x7e3be5), (v.fieldWord ?? 0) + (success ? 1 : 0));
      } else {
        assert.equal(p.resultWord, 0xbeef);
        assert.equal(word(f.data, 0x801048), v.selection ?? 2);
        assert.equal(word(f.data, 0x8011a8), s.id === 0x282 ? 7 : 3);
        if (s.id === 0x65) assert.equal(word(f.data, 0x801360), 65535);
      }
      for (let n = 1; n < pcs.length; n++) edges.add(`${pcs[n - 1]}:${pcs[n]}`);
      assert.deepEqual(
        report.probes.find((p) => p.script_id === s.id && p.case === v.name),
        bodyProbe(s, v),
      );
    }
    assert.deepEqual([...edges].sort(), s.edges.map((e) => `${e.from}:${e.to}`).sort());
  });
test('Original07E: full WORD CMP predecessor wraps inputBYTE0 toFFFF; stateWORD limit and both true/false END values are original', () => {
  const s = at(0x7e);
  for (const inputByte of [0, 1, 5, 10, 0x100, 0x1ff])
    for (const fieldWord of [0, 3, 4, 0x100, 0x8000, 65535])
      for (const roll of [0, 4, 9]) {
        const f = fixture(s, { inputByte, fieldWord, roll }),
          p = prepared(prepare, f),
          success = (((inputByte & 255) - 1) & 65535) >= roll && fieldWord <= 3;
        assert.equal(p.resultWord, success ? 65535 : 0);
        assert.equal(commitTaskPlan(f.data, p).handled, true);
        assert.equal(word(f.data, 0x7e3be5), fieldWord + (success ? 1 : 0));
      }
});
test('Whole random bodies: every original header/body/END-fetch-high, ROM WORD high and native metadata high is required before publishing effects', () => {
  for (const s of specs) {
    const f = fixture(s, s.id === 0x7e ? { inputByte: 10, fieldWord: 0 } : {});
    for (let n = 0; n < s.bytecode.length + 3; n++)
      unchangedFailure(prepare, omit(f, s.scriptEntry + n), {}, 'render_source_required');
    for (const r of s.romReads)
      unchangedFailure(prepare, omit(f, r.address + 1), {}, 'render_source_required');
    for (const id of new Set(s.instructions.filter((i) => i.opcode === 0x58).map((i) => i.operand)))
      for (const a of scriptBodyNativeSources.find((n) => n.id === id).anchors)
        unchangedFailure(prepare, omit(f, a.address + 1), {}, 'render_source_required');
  }
});
test('Whole random bodies: missing/unused/reordered PPU samples, unused wait/control records and exact cumulative budgets are atomic', () => {
  for (const s of specs) {
    const f = fixture(s, { retry: true }),
      p = prepared(prepare, f);
    for (let n = 0; n < f.ioObservations.length; n++)
      unchangedFailure(
        prepare,
        f,
        { ioObservations: Object.freeze(f.ioObservations.filter((_, i) => i !== n)) },
        'task_io_observation_required',
      );
    unchangedFailure(
      prepare,
      f,
      { ioObservations: Object.freeze([...f.ioObservations, f.ioObservations[0]]) },
      'task_io_observation_unused',
    );
    unchangedFailure(
      prepare,
      f,
      { ioObservations: Object.freeze([...f.ioObservations].reverse()) },
      'task_io_observation_required',
    );
    unchangedFailure(
      prepare,
      f,
      { waitObservations: menuRecords([{ pc: 0x81acaf, address: 0x8001f8, width: 2, value: 0 }]) },
      'task_wait_observation_unused',
    );
    unchangedFailure(
      prepare,
      f,
      { inputObservations: menuRecords([{ pc: 0x809e1a, address: 0x8001ca, width: 2, value: 1 }]) },
      'task_input_observation_unused',
    );
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
    const before = f.data.snapshot();
    assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
    assert.deepEqual(f.data.snapshot(), before);
  }
});
test('Whole random/D2: real small-stack JSR replaces DP00 with D162; unproved fresh actor ROM address rejects the complete body', () => {
  const f = fixture(at(0xdb)),
    g = { ...f, protectedStackBytes: [0x7e0008, 0x7e0009] };
  sampleWord(f.data, 0x8001f2, 7);
  sampleWord(f.data, 8, 0xc20a);
  const p = unchangedFailure(prepare, g, {}, 'task_script_body_ROM_read_required');
  assert.equal(p.address, 0x80e19a);
  const s = at(0x7e),
    late = fixture(s);
  sampleWord(late.data, 0x8001f2, 0x1cea);
  sampleWord(late.data, 0x1ceb, 0xc20a);
  unchangedFailure(
    prepare,
    { ...late, protectedStackBytes: [0x7e1ceb, 0x7e1cec] },
    {},
    'task_native_helper_return_required',
  );
});
