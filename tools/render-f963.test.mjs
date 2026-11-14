import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderF963, renderF963 } from '../proof/render/allocate-f963.mjs';

const entry = { bank: 0x80, status: 0xC5, a: 0xBEEF, y: 0x1234, emulation: 0,
  directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests', ioRead2134: [2],
  waitMode: 'record-observations', waitRead01F6: [0], waitRead01F8: [0] };
const windows = [[0x7E0000, 0x7E0009], [0x7E00C3, 0x7E00D3], [0x7E01F6, 0x7E0247],
  [0x7E2000, 0x7E21A0], [0x7E23A0, 0x7F23A0]];
const word = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const get = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function fixture({ cursor = 0, col = 1, row = 1, width = 4, height = 3, attributes = 0x800,
  position = 0x2027, bank = 0x80, writeWindows = windows, omit = null, counter = 0 } = {}) {
  const data = createRenderData({ writeWindows }), x = (cursor + 2) & 65535;
  for (const [address, value] of [[0, col], [2, row], [4, width], [6, height], [8, attributes],
    [bank * 65536 + 0x204, cursor], [bank * 65536 + 0x212, position],
    [bank * 65536 + 0x226 + x, counter], [bank * 65536 + 0x1F6, 0], [bank * 65536 + 0x1F8, 0]]) {
    for (let i = 0; i < 2; i++) if (address + i !== omit) data.seed(address + i, [value >>> (8 * i) & 255]);
  }
  if (bank === 0x7E || bank === 0x7F) word(data, bank * 65536 + 0x2134, 2);
  return data;
}
const prepare = (data, extra = {}) => prepareRenderF963({ ...entry, data, ...extra });
function failure(data, extra, reason) {
  const before = data.snapshot(), p = prepare(data, extra);
  assert.equal(p.handled, false); assert.equal(p.reason, reason); assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites', 'operations', 'ioWrites', 'ioRequests']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
}
const requests = p => p.ioRequests.map(e => [e.kind, e.address, e.value, e.bytes]);

test('F963 allocates and composes all three native callees in one chronological atomic plan', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data);
  assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.snapshot(), before);
  assert.equal(p.allocationIndex, 2); assert.equal(p.x, 2); assert.equal(p.a, 0); assert.equal(p.y, 0xC8);
  assert.equal(p.status, 6); assert.equal(p.outputBytes, 24); assert.equal(p.work, p.operations.length);
  assert.equal(p.requestPolls, 1); assert.equal(p.transferPolls, 1); assert.equal(p.productReads, 1);
  assert.deepEqual(requests(p), [['write', 0x80211B, 2, 1], ['write', 0x80211B, 0, 1],
    ['write', 0x80211C, 1, 1], ['read', 0x802134, 2, 2]]);
  assert.equal(data.commit(p).handled, true);
  for (const [address, value] of [[0x204, 2], [0, 2], [0x212, 0x2029], [0x228, 0xFFFF],
    [0x7E2002, 0x42], [0x7E2022, 4], [0x7E2042, 3], [0x7E2122, 16],
    [0x7E2062, 0x2027], [0x7E2082, 0x2027], [0x7E20C2, 0x2027], [0x7E20A2, 2],
    [0x20A, 0x5138], [0x20C, 32], [0x1F6, 0], [0x1F8, 0]]) assert.equal(get(data, address), value);
  for (const offset of [0x20E0, 0x2100, 0x2140, 0x2160]) assert.equal(get(data, 0x7E0002 + offset), 0);
});

test('capacity end preserves A/Y, V/I and workspace; all WORD cursor gates use wrapped +2', () => {
  for (let cursor = 0; cursor < 65536; cursor++) {
    const x = cursor + 2 & 65535; if (x < 32) continue;
    const data = createRenderData(); word(data, 0x204, cursor);
    const p = prepare(data, { ioMode: null, ioRead2134: null, waitMode: null }); assert.ok(p.handled);
    assert.equal(p.outcome, 'capacity_end'); assert.equal(p.a, entry.a); assert.equal(p.y, entry.y);
    assert.equal(p.x, x); assert.equal(p.status, 0x44 | 1 | (x === 32 ? 2 : 0) | ((x - 32 & 0x8000) ? 0x80 : 0));
    assert.equal(p.work, 1); assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioRequests, []);
  }
});

test('cursor FFFE/FFFF wraps to active zero/odd index; full WORD slot counter decrements', () => {
  for (const [cursor, x, counter, expected] of [[0xFFFE, 0, 0, 0xFFFF], [0xFFFF, 1, 0x100, 0xFF], [0x1D, 0x1F, 0x8000, 0x7FFF]]) {
    const data = fixture({ cursor, counter }), p = prepare(data); assert.ok(p.handled, JSON.stringify(p));
    assert.equal(p.allocationIndex, x); assert.equal(p.x, x); data.commit(p);
    assert.equal(get(data, 0x226 + x), expected); assert.equal(get(data, 0x7E2020 + x), 4);
  }
});

test('inclusive capacity wrap uses second actual2134 read while size retains first read', () => {
  for (const [position, first, second, wrapped, final] of [[0x23FD, 2, 7, false, 0x23FF],
    [0x23FE, 2, 7, true, 0x202E], [0xFFFF, 2, 7, false, 1], [0x2400, 0, 0xFFFF, true, 0x2026]]) {
    const data = fixture({ position }), p = prepare(data, { ioRead2134: [first, second] }); assert.ok(p.handled);
    assert.equal(p.wrapped, wrapped); assert.equal(p.productReads, wrapped ? 2 : 1);
    assert.deepEqual(p.ioRequests.filter(e => e.kind === 'read').map(e => e.value), wrapped ? [first, second] : [first]);
    data.commit(p); assert.equal(get(data, 0x212), final); assert.equal(get(data, 0x7E20A2), first);
    assert.equal(get(data, 0x7E2062), wrapped ? 0x2027 : position);
  }
});

test('second result and both completed waits are required only when reached', () => {
  failure(fixture({ position: 0x23FF }), { ioRead2134: [2] }, 'render_io_read_required');
  failure(fixture(), { ioRead2134: null }, 'render_io_read_required');
  failure(fixture(), { ioMode: null }, 'render_io_context_required');
  failure(fixture(), { waitRead01F6: [1] }, 'render_wait_read_required');
  failure(fixture(), { waitRead01F8: [1] }, 'render_wait_read_required');
  failure(fixture(), { waitMode: null }, 'render_wait_context_required');
  failure(fixture(), { waitRead01F8: null, maxWork: 180 }, 'render_work_budget_required');
});

test('explicit result can disagree with geometry; counterwrap needs no guessed acknowledgment', () => {
  const data = fixture(); word(data, 0x1F6, 0xFFFF); word(data, 0x1F8, 0xFFFF);
  const p = prepare(data, { ioRead2134: [11], waitMode: null, waitRead01F6: null, waitRead01F8: null });
  assert.ok(p.handled); assert.equal(p.requestPolls, 1); assert.equal(p.transferPolls, 1); data.commit(p);
  assert.equal(get(data, 0x7E20A2), 11); assert.equal(get(data, 0x212), 0x2032);
  assert.equal(get(data, 0x1F6), 0); assert.equal(get(data, 0x1F8), 0);
  assert.equal(p.operations.some(e => e.space === 'external'), false);
});

test('allocation retains ACCF unconditional zero loops and actual physical result-byte boundaries', () => {
  failure(fixture({ width: 2 }), { maxWork: 100 }, 'render_work_budget_required');
  failure(fixture({ height: 2 }), { maxWork: 100 }, 'render_work_budget_required');
  for (const omit of [0x7E2134, 0x7E2135]) {
    const seeded = fixture({ bank: 0x7E }), data = createRenderData({ writeWindows: windows });
    for (const [address, value] of seeded.snapshot().bytes) if (address !== omit) data.seed(address, [value]);
    failure(data, { bank: 0x7E, ioMode: null }, 'render_source_required');
  }
});

test('explicit external counter observations share the overlay and follow all prior native effects', () => {
  const data = fixture(), p = prepare(data, { waitRead01F6: [0x100, 1, 0], waitRead01F8: [0x100, 0] });
  assert.ok(p.handled); assert.equal(p.requestPolls, 3); assert.equal(p.transferPolls, 2);
  assert.deepEqual(p.operations.filter(e => e.space === 'external').map(e => [e.address & 65535, e.value]),
    [[0x1F6, 0x100], [0x1F6, 1], [0x1F6, 0], [0x1F8, 0x100], [0x1F8, 0]]);
  const at = (kind, address) => p.operations.findIndex(e => e.kind === kind && e.address === address);
  assert.ok(at('write', 0x800212) < at('write', 0x80020A));
  assert.ok(at('read', 0x8001F6) < at('write', 0x7E23E2));
  assert.ok(at('write', 0x7E23E2) < at('write', 0x8001F8));
});

test('signed decrement gates, unsigned clamps and fifth-ASL carry keep original geometry', () => {
  const cases = [[0, 1, 4, 1], [1, 1, 4, 1], [0x8000, 1, 4, 27], [0x8001, 1, 4, 1],
    [0xFFFF, 1, 4, 1], [30, 1, 4, 27], [30, 1, 32, 30], [1, 0x8000, 3, 1],
    [1, 0x8001, 3, 1], [1, 0x800, 32, 1]];
  for (const [col, row, width, expectedCol] of cases) {
    const height = row === 0x800 ? 32 : 3, data = fixture({ col, row, width, height });
    const view = prepareRenderView(data), budget = { work: 0, maxWork: 1000, maxOutputBytes: 65536 };
    assert.throws(() => renderF963(view, { ...entry, ioMode: null }, budget), e => e.reason === 'render_io_context_required');
    const read = address => view.read(address) | view.read(address + 1) << 8;
    const expectedRow = row === 0x8000 ? 24 : row === 0x8001 ? 1 : row;
    assert.equal(read(0), expectedCol); assert.equal(read(2), expectedRow);
    const origin = 2 * ((expectedRow * 32 & 65535) + expectedCol + (expectedRow >>> 11 & 1)) & 65535;
    assert.equal(read(0x7E2002), origin); assert.equal(read(0x7E2122), (width - 2) * 8 & 65535);
  }
});

test('BYTE multiplier parameters truncate and wrap independently of WORD geometry', () => {
  for (const width of [0, 1, 2, 0x100, 0x101, 0x8004, 0xFFFF]) {
    const data = fixture({ width, bank: 0x7E }), view = prepareRenderView(data), seen = [];
    // Capture physical stores and stop at the actual result source before rendering.
    const checking = { read: address => {
      if (address === 0x7E2134) throw { renderBoundary: true, reason: 'render_source_required' };
      return view.read(address);
    }, write: (address, value) => { seen.push([address, value]); view.write(address, value); } };
    assert.throws(() => renderF963(checking, { ...entry, bank: 0x7E, ioMode: null },
      { work: 0, maxWork: 1000, maxOutputBytes: 65536 }), e => e.reason === 'render_source_required');
    assert.equal(view.read(0x7E2022) | view.read(0x7E2023) << 8, width);
    assert.equal(seen.find(([address]) => address === 0x7E211B)[1], (width - 2) & 255);
    assert.deepEqual(seen.filter(([address]) => address === 0x7E211B).map(([, v]) => v), [(width - 2) & 255, 0]);
  }
});

test('physical DBR7E/7F uses actual data bytes for register addresses and actual bank windows', () => {
  for (const bank of [0x7E, 0x7F]) {
    const writeWindows = [...windows, [bank * 65536 + 0x1F6, bank * 65536 + 0x247],
      [bank * 65536 + 0x211B, bank * 65536 + 0x211C]];
    const data = fixture({ bank, writeWindows }), p = prepare(data, { bank, ioMode: null, ioRead2134: null });
    assert.ok(p.handled, JSON.stringify(p)); assert.equal(p.bank, bank); assert.equal(p.productReads, 1);
    assert.deepEqual(p.ioRequests, []); data.commit(p);
    assert.equal(get(data, bank * 65536 + 0x212), 0x2029); assert.equal(data.readByte(bank * 65536 + 0x211B).value, 0);
    assert.equal(get(data, 0x7E2022), 4);
  }
});

test('system banks retain actual request addresses and physical WRAM mirrors', () => {
  for (const bank of [0, 0x3F, 0x80, 0xBF]) {
    const p = prepare(fixture({ bank }), { bank }); assert.ok(p.handled);
    assert.deepEqual(p.ioRequests.map(e => e.address >>> 16), [bank, bank, bank, bank]);
    assert.equal(p.status, 6); assert.equal(p.bank, bank);
  }
  const data = createRenderData(); failure(data, { bank: 0x40 }, 'render_address_required');
});

test('physical2134 result sees earlier indexed geometry alias instead of a copied or calculated value', () => {
  const bank = 0x7E, data = fixture({ bank, cursor: 0x12 }), p = prepare(data, { bank, ioMode: null, ioRead2134: [0xFFFF] });
  assert.ok(p.handled); data.commit(p);
  // X14: width-derived2120+X writes actual2134=16 before its later read.
  assert.equal(get(data, 0x7E20B4), 16); assert.equal(get(data, 0x212), 0x2037);
  assert.equal(p.ioRequests.length, 0); assert.equal(p.operations.find(e => e.kind === 'read' && e.address === 0x7E2134).value, 16);
});

test('missing every reached original source byte discards allocation, requests and output', () => {
  const addresses = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0x800204, 0x800205, 0x800212, 0x800213,
    0x800228, 0x800229, 0x8001F6, 0x8001F7, 0x8001F8, 0x8001F9];
  for (const omit of addresses) failure(fixture({ omit }), {}, 'render_source_required');
});

test('every reached write byte requires a matching window and exact work/output budgets are shared', () => {
  const p = prepare(fixture()); assert.ok(p.handled);
  for (const [address] of p.byteWrites) {
    const writeWindows = windows.flatMap(([first, last]) => address < first || address > last ? [[first, last]]
      : [...(address > first ? [[first, address - 1]] : []), ...(address < last ? [[address + 1, last]] : [])]);
    failure(fixture({ writeWindows }), {}, 'render_write_window_required');
  }
  for (let maxWork = 1; maxWork < p.work; maxWork++) failure(fixture(), { maxWork }, 'render_work_budget_required');
  assert.ok(prepare(fixture(), { maxWork: p.work, maxOutputBytes: p.outputBytes }).handled);
  failure(fixture(), { maxOutputBytes: p.outputBytes - 1 }, 'render_output_budget_required');
});

test('eight protected stack bytes cover rootJSR and both deepest callee paths', () => {
  failure(fixture(), { stackWindow: [0x1000, 0x1006] }, 'render_stack_required');
  assert.ok(prepare(fixture(), { stackWindow: [0x1000, 0x1007] }).handled);
  for (const stackWindow of [[0, 7], [0x204, 0x20B], [0xC3, 0xCA], [0x23E2, 0x23E9]]) {
    failure(fixture(), { stackWindow }, 'render_stack_alias_required');
  }
});

test('unknown entry, malformed observations and stale plans are explicit and unappliable', () => {
  for (const extra of [{ a: null }, { bank: null }, { status: 8 }, { emulation: 1 }, { directPage: 1 }])
    failure(fixture(), extra, 'render_entry_required');
  for (const extra of [{ a: 65536 }, { ioRead2134: [undefined] }, { ioRead2134: Array(2) },
    { waitRead01F8: [-1] }, { ioMode: 'calculate' }, { maxOutputBytes: 0 }]) assert.throws(() => prepare(fixture(), extra), /Invalid render/);
  const data = fixture(), p = prepare(data); word(data, 0x212, 0x1234);
  const before = data.snapshot(); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  assert.deepEqual(data.snapshot(), before);
});

test('checked synthetic probes retain active, fresh-second-result, capacity and late-abort evidence', async () => {
  const report = JSON.parse(await readFile('analysis/render-f963-native.json', 'utf8'));
  assert.match(report.scope, /synthetic/); assert.equal(report.stackProof.minimum_protected_stack_bytes, 8);
  assert.deepEqual(report.probes.map(p => p.handled), [true, true, true, false]);
  assert.equal(report.probes[1].productReads, 2); assert.equal(report.probes[2].outcome, 'capacity_end');
  assert.equal(report.probes[3].reason, 'render_wait_read_required');
});
