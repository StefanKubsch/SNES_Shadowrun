import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import { prepareTaskScriptBody as prepare } from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import {
  scriptBodyFixture,
  bodyCases,
  bodyWord,
  omitBodyBytes,
} from './task-script-body-fixtures.mjs';
import { c8BodyPCs } from './task-script-body-c8-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
const specs = scriptBodySpecs.filter((s) => [0x85, 0xff, 0x1b1].includes(s.id));
const fields = new Map([
  [0, 1],
  [12, 0xa360],
  [52, 0x7916],
  [174, 0xfe58],
]);

for (const spec of specs)
  test(`Whole original ${spec.id.toString(16)}: every field branch, original repeated5C lookup and seven C8 pops through END`, async () => {
    const report = JSON.parse(
        await readFile('analysis/render-task-script-bodies-c8-fields-native.json'),
      ),
      edges = new Set();
    for (const variant of bodyCases(spec)) {
      const f = scriptBodyFixture(spec, variant),
        p = prepared(prepare, f),
        value = fields.get(variant.input);
      const top = !!(value & 0x8000),
        next = !!(value & 0x4000);
      const message =
        spec.id === 0x1b1
          ? top
            ? next
              ? 12
              : 13
            : 11
          : top
            ? next
              ? 8
              : 9
            : spec.id === 0xff
              ? 441
              : 10;
      const height = spec.id === 0xff ? (top ? 18 : 14) : 19,
        args = [2, 21, height, 3, 0x800, message, 120];
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.deepEqual(p.bodyPCs, c8BodyPCs(spec, variant));
      assert.equal(p.handlersExecuted, p.bodyPCs.length);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.outputContext.s, 0xb01);
      assert.equal(p.steps.filter((s) => s.calleeEntry === 0x80cb06).length, top ? 2 : 1);
      const at = p.accesses.findIndex((a) => a.label === 'saved-ID-low' && a.value === 0xc8);
      const lookups = p.accesses.slice(0, at).filter((a) => a.label === 'leaf-long-WORD-low');
      assert.equal(lookups.length, top ? 4 : 2);
      assert.equal(lookups[0].address, 0x8db022 + variant.input);
      assert.equal(lookups[1].value, value & 255);
      if (top) assert.deepEqual(lookups.slice(2), lookups.slice(0, 2));
      const c8 = p.steps.find((s) => s.calleeEntry === 0x80fec1);
      assert.equal(c8.arguments.wordPops, 7);
      assert.equal(c8.calleeReturnWord, 0xf508);
      assert.equal(c8.metadataWord, 0);
      assert.equal(c8.resultPushed, false);
      assert.equal(c8.callee.outcome, variant.occupied ? 'notice_replaced' : 'notice_inserted');
      const accesses = p.accesses.slice(at);
      assert.deepEqual(
        accesses
          .filter((a) => a.label === 'native-argument-PLA-low')
          .slice(0, 7)
          .map((a) => a.value),
        args.map((v) => v & 255),
      );
      assert.deepEqual(
        accesses
          .filter((a) => a.label === 'native-argument-PLA-high')
          .slice(0, 7)
          .map((a) => a.value),
        args.map((v) => v >>> 8),
      );
      assert.equal(commitTaskPlan(f.data, p).handled, true);
      assert.equal(bodyWord(f.data, 0x613), variant.input);
      assert.equal(bodyWord(f.data, 0x615), message);
      if (spec.id === 0xff) assert.equal(f.data.readByte(0x617).value, height);
      for (let n = 1; n < p.bodyPCs.length; n++) edges.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
      assert.deepEqual(
        report.probes.find((p) => p.script_id === spec.id && p.case === variant.name),
        bodyProbe(spec, variant),
      );
    }
    assert.deepEqual([...edges].sort(), spec.edges.map((e) => e.from + ':' + e.to).sort());
  });

test('CB06/C8 bodies: original WORD/highbytes, dynamic lookup ownership and late C8 observations discard all effects', () => {
  for (const spec of specs) {
    const f = scriptBodyFixture(spec, { input: 174, occupied: [4, 4, 4, 4] }),
      p = prepared(prepare, f);
    for (const address of [
      0x82d871,
      0x82daa9,
      0x82d9cd,
      ...spec.romReads.map((r) => r.address + 1),
    ])
      unchangedFailure(prepare, omitBodyBytes(f, address), {}, 'render_source_required');
    unchangedFailure(
      prepare,
      f,
      { maxHandlers: f.maxHandlers - 1 },
      'task_script_body_handler_count_required',
    );
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    const bad = scriptBodyFixture(spec, { input: 2 });
    unchangedFailure(prepare, bad, {}, 'task_script_body_ROM_read_required');
    const omitLast = Object.freeze(f.ioObservations.slice(0, -1));
    unchangedFailure(prepare, f, { ioObservations: omitLast }, 'task_io_observation_required');
    const extra = Object.freeze([...f.waitObservations, f.waitObservations.at(-1)]);
    unchangedFailure(prepare, f, { waitObservations: extra }, 'task_wait_observation_unused');
    const stale = scriptBodyFixture(spec, { input: 12 }),
      q = prepared(prepare, stale);
    stale.data.seed(0x613, [0xae]);
    const before = stale.data.snapshot();
    assert.equal(commitTaskPlan(stale.data, q).reason, 'task_plan_stale');
    assert.deepEqual(stale.data.snapshot(), before);
  }
});
