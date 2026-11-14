import test from 'node:test';
import assert from 'node:assert/strict';
import * as native from '../proof/task/native-text-prerequisites.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskTextFixture } from './task-native-text-fixtures.mjs';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderAF04 } from '../proof/render/text-width-fadd.mjs';
import {
  prepareRenderADBA,
  prepareRenderAE14,
  prepareRenderAE4D,
} from '../proof/render/text-geometry.mjs';
import { prepareRenderAEC8 } from '../proof/render/text-mask-aec8.mjs';
import * as oldWaits from '../proof/render/request-aef4.mjs';
const prepare = (name, f, patch = {}) => {
  const before = f.data.snapshot(),
    p = native['prepareTaskText' + name]({ ...f, ...patch });
  assert.deepEqual(f.data.snapshot(), before);
  return p;
};
const word = (p, address) => {
  const m = new Map(p.byteWrites);
  return m.get(address) | (m.get(address + 1) << 8);
};
const events = (values) => Object.freeze(values.map((o) => Object.freeze(o)));

test('Task AF04: full WORD decrement sign gates and real PHA/PLA/RTL chronology', () => {
  for (const remaining of [0, 1, 2, 0x8000, 0x8001, 65535]) {
    const f = taskTextFixture('AF04', { remaining }),
      p = prepare('AF04', f);
    assert.equal(p.handled, true);
    assert.equal(p.reloaded, Boolean((remaining - 1) & 65535 & 32768));
    assert.equal(p.outputContext.a, 0xbeef);
    assert.equal(p.outputContext.x, 2);
    assert.equal(p.outputContext.y, 0xabcd);
    assert.equal(p.outputContext.s, 0x702);
    assert.equal(p.returnTarget, 0x80f509);
    assert.equal(p.outputContext.programBank, 0x80);
    assert.equal(p.accesses.filter((e) => e.label === 'AF04-PHA-high').length, p.reloaded ? 1 : 0);
    assert.equal(
      p.accesses.filter((e) => e.label === 'AF04-PLA-fresh-high').length,
      p.reloaded ? 1 : 0,
    );
    const old = prepareRenderAF04({
      data: f.data,
      bank: f.context.bank,
      status: f.context.status,
      a: f.context.a,
      x: 2,
      y: 0xabcd,
      emulation: 0,
      directPage: 0,
      stackWindow: [0x1f00, 0x1fff],
    });
    assert.equal(old.handled, true);
    assert.deepEqual([p.outputContext.a, p.outputContext.status], [old.a, old.status]);
    const writes = new Map(p.byteWrites);
    for (const [address, value] of old.byteWrites) assert.equal(writes.get(address), value);
  }
});
test('Task AF04: buffer stores replace saved PHA bytes; PLA is fresh and source pointer increments twice', () => {
  const f = taskTextFixture('AF04', { s: 0x209, raw: 0x1234 }),
    p = prepare('AF04', f);
  assert.equal(p.handled, true);
  assert.equal(p.outputContext.a, 0x3412);
  assert.equal(word(p, 0x7e0208), 0x6824);
  assert.equal(word(p, 0x7e00cf), 0x9002);
  const stackWrites = p.accesses
    .filter((e) => e.label.startsWith('AF04-PHA'))
    .map((e) => [e.address, e.value]);
  assert.deepEqual(stackWrites, [
    [0x209, 0xbe],
    [0x208, 0xef],
  ]);
  assert.deepEqual(
    p.accesses.filter((e) => e.label.startsWith('AF04-PLA-fresh')).map((e) => e.value),
    [0x12, 0x34],
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
});
test('Task geometry: independently derived valid equations agree for every branch, BYTE/WORD and DBR source', () => {
  const oldFns = { ADBA: prepareRenderADBA, AE14: prepareRenderAE14, AE4D: prepareRenderAE4D };
  const variants = {
    ADBA: [
      {},
      { minimum: 9, offset: 7, results: [0] },
      { minimum: 30, offset: 2, results: [1] },
      { minimum: 0x9000, results: [0xe001], cursor: 0x8010, base: 3, status: 0x81 },
    ],
    AE14: [
      {},
      { width: 0x104, results: [3], offset: 7 },
      { width: 0, height: 0, results: [0xffff], offset: 0xfffc },
    ],
    AE4D: [
      {},
      { height: 4, quotients: [1], results: [3] },
      { results: [224] },
      { quotients: [255, 7], results: [0xffff], height: 3 },
    ],
  };
  for (const name of Object.keys(variants))
    for (const options of variants[name])
      for (const bank of [0x7e, 0x80, 0]) {
        const f = taskTextFixture(name, { ...options, bank }),
          p = prepare(name, f);
        assert.equal(p.handled, true, JSON.stringify(p));
        assert.equal(p.outputContext.bank, bank);
        assert.equal(p.outputContext.s, 0x702);
        assert.equal(p.returnTarget, 0x80f509);
        assert.equal(p.outputContext.x, 2);
        assert.equal(p.outputContext.y, 0xabcd);
        const old = oldFns[name]({
          data: f.data,
          bank,
          status: f.context.status,
          x: 2,
          y: 0xabcd,
          emulation: 0,
          directPage: 0,
          stackWindow: [0x1f00, 0x1fff],
          ioMode: 'record-requests',
          ioRead4214: options.quotients ?? [0, 1],
          ioRead4216: options.results ?? [0],
        });
        assert.equal(old.handled, true);
        assert.deepEqual(
          [p.outputContext.a, p.outputContext.x, p.outputContext.y, p.outputContext.status],
          [old.a, old.x, old.y, old.status],
          `${name} ${JSON.stringify(options)} bank${bank}`,
        );
        const writes = new Map(p.byteWrites);
        for (const [address, value] of old.byteWrites) assert.equal(writes.get(address), value);
        assert.ok(p.ioRequests.every((r) => r.address >>> 16 === 0x80));
      }
});
test('Task ADBA: real PHP/PLP preserves CMP carry across shifts and consumes the fresh saved WORD', () => {
  const f = taskTextFixture('ADBA', { minimum: 9, offset: 7, results: [0] }),
    p = prepare('ADBA', f);
  assert.equal(p.handled, true);
  assert.equal(p.adjusted, true);
  const saved = p.accesses.find((e) => e.label === 'ADBA-PHP'),
    restored = p.accesses.find((e) => e.label === 'ADBA-PLP-fresh');
  assert.equal(saved.value & 1, 1);
  assert.equal(restored.value, saved.value);
  assert.ok(
    p.accesses.findIndex((e) => e.label === 'ADBA-PLA-fresh-low') <
      p.accesses.findIndex((e) => e.label === 'ADBA-PHP'),
  );
  assert.equal(word(p, 0x7e20e2), 1);
  assert.equal(word(p, 0x7e20c2), 0x31);
});
test('Task AE4D: fresh second quotient, reset branch and actual AE4C no-op JSL/RTL', () => {
  const f = taskTextFixture('AE4D', { quotients: [0, 7], results: [224] }),
    p = prepare('AE4D', f);
  assert.equal(p.handled, true);
  assert.equal(p.noopCalled, true);
  assert.deepEqual(
    p.ioRequests.filter((r) => r.kind === 'read').map((r) => [r.pc, r.value]),
    [
      [0x81ae73, 0],
      [0x81ae7d, 7],
      [0x81ae94, 224],
    ],
  );
  assert.equal(p.ioRequests.find((r) => r.pc === 0x81ae81).value, 8);
  assert.deepEqual(
    p.accesses.filter((e) => e.label.startsWith('AE4D-JSL')).map((e) => e.value),
    [0x81, 0xae, 0xad],
  );
  assert.deepEqual(
    p.accesses.filter((e) => e.label.startsWith('AE4C-RTL')).map((e) => e.value),
    [0xad, 0xae, 0x81],
  );
  const reset = prepare(
    'AE4D',
    taskTextFixture('AE4D', { height: 4, quotients: [1], results: [2] }),
  );
  assert.equal(reset.handled, true);
  assert.equal(reset.newlineReset, true);
  assert.ok(!reset.ioRequests.some((r) => r.pc === 0x81ae7d));
  assert.equal(reset.ioRequests.find((r) => r.pc === 0x81ae78).value, 0);
});
test('Task text: full indices carry into next data bank; actual saved DBR aliases are reread', () => {
  const f = taskTextFixture('AE14', { x: 65535, width: 0x104, results: [3] }),
    p = prepare('AE14', f);
  assert.equal(p.handled, true);
  assert.equal(p.outputContext.x, 65535);
  assert.equal(word(p, 0x7e00bd), 0x0810);
  assert.ok(p.accesses.some((e) => e.address === 0x7f201f));
  assert.equal(p.ioRequests.find((r) => r.address === 0x804206).value, 2);
  const alias = prepare('AE14', taskTextFixture('AE14', { s: 0xc1, results: [0] }));
  assert.equal(alias.handled, true);
  assert.equal(alias.outputContext.bank, 0);
  assert.equal(word(alias, 0x7e00c0), 0);
  assert.equal(alias.returnTarget, 0x80f509);
});
test('Task text: all source/observation/owner/window/budget failures remain atomic and existing PC admission is strict', () => {
  for (const name of ['AF04', 'ADBA', 'AE14', 'AE4D']) {
    const f = taskTextFixture(name),
      p = prepare(name, f);
    assert.equal(p.handled, true);
    assert.equal(prepare(name, f, { maxWork: p.work - 1 }).reason, 'task_work_budget_required');
    assert.equal(
      prepare(name, f, { maxOutputBytes: p.outputBytes - 1 }).reason,
      'task_output_budget_required',
    );
    assert.equal(
      prepare(name, f, { context: Object.freeze({ ...f.context, programBank: 0x80 }) }).reason,
      'task_context_required',
    );
    assert.equal(
      prepare(name, f, { protectedStackBytes: f.protectedStackBytes.slice(0, 2) }).reason,
      'task_outer_return_required',
    );
    const other = taskTextFixture(name);
    assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
    f.data.seed(0, [1]);
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
    if (name !== 'AF04') {
      assert.equal(
        prepare(name, f, { ioObservations: events([]) }).reason,
        'task_io_observation_required',
      );
      assert.equal(prepare(name, f, { ioMode: null }).reason, 'task_io_mode_required');
      assert.equal(
        prepare(name, f, { context: Object.freeze({ ...f.context, status: 0x4d }) }).reason,
        'task_binary_arithmetic_required',
      );
      assert.equal(
        prepare(name, f, {
          ioObservations: events(
            f.ioObservations.map((o, n) => (n ? o : { ...o, address: o.address + 1 })),
          ),
        }).reason,
        'task_io_observation_required',
      );
      assert.equal(
        prepare(name, f, {
          ioObservations: events(f.ioObservations.map((o, n) => (n ? o : { ...o, pc: 0x80f609 }))),
        }).reason,
        'task_io_observations_required',
      );
    }
    assert.equal(
      prepare(
        name,
        taskTextFixture(name, {
          writeWindows: [
            [0x7e0000, 0x7e06fe],
            [0x7e0703, 0x7fffff],
          ],
        }),
      ).reason,
      'render_write_window_required',
    );
  }
  const f = taskTextFixture('AF04'),
    incomplete = taskTextFixture('AF04');
  // A separate provider with one missing high source byte still fails after private stores.
  const missing = incomplete.data.snapshot().bytes.filter(([address]) => address !== 0x9d9001);
  const data = createRenderData({ writeWindows: [[0x7e0000, 0x7fffff]] });
  for (const [address, value] of missing) data.seed(address, [value]);
  assert.equal(prepare('AF04', { ...f, data }).reason, 'render_source_required');
});
test('Task AEC8: zero/full indices, fresh eight row WORDs, wrapping Y/bank carries match original equations', () => {
  for (const options of [
    {},
    { maskIndex: 0 },
    { maskIndex: 0x8000 },
    { maskIndex: 65535 },
    { maskCursor: 0xfff0 },
    { maskCursor: 0xfffe },
  ]) {
    const f = taskTextFixture('AEC8', options),
      p = prepare('AEC8', f);
    assert.equal(p.handled, true);
    assert.equal(p.visits, options.maskIndex === 0 ? 0 : 8);
    const old = prepareRenderAEC8({
      data: f.data,
      bank: f.context.bank,
      status: f.context.status,
      y: f.context.y,
      emulation: 0,
      directPage: 0,
      stackWindow: [0x1f00, 0x1fff],
    });
    assert.equal(old.handled, true);
    assert.deepEqual(
      [p.outputContext.a, p.outputContext.x, p.outputContext.y, p.outputContext.status],
      [old.a, old.x, old.y, old.status],
    );
    const writes = new Map(p.byteWrites);
    for (const [address, value] of old.byteWrites) assert.equal(writes.get(address), value);
    if (options.maskIndex === 65535) assert.ok(p.accesses.some((e) => e.address === 0x82ac8b));
    if (options.maskCursor === 0xfff0) assert.ok(p.accesses.some((e) => e.address === 0x7f2adc));
  }
});
test('Task AEF4/AEFC/ACC3/ACC9: real requests, chronological polls, actual nested RTL and observed zero', () => {
  for (const name of ['AEF4', 'AEFC', 'ACC3', 'ACC9'])
    for (const counter of [0, 65535]) {
      const f = taskTextFixture(name, { counter, waitValues: [65535, 7, 0] }),
        p = prepare(name, f);
      assert.equal(p.handled, true);
      assert.equal(p.polls, 3);
      assert.equal(p.outputContext.a, 0);
      assert.equal(p.outputContext.x, 2);
      assert.equal(p.outputContext.y, 0xabcd);
      assert.equal(p.outputContext.status, 0x47);
      assert.equal(p.returnTarget, 0x80f509);
      assert.equal(p.outputContext.s, 0x702);
      const first = name === 'AEF4' || name === 'ACC3',
        old = oldWaits['prepareRender' + name]({
          data: f.data,
          bank: f.context.bank,
          status: f.context.status,
          x: 2,
          y: 0xabcd,
          emulation: 0,
          directPage: 0,
          stackWindow: [0x1f00, 0x1fff],
          waitMode: 'record-observations',
          [first ? 'waitRead01FA' : 'waitRead01FC']: [65535, 7, 0],
        });
      assert.equal(old.handled, true);
      assert.deepEqual([p.outputContext.a, p.outputContext.status], [old.a, old.status]);
      const writes = new Map(p.byteWrites);
      for (const [address, value] of old.byteWrites) assert.equal(writes.get(address), value);
      if (name.startsWith('AE'))
        assert.deepEqual(
          p.accesses.filter((e) => e.label.startsWith('text-wait-JSL')).map((e) => e.value),
          [0x81, first ? 0xae : 0xaf, first ? 0xfa : 2],
        );
    }
});
test('Task text waits: return alias, missing/mutable/unused/wrong observations and last budget fail without effects', () => {
  assert.equal(
    prepare('AEF4', taskTextFixture('AEF4', { s: 0x1fd, waitValues: [0] })).reason,
    'task_native_helper_return_required',
  );
  assert.equal(
    prepare('AEFC', taskTextFixture('AEFC', { s: 0x1ff, waitValues: [0] })).reason,
    'task_native_helper_return_required',
  );
  for (const name of ['AEF4', 'AEFC', 'ACC3', 'ACC9']) {
    const f = taskTextFixture(name),
      p = prepare(name, f);
    assert.equal(p.handled, true);
    assert.equal(
      prepare(name, f, { waitObservations: events([]) }).reason,
      'task_wait_observation_required',
    );
    assert.equal(prepare(name, f, { waitMode: null }).reason, 'task_wait_mode_required');
    assert.equal(
      prepare(name, f, { waitObservations: [...f.waitObservations] }).reason,
      'task_wait_observations_required',
    );
    assert.equal(
      prepare(name, f, { waitObservations: events([...f.waitObservations, f.waitObservations[1]]) })
        .reason,
      'task_wait_observation_unused',
    );
    assert.equal(
      prepare(name, f, {
        waitObservations: events(f.waitObservations.map((o) => ({ ...o, address: o.address + 1 }))),
      }).reason,
      'task_wait_observation_required',
    );
    assert.equal(prepare(name, f, { maxWork: p.work - 1 }).reason, 'task_work_budget_required');
    assert.equal(
      prepare(name, f, { maxOutputBytes: p.outputBytes - 1 }).reason,
      'task_output_budget_required',
    );
  }
});
