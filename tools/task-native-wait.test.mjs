import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { taskRomHash } from './task-partial-source.mjs';
import { proveNativeWaitSources } from './task-native-wait-source.mjs';
import { nativeWaitFixture as fixture } from './task-native-wait-fixtures.mjs';
import {
  prepareTaskNativeWait as wait,
  prepareTaskNativeWaitOpcode as opcode,
  prepareTaskNativeWaitResume as resume,
} from '../proof/task/native-wait.mjs';
import { prepareTaskVisit } from '../proof/task/visit-c1ca.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
const put = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const word = (f, a) => f.data.readByte(a).value | (f.data.readByte(a + 1).value << 8);
function omit(f, address) {
  const snap = f.data.snapshot(),
    data = createRenderData({ writeWindows: snap.writeWindows });
  for (const [a, v] of snap.bytes) if (a !== renderAddress(address)) data.seed(a, [v]);
  return { ...f, data };
}

test('Native9F source and both joins are renewed, exact code and metadata mutation is rejected', async () => {
  const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
  assert.equal(metadata.rom_sha256, taskRomHash);
  const p = await proveNativeWaitSources(bytes);
  assert.deepEqual(p, JSON.parse(await readFile('analysis/render-task-native-wait.json')));
  assert.deepEqual(
    p.proofs.map((p) => p.entry),
    ['80:C401', '80:F390', '80:C1F9'],
  );
  assert.equal(p.completed_script_bodies, 0);
  assert.equal(p.proofs[0].visited.length, 9);
  const addresses = new Set(
    p.proofs[1].callee.visited.map((s) => parseInt(s.replace(':', ''), 16)),
  );
  for (const w of p.windows) {
    const at = parseInt(w.entry.replace(':', ''), 16);
    addresses.add(at);
    addresses.add(at + w.covered_bytes - 1);
  }
  for (const a of p.proofs[1].anchors) {
    const at = parseInt(a.entry.replace(':', ''), 16);
    addresses.add(at);
    addresses.add(at + 1);
  }
  for (let n = 0; n < 21; n++) addresses.add(0x80c401 + n);
  for (const address of addresses) {
    const changed = Buffer.from(bytes);
    changed[cpuToOffset(address, bytes.length)] ^= 1;
    await assert.rejects(() => proveNativeWaitSources(changed), address.toString(16));
  }
});
test('Native9F has distinct discarded and protected return WORDs, full odd indices and actual DBR', () => {
  for (const bank of [0x80, 0x7e])
    for (const slot of [0, 1, 2, 0x100, 0xffff]) {
      const f = fixture(0x80c401, { bank, slot, mask: 0x8123, count: 0x3456, discard: 0x789a });
      const p = commit(wait, f),
        base = bank * 65536;
      assert.equal(word(f, base + 0xba2 + slot), 0x8123);
      assert.equal(word(f, base + 0xc02 + slot), 0x3456);
      assert.equal(word(f, base + 0xc62 + slot), 0);
      assert.equal(word(f, base + 0x2b2 + slot), 0x789a);
      assert.equal(p.savedContinuationWord, 0x789a);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.outputContext.s, 0x701);
      assert.equal(p.outputContext.x, slot);
      assert.equal(p.outputContext.bank, bank);
      assert.equal(p.outputContext.a, 0x789a);
      assert.equal(p.outputContext.status & 0x82, 0);
      assert.equal(p.returnTargetExecuted, false);
    }
  const f = fixture(0x80c401);
  put(f, 0x700, 65535);
  assert.equal(commit(wait, f).returnTarget, 0x800000);
});
test('Native9F stores remain chronological: DP02, latched index, PLA and final return aliases', () => {
  const dp = fixture(0x80c401, { slot: 0xf460, mask: 0x1234, count: 0x5678 });
  // This full index really aliases DP02, but its final continuation store lies in ROM: since 2026-10-14
  // a ROM write has no effect (as on the hardware) and stays in the access log as rom-write.
  const romStores = (p) => p.accesses.filter((r) => r.kind === 'rom-write').map((r) => r.address);
  assert.ok(romStores(commit(wait, dp)).length > 0);
  const stack = fixture(0x80c401, { slot: 0xfd4e, s: 0x94f, savedOuterS: 0x951, count: 0x3456 });
  const p = commit(wait, stack);
  assert.equal(p.savedContinuationWord, 0x3456);
  assert.equal(p.outputContext.a, 0x3456);
  assert.equal(word(stack, 0), 0x3456);
  assert.equal(p.accesses.find((r) => r.label === 'wait-discard-JSR-PLA-low').value, 0x56);
  // 0BA2+F6AE aliases0250 after24bit addition. X must retainF6AE;
  // the late ROM store has no effect instead of relatching the modified index.
  const latch = fixture(0x80c401, { slot: 0xf6ae, mask: 2 });
  assert.ok(romStores(commit(wait, latch)).length > 0);
  const alias = fixture(0x80c401, { slot: 0, s: 0xb9f, savedOuterS: 0xba1 });
  unchangedFailure(wait, alias, {}, 'task_stack_alias_required');
});
test('actual Native58 ID159 consumes real F508 and yields before any F509 fetch', () => {
  const f = fixture(0x80f390, { mask: 0x8123, count: 0x3456 }),
    p = commit(opcode, f);
  assert.equal(p.calleeEntry, 0x80c401);
  assert.equal(p.savedContinuationWord, 0xf508);
  assert.equal(p.returnTarget, 0x80c20b);
  assert.equal(p.outputContext.s, 0xb01);
  assert.equal(p.outputContext.d, 0);
  assert.equal(p.outputContext.bank, 0x80);
  assert.equal(word(f, 0x800ba4), 0x8123);
  assert.equal(word(f, 0x800c04), 0x3456);
  assert.equal(word(f, 0x8002b4), 0xf508);
  assert.equal(word(f, 0x609), 159);
  assert.equal(word(f, 0x607), 0x803);
  assert.equal(word(f, 0x603), 2);
  assert.ok(
    !p.accesses.some((r) => r.label.startsWith('resume-') || r.label === 'fresh-next-opcode-low'),
  );
  const wrong = fixture(0x80f390);
  put(wrong, 0x82d8f6, 0xa91d);
  unchangedFailure(opcode, wrong, {}, 'task_native_wait_target_required');
});
test('observed later C1F9 follows real readiness and native return metadata including its ignored highbyte', () => {
  for (const mask of [0, 1, 2, 0x8000, 0x1000, 0x6ffe])
    for (const count of [0, 1, 2, 65535]) {
      const f = fixture(0x80c1f9);
      put(f, 0x800ba4, mask);
      put(f, 0x800c04, count);
      put(f, 0x800c64, 2);
      const ready =
        mask === 0 ||
        (!(mask & 0x9000) && ((mask & 0x6ffe & 2) !== 0 || (mask & 1 && count === 1)));
      const p = commit(resume, f);
      assert.equal(p.frontier, ready ? '80:F390' : 'actual-visit-return-target');
      if (ready) {
        assert.equal(p.continuationTarget, 0x80f509);
        assert.equal(p.continuationOccurrenceProven, true);
        assert.equal(p.resultPushed, true);
        assert.equal(p.metadataWord, 2);
        assert.equal(p.outputContext.s, 0x3ee);
        assert.equal(word(f, 0x8001f2), 0x6fd);
        assert.equal(word(f, 0x6fe), 0xc20a);
      } else {
        assert.equal(p.continuationTarget, undefined);
        assert.equal(p.returnTarget, 0x8091d1);
        assert.ok(!p.accesses.some((r) => r.label.startsWith('resume-')));
      }
      assert.equal(p.automaticReadiness, false);
    }
  for (const metadata of [0, 0x0200, 2, 0xaa02]) {
    const f = fixture(0x80c1f9);
    put(f, 0x82da0f, metadata);
    const p = commit(resume, f);
    assert.equal(p.metadataWord, metadata);
    assert.equal(p.resultPushed, Boolean(metadata & 255));
    if (!(metadata & 255))
      assert.ok(!p.accesses.some((r) => r.label === 'resume-fresh-result-low'));
  }
  const f = fixture(0x80c1f9);
  unchangedFailure(resume, omit(f, 0x82da10), {}, 'render_source_required');
  // Existing generic Visit remains limited to F495. This new F509 proof
  // cannot silently enlarge the older Script52 continuation contract.
  unchangedFailure(prepareTaskVisit, f, {}, 'task_visit_continuation_source_required');
  for (const raw of [0, 0xf494, 0xffff]) {
    const g = fixture(0x80c1f9);
    put(g, 0x8002b4, raw);
    unchangedFailure(
      resume,
      g,
      {},
      raw === 0
        ? 'task_native_wait_continuation_required'
        : 'task_visit_continuation_source_required',
    );
  }
});
test('yield then separately observed ready entry resumes original saved native state without a fabricated device or timer value', () => {
  const f = fixture(0x80f390),
    yielded = commit(opcode, f);
  put(f, 0x800254, 0x600);
  put(f, 0x82da0f, 2);
  // Compatible later entry is an explicit synthetic observation. Its outer
  // bytes are still present; no original temporal occurrence is asserted.
  const observed = Object.freeze({ ...yielded.outputContext, pc: 0xc1f9, s: 0xaff });
  const r = { ...f, entry: 0x80c1f9, context: observed };
  const p = commit(resume, r);
  assert.equal(p.frontier, '80:F390');
  assert.equal(p.outputContext.x, 0x56);
  assert.equal(p.outputContext.y, 3);
  assert.equal(p.outputContext.d, 0x600);
  assert.equal(p.outputContext.bank, 0x82);
  assert.equal(p.metadataWord, 2);
  assert.equal(word(f, 0x802), 1);
  assert.equal(p.outputContext.s, 0x801);
  assert.equal(word(f, 0x800ba4), 0);
  assert.equal(word(f, 0x800c04), 0);
});
for (const [entry, prepare] of [
  [0x80c401, wait],
  [0x80f390, opcode],
  [0x80c1f9, resume],
])
  test(`Native9F ${entry.toString(16)} rejects missing sources, late limits and stale/foreign/copied plans atomically`, () => {
    const f = fixture(entry),
      p = prepared(prepare, f),
      written = new Set();
    for (const access of p.accesses) {
      const address = renderAddress(access.address);
      if (access.kind === 'write') written.add(address);
      else if (!written.has(address))
        unchangedFailure(prepare, omit(f, access.address), {}, 'render_source_required');
    }
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    const data = createRenderData({ writeWindows: [] });
    for (const [a, v] of f.data.snapshot().bytes) data.seed(a, [v]);
    unchangedFailure(prepare, { ...f, data }, {}, 'render_write_window_required');
    unchangedFailure(prepare, f, { context: { ...f.context } }, 'task_context_required');
    if (entry !== 0x80f390)
      unchangedFailure(
        prepare,
        f,
        { context: Object.freeze({ ...f.context, d: 1 }) },
        entry === 0x80c401 ? 'task_direct_page_zero_required' : 'task_visit_D0_required',
      );
    assert.equal(commitTaskPlan(fixture(entry).data, p).reason, 'task_plan_owner_required');
    assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
    f.data.seed(0x100, [1]);
    const before = f.data.snapshot();
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
    assert.deepEqual(f.data.snapshot(), before);
  });
