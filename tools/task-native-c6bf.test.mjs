import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeC6BF as root } from '../proof/task/native-c6bf.mjs';
import { prepareTaskNativeC6C4 as one } from '../proof/task/native-c6c4.mjs';
import { prepareTaskNativeOpcodeC6BF as call } from '../proof/task/native-opcode-bindings.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { nativeC6BFSpec as spec } from './task-native-c6bf-spec.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { bodyWord, omitBodyBytes } from './task-script-body-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { proveNativeOpcode } from './task-native-opcode-source.mjs';
test('Native81 zero and original1D one keep separate entry contracts with the same individually pinned C6C7 tail', () => {
  const f = taskLeafFixture(spec.entry),
    g = taskLeafFixture(0x80c6c4),
    p = prepared(root, f),
    q = prepared(one, g);
  assert.deepEqual(p.byteWrites.slice(0, 2), [
    [0x7e4148, 0],
    [0x7e4149, 0],
  ]);
  assert.deepEqual(q.byteWrites.slice(0, 2), [
    [0x7e4148, 1],
    [0x7e4149, 0],
  ]);
  assert.deepEqual(p.byteWrites.slice(2), q.byteWrites.slice(2));
  assert.deepEqual(p.outputContext, q.outputContext);
  assert.deepEqual(p.accesses.slice(4), q.accesses.slice(4));
  assert.equal(p.outputContext.y, 21);
  assert.equal(p.outputContext.a, 1);
  assert.equal(p.outputContext.status & 0x41, 1);
  assert.equal(p.rawReturnWord, 0xc20a);
  assert.equal(p.returnTargetExecuted, false);
});
test('Native81 full WORD count preserves sequential SBC borrow and indices; long destination bankcarry and fresh coordinate highs stay explicit', () => {
  const f = taskLeafFixture(spec.entry);
  sampleWord(f.data, 0, 65535);
  sampleWord(f.data, 2, 0x8001);
  sampleWord(f.data, 0x8d9006, 0x8000);
  sampleWord(f.data, 0x8d9008, 65535);
  const p = prepared(root, f);
  assert.equal(p.outputContext.x, 65535);
  assert.equal(p.outputContext.y, 8);
  assert.equal(p.outputContext.status & 0x41, 1);
  assert.deepEqual(p.byteWrites, [
    [0x7f4137, 0],
    [0x7f4138, 0],
    [0x7f418f, 0],
    [0x7f4190, 0],
    [0x7f41e7, 252],
    [0x7f41e8, 255],
    [0x7f40df, 1],
    [0x7f40e0, 0],
  ]);
  assert.equal(p.accesses.filter((a) => a.label === 'leaf-long-bank').length, 2);
  unchangedFailure(root, omitBodyBytes(f, 0x8d9009), {}, 'render_source_required');
  const g = taskLeafFixture(spec.entry);
  sampleWord(g.data, 2, 0x8000);
  sampleWord(g.data, 0x8d9000, 3);
  sampleWord(g.data, 0x8d9002, 4);
  assert.equal(prepared(root, g).outputContext.y, 2); // First SBC borrow makes final index0, not1.
});
test('Native81 initial zero store aliases its later physical coordinate source; fresh overlay reads, late source/binary/return/budget errors are atomic', () => {
  const f = taskLeafFixture(spec.entry);
  f.data.seed(0xf3, [0x35, 0x41, 0x7e]);
  sampleWord(f.data, 0x7e4148, 0x1234);
  sampleWord(f.data, 0x7e414a, 65535);
  const p = prepared(root, f);
  assert.equal(p.accesses.find((a) => a.label === 'leaf-long-WORD-low').value, 0);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(bodyWord(f.data, 0x7e41a0), 0);
  assert.equal(bodyWord(f.data, 0x7e41f8), 0xfffc);
  const g = taskLeafFixture(spec.entry),
    q = prepared(root, g);
  for (const a of [0xf5, 0x8d9016, 0x701])
    unchangedFailure(root, omitBodyBytes(g, a), {}, 'render_source_required');
  unchangedFailure(
    root,
    g,
    { context: Object.freeze({ ...g.context, status: g.context.status | 8 }) },
    'task_binary_arithmetic_required',
  );
  unchangedFailure(root, g, { maxWork: q.work - 1 }, 'task_work_budget_required');
  unchangedFailure(root, g, { maxOutputBytes: 7 }, 'task_output_budget_required');
  const before = g.data.snapshot();
  assert.equal(commitTaskPlan(g.data, { ...q }).reason, 'task_plan_owner_required');
  assert.deepEqual(g.data.snapshot(), before);
});
test('Native58/81 actual two pops, no PHA and F508/F509; all original metadata highs, live stack/count aliases and exact budgets', () => {
  const f = taskNativeOpcodeFixture(spec),
    p = prepared(call, f),
    s = p.steps[0];
  assert.equal(s.id, 129);
  assert.equal(s.wordPops, 2);
  assert.equal(s.resultPushed, false);
  assert.equal(s.metadataWord, 0);
  assert.equal(s.calleeReturnWord, 0xf508);
  assert.equal(s.calleeReturnTarget, 0x80f509);
  assert.equal(p.outputContext.s, 0x3f4);
  assert.equal(p.outputContext.y, 6);
  assert.equal(p.outputContext.d, 0x200);
  for (const a of [0x82d8bb, 0x82dace, 0x82d9f2, 0x8d9016, 0x801206])
    unchangedFailure(call, omitBodyBytes(f, a), {}, 'render_source_required');
  prepared(call, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(call, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(call, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  const g = taskNativeOpcodeFixture(spec);
  sampleWord(g.data, 0x8001f2, 3);
  sampleWord(g.data, 4, 0xc20a);
  g.protectedStackBytes = [0x7e0004, 0x7e0005];
  const boundary = unchangedFailure(call, g, {}, 'render_address_required');
  assert.equal(boundary.address, 0x8e4e30);
});
test('Native81 source pins both reachable windows and six original metadata bytes; skipped Native1D LDA1 is excluded from this root', async () => {
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    p = await proveNativeOpcode(bytes, spec);
  assert.deepEqual(
    JSON.parse(await readFile('analysis/render-task-native-opcode-c6bf.json')).proofs,
    [p],
  );
  assert.equal(p.admitted_targets[0].proof.reachable_instructions, 26);
  assert.equal(p.admitted_targets[0].proof.minimum_protected_stack_bytes, 2);
  for (const w of [...spec.windows, ...spec.anchors])
    for (let n = 0; n < w.hex.length / 2; n++) {
      const b = Buffer.from(bytes);
      b[cpuToOffset(w.start + n, bytes.length)] ^= 1;
      await assert.rejects(() => proveNativeOpcode(b, spec));
    }
});
