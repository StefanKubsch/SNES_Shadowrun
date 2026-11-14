import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRender8F20, render8F20 } from '../proof/render/rows-8f20.mjs';
import { rows8F20Entry, rows8F20Fixture, rows8F20Windows, rows8F20Bytes } from './render-8f20-fixtures.mjs';
const prepare = (data, options = {}) => prepareRender8F20({ ...rows8F20Entry, data, ...options });
const fail = (data, options, reason) => {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  for (const key of ['byteWrites', 'operations', 'readAddresses', 'ioWrites']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
};
const expectedStatus = (bank, status) => (status & 4) | 1 | (bank >= 128 ? 128 : 0) | (bank === 0 ? 2 : 0);
// Independent increasing source-coordinate mapping, opposite to the native
// descending traversal. Values below are synthetic, never original dialog data.
const expectedDestination = n => 0x7F5450 + (n >>> 8) * 512 + (n & 255);

test('8F20 prepares all1792 independent byte mappings, seven fixed rows and finalregisters before one commit', () => {
  const data = rows8F20Fixture(), before = data.snapshot(), p = prepare(data); assert.ok(p.handled);
  assert.equal(p.a, 0xFFFF); assert.equal(p.x, 0x534F); assert.equal(p.y, 0x544F);
  assert.equal(p.bank, rows8F20Entry.bank); assert.equal(p.status, 0x85); assert.equal(p.carry, 1); assert.equal(p.overflow, 0);
  assert.equal(p.passes, 7); assert.equal(p.copiedBytes, 1792); assert.equal(p.outputBytes, 1792); assert.equal(p.work, 3584);
  assert.equal(p.minimumStackBytes, 3); assert.equal(p.byteWrites.length, 1792);
  const writes = new Map(p.byteWrites);
  for (let n = 0; n < 1792; n++) assert.equal(writes.get(expectedDestination(n)), rows8F20Bytes[n]);
  assert.deepEqual(data.snapshot(), before); assert.deepEqual(data.commit(p), { handled: true });
  for (let n = 0; n < 1792; n++) assert.equal(data.readByte(expectedDestination(n)).value, rows8F20Bytes[n]);
});

test('8F20 exact chronological ledger alternates descending fresh BYTE reads/writes within each actual row', () => {
  const p = prepare(rows8F20Fixture()); assert.ok(p.handled); assert.equal(p.operations.length, 3584);
  for (let k = 0; k < 1792; k++) {
    const row = k >>> 8, within = k & 255, value = rows8F20Bytes[1791 - k];
    assert.deepEqual(p.operations[k * 2], { kind: 'read', space: 'data', phase: 'row' + (row + 1),
      address: 0x7F5A4F - k, value, bytes: 1 });
    assert.deepEqual(p.operations[k * 2 + 1], { kind: 'write', space: 'data', phase: 'row' + (row + 1),
      address: 0x7F614F - row * 512 - within, value, bytes: 1 });
  }
  assert.ok(p.operations.every(Object.isFrozen)); assert.deepEqual(p.ioRequests, []);
  assert.deepEqual(p.readAddresses, Array.from({ length: 1792 }, (_, n) => 0x7F5350 + n));
  assert.equal(p.byteWrites[0][0], 0x7F614F); assert.equal(p.byteWrites.at(-1)[0], 0x7F5450);
});

test('8F20 actual overlapping source/destination byte view preserves originals and every untouched bank/gap byte', () => {
  const data = createRenderData({ writeWindows: rows8F20Windows });
  const bytes = Uint8Array.from({ length: 65536 }, (_, n) => ((n >>> 8) * 37 + (n & 255) * 13) & 255);
  data.seed(0x7F0000, bytes); data.seed(0x7E00DB, [0xAB, 0xCD]);
  const p = prepare(data); assert.ok(p.handled); assert.deepEqual(data.commit(p), { handled: true });
  const targets = new Map(Array.from({ length: 1792 }, (_, n) => [expectedDestination(n), bytes[0x5350 + n]]));
  for (let n = 0; n < 65536; n++) assert.equal(data.readByte(0x7F0000 + n).value, targets.get(0x7F0000 + n) ?? bytes[n]);
  assert.equal(data.readByte(0x7E00DB).value, 0xAB); assert.equal(data.readByte(0x7E00DC).value, 0xCD);
});

test('8F20 all256 entryDBRs restore their own BYTE N/Z independently of fixed7F addressing and AFFFF', () => {
  const data = rows8F20Fixture();
  for (let bank = 0; bank < 256; bank++) {
    const p = prepare(data, { bank }); assert.ok(p.handled); assert.equal(p.bank, bank);
    assert.equal(p.status, expectedStatus(bank, rows8F20Entry.status)); assert.equal(p.carry, 1); assert.equal(p.overflow, 0);
    assert.deepEqual(p.ioRequests, []); assert.equal(p.a, 0xFFFF);
  }
});

test('8F20 alladmissible entryP values preserve I, clear V, set C and replace N/Z from actual restoredDBR', () => {
  const data = rows8F20Fixture();
  for (let status = 0; status < 256; status++) if (!(status & 0x38)) for (const bank of [0, 0x7F, 0x80, 0xFF]) {
    const p = prepare(data, { status, bank }); assert.ok(p.handled);
    assert.equal(p.status, expectedStatus(bank, status));
  }
});

test('8F20 all256 synthetic source bytevalues copy unchanged regardless of zero/high/sign bits', () => {
  for (let value = 0; value < 256; value++) {
    const p = prepare(rows8F20Fixture({ sourceBytes: new Uint8Array(1792).fill(value) })); assert.ok(p.handled);
    assert.ok(p.byteWrites.every(([, v]) => v === value)); assert.equal(p.work, 3584); assert.equal(p.status, 0x85);
  }
});

test('8F20 every one of1792 sourcebytes fails atomically at its actual read, including lastbyte after1791 priorwrites', () => {
  for (let missingSource = 0x7F5350; missingSource <= 0x7F5A4F; missingSource++) {
    const data = rows8F20Fixture({ missingSource }), before = data.snapshot(), p = prepare(data);
    assert.equal(p.handled, false); assert.equal(p.reason, 'render_source_required'); assert.equal(p.address, missingSource);
    assert.equal(p.caller, '8F20'); assert.equal(p.pass, (0x7F5A4F - missingSource >>> 8) + 1);
    assert.equal(p.phase, 'row' + p.pass); assert.equal(p.byteWrites, undefined); assert.deepEqual(data.snapshot(), before);
  }
});

test('8F20 every actual destinationbyte requires its own window, including late finalstore without partialwrites', () => {
  for (let n = 0; n < 1792; n++) {
    const missing = expectedDestination(n), writeWindows = rows8F20Windows.flatMap(([a, b]) => {
      if (missing < a || missing > b) return [[a, b]];
      return [...(a < missing ? [[a, missing - 1]] : []), ...(missing < b ? [[missing + 1, b]] : [])];
    });
    const data = rows8F20Fixture({ writeWindows }), before = data.snapshot(), p = prepare(data);
    assert.equal(p.handled, false); assert.equal(p.reason, 'render_write_window_required'); assert.equal(p.address, missing);
    assert.equal(p.byteWrites, undefined); assert.equal(p.pass, 7 - (n >>> 8)); assert.deepEqual(data.snapshot(), before);
  }
});

test('8F20 all3583 workbudget prefixes and1791 outputbudget prefixes retain all livebytes with exact thresholds', () => {
  const data = rows8F20Fixture(), before = data.snapshot();
  for (let maxWork = 1; maxWork < 3584; maxWork++) {
    const p = prepare(data, { maxWork }); assert.equal(p.handled, false); assert.equal(p.reason, 'render_work_budget_required');
    assert.equal(p.byteWrites, undefined);
  }
  for (let maxOutputBytes = 1; maxOutputBytes < 1792; maxOutputBytes++) {
    const p = prepare(data, { maxOutputBytes }); assert.equal(p.handled, false); assert.equal(p.reason, 'render_output_budget_required');
    assert.equal(p.byteWrites, undefined);
  }
  assert.deepEqual(data.snapshot(), before); assert.ok(prepare(data, { maxWork: 3584, maxOutputBytes: 1792 }).handled);
});

test('8F20 requires three root/PHB stackbytes; actual public stack bank7E is disjoint from fixed7F accesses', () => {
  const data = rows8F20Fixture();
  for (const stackWindow of [[0xFFFD, 0xFFFF], [0x5350, 0x5352], [0x614D, 0x614F]]) assert.ok(prepare(data, { stackWindow }).handled);
  for (const stackWindow of [null, [0xFFFE, 0xFFFF], [0xFFFF, 0xFFFF], [2, 1], [0, 65536]])
    fail(data, { stackWindow }, 'render_stack_required');
});

test('8F20 inner shared-view protected-range aliases reject reached sources/stores with all earlierwrites held', () => {
  // Explicitly synthetic outer protected ranges in7F, not physical root CPU
  // stack placement: public root stack guards map to7E and cannot alias7F.
  for (const address of [0x7F5350, 0x7F614F]) {
    const data = rows8F20Fixture(), before = data.snapshot(), view = prepareRenderView(data, [address, address]);
    assert.throws(() => render8F20(view, rows8F20Entry, { work: 0, maxWork: 4000, outputBytes: 0, maxOutputBytes: 2000 }),
      e => e.reason === 'render_stack_alias_required' && e.address === address && e.caller === '8F20');
    assert.deepEqual(data.snapshot(), before);
  }
});

test('8F20 innercopies see real previous8F20 output in later7F sourcebytes with one shared cumulativebudget/commit', () => {
  // Two actual manual helpers under a synthetic outer caller. This supplies
  // no original936C/9F6D caller lifecycle or invented buffer initialization.
  const data = rows8F20Fixture(), before = data.snapshot(), view = prepareRenderView(data);
  const budget = { work: 5, maxWork: 7173, outputBytes: 9, maxOutputBytes: 3593 };
  const first = render8F20(view, rows8F20Entry, budget), second = render8F20(view, { bank: 0, status: 0x40 }, budget);
  assert.equal(first.work, 3589); assert.equal(second.work, 7173); assert.equal(second.outputBytes, 3593);
  assert.equal(first.operations[512].address, 0x7F594F); assert.equal(second.operations[512].address, 0x7F594F);
  assert.equal(first.operations[512].value, rows8F20Bytes[0x5FF]);
  assert.equal(second.operations[512].value, rows8F20Bytes[0x2FF]);
  assert.notEqual(first.operations[512].value, second.operations[512].value); assert.equal(second.status, 3);
  assert.deepEqual(data.snapshot(), before); assert.throws(() => data.commit(first)); assert.throws(() => data.commit(second));
  const combined = view.finish(second); assert.deepEqual(data.commit(combined), { handled: true });
  assert.equal(data.readByte(0x7F5F4F).value, rows8F20Bytes[0x2FF]);
});

test('8F20 outerprovider writes are fresh; inneroutputcounter initializes and cumulative exact limits include previous owners', () => {
  const data = rows8F20Fixture({ writeWindows: [...rows8F20Windows, [0x7F5A4F, 0x7F5A4F]] }), view = prepareRenderView(data);
  view.write(0x7F5A4F, 0xAB);
  const budget = { work: 3, maxWork: 3587, outputBytes: 17, maxOutputBytes: 1809 };
  const p = render8F20(view, rows8F20Entry, budget); assert.equal(p.operations[0].value, 0xAB);
  assert.equal(p.outputBytes, 1809); assert.equal(p.work, 3587); assert.deepEqual(data.commit(view.finish(p)), { handled: true });
  assert.equal(data.readByte(0x7F614F).value, 0xAB);
  const other = rows8F20Fixture(), q = render8F20(prepareRenderView(other), rows8F20Entry, { work: 0, maxWork: 3584, maxOutputBytes: 1792 });
  assert.equal(q.outputBytes, 1792);
});

test('8F20 secondinner late output/work budget failure retains every earliercopy in outeroverlay only', () => {
  for (const [maxWork, maxOutputBytes, reason] of [[7167, 3584, 'render_work_budget_required'], [7168, 3583, 'render_output_budget_required']]) {
    const data = rows8F20Fixture(), before = data.snapshot(), view = prepareRenderView(data);
    const budget = { work: 0, maxWork, outputBytes: 0, maxOutputBytes };
    const first = render8F20(view, rows8F20Entry, budget); assert.ok(first.handled);
    assert.throws(() => render8F20(view, rows8F20Entry, budget), e => e.reason === reason && e.phase === 'row7' && e.pass === 7);
    assert.deepEqual(data.snapshot(), before); assert.throws(() => data.commit(first));
  }
});

test('8F20 foreign/copied/stale/replayed plans reject and immutable public ledgers cannot change privatecommit payload', () => {
  const data = rows8F20Fixture(), p = prepare(data); assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.byteWrites)); assert.ok(p.byteWrites.every(Object.isFrozen));
  assert.throws(() => rows8F20Fixture().commit(p)); assert.throws(() => data.commit({ ...p }));
  assert.throws(() => { p.byteWrites[0][1] = 0; }); assert.throws(() => { p.status = 0; });
  data.seed(0x7F5350, [1]); const before = data.snapshot(); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  assert.deepEqual(data.snapshot(), before); const next = prepare(data); assert.deepEqual(data.commit(next), { handled: true });
  assert.deepEqual(data.commit(next), { handled: false, reason: 'render_plan_stale' });
});

test('8F20 entry requires no incomingA/X/Y or IO observations, rejects unknown/unsupported/invalid contexts beforeeffects', () => {
  const data = rows8F20Fixture(); assert.ok(prepare(data).handled);
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 0x10 }, { status: 8 },
    { emulation: 1 }, { directPage: 1 }]) fail(data, options, 'render_entry_required');
  for (const options of [{ data: null }, { bank: -1 }, { bank: 256 }, { status: 256 }, { status: -1 },
    { maxWork: 0 }, { maxWork: 1.5 }, { maxOutputBytes: 0 }, { maxOutputBytes: 1.5 }]) {
    const before = data.snapshot(); assert.throws(() => prepare(data, options)); assert.deepEqual(data.snapshot(), before);
  }
});

test('8F20 ten publicprobes are explicitly synthetic with source26/13, stack3, five no-effect boundaries', async () => {
  const report = JSON.parse(await readFile('analysis/render-8f20-native.json', 'utf8'));
  assert.match(report.scope, /explicitly synthetic/); assert.match(report.scope, /No CPU\/device\/clock/);
  assert.equal(report.source.covered_bytes, 26); assert.equal(report.source.instruction_count, 13);
  assert.equal(report.stackProof.minimum_protected_stack_bytes, 3); assert.equal(report.stackProof.external_return_assumptions, 0);
  assert.deepEqual(report.probes.map(p => p.handled), [true, true, true, true, false, true, false, false, false, false]);
  for (const p of report.probes.filter(p => !p.handled)) assert.equal(p.byteWrites, undefined);
});
