import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForRandomStateChange as run } from '../src/task/native-frame-wait.mjs';
import { prepareTaskNativeCounterB0A1 as prepare } from '../proof/task/native-counter-b0a1.mjs';
import { prepareTaskPlan, commitTaskPlan } from '../proof/task/plan.mjs';
import { taskCounterFixture } from './task-native-counter-fixtures.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
const records = (values) =>
  Object.freeze(
    values.map((value) => Object.freeze({ pc: 0x81b0a5, address: 0x7e1c76, width: 2, value })),
  );
const omit = (f, ...addresses) => {
  const set = new Set(addresses.map(renderAddress)),
    data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes) if (!set.has(a)) data.seed(a, [v]);
  return { ...f, data };
};

test('Task B0A1: saved full baseline, repeated equality, WORDwrap CMP flags and original RTL bank/word', () => {
  for (const bank of [0x80, 0x7e, 0x7f])
    for (const baseline of [0, 1, 255, 256, 32767, 32768, 65535])
      for (const observed of [0, 255, 256, 32768, 65535]) {
        const f = taskCounterFixture(0x81b0a1, { bank });
        f.data.seed(0x7e1c76, [baseline & 255, baseline >>> 8]);
        const options = { ...f, waitObservations: records([baseline, baseline, observed]) };
        if (observed === baseline) {
          unchangedFailure(prepare, options, {}, 'task_wait_observation_required');
          continue;
        }
        const p = prepared(prepare, options),
          signed = ((baseline - observed + 32768 + 65536) % 65536) - 32768;
        assert.equal(p.outputContext.a, baseline);
        assert.equal(p.outputContext.bank, bank);
        assert.equal(p.polls, 3);
        assert.equal(
          p.outputContext.status & 0xc3,
          0x40 | Number(baseline >= observed) | (signed < 0 ? 0x80 : 0),
        );
        assert.equal(p.outputContext.x, f.context.x);
        assert.equal(p.outputContext.y, f.context.y);
        assert.equal(p.rawReturnWord, 0xf508);
        assert.equal(p.returnBank, 0x80);
        assert.equal(p.returnTarget, 0x80f509);
        assert.equal(p.outputContext.s, 0x702);
        assert.equal(p.outputContext.programBank, 0x80);
        assert.equal(p.returnTargetExecuted, false);
        assert.deepEqual(
          p.accesses.filter((a) => a.label === 'counter-fresh-CMP-low').map((a) => a.address),
          [0x7e1c76, 0x7e1c76, 0x7e1c76],
        );
        assert.equal(commitTaskPlan(f.data, p).handled, true);
        assert.equal(f.data.readByte(0x7e1c76).value, observed & 255);
      }
});

test('Task B0A1: individual PC/address/width/value records, baselineHigh and all three protected RTL bytes are required atomically', () => {
  const f = taskCounterFixture(),
    p = prepared(prepare, f);
  for (const address of [0x7e1c77, 0x700, 0x701, 0x702])
    unchangedFailure(prepare, omit(f, address), {}, 'render_source_required');
  unchangedFailure(
    prepare,
    f,
    { protectedStackBytes: f.protectedStackBytes.slice(0, 2) },
    'task_outer_return_required',
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
    { waitObservations: records([65535, 0, 1]) },
    'task_wait_observation_unused',
  );
  for (const patch of [
    { pc: 0x81b0a1 },
    { address: 0x801c76 },
    { width: 1 },
    { value: -1 },
    { value: 65536 },
  ]) {
    const values = Object.freeze([Object.freeze({ ...f.waitObservations[0], ...patch })]);
    unchangedFailure(prepare, f, { waitObservations: values }, 'task_wait_observations_required');
  }
  // A wider parent stream is validated globally; the actual inner poll must
  // still reject a wrong record before exposing its own effects.
  const inner = (options) =>
    prepareTaskPlan(options, [0x81b0a1], (a) => run(a, options, true, true));
  unchangedFailure(
    inner,
    f,
    {
      waitObservations: Object.freeze([Object.freeze({ ...f.waitObservations[0], pc: 0x81acaf })]),
    },
    'task_wait_observation_required',
  );
  const valid = prepared(inner, { ...f, waitObservations: records([65535, 0, 1]) });
  assert.equal(valid.waitObservationsUsed, 2);
});

test('Task B0A1: actual native stack wraps bank00 and WORDffff returns to the separately observed bank at0000', () => {
  const f = taskCounterFixture(0x81b0a1, { s: 65535, savedOuterS: 65535 });
  f.data.seed(0, [255, 255, 0x7f]);
  const p = prepared(prepare, f);
  assert.equal(p.rawReturnWord, 65535);
  assert.equal(p.returnBank, 0x7f);
  assert.equal(p.outputContext.s, 2);
  assert.equal(p.outputContext.pc, 0);
  assert.equal(p.returnTarget, 0x7f0000);
  assert.equal(p.returnTargetExecuted, false);
  unchangedFailure(prepare, omit(f, 2), {}, 'render_source_required');
});
