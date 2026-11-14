import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs, scriptBodyReportStem } from '../proof/task/script-body-specs.mjs';
import {
  prepareTaskScriptBody as prepare,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import {
  scriptBodyFixture,
  bodyCases,
  bodyWord as word,
  isWaitBody,
  omitBodyBytes,
} from './task-script-body-fixtures.mjs';
import { expansionBodyPCs, expansionBodyResult } from './task-script-body-expansion-fixtures.mjs';
import {
  runWaitBodyFixture,
  resumeBodyFixture,
  waitBodyProbe,
} from './task-script-body-wait-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
// These original expansion bodies complete from F390/start or their own9F
// resume. Script52 parents have separate whole child/release/F495 tests.
const specs = scriptBodySpecs.filter(
    (s) =>
      s.sourceRomGuards &&
      !s.scriptChildBody &&
      !s.c8Observations &&
      !s.audioWait &&
      !s.randomObservations &&
      !s.counterBody &&
      !s.slotFieldsWait &&
      !s.recordLifecycleBody &&
      !s.recordMaskBody &&
      !s.selectionBody &&
      !s.modalBody,
  ),
  at = (id) => specs.find((s) => s.id === id);
const put = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
function run(spec, variant = {}) {
  if (isWaitBody(spec)) return runWaitBodyFixture(spec, variant);
  const f = scriptBodyFixture(spec, variant),
    p = commit(prepare, f);
  return { fixture: f, plan: p, segments: [p] };
}
for (const spec of specs)
  test(`Original expansion ${spec.id.toString(16)}: independently expected whole paths, exact END result and every original branch edge`, async () => {
    const report = JSON.parse(
        await readFile(`analysis/render-task-${scriptBodyReportStem(spec.id)}-native.json`),
      ),
      edges = new Set();
    for (const variant of bodyCases(spec)) {
      const { fixture: f, plan: p, segments } = run(spec, variant),
        pcs = expansionBodyPCs(spec, variant);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.targetExecuted, false);
      assert.deepEqual(p.bodyPCs, pcs);
      assert.equal(p.handlersExecuted, pcs.length);
      assert.equal(p.resultWord, expansionBodyResult(spec, variant));
      assert.equal(word(f.data, 0), expansionBodyResult(spec, variant));
      assert.equal(p.outputContext.s, isWaitBody(spec) ? 0xaff : 0xb01);
      assert.equal(word(f.data, 0xb00), 0xc20a);
      assert.equal(p.outputContext.d, 0);
      assert.equal(p.outputContext.bank, spec.scriptEntry >>> 16);
      assert.equal(p.outputContext.status & 0x30, 0);
      for (let n = 1; n < pcs.length; n++) edges.add(pcs[n - 1] + ':' + pcs[n]);
      const waits = spec.instructions.filter((i) => i.opcode === 0x58 && i.operand === 0x9f).length;
      assert.equal(
        segments.filter((s) => s.bodySuspended && s.frontier === 'actual-native-wait-yield-target')
          .length,
        waits,
      );
      assert.ok(segments.every((s) => Object.isFrozen(s.outputContext)));
      const probe = isWaitBody(spec) ? waitBodyProbe(spec, variant) : bodyProbe(spec, variant);
      assert.deepEqual(
        report.probes.find((p) => p.script_id === spec.id && p.case === variant.name),
        probe,
      );
    }
    assert.deepEqual([...edges].sort(), spec.edges.map((e) => e.from + ':' + e.to).sort());
  });
test('All five original A9 bodies execute their genuine positive callback graph, allocate the original frame and append without visiting it', () => {
  const callbacks = new Map([
    [0x68, 144],
    [0x1b4, 348],
    [0x1ba, 350],
    [0x1bc, 351],
    [0x1c2, 356],
  ]);
  for (const [id, callback] of callbacks) {
    const spec = at(id),
      { fixture: f, plan: p } = run(spec);
    const header = spec.romReads.find((r) => r.address === 0x82ded1 + callback * 2).value;
    assert.equal(word(f.data, 0x800256), 0x3d6);
    assert.equal(word(f.data, 0x8003d6), (header + 2) & 65535);
    assert.equal(word(f.data, 0x8003d8), 0x9f);
    assert.equal(word(f.data, 0x8003d9), 0);
    assert.equal(word(f.data, 0x800316), 2);
    assert.equal(word(f.data, 0x800374), 4);
    assert.equal(word(f.data, 0x800376), 65535);
    assert.equal(word(f.data, 0x80024c), 4);
    assert.equal(word(f.data, 0x80024e), 65535);
    assert.equal(word(f.data, 0x800254), 0x600);
    assert.equal(word(f.data, 0x800250), 2);
    assert.equal(word(f.data, 0x8013a6), 4);
    assert.equal(word(f.data, 0x614) & 255, 0x56);
    assert.equal(p.resultWord, 0x56);
    if (id === 0x68) {
      assert.equal(word(f.data, 0x7e3f7e), 153);
      assert.equal(word(f.data, 0x7e3f38), 65535);
      assert.equal(word(f.data, 0x8014b2), 0x56);
      assert.equal(word(f.data, 0x8014b0), 0);
      assert.equal(p.observedReadinessEntries, 15);
    } else {
      assert.equal(word(f.data, 0x7e3f7e), 158);
      assert.equal(word(f.data, 0x800e7e), 8);
      assert.equal(word(f.data, 0x800ed6), 4);
      assert.equal(word(f.data, 0x800f2e), 28);
      assert.equal(word(f.data, 0x800f86), 6);
    }
  }
});
test('NativeB6 original position families retain real ROM coordinate WORDs and source order before selection and eventual release', () => {
  for (const id of [0x9c, 0x184, 0x2f3])
    for (const variant of bodyCases(at(id))) {
      const spec = at(id),
        { fixture: f } = run(spec, variant),
        base = id === 0x9c ? 0x8d9013 : 0x8d9007;
      for (const [n, field] of [0xe28, 0xe80, 0xed8].entries()) {
        const r = spec.romReads.find((r) => r.address === base + 2 * n);
        assert.equal(word(f.data, 0x800000 + field + 0x10), (r.value * 4) & 65535);
      }
      assert.equal(word(f.data, 0x801410) & 0x8001, 0x8001);
      if (id !== 0x9c) {
        assert.equal(word(f.data, 0x7e3f38), 65535);
        assert.equal(word(f.data, 0x8014b0), 65534);
      }
    }
});
test('Original dialog-choice bodies cover every matching source branch, fallback and retained stale local WORD', () => {
  const values = new Map([
    [
      0x21e,
      new Map([
        [1, 0x182],
        [2, 0x17f],
        [3, 0x182],
        [4, 0x184],
        [5, 0x186],
        [6, 0x188],
      ]),
    ],
    [
      0x39d,
      new Map([
        [1, 0x181],
        [2, 0x183],
        [3, 0x185],
        [4, 0x187],
        [5, 0x189],
        [6, 0x18b],
      ]),
    ],
    [
      0x223,
      new Map([
        [3, 0x1ce],
        [4, 0x165],
        [5, 0x16c],
        [6, 0x173],
        [7, 0x179],
      ]),
    ],
  ]);
  for (const [id, choices] of values)
    for (const variant of bodyCases(at(id))) {
      const spec = at(id),
        { fixture: f } = run(spec, variant),
        expected =
          choices.get(variant.state) ?? (id === 0x21e ? 0x18a : id === 0x39d ? 0x189 : 0xa5a5);
      assert.equal(word(f.data, 0x7e2de2), expected);
      assert.equal(word(f.data, 0x801ce9), id === 0x39d ? 3 : 4);
      assert.equal(word(f.data, 0x801ceb), (variant.state - 1) & 65535);
      assert.equal(word(f.data, 0x613), expected);
      const lookup = spec.romReads[0];
      assert.equal(f.data.readByte(0x7e0000 + lookup.value + 1).value, 0);
    }
});
test('Original record branches execute only their actual nonzero flag paths and require original full lookup highbytes', () => {
  for (const id of [0x151, 0x158, 0x159])
    for (const variant of bodyCases(at(id))) {
      const spec = at(id),
        { fixture: f, plan: p } = run(spec, variant);
      assert.equal(
        p.byteWrites.some(([a]) => a === 0x7e1ce9),
        variant.flag === 1,
      );
      for (const i of spec.instructions.filter((i) => i.opcode === 0x58 && i.operand === 13)) {
        const lookup = spec.romReads.find(
          (r) =>
            r.address === 0x8db020 + spec.instructions[spec.instructions.indexOf(i) - 1].operand,
        );
        assert.equal(
          f.data.readByte(0x7e0000 + lookup.value + 1).value,
          variant.flag === 1 ? 129 : 0,
        );
      }
    }
  for (const variant of bodyCases(at(0x182))) {
    const { fixture: f } = run(at(0x182), variant);
    assert.equal(word(f.data, 0x7e3c0d), variant.flag === 0 ? 500 : 0);
  }
  const spec = at(0x151),
    f = scriptBodyFixture(spec),
    lookup = spec.romReads.find((r) => r.address === 0x8dd0aa);
  unchangedFailure(prepare, omitBodyBytes(f, lookup.address + 1), {}, 'render_source_required');
  unchangedFailure(
    prepare,
    omitBodyBytes(f, 0x7e0000 + lookup.value + 2),
    {},
    'render_source_required',
  );
});
test('Original303 END at9DFFFF fetches its ignored highbyte from9E0000/physical workspace after B9, never the next ROM file byte', () => {
  const spec = at(0x303),
    { plan: p } = run(spec);
  assert.equal(spec.fetchTail, null);
  assert.equal(spec.scriptEntry + spec.bytecode.length + 2, 0x9e0000);
  const native = p.steps.findLast((s) => s.calleeEntry === 0x80a8f5);
  assert.equal(native.opcodeWord, 0x1056);
  assert.equal(p.resultWord, 0xbeef);
});
test('Every new wait prefix requires its true exact budgets and committed owner before an observed resume', () => {
  for (const spec of specs.filter(isWaitBody)) {
    const f = scriptBodyFixture(spec),
      p = prepared(prepare, f);
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    unchangedFailure(
      resume,
      resumeBodyFixture(spec, f, p),
      {},
      'task_script_body_continuation_required',
    );
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    const observed = resumeBodyFixture(spec, f, p),
      before = f.data.snapshot(),
      r = prepared(resume, observed);
    assert.deepEqual(f.data.snapshot(), before);
    unchangedFailure(resume, observed, { maxWork: r.work - 1 }, 'task_work_budget_required');
    const bad = omitBodyBytes(observed, spec.scriptEntry + 2);
    unchangedFailure(resume, bad, {}, 'task_script_body_continuation_required');
  }
});
test('A9 body callback, table and argument aliases must use their individually pinned original ROM sources', () => {
  const spec = at(0x1b4),
    f = scriptBodyFixture(spec);
  put(f, 0x8003d2, 0x8001);
  put(f, 0x8003d4, 0);
  // Real heap failure proceeds with frame-zero writes, replacing DP00 and
  // source owners; a later body continuation must reject, never cache slot56.
  const p = prepare(f);
  assert.equal(p.handled, false);
  assert.equal(p.byteWrites, undefined);
  const g = scriptBodyFixture(spec);
  put(g, 0x800e28 + 0x10, 0x8000);
  // Full original coordinate getter and scaling retain the supplied WORD;
  // no coordinate clamp or inferred valid scene is introduced.
  const before = g.data.snapshot(),
    q = prepare(g);
  assert.deepEqual(g.data.snapshot(), before);
  assert.equal(q.handled, true);
  assert.equal(q.fullTaskBinding, false);
});
