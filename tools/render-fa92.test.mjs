import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderFA92, renderFA92 } from '../proof/render/fields-fa92.mjs';
import { fa92Entry, fa92Fixture } from './render-fa92-fixtures.mjs';
const prepare = (data, options = {}) => prepareRenderFA92({ ...fa92Entry, data, ...options });
const seed = (d, a, v) => d.seed(a, [v & 255, v >>> 8]);
const byte = (d, a) => d.readByte(a).value;
const word = (d, a) => byte(d, a) | byte(d, a + 1) << 8;
const nz = v => (v === 0 ? 2 : 0) | (v & 0x8000 ? 128 : 0);
const flags = (status, left, right) => {
  const sum = left + right, value = sum & 65535, result = sum - 2 & 65535;
  return status & ~0xC3 | nz(result) | (sum > 65535 ? 1 : 0)
    | ((left < 32768) === (right < 32768) && (value < 32768) !== (left < 32768) ? 64 : 0);
};
function fail(data, options, reason) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  for (const key of ['byteWrites', 'operations', 'ioWrites', 'readAddresses']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}

test('FA92 all65536 second inputs preserve zero-before-positive priority and unshifted WORD results/flags', () => {
  const data = fa92Fixture({ dimension: 0x8001 });
  for (let second = 0; second <= 65535; second++) {
    seed(data, 4, second); const p = prepare(data); assert.ok(p.handled);
    const relative = second === 0 || second >= 32768;
    assert.equal(p.relative, relative); assert.equal(p.dimension, relative ? 0x8001 : null);
    assert.equal(p.a, relative ? second + 0x8001 - 2 & 65535 : second);
    assert.equal(p.status, relative ? flags(fa92Entry.status, second, 0x8001) : fa92Entry.status & ~0x82);
    assert.equal(p.x, 2); assert.equal(p.y, fa92Entry.y); assert.equal(p.bank, fa92Entry.bank);
    assert.equal(p.work, relative ? 6 : 5); assert.equal(p.firstWord, 0x54);
  }
});
test('FA92 all65536 first inputs store full WORD unchanged regardless of high/zero/negative bits', () => {
  const data = fa92Fixture({ second: 1, dimension: null });
  for (let first = 0; first <= 65535; first++) {
    seed(data, 2, first); const p = prepare(data); assert.ok(p.handled);
    assert.equal(p.firstWord, first); assert.equal(p.a, 1); assert.equal(p.status, fa92Entry.status & ~0x82);
    assert.deepEqual(p.byteWrites, [[0x7E2102, first & 255], [0x7E2103, first >>> 8], [0x7E2122, 1], [0x7E2123, 0]]);
  }
});
test('FA92 all65536 dimension WORDs including zero/high bits retain full sum-minus2 and ADC C/V', () => {
  for (const second of [0, 0x8000, 0xFFFF]) {
    const data = fa92Fixture({ second });
    for (let dimension = 0; dimension <= 65535; dimension++) {
      seed(data, 0x7E2022, dimension); const p = prepare(data); assert.ok(p.handled);
      assert.equal(p.a, second + dimension - 2 & 65535); assert.equal(p.status, flags(fa92Entry.status, second, dimension));
      assert.equal(p.dimension, dimension); assert.equal(p.work, 6);
    }
  }
});
test('FA92 every fullWORD index uses both actual long WORD destinations and bankcarry without alignment/capacity caps', () => {
  for (let index = 0; index <= 65535; index++) {
    const p = prepare(fa92Fixture({ index, second: 0, dimension: 2 })); assert.ok(p.handled);
    assert.equal(p.x, index); assert.equal(p.a, 0);
    assert.deepEqual(p.byteWrites, [[0x7E2100 + index, 0x54], [0x7E2101 + index, 0], [0x7E2120 + index, 0], [0x7E2121 + index, 0]]);
  }
});
test('FA92 all admissible statuses preserve I and actual positive C/V while relative CLC discards incoming carry', () => {
  for (let status = 0; status < 256; status++) if (!(status & 0x38))
    for (const [second, dimension] of [[1, null], [0x7FFF, null], [0, 0], [0x8000, 0xFFFF], [0xFFFF, 3]]) {
      const p = prepare(fa92Fixture({ second, dimension }), { status }); assert.ok(p.handled);
      assert.equal(p.status, p.relative ? flags(status, second, dimension) : status & ~0x82);
      assert.equal(p.carry, p.status & 1); assert.equal(p.overflow, p.status >>> 6 & 1);
    }
});
test('FA92 both DEC steps update final N/Z without replacing earlier ADC C/V', () => {
  for (const [second, dimension, value, bits] of [[0, 0, 0xFFFE, 0x80], [0, 2, 0, 2],
    [0, 0x8000, 0x7FFE, 0], [0x8000, 0xFFFF, 0x7FFD, 0x41], [0xFFFF, 1, 0xFFFE, 0x81], [0xFFFF, 3, 0, 3]]) {
    const p = prepare(fa92Fixture({ second, dimension })); assert.ok(p.handled);
    assert.equal(p.a, value); assert.equal(p.status & 0xC3, bits);
  }
});
test('FA92 all256 DBRs remain unchanged and fixedlong/DP addressing never requires IO context', () => {
  for (let bank = 0; bank < 256; bank++) {
    const data = fa92Fixture(), before = data.snapshot(), p = prepare(data, { bank }); assert.ok(p.handled);
    assert.equal(p.bank, bank); assert.equal(p.y, fa92Entry.y); assert.deepEqual(p.ioRequests, []);
    assert.deepEqual(data.snapshot(), before); assert.deepEqual(data.commit(p), { handled: true });
    assert.equal(word(data, 0x7E2102), 0x54); assert.equal(word(data, 0x7E2122), 0x14);
  }
});
test('FA92 positive second WORD requires no dimension bytes and completes both stores in five accesses', () => {
  const data = fa92Fixture({ second: 0x7FFF, dimension: null }), p = prepare(data); assert.ok(p.handled);
  assert.equal(p.work, 5); assert.equal(p.dimension, null); assert.deepEqual(p.readAddresses, [0x7E0000, 0x7E0001, 0x7E0002, 0x7E0003, 0x7E0004, 0x7E0005]);
  assert.deepEqual(data.commit(p), { handled: true }); assert.equal(word(data, 0x7E2122), 0x7FFF);
});
test('FA92 transcript preserves full WORD first store before fresh second source/dimension and final store', () => {
  const p = prepare(fa92Fixture()); assert.ok(p.handled);
  assert.deepEqual(p.operations.map(e => [e.kind, e.phase, e.address, e.value, e.bytes]), [
    ['read', 'index', 0, 2, 2], ['read', 'firstField', 2, 0x54, 2], ['write', 'firstField', 0x7E2102, 0x54, 2],
    ['read', 'secondField', 4, 0xFFF8, 2], ['read', 'dimension', 0x7E2022, 0x1E, 2], ['write', 'secondStore', 0x7E2122, 0x14, 2],
  ]); assert.ok(p.operations.every(Object.isFrozen));
});
test('FA92 read and both store WORD highbytes cross7E/7F boundaries as actual physical bytes', () => {
  for (const index of [0xDFDF, 0xDEFF, 0xDEDF, 0xFFFF]) {
    const data = fa92Fixture({ index, first: 0xABCD, second: 0, dimension: 0x8000 }), p = prepare(data);
    assert.ok(p.handled); assert.equal(p.a, 0x7FFE); assert.deepEqual(data.commit(p), { handled: true });
    assert.equal(word(data, 0x7E2100 + index), 0xABCD); assert.equal(word(data, 0x7E2120 + index), 0x7FFE);
  }
});
test('FA92 every required source BYTE fails atomically including late DP04/dimension highbyte', () => {
  for (const second of [1, 0, 0xFFF8]) {
    const full = fa92Fixture({ second }), p = prepare(full); assert.ok(p.handled); const snapshot = full.snapshot();
    for (const missing of p.readAddresses) {
      const data = createRenderData({ writeWindows: snapshot.writeWindows });
      for (const [a, v] of snapshot.bytes) if (a !== missing) data.seed(a, [v]);
      assert.equal(fail(data, {}, 'render_source_required').address, missing);
    }
  }
  const p = fail(fa92Fixture({ dimension: null }), {}, 'render_source_required'); assert.equal(p.phase, 'dimension');
});
test('FA92 every actual destination BYTE needs its own writable window; late highbyte suppresses first store', () => {
  const p = prepare(fa92Fixture()); assert.ok(p.handled);
  for (const [missing] of p.byteWrites) {
    const writeWindows = p.byteWrites.filter(([a]) => a !== missing).map(([a]) => [a, a]);
    const boundary = fail(fa92Fixture({ writeWindows }), {}, 'render_write_window_required'); assert.equal(boundary.address, missing);
    if (missing === 0x7E2123) assert.equal(boundary.phase, 'secondStore');
  }
});
test('FA92 all workbudget prefixes hold both stores back with exact five/six-access success thresholds', () => {
  for (const second of [1, 0, 0x8000]) {
    const p = prepare(fa92Fixture({ second })); assert.ok(p.handled);
    for (let maxWork = 1; maxWork < p.work; maxWork++) fail(fa92Fixture({ second }), { maxWork }, 'render_work_budget_required');
    assert.ok(prepare(fa92Fixture({ second }), { maxWork: p.work }).handled);
  }
});
test('FA92 two rootJSR stackbytes protect every reached source/store and permit unreached dimension alias', () => {
  assert.ok(prepare(fa92Fixture(), { stackWindow: [0x1FFE, 0x1FFF] }).handled);
  fail(fa92Fixture(), { stackWindow: [0x1FFF, 0x1FFF] }, 'render_stack_required');
  for (const a of [0, 1, 2, 3, 4, 5, 0x2022, 0x2023, 0x2102, 0x2103, 0x2122, 0x2123])
    fail(fa92Fixture(), { stackWindow: [a, a + 1] }, 'render_stack_alias_required');
  assert.ok(prepare(fa92Fixture({ second: 1, dimension: null }), { stackWindow: [0x2022, 0x2023] }).handled);
  fail(fa92Fixture({ index: 0xDEFF }), { stackWindow: [0xFFFE, 0xFFFF] }, 'render_stack_alias_required');
});
test('FA92 inner composition reads real earlier field store as later indexed dimension on one fresh view', () => {
  // Synthetic outer caller supplies DP changes between two actual FA92 calls;
  // this is not an original936C/F963 lifecycle or a runtime callback.
  const index = 0xE0, data = fa92Fixture({ index: 0, first: 0x1234, second: 1, dimension: null,
    writeWindows: [[0x7E0000, 0x7E0005], [0x7E2100, 0x7E2121], [0x7E2100 + index, 0x7E2121 + index]] });
  const before = data.snapshot(), view = prepareRenderView(data), budget = { work: 0, maxWork: 100, outputBytes: 7, maxOutputBytes: 7 };
  const first = renderFA92(view, fa92Entry, budget);
  view.write(0, index); view.write(1, 0); view.write(4, 0); view.write(5, 0);
  const second = renderFA92(view, fa92Entry, budget); assert.equal(second.dimension, 0x1234); assert.equal(second.a, 0x1232);
  assert.equal(first.work, 5); assert.equal(second.work, 11); assert.equal(second.outputBytes, 7);
  assert.deepEqual(data.snapshot(), before); assert.throws(() => data.commit(first)); assert.throws(() => data.commit(second));
  assert.deepEqual(data.commit(view.finish(second)), { handled: true }); assert.equal(word(data, 0x7E2120 + index), 0x1232);
});
test('FA92 preceding outer DP writes are fresh and cumulative budgets preserve output owner/count', () => {
  const data = fa92Fixture({ writeWindows: [[0x7E0000, 0x7E0005], [0x7E2102, 0x7E2123]] });
  const view = prepareRenderView(data); view.write(2, 0xCD); view.write(3, 0xAB);
  const budget = { work: 7, maxWork: 13, outputBytes: 5, maxOutputBytes: 5 }, p = renderFA92(view, fa92Entry, budget);
  assert.equal(p.firstWord, 0xABCD); assert.equal(p.work, 13); assert.equal(p.outputBytes, 5);
  assert.deepEqual(data.commit(view.finish(p)), { handled: true }); assert.equal(word(data, 0x7E2102), 0xABCD);
});
test('FA92 foreign/stale plans reject and late inner failure exposes no live prior effects', () => {
  const data = fa92Fixture(), p = prepare(data); assert.throws(() => fa92Fixture().commit(p));
  seed(data, 4, 1); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  const missing = fa92Fixture({ dimension: null }), before = missing.snapshot(), view = prepareRenderView(missing);
  view.write(0x7E2102, 0x99);
  assert.throws(() => renderFA92(view, fa92Entry, { work: 0, maxWork: 100 }), e => e.reason === 'render_source_required' && e.phase === 'dimension');
  assert.deepEqual(missing.snapshot(), before);
});
test('FA92 preserved Y is explicit while A/X need no incoming register values', () => {
  for (const y of [0, 1, 0x7FFF, 0x8000, 0xFFFF]) {
    const p = prepare(fa92Fixture(), { y }); assert.ok(p.handled); assert.equal(p.y, y);
  }
  assert.ok(prepare(fa92Fixture()).handled); fail(fa92Fixture(), { y: null }, 'render_entry_required');
});
test('FA92 unknown/unsupported/invalid entry and budget contexts reject explicitly with no effects', () => {
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 0x10 }, { status: 0x08 },
    { emulation: 1 }, { directPage: 1 }, { stackWindow: null }])
    fail(fa92Fixture(), options, options.stackWindow === null ? 'render_stack_required' : 'render_entry_required');
  for (const options of [{ y: -1 }, { y: 65536 }, { bank: 256 }, { status: 256 }, { maxWork: 0 }, { maxWork: 1.5 },
    { maxOutputBytes: 0 }, { data: null }]) assert.throws(() => prepare(fa92Fixture(), options));
});
test('FA92 nine synthetic public probes pin26/12 source and two-byte proof with three late no-effect boundaries', async () => {
  const report = JSON.parse(await readFile('analysis/render-fa92-native.json', 'utf8'));
  assert.match(report.scope, /explicitly synthetic/); assert.match(report.scope, /No CPU\/device\/clock/);
  assert.equal(report.source.covered_bytes, 26); assert.equal(report.source.instruction_count, 12);
  assert.equal(report.stackProof.minimum_protected_stack_bytes, 2); assert.equal(report.stackProof.external_return_assumptions, 0);
  assert.deepEqual(report.probes.map(p => p.handled), [true, true, true, true, true, true, false, false, false]);
  for (const p of report.probes.slice(6)) assert.equal(p.operations, undefined);
});
