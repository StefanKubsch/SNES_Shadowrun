import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeListPrerequisites as prepare } from '../proof/task/native-list-prerequisites.mjs';
import { taskListFixture, taskListCase } from './task-native-list-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
const word = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const freeze = (v) => Object.freeze(v.map((o) => Object.freeze(o)));
const omit = (f, ...addresses) => {
  const set = new Set(addresses.map(renderAddress)),
    data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes) if (!set.has(a)) data.seed(a, [v]);
  return { ...f, data };
};

test('Own A617: cursor precedes zero gate, all row/page/number branches, zero count wraps and each PHY/PLY is physical', () => {
  const expected = {
    one: [1, 1, 0, false, false],
    more: [1, 1, 0, true, false],
    previous: [1, 1, 0, false, true],
    'zero-count': [2, 1, 0, false, false],
    two: [2, 2, 0, false, false],
    'zero-number': [1, 1, 0, false, false],
    number: [1, 1, 1, false, false],
  };
  const empty = taskListFixture(),
    z = prepared(prepare, empty);
  assert.equal(z.visits, 1);
  assert.equal(z.rows, 0);
  assert.ok(z.ioRequests.some((r) => r.pc === 0x80facd));
  for (const [name, values] of Object.entries(expected)) {
    const f = taskListCase(name),
      p = prepared(prepare, f);
    assert.deepEqual([p.visits, p.rows, p.numbers, p.more, p.previous], values);
    assert.equal(p.rawReturnWord, 0xf508);
    assert.equal(p.returnTarget, 0x80f509);
    assert.equal(p.returnTargetExecuted, false);
    assert.equal(p.outputContext.s, 0x701);
    assert.equal(p.outputContext.bank, f.context.bank);
    assert.equal(p.outputContext.status & 0x30, 0);
    assert.equal(
      p.accesses.filter((a) => a.label === 'list-PHY-low').length,
      p.rows + (p.numbers ? 2 : 0),
    );
    assert.equal(
      p.accesses.filter((a) => a.label === 'list-PLY-fresh-low').length,
      p.rows + (p.numbers ? 2 : 0),
    );
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    if (name === 'zero-count') assert.equal(f.data.readByte(0x801d9f).value, 255);
  }
});

test('Own A617: number pointer and WORD value are refetched after gap text overwrites their physical owner', () => {
  const f = taskListCase('fresh-number-alias'),
    p = prepared(prepare, f);
  assert.equal(p.numbers, 1);
  assert.deepEqual(
    p.accesses
      .filter((a) => a.label === 'text-root-WORD-low' && a.address === 0x7e21a0)
      .map((a) => a.value),
    [65, 0],
  );
  assert.equal(p.accesses.find((a) => a.label === 'FD80-dividend-low').value, 0);
  assert.equal(
    p.accesses.filter((a) => a.label === 'text-root-DP-WORD-low' && a.address === 12).length,
    2,
  );
});

test('Own FAAC: forced local bank80, BYTE operands, chained ADC carry and actual original saved-bank restoration', () => {
  for (const bank of [0x80, 0x7e, 0x7f]) {
    const f = taskListFixture(0x80faac, { bank });
    word(f, 0x7e2062, 65535);
    word(f, 2, 1);
    f.data.seed(4, [255]);
    f.data.seed(0x7e2022, [1]);
    f.ioObservations = freeze([{ pc: 0x80facd, address: 0x804216, width: 2, value: 65535 }]);
    const p = prepared(prepare, omit(f, 5, 0x7e2023));
    assert.deepEqual(
      p.ioRequests.map((r) => [r.kind, r.address, r.width, r.value]),
      [
        ['write', 0x804202, 1, 255],
        ['write', 0x804203, 1, 255],
        ['read', 0x804216, 2, 65535],
      ],
    );
    assert.equal(p.byteWrites.find(([a]) => a === 0x7e20c2)[1], 0);
    assert.equal(p.byteWrites.find(([a]) => a === 0x7e20c3)[1], 0);
    assert.equal(p.outputContext.bank, bank);
    assert.equal(p.outputContext.status & 1, 1);
    assert.equal(p.outputContext.a, 0);
  }
});

test('Own FD80: BYTE remainder, WORD quotient, original forward null-copy and no invented five-digit guard', () => {
  const f = taskListFixture(0x80fd80),
    p = prepared(prepare, f);
  assert.equal(p.divisions, 1);
  assert.equal(p.copiedBytes, 2);
  assert.equal(p.byteWrites.find(([a]) => a === 0x7e21a0)[1], 0x35);
  assert.ok(p.ioRequests.some((r) => r.pc === 0x80fd9e && r.width === 1));
  assert.ok(p.ioRequests.some((r) => r.pc === 0x80fda7 && r.width === 2));
  const five = taskListFixture(0x80fd80);
  five.ioObservations = freeze([
    ...[1234, 123, 12, 1, 0].flatMap((q, n) => [
      { pc: 0x80fd9e, address: 0x804216, width: 1, value: 5 - n },
      { pc: 0x80fda7, address: 0x804214, width: 2, value: q },
    ]),
    ...five.ioObservations.slice(2),
  ]);
  const full = prepared(prepare, five);
  assert.equal(full.divisions, 5);
  assert.equal(full.copiedBytes, 0);
  assert.equal(full.glyphs, 5);
  assert.deepEqual(
    full.byteWrites
      .filter(([a]) => a >= 0x7e21a0 && a <= 0x7e21a4)
      .sort(([a], [b]) => a - b)
      .map(([, v]) => v),
    [49, 50, 51, 52, 53],
  );
  const zeros = taskListFixture(0x80fd80);
  zeros.ioObservations = freeze([
    { pc: 0x80fd9e, address: 0x804216, width: 1, value: 0xd0 },
    { pc: 0x80fda7, address: 0x804214, width: 2, value: 0 },
    ...zeros.ioObservations.slice(2),
  ]);
  zeros.waitObservations = Object.freeze(zeros.waitObservations.slice(0, 9));
  const q = prepared(prepare, zeros);
  assert.equal(q.byteWrites.find(([a]) => a === 0x7e21a4)[1], 0);
  const six = taskListFixture(0x80fd80);
  six.ioObservations = freeze(
    Array.from({ length: 6 }, (_, n) => [
      { pc: 0x80fd9e, address: 0x804216, width: 1, value: 5 },
      { pc: 0x80fda7, address: 0x804214, width: 2, value: n === 5 ? 0 : 1 },
    ]).flat(),
  );
  // At Xffff, the original forward copy writes ahead of its next source.
  // Its preserved alias can propagate indefinitely; only the work limit stops it.
  unchangedFailure(prepare, six, { maxWork: 1000 }, 'task_work_budget_required');
});

test('Whole own list helpers: all source highbytes, exact limits, chronological records and actual inner return aliases fail atomically', () => {
  for (const entry of [0x80a617, 0x80a5db, 0x80a5f9, 0x80faac, 0x80fd80]) {
    const f = taskListFixture(entry),
      p = prepared(prepare, f);
    unchangedFailure(prepare, omit(f, 0x700), {}, 'render_source_required');
    unchangedFailure(prepare, omit(f, 0x701), {}, 'render_source_required');
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
    unchangedFailure(
      prepare,
      f,
      { ioObservations: Object.freeze([...f.ioObservations, f.ioObservations.at(-1)]) },
      'task_io_observation_unused',
    );
    unchangedFailure(
      prepare,
      f,
      { context: Object.freeze({ ...f.context, status: 8 }) },
      'task_binary_arithmetic_required',
    );
  }
  const alias = taskListFixture(0x80fd80, { s: 0xd4 });
  // FB39's fresh DPD2 index stores overwrite its actual FDCC return WORD.
  const badReturn = unchangedFailure(prepare, alias, {}, 'task_native_helper_return_required');
  assert.equal(badReturn.pc, 0x80fdca);
  assert.equal(badReturn.raw, 1);
  const f = taskListCase('number');
  unchangedFailure(prepare, omit(f, 0x801901), {}, 'render_source_required');
  unchangedFailure(prepare, omit(f, 10), {}, 'render_source_required');
  unchangedFailure(
    prepare,
    f,
    { waitObservations: Object.freeze(f.waitObservations.slice(0, -1)) },
    'task_wait_observation_required',
  );
  unchangedFailure(
    prepare,
    f,
    { waitObservations: Object.freeze(Array(1)) },
    'task_wait_observations_required',
  );
});
