import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeCAB4 } from '../proof/task/native-cab4.mjs';
import { prepareTaskNative9D7A } from '../proof/task/native-9d7a.mjs';
import {
  prepareTaskNativeOpcodeCAB4,
  prepareTaskNativeOpcode9D7A,
} from '../proof/task/native-opcode-bindings.mjs';
import { nativeCAB4Spec } from './task-native-cab4-spec.mjs';
import { native9D7ASpec } from './task-native-9d7a-spec.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { bodyWord, omitBodyBytes } from './task-script-body-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { proveNativeOpcode } from './task-native-opcode-source.mjs';
const rows = [
  [nativeCAB4Spec, prepareTaskNativeCAB4, prepareTaskNativeOpcodeCAB4],
  [native9D7ASpec, prepareTaskNative9D7A, prepareTaskNativeOpcode9D7A],
];
for (const [spec, root, call] of rows) {
  test(`${spec.name}: null gate skips record/DP02, preserves live A/C/V, and consumes actual protected RTS`, () => {
    for (const status of [0, 1, 0x43, 0xc1]) {
      const f = taskLeafFixture(spec.entry, { status, a: 0xabcd });
      sampleWord(f.data, 0x8013b8, 0);
      const g = omitBodyBytes(f, 2, 3, 0x7e0401, 0x7e0402, 0x7e0403, 0x7e0404),
        p = prepared(root, g);
      assert.equal(p.outputContext.a, 0xabcd);
      assert.equal(p.outputContext.x, 0);
      assert.equal(p.outputContext.y, 16);
      assert.equal(p.outputContext.status, (status & ~0x82) | 2);
      assert.equal(p.outputBytes, 0);
      assert.equal(p.rawReturnWord, 0xc20a);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.returnTargetExecuted, false);
      unchangedFailure(root, omitBodyBytes(g, 0x8013b9), {}, 'render_source_required');
    }
  });
  test(`${spec.name}: full indices/actual DBR/24bit carries, preserved BYTE high, exact limits and protected destination`, () => {
    for (const bank of [0x80, 0x7e, 0x7f])
      for (const index of [16, 0xfff0])
        for (const pointer of [0x400, 0xffff]) {
          const f = taskLeafFixture(spec.entry, { bank, a: 0xabcd, status: 0x41 });
          sampleWord(f.data, 0, index);
          sampleWord(f.data, (bank * 65536 + 0x13a8 + index) & 0xffffff, pointer);
          sampleWord(f.data, 2, 0xff80);
          sampleWord(f.data, 0x7e0001 + pointer, 0xab01);
          const g =
            spec.id === 0x33
              ? omitBodyBytes(f, 3, 0x7e0002 + pointer)
              : omitBodyBytes(f, 0x7e0003 + pointer, 0x7e0004 + pointer);
          const p = prepared(root, g),
            address = 0x7e0000 + pointer + (spec.id === 0x33 ? 1 : 3);
          assert.equal(p.outputContext.a, spec.id === 0x33 ? 0xab81 : 0x1538);
          assert.equal(p.outputContext.x, pointer);
          assert.equal(p.outputContext.y, index);
          assert.equal(p.outputContext.status, spec.id === 0x33 ? 0xc1 : 0x41);
          assert.equal(p.outputBytes, spec.id === 0x33 ? 1 : 2);
          assert.equal(
            p.accesses.some((a) => a.kind === 'read' && a.address === address),
            spec.id === 0x33,
          );
          prepared(root, { ...g, maxWork: p.work, maxOutputBytes: p.outputBytes });
          unchangedFailure(root, g, { maxWork: p.work - 1 }, 'task_work_budget_required');
          unchangedFailure(
            root,
            g,
            { maxOutputBytes: p.outputBytes - 1 },
            'task_output_budget_required',
          );
          unchangedFailure(
            root,
            g,
            { protectedStackBytes: [...g.protectedStackBytes, address] },
            'task_stack_alias_required',
          );
          assert.equal(commitTaskPlan(g.data, p).handled, true);
          assert.equal(g.data.readByte(address).value, spec.id === 0x33 ? 0x81 : 0x38);
        }
  });
  test(`${spec.name}: own Native58 WORD metadata highs and fresh F508/F509/Taskframe/ID/opcode, no resultPHA`, () => {
    const f = taskNativeOpcodeFixture(spec),
      p = prepared(call, f),
      s = p.steps[0];
    assert.equal(s.id, spec.id);
    assert.equal(s.freshId, spec.id);
    assert.equal(s.wordPops, spec.id === 0x33 ? 2 : 1);
    assert.equal(s.resultPushed, false);
    assert.equal(s.calleeReturnWord, 0xf508);
    assert.equal(s.calleeReturnTarget, 0x80f509);
    assert.equal(p.outputContext.s, f.context.s + 2 * s.wordPops);
    assert.equal(p.outputContext.d, f.context.d);
    assert.equal(p.outputContext.pc, 0xf390);
    for (const a of spec.anchors)
      unchangedFailure(call, omitBodyBytes(f, a.start + 1), {}, 'render_source_required');
    unchangedFailure(call, omitBodyBytes(f, 0x801206), {}, 'render_source_required');
    const before = f.data.snapshot();
    assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
    assert.deepEqual(f.data.snapshot(), before);
    f.data.seed(0, [1]);
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  });
  test(`${spec.name}: every code/table byte invalidates the whole renewed Native58 source proof`, async () => {
    const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
      p = await proveNativeOpcode(bytes, spec);
    assert.equal(p.admitted_targets[0].proof.minimum_protected_stack_bytes, 2);
    assert.equal(p.admitted_targets[0].proof.external_return_assumptions, 0);
    for (const w of [...spec.windows, ...spec.anchors])
      for (let n = 0; n < w.hex.length / 2; n++) {
        const changed = Buffer.from(bytes);
        changed[cpuToOffset(w.start + n, bytes.length)] ^= 1;
        await assert.rejects(() => proveNativeOpcode(changed, spec));
      }
  });
}
test('Native33 alias of DP02 reads the actual record-loaded low byte afresh; C5 checks both RTS bytes after stores', () => {
  const f = taskLeafFixture(nativeCAB4Spec.entry);
  f.context = Object.freeze({ ...f.context, a: 0xca00 });
  sampleWord(f.data, 0x8013b8, 1);
  sampleWord(f.data, 2, 0xab40);
  const p = prepared(prepareTaskNativeCAB4, f);
  assert.equal(p.outputContext.a, 0xca40);
  assert.equal(p.outputContext.status & 0x82, 0);
  const g = taskLeafFixture(native9D7ASpec.entry);
  sampleWord(g.data, 0x8013b8, 0x6fe);
  unchangedFailure(prepareTaskNative9D7A, g, {}, 'task_stack_alias_required');
});
