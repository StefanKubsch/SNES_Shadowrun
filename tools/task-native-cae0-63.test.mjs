import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeCAE0 as rootA0 } from '../proof/task/native-cae0.mjs';
import { prepareTaskNativeOpcodeCAE0 as callA0 } from '../proof/task/native-opcode-bindings.mjs';
import { prepareTaskNativeOpcodeC560 as call63 } from '../proof/task/native-random-opcode.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { taskNativeRandomOpcodeFixture as randomFixture } from './task-native-random-fixtures.mjs';
import { nativeCAE0Spec } from './task-native-cae0-spec.mjs';
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
test('Whole A0: zero fresh fullWORDpointer skips DP02; nonzero stores only oneBYTE without target preread or lost accumulator high/flags', () => {
  for (const byte of [0, 1, 128, 255]) {
    const f = taskLeafFixture(0x80cae0);
    sampleWord(f.data, 2, 0xab00 | byte);
    const g = omitBodyBytes(f, 3, 0x7e0402),
      p = prepared(rootA0, g);
    assert.equal(p.outputBytes, 1);
    assert.equal(p.outputContext.a, 0xab00 | byte);
    assert.equal(p.outputContext.status & 0x82, byte === 0 ? 2 : byte >= 128 ? 128 : 0);
    assert.equal(p.outputContext.status & 0x41, 0x41);
    assert.equal(p.outputContext.status & 0x30, 0);
    assert.equal(p.readAddresses.includes(0x7e0402), false);
    assert.equal(commitTaskPlan(g.data, p).handled, true);
    assert.equal(g.data.readByte(0x7e0402).value, byte);
    assert.equal(g.data.readByte(0x7e0403).value, 0x78);
  }
  const f = taskLeafFixture(0x80cae0);
  sampleWord(f.data, 0x8013b8, 0);
  const g = omitBodyBytes(f, 2, 3),
    p = prepared(rootA0, { ...g, maxOutputBytes: 0 });
  assert.equal(p.outputBytes, 0);
  assert.equal(p.outputContext.a, 0xabcd);
  assert.equal(p.outputContext.x, 0);
  assert.equal(p.outputContext.y, 16);
  assert.equal(p.outputContext.status & 0x82, 2);
});
test('Whole A0: full Y/actualDBR and full X/long24bit bankcarry, protected RTS/high/source/budget failures remain atomic', () => {
  const f = taskLeafFixture(0x80cae0);
  sampleWord(f.data, 0, 65535);
  sampleWord(f.data, 0x8113a7, 65535);
  sampleWord(f.data, 2, 0xb37e);
  const p = prepared(rootA0, f);
  assert.equal(
    p.accesses.some((a) => a.kind === 'read' && a.address === 0x8113a7),
    true,
  );
  assert.deepEqual(p.byteWrites, [[0x7f0001, 0x7e]]);
  unchangedFailure(rootA0, omitBodyBytes(f, 0x8113a8), {}, 'render_source_required');
  unchangedFailure(rootA0, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(rootA0, f, { maxOutputBytes: 0 }, 'task_output_budget_required');
  unchangedFailure(
    rootA0,
    f,
    { protectedStackBytes: [0x7e0700, 0x7e0702] },
    'task_outer_return_required',
  );
  const banked = taskLeafFixture(0x80cae0, { bank: 0x7f });
  sampleWord(banked.data, 0x7f13b8, 0x400);
  sampleWord(banked.data, 2, 0xff80);
  assert.deepEqual(prepared(rootA0, banked).byteWrites, [[0x7e0402, 0x80]]);
});
test('Whole Native58/A0: original two pops and no result PHA, actual F508/F509 and fresh frame/opcode', () => {
  const f = taskNativeOpcodeFixture(nativeCAE0Spec),
    p = prepared(callA0, f),
    s = p.steps[0];
  assert.equal(s.id, 0xa0);
  assert.equal(s.wordPops, 2);
  assert.equal(s.resultPushed, false);
  assert.equal(s.metadataWord, 0);
  assert.equal(s.calleeEntry, 0x80cae0);
  assert.equal(s.calleeReturnWord, 0xf508);
  assert.equal(s.calleeReturnTarget, 0x80f509);
  assert.equal(p.outputContext.s, 0x3f4);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(f.data.readByte(0x7e0402).value, 3);
  assert.equal(f.data.readByte(0x7e0403).value, 0x78);
});
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
