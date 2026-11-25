import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeOpcodeC560 as call63 } from '../proof/task/native-random-opcode.mjs';
import { taskNativeRandomOpcodeFixture as randomFixture } from './task-native-random-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { bodyWord, omitBodyBytes } from './task-script-body-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { proveTaskNativeRandomOpcode } from './task-native-random-opcode-source.mjs';
import {
  randomWindows,
  randomTables,
  random63Anchors,
} from './render-task-native-random-source-proof.mjs';
test('Whole Native63: zero actual pops preserve the old operand, original0100/0002 and real PHP/PLP/F508-F509/resultPHA', () => {
  const f = randomFixture({ id: 0x63 });
  sampleWord(f.data, 0x3f1, 0xbeef);
  const p = prepared(call63, f);
  assert.equal(p.arguments.wordPops, 0);
  assert.equal(p.arguments.metadataWord, 0x0100);
  assert.equal(p.arguments.id, 0x63);
  assert.equal(p.arguments.freshId, 0x63);
  assert.equal(p.metadataWord, 2);
  assert.equal(p.resultPushed, true);
  assert.equal(p.calleeEntry, 0x80c560);
  assert.equal(p.calleeReturnWord, 0xf508);
  assert.equal(p.calleeReturnTarget, 0x80f509);
  assert.equal(p.outputContext.s, 0x3ee);
  assert.equal(p.outputContext.d, 0x1000);
  assert.equal(p.outputContext.bank, 0x80);
  assert.equal(p.observationsUsed, 3);
  assert.equal(p.accesses.filter((a) => a.label === 'native-argument-PLA-low').length, 0);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(bodyWord(f.data, 0x3ef), 26);
  assert.equal(bodyWord(f.data, 0x3f1), 0xbeef);
});
test('Native63: fresh original metadata/table highs, ordered frozen PPU samples, exact budgets and late fresh saved-ID/root-frame aliases', () => {
  const f = randomFixture({ id: 0x63 }),
    p = prepared(call63, f);
  for (const address of [0x82d87f, 0x82dab0, 0x82d9d4, 0x80c58d, 0x7e1c77])
    unchangedFailure(call63, omitBodyBytes(f, address), {}, 'render_source_required');
  for (let n = 0; n < 3; n++)
    unchangedFailure(
      call63,
      f,
      { ioObservations: Object.freeze(f.ioObservations.filter((_, i) => i !== n)) },
      'task_io_observation_required',
    );
  unchangedFailure(
    call63,
    f,
    { ioObservations: Object.freeze([...f.ioObservations, f.ioObservations[0]]) },
    'task_io_observation_unused',
  );
  prepared(call63, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(call63, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(call63, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  for (const [address, value, reason] of [
    [0x82daaf, 0, 'task_native63_argument_source_required'],
    [0x82d87e, 0xc51f, 'task_native63_target_required'],
    [0x82d9d3, 0, 'task_native63_return_source_required'],
  ]) {
    const g = randomFixture({ id: 0x63 });
    sampleWord(g.data, address, value);
    unchangedFailure(call63, g, {}, reason);
  }
  unchangedFailure(
    call63,
    randomFixture({ id: 0x63, frame: 0x1cdf }),
    {},
    'task_native_resume_id_required',
  );
  unchangedFailure(
    call63,
    randomFixture({ id: 0x63, s: 0x1cea }),
    {},
    'task_random_return_mode_required',
  );
  unchangedFailure(
    call63,
    randomFixture({ id: 0x63, s: 0x1ce9 }),
    {},
    'task_native_resume_target_required',
  );
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  assert.deepEqual(f.data.snapshot(), before);
  f.data.seed(0, [1]);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
});
test('Native63: script DBR7F reads the fresh result from7F0000 rather than copying helper DP00/7E', () => {
  const f = randomFixture({ id: 0x63 });
  sampleWord(f.data, 0x1001, 0x7f12);
  sampleWord(f.data, 0x7f01f2, 0x6ff);
  f.data.seed(0x7f1204, [0x63, 0x14, 0xa5]);
  sampleWord(f.data, 0x7f0000, 0xbeef);
  const p = prepared(call63, { ...f, context: Object.freeze({ ...f.context, bank: 0x7f }) });
  assert.equal(p.outputContext.bank, 0x7f);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(bodyWord(f.data, 0x3ef), 0xbeef);
  assert.equal(bodyWord(f.data, 0), 26);
});
test('Native63 source: separate original metadata, whole C560/source tables and every byte of helper/anchors remain mandatory', async () => {
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    p = await proveTaskNativeRandomOpcode(bytes, 0x63);
  assert.deepEqual(
    JSON.parse(await readFile('analysis/render-task-native-opcode-c560.json')).proofs,
    [p],
  );
  assert.deepEqual(
    p.admitted_targets.map((t) => [t.id, t.target]),
    [[0x63, '80:C560']],
  );
  assert.equal(p.admitted_targets[0].proof.minimum_protected_stack_bytes, 3);
  assert.equal(p.admitted_targets[0].proof.reachable_instructions, 19);
  assert.equal(p.full_task_binding, false);
  assert.equal(p.global_stack_minimum, null);
  for (const w of [...randomWindows.slice(1), ...randomTables.slice(1), ...random63Anchors])
    for (let n = 0; n < w.hex.length / 2; n++) {
      const changed = Buffer.from(bytes);
      changed[cpuToOffset(w.start + n, bytes.length)] ^= 1;
      await assert.rejects(() => proveTaskNativeRandomOpcode(changed, 0x63));
    }
});
