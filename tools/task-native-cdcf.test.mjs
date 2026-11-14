import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeCDCF as root } from '../proof/task/native-cdcf.mjs';
import { prepareTaskNativeOpcodeCDCF as call } from '../proof/task/native-opcode-bindings.mjs';
import { nativeCDCFSpec as spec } from './task-native-cdcf-spec.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { bodyWord, omitBodyBytes } from './task-script-body-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { proveNativeOpcode } from './task-native-opcode-source.mjs';

test('Whole Native80: actual DBR WORD destination, no pre-read, preserved indexes/C/V and actual RTS under exact budgets', () => {
  for (const bank of [0, 0x80, 0x7e, 0x7f])
    for (const status of [0, 1, 2, 0x43, 0x8f]) {
      const f = taskLeafFixture(spec.entry, { bank, status }),
        p = prepared(root, f),
        address = bank * 65536 + 0x1d63;
      assert.equal(p.outputContext.a, 65535);
      assert.equal(p.outputContext.status, (status & ~0x82) | 0x80);
      for (const k of ['x', 'y', 'bank', 'd']) assert.equal(p.outputContext[k], f.context[k]);
      assert.equal(p.rawReturnWord, 0xc20a);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.returnTargetExecuted, false);
      assert.equal(p.work, 4);
      assert.equal(p.outputBytes, 2);
      assert.deepEqual(
        p.accesses.filter((a) => a.kind === 'write').map((a) => [a.address, a.value]),
        [
          [address, 255],
          [address + 1, 255],
        ],
      );
      assert.ok(!p.accesses.some((a) => a.kind === 'read' && a.address === address));
      prepared(root, { ...f, maxWork: 4, maxOutputBytes: 2 });
      unchangedFailure(root, f, { maxWork: 3 }, 'task_work_budget_required');
      unchangedFailure(root, f, { maxOutputBytes: 1 }, 'task_output_budget_required');
      unchangedFailure(root, omitBodyBytes(f, 0x701), {}, 'render_source_required');
      assert.equal(commitTaskPlan(f.data, p).handled, true);
      assert.equal(bodyWord(f.data, address), 65535);
    }
  const f = taskLeafFixture(spec.entry, { s: 0x1d62, savedOuterS: 0x1d62 });
  unchangedFailure(root, f, {}, 'task_stack_alias_required');
});
test('Whole Native58/80: own CDCF/0200/0000 highs, zero pops, actual F508/F509 and fresh frame/context/next fetch', () => {
  const f = taskNativeOpcodeFixture(spec),
    p = prepared(call, f),
    s = p.steps[0];
  assert.equal(s.id, 0x80);
  assert.equal(s.freshId, 0x80);
  assert.equal(s.wordPops, 0);
  assert.equal(s.resultPushed, false);
  assert.equal(s.metadataWord, 0);
  assert.equal(s.calleeEntry, spec.entry);
  assert.equal(s.calleeReturnWord, 0xf508);
  assert.equal(s.calleeReturnTarget, 0x80f509);
  assert.equal(p.outputContext.s, f.context.s);
  assert.equal(p.outputContext.d, f.context.d);
  assert.equal(p.outputContext.bank, 0x80);
  assert.equal(p.outputContext.pc, 0xf390);
  assert.equal(p.accesses.find((a) => a.label === 'native-argument-metadata-WORD-high').value, 2);
  assert.equal(p.accesses.filter((a) => a.label === 'native-argument-PLA-low').length, 0);
  for (const high of [0x82d8b9, 0x82dacd, 0x82d9f1, 0x801206, 0x263])
    unchangedFailure(call, omitBodyBytes(f, high), {}, 'render_source_required');
  prepared(call, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(call, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(call, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  unchangedFailure(
    call,
    f,
    { protectedStackBytes: [...f.protectedStackBytes, 0x7e1d64] },
    'task_stack_alias_required',
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(bodyWord(f.data, 0x801d63), 65535);
  const g = taskNativeOpcodeFixture(spec),
    frame = 0x1d63;
  for (const [o, v] of [
    [0, 0x1200],
    [1, 0x8012],
    [3, 4],
    [7, 0x3f0],
    [9, 0x80],
  ])
    sampleWord(g.data, frame + o, v);
  sampleWord(g.data, 0x800262, frame);
  g.context = Object.freeze({ ...g.context, d: frame });
  // The new 81:0004 stream aliases the existing physical DP04 fixture bytes.
  const failed = unchangedFailure(call, omitBodyBytes(g, 4, 5), {}, 'render_source_required');
  assert.equal(failed.address, 0x7e0004);
  sampleWord(g.data, 0x810004, 0xa514);
  const q = prepared(call, g);
  assert.equal(q.accesses.find((a) => a.label === 'fresh-next-opcode-pointer-low').value, 255);
  assert.equal(q.accesses.find((a) => a.label === 'fresh-next-opcode-pointer-high').value, 255);
  assert.equal(q.accesses.find((a) => a.label === 'fresh-next-opcode-low').address, 0x810004);
  const before = g.data.snapshot();
  assert.equal(commitTaskPlan(g.data, { ...q }).reason, 'task_plan_owner_required');
  assert.deepEqual(g.data.snapshot(), before);
  g.data.seed(0, [1]);
  assert.equal(commitTaskPlan(g.data, q).reason, 'task_plan_stale');
});
test('Native80 source: all seven code bytes and all six own table bytes are pinned through complete caller proof', async () => {
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    p = await proveNativeOpcode(bytes, spec);
  assert.deepEqual(
    JSON.parse(await readFile('analysis/render-task-native-opcode-cdcf.json')).proofs,
    [p],
  );
  assert.equal(p.admitted_targets[0].proof.reachable_instructions, 3);
  assert.equal(p.admitted_targets[0].proof.minimum_protected_stack_bytes, 2);
  for (const w of [...spec.windows, ...spec.anchors])
    for (let n = 0; n < w.hex.length / 2; n++) {
      const changed = Buffer.from(bytes);
      changed[cpuToOffset(w.start + n, bytes.length)] ^= 1;
      await assert.rejects(() => proveNativeOpcode(changed, spec));
    }
});
