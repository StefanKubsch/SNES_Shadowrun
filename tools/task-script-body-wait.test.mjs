import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs, scriptBodyBatches } from '../proof/task/script-body-specs.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import { commitTaskPlan, prepareTaskPlan } from '../proof/task/plan.mjs';
import {
  scriptBodyFixture as fixture,
  bodyCases,
  bodyWord as word,
  omitBodyBytes as omit,
  bodyWaitD2Settings,
  isWaitBody,
} from './task-script-body-fixtures.mjs';
import {
  runWaitBodyFixture,
  waitBodyProbe,
  resumeBodyFixture,
} from './task-script-body-wait-fixtures.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { prepareSlotSelection } from '../proof/state/slot-selection.mjs';
import { prepareSlotAction6A } from '../proof/state/slot-action-6a.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
const specs = scriptBodySpecs.filter(
    (s) => isWaitBody(s) && !s.sourceRomGuards && !s.c8Observations && !s.native13Observations,
  ),
  at = (id) => specs.find((s) => s.id === id);
const put = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);

for (const spec of specs)
  test(`original wait body ${spec.id.toString(16)} completes its whole source path only after committed segments and actual observed readiness`, async () => {
    const batch = scriptBodyBatches.find((b) => b.ids.includes(spec.id));
    const report = JSON.parse(await readFile(`analysis/render-task-${batch.stem}-native.json`));
    for (const variant of bodyCases(spec)) {
      const { fixture: f, plan: p, segments } = runWaitBodyFixture(spec, variant);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.equal(p.returnTarget, 0x80c20b);
      const skipped = [0x80, 0x10f].includes(spec.id) && (variant.counter ?? 0) >= 12;
      assert.equal(p.outputContext.s, skipped ? 0xb01 : 0xaff);
      assert.equal(p.outputContext.d, 0);
      const pcs = skipped
        ? [...spec.instructions.slice(0, 5), ...spec.instructions.slice(-3)].map((i) => i.pc)
        : spec.instructions.map((i) => i.pc);
      assert.equal(p.handlersExecuted, pcs.length);
      assert.deepEqual(p.bodyPCs, pcs);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(word(f.data, 0x7e0000), 0xbeef);
      assert.equal(segments[0].bodyComplete, skipped);
      assert.equal(segments.at(-1).bodyComplete, true);
      assert.equal(
        segments.filter((p) => p.frontier === 'actual-native-wait-yield-target').length,
        skipped
          ? 0
          : spec.instructions.filter((i) => i.opcode === 0x58 && i.operand === 0x9f).length,
      );
      for (const segment of segments) assert.equal(Object.isFrozen(segment.outputContext), true);
      const repeats =
        {
          0x67: 401,
          0x35c: 2,
          0x7d: 38,
          0xd2: 2,
          0xdf: 10,
          0x10f: 40,
          0x27e: 180,
          0x2e6: 10,
          0x3a5: 60,
          0x3a7: 20,
        }[spec.id] ?? 1;
      assert.equal(p.observedReadinessEntries ?? 0, skipped ? 0 : repeats);
      assert.deepEqual(
        report.probes.find((p) => p.script_id === spec.id && p.case === variant.name),
        waitBodyProbe(spec, variant),
      );
      if (spec.id === 0x35c) assert.equal(word(f.data, 0x801d6b), 65535);
      if (spec.id === 0x6f) {
        const r = spec.romReads[0];
        assert.equal(f.data.readByte(0x7e0000 + r.value + 1).value, 6);
      }
      if ([0xfa, 0x1b8].includes(spec.id)) assert.equal(word(f.data, 0x801360), 65535);
      const action = {
        0x94: 0x5a,
        0x14b: 0x2c,
        0x1d6: 0x24,
        0x201: 0x61,
        0x208: 0x63,
        0x20f: 0x5e,
        0x212: 0x5e,
        0x216: 0x5e,
      }[spec.id];
      if (action !== undefined) assert.equal(word(f.data, 0x7e4460), action);
      if (spec.instructions.some((i) => i.opcode === 0x58 && i.operand === 0xb9)) {
        assert.equal(word(f.data, 0x7e3f38), 65535);
        assert.equal(word(f.data, 0x8014b0), 65534);
        assert.equal(word(f.data, 0x801048), 65535);
        assert.equal(word(f.data, 0x8010a0), 0);
        if ([0x80, 0x10f].includes(spec.id)) assert.equal(word(f.data, 0x801fd0), variant.counter);
        if (spec.id === 0xdf) {
          assert.equal(word(f.data, 0x800d30), 1);
          assert.equal(word(f.data, 0x800d88), 65533);
          assert.equal(word(f.data, 0x800de0), 8);
        }
        if (spec.id === 0x2e6) {
          assert.equal(word(f.data, 0x800d30), 65532);
          assert.equal(word(f.data, 0x800d88), 0);
          assert.equal(word(f.data, 0x800de0), 8);
        }
      }
      if ([0x10a, 0x10b, 0x112, 0x113, 0x11a, 0x11b, 0x122, 0x123].includes(spec.id)) {
        assert.equal(word(f.data, 0x801ce9), 0x7fff);
        assert.equal(
          word(f.data, 0x7e2de2),
          [0x10a, 0x112, 0x11a, 0x122].includes(spec.id) ? 0xf1 : 0x1d1,
        );
        const setters = spec.instructions.filter((i) => i.opcode === 0x58 && i.operand === 18);
        for (const i of setters) {
          const n = spec.instructions.indexOf(i);
          assert.equal(
            word(f.data, 0x7e3bbb + spec.instructions[n - 1].operand),
            spec.instructions[n - 2].operand === null
              ? 0
              : spec.instructions[n - 2].operand === 0xff
                ? 65535
                : spec.instructions[n - 2].operand,
          );
        }
      }
    }
  });
test('wait D2 families independently match original slot selection/action contracts; CA20 and D0D3 retain all BIT branches', async () => {
  const data = createSlotActionData(JSON.parse(await readFile('assets/slot-action-data.json')));
  for (const spec of specs.filter((s) => bodyWaitD2Settings.has(s.id)))
    for (const variant of bodyCases(spec)) {
      if ([0x80, 0x10f].includes(spec.id) && (variant.counter ?? 0) >= 12) continue;
      const f = fixture(spec, variant),
        [selection, action] = bodyWaitD2Settings.get(spec.id),
        slot = 0x10;
      const initial = Object.fromEntries(
        ['1038', '1198', '10E8', '1090', '11F0'].map((k) => [
          k,
          word(f.data, 0x800000 + parseInt(k, 16) + slot),
        ]),
      );
      const first = prepareSlotSelection({
        selectionWord: selection,
        currentSelection: initial['1038'],
        definitionWord: 11,
        currentIndex: initial['1198'],
        actionData: data,
      });
      assert.equal(first.handled, true);
      const fields = { ...initial, ...first.fields };
      const second = prepareSlotAction6A({
        offset: slot,
        nextWord: action,
        definitionWord: 11,
        fields,
        lowByte: fields['11F0'] & 255,
        actionData: data,
      });
      assert.equal(second.handled, true);
      const releases = spec.instructions.some((i) => i.opcode === 0x58 && i.operand === 0xb9);
      const result = releases ? (commit(start, f), f) : runWaitBodyFixture(spec, variant).fixture;
      for (const [key, value] of Object.entries({ ...first.fields, ...second.fields })) {
        if (key === '11F0' && second.lowByte !== undefined) continue;
        const address =
          (key.startsWith('7E:')
            ? 0x7e0000 + parseInt(key.slice(3), 16)
            : 0x800000 + parseInt(key, 16)) + slot;
        assert.equal(word(result.data, address), value, `${spec.id}/${variant.name}/${key}`);
      }
      if (second.lowByte !== undefined)
        assert.equal(result.data.readByte(0x801200).value, second.lowByte);
    }
  for (const flags of [0, 0x0200, 0x0800, 0x0a00, 0x2000, 0xffff])
    for (const motion of [0, 1, 0x7fff, 0xffff]) {
      const { fixture: f } = runWaitBodyFixture(at(0x1b8), { flags, motion });
      const actual = flags & 0xdfff;
      assert.equal(word(f.data, 0x801468), actual);
      assert.equal(
        word(f.data, 0x801410),
        actual & 0x0800 ? motion : (motion & 0x7ffe) | (actual & 0x0200 ? 0x8001 : 1),
      );
    }
});
test('body continuation cannot be forged, used before commit, moved to another owner or reused after a later commit', () => {
  const spec = at(0x35c),
    f = fixture(spec),
    p = prepared(start, f),
    r = resumeBodyFixture(spec, f, p);
  unchangedFailure(resume, r, {}, 'task_script_body_continuation_required');
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  unchangedFailure(resume, r, { continuation: { ...p } }, 'task_script_body_continuation_required');
  unchangedFailure(
    resume,
    r,
    { data: fixture(spec).data },
    'task_script_body_continuation_required',
  );
  unchangedFailure(resume, r, { scriptId: 0x6f }, 'task_script_body_continuation_required');
  const blocked = commit(resume, r);
  assert.equal(blocked.bodySuspended, true);
  assert.equal(blocked.bodyComplete, false);
  assert.equal(blocked.segmentHandlers, 0);
  assert.equal(word(f.data, 0x800c04), 1);
  unchangedFailure(resume, r, {}, 'task_script_body_continuation_required');
  const next = resumeBodyFixture(spec, f, blocked),
    complete = commit(resume, next);
  assert.equal(complete.bodyComplete, true);
  unchangedFailure(resume, next, {}, 'task_script_body_continuation_required');
  const g = fixture(spec),
    s = commit(start, g),
    observed = resumeBodyFixture(spec, g, s);
  const unrelated = prepareTaskPlan(observed, [0x80c1f9], () => ({ handled: true }));
  assert.equal(commitTaskPlan(g.data, unrelated).handled, true);
  unchangedFailure(resume, observed, {}, 'task_script_body_continuation_required');
});
test('each wait body rejects source/owner/count/budget failures at prefix and resumed END without publishing the failed segment', () => {
  for (const spec of specs) {
    const f = fixture(spec),
      p = prepared(start, f);
    unchangedFailure(
      start,
      f,
      { maxHandlers: p.segmentHandlers - 1 },
      'task_script_body_handler_count_required',
    );
    unchangedFailure(
      start,
      f,
      { maxHandlers: p.segmentHandlers + 1 },
      'task_script_body_handler_count_required',
    );
    unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      start,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    unchangedFailure(
      start,
      omit(f, spec.scriptEntry + 2 + spec.bytecode.length),
      {},
      'render_source_required',
    );
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    const r = resumeBodyFixture(spec, f, p);
    unchangedFailure(resume, r, { maxHandlers: 0 }, 'task_handler_budget_required');
    unchangedFailure(
      resume,
      r,
      { context: Object.freeze({ ...r.context, x: 3 }) },
      'task_script_body_wait_owner_required',
    );
    for (const [address, value] of [
      [0x603, 1],
      [0x609, 0],
      [0x800254, 0x602],
      [0x800250, 4],
    ]) {
      const before = word(f.data, address);
      put(f, address, value);
      unchangedFailure(resume, r, {}, 'task_script_body_wait_owner_required');
      put(f, address, before);
    }
    const mask = word(f.data, 0x800ba4);
    if ([2, 8].includes(mask)) put(f, 0x800c64, mask);
    // Pin countdown1 only as a distinct explicit synthetic observed fixture
    // to test its final-readiness segment's late failure budget. Full probes
    // above execute original counters2 and400 without replacing their values.
    if (mask & 1) put(f, 0x800c04, 1);
    const q = prepared(resume, r);
    unchangedFailure(resume, r, { maxWork: q.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      resume,
      r,
      { maxOutputBytes: q.outputBytes - 1 },
      'task_output_budget_required',
    );
    unchangedFailure(resume, r, { context: { ...r.context } }, 'task_context_required');
    prepared(resume, { ...r, maxWork: q.work, maxOutputBytes: q.outputBytes });
    const bad = spec.scriptEntry + 2;
    f.data.seed(bad, [spec.bytecode[0] ^ 1]);
    unchangedFailure(resume, r, {}, 'task_script_body_bytes_required');
  }
});
test('mutable event bytes are explicit observations: mask2 and mask8 remain blocked without them; dynamic Native13 address requires its own source', () => {
  for (const id of [0x94, 0x67]) {
    const spec = at(id),
      f = fixture(spec),
      p = commit(start, f),
      r = resumeBodyFixture(spec, f, p),
      blocked = commit(resume, r);
    assert.equal(blocked.bodyComplete, false);
    assert.equal(blocked.bodySuspended, true);
    assert.equal(blocked.segmentHandlers, 0);
    assert.ok(!blocked.accesses.some((a) => a.label.startsWith('resume-')));
  }
  const spec = at(0x6f),
    f = fixture(spec, { slot: 0x11 }),
    p = commit(start, f),
    r = resumeBodyFixture(spec, f, p);
  unchangedFailure(resume, r, {}, 'task_script_body_ROM_read_required');
});
test('readiness scratch alias cannot borrow the same metadata value from an individually unproved native ID', () => {
  const spec = at(0x35c),
    f = fixture(spec),
    frame = 0x68;
  for (let n = 0; n < 0x15; n++) {
    const source = f.data.readByte(0x600 + n);
    if (source.available) f.data.seed(frame + n, [source.value]);
  }
  put(f, 0x800254, frame);
  f.context = Object.freeze({ ...f.context, d: frame });
  const p = commit(start, f),
    r = resumeBodyFixture(spec, f, p);
  assert.equal(word(f.data, frame + 9), 159);
  // Explicit synthetic later event/mask observations. Original C3C9 STA71
  // aliases this frame's saved nativeID and changes it from159 to2. The
  // separately original ID2 metadata also has low2; matching a value cannot
  // prove this body's unpinned table address or authorize its read.
  put(f, 0x800ba4, 2);
  put(f, 0x800c64, 2);
  put(f, 0x82d972, 2);
  unchangedFailure(resume, r, {}, 'task_script_body_native_metadata_required');
  assert.equal(word(f.data, frame + 9), 159);
});
