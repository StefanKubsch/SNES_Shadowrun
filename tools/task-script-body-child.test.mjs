import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyChildEnter as enter,
  prepareTaskScriptBodyChildPostrun as post,
  prepareTaskScriptBodyResume as resume,
  prepareTaskScriptBodyParentResume as parent,
} from '../proof/task/script-bodies.mjs';
import {
  scriptBodyFixture,
  bodyWord as word,
  omitBodyBytes as omit,
} from './task-script-body-fixtures.mjs';
import {
  runChildFixture,
  childBodyCases,
  childNextOptions,
  childBodyProbe,
} from './task-script-body-child-fixtures.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { validateChildBodyEvidence } from './progress.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { prepareTaskNativeCB4D as property } from '../proof/task/native-cb4d.mjs';
import { nativeCB4DSpec } from './task-native-cb4d-spec.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { decodeTaskWindows } from './task-partial-source.mjs';
import { proveLeafSource } from './task-native-leaf-source.mjs';
import { proveScriptChildFlow } from './task-script-child-source.mjs';
const specs = scriptBodySpecs.filter(
    (s) =>
      s.scriptChildBody &&
      [0x4b, 0x33d].includes(s.childId) &&
      !s.recordPropertyChild &&
      !s.parentWaitChild,
  ),
  at = (id) => specs.find((s) => s.id === id);
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc'));
function popArguments(segment, id) {
  const from = segment.accesses.findIndex(
      (a) => a.kind === 'write' && a.label === 'saved-ID-low' && a.value === id,
    ),
    next = segment.accesses.findIndex(
      (a, n) => n > from && a.kind === 'write' && a.label === 'saved-ID-low',
    ),
    writes = segment.accesses
      .slice(from, next < 0 ? undefined : next)
      .filter((a) => a.kind === 'write' && a.label.startsWith('native-argument-workspace-'));
  return writes
    .filter((_, n) => n % 2 === 0)
    .map((a, n) => a.value | (writes[n * 2 + 1].value << 8));
}
test('CD whole14byte/6instruction source and own0001/0202 metadata preserve full property WORD, nullDP03 and Longcarry', async () => {
  const map = decodeTaskWindows(bytes, nativeCB4DSpec.windows).map,
    p = proveLeafSource(map, nativeCB4DSpec);
  assert.equal(p.reachable_instructions, 6);
  assert.equal(p.minimum_protected_stack_bytes, 2);
  assert.equal(p.external_return_assumptions, 0);
  assert.deepEqual(
    p,
    JSON.parse(await readFile('analysis/render-task-native-cb4d.json')).proofs[0],
  );
  for (const [pc, i] of map) {
    const changed = new Map(map);
    changed.set(pc, { ...i, raw: [i.raw[0] ^ 1, ...i.raw.slice(1)] });
    assert.throws(() => proveLeafSource(changed, nativeCB4DSpec));
  }
  for (const a of nativeCB4DSpec.anchors)
    assert.equal(
      bytes
        .subarray(cpuToOffset(a.start, bytes.length), cpuToOffset(a.start, bytes.length) + 2)
        .toString('hex')
        .toUpperCase(),
      a.hex,
    );
  const f = taskLeafFixture(0x80cb4d);
  sampleWord(f.data, 0, 65535);
  sampleWord(f.data, 0x8eb01f, 65535);
  sampleWord(f.data, 0x7f0002, 0xabcd);
  const q = prepared(property, f);
  assert.ok(q.readAddresses.includes(0x7f0003));
  unchangedFailure(property, omit(f, 0x7f0003), {}, 'render_source_required');
  commit(property, f);
  assert.equal(word(f.data, 0), 0xabcd);
  const z = taskLeafFixture(0x80cb4d);
  sampleWord(z.data, 0x8db030, 0);
  sampleWord(z.data, 3, 0xcdbe);
  commit(property, z);
  assert.equal(word(z.data, 0), 0xcdbe);
});
test('Child shared source renews every visited/allocator/epilogue original window and rejects source drift', async () => {
  const flow = await proveScriptChildFlow(bytes);
  assert.deepEqual(flow, JSON.parse(await readFile('analysis/render-task-script-child-flow.json')));
  assert.equal(flow.epilogue.machine_bytes, 'F48080ABAB688D500260');
  for (const w of flow.windows) {
    const changed = Buffer.from(bytes);
    changed[cpuToOffset(parseInt(w.entry.replace(':', ''), 16), bytes.length)] ^= 1;
    await assert.rejects(() => proveScriptChildFlow(changed));
  }
});
for (const s of specs)
  test(`Whole${s.id.toString(16)} proves actualC1CA/Script52 child frame/arguments/returns/heapheaderEND/release/F495/parentEND`, async () => {
    const report = JSON.parse(
      await readFile('analysis/render-task-script-bodies-child-native.json'),
    );
    for (const v of childBodyCases(s)) {
      const { fixture: f, plan: p, segments } = runChildFixture(s, v);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.scriptId, s.id);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.fullTaskBinding, false);
      assert.equal(p.outputContext.s, 0xb01);
      assert.equal(p.outputContext.d, 0);
      assert.equal(word(f.data, 0xb06), 0x91d0);
      assert.equal(segments[0].parentEntry.interpreterEntryExecuted, true);
      assert.equal(segments[0].parentEntry.frontier, '80:F390');
      assert.ok(
        segments[0].accesses.some((a) => a.label === 'visit-JSR-body-low' && a.value === 0xd8),
      );
      if (segments.length > 1) {
        const prefix = segments[0],
          child = segments.at(-2),
          size = s.childId === 0x4b ? 31 : 42;
        assert.equal(prefix.scriptChildSuspended, true);
        assert.equal(prefix.bodyComplete, false);
        assert.equal(prefix.childSlot, 4);
        assert.equal(prefix.childFrame, 0x3d6);
        assert.equal(prefix.parentSlot, 2);
        assert.equal(child.resultWord, (v.heap ?? 0x800) - size - 4);
        assert.equal(p.childCompletion, child.resultWord);
        const reads = child.accesses.filter((a) => a.label.startsWith('END-result-PLA-'));
        assert.deepEqual(
          reads.map((a) => a.address),
          [0x3d6 + size, 0x3d7 + size],
        );
        assert.deepEqual(
          reads.map((a) => a.value),
          [child.resultWord & 255, child.resultWord >>> 8],
        );
        assert.equal(word(f.data, 0x8003d2), size);
        assert.equal(word(f.data, 0x80024e), 4);
        assert.equal(word(f.data, 0x80024c), 2);
        assert.equal(word(f.data, 0x800ba4), 0);
        assert.equal(word(f.data, 0x800374), 65535);
        assert.equal(p.childPostrun.continuationTarget, 0x80f495);
        assert.equal(p.childPostrun.continuationOccurrenceProven, true);
        assert.equal(p.childPostrun.metadataWord, 0);
        assert.equal(p.childPostrun.resultPushed, false);
        if (s.childId === 0x4b) {
          assert.equal(segments.length, 9);
          assert.equal(segments[2].childPostrunReturned, true);
          assert.equal(segments[2].returnTarget, 0x8091d1);
          assert.equal(segments[2].outputContext.bank, 0x80);
          assert.equal(segments[2].outputContext.s, 0xb07);
          const counts = segments
            .slice(3, 8)
            .map(
              (p) =>
                p.accesses.find(
                  (a) =>
                    a.kind === 'write' &&
                    a.address === 0x800c06 &&
                    a.label === 'visit-DBR-WORD-low',
                ).value,
            );
          assert.deepEqual(counts, [4, 3, 2, 1, 0]);
          assert.deepEqual(
            segments.slice(3, 8).map((p) => p.segmentHandlers),
            [0, 0, 0, 0, 7],
          );
          assert.ok(
            segments
              .slice(3, 8)
              .every((p) =>
                p.accesses.some(
                  (a) => a.kind === 'write' && a.address === 0x800250 && a.value === 4,
                ),
              ),
          );
          assert.deepEqual(popArguments(child, 0x4c), [65535, 56, 255, 3]);
        } else {
          assert.equal(segments.length, 3);
          assert.equal(f.data.readByte(0x3e9).value, 16);
          assert.equal(word(f.data, 0x3ea), s.id === 0x2bf ? 122 : 230);
          assert.equal(word(f.data, 0x3ec), s.id === 0x2bf ? 890 : 153);
          assert.equal(prefix.steps.at(-1).wordPops, 3);
          assert.ok(prefix.accesses.some((a) => a.label === 'script-frame-argument-copy-high'));
        }
      } else assert.equal(v.property, 0x8b2);
      assert.deepEqual(
        report.probes.find((p) => p.script_id === s.id && p.case === v.name),
        childBodyProbe(s, v),
      );
    }
  });
for (const s of specs)
  test(`Child${s.id.toString(16)} brands commits, checks fresh parent/child/link/high and preserves current segment budgets`, () => {
    const v = childBodyCases(s).find((v) => v.property !== 0x8b2),
      f = scriptBodyFixture(s, v),
      p = prepared(start, f);
    unchangedFailure(
      start,
      f,
      { protectedStackBytes: [0x7e0500, 0x7e0501] },
      'task_outer_return_required',
    );
    unchangedFailure(
      start,
      { ...f, entry: 0x80f390, context: Object.freeze({ ...f.context, pc: 0xf390 }) },
      {},
      'task_script_body_child_entry_required',
    );
    unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      start,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    const next = childNextOptions(s, f, p);
    unchangedFailure(enter, next, {}, 'task_script_body_child_continuation_required');
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    unchangedFailure(
      enter,
      next,
      { context: Object.freeze({ ...next.context, s: next.context.s - 2 }) },
      'task_script_body_child_owner_required',
    );
    unchangedFailure(
      enter,
      { ...next, continuation: { ...p } },
      {},
      'task_script_body_child_continuation_required',
    );
    for (const [address, reason] of [
      [0x800375, 'task_script_body_child_owner_required'],
      [0x8002b5, 'task_script_body_child_owner_required'],
      [0x601, 'task_script_body_child_owner_required'],
      [p.childFrame + 2, 'task_script_body_child_owner_required'],
    ]) {
      const old = f.data.readByte(address).value;
      f.data.seed(address, [old ^ 1]);
      unchangedFailure(enter, next, {}, reason);
      f.data.seed(address, [old]);
    }
    const q = prepared(enter, next);
    unchangedFailure(enter, next, { maxWork: q.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      enter,
      next,
      { maxOutputBytes: q.outputBytes - 1 },
      'task_output_budget_required',
    );
    assert.equal(commitTaskPlan(f.data, q).handled, true);
    unchangedFailure(enter, next, {}, 'task_script_body_child_continuation_required');
    const later = childNextOptions(s, f, q);
    if (q.bodySuspended) {
      unchangedFailure(
        parent,
        { ...later, scriptId: s.id },
        {},
        'task_script_body_child_completion_required',
      );
      unchangedFailure(
        post,
        later,
        {
          waitObservations: menuRecords([{ pc: 0x81acbd, address: 0x8001f6, width: 2, value: 0 }]),
        },
        'task_wait_observation_unused',
      );
      unchangedFailure(
        post,
        later,
        {
          inputObservations: menuRecords([{ pc: 0x809e1a, address: 0x8001ca, width: 2, value: 0 }]),
        },
        'task_input_observation_unused',
      );
      unchangedFailure(
        post,
        later,
        { ioObservations: f.childAudioObservations },
        'task_io_observation_unused',
      );
      const old = f.data.readByte(0xb03).value;
      f.data.seed(0xb03, [old ^ 1]);
      unchangedFailure(post, later, {}, 'task_script_body_child_caller_return_required');
      f.data.seed(0xb03, [old]);
      const r = prepared(post, later);
      unchangedFailure(post, later, { maxWork: r.work - 1 }, 'task_work_budget_required');
      unchangedFailure(
        post,
        later,
        { maxOutputBytes: r.outputBytes - 1 },
        'task_output_budget_required',
      );
    } else {
      const r = prepared(parent, later);
      unchangedFailure(parent, later, { maxWork: r.work - 1 }, 'task_work_budget_required');
      unchangedFailure(
        parent,
        later,
        { maxOutputBytes: r.outputBytes - 1 },
        'task_output_budget_required',
      );
    }
  });
test('Late child audio/heap-result and parent zero-return metadata failures preserve previously committed source yields', () => {
  const s = at(0x1bd),
    f = scriptBodyFixture(s, childBodyCases(s)[1]);
  let p = commit(start, f);
  p = commit(enter, childNextOptions(s, f, p));
  p = commit(post, childNextOptions(s, f, p));
  for (let n = 0; n < 4; n++) p = commit(resume, childNextOptions(s, f, p));
  const next = childNextOptions(s, f, p),
    q = prepared(resume, next);
  for (let n = 0; n < next.ioObservations.length; n++)
    unchangedFailure(
      resume,
      next,
      { ioObservations: menuRecords(next.ioObservations.filter((_, i) => i !== n)) },
      'task_io_observation_required',
    );
  unchangedFailure(resume, next, { maxWork: q.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    resume,
    next,
    { maxOutputBytes: q.outputBytes - 1 },
    'task_output_budget_required',
  );
  assert.equal(commitTaskPlan(f.data, q).handled, true);
  const finish = childNextOptions(s, f, q),
    r = prepared(parent, finish);
  const metadata = 0x82e66f,
    old = f.data.readByte(metadata).value;
  f.data.seed(metadata, [old ^ 1]);
  unchangedFailure(parent, finish, {}, 'task_script_body_bytes_required');
  f.data.seed(metadata, [old]);
  unchangedFailure(parent, finish, { maxWork: r.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    parent,
    finish,
    { maxOutputBytes: r.outputBytes - 1 },
    'task_output_budget_required',
  );
});
test('ChildEND freshly reads a changed split-header highbyte; parent zero-return metadata supplies no cached child result', () => {
  const s = at(0x1da),
    f = scriptBodyFixture(s, childBodyCases(s)[0]);
  let p = commit(start, f);
  p = commit(enter, childNextOptions(s, f, p));
  p = commit(post, childNextOptions(s, f, p));
  for (let n = 0; n < 4; n++) p = commit(resume, childNextOptions(s, f, p));
  // Explicit synthetic external BYTE observation, no original writer claimed.
  f.data.seed(0x3f6, [0xe0]);
  const q = commit(resume, childNextOptions(s, f, p));
  assert.equal(q.resultWord, 0xe0dd);
  assert.ok(
    q.accesses.some(
      (a) => a.label === 'END-result-PLA-high' && a.address === 0x3f6 && a.value === 0xe0,
    ),
  );
  const r = commit(parent, childNextOptions(s, f, q));
  assert.equal(r.childCompletion, 0xe0dd);
  assert.equal(r.resultWord, 0xbeef);
  assert.equal(r.childPostrun.resultPushed, false);
});
test('Canonical child evidence rejects missing real visits, false completion/header/free/link and incomplete parent paths', async () => {
  const source = JSON.parse(await readFile('analysis/render-task-script-bodies-child.json')),
    native = JSON.parse(await readFile('analysis/render-task-script-bodies-child-native.json'));
  for (const proof of source.proofs) {
    const childSource = JSON.parse(await readFile(proof.child_source_contract)),
      child = childSource.proofs.find((p) => p.script_id === proof.child_id),
      probes = native.probes.filter((p) => p.script_id === proof.script_id);
    validateChildBodyEvidence(proof, probes, child);
    const called = probes.findIndex((p) => p.child_segments.length > 1);
    for (const mutate of [
      (p) => p.child_segments.splice(1, 1),
      (p) => (p.child_header_result ^= 1),
      (p) => (p.final_links.free = 2),
      (p) => (p.child_segments.at(-2).body_complete = false),
      (p) => p.body_pcs.splice(-2, 1),
      (p) => (p.child_observed_entries[0].entry = 0x80f390),
    ]) {
      const changed = structuredClone(probes);
      mutate(changed[called]);
      assert.throws(() => validateChildBodyEvidence(proof, changed, child));
    }
  }
});
