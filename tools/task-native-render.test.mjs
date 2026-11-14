import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeF963 } from '../proof/task/native-f963.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskRenderFixture } from './task-native-render-fixtures.mjs';
import { prepareRenderF963 } from '../proof/render/allocate-f963.mjs';
const word = (p, address) => {
  const m = new Map(p.byteWrites);
  return m.get(address) | (m.get(address + 1) << 8);
};
const events = (values) => Object.freeze(values.map((v) => Object.freeze(v)));
function prepare(f, patch = {}) {
  const before = f.data.snapshot(),
    p = prepareTaskNativeF963({ ...f, ...patch });
  assert.deepEqual(f.data.snapshot(), before);
  return p;
}

test('Task F963: complete allocation and exact mixed inner/outer physical return chronology', () => {
  const f = taskRenderFixture(),
    p = prepare(f);
  assert.equal(p.handled, true);
  assert.equal(p.outcome, 'allocation_prepared');
  assert.equal(p.allocationIndex, 2);
  assert.equal(p.rawReturnWord, 0xf508);
  assert.equal(p.outputContext.s, 0x701);
  assert.equal(p.outputContext.programBank, 0x80);
  assert.equal(p.outputContext.pc, 0xf509);
  assert.equal(p.outputContext.bank, 0x80);
  assert.equal(p.outputContext.a, 0);
  assert.equal(p.outputContext.x, 2);
  assert.equal(p.outputContext.y, 0xc8);
  assert.equal(p.outputContext.status, 0x06);
  assert.deepEqual([p.topVisits, p.rows, p.cells, p.bottomVisits, p.resets], [2, 1, 2, 2, 1]);
  assert.equal(word(p, 0x7e0212), 0x2029);
  assert.equal(word(p, 0x7e20a2), 2);
  assert.equal(word(p, 0x7e23e2), 0x2801);
  assert.equal(word(p, 0x7e2424), 0x2827);
  assert.equal(word(p, 0x7e2468), 0xe801);
  assert.deepEqual(
    p.ioRequests.map((r) => [r.kind, r.pc, r.address, r.width, r.value]),
    [
      ['write', 0x80f9ec, 0x80211b, 1, 2],
      ['write', 0x80f9ef, 0x80211b, 1, 0],
      ['write', 0x80f9f6, 0x80211c, 1, 1],
      ['read', 0x80fa01, 0x802134, 2, 2],
    ],
  );
  const banks = p.accesses.filter((e) => e.label === 'F963-JSL-bank').map((e) => e.value);
  assert.deepEqual(banks, [0x80, 0x80, 0x80, 0x81]);
  assert.deepEqual(
    p.accesses.filter((e) => e.label === 'F963-RTL-bank-fresh').map((e) => e.value),
    [0x80, 0x80, 0x81, 0x80],
  );
  assert.equal(p.waitObservationsUsed, 3);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(f.data.readByte(0x7e0212).value, 0x29);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
});
test('Task F963: wrap requires a separately observed second product and keeps first product extent', () => {
  const f = taskRenderFixture({ position: 0x23ff, products: [2, 7] }),
    p = prepare(f);
  assert.equal(p.handled, true);
  assert.equal(p.wrapped, true);
  assert.equal(word(p, 0x7e0212), 0x202e);
  assert.equal(word(p, 0x7e20a2), 2);
  assert.equal(word(p, 0x7e2062), 0x2027);
  assert.deepEqual(
    p.ioRequests.filter((r) => r.kind === 'read').map((r) => [r.pc, r.value]),
    [
      [0x80fa01, 2],
      [0x80fa19, 7],
    ],
  );
  assert.equal(
    prepare(taskRenderFixture({ position: 0x23ff, products: [2] })).reason,
    'task_io_observation_required',
  );
});
test('Task F963: capacity end preserves A/Y and needs no invented device or wait event', () => {
  const f = taskRenderFixture({ cursor: 30, products: [], waitF6: [], waitF8: [] }),
    p = prepare(f, { ioMode: null, waitMode: null });
  assert.equal(p.handled, true);
  assert.equal(p.outcome, 'capacity_end');
  assert.equal(p.outputContext.a, 0xbeef);
  assert.equal(p.outputContext.y, 0xabcd);
  assert.equal(p.outputContext.x, 32);
  assert.equal(p.outputContext.status, 0x47);
  assert.equal(p.byteWrites.length, 0);
  const wrapped = prepare(taskRenderFixture({ cursor: 65534 }));
  assert.equal(wrapped.handled, true);
  assert.equal(wrapped.allocationIndex, 0);
});
test('Task F963: observed wait must be fresh, chronological, complete, frozen and consumed', () => {
  for (const waits of [
    [],
    [{ pc: 0x81acaf, address: 0x8001f8, width: 2, value: 0 }],
    [{ pc: 0x81acbd, address: 0x8001f6, width: 2, value: 1 }],
    [
      { pc: 0x81acbd, address: 0x8001f6, width: 2, value: 0 },
      { pc: 0x81acaf, address: 0x8001f6, width: 2, value: 0 },
    ],
  ]) {
    assert.equal(
      prepare(taskRenderFixture(), { waitObservations: events(waits) }).reason,
      'task_wait_observation_required',
    );
  }
  const f = taskRenderFixture();
  assert.equal(
    prepare(f, { waitObservations: events([...f.waitObservations, { ...f.waitObservations[2] }]) })
      .reason,
    'task_wait_observation_unused',
  );
  assert.equal(
    prepare(f, { waitObservations: [...f.waitObservations] }).reason,
    'task_wait_observations_required',
  );
  assert.equal(prepare(f, { waitMode: null }).reason, 'task_wait_mode_required');
  const p = prepare(taskRenderFixture({ waitF6: [65535, 7, 0], waitF8: [1, 0] }));
  assert.equal(p.handled, true);
  assert.equal(p.waitEvents.length, 5);
});
test('Task F963: high/low return aliases, protected outer bytes, budgets and missing writable stack abort atomically', () => {
  const aliased = prepare(taskRenderFixture({ s: 0x1fa, waitF6: [0] }));
  assert.equal(aliased.reason, 'task_native_helper_return_required');
  const f = taskRenderFixture(),
    p = prepare(f);
  assert.equal(p.handled, true);
  for (const [key, value, reason] of [
    ['maxWork', p.work - 1, 'task_work_budget_required'],
    ['maxOutputBytes', p.outputBytes - 1, 'task_output_budget_required'],
  ]) {
    assert.equal(prepare(f, { [key]: value }).reason, reason);
  }
  assert.equal(
    prepare(f, { protectedStackBytes: [...f.protectedStackBytes, 0x7e06ff] }).reason,
    'task_stack_alias_required',
  );
  const missing = taskRenderFixture({
    writeWindows: [
      [0x7e0000, 0x7e06fe],
      [0x7e0702, 0x7fffff],
    ],
  });
  assert.equal(prepare(missing).reason, 'render_write_window_required');
  assert.equal(
    prepare(taskRenderFixture({ status: 0x4d })).reason,
    'task_binary_arithmetic_required',
  );
  assert.equal(
    prepare(f, { context: Object.freeze({ ...f.context, d: 1 }) }).reason,
    'task_direct_page_zero_required',
  );
  const other = taskRenderFixture();
  assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
  f.data.seed(0, [1]);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
});
test('Task F963: actual WRAM DBR product owner is fresh data, and arithmetic MMIO whitelist stays separate', () => {
  const f = taskRenderFixture({ bank: 0x7e, products: [] });
  f.data.seed(0x7e2134, [2, 0]);
  const p = prepare(f, { ioMode: null, ioObservations: null });
  assert.equal(p.handled, true);
  assert.equal(p.ioRequests, undefined);
  assert.equal(word(p, 0x7e211b), 0x0100);
  assert.equal(new Map(p.byteWrites).get(0x7e211c), 1);
});
test('Task F963: independent existing render equations agree for disjoint valid geometry, flags and fresh product cases', () => {
  for (const options of [
    {},
    { position: 0x23ff, products: [2, 7] },
    { width: 6, height: 4, products: [8] },
    { left: 0, top: 0 },
    { left: 65535, top: 0x8001 },
    { left: 30, top: 25, width: 4, height: 4, products: [4] },
    { width: 3, height: 3, products: [1], status: 0x81 },
    { cursor: 30, products: [], waitF6: [], waitF8: [] },
  ]) {
    const f = taskRenderFixture(options),
      p = prepare(f);
    assert.equal(p.handled, true);
    const old = prepareRenderF963({
      data: f.data,
      bank: f.context.bank,
      status: f.context.status,
      a: f.context.a,
      y: f.context.y,
      emulation: 0,
      directPage: 0,
      stackWindow: [0x1f00, 0x1fff],
      maxWork: f.maxWork,
      maxOutputBytes: f.maxOutputBytes,
      ioMode: 'record-requests',
      ioRead2134: options.products ?? [2],
      waitMode: 'record-observations',
      waitRead01F6: options.waitF6 ?? [1, 0],
      waitRead01F8: options.waitF8 ?? [0],
    });
    assert.equal(old.handled, true);
    assert.deepEqual(
      [p.outputContext.a, p.outputContext.x, p.outputContext.y, p.outputContext.status],
      [old.a, old.x, old.y, old.status],
    );
    const planned = new Map(p.byteWrites);
    for (const [address, value] of old.byteWrites)
      assert.equal(
        planned.get(address),
        value,
        `${JSON.stringify(options)} @${address.toString(16)}`,
      );
  }
});
test('Task F963: WORD extent loops remain unguarded, stack wrap is real, and chronological MMIO mismatches fail atomically', () => {
  assert.equal(
    prepare(taskRenderFixture({ width: 2 }), { maxWork: 1500 }).reason,
    'task_work_budget_required',
  );
  const f = taskRenderFixture({ cursor: 30, products: [], waitF6: [], waitF8: [], s: 65535 }),
    p = prepare(f);
  assert.equal(p.handled, true);
  assert.equal(p.outputContext.s, 1);
  assert.equal(p.outputContext.pc, 0xf509);
  const ordinary = taskRenderFixture();
  for (const patch of [{ pc: 0x80fa19 }, { address: 0x802135 }, { width: 1 }]) {
    assert.equal(
      prepare(ordinary, { ioObservations: events([{ ...ordinary.ioObservations[0], ...patch }]) })
        .reason,
      'task_io_observation_required',
    );
  }
  assert.equal(
    prepare(ordinary, {
      ioObservations: events([...ordinary.ioObservations, ordinary.ioObservations[0]]),
    }).reason,
    'task_io_observation_unused',
  );
  assert.equal(prepare(ordinary, { ioMode: null }).reason, 'task_io_mode_required');
});
