import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderACCF, renderACCF } from '../proof/render/entry-accf.mjs';

const entry = { bank: 0x80, status: 0xC5, x: 2, y: 0xBEEF, emulation: 0,
  directPage: 0, stackWindow: [0x1F00, 0x1FFF] };
const windows = [[0x7E00C3, 0x7E00D3], [0x7E23A0, 0x7F23A0]];
const word = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const get = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function fixture({ x = 2, origin = 0x40, width = 4, height = 3, tile = 0xF,
  attributes = 0x10, base = 0, limit = 0xFFFF, writeWindows = windows } = {}) {
  const data = createRenderData({ writeWindows });
  for (const [offset, value] of [[0x2000, origin], [0x2020, width], [0x2040, height],
    [0x2060, base], [0x2080, tile], [0x20A0, limit], [0x2180, attributes]]) word(data, 0x7E0000 + offset + x, value);
  return data;
}
const prepare = (data, extra = {}) => prepareRenderACCF({ ...entry, data, ...extra });
function failure(data, extra, reason, phase) {
  const before = data.snapshot(), p = prepare(data, extra); assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  assert.deepEqual(data.snapshot(), before);
  for (const key of ['operations', 'byteWrites', 'ioWrites']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/);
}
const output = p => p.operations.filter(o => o.kind === 'write' && o.address >= 0x7E23A0);

test('ACCF produces original caps and evolving already-ORed tiles in one atomic entry', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data); assert.equal(p.handled, true);
  assert.deepEqual(data.snapshot(), before); assert.equal(p.a, 0xE011); assert.equal(p.x, 2); assert.equal(p.y, 0xC6);
  assert.equal(p.status, 0x84); assert.equal(p.carry, 0); assert.equal(p.overflow, 0);
  assert.equal(p.outputBytes, 24); assert.equal(p.topVisits, 2); assert.equal(p.rows, 1); assert.equal(p.cells, 2); assert.equal(p.bottomVisits, 2);
  assert.deepEqual(output(p).map(o => o.value), [0x2011, 0x2012, 0x2012, 0x6011,
    0x2013, 0x1F, 0x20, 0x6013, 0xA011, 0xA012, 0xA012, 0xE011]);
  assert.equal(p.work, p.operations.length); assert.deepEqual(p.ioWrites, []);
  assert.equal(data.commit(p).handled, true); assert.equal(get(data, 0xD2), 0x11); assert.equal(get(data, 0xC3), 0xC0);
});

test('wrap comparison is unsigned and inclusive, with a second fresh base read only on reset', () => {
  for (const [tile, base, limit, resets, final] of [[0x10, 0x10, 3, 0, 0x12],
    [0x10, 0x10, 2, 1, 0x10], [0x10, 0x10, 1, 1, 0x10], [0xFFFF, 0x10, 30, 1, 0x10]]) {
    const data = fixture({ tile, base, limit }), p = prepare(data); assert.equal(p.handled, true); assert.equal(p.resets, resets);
    assert.equal(p.operations.filter(o => o.phase === 'wrap' && o.kind === 'read' && o.address === 0x7E2062).length, 1 + resets);
    data.commit(p); assert.equal(get(data, 0xD2), final);
  }
});

test('multiple rows preserve PHX row counter across fresh index reload and reset checks', () => {
  const p = prepare(fixture({ height: 5, limit: 2, tile: 0, attributes: 0 })); assert.equal(p.handled, true);
  assert.equal(p.rows, 3); assert.equal(p.cells, 6); assert.equal(p.resets, 3); assert.equal(p.y, 0x146);
  assert.deepEqual(output(p).filter(o => o.phase === 'middle').map(o => o.value), [0x2003, 0, 1, 0x6003, 0x2003, 0, 1, 0x6003, 0x2003, 0, 1, 0x6003]);
});

test('absolute indexed WORD at7EFFFF crosses into7F; index carries and WORD Y wraps independently', () => {
  for (const origin of [0xDC5F, 0xDC60, 0xFFF0]) {
    const data = fixture({ origin, width: 3, attributes: 0 }), p = prepare(data); assert.equal(p.handled, true);
    assert.equal(output(p)[0].address, 0x7E23A0 + origin);
    data.commit(p); assert.equal(get(data, 0x7E23A0 + origin), 0x2001);
    if (origin === 0xDC5F) assert.equal(data.readByte(0x7F0000).value, 0x20);
    if (origin === 0xFFF0) assert.equal(p.y, 0x74);
  }
});

test('all DBR bytes are restored; writes remain7E and final PLB overrides N/Z with BYTE bank', () => {
  for (let bank = 0; bank < 256; bank++) {
    const p = prepare(fixture(), { bank }); assert.equal(p.handled, true); assert.equal(p.bank, bank);
    assert.equal(p.status, 4 | (bank & 0x80) | (bank === 0 ? 2 : 0)); assert.equal(p.x, entry.x);
  }
});

test('final bottom ADC owns C/V even when final A or X would imply different flags', () => {
  for (const [origin, carry, overflow] of [[0x7F80, 0, 1], [0xFF80, 1, 0], [0, 0, 0]]) {
    const p = prepare(fixture({ origin, width: 3 }), { bank: 0 }); assert.equal(p.handled, true);
    assert.equal(p.carry, carry); assert.equal(p.overflow, overflow);
    assert.equal(p.status, 4 | 2 | carry | overflow << 6);
  }
});

test('full odd XFFFF reads WORD parameters in next bank while scratch stays fixed bank00', () => {
  const p = prepare(fixture({ x: 0xFFFF }), { x: 0xFFFF }); assert.equal(p.handled, true); assert.equal(p.x, 0xFFFF);
  assert.ok(p.readAddresses.includes(0x7F207F)); assert.ok(p.readAddresses.includes(0x7F20A0));
  assert.ok(p.byteWrites.some(([a]) => a === 0x7E00CF));
});

test('top first write aliases the width source and the later width read sees the actual new WORD', () => {
  const data = fixture({ x: 0x400, origin: 0x80, width: 3, attributes: 0 });
  // First cap at2420 aliases width2020+0400 and changes it from3 to2001.
  const view = prepareRenderView(data), budget = { work: 0, maxWork: 30, maxOutputBytes: 65536 };
  assert.throws(() => renderACCF(view, { ...entry, x: 0x400 }, budget), e => e.reason === 'render_work_budget_required' && e.phase === 'top');
  assert.equal(view.read(0xC6) | view.read(0xC7) << 8, 0x1FFF); assert.equal(get(data, 0x7E2420), 3);
});

test('late height read sees an earlier output alias rather than a copied header', () => {
  const data = fixture({ x: 0x400, origin: 0xA0, width: 3, height: 4, attributes: 0 });
  const view = prepareRenderView(data), budget = { work: 0, maxWork: 60, maxOutputBytes: 65536 };
  assert.throws(() => renderACCF(view, { ...entry, x: 0x400 }, budget), e => e.reason === 'render_work_budget_required' && e.phase === 'middle');
  // First cap at2440 changes the height word; full middle loop is not skipped.
  assert.equal(view.read(0x7E2440) | view.read(0x7E2441) << 8, 0x2001); assert.equal(get(data, 0x7E2440), 4);
});

test('fresh wrap base and limit reads see earlier top and middle output aliases', () => {
  const data = fixture({ x: 0x400, origin: 0xC0 }), p = prepare(data, { x: 0x400 });
  assert.equal(p.handled, true); assert.equal(p.resets, 1);
  const wrapReads = p.operations.filter(o => o.kind === 'read' && o.phase === 'wrap');
  assert.equal(wrapReads.find(o => o.address === 0x7E2460).value, 0x2011);
  assert.equal(wrapReads.find(o => o.address === 0x7E24A0).value, 0x2013);
  data.commit(p); assert.equal(get(data, 0xD2), 0x2011);
});

test('zero top and row counts enter their do loops and hit explicit budgets', () => {
  failure(fixture({ width: 2 }), { maxWork: 30 }, 'render_work_budget_required', 'top');
  failure(fixture({ height: 2 }), { maxWork: 80 }, 'render_work_budget_required', 'middle');
  failure(fixture(), { maxOutputBytes: 2 }, 'render_output_budget_required', 'top');
});

test('exact successful work/output budgets pass, every smaller work limit discards all effects', () => {
  const p = prepare(fixture()); assert.equal(p.handled, true);
  for (let maxWork = 1; maxWork < p.work; maxWork++) failure(fixture(), { maxWork }, 'render_work_budget_required');
  assert.equal(prepare(fixture(), { maxWork: p.work, maxOutputBytes: 24 }).handled, true);
  failure(fixture(), { maxOutputBytes: 23 }, 'render_output_budget_required', 'bottom');
});

test('every parameter source byte and scratch/output write byte requires ownership', () => {
  const initial = fixture().snapshot();
  for (const [missing] of initial.bytes) {
    const data = createRenderData({ writeWindows: windows });
    for (const [address, value] of initial.bytes) if (address !== missing) data.seed(address, [value]);
    failure(data, {}, 'render_source_required');
  }
  for (const missing of [0xC3, 0xC4, 0xC6, 0xC7, 0xC9, 0xCA, 0xCC, 0xCD, 0xCF, 0xD0, 0xD2, 0xD3]) {
    const writeWindows = [[0x7E00C3, 0x7E0000 + missing - 1], [0x7E0000 + missing + 1, 0x7E00D3], windows[1]]
      .filter(([lo, hi]) => lo <= hi);
    failure(fixture({ writeWindows }), {}, 'render_write_window_required');
  }
  failure(fixture({ writeWindows: [windows[0], [0x7E23E0, 0x7E23E0]] }), {}, 'render_write_window_required', 'top');
});

test('root/local stack minimum6 and all source/scratch/output stack aliases reject atomically', () => {
  assert.equal(prepare(fixture(), { stackWindow: [0x1FFA, 0x1FFF] }).handled, true);
  failure(fixture(), { stackWindow: [0x1FFB, 0x1FFF] }, 'render_stack_required');
  for (const stackWindow of [[0xCF, 0xD4], [0x2080, 0x2085], [0x23E0, 0x23E5]])
    failure(fixture(), { stackWindow }, 'render_stack_alias_required');
});

test('entry and budgets are explicit; inner results and stale plans cannot commit', () => {
  for (const options of [{ x: null }, { bank: null }, { status: null }, { status: 0x20 }, { emulation: 1 }, { directPage: 1 }])
    failure(fixture(), options, 'render_entry_required');
  for (const options of [{ x: -1 }, { y: 65536 }, { maxOutputBytes: 0 }, { maxWork: 0 }]) assert.throws(() => prepare(fixture(), options));
  const data = fixture(), inner = renderACCF(prepareRenderView(data), entry, { work: 0, maxWork: 1000, maxOutputBytes: 65536 });
  assert.throws(() => data.commit(inner), /Invalid render plan/);
  const p = prepare(data); word(data, 0x7E2062, 5); const before = data.snapshot();
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), before);
});

test('native probe labels synthetic progression, bankcarry and an unconditional-loop boundary', async () => {
  const r = JSON.parse(await readFile('analysis/render-accf-native.json', 'utf8'));
  assert.match(r.scope, /synthetic/); assert.match(r.addressingSource, /contiguous24bit/);
  assert.deepEqual(r.probes.map(p => p.handled), [true, true, false]);
  assert.equal(r.probes[2].reason, 'render_work_budget_required'); assert.equal(r.probes[2].byteWrites, undefined);
});
