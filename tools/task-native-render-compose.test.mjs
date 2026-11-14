import test from 'node:test';
import assert from 'node:assert/strict';
import * as native from '../proof/task/native-render-compose.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { prepareRenderAD92 } from '../proof/render/compose-ad92.mjs';
import { prepareRenderACCF } from '../proof/render/entry-accf.mjs';
import { prepareRenderACAF, prepareRenderACB5 } from '../proof/render/request-acb5.mjs';
import { createRenderData } from '../src/render/data.mjs';
import { seedWord, getWord } from './render-ad92-fixtures.mjs';
import { taskRenderComposeFixture } from './task-native-render-compose-fixtures.mjs';
const freeze = (values) => Object.freeze(values.map((o) => Object.freeze(o)));
const prepare = (helper, f, patch = {}) => {
  const before = f.data.snapshot(),
    p = native['prepareTaskNative' + helper]({ ...f, ...patch });
  assert.deepEqual(f.data.snapshot(), before);
  return p;
};
const word = (p, address) => {
  const m = new Map(p.byteWrites);
  return m.get(address) | (m.get(address + 1) << 8);
};
function compareOld(helper, f) {
  const p = prepare(helper, f);
  assert.equal(p.handled, true, JSON.stringify(p));
  const c = f.context;
  const old = {
    AD92: prepareRenderAD92,
    ACCF: prepareRenderACCF,
    ACAF: prepareRenderACAF,
    ACB5: prepareRenderACB5,
  }[helper]({
    data: f.data,
    bank: c.bank,
    status: c.status,
    x: c.x,
    y: c.y,
    emulation: 0,
    directPage: 0,
    stackWindow: [0x1f00, 0x1fff],
    maxWork: 10000000,
    maxOutputBytes: 1000000,
    divisionMode: 'stable-native',
    waitMode: 'record-observations',
    waitRead01F8: f.waitObservations.map((o) => o.value),
  });
  assert.equal(old.handled, true, JSON.stringify(old));
  assert.deepEqual(
    [
      p.outputContext.a,
      p.outputContext.x,
      p.outputContext.y,
      p.outputContext.bank,
      p.outputContext.status,
    ],
    [old.a, old.x, old.y, old.bank, old.status],
  );
  const writes = new Map(p.byteWrites);
  for (const [address, value] of old.byteWrites)
    assert.equal(writes.get(address), value, `@${address.toString(16)}`);
  return p;
}
test('Task render roots: independent complete border, WORDwait/request, AD92 and actual typed RTL', () => {
  for (const helper of ['ACAF', 'ACB5', 'ACCF', 'AD92']) {
    const f = taskRenderComposeFixture(helper),
      p = compareOld(helper, f);
    assert.equal(p.returnTarget, 0x80fa66);
    assert.equal(p.outputContext.s, 0x702);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  }
  const f = taskRenderComposeFixture('ACCF'),
    p = prepare('ACCF', f);
  assert.deepEqual([p.topVisits, p.rows, p.cells, p.bottomVisits, p.resets], [2, 1, 2, 2, 1]);
  assert.equal(word(p, 0x7e25a0), 0x2801);
  assert.ok(p.accesses.some((e) => e.label === 'ACCF-PHX-high'));
  assert.ok(p.accesses.some((e) => e.label === 'ACCF-PLX-fresh-low'));
});
test('Task AD92: all inclusive/unsigned/signed list branches, WORDflags and active AF1F use one provider', () => {
  for (const last of [0, 1, 2, 4, 0x8000, 0x8001, 0xfffe, 0xffff]) {
    const p = compareOld('AD92', taskRenderComposeFixture('AD92', { last, flags: [0, 0, 0] }));
    assert.equal(p.visits, last & 32768 ? 0 : Math.floor(last / 2) + 1);
    assert.equal(p.listSkipped, Boolean(last & 32768));
  }
  for (const flag of [1, 0x100, 0x8000, 0xffff]) {
    const p = compareOld(
      'AD92',
      taskRenderComposeFixture('AD92', { first: 3, last: 4, flags: [0, 0, flag] }),
    );
    assert.equal(p.entries, 1);
    assert.equal(p.visits, 3);
  }
  const p = compareOld(
    'AD92',
    taskRenderComposeFixture('AD92', { active: true, last: 4, flags: [1, 1, 1], wait: [5, 0] }),
  );
  assert.equal(p.entries, 3);
  assert.equal(p.waitObservationsUsed, 2);
  assert.equal(p.ioRequests.filter((e) => e.kind === 'read').length, 5);
});
test('Task AD92: fresh output aliases change later flag/bounds and full buffer indices carry into7F', () => {
  const edge = compareOld('AD92', taskRenderComposeFixture('AD92', { positions: [0xfff0] }));
  assert.equal(word(edge, 0x7f2390), 0x2801);
  const flags = taskRenderComposeFixture('AD92', {
    bank: 0x7f,
    last: 2,
    flags: [1, 1],
    positions: [0xde88, 0x400],
  });
  seedWord(flags.data, 0x7f0228, 0);
  const p = compareOld('AD92', flags);
  assert.equal(p.entries, 2);
  assert.equal(word(p, 0x7f0228), 0x2801);
  const bounds = taskRenderComposeFixture('AD92', { bank: 0x7f, positions: [0xde60] });
  seedWord(bounds.data, 0x7f0226 + 0x2802, 0);
  const b = compareOld('AD92', bounds);
  assert.equal(b.entries, 1);
  assert.equal(b.visits, 5122);
  assert.equal(b.outputContext.x, 0x2804);
  const wrapped = taskRenderComposeFixture('AD92', { bank: 0x7f, positions: [0xde60] });
  seedWord(wrapped.data, 0x7e2180, 0xdffe);
  assert.equal(prepare('AD92', wrapped, { maxWork: 160000 }).reason, 'task_work_budget_required');
});
test('Task ACCF: every width/height WORD keeps zero/negative do-loop counts, late work failure is atomic', () => {
  for (const [address, value] of [
    [0x7e2020, 2],
    [0x7e2020, 1],
    [0x7e2040, 2],
    [0x7e2040, 1],
  ]) {
    const f = taskRenderComposeFixture('ACCF');
    seedWord(f.data, address, value);
    assert.equal(
      prepare('ACCF', f, { maxOutputBytes: 1000 }).reason,
      'task_output_budget_required',
    );
  }
  for (const position of [0, 1, 0xfff0])
    for (const base of [0, 0x2027, 0xffff]) {
      const f = taskRenderComposeFixture('ACCF', { positions: [position] });
      seedWord(f.data, 0x7e2060, base);
      seedWord(f.data, 0x7e2080, base);
      compareOld('ACCF', f);
    }
});
test('Task FA3E: source-ordered removal/backscan then entire AD92, real JSL/RTL and outer RTS', () => {
  for (const options of [
    { last: 4, index: 2, flags: [1, 1, 1] },
    { last: 4, index: 4, flags: [1, 0, 1] },
    { last: 4, index: 4, flags: [0, 0, 1] },
    { last: 0, index: 0, flags: [1] },
  ]) {
    const f = taskRenderComposeFixture('FA3E', options),
      p = prepare('FA3E', f);
    assert.equal(p.handled, true, JSON.stringify(p));
    const clone = createRenderData({ writeWindows: [[0x7e0000, 0x7fffff]] });
    for (const [address, value] of f.data.snapshot().bytes) clone.seed(address, [value]);
    let x = options.index;
    seedWord(clone, 0x7e0226 + x, 0);
    if (x === options.last) {
      do {
        x = (x - 2) & 65535;
      } while (!(x & 32768) && getWord(clone, 0x7e0226 + x) === 0);
      x = (x + 2) & 65535;
      seedWord(clone, 0x7e0212, getWord(clone, 0x7e2060 + x));
      x = (x - 2) & 65535;
      seedWord(clone, 0x7e0204, x);
    }
    const old = prepareRenderAD92({
      data: clone,
      bank: 0x80,
      status: 0x45,
      emulation: 0,
      directPage: 0,
      stackWindow: [0x1f00, 0x1fff],
      maxWork: 1000000,
      maxOutputBytes: 1000000,
      divisionMode: 'stable-native',
      waitMode: 'record-observations',
      waitRead01F8: [0],
    });
    assert.equal(old.handled, true);
    const writes = new Map(p.byteWrites);
    for (const [address, value] of old.byteWrites) assert.equal(writes.get(address), value);
    assert.equal(word(p, 0x7e0226 + options.index), 0);
    assert.equal(p.compacted, options.index === options.last);
    if (p.compacted) {
      assert.equal(word(p, 0x7e0204), x);
      assert.equal(word(p, 0x7e0212), getWord(clone, 0x7e0212));
    }
    assert.deepEqual(
      [
        p.outputContext.a,
        p.outputContext.x,
        p.outputContext.y,
        p.outputContext.bank,
        p.outputContext.status,
      ],
      [old.a, old.x, old.y, old.bank, old.status],
    );
    assert.equal(p.returnTarget, 0x80f509);
    assert.equal(p.outputContext.s, 0x701);
  }
});
test('Task render: each actual wait poll is fresh; wrong/missing/unused/mutable samples reject the whole composition', () => {
  for (const helper of ['ACAF', 'ACB5', 'AD92', 'FA3E']) {
    const f = taskRenderComposeFixture(helper, { wait: [0x100, 5, 0] }),
      p = prepare(helper, f);
    assert.equal(p.handled, true);
    assert.equal(p.waitObservationsUsed, 3);
    assert.equal(prepare(helper, f, { waitMode: null }).reason, 'task_wait_mode_required');
    assert.equal(
      prepare(helper, f, { waitObservations: freeze([]) }).reason,
      'task_wait_observation_required',
    );
    assert.equal(
      prepare(helper, f, { waitObservations: [...f.waitObservations] }).reason,
      'task_wait_observations_required',
    );
    assert.equal(
      prepare(helper, f, {
        waitObservations: freeze([...f.waitObservations, f.waitObservations.at(-1)]),
      }).reason,
      'task_wait_observation_unused',
    );
    const wrong = freeze(
      f.waitObservations.map((o, n) => (n ? o : { ...o, address: o.address + 1 })),
    );
    assert.equal(
      prepare(helper, f, { waitObservations: wrong }).reason,
      'task_wait_observation_required',
    );
  }
  const zero = prepare('ACB5', taskRenderComposeFixture('ACB5', { counter: 0xffff }));
  assert.equal(zero.handled, true);
  assert.equal(zero.requestCounter, 0);
  assert.equal(zero.waitObservationsUsed, 1);
});
test('Task render: native inner return aliases, late highbytes/budgets/windows and branded commit failures are atomic', () => {
  for (const helper of ['ACAF', 'ACB5', 'ACCF', 'AD92', 'FA3E']) {
    const f = taskRenderComposeFixture(helper),
      p = prepare(helper, f);
    assert.equal(p.handled, true);
    assert.equal(prepare(helper, f, { maxWork: p.work - 1 }).reason, 'task_work_budget_required');
    assert.equal(
      prepare(helper, f, { maxOutputBytes: p.outputBytes - 1 }).reason,
      'task_output_budget_required',
    );
    const other = taskRenderComposeFixture(helper);
    assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
    f.data.seed(0, [1]);
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  }
  for (const [helper, omit] of [
    ['AD92', 0x7e0205],
    ['AD92', 0x7e2001],
    ['AD92', 0x7e2181],
    ['ACCF', 0x7e2041],
    ['FA3E', 0x7e2061],
  ]) {
    const f = taskRenderComposeFixture(helper, { omit }),
      p = prepare(helper, f);
    assert.equal(p.reason, 'render_source_required');
    assert.equal(p.address, omit);
  }
  for (const helper of ['AD92', 'FA3E']) {
    const p = prepare(
      helper,
      taskRenderComposeFixture(helper, { s: 0xcf, last: 2, index: 0, flags: [1, 1] }),
    );
    assert.equal(p.handled, false);
    assert.ok(
      ['task_native_helper_return_required', 'task_stack_alias_required'].includes(p.reason),
      p.reason,
    );
    const missing = taskRenderComposeFixture(helper, {
      writeWindows: [
        [0x7e0000, 0x7e01f7],
        [0x7e01fa, 0x7fffff],
      ],
    });
    assert.equal(prepare(helper, missing).reason, 'render_write_window_required');
  }
});
