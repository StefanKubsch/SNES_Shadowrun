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
const ids = [0xed, 0x139, 0x13d, 0x13f, 0x2d4, 0x352],
  specs = scriptBodySpecs.filter((s) => ids.includes(s.id));
const argumentsById = new Map([
  [0xed, [9, 2, 11, 3, 0, 105, 120]],
  [0x139, [9, 2, 17, 3, 0, 100, 120]],
  [0x13d, [8, 2, 13, 3, 0, 101, 120]],
  [0x13f, [8, 2, 12, 3, 0, 102, 120]],
  [0x2d4, [13, 2, 9, 3, 0, 104, 120]],
  [0x352, [9, 2, 14, 3, 0, 103, 120]],
]);

for (const spec of specs)
  test(`Whole original ${spec.id.toString(16)}: strict100 threshold, WORD-wrapped distance, all branch edges and original C8/release/END`, async () => {
    const report = JSON.parse(
        await readFile('analysis/render-task-script-bodies-c8-distance-native.json'),
      ),
      edges = new Set();
    for (const variant of bodyCases(spec)) {
      const f = scriptBodyFixture(spec, variant),
        p = prepared(prepare, f),
        near = variant.distance < 100;
      const signed = variant.delta < 32768 ? variant.delta : variant.delta - 65536;
      assert.equal(Math.floor(Math.abs(signed) / 4), variant.distance);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.outputContext.s, 0xb01);
      assert.deepEqual(p.bodyPCs, c8BodyPCs(spec, variant));
      assert.equal(p.handlersExecuted, p.bodyPCs.length);
      const distance = p.steps.find((s) => s.calleeEntry === 0x80c68d);
      assert.equal(distance.calleeReturnWord, 0xf508);
      const resultAt = p.accesses.findIndex((a) => a.label === 'resume-fresh-result-low');
      assert.equal(
        p.accesses[resultAt].value | (p.accesses[resultAt + 1].value << 8),
        variant.distance,
      );
      const compare = p.steps.find((s) => s.opcode === 0x8a);
      assert.equal(compare.comparedRight, 99);
      assert.equal(compare.left, variant.distance);
      assert.equal(compare.value, near ? 65535 : 0);
      const c8 = p.steps.find((s) => s.calleeEntry === 0x80fec1);
      assert.equal(!!c8, near);
      if (near) {
        const at = p.accesses.findIndex((a) => a.label === 'saved-ID-low' && a.value === 0xc8),
          reads = p.accesses.slice(at),
          args = argumentsById.get(spec.id);
        assert.equal(c8.arguments.wordPops, 7);
        assert.equal(c8.calleeReturnWord, 0xf508);
        assert.equal(c8.resultPushed, false);
        assert.equal(c8.callee.outcome, variant.occupied ? 'notice_replaced' : 'notice_inserted');
        assert.deepEqual(
          reads
            .filter((a) => a.label === 'native-argument-PLA-low')
            .slice(0, 7)
            .map((a) => a.value),
          args.map((v) => v & 255),
        );
        assert.deepEqual(
          reads
            .filter((a) => a.label === 'native-argument-PLA-high')
            .slice(0, 7)
            .map((a) => a.value),
          args.map((v) => v >>> 8),
        );
      } else {
        assert.equal(p.observationsUsed, 0);
        assert.equal(p.waitObservationsUsed, 0);
      }
      const releases = [0xed, 0x2d4, 0x352].includes(spec.id);
      assert.equal(
        p.steps.some((s) => s.calleeEntry === 0x80a8f5),
        releases,
      );
      assert.equal(commitTaskPlan(f.data, p).handled, true);
      assert.equal(f.data.readByte(0x613).value, 0x10);
      if (releases) assert.equal(bodyWord(f.data, 0x7e3f38), 65535);
      for (let n = 1; n < p.bodyPCs.length; n++) edges.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
      assert.deepEqual(
        report.probes.find((p) => p.script_id === spec.id && p.case === variant.name),
        bodyProbe(spec, variant),
      );
    }
    assert.deepEqual([...edges].sort(), spec.edges.map((e) => e.from + ':' + e.to).sort());
  });

test('Distance/C8 bodies: highbytes, stale local high, fresh reference slot and late observation/budget failures remain atomic', () => {
  for (const spec of specs) {
    const f = scriptBodyFixture(spec, { delta: 399, distance: 99, occupied: [4, 4, 4, 4] }),
      p = prepared(prepare, f);
    for (const address of [
      0x82d7cd, 0x82da57, 0x82d97b, 0x800cc3, 0x800e39, 0x800e49, 0x800e91, 0x800ea1, 0x614, 0x801,
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
    unchangedFailure(
      prepare,
      f,
      { ioObservations: Object.freeze(f.ioObservations.slice(0, -1)) },
      'task_io_observation_required',
    );
    const far = scriptBodyFixture(spec, { delta: 400, distance: 100 });
    unchangedFailure(
      prepare,
      far,
      { ioObservations: f.ioObservations },
      'task_io_observation_unused',
    );
    unchangedFailure(
      prepare,
      far,
      { waitObservations: f.waitObservations },
      'task_wait_observation_unused',
    );
    const alias = scriptBodyFixture(spec, { delta: 399, distance: 99 });
    alias.data.seed(0x800cc2, [0x21, 0]);
    unchangedFailure(prepare, alias, {}, 'render_source_required');
  }
});
