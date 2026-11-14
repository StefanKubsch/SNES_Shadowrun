import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeCCA4 as root } from '../proof/task/native-cca4.mjs';
import { prepareTaskNativeOpcodeCCA4 as call } from '../proof/task/native-opcode-bindings.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { nativeCCA4Spec as spec } from './task-native-cca4-spec.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { bodyWord, omitBodyBytes } from './task-script-body-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { proveNativeOpcode } from './task-native-opcode-source.mjs';
// Closed mathematical expectation for the single circulating bit in a 17-bit ring.
const candidate = (n) => Number((1n << BigInt(((n || 65536) - 1) % 17)) & 65535n);
test('Whole DB: independent 17-bit ring expectation, full WORD count, equality store, fresh unsigned CMP flags and unchanged V/Y/DBR', () => {
  for (const n of [...Array.from({ length: 35 }, (_, i) => i + 1), 0, 65535])
    for (const previous of [0, candidate(n), Math.min(candidate(n) + 1, 65535), 65535]) {
      const f = taskLeafFixture(spec.entry, { status: 0x4d });
      sampleWord(f.data, 0, n);
      sampleWord(f.data, 0x7e2de4, previous);
      const p = prepared(root, f),
        left = candidate(n),
        diff = (left - previous) & 65535,
        store = left >= previous;
      assert.equal(p.outputContext.a, left);
      assert.equal(p.outputContext.x, 0);
      assert.equal(p.outputContext.y, f.context.y);
      assert.equal(p.outputContext.bank, f.context.bank);
      assert.equal(
        p.outputContext.status,
        0x4c | Number(store) | (diff === 0 ? 2 : 0) | (diff & 32768 ? 128 : 0),
      );
      assert.equal(p.work, (n || 65536) + 6 + (store ? 2 : 0));
      assert.equal(p.outputBytes, store ? 2 : 0);
      assert.equal(p.rawReturnWord, 0xc20a);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.returnTargetExecuted, false);
      assert.equal(commitTaskPlan(f.data, p).handled, true);
      assert.equal(bodyWord(f.data, 0x7e2de4), store ? left : previous);
    }
});
test('Whole DB: zero count is 65536 actual budgeted iterations; missing late CMP/RTS high, protected destination and budgets publish no effects', () => {
  const f = taskLeafFixture(spec.entry);
  sampleWord(f.data, 0, 0);
  const p = prepared(root, f);
  assert.equal(p.work, 65544);
  assert.equal(p.outputContext.a, 1);
  prepared(root, { ...f, maxWork: p.work, maxOutputBytes: 2 });
  unchangedFailure(root, f, { maxWork: 65535 }, 'task_work_budget_required');
  unchangedFailure(root, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(root, f, { maxOutputBytes: 1 }, 'task_output_budget_required');
  for (const high of [1, 0x7e2de5, 0x701])
    unchangedFailure(root, omitBodyBytes(f, high), {}, 'render_source_required');
  unchangedFailure(
    root,
    f,
    { protectedStackBytes: [...f.protectedStackBytes, 0x7e2de4] },
    'task_stack_alias_required',
  );
  const g = taskLeafFixture(spec.entry, { bank: 0x7f });
  assert.equal(prepared(root, g).outputContext.bank, 0x7f);
});
test('Whole Native58/DB: original 9C01/0100 metadata including cross-table highs, genuine one pop/no PHA/F508/F509 and exact budgets', () => {
  const f = taskNativeOpcodeFixture(spec),
    p = prepared(call, f),
    s = p.steps[0];
  assert.equal(s.id, 219);
  assert.equal(s.wordPops, 1);
  assert.equal(s.resultPushed, false);
  assert.equal(s.metadataWord, 0x0100);
  assert.equal(s.calleeEntry, spec.entry);
  assert.equal(s.calleeReturnWord, 0xf508);
  assert.equal(s.calleeReturnTarget, 0x80f509);
  assert.equal(
    p.accesses.find((a) => a.label === 'native-argument-metadata-WORD-high').value,
    0x9c,
  );
  assert.equal(p.accesses.find((a) => a.label === 'resume-return-metadata-WORD-high').value, 1);
  assert.equal(p.outputContext.s, 0x3f2);
  assert.equal(p.outputContext.d, 0x200);
  assert.equal(p.outputContext.pc, 0xf390);
  for (const high of [0x82d96f, 0x82db28, 0x82da4c, 0x7e2de5, 0x801206])
    unchangedFailure(call, omitBodyBytes(f, high), {}, 'render_source_required');
  prepared(call, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(call, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(call, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(bodyWord(f.data, 0x7e2de4), 0x8000);
});
test('DB: real argument-workspace/frame-pointer alias refetches the changed stream; missing source withholds prior effects and owner capabilities remain mandatory', () => {
  const f = taskNativeOpcodeFixture(spec),
    frame = 0;
  sampleWord(f.data, frame, 0x1200);
  sampleWord(f.data, frame + 1, 0x8012);
  sampleWord(f.data, frame + 3, 4);
  sampleWord(f.data, frame + 7, 0x3f0);
  sampleWord(f.data, frame + 9, spec.id);
  sampleWord(f.data, 0x800262, frame);
  f.context = Object.freeze({ ...f.context, d: frame });
  unchangedFailure(call, f, {}, 'render_source_required');
  // Generic scalar callers refetch live physical bytes; whole-body guards are separate.
  sampleWord(f.data, 0x800015, 0xa514);
  const p = prepared(call, f);
  assert.equal(p.accesses.find((a) => a.label === 'fresh-next-opcode-pointer-low').value, 16);
  assert.equal(p.accesses.find((a) => a.label === 'fresh-next-opcode-low').address, 0x800015);
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  assert.deepEqual(f.data.snapshot(), before);
  f.data.seed(0, [1]);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
});
test('DB original source: all 21 code bytes and six distinct table bytes are pinned through the complete caller proof', async () => {
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    p = await proveNativeOpcode(bytes, spec);
  assert.deepEqual(
    JSON.parse(await readFile('analysis/render-task-native-opcode-cca4.json')).proofs,
    [p],
  );
  assert.equal(p.admitted_targets[0].proof.reachable_instructions, 10);
  assert.equal(p.admitted_targets[0].proof.minimum_protected_stack_bytes, 2);
  for (const w of [...spec.windows, ...spec.anchors])
    for (let n = 0; n < w.hex.length / 2; n++) {
      const changed = Buffer.from(bytes);
      changed[cpuToOffset(w.start + n, bytes.length)] ^= 1;
      await assert.rejects(() => proveNativeOpcode(changed, spec));
    }
});
