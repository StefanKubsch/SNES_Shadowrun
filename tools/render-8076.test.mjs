import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpuToOffset } from './rom.mjs';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { advancePaletteCycles } from '../proof/render/palette-cycles-equations.mjs';
import { prepareRender8076 } from '../proof/render/palette-update-8076.mjs';
import { render80C4 } from '../proof/render/palette-80c4.mjs';

const entry = {
  bank: 0x80,
  status: 0xc5,
  x: 0xbeef,
  y: 0xcafe,
  emulation: 0,
  directPage: 0,
  stackWindow: [0x1f00, 0x1fff],
};
const windows = [
  [0x7e1cc2, 0x7e1cc5],
  [0x7e1cd6, 0x7e1cdd],
];
const seed = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const word = (data, address) =>
  data.readByte(address).value | (data.readByte(address + 1).value << 8);
const prepare = (data, opts = {}) => prepareRender8076({ ...entry, data, ...opts });
function fixture({
  first = {},
  second = {},
  bank = 0x80,
  writeWindows = windows,
  omit = null,
} = {}) {
  const data = createRenderData({ writeWindows }),
    base = bank * 65536;
  for (const [x, slot] of [
    [0, first],
    [2, second],
  ]) {
    const f = { gate: 1, progress: 127, direction: 0, index: 2, count: 8, table: 0x4000, ...slot };
    for (const [key, offset] of [
      ['gate', 0x1cbe],
      ['progress', 0x1cc2],
      ['direction', 0x1cc6],
      ['index', 0x1cd6],
      ['count', 0x1cd2],
      ['table', 0x1cce],
    ])
      if (f[key] !== null) {
        for (let j = 0; j < 2; j++)
          if (base + offset + x + j !== omit)
            data.seed(base + offset + x + j, [(f[key] >>> (8 * j)) & 255]);
      }
  }
  return data;
}
const commit = (data, plan) => {
  assert.ok(plan.handled, JSON.stringify(plan));
  assert.deepEqual(data.commit(plan), { handled: true });
};
function unchanged(data, opts, reason) {
  const before = data.snapshot(),
    p = prepare(data, opts);
  assert.equal(p.handled, false);
  assert.equal(p.reason, reason);
  for (const k of ['operations', 'ioWrites', 'byteWrites']) assert.equal(p[k], undefined);
  assert.deepEqual(data.snapshot(), before);
  return p;
}
const sparse = { progress: null, direction: null, index: null, count: null, table: null };

test('8076 probe source is the original78/34 writer with a closed WORD graph, separate from synthetic bytes', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const source = JSON.parse(
    await readFile(new URL('../analysis/render-80c4.json', import.meta.url)),
  );
  const report = JSON.parse(
    await readFile(new URL('../analysis/render-8076-native.json', import.meta.url)),
  );
  const raw = rom.subarray(cpuToOffset(0x818076, rom.length), cpuToOffset(0x8180c4, rom.length));
  assert.equal(raw.length, 78);
  assert.equal(
    createHash('sha256').update(raw).digest('hex'),
    'c030407784acaf7463b644f50cd08c1f054835a6994ad0f19beeca96c3ca6240',
  );
  assert.deepEqual(
    report.source,
    source.windows.find((w) => w.name === 'requestAdvance8076'),
  );
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase());
  const proof = source.owners.proofs.find((p) => p.name === 'requestAdvance8076').proof;
  assert.equal(proof.reachable_instructions, 34);
  assert.equal(proof.external_return_assumptions, 0);
  assert.match(report.scope, /synthetic/);
  assert.match(report.scope, /no device execution/);
});

test('Zero first gate exits immediately without slot2, writes, tables or any pendingpointer read', () => {
  for (let status = 0; status < 256; status++)
    if (!(status & 0x38)) {
      const data = fixture({
        first: { ...sparse, gate: 0 },
        second: { ...sparse, gate: null },
        writeWindows: [],
      });
      const p = prepare(data, { status, x: null, y: null });
      commit(data, p);
      assert.equal(p.outcome, 'gate_zero');
      assert.equal(p.x, 0);
      assert.equal(p.y, null);
      assert.equal(p.a, 0);
      assert.equal(p.status, (status & ~0x82) | 2);
      assert.equal(p.work, 1);
      assert.equal(p.index, null);
      assert.equal(p.pointer, null);
      assert.deepEqual(p.byteWrites, []);
      assert.deepEqual(p.ioWrites, []);
      assert.deepEqual(p.readAddresses, [0x7e1cbe, 0x7e1cbf]);
    }
});

test('Active forward producer retains exact fresh WORD order and atomically replaces an outstanding request', () => {
  const data = fixture(),
    before = data.snapshot();
  seed(data, 0x1cda, 0xabcd);
  seed(data, 0x1cdc, 0xffff);
  const seeded = data.snapshot(),
    p = prepare(data);
  assert.deepEqual(data.snapshot(), seeded);
  assert.deepEqual(
    p.operations.map((e) => [e.kind, e.address & 65535, e.value]),
    [
      ['read', 0x1cbe, 1],
      ['read', 0x1cc2, 127],
      ['write', 0x1cc2, 0],
      ['read', 0x1cc6, 0],
      ['read', 0x1cd6, 2],
      ['read', 0x1cd2, 8],
      ['write', 0x1cd6, 3],
      ['read', 0x1cce, 0x4000],
      ['write', 0x1cda, 0x4006],
      ['write', 0x1cdc, 0],
    ],
  );
  assert.equal(p.work, 10);
  assert.equal(p.a, 0);
  assert.equal(p.x, 0);
  assert.equal(p.y, entry.y);
  assert.equal(p.status, 6);
  assert.ok(!p.readAddresses.includes(0x7e1cda));
  assert.ok(!p.readAddresses.includes(0x7e1cc0));
  assert.deepEqual(p.ioWrites, []);
  commit(data, p);
  assert.equal(word(data, 0x1cda), 0x4006);
  assert.equal(word(data, 0x1cdc), 0);
  assert.equal(word(data, 0x1cd6), 3);
  assert.equal(word(data, 0x1cc2), 0);
  assert.notDeepEqual(data.snapshot(), before);
});

test('First nonthreshold progress is retained before a zero second gate with C from CPX and V from ADC', () => {
  const data = fixture({
    first: { ...sparse, gate: 0x7fff, progress: 1 },
    second: { ...sparse, gate: 0 },
  });
  const p = prepare(data);
  commit(data, p);
  assert.equal(p.outcome, 'gate_zero');
  assert.equal(p.a, 0);
  assert.equal(p.x, 2);
  assert.equal(p.status, 0x46);
  assert.equal(p.work, 4);
  assert.equal(word(data, 0x1cc2), 0x8000);
  assert.deepEqual(p.byteWrites, [
    [0x7e1cc2, 0],
    [0x7e1cc3, 128],
  ]);
});

test('Two nonthreshold slots return A from second ADC but final NZC from CPX4 and V from that ADC', () => {
  for (const [gate, progress, a, v] of [
    [1, 1, 2, 0],
    [0x7fff, 1, 0x8000, 1],
    [0xffff, 1, 0, 0],
  ]) {
    const data = fixture({
      first: { ...sparse, gate: 1, progress: 0 },
      second: { ...sparse, gate, progress },
    });
    const p = prepare(data);
    commit(data, p);
    assert.equal(p.outcome, 'progress_prepared');
    assert.equal(p.x, 4);
    assert.equal(p.a, a);
    assert.equal(p.status, 7 | (v << 6));
    assert.equal(p.work, 6);
    assert.equal(word(data, 0x1cc4), a);
    assert.equal(data.readByte(0x1cda).available, false);
  }
});

test('Second active slot follows first progress and writes selection2 without altering the first index', () => {
  const data = fixture({ first: { ...sparse, gate: 1, progress: 10 }, second: { index: 7 } });
  const p = prepare(data);
  commit(data, p);
  assert.equal(p.x, 2);
  assert.equal(p.a, 2);
  assert.equal(p.status, 4);
  assert.equal(p.work, 13);
  assert.equal(p.index, 0);
  assert.equal(p.pointer, 0x4000);
  assert.equal(word(data, 0x1cdc), 2);
  assert.equal(word(data, 0x1cc2), 11);
  assert.equal(word(data, 0x1cd8), 0);
  assert.equal(data.readByte(0x1cd6).available, false);
});

test('All65536 progress sums gate on wrapped bit7, preserving full noevent sums and low7 event sums', () => {
  const data = fixture({ second: { ...sparse, gate: 0 } });
  for (let sum = 0; sum < 65536; sum++) {
    seed(data, 0x1cc2, (sum - 1) & 65535);
    const p = prepare(data);
    assert.ok(p.handled);
    assert.equal(p.outcome, sum & 128 ? 'request_prepared' : 'gate_zero');
    const write = p.operations.find((e) => e.kind === 'write' && (e.address & 65535) === 0x1cc2);
    assert.equal(write.value, sum & 128 ? sum & 127 : sum);
    if (!(sum & 128)) assert.equal(p.overflow, sum === 0x8000 ? 1 : 0);
  }
});

test('Forward index wraps by equality only, including WORD overflow, zero count and values above count', () => {
  for (const [old, count, expected] of [
    [7, 8, 0],
    [8, 8, 9],
    [0xffff, 8, 0],
    [0xfffe, 0, 0xffff],
    [0xffff, 0, 0],
    [0x7fff, 0x8000, 0],
    [0, 0, 1],
  ]) {
    const data = fixture({ first: { index: old, count } }),
      p = prepare(data);
    commit(data, p);
    assert.equal(p.index, expected);
    assert.equal(word(data, 0x1cd6), expected);
  }
});

test('Reverse uses WORD sign, conditionally reads count only at index0 and decrements with WORD wrap', () => {
  for (const [old, count, expected, work] of [
    [3, null, 2, 9],
    [1, null, 0, 9],
    [0x8000, null, 0x7fff, 9],
    [0, 8, 7, 10],
    [0, 0, 0xffff, 10],
    [0, 0x8001, 0x8000, 10],
  ]) {
    const data = fixture({ first: { direction: 0x8000, index: old, count } }),
      p = prepare(data);
    commit(data, p);
    assert.equal(p.index, expected);
    assert.equal(p.work, work);
    assert.equal(p.readAddresses.includes(0x7e1cd2), old === 0);
  }
  for (const direction of [0x7fff, 0x0080, 0x00ff])
    assert.equal(prepare(fixture({ first: { direction } })).index, 3);
  for (const direction of [0x8000, 0xffff, 0xff00])
    assert.equal(prepare(fixture({ first: { direction } })).index, 1);
});

test('Every65536 index preserves ASL bit15 into pointer ADC, with independently calculated signed overflow', () => {
  const data = fixture({ first: { direction: 0x8000, count: 1, table: 0x7fff } });
  for (let index = 0; index < 65536; index++) {
    // Reverse old=index+1; zero old reloads count=1 for indexFFFF, so set count0 there.
    seed(data, 0x1cd6, (index + 1) & 65535);
    if (index === 65535) seed(data, 0x1cd2, 0);
    const p = prepare(data),
      doubled = (index * 2) % 65536,
      carry = index >= 0x8000 ? 1 : 0;
    const total = doubled + 0x7fff + carry,
      signed = (doubled >= 0x8000 ? doubled - 65536 : doubled) + 0x7fff + carry;
    assert.equal(p.index, index);
    assert.equal(p.pointer, total % 65536);
    assert.equal(p.carry, total >= 65536 ? 1 : 0);
    assert.equal(p.overflow, signed < -32768 || signed > 32767 ? 1 : 0);
    assert.equal(p.status & 0x82, 2);
    assert.equal(p.a, 0);
  }
});

test('Pointer WORD wrap and final TXA NZ are preserved even for pointer0 or negative pointers', () => {
  for (const [index, table, pointer, c, v] of [
    [0x8000, 0xffff, 0, 1, 0],
    [0x4000, 0, 0x8000, 0, 0],
    [0x3fff, 2, 0x8000, 0, 1],
    [0xc000, 0x8000, 1, 1, 1],
  ]) {
    const p = prepare(fixture({ first: { index: (index - 1) & 65535, count: 1, table } }));
    assert.equal(p.pointer, pointer);
    assert.equal(p.carry, c);
    assert.equal(p.overflow, v);
    assert.equal(p.status & 0x82, 2);
    assert.equal(p.a, 0);
    assert.ok(!p.operations.some((e) => e.kind === 'read' && e.address === 0x800000 + pointer));
  }
});

test('All native valid entry flags survive only where source preserves them, and X is always initialized0', () => {
  for (let status = 0; status < 256; status++)
    if (!(status & 0x38)) {
      const p = prepare(fixture(), { status });
      assert.equal(p.status, (status & 4) | 2);
      assert.equal(p.x, 0);
      assert.equal(p.y, entry.y);
    }
});

test('Every reached missing BYTE, including late pointerbase, rolls back all preceding writes', () => {
  for (const x of [0, 2])
    for (const offset of [0x1cbe, 0x1cc2, 0x1cc6, 0x1cd6, 0x1cd2, 0x1cce])
      for (const j of [0, 1]) {
        const data = fixture({
          first: x === 2 ? { ...sparse, gate: 1, progress: 0 } : {},
          omit: 0x800000 + offset + x + j,
        });
        assert.equal(
          unchanged(data, {}, 'render_source_required').address,
          0x7e0000 + offset + x + j,
        );
      }
  const reverse = fixture({ first: { direction: 0x8000, index: 0, count: null } });
  assert.equal(unchanged(reverse, {}, 'render_source_required').phase, 'index');
});

test('Each output BYTE needs ownership, and late selection failure discards index, pointer and first-slot progress', () => {
  for (const x of [0, 2]) {
    const addresses = [0x1cc2 + x, 0x1cd6 + x, 0x1cda, 0x1cdc]
      .flatMap((a) => [a, a + 1])
      .map((a) => 0x7e0000 + a);
    if (x === 2) addresses.push(0x7e1cc2, 0x7e1cc3);
    for (const missing of addresses) {
      const data = fixture({
        first: x === 2 ? { ...sparse, gate: 1, progress: 0 } : {},
        writeWindows: addresses.filter((a) => a !== missing).map((a) => [a, a]),
      });
      assert.equal(unchanged(data, {}, 'render_write_window_required').address, missing);
    }
  }
});

test('Every incomplete work budget rolls back, including a second-slot failure after first-slot progress', () => {
  for (const [first, second, work] of [
    [{}, {}, 10],
    [{ direction: 0x8000, index: 1, count: null }, {}, 9],
    [{ direction: 0x8000, index: 0 }, {}, 10],
    [{ ...sparse, gate: 1, progress: 0 }, {}, 13],
  ]) {
    for (let maxWork = 1; maxWork < work; maxWork++)
      unchanged(fixture({ first, second }), { maxWork }, 'render_work_budget_required');
    const data = fixture({ first, second });
    commit(data, prepare(data, { maxWork: work }));
  }
});

test('Three protected JSL bytes and every source/output stackalias are required before effects', () => {
  unchanged(fixture(), { stackWindow: null }, 'render_stack_required');
  unchanged(fixture(), { stackWindow: [0x1ffe, 0x1fff] }, 'render_stack_required');
  assert.ok(prepare(fixture(), { stackWindow: [0x1ffd, 0x1fff] }).handled);
  for (const offset of [0x1cbe, 0x1cc2, 0x1cc6, 0x1cd6, 0x1cd2, 0x1cce, 0x1cda, 0x1cdc])
    unchanged(fixture(), { stackWindow: [offset, offset + 2] }, 'render_stack_alias_required');
  const second = fixture({ first: { ...sparse, gate: 1, progress: 0 } });
  unchanged(second, { stackWindow: [0x1cd8, 0x1cda] }, 'render_stack_alias_required');
});

test('All128 systembank mirrors use shared bytes; physical7E/7F write actual bytes and preserve neighbors', () => {
  for (let bank = 0; bank < 256; bank++)
    if (!(bank & 0x40) || bank === 0x7e || bank === 0x7f) {
      const base = bank * 65536,
        physical = bank === 0x7e || bank === 0x7f;
      const data = fixture({
        bank,
        writeWindows: physical ? [[base + 0x1cc2, base + 0x1cdd]] : windows,
      });
      seed(data, base + 0x1cde, 0xa55a);
      const p = prepare(data, { bank });
      commit(data, p);
      assert.deepEqual(p.ioWrites, []);
      assert.equal(word(data, base + 0x1cda), 0x4006);
      assert.equal(word(data, base + 0x1cde), 0xa55a);
      if (bank === 0x7f) assert.equal(data.readByte(0x7e1cda).available, false);
    }
});

test('Shared inner operation reads prior writes, cannot commit itself and consumes only the outer budget', () => {
  const data = fixture(),
    before = data.snapshot(),
    view = prepareRenderView(data);
  view.write(0x1cc3, 1);
  const budget = { work: 3, maxWork: 13 };
  const inner = advancePaletteCycles(view, entry, budget);
  assert.equal(inner.work, 13);
  assert.equal(budget.work, 13);
  assert.equal(inner.operations[1].value, 383);
  assert.equal(inner.operations[2].value, 0);
  assert.throws(() => data.commit(inner), /Invalid render plan/);
  assert.deepEqual(data.snapshot(), before);
  commit(data, view.finish(inner));
  assert.equal(word(data, 0x1cc2), 0);
  const late = fixture({ first: { table: null } }),
    lateBefore = late.snapshot(),
    lateView = prepareRenderView(late);
  lateView.write(0x1cc4, 0xa5);
  assert.throws(
    () => advancePaletteCycles(lateView, entry, { work: 0, maxWork: 10 }),
    (e) => e.renderBoundary && e.phase === 'pointer',
  );
  assert.deepEqual(late.snapshot(), lateBefore);
});

test('Explicit synthetic producer/80C4 composition sees the fresh pointer/selection in one atomic shared view', () => {
  for (const selected of [0, 2]) {
    const data = fixture({
      first: selected === 2 ? { ...sparse, gate: 1, progress: 0 } : {},
      second: { direction: 0x8085 },
    });
    seed(data, 0x1cca, 0x50);
    seed(data, 0x1ccc, 0x740);
    const before = data.snapshot(),
      view = prepareRenderView(data),
      budget = { work: 0, maxWork: 24 };
    const producer = advancePaletteCycles(view, entry, budget);
    const consumer = render80C4(
      view,
      {
        ...entry,
        x: producer.x,
        y: producer.y,
        status: producer.status,
        ioMode: 'record-requests',
      },
      budget,
    );
    assert.equal(consumer.pointer, producer.pointer);
    assert.equal(consumer.x, selected);
    assert.equal(consumer.size, 0x50);
    assert.equal(consumer.palette, selected === 2 ? 0x85 : 0);
    assert.deepEqual(data.snapshot(), before);
    const p = view.finish(consumer);
    commit(data, p);
    assert.equal(word(data, 0x1cda), 0);
    assert.equal(word(data, 0x1cdc), selected);
    assert.equal(consumer.ioWrites[0].value, producer.pointer);
  }
  const late = fixture();
  seed(late, 0x1cca, 0x50);
  const before = late.snapshot(),
    view = prepareRenderView(late),
    budget = { work: 0, maxWork: 20 };
  const producer = advancePaletteCycles(view, entry, budget);
  assert.throws(
    () =>
      render80C4(
        view,
        { ...entry, x: producer.x, status: producer.status, ioMode: 'record-requests' },
        budget,
      ),
    (e) => e.renderBoundary && e.reason === 'render_work_budget_required',
  );
  assert.deepEqual(late.snapshot(), before);
});

test('Invalid entries, unsupported banks and immutable/stale/foreign/copied plans cannot alter their owner', () => {
  const data = fixture();
  for (const opts of [
    { bank: null },
    { status: null },
    { status: 8 },
    { status: 16 },
    { status: 32 },
    { emulation: 1 },
    { directPage: 1 },
  ])
    unchanged(data, opts, 'render_entry_required');
  unchanged(data, { bank: 0x40 }, 'render_address_required');
  for (const opts of [{ bank: 256 }, { status: -1 }, { x: 65536 }, { y: -1 }, { maxWork: 0 }])
    assert.throws(() => prepare(data, opts), /Invalid render/);
  const p = prepare(data);
  assert.throws(() => {
    p.operations[0].value = 0;
  }, TypeError);
  assert.throws(() => {
    p.byteWrites[0][1] = 0;
  }, TypeError);
  assert.throws(() => fixture().commit(p), /Invalid render plan/);
  assert.throws(() => data.commit({ ...p }), /Invalid render plan/);
  seed(data, 0x1cc2, 0);
  const before = data.snapshot();
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  assert.deepEqual(data.snapshot(), before);
});

test('Repeated explicit commits use fresh progress/index and overwrite the pendingpointer without consuming it', () => {
  const data = fixture({ first: { gate: 128, progress: 0 } });
  for (let step = 0; step < 12; step++) {
    const p = prepare(data),
      index = (3 + step) % 8;
    commit(data, p);
    assert.equal(p.index, index);
    assert.equal(p.pointer, 0x4000 + 2 * index);
    assert.equal(word(data, 0x1cd6), index);
    assert.equal(word(data, 0x1cda), p.pointer);
    assert.equal(word(data, 0x1cc2), 0);
    assert.equal(word(data, 0x1cc4), 127);
    assert.equal(word(data, 0x1cc6), 0);
    assert.equal(word(data, 0x1cd2), 8);
  }
});

test('Synthetic8076 report reproduces only manual fixtures, including zero pointer and ASLcarry', async () => {
  const report = JSON.parse(
    await readFile(new URL('../analysis/render-8076-native.json', import.meta.url)),
  );
  assert.equal(report.probes.length, 8);
  for (const probe of report.probes) {
    const p = prepare(fixture(probe.fixture));
    for (const key of [
      'handled',
      'outcome',
      'a',
      'x',
      'y',
      'bank',
      'status',
      'carry',
      'overflow',
      'index',
      'pointer',
      'work',
      'operations',
      'ioWrites',
      'byteWrites',
      'readAddresses',
    ])
      assert.deepEqual(p[key], probe[key]);
  }
});
