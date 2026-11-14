import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView, renderAddress } from '../src/render/data.mjs';
import { prepareRenderEF47, renderEF47 } from '../proof/render/mode-ef47.mjs';
import { ef47Entry, ef47Fixture } from './render-ef47-fixtures.mjs';
const prepare = (data, options = {}) => prepareRenderEF47({ ...ef47Entry, data, ...options });
const byte = (d, a) => d.readByte(a).value;
const word = (d, a) => byte(d, a) | byte(d, a + 1) << 8;
const commands = p => p.ioWrites.filter(e => e.phase === 'command').map(e => e.value);
function fail(data, options, reason) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  for (const key of ['byteWrites', 'operations', 'ioWrites', 'ioReads', 'calls']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}

test('EF47 all65536 WORD inputs store full cache before lowBYTE F25A and return actual finaltoken/Y', () => {
  const data = ef47Fixture({ entries: [0] }); data.seed(0x908005, [255]);
  for (let a = 0; a <= 65535; a++) {
    const p = prepare(data, { a }); assert.ok(p.handled);
    assert.deepEqual(p.operations[0], { kind: 'write', space: 'data', phase: 'modeCache', address: 0x801CDE, value: a, bytes: 2 });
    assert.equal(p.inputWord, a); assert.equal(p.zeroPath, (a & 255) === 0);
    assert.equal(p.a, (a & 255) === 0 ? 0x0203 : 0x0204); assert.equal(p.x, 0x7F7F);
    assert.equal(p.y, (a & 255) === 0 ? ef47Entry.y : 5); assert.equal(p.status, ef47Entry.status & ~0x82);
    assert.equal(p.calls[0].before.a, a); assert.equal(p.calls[1].before.a, 13); assert.equal(p.calls[1].before.x, 0x2020);
    assert.equal(p.calls[2].before.a, 2); assert.equal(p.calls[2].before.x, 0x7F7F);
    assert.equal(p.byteWrites.find(([address]) => address === 0x7E1CDE)[1], a & 255);
    assert.equal(p.byteWrites.find(([address]) => address === 0x7E1CDF)[1], a >>> 8);
  }
});
test('EF47 highWORD lowzero requires no pointer/list/cache source and stores both bytes without initial read', () => {
  for (let high = 0; high < 256; high++) {
    const d = ef47Fixture({ zeroFixture: true }), p = prepare(d, { a: high << 8 }); assert.ok(p.handled);
    assert.equal(p.work, 19); assert.equal(p.y, ef47Entry.y); assert.deepEqual(commands(p), [4, 13, 2]);
    assert.deepEqual(p.readAddresses, [0x7E1CE4]); assert.equal(p.calls[0].calls.length, 1);
    assert.deepEqual(d.commit(p), { handled: true }); assert.equal(word(d, 0x1CDE), high << 8);
    assert.equal(byte(d, 0x1CE4), 3);
  }
});
test('EF47 all admissible statuses retain C/V/I and clear N/Z across actual zero/raw/repeat callees', () => {
  for (let status = 0; status < 256; status++) {
    if (status & 0x38) continue;
    for (const options of [{ zeroFixture: true, a: 0 }, { entries: [0] }, {},
      { modeLoader: { blocks: [{ kind: 'repeat', count: 1, value: 0x8000 }] } }]) {
      const p = prepare(ef47Fixture(options), { ...options, status }); assert.ok(p.handled);
      assert.equal(p.status, status & ~0x82); assert.equal(p.bank, ef47Entry.bank);
      assert.equal(p.carry, status & 1); assert.equal(p.overflow, status >>> 6 & 1);
    }
  }
});
test('EF47 all256 tokens wrap through all three zero commands with independent final A', () => {
  for (let token = 0; token < 256; token++) {
    const d = ef47Fixture({ zeroFixture: true, token }), p = prepare(d, {
      a: 0xFF00, ioRead2140: [token, token + 1 & 255, token + 2 & 255] }); assert.ok(p.handled);
    assert.equal(p.a, 0x0200 | (token + 3 & 255)); assert.equal(p.apuPolls, 3);
    assert.equal(p.calls[0].after.a, 0x0400); assert.deepEqual(d.commit(p), { handled: true });
    assert.equal(byte(d, 0x1CE4), token + 3 & 255); assert.equal(word(d, 0x1CDE), 0xFF00);
  }
});
test('EF47 full repeated real loaders finish before fixed commands and preserve actual final Y and cacheWORD', () => {
  const d = ef47Fixture({ entries: [6, 7, 6, 7, 0], modeLoader: { blocks: [{ kind: 'repeat', count: 2, value: 0xBEEF }] } });
  const before = d.snapshot(), p = prepare(d); assert.ok(p.handled); assert.deepEqual(d.snapshot(), before);
  assert.deepEqual(p.calls.map(c => [c.name, c.role]), [['F25A', 'modeComposition'], ['F007', 'command0D'], ['F007', 'command02']]);
  assert.deepEqual(commands(p), [4, 16, 16, 16, 4, 13, 2]); assert.equal(p.y, 8);
  assert.equal(p.calls[0].calls[1].matches, 2); assert.equal(p.calls[0].calls[2].repeatWords, 2);
  assert.equal(p.calls[1].before.y, 8); assert.equal(p.a, 0x020E); assert.equal(p.apuPolls, 14);
  assert.deepEqual(d.commit(p), { handled: true }); assert.equal(word(d, 0x1CDE), ef47Entry.a); assert.equal(word(d, 0x98), 0xBEEF);
});
test('EF47 final raw payload and bankcarry use actual F25A result through both fixed calls', () => {
  const p = prepare(ef47Fixture({ modeLoader: { address: 0x12FF,
    blocks: [{ kind: 'raw', pointer: 0x7FFFFF, values: [0xAA, 0xBB] }] } })); assert.ok(p.handled);
  assert.equal(p.y, 9); assert.equal(p.a, 0x020A);
  assert.deepEqual(p.operations.filter(e => e.kind === 'read' && e.phase === 'raw' && [0x7FFFFF, 0x800000].includes(e.address))
    .map(e => [e.address, e.value]), [[0x7FFFFF, 0xAA], [0x800000, 0xBB]]);
});
test('EF47 full first cacheWORD changes aliased fresh header before actual F25A traversal', () => {
  const d = ef47Fixture({ directory: 0x7E1CDE, entries: [0] });
  // Entry AB06 becomes actual fresh header AB06; token and F1FA cache are
  // nearby but separate. Prior fixture header40 must never be frozen.
  d.seed(0x7EC7E4, [0]); d.seed(0x7E1CE3, [255]);
  const p = prepare(d); assert.ok(p.handled, JSON.stringify(p));
  assert.equal(p.calls[0].calls[1].after.y, 0xAB06); assert.equal(p.y, 5); assert.equal(p.a, 0x0204);
  assert.deepEqual(d.commit(p), { handled: true }); assert.equal(word(d, 0x1CDE), 0xAB06);
});
test('EF47 global chronological mismatched polls span nested F25A and both fixed calls with wrap', () => {
  const samples = [77, 254, 88, 255, 0, 1, 99, 2, 55, 3, 44, 4];
  const p = prepare(ef47Fixture({ token: 254 }), { ioRead2140: samples }); assert.ok(p.handled);
  assert.deepEqual(p.ioReads.map(e => e.value), samples); assert.equal(p.apuPolls, 12);
  assert.deepEqual(p.calls.map(c => [c.polls, c.apuPolls]), [[8, 8], [2, 10], [2, 12]]); assert.equal(p.a, 0x0205);
});
test('EF47 all256 DBRs address full cache and actual commands; physical polls consume only real bytes', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40 && bank !== 0x7E && bank !== 0x7F) {
      fail(ef47Fixture(), { bank, a: 0 }, 'render_address_required'); continue;
    }
    for (const zeroFixture of [true, false]) {
      const d = ef47Fixture({ bank, zeroFixture }), p = prepare(d, { bank, a: zeroFixture ? 0xFF00 : ef47Entry.a });
      assert.ok(p.handled, JSON.stringify(p)); assert.equal(p.bank, bank);
      assert.equal(p.operations[0].address, bank * 65536 + 0x1CDE);
      if ([0x7E, 0x7F].includes(bank)) { assert.equal(p.apuPolls, 0); assert.deepEqual(p.ioRequests, []); }
      assert.deepEqual(d.commit(p), { handled: true }); assert.equal(word(d, bank * 65536 + 0x1CDE), zeroFixture ? 0xFF00 : ef47Entry.a);
    }
  }
});
test('EF47 physical mismatches and missing physical poll sources hold back first fullWORD store', () => {
  for (const bank of [0x7E, 0x7F]) {
    const d = ef47Fixture({ bank, zeroFixture: true }); d.seed(bank * 65536 + 0x2140, [99]);
    fail(d, { bank, a: 0, maxWork: 100 }, 'render_work_budget_required');
    const snap = ef47Fixture({ bank }).snapshot(), missing = bank * 65536 + 0x2140;
    const source = createRenderData({ writeWindows: snap.writeWindows });
    for (const [a, v] of snap.bytes) if (a !== missing) source.seed(a, [v]);
    fail(source, { bank }, 'render_source_required');
  }
});
test('EF47 22-byte stack minimum and reached cache/helper aliases reject without effects', () => {
  assert.ok(prepare(ef47Fixture(), { stackWindow: [0x1FEA, 0x1FFF] }).handled);
  fail(ef47Fixture(), { stackWindow: [0x1FEB, 0x1FFF] }, 'render_stack_required');
  for (const a of [0x89, 0x8C, 0x92, 0x94, 0x96, 0x98, 0x1CDE, 0x1CDF, 0x1CE4, 0x1CE5, 0x1CE6, 0x1CE7])
    fail(ef47Fixture(), { stackWindow: [a, a + 21] }, 'render_stack_alias_required');
  assert.ok(prepare(ef47Fixture({ zeroFixture: true }), { a: 0, stackWindow: [0x8C, 0xA1] }).handled);
});
test('EF47 every required source and writewindow byte fails atomically including high cacheBYTE', () => {
  const options = { modeLoader: { blocks: [{ kind: 'repeat', count: 1, value: 0xBEEF }] } };
  const d = ef47Fixture(options), p = prepare(d); assert.ok(p.handled);
  const snapshot = d.snapshot(), written = new Set(), required = new Set();
  for (const e of p.operations.filter(e => e.space === 'data')) for (let n = 0; n < e.bytes; n++) {
    const a = renderAddress(e.address + n & 0xFFFFFF);
    if (e.kind === 'write') written.add(a); else if (!written.has(a)) required.add(a);
  }
  for (const missing of required) {
    const data = createRenderData({ writeWindows: snapshot.writeWindows });
    for (const [a, v] of snapshot.bytes) if (a !== missing) data.seed(a, [v]);
    assert.equal(fail(data, {}, 'render_source_required').address, missing);
  }
  for (const [missing] of p.byteWrites) {
    const writeWindows = p.byteWrites.filter(([a]) => a !== missing).map(([a]) => [a, a]);
    assert.equal(fail(ef47Fixture({ ...options, writeWindows }), {}, 'render_write_window_required').address, missing);
  }
});
test('EF47 all cumulative budget and observation prefixes suppress cache/load/fixedcommand effects', () => {
  const options = { modeLoader: { blocks: [{ kind: 'repeat', count: 1, value: 0xBEEF }] } };
  const p = prepare(ef47Fixture(options)); assert.ok(p.handled);
  for (let maxWork = 1; maxWork < p.work; maxWork++) fail(ef47Fixture(options), { maxWork }, 'render_work_budget_required');
  assert.ok(prepare(ef47Fixture(options), { maxWork: p.work }).handled);
  for (let n = 0; n < p.apuPolls; n++) fail(ef47Fixture(options), { ioRead2140: ef47Entry.ioRead2140.slice(0, n) }, 'render_io_read_required');
  fail(ef47Fixture(), { ioMode: null }, 'render_io_context_required');
  for (const [n, role, index] of [[5, 'command0D', 1], [6, 'command02', 2]]) {
    const late = fail(ef47Fixture(), { ioRead2140: ef47Entry.ioRead2140.slice(0, n) }, 'render_io_read_required');
    assert.equal(late.compositionPhase, role); assert.equal(late.compositionCallIndex, index);
  }
});
test('EF47 late nested mode boundaries retain callee diagnosis and no earlier cache/request effects', () => {
  const p = fail(ef47Fixture({ entries: [6, 7, 6] }), {}, 'render_source_required');
  assert.equal(p.caller, 'EF47'); assert.equal(p.compositionPhase, 'modeComposition');
  assert.equal(p.calleeCaller, 'F25A'); assert.equal(p.calleeCompositionPhase, 'modeList');
});
test('EF47 inner calls share global polls and cumulative work/output in exactly one outer commit', () => {
  const d = ef47Fixture(), before = d.snapshot(), view = prepareRenderView(d);
  const budget = { work: 7, maxWork: 1000, outputBytes: 5, maxOutputBytes: 5 }, observations = { apuPolls: 2 };
  const context = { ...ef47Entry, observations, ioRead2140: [99, 99, ...ef47Entry.ioRead2140] };
  const first = renderEF47(view, context, budget), second = renderEF47(view, context, budget);
  assert.equal(first.apuPolls, 9); assert.equal(second.apuPolls, 16); assert.equal(second.outputBytes, 5);
  assert.equal(second.work, 7 + 2 * prepare(ef47Fixture()).work); assert.deepEqual(d.snapshot(), before);
  assert.throws(() => d.commit(first)); assert.throws(() => d.commit(second));
  assert.deepEqual(d.commit(view.finish(second)), { handled: true }); assert.equal(byte(d, 0x1CE4), 14);
});
test('EF47 foreign/stale plans reject and late inner failure preserves outer live state', () => {
  const d = ef47Fixture(), p = prepare(d); assert.throws(() => ef47Fixture().commit(p));
  d.seed(0x1CE4, [99]); assert.deepEqual(d.commit(p), { handled: false, reason: 'render_plan_stale' });
  const data = ef47Fixture(), before = data.snapshot(), view = prepareRenderView(data); view.write(0x1CE7, 0x88);
  assert.throws(() => renderEF47(view, { ...ef47Entry, ioRead2140: [0, 1, 2, 3, 4, 5] }, { work: 0, maxWork: 1000 }),
    e => e.reason === 'render_io_read_required' && e.compositionPhase === 'command02');
  assert.deepEqual(data.snapshot(), before);
});
test('EF47 explicit WORD context requires fullA/Y and rejects BYTE/decimal/unknown or invalid inputs', () => {
  for (const options of [{ a: null }, { y: null }, { bank: null }, { status: null }, { status: 0x20 },
    { status: 0x10 }, { status: 0x08 }, { emulation: 1 }, { directPage: 1 }]) fail(ef47Fixture(), options, 'render_entry_required');
  for (const options of [{ a: -1 }, { y: 65536 }, { bank: 256 }, { status: 256 }, { maxWork: 0 },
    { maxOutputBytes: 0 }, { ioMode: 'execute' }, { ioRead2140: [256] }, { ioRead2140: Array(1) }]) assert.throws(() => prepare(ef47Fixture(), options));
});
test('EF47 synthetic probe pins28/9 and22-byte fullgraph proof with late no-effect records', async () => {
  const report = JSON.parse(await readFile('analysis/render-ef47-native.json', 'utf8'));
  assert.match(report.scope, /explicitly synthetic/); assert.match(report.scope, /No audio\/device\/CPU\/clock/);
  assert.equal(report.source.covered_bytes, 28); assert.equal(report.source.instruction_count, 9);
  assert.equal(report.stackProof.minimum_protected_stack_bytes, 22); assert.equal(report.stackProof.external_return_assumptions, 0);
  assert.deepEqual(report.probes.map(p => p.handled), [true, true, true, true, true, true, false, false, false]);
  for (const p of report.probes.slice(6)) assert.equal(p.operations, undefined);
});
