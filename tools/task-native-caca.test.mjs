import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeCACA as root } from '../proof/task/native-caca.mjs';
import { prepareTaskNativeOpcodeCACA as call } from '../proof/task/native-opcode-bindings.mjs';
import { nativeCACASpec as spec } from './task-native-caca-spec.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { omitBodyBytes as omit } from './task-script-body-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { proveNativeOpcode } from './task-native-opcode-source.mjs';
const put = (f, a, v) => sampleWord(f.data, a, v);
test('Native7A: full WORD nullgate precedes record and mask reads while preserving A/C/V and actual protected RTS', () => {
  for (const status of [0, 1, 0x43, 0xc1]) {
    const f = taskLeafFixture(spec.entry, { status });
    put(f, 0x8013b8, 0);
    const g = omit(f, 2, 3, 0x7e0401, 0x7e0402),
      p = prepared(root, g);
    assert.equal(p.outputContext.a, 0xabcd);
    assert.equal(p.outputContext.x, 0);
    assert.equal(p.outputContext.y, 16);
    assert.equal(p.outputContext.status, (status & ~0x82) | 2);
    assert.equal(p.outputBytes, 0);
    assert.equal(p.returnTarget, 0x80c20b);
    unchangedFailure(root, omit(g, 0x8013b9), {}, 'render_source_required');
  }
});
test('Native7A: BYTE AND, untouched highs, actual DBR/full indices/bank carries and exact atomic limits', () => {
  for (const bank of [0x80, 0x7e, 0x7f])
    for (const index of [16, 0xfff0])
      for (const pointer of [0x400, 65535])
        for (const [record, mask] of [
          [0x80, 0x7f],
          [0xff, 0x7f],
          [0xf0, 0xa5],
        ]) {
          const f = taskLeafFixture(spec.entry, { bank, status: 0x41 });
          put(f, 0, index);
          put(f, (bank * 65536 + 0x13a8 + index) & 0xffffff, pointer);
          put(f, 2, 0xff00 | mask);
          put(f, 0x7e0001 + pointer, 0xab00 | record);
          const g = omit(f, 3, 0x7e0002 + pointer),
            p = prepared(root, g),
            value = record & mask;
          assert.equal(p.outputContext.a, 0xab00 | value);
          assert.equal(p.outputContext.x, pointer);
          assert.equal(p.outputContext.y, index);
          assert.equal(
            p.outputContext.status,
            0x41 | (value === 0 ? 2 : 0) | (value & 0x80 ? 0x80 : 0),
          );
          assert.equal(p.outputBytes, 1);
          prepared(root, { ...g, maxWork: p.work, maxOutputBytes: 1 });
          unchangedFailure(root, g, { maxWork: p.work - 1 }, 'task_work_budget_required');
          unchangedFailure(root, g, { maxOutputBytes: 0 }, 'task_output_budget_required');
          unchangedFailure(
            root,
            g,
            { protectedStackBytes: [...g.protectedStackBytes, 0x7e0001 + pointer] },
            'task_stack_alias_required',
          );
          assert.equal(commitTaskPlan(g.data, p).handled, true);
          assert.equal(g.data.readByte(0x7e0001 + pointer).value, value);
        }
});
test('Native7A: actual record-DP02 alias reads the fresh same BYTE and owns separate Native58 pops/metadata/return/PC proof', () => {
  const alias = taskLeafFixture(spec.entry);
  alias.context = Object.freeze({ ...alias.context, a: 0xca00 });
  put(alias, 0x8013b8, 1);
  put(alias, 2, 0xab40);
  const p = prepared(root, omit(alias, 3));
  assert.equal(p.outputContext.a, 0xca40);
  assert.equal(p.outputContext.status & 0x82, 0);
  const f = taskNativeOpcodeFixture(spec),
    q = prepared(call, f),
    s = q.steps[0];
  assert.equal(s.wordPops, 2);
  assert.equal(s.resultPushed, false);
  assert.equal(s.calleeEntry, spec.entry);
  assert.equal(s.calleeReturnWord, 0xf508);
  assert.equal(s.calleeReturnTarget, 0x80f509);
  for (const a of spec.anchors)
    unchangedFailure(call, omit(f, a.start + 1), {}, 'render_source_required');
  unchangedFailure(call, omit(f, 0x801206), {}, 'render_source_required');
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, { ...q }).reason, 'task_plan_owner_required');
  assert.deepEqual(f.data.snapshot(), before);
});
test('Native7A: every original callee/table byte invalidates its complete own Native58 source', async () => {
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    p = await proveNativeOpcode(bytes, spec);
  assert.equal(p.admitted_targets[0].proof.maximum_local_stack_bytes, 0);
  assert.equal(p.admitted_targets[0].proof.minimum_protected_stack_bytes, 2);
  for (const w of [...spec.windows, ...spec.anchors])
    for (let n = 0; n < w.hex.length / 2; n++) {
      const changed = Buffer.from(bytes);
      changed[cpuToOffset(w.start + n, bytes.length)] ^= 1;
      await assert.rejects(() => proveNativeOpcode(changed, spec));
    }
});
