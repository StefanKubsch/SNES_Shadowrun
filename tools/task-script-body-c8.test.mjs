import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import {
  prepareTaskScriptBody as prepare,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import {
  scriptBodyFixture,
  bodyCases,
  bodyWord,
  omitBodyBytes,
  isWaitBody,
} from './task-script-body-fixtures.mjs';
import { c8BodyPCs } from './task-script-body-c8-fixtures.mjs';
import {
  runWaitBodyFixture,
  resumeBodyFixture,
  waitBodyProbe,
} from './task-script-body-wait-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
const specs = scriptBodySpecs.filter((s) =>
    [0xbf, 0xfc, 0x116, 0x25a, 0x26d, 0x2ce, 0x2f9, 0x38e].includes(s.id),
  ),
  at = (id) => specs.find((s) => s.id === id);
const expectedArgs = new Map([
  [0x25a, [2, 2, 28, 3, 0x400, 205, 240]],
  [0x26d, [2, 2, 12, 3, 0, 0, 120]],
  [0x2ce, [4, 2, 24, 3, 0, 284, 240]],
  [0x2f9, [12, 2, 6, 3, 0, 34, 60]],
  [0x38e, [2, 21, 16, 3, 0x800, 14, 120]],
  [0xfc, [8, 2, 16, 3, 0, 532, 180]],
  [0xbf, [3, 2, 27, 3, 0, 506, 180]],
  [0x116, [2, 2, 28, 3, 0, 33, 400]],
]);
const frozen = (values) => Object.freeze(values.map((v) => Object.freeze(v)));
function checked(f, patch = {}) {
  const before = f.data.snapshot(),
    p = prepare({ ...f, ...patch });
  assert.deepEqual(f.data.snapshot(), before);
  return p;
}
for (const spec of specs)
  test(`Whole original C8 body ${spec.id.toString(16)}: independent full paths, seven original pops, real return/frame/END and individual source evidence`, async () => {
    const report = JSON.parse(await readFile('analysis/render-task-script-bodies-c8-native.json'));
    const seen = new Set();
    for (const variant of bodyCases(spec)) {
      const f = scriptBodyFixture(spec, variant),
        first = checked(f);
      assert.equal(first.handled, true, JSON.stringify(first));
      const all = isWaitBody(spec)
        ? runWaitBodyFixture(spec, variant)
        : { fixture: f, plan: first, segments: [first] };
      const { plan: p, segments } = all;
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      if (!isWaitBody(spec)) assert.equal(commitTaskPlan(f.data, p).handled, true);
      assert.deepEqual(p.bodyPCs, c8BodyPCs(spec, variant));
      assert.equal(p.handlersExecuted, p.bodyPCs.length);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.targetExecuted, false);
      assert.equal(p.outputContext.d, 0);
      assert.equal(p.outputContext.bank, spec.scriptEntry >>> 16);
      assert.equal(p.outputContext.s, isWaitBody(spec) ? 0xaff : 0xb01);
      for (let n = 1; n < p.bodyPCs.length; n++) seen.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
      const c8 = p.steps.find((s) => s.calleeEntry === 0x80fec1);
      if (c8) {
        assert.equal(c8.arguments.wordPops, 7);
        assert.equal(c8.arguments.metadataWord, 7);
        assert.equal(c8.metadataWord, 0);
        assert.equal(c8.resultPushed, false);
        assert.equal(c8.calleeReturnWord, 0xf508);
        assert.equal(c8.calleeReturnTarget, 0x80f509);
        assert.equal(c8.callee.outcome, variant.occupied ? 'notice_replaced' : 'notice_inserted');
        assert.equal(c8.callee.slot, variant.occupied ? 0 : 6);
        const originalSegment = segments.find((s) =>
          s.accesses.some((a) => a.label === 'saved-ID-low' && a.value === 0xc8),
        );
        const start = originalSegment.accesses.findIndex(
          (a) => a.label === 'saved-ID-low' && a.value === 0xc8,
        );
        const pops = originalSegment.accesses
          .slice(start)
          .filter((a) => a.label === 'native-argument-PLA-low')
          .map((a) => a.value);
        const args = expectedArgs.get(spec.id);
        assert.deepEqual(
          pops.slice(0, 7),
          args.map((v) => v & 255),
        );
        const highs = originalSegment.accesses
          .slice(start)
          .filter((a) => a.label === 'native-argument-PLA-high')
          .map((a) => a.value);
        assert.deepEqual(
          highs.slice(0, 7),
          args.map((v) => v >>> 8),
        );
        assert.equal(bodyWord(all.fixture.data, 0x7e021e + c8.callee.slot), args[6]);
        assert.equal(bodyWord(all.fixture.data, 0x7e0216 + c8.callee.slot), args[0]);
        assert.equal(c8.dispatchPointerWord, 0xfec1);
        assert.equal(c8.outputContext, undefined);
      }
      if (spec.id === 0x2ce) assert.equal(bodyWord(f.data, 0x7e3bc9), 0xab10);
      if (spec.id === 0x2f9) {
        assert.equal(bodyWord(all.fixture.data, 0x7e2de2), 0x1234);
        assert.equal(bodyWord(all.fixture.data, 0x801ce9), 0x7fff);
      }
      if (isWaitBody(spec)) {
        assert.equal(first.bodyComplete, false);
        assert.equal(first.bodySuspended, true);
        assert.equal(p.observedReadinessEntries, spec.id === 0x38e ? 30 : 1);
        assert.equal(
          segments.filter((s) => s.frontier === 'actual-native-wait-yield-target').length,
          1,
        );
        if (![0xfc, 0xbf, 0x116].includes(spec.id))
          assert.equal(
            segments
              .slice(1)
              .reduce((n, s) => n + (s.observationsUsed ?? 0) + (s.waitObservationsUsed ?? 0), 0),
            0,
          );
        else {
          assert.equal(first.observationsUsed, 0);
          assert.equal(first.waitObservationsUsed, 0);
        }
        if (spec.id === 0xfc)
          assert.equal(all.fixture.data.readByte(0x7e0000 + spec.romReads[0].value + 1).value, 5);
      }
      assert.deepEqual(
        report.probes.find((p) => p.script_id === spec.id && p.case === variant.name),
        isWaitBody(spec) ? waitBodyProbe(spec, variant) : bodyProbe(spec, variant),
      );
    }
    assert.deepEqual([...seen].sort(), spec.edges.map((e) => e.from + ':' + e.to).sort());
  });
test('C8 bodies: body/header/tail bytes, actual metadata WORD highbytes and every observed device/wait are required without effects', () => {
  for (const spec of specs.filter((s) => ![0xfc, 0xbf, 0x116].includes(s.id))) {
    const variant = spec.id === 0x25a ? { flags: 0x40 } : { occupied: [4, 4, 4, 4] },
      f = scriptBodyFixture(spec, variant),
      p = checked(f);
    assert.equal(p.handled, true);
    for (let n = 0; n < spec.header.length + spec.bytecode.length + 1; n++)
      assert.equal(
        checked(omitBodyBytes(f, spec.scriptEntry + n)).reason,
        'render_source_required',
      );
    for (const address of [0x82d949, 0x82db15, 0x82da39, 0x7e0602])
      assert.equal(checked(omitBodyBytes(f, address)).reason, 'render_source_required');
    for (let n = 0; n < f.ioObservations.length; n++)
      assert.equal(
        checked(f, { ioObservations: frozen(f.ioObservations.filter((_, i) => i !== n)) }).reason,
        'task_io_observation_required',
      );
    for (let n = 0; n < f.waitObservations.length; n++)
      assert.equal(
        checked(f, { waitObservations: frozen(f.waitObservations.filter((_, i) => i !== n)) })
          .reason,
        'task_wait_observation_required',
      );
    assert.equal(
      checked(f, { ioObservations: frozen([...f.ioObservations, f.ioObservations.at(-1)]) }).reason,
      'task_io_observation_unused',
    );
    assert.equal(
      checked(f, { waitObservations: frozen([...f.waitObservations, f.waitObservations.at(-1)]) })
        .reason,
      'task_wait_observation_unused',
    );
    assert.equal(checked(f, { maxWork: p.work - 1 }).reason, 'task_work_budget_required');
    assert.equal(
      checked(f, { maxOutputBytes: p.outputBytes - 1 }).reason,
      'task_output_budget_required',
    );
    assert.equal(
      checked(f, { maxHandlers: f.maxHandlers - 1 }).reason,
      'task_script_body_handler_count_required',
    );
    assert.equal(
      checked(f, { context: Object.freeze({ ...f.context, y: 2 }) }).reason,
      'task_script_body_entry_required',
    );
  }
});
test('C8 body suspension: future readiness keeps fresh owner, rejects replayed C8 observations and requires actual committed prefix', () => {
  const spec = at(0x38e),
    f = scriptBodyFixture(spec),
    prefix = checked(f);
  assert.equal(prefix.bodyComplete, false);
  const options = resumeBodyFixture(spec, f, prefix);
  assert.equal(resume(options).reason, 'task_script_body_continuation_required');
  assert.equal(commitTaskPlan(f.data, prefix).handled, true);
  const before = f.data.snapshot();
  assert.equal(
    resume({ ...options, ioObservations: f.ioObservations }).reason,
    'task_io_observation_unused',
  );
  assert.equal(
    resume({ ...options, waitObservations: f.waitObservations }).reason,
    'task_wait_observation_unused',
  );
  assert.deepEqual(f.data.snapshot(), before);
  assert.equal(
    resume({ ...options, continuation: { ...prefix } }).reason,
    'task_script_body_continuation_required',
  );
  const stale = scriptBodyFixture(spec),
    q = checked(stale);
  assert.equal(commitTaskPlan(stale.data, q).handled, true);
  stale.data.seed(0x609, [0xc8]);
  assert.equal(
    resume(resumeBodyFixture(spec, stale, q)).reason,
    'task_script_body_wait_owner_required',
  );
});
test('Original FC: post-yield C8 consumes only new segment records; late field/ROM/END failures reject every new native effect', () => {
  const spec = at(0xfc);
  for (const variant of bodyCases(spec)) {
    const f = scriptBodyFixture(spec, variant),
      prefix = checked(f);
    assert.equal(prefix.bodyComplete, false);
    assert.equal(commitTaskPlan(f.data, prefix).handled, true);
    const options = resumeBodyFixture(spec, f, prefix),
      before = f.data.snapshot();
    const p = resume(options);
    assert.equal(p.handled, true, JSON.stringify(p));
    assert.equal(p.bodyComplete, true);
    for (const [patch, reason] of [
      [{ ioObservations: Object.freeze([]) }, 'task_io_observation_required'],
      [{ waitObservations: Object.freeze([]) }, 'task_wait_observation_required'],
      [
        {
          waitObservations: frozen([...options.waitObservations, options.waitObservations.at(-1)]),
        },
        'task_wait_observation_unused',
      ],
      [
        { ioObservations: frozen([...options.ioObservations, options.ioObservations.at(-1)]) },
        'task_io_observation_unused',
      ],
      [{ maxWork: p.work - 1 }, 'task_work_budget_required'],
      [{ maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required'],
    ]) {
      assert.equal(resume({ ...options, ...patch }).reason, reason);
      assert.deepEqual(f.data.snapshot(), before);
    }
    f.data.seed(0x600 + 0x13, [0x12]);
    const changed = f.data.snapshot();
    assert.equal(resume(options).reason, 'task_script_body_ROM_read_required');
    assert.deepEqual(f.data.snapshot(), changed);
  }
});
test('Original BF/116: event readiness and original ROM table aliases remain separate from fresh future C8 records', () => {
  for (const id of [0xbf, 0x116]) {
    const spec = at(id),
      f = scriptBodyFixture(spec),
      prefix = checked(f);
    assert.equal(prefix.handled, true);
    const high = spec.romReads[0].address + 1;
    assert.equal(checked(omitBodyBytes(f, high)).reason, 'render_source_required');
    assert.equal(commitTaskPlan(f.data, prefix).handled, true);
    const options = resumeBodyFixture(spec, f, prefix),
      before = f.data.snapshot();
    assert.equal(resume(options).reason, 'task_wait_observation_unused');
    assert.deepEqual(f.data.snapshot(), before);
    // Explicit synthetic event observation, not inferred time or a ROM writer.
    f.data.seed(0x800c64, [id === 0xbf ? 4 : 16, 0]);
    const observed = f.data.snapshot(),
      p = resume(options);
    assert.equal(p.handled, true, JSON.stringify(p));
    assert.equal(p.bodyComplete, true);
    assert.deepEqual(f.data.snapshot(), observed);
    assert.equal(
      resume({ ...options, ioObservations: Object.freeze([]) }).reason,
      'task_io_observation_required',
    );
    assert.deepEqual(f.data.snapshot(), observed);
    f.data.seed(spec.romReads[0].address, [0]);
    const changed = f.data.snapshot();
    assert.equal(resume(options).reason, 'task_script_body_bytes_required');
    assert.deepEqual(f.data.snapshot(), changed);
  }
});
