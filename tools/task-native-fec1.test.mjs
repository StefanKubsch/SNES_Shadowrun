import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeFEC1 } from '../proof/task/native-fec1.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { prepareRenderFEC1 } from '../proof/render/notice-fec1.mjs';
import { noticeEntry } from './render-fec1-fixtures.mjs';
import { heldWord } from './render-be6d-fixtures.mjs';
import { taskFEC1Fixture } from './task-native-fec1-fixtures.mjs';
const freeze = (values) => Object.freeze(values.map((o) => Object.freeze(o)));
const prepare = (f, patch = {}) => {
  const before = f.data.snapshot(),
    p = prepareTaskNativeFEC1({ ...f, ...patch });
  assert.deepEqual(f.data.snapshot(), before);
  return p;
};
const word = (p, address) => {
  const m = new Map(p.byteWrites);
  return m.get(address) | (m.get(address + 1) << 8);
};
function compareOld(f, options = {}) {
  const p = prepare(f);
  assert.equal(p.handled, true, JSON.stringify(p));
  const old = prepareRenderFEC1({
    ...noticeEntry,
    data: f.data,
    bank: f.context.bank,
    status: f.context.status,
    x: f.context.x,
    y: f.context.y,
    stackWindow: [0x1f00, 0x1fff],
    maxWork: 10000000,
    maxOutputBytes: 1000000,
    divisionMode: 'stable-native',
    ioRead2134: f.ioObservations
      .filter((o) => o.pc === 0x80fa01 || o.pc === 0x80fa19)
      .map((o) => o.value),
    waitRead01F6: f.waitObservations.filter((o) => o.pc === 0x81acbd).map((o) => o.value),
    waitRead01F8: f.waitObservations.filter((o) => o.pc === 0x81acaf).map((o) => o.value),
    waitRead01FA: f.waitObservations.filter((o) => o.pc === 0x81acc3).map((o) => o.value),
    waitRead01FC: f.waitObservations.filter((o) => o.pc === 0x81acc9).map((o) => o.value),
    ...options,
  });
  assert.equal(old.handled, true, JSON.stringify(old));
  assert.deepEqual(
    [
      p.outcome,
      p.allocation,
      p.slot,
      p.visits,
      p.outputContext.a,
      p.outputContext.x,
      p.outputContext.y,
      p.outputContext.bank,
      p.outputContext.status,
    ],
    [old.outcome, old.allocation, old.slot, old.visits, old.a, old.x, old.y, old.bank, old.status],
  );
  const writes = new Map(p.byteWrites);
  for (const [address, value] of old.byteWrites)
    assert.equal(writes.get(address), value, `@${address.toString(16)}`);
  return p;
}
test('Whole Task FEC1: all first-signedfree6/4/2/0 masks, actual allocation/minimum/return bytes and one commit', () => {
  for (let mask = 0; mask < 15; mask++) {
    const occupied = Array.from({ length: 4 }, (_, i) => (mask & (1 << i) ? 4 : 0x8000)),
      f = taskFEC1Fixture({ occupied }),
      p = compareOld(f);
    const selected = [3, 2, 1, 0].find((i) => !(mask & (1 << i))) * 2;
    assert.equal(p.slot, selected);
    assert.equal(p.returnTarget, 0x80f509);
    assert.equal(p.outputContext.s, 0x701);
    assert.deepEqual(
      p.calls.map((c) => c.target),
      [0x80f963, 0x80fe69],
    );
    assert.equal(word(p, 0x7e0216 + selected), 2);
    assert.equal(word(p, 0x7e021e + selected), 60);
    assert.ok(p.accesses.some((e) => e.label === 'FEC1-allocation-PHA-high'));
    assert.ok(p.accesses.some((e) => e.label === 'FEC1-allocation-PLA-fresh-low'));
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  }
});
test('Whole Task FEC1: unsigned minimum, last equality and full-slot replacement preserve real PHX/PLX/FA3E calls', () => {
  for (const lifetimes of [
    [60, 60, 60, 60],
    [65535, 65535, 65535, 65535],
    [0, 65535, 32768, 1],
    [32768, 32767, 65535, 32768],
    [10, 10, 9, 9],
    [5, 4, 3, 2],
  ]) {
    const f = taskFEC1Fixture({ occupied: [4, 4, 4, 4], lifetimes }),
      p = compareOld(f);
    assert.equal(p.slot, lifetimes.indexOf(Math.min(...lifetimes)) * 2);
    assert.equal(p.visits, 4);
    assert.deepEqual(
      p.calls.map((c) => c.target),
      [0x80f963, 0x80fe69, 0x80fa3e],
    );
    assert.ok(p.accesses.some((e) => e.label === 'FEC1-slot-PHX-high'));
    assert.ok(p.accesses.some((e) => e.label === 'FEC1-slot-PLX-fresh-low'));
    assert.equal(p.waitObservationsUsed, 11);
  }
});
test('Whole Task FEC1: active allocation/text/replacement uses one cumulative chronological device/wait stream', () => {
  const f = taskFEC1Fixture({
      cursor: 0,
      occupied: [4, 4, 4, 4],
      activeAF1F: true,
      waitF6: [3, 0],
      waitF8: [8, 0],
      waitFC: [5, 0],
      waitFA: [6, 0],
      waitReplacement: [9, 0],
    }),
    p = compareOld(f);
  assert.equal(p.allocated.outcome, 'allocation_prepared');
  assert.equal(p.allocation, 2);
  assert.equal(p.observationsUsed, 9);
  assert.equal(p.waitObservationsUsed, 18);
  assert.deepEqual(
    p.waitEvents.map((o) => o.pc),
    [
      0x81acbd,
      0x81acbd,
      0x81acaf,
      0x81acaf,
      0x81acc9,
      0x81acc9,
      ...Array(8).fill(0x81acc9),
      0x81acc3,
      0x81acc3,
      0x81acaf,
      0x81acaf,
    ],
  );
  const observed = prepare(
    taskFEC1Fixture({
      cursor: 0,
      occupied: [4, 4, 4, 4],
      activeAF1F: true,
      afValues: [2, 7, 5, 1, 3, 4],
    }),
  );
  assert.equal(observed.handled, true);
  assert.deepEqual(
    [
      observed.calls[2].result.render.conversion.af1f.firstVisits,
      observed.calls[2].result.render.conversion.af1f.middleVisits,
    ],
    [2, 2],
  );
});
test('Whole Task FEC1: exact0400 gate, selector WORD-ASL wrap/bankcarry and caller-bank owners stay fresh', () => {
  for (const input of [0, 0x3ff, 0x400, 0x401, 65535]) {
    const f = taskFEC1Fixture();
    heldWord(f.data, 8, input);
    heldWord(f.data, 0x202, 0xbeef);
    const p = compareOld(f);
    if (input === 0x400) {
      assert.equal(word(p, 0x7e0202), 30);
      const reads = p.accesses.findIndex((e) => e.kind === 'read' && e.address === 0x800204);
      assert.ok(p.accesses.findIndex((e) => e.kind === 'write' && e.address === 0x800202) < reads);
    } else assert.equal(new Map(p.byteWrites).has(0x7e0202), false);
  }
  for (const selector of [0, 1, 0x7fff, 0x8000, 65535]) {
    const f = taskFEC1Fixture(),
      address = 0x80d9b8 + ((selector << 1) & 65535);
    heldWord(f.data, 10, selector);
    heldWord(f.data, address, 0x10);
    const p = compareOld(f);
    assert.ok(p.accesses.some((e) => e.kind === 'read' && e.address === address));
  }
  for (const bank of [0, 1, 0x7e, 0x7f, 0x80, 0x81]) compareOld(taskFEC1Fixture({ bank }));
});
test('Whole Task FEC1: saved allocation is actual freshly pulled WORD, not callee scratch or a cached input', () => {
  for (const allocation of [0, 1, 2, 0x8000, 65535]) {
    const f = taskFEC1Fixture();
    heldWord(f.data, 0, allocation);
    if (allocation !== 2) {
      for (const [field, value] of [
        [0x2020, 4],
        [0x2040, 3],
        [0x2060, 0],
        [0x20c0, 0],
        [0x20e0, 0],
        [0x2100, 0],
        [0x2140, 0],
      ])
        heldWord(f.data, 0x7e0000 + field + allocation, value);
    }
    const p = prepare(f);
    if (p.handled) {
      assert.equal(p.allocation, allocation);
      assert.equal(
        p.outputContext.status & 0x82,
        allocation & 32768 ? 128 : allocation === 0 ? 2 : 0,
      );
    } else
      assert.ok(
        [
          'render_source_required',
          'task_work_budget_required',
          'task_stack_alias_required',
        ].includes(p.reason),
        p.reason,
      );
  }
  const f = taskFEC1Fixture({ occupied: [4, 4, 4, 4] }),
    p = compareOld(f);
  assert.equal(word(p, 0x7e0000), 4);
  assert.equal(p.allocation, 2);
});
test('Whole Task FEC1: every missing/wrong/extra device or poll observation rejects all earlier helper effects', () => {
  const f = taskFEC1Fixture({ cursor: 0, occupied: [4, 4, 4, 4], activeAF1F: true });
  assert.equal(prepare(f).handled, true);
  for (let n = 0; n < f.ioObservations.length; n++) {
    const values = freeze(f.ioObservations.filter((_, i) => i !== n)),
      p = prepare(f, { ioObservations: values });
    assert.equal(p.reason, 'task_io_observation_required');
  }
  for (let n = 0; n < f.waitObservations.length; n++) {
    const values = freeze(f.waitObservations.filter((_, i) => i !== n)),
      p = prepare(f, { waitObservations: values });
    assert.equal(p.reason, 'task_wait_observation_required');
  }
  assert.equal(
    prepare(f, { waitObservations: freeze([...f.waitObservations, f.waitObservations.at(-1)]) })
      .reason,
    'task_wait_observation_unused',
  );
  assert.equal(
    prepare(f, { ioObservations: freeze([...f.ioObservations, f.ioObservations.at(-1)]) }).reason,
    'task_io_observation_unused',
  );
  assert.equal(
    prepare(f, { waitObservations: [...f.waitObservations] }).reason,
    'task_wait_observations_required',
  );
  assert.equal(
    prepare(f, { ioObservations: [...f.ioObservations] }).reason,
    'task_io_observations_required',
  );
});
test('Whole Task FEC1: late highbytes/slots/returns, real stack/window/budget/owner failures remain atomic', () => {
  const f = taskFEC1Fixture({ cursor: 0, occupied: [4, 4, 4, 4], activeAF1F: true }),
    p = prepare(f);
  assert.equal(p.handled, true);
  assert.equal(prepare(f, { maxWork: p.work - 1 }).reason, 'task_work_budget_required');
  assert.equal(
    prepare(f, { maxOutputBytes: p.outputBytes - 1 }).reason,
    'task_output_budget_required',
  );
  const other = taskFEC1Fixture();
  assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
  f.data.seed(0, [1]);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  for (const omit of [0x80d9b9, 0x7e021d, 0x7e0225, 0x9d8011]) {
    const missing = prepare(
      taskFEC1Fixture({ omit, ...(omit === 0x7e0225 ? { occupied: [4, 4, 4, 4] } : {}) }),
    );
    assert.equal(missing.reason, 'render_source_required');
    assert.equal(missing.address, omit);
  }
  assert.equal(
    prepare(
      taskFEC1Fixture({
        writeWindows: [
          [0x7e0000, 0x7e01fa],
          [0x7e01fd, 0x7fffff],
        ],
      }),
    ).reason,
    'render_write_window_required',
  );
  for (const s of [0xd, 0xcf, 0x209]) {
    const p = prepare(taskFEC1Fixture({ s, occupied: [4, 4, 4, 4] }));
    assert.equal(p.handled, false);
    assert.ok(
      [
        'task_native_helper_return_required',
        'task_stack_alias_required',
        'task_text_word_mode_required',
        'render_source_required',
        'task_work_budget_required',
      ].includes(p.reason),
      p.reason,
    );
  }
});
