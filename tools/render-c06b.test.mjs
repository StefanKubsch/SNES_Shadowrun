import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderC06B, renderC06B } from '../proof/render/object-c06b.mjs';
import { render9E0B } from '../proof/render/input-9e0b.mjs';

const entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const seedWord = (d, a, v) => d.seed(a, [v & 255, v >>> 8]);
const word = (d, a) => d.readByte(a).value | d.readByte(a + 1).value << 8;
function fixture({ gate = 0xFFFE, objectWord = 0x8000, byteD5 = 0x12, byteD7 = 0x34, bank = 0x80,
  writeWindows = [[0x7E01E8, 0x7E01E9]], missing = [] } = {}) {
  const base = bank * 65536, data = createRenderData({ writeWindows });
  for (const [a, v] of [[base + 0x1E8, gate & 255], [base + 0x1E9, gate >>> 8], [base + 0x1D5, byteD5],
    [base + 0x1D7, byteD7], [base + 0x1D8, objectWord & 255], [base + 0x1D9, objectWord >>> 8]])
    if (!missing.includes(a)) data.seed(a, [v]);
  return data;
}
const prepare = (data, options = {}) => prepareRenderC06B({ ...entry, data, ...options });
const commit = (data, p) => { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.commit(p), { handled: true }); };
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  for (const key of ['operations', 'ioWrites', 'byteWrites']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}
const transfer = offset => [[0x4302, offset, 2], [0x4304, 0x8D, 1], [0x4301, 0x18, 1], [0x2115, 0x80, 1],
  [0x4300, 1, 1], [0x2116, 0, 2], [0x4305, 0x40, 2], [0x420B, 1, 1],
  [0x2116, 0x100, 2], [0x4305, 0x40, 2], [0x420B, 1, 1]];
const stores = p => p.ioWrites.map(e => [e.address & 65535, e.value, e.bytes]);

test('C06B probe separates140/55 original code from seven synthetic per-call fixtures', async () => {
  const source = JSON.parse(await readFile(new URL('../analysis/render-c06b.json', import.meta.url), 'utf8'));
  const report = JSON.parse(await readFile(new URL('../analysis/render-c06b-native.json', import.meta.url), 'utf8'));
  assert.equal(report.source.sha256, 'f4c3a3a2381323c8b8c19479807c7bd14f6096f09abd2ddad686411189554af7');
  assert.deepEqual(report.source, source.windows[0]); assert.equal(report.probes.length, 7); assert.match(report.scope, /synthetic/);
  for (const old of report.probes) {
    const f = old.fixture, d = fixture({ ...f, writeWindows: old.writeWindows,
      missing: f.objectWord ? [] : [f.bank * 65536 + 0x1D7] });
    assert.deepEqual(prepare(d, { bank: f.bank, ioMode: f.bank === 0x7E || f.bank === 0x7F ? null : 'record-requests' }),
      Object.fromEntries(Object.entries(old).filter(([key]) => !['fixture', 'writeWindows'].includes(key))));
  }
});
test('All65536 gate WORDs select exact zero/FFFE/FFFD/default path and compareCarry', () => {
  const data = fixture();
  for (let gate = 0; gate <= 65535; gate++) {
    seedWord(data, 0x1E8, gate); const p = prepare(data);
    assert.ok(p.handled); assert.equal(p.sourceOffset, gate === 0 ? null : gate === 0xFFFE ? 0xFB78 : gate === 0xFFFD ? 0xFC78 : 0xFBF8);
    assert.equal(p.ioWrites.length, gate === 0 ? 5 : 16); assert.equal(p.carry, gate === 0 ? 1 : Number(gate >= 0xFFFD));
    assert.equal(p.work, gate === 0 ? 9 : 21); assert.equal(p.overflow, 1);
  }
});
test('All65536 object WORDs test fullX not sign/lowbyte and always replace incomingX', () => {
  const data = fixture({ gate: 0, missing: [0x8001D7] });
  const active = fixture({ gate: 0 });
  for (let x = 0; x <= 65535; x++) {
    const d = x === 0 ? data : active; seedWord(d, 0x1D8, x); const p = prepare(d);
    assert.ok(p.handled); assert.equal(p.x, x); assert.equal(p.a, x === 0 ? 0xF0 : 0x30);
    assert.equal(p.status, x === 0 ? 0xC5 : 0x45); assert.equal(p.ioWrites.length, x === 0 ? 3 : 5);
  }
});
test('Zero gate still needs explicit IO and fulltail but no gate write permission or unused01D7', () => {
  const data = fixture({ gate: 0, objectWord: 0, writeWindows: [], missing: [0x8001D7] }), p = prepare(data);
  assert.equal(p.work, 6); assert.equal(p.outcome, 'oam_prepared'); assert.deepEqual(p.byteWrites, []);
  assert.deepEqual(stores(p), [[0x2102, 0, 2], [0x2104, 0x12, 1], [0x2104, 0xF0, 1]]);
  unchanged(data, { ioMode: null }, 'render_io_context_required', 'oam');
});
test('Transfer11 then lateWORDclear then freshOAMtail retain two DMArequests and four2104 writes', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data);
  assert.deepEqual(data.snapshot(), before); assert.deepEqual(stores(p), [...transfer(0xFB78),
    [0x2102, 0, 2], [0x2104, 0x12, 1], [0x2104, 0x34, 1], [0x2104, 0, 1], [0x2104, 0x30, 1]]);
  assert.deepEqual(p.operations.map(e => [e.kind, e.address & 65535, e.value, e.bytes]),
    [['read', 0x1E8, 0xFFFE, 2], ...transfer(0xFB78).map(([a, v, b]) => ['write', a, v, b]), ['write', 0x1E8, 0, 2],
      ['write', 0x2102, 0, 2], ['read', 0x1D5, 0x12, 1], ['write', 0x2104, 0x12, 1], ['read', 0x1D8, 0x8000, 2],
      ['read', 0x1D7, 0x34, 1], ['write', 0x2104, 0x34, 1], ['write', 0x2104, 0, 1], ['write', 0x2104, 0x30, 1]]);
  commit(data, p); assert.equal(word(data, 0x1E8), 0); assert.equal(word(data, 0x1D8), 0x8000);
  assert.equal(p.transferComplete, undefined);
});
test('Every valid status preservesV/I/Y and uses BYTEflags despite WORDreturnA00F0', () => {
  for (let status = 0; status <= 255; status++) {
    if (status & 0x38) continue;
    for (const gate of [0, 1, 0xFFFC, 0xFFFD, 0xFFFE, 0xFFFF]) for (const objectWord of [0, 1, 0x8000]) {
      const p = prepare(fixture({ gate, objectWord }), { status });
      const c = gate === 0 ? status % 2 : Number(gate >= 65533);
      assert.equal(p.status, (status & 0x7C) | c | (objectWord === 0 ? 128 : 0));
      assert.equal(p.a, objectWord === 0 ? 240 : 48); assert.equal(p.y, entry.y);
    }
  }
});
test('BYTEtail sources never require neighboring01D4/01D6 or ROM/channel data', () => {
  const data = fixture(), p = prepare(data);
  assert.deepEqual(p.readAddresses, [0x7E01D5, 0x7E01D7, 0x7E01D8, 0x7E01D9, 0x7E01E8, 0x7E01E9]);
  for (const a of [0x1D4, 0x1D6, 0x4302, 0x8DFB78]) assert.equal(data.readByte(a).available, false);
});
test('Physical7E/7F writes use actual shared bytes and retain store ordering without DMAadvance', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 65536, data = fixture({ bank, writeWindows: [[base + 0x1E8, base + 0x1E9], [base + 0x2000, base + 0x43FF]] });
    const p = prepare(data, { bank, ioMode: null }); assert.deepEqual(p.ioWrites, []);
    assert.equal(p.operations.filter(e => e.address === base + 0x420B).length, 2); commit(data, p);
    assert.equal(word(data, base + 0x4302), 0xFB78); assert.equal(word(data, base + 0x4305), 0x40);
    assert.equal(word(data, base + 0x2116), 0x100); assert.equal(word(data, base + 0x2102), 0);
    assert.equal(data.readByte(base + 0x2104).value, 0x30); assert.equal(data.readByte(base + 0x420B).value, 1);
    assert.equal(word(data, base + 0x1E8), 0); assert.equal(word(data, base + 0x1D8), 0x8000);
  }
});
test('All128 system DBRs retain actual registeraddresses and common lowWRAM alias', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40) continue;
    const p = prepare(fixture({ bank }), { bank }); assert.ok(p.handled);
    assert.equal(p.ioWrites[0].address, bank * 65536 + 0x4302); assert.deepEqual(p.byteWrites, [[0x7E01E8, 0], [0x7E01E9, 0]]);
  }
});
test('Late missingOAMbytes withhold all11 transferstores and prior gateclear', () => {
  for (const a of [0x8001E8, 0x8001E9, 0x8001D5, 0x8001D7, 0x8001D8, 0x8001D9]) {
    const p = unchanged(fixture({ missing: [a] }), {}, 'render_source_required', a >= 0x8001E8 ? 'gate' : 'oam');
    assert.equal(p.address, 0x7E0000 + (a & 65535));
  }
});
test('Both lateclear bytes require explicit permission; zero gate needs neither', () => {
  for (const writeWindows of [[], [[0x7E01E8, 0x7E01E8]], [[0x7E01E9, 0x7E01E9]]])
    unchanged(fixture({ writeWindows }), {}, 'render_write_window_required', 'clear');
  assert.ok(prepare(fixture({ gate: 0, writeWindows: [] })).handled);
});
test('Every unique physicalregister/clear byte requires permission and failure remains atomic', () => {
  const all = new Set([0x1E8, 0x1E9]);
  for (const [a, , bytes] of [...transfer(0xFB78), [0x2102, 0, 2], [0x2104, 0, 1]]) for (let j = 0; j < bytes; j++) all.add(a + j);
  for (const missing of all) {
    const writeWindows = [...all].filter(a => a !== missing).map(a => [0x7E0000 + a, 0x7E0000 + a]);
    const p = unchanged(fixture({ bank: 0x7E, writeWindows }), { bank: 0x7E, ioMode: null }, 'render_write_window_required');
    assert.equal(p.address, 0x7E0000 + missing);
  }
});
test('All incomplete budgets roll back; exact zero/active object thresholds6/9/18/21 succeed', () => {
  for (const [gate, objectWord, work] of [[0, 0, 6], [0, 1, 9], [1, 0, 18], [1, 1, 21]]) {
    const data = fixture({ gate, objectWord });
    for (let maxWork = 1; maxWork < work; maxWork++) unchanged(data, { maxWork }, 'render_work_budget_required');
    assert.equal(prepare(data, { maxWork: work }).work, work);
  }
});
test('Two protectedJSRbytes suffice; early/late reads and physicalstores reject stackaliases', () => {
  assert.ok(prepare(fixture(), { stackWindow: [0x1FFE, 0x1FFF] }).handled);
  for (const stackWindow of [null, [0x1FFF, 0x1FFF]]) unchanged(fixture(), { stackWindow }, 'render_stack_required');
  for (const [stackWindow, phase] of [[[0x1E8, 0x1E9], 'gate'], [[0x1D4, 0x1D5], 'oam'], [[0x1D7, 0x1D8], 'oam']])
    unchanged(fixture(), { stackWindow }, 'render_stack_alias_required', phase);
  unchanged(fixture({ bank: 0x7E, writeWindows: [[0x7E01E8, 0x7E01E9], [0x7E2000, 0x7E43FF]] }),
    { bank: 0x7E, ioMode: null, stackWindow: [0x2103, 0x2104] }, 'render_stack_alias_required', 'oam');
});
test('Entry and invalidargument checks keep machine declarations explicit', () => {
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 0x10 }, { status: 8 }, { emulation: 1 }, { directPage: 1 }])
    unchanged(fixture(), options, 'render_entry_required');
  for (const options of [{ x: -1 }, { y: 65536 }, { ioMode: 'execute' }, { maxWork: 0 }]) assert.throws(() => prepare(fixture(), options));
});
test('Committed gateclear skips further transfers while repeated OAMtail is still requested', () => {
  const data = fixture(); commit(data, prepare(data)); const second = prepare(data);
  assert.equal(second.outcome, 'oam_prepared'); assert.equal(second.ioWrites.length, 5); assert.equal(second.x, 0x8000);
  assert.deepEqual(second.byteWrites, []); assert.equal(second.carry, 1);
});
test('Shared outer writes own actualWORDhighbyte aliases and freshgate/X; inner result has no commitpayload', () => {
  const data = fixture({ writeWindows: [[0x7E01D4, 0x7E01D9], [0x7E01E8, 0x7E01E9]] });
  const view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), budget = { work: 0, maxWork: 21 };
  view.write(0x1D4, 0xFF); view.write(0x1D5, 0xAB); view.write(0x1D6, 0xEE); view.write(0x1D7, 0xCD);
  view.write(0x1D8, 1); view.write(0x1D9, 0); view.write(0x1E8, 0xFD); view.write(0x1E9, 0xFF);
  const inner = renderC06B(view, entry, budget); assert.equal(inner.sourceOffset, 0xFC78); assert.equal(inner.x, 1);
  assert.deepEqual(stores(inner).slice(-4), [[0x2104, 0xAB, 1], [0x2104, 0xCD, 1], [0x2104, 0, 1], [0x2104, 0x30, 1]]);
  assert.throws(() => data.commit(inner)); commit(data, view.finish(inner)); assert.equal(word(data, 0x1D4), 0xABFF);
});
test('LateC06B boundary withholds prior9E0B inputwrite and all shared effects', () => {
  for (const maxWork of [23, 24]) {
    const data = fixture({ writeWindows: [[0x7E01CA, 0x7E01CB], [0x7E01E8, 0x7E01E9]] });
    const before = data.snapshot(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), budget = { work: 0, maxWork };
    const first = render9E0B(view, { ...entry, ioRead4212: [0], ioRead4218: 0x1234 }, budget);
    if (maxWork === 23) {
      assert.throws(() => renderC06B(view, { ...entry, status: first.status }, budget), e => e.renderBoundary && e.phase === 'oam');
      assert.deepEqual(data.snapshot(), before);
    } else {
      const last = renderC06B(view, { ...entry, status: first.status }, budget);
      commit(data, view.finish(last)); assert.equal(word(data, 0x1CA), 0x1234); assert.equal(word(data, 0x1E8), 0);
    }
  }
});
test('Missing lateOAMsource discards prior inputwrite in same outer plan', () => {
  const data = fixture({ missing: [0x8001D7], writeWindows: [[0x7E01CA, 0x7E01CB], [0x7E01E8, 0x7E01E9]] });
  const before = data.snapshot(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), budget = { work: 0, maxWork: 100 };
  render9E0B(view, { ...entry, ioRead4212: [0], ioRead4218: 0x8000 }, budget);
  assert.throws(() => renderC06B(view, entry, budget), e => e.renderBoundary && e.phase === 'oam' && e.reason === 'render_source_required');
  assert.deepEqual(data.snapshot(), before);
});
test('Owner/revision checks and immutable publicplan retain privatecommit ownership', () => {
  const data = fixture(), p = prepare(data); assert.throws(() => fixture().commit(p));
  assert.ok(Object.isFrozen(p)); assert.ok(Object.isFrozen(p.operations[0])); assert.throws(() => { p.byteWrites[0][1] = 255; });
  data.seed(0x1D5, [0]); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  const first = prepare(data), second = prepare(data); commit(data, first); assert.deepEqual(data.commit(second), { handled: false, reason: 'render_plan_stale' });
});
