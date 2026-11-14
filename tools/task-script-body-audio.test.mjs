import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  scriptBodySpecs,
  scriptBodyNativeSources,
  scriptBodyReportStem,
} from '../proof/task/script-body-specs.mjs';
import { prepareTaskScriptBody as prepare } from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import {
  scriptBodyFixture,
  bodyCases,
  bodyWord,
  omitBodyBytes,
} from './task-script-body-fixtures.mjs';
import { audioBodyPCs } from './task-script-body-audio-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
const specs = scriptBodySpecs.filter((s) => scriptBodyReportStem(s.id) === 'script-bodies-audio'),
  at = (id) => specs.find((s) => s.id === id);
for (const spec of specs)
  test(`Whole original audio body${spec.id.toString(16)}: independent full paths, original four arguments/sound table, all menu/audio/C8/END edges`, async () => {
    const report = JSON.parse(
        await readFile('analysis/render-task-script-bodies-audio-native.json'),
      ),
      seen = new Set();
    for (const variant of bodyCases(spec)) {
      const f = scriptBodyFixture(spec, variant),
        p = prepared(prepare, f),
        hasAudio = spec.id === 0x396 || variant.held === 32,
        audio = p.steps.find((s) => s.calleeEntry === 0x80c46e),
        menu = p.steps.find((s) => s.calleeEntry === 0x809ba0),
        c8 = p.steps.find((s) => s.calleeEntry === 0x80fec1);
      assert.equal(p.bodyComplete, true);
      assert.deepEqual(p.bodyPCs, audioBodyPCs(spec, variant));
      assert.equal(p.handlersExecuted, p.bodyPCs.length);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.targetExecuted, false);
      assert.equal(p.outputContext.s, 0xb01);
      assert.equal(p.outputContext.d, 0);
      assert.equal(p.outputContext.bank, spec.scriptEntry >>> 16);
      assert.equal(Boolean(audio), hasAudio);
      assert.equal(p.observationsUsed, f.ioObservations.length);
      assert.equal(p.waitObservationsUsed, f.waitObservations.length);
      assert.equal(p.inputObservationsUsed, f.inputObservations.length);
      if (audio) {
        assert.equal(audio.arguments.wordPops, 4);
        assert.equal(audio.arguments.metadataWord, 0x0104);
        assert.equal(audio.arguments.freshId, 0x4c);
        assert.equal(audio.metadataWord, 0);
        assert.equal(audio.resultPushed, false);
        assert.equal(audio.calleeReturnWord, 0xf508);
        assert.equal(audio.calleeReturnTarget, 0x80f509);
        assert.equal(audio.callee.sound, spec.id === 0x396 ? 0x8031 : 0x1c);
        assert.equal(audio.callee.voice, 3);
        assert.equal(audio.callee.loaderUsed, spec.id === 0x396 && variant.cachedSound !== 0x8031);
        const start = p.accesses.findIndex((r) => r.label === 'saved-ID-low' && r.value === 0x4c),
          records = p.accesses.slice(start);
        const expected = spec.id === 0x396 ? [65535, 90, 200, 3] : [16, 50, 255, 3];
        assert.deepEqual(
          records
            .filter((r) => r.label === 'native-argument-PLA-low')
            .slice(0, 4)
            .map((r) => r.value),
          expected.map((v) => v & 255),
        );
        assert.deepEqual(
          records
            .filter((r) => r.label === 'native-argument-PLA-high')
            .slice(0, 4)
            .map((r) => r.value),
          expected.map((v) => v >>> 8),
        );
        assert.ok(
          p.accesses.some(
            (r) => r.label === 'text-root-WORD-low' && r.address === spec.romReads[0].address,
          ),
        );
      }
      if (spec.id === 0x1d3) {
        assert.equal(menu.callee.nativeResult, hasAudio ? 128 : 0);
        assert.equal(Boolean(c8), hasAudio);
        assert.equal(p.steps.findLast((s) => s.calleeEntry).calleeEntry, 0x80a8f5);
        if (c8) {
          assert.equal(c8.arguments.wordPops, 7);
          assert.equal(c8.callee.allocation, 0);
          assert.equal(c8.callee.outcome, variant.occupied ? 'notice_replaced' : 'notice_inserted');
          assert.equal(c8.callee.slot, variant.occupied ? 0 : 6);
          const start = p.accesses.findIndex((r) => r.label === 'saved-ID-low' && r.value === 0xc8),
            args = [4, 21, 23, 3, 0x800, 0x1fb, 240];
          assert.deepEqual(
            p.accesses
              .slice(start)
              .filter((r) => r.label === 'native-argument-PLA-low')
              .slice(0, 7)
              .map((r) => r.value),
            args.map((v) => v & 255),
          );
          assert.equal(audio.callee.voiceCacheHit, true);
          assert.equal(audio.callee.calls.filter((r) => r.target === 0x81f007).length, 2);
        }
      } else if (audio.callee.loaderUsed) {
        assert.ok(audio.callee.calls.some((r) => r.target === 0x81f130));
        assert.ok(p.accesses.some((r) => r.kind === 'read' && r.address === 0x7e7200));
      }
      for (let n = 1; n < p.bodyPCs.length; n++) seen.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
      assert.deepEqual(
        report.probes.find((r) => r.script_id === spec.id && r.case === variant.name),
        bodyProbe(spec, variant),
      );
      assert.equal(commitTaskPlan(f.data, p).handled, true);
      assert.equal(bodyWord(f.data, 0xb00), 0xc20a);
      if (c8) assert.equal(bodyWord(f.data, 0x7e021e + c8.callee.slot), 240);
    }
    assert.deepEqual([...seen].sort(), spec.edges.map((e) => e.from + ':' + e.to).sort());
  });
test('Original audio bodies: every header/body/following-highbyte, original soundtable byte and reached native metadata highbyte is mandatory before publishing effects', () => {
  for (const spec of specs) {
    const f = scriptBodyFixture(spec, { held: 32, cachedSound: 0 });
    for (let n = 0; n < spec.bytecode.length + 3; n++)
      unchangedFailure(
        prepare,
        omitBodyBytes(f, spec.scriptEntry + n),
        {},
        'render_source_required',
      );
    for (const r of spec.romReads) {
      unchangedFailure(prepare, omitBodyBytes(f, r.address + 1), {}, 'render_source_required');
      const g = scriptBodyFixture(spec, { held: 32 });
      sampleWord(g.data, r.address, r.value ^ 1);
      unchangedFailure(prepare, g, {}, 'task_script_body_bytes_required');
    }
    for (const native of scriptBodyNativeSources.filter((n) =>
      spec.instructions.some((i) => i.opcode === 0x58 && i.operand === n.id),
    ))
      for (const anchor of native.anchors)
        unchangedFailure(
          prepare,
          omitBodyBytes(f, anchor.address + 1),
          {},
          'render_source_required',
        );
    unchangedFailure(prepare, omitBodyBytes(f, 0xb01), {}, 'render_source_required');
  }
});
test('Original audio bodies: every global IO/wait/control sample, strict unused events and exact cumulative budgets remain atomic', () => {
  for (const spec of specs) {
    const f = scriptBodyFixture(spec, { held: 32, cachedSound: 0 }),
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
      {
        waitObservations: menuRecords([
          ...f.waitObservations,
          { pc: 0x81acaf, address: 0x8001f8, width: 2, value: 0 },
        ]),
      },
      'task_wait_observation_unused',
    );
    unchangedFailure(
      prepare,
      f,
      {
        inputObservations: menuRecords([
          ...f.inputObservations,
          { pc: 0x809e1a, address: 0x8001ca, width: 2, value: 32 },
        ]),
      },
      'task_input_observation_unused',
    );
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    unchangedFailure(
      prepare,
      f,
      { maxHandlers: f.maxHandlers - 1 },
      'task_script_body_handler_count_required',
    );
  }
  const cancelled = scriptBodyFixture(at(0x1d3), { held: 0x2000 }),
    full = scriptBodyFixture(at(0x1d3), { held: 32 });
  unchangedFailure(
    prepare,
    cancelled,
    { ioObservations: full.ioObservations },
    'task_io_observation_unused',
  );
  const controls = menuRecords([
    { pc: 0x809e1a, address: 0x8001ca, width: 2, value: 32 },
    { pc: 0x809e1a, address: 0x8001ca, width: 2, value: 0x3030 },
  ]);
  unchangedFailure(prepare, full, { inputObservations: controls }, 'task_reset_source_required');
});
test('Original396: actual audio voice store replaces savedID in a separately observed frame; every preceding body/sample effect is withheld', () => {
  const f = scriptBodyFixture(at(0x396)),
    frame = 0x1cd9;
  for (const [address, value] of f.data.snapshot().bytes)
    if (address >= 0x7e0600 && address <= 0x7e0614)
      f.data.seed(frame + address - 0x7e0600, [value]);
  sampleWord(f.data, 0x800254, frame);
  f.context = Object.freeze({ ...f.context, d: frame });
  const p = unchangedFailure(prepare, f, {}, 'task_native_resume_id_required');
  assert.equal(p.nativeId, 3);
  assert.equal(p.expectedNativeId, 0x4c);
});
test('Original396: full WORD frame/stack aliases change the actual sound index; unproved fresh ROM table reads are rejected without a cached body argument', () => {
  const f = scriptBodyFixture(at(0x396)),
    frame = 65535;
  for (const [address, value] of f.data.snapshot().bytes)
    if (address >= 0x7e0600 && address <= 0x7e0614)
      f.data.seed((frame + address - 0x7e0600) & 65535, [value]);
  sampleWord(f.data, 0x800254, frame);
  f.context = Object.freeze({ ...f.context, d: frame, s: 6 });
  // Real saved-PC/workspace writes replace the pushed Sound90 WORD. Fresh
  // DP02 becomes0, so actualC46E reads C4B3 rather than the proved C50D.
  const p = unchangedFailure(prepare, f, {}, 'task_script_body_ROM_read_required');
  assert.equal(p.address, 0x80c4b3);
});
test('Original audio bodies: real owner/version/commit and late END checks preserve all preceding menu/audio/notice requests', () => {
  for (const spec of specs) {
    const f = scriptBodyFixture(spec, { held: 32, cachedSound: 0 }),
      p = prepared(prepare, f);
    assert.equal(
      commitTaskPlan(scriptBodyFixture(spec).data, p).reason,
      'task_plan_owner_required',
    );
    assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
    f.data.seed(0x100, [1]);
    const before = f.data.snapshot();
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
    assert.deepEqual(f.data.snapshot(), before);
  }
});
