import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeAF1F } from '../proof/task/native-af1f.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { renderAF1F } from '../proof/render/af1f.mjs';
import { prepareRenderView } from '../src/render/data.mjs';
import { taskAF1FFixture } from './task-native-af1f-fixtures.mjs';
const prepare = (f, patch = {}) => {
  const before = f.data.snapshot(),
    p = prepareTaskNativeAF1F({ ...f, ...patch });
  assert.deepEqual(f.data.snapshot(), before);
  return p;
};
const word = (p, address) => {
  const m = new Map(p.byteWrites);
  return m.get(address) | (m.get(address + 1) << 8);
};
const events = (values) => Object.freeze(values.map((o) => Object.freeze(o)));
test('Task AF1F: full active graph has actual observed reads, real PHX/PLX/RTL and one commit', () => {
  const f = taskAF1FFixture(),
    p = prepare(f);
  assert.equal(p.handled, true);
  assert.equal(p.outcome, 'af1f_active');
  assert.deepEqual([p.firstVisits, p.middleVisits, p.tableOffset], [3, 3, 50]);
  assert.equal(p.outputContext.x, 14);
  assert.equal(p.outputContext.y, 1);
  assert.equal(p.returnTarget, 0x81a9df);
  assert.equal(p.outputContext.s, 0x702);
  assert.equal(p.outputContext.bank, 0x80);
  assert.deepEqual(
    p.ioRequests.filter((r) => r.kind === 'read').map((r) => [r.pc, r.width, r.value]),
    [
      [0x81af56, 2, 3],
      [0x81af73, 2, 1],
      [0x81afc9, 2, 3],
      [0x81afce, 2, 1],
      [0x81afec, 2, 0],
      [0x81b009, 2, 14],
    ],
  );
  assert.deepEqual(
    p.ioRequests.filter((r) => r.kind === 'write').map((r) => [r.pc, r.width, r.value]),
    [
      [0x81af32, 2, 61],
      [0x81af39, 1, 20],
      [0x81afab, 2, 61],
      [0x81afb2, 1, 20],
      [0x81afd9, 2, 14],
      [0x81afe0, 1, 20],
    ],
  );
  assert.deepEqual(
    p.accesses.filter((e) => e.label.startsWith('AF1F-PHX')).map((e) => e.value),
    [0, 14],
  );
  assert.deepEqual(
    p.accesses.filter((e) => e.label.startsWith('AF1F-PLX-fresh')).map((e) => e.value),
    [14, 0],
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
});
test('Task AF1F: stable synthetic samples compare independently with existing overlay equations on all last branches', () => {
  for (const row of [20, 21, 40, 60, 61, 100, 199])
    for (const parameter of [0, 1, 5, 10, 11, 19, 20, 40]) {
      const q = Math.floor(row / 20),
        r = row % 20,
        third = parameter + (r ? 9 : 19),
        q3 = Math.floor(third / 20),
        r3 = third % 20;
      if (q < q3) continue;
      const values = [q, r, q, r, q3, ...(r === 0 && parameter === 0 ? [] : [r3])],
        f = taskAF1FFixture({ row, parameter, values }),
        p = prepare(f);
      assert.equal(p.handled, true, JSON.stringify(p));
      const view = prepareRenderView(f.data),
        budget = { work: 0, maxWork: 1000000, maxOutputBytes: 1000000 };
      const old = renderAF1F(
          view,
          { x: f.context.x, y: f.context.y, carry: 1, overflow: 1 },
          budget,
          'stable-native',
        ),
        oldPlan = view.finish(old);
      assert.deepEqual(
        [
          p.outputContext.a,
          p.outputContext.x,
          p.outputContext.y,
          p.outputContext.status & 1,
          (p.outputContext.status >>> 6) & 1,
        ],
        [old.a, old.x, old.y, old.carry, old.overflow],
      );
      assert.equal(p.firstVisits, q);
      assert.equal(p.middleVisits, q - q3);
      const writes = new Map(p.byteWrites);
      for (const [address, value] of oldPlan.byteWrites) assert.equal(writes.get(address), value);
    }
});
test('Task AF1F: non-equational first/second/third hardware samples remain separately fresh', () => {
  const f = taskAF1FFixture({ row: 61, parameter: 5, values: [2, 7, 5, 1, 3, 4] }),
    p = prepare(f);
  assert.equal(p.handled, true);
  assert.deepEqual([p.firstVisits, p.middleVisits, p.tableOffset], [2, 2, 30]);
  assert.equal(word(p, 0x7e00a2), 5);
  assert.equal(word(p, 0x7e00a5), 1);
  assert.equal(p.ioRequests.filter((r) => r.kind === 'read')[2].value, 5);
  assert.equal(p.ioRequests.filter((r) => r.kind === 'read')[4].value, 3);
  const skip = prepare(taskAF1FFixture({ row: 60, parameter: 0, values: [3, 0, 3, 0, 0] }));
  assert.equal(skip.handled, true);
  assert.equal(skip.tableOffset, null);
  assert.equal(skip.ioRequests.filter((r) => r.kind === 'read').length, 5);
  assert.equal(skip.outputContext.a, 0);
});
test('Task AF1F: zero/negative gates use no device events and preserve observed original C/V and return bytes', () => {
  for (const options of [{ firstGate: 0 }, { secondGate: 0x8001 }]) {
    const f = taskAF1FFixture({ ...options, values: [] }),
      p = prepare(f, { ioMode: null });
    assert.equal(p.handled, true);
    assert.equal(p.ioRequests.length, 0);
    assert.equal(p.outputContext.x, 0xfffe);
    assert.equal(p.outputContext.y, 0xabcd);
    assert.equal(p.outputContext.status & 0x41, 0x41);
    assert.equal(p.byteWrites.length, 0);
    assert.equal(p.returnTarget, 0x81a9df);
  }
});
test('Task AF1F: full zero/negative WORD loop counts need budgets, no clipping or invented hardware equation', () => {
  assert.equal(
    prepare(taskAF1FFixture({ values: [0, 0, 3, 0, 0] }), { maxOutputBytes: 1000 }).reason,
    'task_output_budget_required',
  );
  assert.equal(
    prepare(taskAF1FFixture({ values: [1, 0, 1, 0, 2] }), { maxOutputBytes: 1000 }).reason,
    'task_output_budget_required',
  );
  const f = taskAF1FFixture(),
    p = prepare(f);
  assert.equal(prepare(f, { maxWork: p.work - 1 }).reason, 'task_work_budget_required');
  assert.equal(
    prepare(f, { maxOutputBytes: p.outputBytes - 1 }).reason,
    'task_output_budget_required',
  );
});
test('Task AF1F: late missing/extra/wrong observation, source highbytes, windows, modes and owner failures are atomic', () => {
  const f = taskAF1FFixture(),
    p = prepare(f);
  assert.equal(p.handled, true);
  assert.equal(
    prepare(f, { ioObservations: events(f.ioObservations.slice(0, -1)) }).reason,
    'task_io_observation_required',
  );
  assert.equal(
    prepare(f, { ioObservations: events([...f.ioObservations, f.ioObservations.at(-1)]) }).reason,
    'task_io_observation_unused',
  );
  for (const patch of [{ pc: 0x81b016 }, { address: 0x804215 }, { width: 1 }]) {
    assert.equal(
      prepare(f, {
        ioObservations: events(f.ioObservations.map((o, n) => (n === 0 ? { ...o, ...patch } : o))),
      }).reason,
      'task_io_observation_required',
    );
  }
  assert.equal(
    prepare(f, { context: Object.freeze({ ...f.context, status: 0x4d }) }).reason,
    'task_binary_arithmetic_required',
  );
  assert.equal(
    prepare(f, { protectedStackBytes: [...f.protectedStackBytes, 0x7e06ff] }).reason,
    'task_stack_alias_required',
  );
  const other = taskAF1FFixture();
  assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
  f.data.seed(0, [1]);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  const alias = prepare(taskAF1FFixture({ s: 0xa9 }));
  assert.equal(alias.handled, true);
  for (const omit of [0x7e3c01, 0x8db8d3, 0x7e33df, 0x81b059]) {
    const p = prepare(taskAF1FFixture({ omit }));
    assert.equal(p.reason, 'render_source_required');
    assert.equal(p.address, omit);
  }
  assert.equal(
    prepare(
      taskAF1FFixture({
        writeWindows: [
          [0x7e0000, 0x7e06fe],
          [0x7e0703, 0x7fffff],
        ],
      }),
    ).reason,
    'render_write_window_required',
  );
});
test('Task AF1F: original full table index can carry/wrap, discarded high input bytes remain actual reads, WRAM registers stay data', () => {
  const f = taskAF1FFixture({ row: 0xab3d, parameter: 0xab05 }),
    p = prepare(f);
  assert.equal(p.handled, true);
  assert.equal(p.ioRequests.find((r) => r.pc === 0x81af32).value, 61);
  assert.equal(word(p, 0x7e00a8), 5);
  const wrap = taskAF1FFixture({ parameter: 11, values: [3, 1, 3, 1, 0, 0x8001] });
  wrap.data.seed(0x81b028, [0x34, 0x12]);
  const q = prepare(wrap);
  assert.equal(q.handled, true);
  assert.equal(q.tableOffset, 2);
  assert.equal(q.outputContext.status & 1, 1);
  assert.equal(q.outputContext.a, 0x1234);
  const carry = taskAF1FFixture({ parameter: 11, values: [3, 1, 3, 1, 0, 0xffff] });
  carry.data.seed(0x82b024, [0xcd, 0xab]);
  const c = prepare(carry);
  assert.equal(c.handled, true);
  assert.equal(c.tableOffset, 65534);
  assert.ok(c.accesses.some((e) => e.address === 0x82b024));
  const ram = taskAF1FFixture({ bank: 0x7e, values: [] });
  ram.data.seed(0x7e4214, [3, 0]);
  ram.data.seed(0x7e4216, [1, 0]);
  const r = prepare(ram, { ioMode: null, ioObservations: null });
  assert.equal(r.handled, true);
  assert.equal(r.ioRequests, undefined);
  assert.equal(new Map(r.byteWrites).get(0x7e4206), 20);
  assert.ok(r.accesses.some((e) => e.address === 0x7e4214));
});
