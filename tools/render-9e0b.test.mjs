import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRender9E0B, render9E0B } from '../proof/render/input-9e0b.mjs';
import { render8FBA } from '../proof/render/transfer-palette-8fba.mjs';
import { cpuToOffset } from './rom.mjs';
const entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests', ioRead4212: [0], ioRead4218: 0x8000 };
const fixture = (writeWindows = [[0x7E01CA, 0x7E01CB]]) => createRenderData({ writeWindows });
const seedWord = (d, a, v) => d.seed(a, [v & 255, v >>> 8]);
const word = (d, a) => d.readByte(a).value | d.readByte(a + 1).value << 8;
const prepare = (data, options = {}) => prepareRender9E0B({ ...entry, data, ...options });
const commit = (data, p) => { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.commit(p), { handled: true }); };
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  for (const key of ['operations', 'ioReads', 'ioWrites', 'byteWrites']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}
function physical(bank = 0x7E, poll = 0, capture = 0x8000, missing = []) {
  const base = bank * 65536, data = fixture([[base + 0x1CA, base + 0x1CB]]);
  for (const [a, v] of [[0x4212, poll & 255], [0x4213, poll >>> 8], [0x4218, capture & 255], [0x4219, capture >>> 8]])
    if (!missing.includes(a)) data.seed(base + a, [v]);
  return data;
}

test('Native9E0B report separates original15/6 and seven synthetic success/boundary probes', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const raw = rom.subarray(cpuToOffset(0x809E0B, rom.length), cpuToOffset(0x809E1A, rom.length));
  const report = JSON.parse(await readFile(new URL('../analysis/render-9e0b-native.json', import.meta.url), 'utf8'));
  assert.equal(createHash('sha256').update(raw).digest('hex'), '5f9981eb736ef5ecdf0b2b1ee8a1c696f7903bab08c0c9a0a62ce6d03058cecb');
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase()); assert.equal(report.probes.length, 7);
  assert.match(report.scope, /synthetic/); assert.match(report.scope, /No device execution/);
});
test('All65536 pollwords branch only on bit0, with no fabricated transition for busy words', () => {
  const data = fixture();
  for (let poll = 0; poll < 65536; poll++) {
    const p = prepare(data, { ioRead4212: [poll], ioRead4218: 0x1234 });
    if (poll % 2) { assert.equal(p.handled, false); assert.equal(p.reason, 'render_io_read_required'); assert.equal(p.phase, 'poll'); }
    else { assert.ok(p.handled); assert.equal(p.polls, 1); assert.equal(p.a, 0x1234); assert.equal(p.work, 3); }
  }
});
test('All65536 capturedwords preserve full value and derive final N/Z from that WORD', () => {
  const data = fixture();
  for (let a = 0; a < 65536; a++) {
    const p = prepare(data, { ioRead4218: a }); assert.ok(p.handled); assert.equal(p.a, a);
    assert.equal(p.status, 0x45 | (a === 0 ? 2 : a >= 32768 ? 0x80 : 0));
    assert.deepEqual(p.byteWrites, [[0x7E01CA, a % 256], [0x7E01CB, Math.floor(a / 256)]]);
  }
});
test('Fresh chronological polls stop at first clearbit0, then capture and sole store', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data, { ioRead4212: [1, 0xFFFF, 0xFFFE, 1], ioRead4218: 0x3030 });
  assert.deepEqual(data.snapshot(), before); assert.equal(p.polls, 3); assert.equal(p.work, 5);
  assert.deepEqual(p.operations.map(e => [e.kind, e.address & 65535, e.value, e.bytes]),
    [['read', 0x4212, 1, 2], ['read', 0x4212, 0xFFFF, 2], ['read', 0x4212, 0xFFFE, 2], ['read', 0x4218, 0x3030, 2], ['write', 0x1CA, 0x3030, 2]]);
  assert.deepEqual(p.operations.map(e => e.phase), ['poll', 'poll', 'poll', 'capture', 'store']);
  assert.equal(p.ioReads.length, 4); assert.deepEqual(p.ioWrites, []); assert.deepEqual(p.readAddresses, []);
  commit(data, p); assert.equal(word(data, 0x1CA), 0x3030);
});
test('All valid incoming statuses preserve C/V/I/X/Y despite maskedpoll and captured N/Z', () => {
  for (let status = 0; status < 256; status++) {
    if (status & 0x38) continue;
    for (const a of [0, 1, 0x8000, 0xFFFF]) {
      const p = prepare(fixture(), { status, ioRead4212: [0xFFFF, 0xFFFE], ioRead4218: a });
      assert.equal(p.status, (status & 0x7D) | (a === 0 ? 2 : a >= 32768 ? 0x80 : 0));
      assert.equal(p.carry, status & 1); assert.equal(p.overflow, status >>> 6 & 1); assert.equal(p.x, entry.x); assert.equal(p.y, entry.y);
    }
  }
});
test('Missing/empty/exhausted poll transcript and missing capture withhold all reads and store', () => {
  for (const ioRead4212 of [null, [], [1], [1, 0xFFFF]]) unchanged(fixture(), { ioRead4212 }, 'render_io_read_required', 'poll');
  unchanged(fixture(), { ioRead4218: null }, 'render_io_read_required', 'capture');
  unchanged(fixture(), { ioMode: null }, 'render_io_context_required', 'poll');
});
test('Each late destination byte needs ownership but previous01CA/01CC/01CE is not a source', () => {
  for (const windows of [[], [[0x7E01CA, 0x7E01CA]], [[0x7E01CB, 0x7E01CB]]])
    unchanged(fixture(windows), {}, 'render_write_window_required', 'store');
  const data = fixture(); seedWord(data, 0x1CC, 0x1234); seedWord(data, 0x1CE, 0x5678);
  commit(data, prepare(data)); assert.equal(word(data, 0x1CC), 0x1234); assert.equal(word(data, 0x1CE), 0x5678);
});
test('Every incomplete delayed budget rejects atomically at reached phase, exact count succeeds', () => {
  for (let maxWork = 1; maxWork < 5; maxWork++)
    unchanged(fixture(), { ioRead4212: [1, 1, 0], maxWork }, 'render_work_budget_required', maxWork < 3 ? 'poll' : maxWork === 3 ? 'capture' : 'store');
  assert.equal(prepare(fixture(), { ioRead4212: [1, 1, 0], maxWork: 5 }).work, 5);
});
test('Physical7E/7F read actual two-byte registeroffsets and store to actual DBR destination', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 65536, data = physical(bank, 0xFFFE, 0xFFFF);
    const p = prepare(data, { bank, ioMode: null, ioRead4212: [1], ioRead4218: 0 });
    assert.ok(p.handled); assert.equal(p.a, 0xFFFF); assert.equal(p.polls, 1); assert.deepEqual(p.ioReads, []);
    assert.deepEqual(p.readAddresses, [base + 0x4212, base + 0x4213, base + 0x4218, base + 0x4219]);
    commit(data, p); assert.equal(word(data, base + 0x1CA), 0xFFFF); assert.equal(word(data, base + 0x4212), 0xFFFE);
  }
});
test('Every physical sourcebyte including discarded4213 highbyte is mandatory', () => {
  for (const a of [0x4212, 0x4213, 0x4218, 0x4219])
    unchanged(physical(0x7E, 0, 0x8000, [a]), { bank: 0x7E, ioMode: null }, 'render_source_required', a < 0x4218 ? 'poll' : 'capture');
});
test('Persistent physical busy rereads until budget, without accepting supplied clear or capturing', () => {
  const data = physical(0x7E, 1); for (const maxWork of [1, 2, 16])
    unchanged(data, { bank: 0x7E, ioMode: null, ioRead4212: [0], maxWork }, 'render_work_budget_required', 'poll');
});
test('All128 system DBRs use actual addresses; unsupported banks do not accept I/O words', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40) { if (![0x7E, 0x7F].includes(bank)) unchanged(fixture(), { bank }, 'render_address_required', 'poll'); continue; }
    const p = prepare(fixture(), { bank }); assert.ok(p.handled);
    assert.deepEqual(p.ioReads.map(e => e.address), [bank * 65536 + 0x4212, bank * 65536 + 0x4218]);
  }
});
test('Two protectedJSRbytes suffice; missing stack and destination/registeraliases reject', () => {
  assert.ok(prepare(fixture(), { stackWindow: [0x1FFE, 0x1FFF] }).handled);
  for (const stackWindow of [null, [0x1FFF, 0x1FFF]]) unchanged(fixture(), { stackWindow }, 'render_stack_required');
  unchanged(fixture(), { stackWindow: [0x1CA, 0x1CB] }, 'render_stack_alias_required', 'store');
  for (const [stackWindow, phase] of [[[0x4212, 0x4213], 'poll'], [[0x4218, 0x4219], 'capture']])
    unchanged(physical(), { bank: 0x7E, ioMode: null, stackWindow }, 'render_stack_alias_required', phase);
});
test('Invalid contexts/sparse or nonWORD transcripts are rejected; missing entry remains explicit', () => {
  for (const options of [{ ioRead4212: [65536] }, { ioRead4212: Array(1) }, { ioRead4212: 0 }, { ioRead4218: -1 },
    { x: 65536 }, { y: -1 }, { ioMode: 'execute' }, { maxWork: 0 }]) assert.throws(() => prepare(fixture(), options));
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 0x10 }, { status: 8 }, { emulation: 1 }, { directPage: 1 }])
    unchanged(fixture(), options, 'render_entry_required');
});
test('Shared outer view supplies fresh physical sources; inner result has no commitpayload', () => {
  const budget = { work: 0, maxWork: 3 };
  // Source is supplied by the explicit outer owner using its shared writable byteview.
  const writable = fixture([[0x7E01CA, 0x7E01CB], [0x7E4212, 0x7E4219]]);
  seedWord(writable, 0x7E4212, 1); seedWord(writable, 0x7E4218, 0);
  const shared = prepareRenderView(writable, [0x7E1F00, 0x7E1FFF]); shared.write(0x7E4212, 0); shared.write(0x7E4218, 0xFF); shared.write(0x7E4219, 0x80);
  const inner = render9E0B(shared, { ...entry, bank: 0x7E, ioMode: null }, budget);
  assert.equal(inner.a, 0x80FF); assert.throws(() => writable.commit(inner)); assert.equal(word(writable, 0x7E4212), 1);
  commit(writable, shared.finish(inner)); assert.equal(word(writable, 0x7E01CA), 0x80FF);
});
test('Late9E0B failure discards earlier8FBA requests and marker in shared outer plan', () => {
  const data = fixture([[0x7E0140, 0x7E0141], [0x7E01CA, 0x7E01CB]]);
  seedWord(data, 0x140, 0); data.seed(0xF6, [0xFF, 0xFF, 0x8D]); data.seed(0x142, [0xA1]);
  const before = data.snapshot(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), budget = { work: 0, maxWork: 14 };
  assert.equal(render8FBA(view, entry, budget).ioWrites.length, 7);
  assert.throws(() => render9E0B(view, entry, budget), error => error.renderBoundary && error.phase === 'store');
  assert.deepEqual(data.snapshot(), before);
  const completeView = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), completeBudget = { work: 0, maxWork: 15 };
  render8FBA(completeView, entry, completeBudget); const last = render9E0B(completeView, entry, completeBudget);
  commit(data, completeView.finish(last)); assert.equal(word(data, 0x140), 0xFFFF); assert.equal(word(data, 0x1CA), 0x8000);
});
test('Capture is fresh per declared call, including equal values; no edge filtering or cached gate', () => {
  const data = fixture(); commit(data, prepare(data, { ioRead4218: 0x3030 }));
  const same = prepare(data, { ioRead4218: 0x3030 }); assert.equal(same.work, 3); commit(data, same);
  commit(data, prepare(data, { ioRead4218: 0 })); assert.equal(word(data, 0x1CA), 0);
});
test('Owner/revision and frozen read ledger protect private payload and consumed words', () => {
  const data = fixture(), transcript = [1, 0], p = prepare(data, { ioRead4212: transcript });
  assert.ok(Object.isFrozen(p)); assert.ok(Object.isFrozen(p.ioReads)); assert.ok(Object.isFrozen(p.ioReads[0]));
  transcript[0] = 0; assert.equal(p.ioReads[0].value, 1); assert.throws(() => fixture().commit(p));
  assert.throws(() => { p.byteWrites[0][1] = 0; }); data.seed(0x1CA, [0]); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  const first = prepare(data), second = prepare(data); commit(data, first); assert.deepEqual(data.commit(second), { handled: false, reason: 'render_plan_stale' });
});
