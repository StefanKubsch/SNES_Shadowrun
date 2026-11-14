import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView, renderAddress } from '../src/render/data.mjs';
import { prepareRender91E2, render91E2 } from '../proof/render/selection-91e2.mjs';
import { renderA6C7 } from '../proof/render/menu-a6a5.mjs';
import { choice91E2Entry as entry, choice91E2Fixture as fixture,
  choice91E2Windows as windows, choice91E2Table as table } from './render-91e2-fixtures.mjs';
import { textWord as seed } from './render-text-compose-fixtures.mjs';
import { cpuToOffset } from './rom.mjs';

const run = (data, options = {}) => prepareRender91E2({ ...entry, data, ...options });
const word = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
const root = p => p.operations.filter(e => e.phase.startsWith('choice91E2:'));
const budget = (options = {}) => ({ work: 0, maxWork: 1000000, outputBytes: 0, maxOutputBytes: 65536, ...options });
function fail(data, options, reason, phase) {
  const before = data.snapshot(), p = run(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason, JSON.stringify(p));
  if (phase) assert.equal(p.compositionPhase, phase);
  assert.deepEqual(data.snapshot(), before);
  for (const key of ['operations', 'byteWrites', 'ioRequests', 'calls']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
}
function clone(full, { omit = null, writeWindows = full.snapshot().writeWindows } = {}) {
  const data = createRenderData({ writeWindows });
  for (const [a, v] of full.snapshot().bytes) if (a !== omit) data.seed(a, [v]);
  return data;
}
function minimal(full, p) {
  const first = new Map();
  const bytes = e => Array.from({ length: e.bytes }, (_, i) => ({ ...e, address: e.address + i }));
  const prefix = root(p).filter(e => e.phase.endsWith('prefix')).flatMap(bytes);
  const tail = root(p).filter(e => !e.phase.endsWith('prefix')).flatMap(bytes);
  for (const e of [...prefix, ...p.menuByteOperations, ...tail]) {
    const a = renderAddress(e.address); if (!first.has(a)) first.set(a, e.kind);
  }
  const data = createRenderData({ writeWindows: full.snapshot().writeWindows });
  for (const [a, v] of full.snapshot().bytes) if (first.get(a) === 'read') data.seed(a, [v]);
  return data;
}
// An explicit synthetic outer-provider observation at the fresh post-menu
// DP00 read. The real A6C7 runs fully; no callee result or return is stubbed.
function observedResult(data, value, context = {}) {
  const view = prepareRenderView(data), b = budget(); let copies = 0, injected = false;
  const base = (context.bank ?? entry.bank) * 65536;
  const observed = {
    read(address) {
      if (address === 0 && copies === 2 && !injected) {
        view.write(0, value & 255); view.write(1, value >>> 8); b.work += 2; injected = true;
      }
      return view.read(address);
    },
    write(address, byte) { view.write(address, byte); if (address === base + 0x1CD) copies++; },
  };
  const p = render91E2(observed, { ...entry, ...context }, b);
  assert.equal(injected, true); return { p, plan: view.finish(p), view, b };
}

test('91E2 native pins root43/18, original eight list bytes and normal22-stack proof separately from synthetic probes', async () => {
  const rom = await readFile('Shadowrun (E).smc'), report = JSON.parse(await readFile('analysis/render-91e2-native.json', 'utf8'));
  const raw = rom.subarray(cpuToOffset(0x8091E2, rom.length), cpuToOffset(0x80920D, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), '77b0c30b38d8028f5cc73f7772b11f14ad151187e5483c4a89de6f82ca7b1580');
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase()); assert.equal(report.source.instruction_count, 18);
  assert.deepEqual([...rom.subarray(cpuToOffset(0x80920D, rom.length), cpuToOffset(0x80920D, rom.length) + 8)], table);
  assert.equal(report.stackProof.minimum_protected_stack_bytes, 22); assert.equal(report.stackProof.external_return_assumptions, 0);
  assert.match(report.scope, /synthetic/); assert.match(report.scope, /No CPU\/device/);
  assert.deepEqual(report.probes.map(p => p.handled), [true, true, true, true, false, false, false, false, false, false]);
});

test('91E2 cancel exact prefix, actual menu and fresh tail form one atomic plan with CMPFFFF flags', () => {
  const data = fixture(), before = data.snapshot(), p = run(data);
  assert.equal(p.handled, true); assert.deepEqual(data.snapshot(), before);
  assert.deepEqual(root(p).map(e => [e.kind, e.address, e.value, e.bytes]), [
    ['read', 0x17, 2, 2], ['write', 0, 2, 2], ['write', 2, 2, 2], ['write', 4, 4, 2],
    ['write', 6, 3, 2], ['write', 8, 0x920D, 2], ['write', 10, 0x80, 2],
    ['read', 0, 65535, 2], ['write', 0x801D63, 65535, 2],
  ]);
  assert.deepEqual([p.a, p.x, p.y, p.bank, p.status, p.carry], [65535, 2, 0, 0x80, 7, 1]);
  assert.equal(p.menuOutcome, 'menu_cancelled'); assert.equal(p.outcome, 'choice_cancelled');
  assert.equal(p.outputBytes, 344); assert.equal(p.work, 7004);
  assert.deepEqual(p.calls[0].before, { a: 0x80, x: entry.x, y: entry.y, bank: 0x80, status: 0x45 });
  assert.deepEqual(p.menuCalls.map(c => c.name), ['A617', 'A5F9', 'B0A1', '9E1A', 'A5DB', '9E1A']);
  assert.equal(data.commit(p).handled, true); assert.equal(word(data, 0), 65535); assert.equal(word(data, 0x1D63), 65535);
});

test('91E2 confirmation keeps actual callee X/Y/DBR/V/I, returns fresh A0 and performs no1D63 write', () => {
  const data = fixture({ held: 0x40 }), p = run(data); assert.equal(p.handled, true);
  assert.deepEqual([p.a, p.x, p.y, p.bank, p.status], [0, 0xFF2D, 0x4C, 0x80, 4]);
  assert.equal(p.outcome, 'choice_returned'); assert.equal(p.outputBytes, 342); assert.equal(p.work, 7093);
  assert.equal(root(p).length, 8); assert.equal(p.apuPolls, 3);
  assert.ok(!p.byteWrites.some(([a]) => a === 0x7E1D63 || a === 0x7E1D64));
  assert.equal(data.commit(p).handled, true); assert.equal(word(data, 0x1D63), 0x1234);
});

test('real menu alone matches the inner call registers, operations and incremental budgets', () => {
  for (const held of [0x40, 0x2000]) {
    const data = fixture({ held }), p = run(data), view = prepareRenderView(data), b = budget();
    for (const [a, v] of [[0, 2], [2, 2], [4, 4], [6, 3], [8, 0x920D], [10, 0x80]]) {
      view.write(a, v & 255); view.write(a + 1, v >>> 8);
    }
    const menu = renderA6C7(view, { ...entry, ...p.calls[0].before, stackBytes: 20 }, b);
    assert.deepEqual(p.calls[0].after, { a: menu.a, x: menu.x, y: menu.y, bank: menu.bank, status: menu.status });
    assert.deepEqual(p.operations.slice(7, 7 + menu.operations.length), menu.operations);
    assert.equal(p.work, menu.work + (held === 0x40 ? 8 : 9));
    assert.equal(p.outputBytes, menu.outputBytes + (held === 0x40 ? 12 : 14));
  }
});

test('fresh post-menu DP00 including changed highbyte controls exactFFFF store and fullWORD comparison', () => {
  const data = fixture(), before = data.snapshot();
  for (const value of [0, 1, 0x7FFE, 0x7FFF, 0x8000, 0xFFFE, 0xFFFF]) {
    const { p } = observedResult(data, value); assert.equal(p.menuSelection, 65535); assert.equal(p.selection, value);
    assert.equal(p.a, value); assert.equal(p.carry, Number(value === 65535));
    assert.equal(p.status & 0x82, value === 65535 ? 2 : value >= 0x7FFF ? 128 : 0);
    assert.equal(root(p).at(-1).kind, value === 65535 ? 'write' : 'read');
    assert.equal(p.outputBytes, value === 65535 ? 344 : 342);
  }
  assert.deepEqual(data.snapshot(), before);
});

test('all allowed entry statuses take final CMP flags and preserve returned V/I rather than entry P', () => {
  for (let status = 0; status < 256; status++) if (!(status & 0x38)) for (const held of [0x40, 0x2000]) {
    const p = run(fixture({ held }), { status }); assert.equal(p.handled, true);
    const m = p.calls[0].after; assert.equal(p.status, (m.status & ~0x83) | (held === 0x40 ? 0 : 3));
    assert.equal(p.status & 4, status & 4);
  }
});

test('all256 DBRs use fixedbank80 list and actual returnedbank cancellation store or stop explicitly', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40 && bank !== 0x7E && bank !== 0x7F) {
      fail(fixture(), { bank }, 'render_address_required', 'menu'); continue;
    }
    const writeWindows = bank === 0x7F ? [...windows, [0x7F01CA, 0x7F0211], [0x7F1D63, 0x7F1D64], [0x7F1D95, 0x7F1DA8]] : windows;
    const data = fixture({ bank, writeWindows }), p = run(data, { bank }); assert.equal(p.handled, true, JSON.stringify({ bank, p }));
    assert.equal(p.bank, bank); assert.equal(root(p).at(-1).address, bank * 65536 + 0x1D63);
    assert.ok(p.menuByteOperations.some(e => e.kind === 'read' && e.address === 0x80920D));
    data.commit(p); assert.equal(word(data, bank * 65536 + 0x1D63), 65535);
  }
});

test('confirmation from7F forces actual80 bank while cancel uses7F and keeps7E marker', () => {
  const writeWindows = [...windows, [0x7F01CA, 0x7F0211], [0x7F1D63, 0x7F1D64], [0x7F1D95, 0x7F1DA8]];
  const data = fixture({ bank: 0x7F, held: 0x40, writeWindows });
  for (const [a, v] of [[0x1CA, 0x40], [0x1CC, 0], [0x1CE, 0], [0x1D97, 6], [0x1D63, 0x4567]]) seed(data, a, v);
  const p = run(data, { bank: 0x7F }); assert.equal(p.handled, true); assert.equal(p.bank, 0x80); assert.equal(p.selection, 3);
  data.commit(p); assert.equal(word(data, 0x1D63), 0x4567); assert.equal(word(data, 0x7F1D63), 0x1234);
  const other = fixture({ bank: 0x7F, writeWindows }), q = run(other, { bank: 0x7F }); assert.equal(q.handled, true);
  other.commit(q); assert.equal(word(other, 0x7F1D63), 65535); assert.equal(other.readByte(0x7E1D63).available, false);
});

test('fresh DP17 including its highbyte and outer overlay writes supply the real menu buffer index', () => {
  const data = fixture({ initial: 4 }), view = prepareRenderView(data), b = budget();
  view.write(0x17, 2); view.write(0x18, 0);
  const p = render91E2(view, entry, b); assert.equal(p.initial, 2); assert.equal(root(p)[0].value, 2);
  assert.equal(p.calls[0].before.a, 0x80); assert.equal(p.menuCalls[0].after.x, 2);
  assert.deepEqual(data.commit(view.finish(p)), { handled: true });
  fail(clone(fixture(), { omit: 0x7E0018 }), {}, 'render_source_required', 'prefix');
});

test('every required initial source byte including table/font/input remains an atomic boundary', () => {
  const full = fixture({ held: 0x40 }), p = run(full), small = minimal(full, p); assert.equal(run(small).handled, true);
  for (const [omit] of small.snapshot().bytes) fail(clone(small, { omit }), {}, 'render_source_required');
});

test('missing prefix, realmenu and late cancellation write bytes retain all earlier effects', () => {
  const data = fixture(), p = run(data), small = minimal(data, p);
  const automatic = new Set([0xA2, 0xA3, 0xA5, 0xA6, 0xA8, 0xA9, 0xD8, 0xD9]);
  for (const [missing] of p.byteWrites.filter(([a]) => a < 0x7E00DB && !automatic.has(a - 0x7E0000) || a > 0x7E00F2)) {
    const writeWindows = windows.flatMap(([a, b]) => missing < a || missing > b ? [[a, b]]
      : [...(a < missing ? [[a, missing - 1]] : []), ...(missing < b ? [[missing + 1, b]] : [])]);
    fail(clone(small, { writeWindows }), {}, 'render_write_window_required');
  }
  for (const missing of [0x7E1D63, 0x7E1D64]) {
    const trimmed = windows.filter(([a]) => a !== 0x7E1D63);
    if (missing === 0x7E1D64) trimmed.push([0x7E1D63, 0x7E1D63]);
    fail(clone(data, { writeWindows: trimmed }), {}, 'render_write_window_required', 'cancel');
  }
});

test('22 stackbytes and disjoint root/helper/source/output bytes are required before commit', () => {
  fail(fixture(), { stackWindow: [0x1FEB, 0x1FFF] }, 'render_stack_required');
  for (const a of [0, 0x17, 0x1CA, 0x1D63, 0x1D95, 0x21A0])
    fail(fixture(), { stackWindow: [a, a + 21] }, 'render_stack_alias_required');
  assert.equal(run(fixture(), { stackWindow: [0x1FEA, 0x1FFF], x: null, y: null }).handled, true);
});

test('cumulative work/output budgets include root prefix and late post-menu effects with exact thresholds', () => {
  for (const held of [0x40, 0x2000]) {
    const full = fixture({ held }), p = run(full), data = minimal(full, p);
    for (const maxWork of [1, 6, 7, 8, 100, p.work - 2, p.work - 1]) fail(data, { maxWork }, 'render_work_budget_required');
    assert.equal(run(data, { maxWork: p.work, maxOutputBytes: p.outputBytes }).handled, true);
    for (let maxOutputBytes = 1; maxOutputBytes < p.outputBytes; maxOutputBytes++)
      fail(data, { maxOutputBytes }, 'render_output_budget_required');
  }
});

test('missing chronological observations and no input edge or E382 reset retain the complete outer plan', () => {
  for (const [field, reason] of [['ioRead4216', 'render_io_read_required'], ['waitRead01FA', 'render_wait_read_required'],
    ['waitRead01FC', 'render_wait_read_required'], ['waitRead1C76', 'render_wait_read_required'],
    ['ioRead4217', 'render_io_read_required'], ['ioRead2140', 'render_io_read_required']])
    fail(fixture({ held: 0x40 }), { [field]: [] }, reason, 'menu');
  fail(fixture({ held: 0x3030 }), {}, 'render_reset_source_required', 'menu');
  fail(fixture({ held: 0 }), {}, 'render_wait_read_required', 'menu');
  fail(fixture(), { waitMode: null }, 'render_wait_context_required', 'menu');
  fail(fixture(), { ioMode: null }, 'render_io_context_required', 'menu');
});

test('two real91E2 calls share fresh bytes, global observations, cumulative budgets and one outer commit', () => {
  const data = fixture(), before = data.snapshot(), view = prepareRenderView(data), b = budget(), observations = {};
  const context = { ...entry, observations, waitRead1C76: [1, 2] };
  const first = render91E2(view, context, b); assert.equal(first.counterPolls, 1);
  view.write(0x1CC, 0); view.write(0x1CD, 0); // Explicit synthetic new input edge, independent of counter observation.
  const second = render91E2(view, context, b); assert.equal(second.counterPolls, 2);
  assert.equal(second.resultReads, first.resultReads * 2); assert.equal(second.pollsFA, first.pollsFA * 2);
  assert.equal(second.pollsFC, first.pollsFC * 2);
  assert.equal(second.outputBytes, 688); assert.equal(second.work, first.work * 2);
  assert.deepEqual(data.snapshot(), before); assert.throws(() => data.commit(first), /Invalid render plan/);
  assert.equal(data.commit(view.finish(second)).handled, true); assert.equal(word(data, 0x1D63), 65535);
  const other = fixture(), untouched = other.snapshot(), v = prepareRenderView(other), limited = budget();
  const short = { ...entry, observations: {}, waitRead1C76: [1] };
  render91E2(v, short, limited); v.write(0x1CC, 0); v.write(0x1CD, 0);
  assert.throws(() => render91E2(v, short, limited), e => e.reason === 'render_wait_read_required' && e.compositionPhase === 'menu');
  assert.deepEqual(other.snapshot(), untouched);
});

test('late post-menu highbyte failure and every consumed observation prefix discard the whole plan', () => {
  const data = fixture(), before = data.snapshot(), view = prepareRenderView(data); let copies = 0;
  const observed = {
    read(address) {
      if (address === 1 && copies === 2) throw { renderBoundary: true, reason: 'render_source_required', address: 0x7E0001 };
      return view.read(address);
    },
    write(address, value) { view.write(address, value); if (address === 0x8001CD) copies++; },
  };
  assert.throws(() => render91E2(observed, entry, budget()),
    e => e.reason === 'render_source_required' && e.compositionPhase === 'result');
  assert.equal(copies, 2); assert.deepEqual(data.snapshot(), before);
  const full = fixture({ held: 0x40 }), p = run(full);
  for (const [field, count, reason] of [['ioRead4216', p.resultReads, 'render_io_read_required'],
    ['waitRead01FA', p.pollsFA, 'render_wait_read_required'], ['waitRead01FC', p.pollsFC, 'render_wait_read_required'],
    ['waitRead1C76', p.counterPolls, 'render_wait_read_required'], ['ioRead4217', p.panResultReads, 'render_io_read_required'],
    ['ioRead2140', p.apuPolls, 'render_io_read_required']])
    for (let length = 0; length < count; length++) fail(full, { [field]: entry[field].slice(0, length) }, reason, 'menu');
});

test('foreign copied stale repeated and inner plans cannot apply; all unrelated seeded bytes survive', () => {
  const data = fixture(), p = run(data); assert.throws(() => fixture().commit(p), /Invalid render plan/);
  assert.throws(() => data.commit({ ...p }), /Invalid render plan/); assert.throws(() => { p.byteWrites[0][1] = 99; }, TypeError);
  const inner = render91E2(prepareRenderView(data), entry, budget()); assert.throws(() => data.commit(inner), /Invalid render plan/);
  seed(data, 0x17, 4); const before = data.snapshot(); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  assert.deepEqual(data.snapshot(), before);
  const other = fixture(), initial = other.snapshot(), q = run(other), changed = new Set(q.byteWrites.map(([a]) => a));
  assert.equal(other.commit(q).handled, true); assert.equal(other.commit(q).reason, 'render_plan_stale');
  for (const [a, v] of initial.bytes) if (!changed.has(a)) assert.equal(other.readByte(a).value, v);
});

test('invalid contexts and unknown modes remain explicit; incoming accumulator is overwritten', () => {
  for (const options of [{ x: -1 }, { y: 65536 }, { ioMode: 'execute' }, { waitMode: 'execute' },
    { ioRead4214Word: [65536] }, { ioRead4216Byte: [256] }, { waitRead1C76: Array(1) }, { maxWork: 0 }, { maxOutputBytes: 0 }])
    assert.throws(() => run(fixture(), options), /Invalid/);
  for (const options of [{ bank: null }, { status: null }, { emulation: 1 }, { directPage: 1 }, { status: 8 }, { status: 0x20 }])
    fail(fixture(), options, 'render_entry_required');
  assert.deepEqual(run(fixture(), { a: null }), run(fixture(), { a: 0xFFFF }));
});

test('91E2 public probe report is reproduced exactly through the real APIs', async () => {
  const report = JSON.parse(await readFile('analysis/render-91e2-native.json', 'utf8'));
  for (const { fixture: input, ...expected } of report.probes) assert.deepEqual(run(fixture(input), input), expected);
});
