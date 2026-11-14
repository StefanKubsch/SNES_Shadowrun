import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  scriptBodySpecs,
  scriptBodyNativeSources,
  scriptBodyReportStem,
} from '../proof/task/script-body-specs.mjs';
import { prepareTaskScriptBody as prepare } from '../proof/task/script-bodies.mjs';
import { prepareTaskNativeOpcodeSequence as sequence } from '../proof/task/opcode-sequence.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import {
  scriptBodyFixture as fixture,
  bodyCases,
  bodyWord as word,
  omitBodyBytes as omit,
  bodyFrame,
  bodyStack,
  bodyOuterS,
} from './task-script-body-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import { expansionBodyResult } from './task-script-body-expansion-fixtures.mjs';
const at = (id) => scriptBodySpecs.find((s) => s.id === id),
  put = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const members = [
  0x08b2, 0x1458, 0x089d, 0x15d2, 0x079a, 0x0a4f, 0x0d2e, 0x1b6d, 0x0b52, 0x0ba6, 0x078c, 0x0b3d,
  0x098b,
];
const ordinaryBodies = scriptBodySpecs.filter(
  (s) =>
    !s.modalBody &&
    !s.scriptChildBody &&
    !s.c8Observations &&
    !s.audioObservations &&
    !s.randomObservations &&
    !s.native9AObservations &&
    !s.instructions.some((i) => i.opcode === 0x58 && i.operand === 0x9f),
);
for (const spec of ordinaryBodies)
  test(`Original body $${spec.id.toString(16)} completes every representative path with independently expected physical effects and source-linked evidence`, async () => {
    const native = JSON.parse(
      await readFile(`analysis/render-task-${scriptBodyReportStem(spec.id)}-native.json`),
    );
    for (const variant of bodyCases(spec)) {
      const f = fixture(spec, variant),
        p = prepared(prepare, f),
        g = fixture(spec, variant),
        q = prepared(sequence, g);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.targetExecuted, false);
      assert.equal(p.outputContext.s, bodyOuterS + 2);
      assert.equal(p.outputContext.d, 0);
      assert.equal(spec.instructions.find((i) => i.pc === p.bodyPCs.at(-1)).opcode, 0x56);
      assert.deepEqual(p.outputContext, q.outputContext);
      assert.deepEqual(p.byteWrites, q.byteWrites);
      assert.deepEqual(p.steps, q.steps);
      assert.deepEqual(
        native.probes.find((r) => r.script_id === spec.id && r.case === variant.name),
        bodyProbe(spec, variant),
      );
      assert.equal(commitTaskPlan(f.data, p).handled, true);
      const expected = spec.recordMaskBody
        ? variant.pointer !== 0 && (variant.flag ?? 0x80) & 0x80
          ? 65535
          : 0
        : spec.sourceRomGuards
          ? expansionBodyResult(spec, variant)
          : spec.id === 0x197
            ? members.includes(variant.input)
              ? 65535
              : 0
            : [0x03f, 0x0b2].includes(spec.id)
              ? [0x1234, 0x5678, 0x9abc][variant.state <= 2 ? 0 : variant.state <= 4 ? 1 : 2]
              : 0xbeef;
      assert.equal(p.resultWord, expected);
      assert.equal(word(f.data, 0x7e0000), expected);
      assert.equal(word(f.data, bodyOuterS + 1), 0xc20a);
      if (
        !spec.sourceRomGuards &&
        spec.instructions.some((i) => i.opcode === 0x58 && i.operand === 13)
      )
        for (const r of spec.romReads) {
          const flags = spec.bytecode[1];
          assert.equal(f.data.readByte(0x7e0000 + r.value + 1).value, 4 | flags);
        }
      if (spec.id === 0x325) {
        assert.equal(word(f.data, bodyFrame + 0x13), 0x7834);
        assert.equal(word(f.data, bodyFrame + 0x15), 0xa5a5);
      }
      if (spec.id === 0x33d) {
        assert.equal(f.data.readByte(bodyFrame + 0x13).value, 0x34);
        assert.equal(word(f.data, bodyFrame + 0x14), 0x5678);
        assert.equal(word(f.data, bodyFrame + 0x16), 0x9abc);
      }
      if (spec.id === 0x37c) {
        assert.equal(word(f.data, 0x801350 + 0x34), 65535);
        assert.equal(word(f.data, bodyFrame + 0x13), 0xa534);
      }
    }
  });
test('Script197 covers each true return, nonmatches at WORD boundaries and every comparison edge', () => {
  const spec = at(0x197),
    seen = new Set();
  assert.deepEqual(
    spec.instructions.filter((i) => i.opcode === 0x14).map((i) => i.operand),
    members,
  );
  for (const input of [
    ...members,
    0,
    1,
    0x7fff,
    0x8000,
    0xffff,
    ...members.flatMap((v) => [v - 1, v + 1]),
  ]) {
    const p = prepared(prepare, fixture(spec, { input }));
    assert.equal(p.resultWord, members.includes(input) ? 65535 : 0);
    for (let n = 1; n < p.bodyPCs.length; n++) seen.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
  }
  assert.deepEqual([...seen].sort(), spec.edges.map((e) => e.from + ':' + e.to).sort());
});
test('identical original selection bodies retain carry-based branch behavior for all256 state lowbytes and ignored statehigh', () => {
  for (const id of [0x03f, 0x0b2])
    for (let state = 0; state < 256; state++) {
      const f = fixture(at(id), { state }),
        p = prepared(prepare, f);
      assert.equal(p.resultWord, state <= 2 ? 0x1234 : state <= 4 ? 0x5678 : 0x9abc);
      unchangedFailure(prepare, omit(f, 0x7e3c07), {}, 'render_source_required');
    }
});
test('Native13 family uses both original lookup bytes, actual byte OR and native91 uses local lowbyte after full WORD-read', () => {
  const spec = at(0x07f),
    r = spec.romReads[0];
  for (let oldField = 0; oldField < 256; oldField++) {
    const f = fixture(spec, { oldField }),
      p = prepared(prepare, f);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(f.data.readByte(0x7e0000 + r.value + 1).value, oldField | 128);
  }
  for (const input of [0, 1, 0xff, 0x100, 0x7fff, 0x8000, 0xffff]) {
    const f = fixture(at(0x37c), { input }),
      p = prepared(prepare, f);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(word(f.data, 0x801350 + (input & 255)), 65535);
    assert.equal(f.data.readByte(bodyFrame + 0x14).value, 0xa5);
  }
  unchangedFailure(
    prepare,
    omit(fixture(at(0x37c)), bodyFrame + 0x14),
    {},
    'render_source_required',
  );
});
test('common failure matrix preserves atomicity for each body: sources, counts, budgets, windows, pointers and changed original bytes', () => {
  for (const spec of ordinaryBodies) {
    const f = fixture(spec),
      p = prepared(prepare, f);
    if (spec.fetchTail !== null)
      unchangedFailure(
        prepare,
        omit(f, spec.scriptEntry + 2 + spec.bytecode.length),
        {},
        'render_source_required',
      );
    unchangedFailure(prepare, omit(f, bodyFrame + 1), {}, 'render_source_required');
    unchangedFailure(prepare, omit(f, bodyOuterS + 2), {}, 'render_source_required');
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    unchangedFailure(
      prepare,
      f,
      { maxHandlers: f.maxHandlers + 1 },
      'task_script_body_handler_count_required',
    );
    if (f.maxHandlers > 1)
      unchangedFailure(
        prepare,
        f,
        { maxHandlers: f.maxHandlers - 1 },
        'task_script_body_handler_count_required',
      );
    const bad = fixture(spec);
    bad.data.seed(spec.scriptEntry + 2, [spec.bytecode[0] ^ 1]);
    unchangedFailure(prepare, bad, {}, 'task_script_body_bytes_required');
    unchangedFailure(
      prepare,
      f,
      { context: Object.freeze({ ...f.context, y: 2 }) },
      'task_script_body_entry_required',
    );
    unchangedFailure(
      prepare,
      f,
      { context: Object.freeze({ ...f.context, bank: 0x80 }) },
      'task_script_body_pointer_required',
    );
    unchangedFailure(
      prepare,
      f,
      { context: Object.freeze({ ...f.context, x: 1 }) },
      'task_script_body_instruction_required',
    );
    const limited = createRenderData({ writeWindows: [[0x7e0002, 0x7fffff]] });
    for (const [a, v] of f.data.snapshot().bytes) limited.seed(a, [v]);
    unchangedFailure(prepare, { ...f, data: limited }, {}, 'render_write_window_required');
    for (const r of spec.romReads) {
      unchangedFailure(prepare, omit(f, r.address + 1), {}, 'render_source_required');
      if (
        !spec.sourceRomGuards &&
        spec.instructions.some((i) => i.opcode === 0x58 && i.operand === 13)
      )
        unchangedFailure(prepare, omit(f, 0x7e0000 + r.value + 1), {}, 'render_source_required');
    }
    for (const native of scriptBodyNativeSources.filter((n) =>
      spec.instructions.some(
        (i) => i.opcode === 0x58 && i.operand === n.id && p.bodyPCs.includes(i.pc),
      ),
    ))
      for (const anchor of native.anchors) {
        unchangedFailure(prepare, omit(f, anchor.address + 1), {}, 'render_source_required');
        const changed = fixture(spec);
        changed.data.seed(anchor.address, [anchor.bytes[0] ^ 1]);
        unchangedFailure(prepare, changed, {}, 'task_script_body_bytes_required');
      }
  }
});
test('shared plan owner/version/root rules remain real; END reads a WORD even with no logical result', () => {
  const f = fixture(at(0x056)),
    p = prepared(prepare, f);
  unchangedFailure(prepare, omit(f, bodyStack + 2), {}, 'render_source_required');
  unchangedFailure(prepare, f, { scriptId: 0 }, 'task_script_body_source_required');
  unchangedFailure(prepare, f, { maxHandlers: 0 }, 'task_handler_budget_required');
  assert.equal(commitTaskPlan(fixture(at(0x056)).data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  f.data.seed(0x100, [1]);
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), before);
  const g = fixture(at(0x056));
  put(g, bodyOuterS + 1, 0xfffe);
  const q = prepared(prepare, g);
  assert.equal(q.returnTarget, 0x80ffff);
  assert.equal(q.targetExecuted, false);
  unchangedFailure(
    prepare,
    g,
    { protectedStackBytes: [renderAddress(bodyOuterS + 2), 0x7e0500] },
    'task_outer_return_required',
  );
});
test('late dispatch changes and a native store replacing the physical frame pointer reject all previous body writes', () => {
  const altered = fixture(at(0x197));
  altered.data.seed(0x80f2b4 + 0xb0, [0]);
  unchangedFailure(prepare, altered, {}, 'task_opcode_target_required');
  const f = fixture(at(0x37c)),
    oldBytes = new Map(f.data.snapshot().bytes),
    nextFrame = 0x1384;
  for (let n = 0; n < 0x15; n++) {
    const value = oldBytes.get(renderAddress(bodyFrame + n));
    if (value !== undefined) f.data.seed(nextFrame + n, [value]);
  }
  put(f, 0x800254, nextFrame);
  put(f, 0x830004, 0xa556);
  f.context = Object.freeze({ ...f.context, d: nextFrame });
  // Native A91D writes FFFF at1350+localLow34, replacing this frame's DP00.
  // Its subsequent native resume genuinely fetches via that changed pointer;
  // the next original-body admission must reject instead of caching the ROM PC.
  unchangedFailure(prepare, f, {}, 'task_script_body_pointer_required');
  const indexAlias = fixture(at(0x07f));
  indexAlias.context = Object.freeze({ ...indexAlias.context, s: bodyFrame + 6 });
  // The pushed literal's physical bytes are DP03/04 here. Native58 writes
  // savedPC7 there before popping, so CBB3 really receives index7. Its ROM
  // read must reject this body's unproved table source after those writes.
  unchangedFailure(prepare, indexAlias, {}, 'task_script_body_ROM_read_required');
});
