import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderC416, renderC416 } from '../proof/render/pan-c416.mjs';
import { panEntry as entry, panFixture as fixture, panWord as word } from './render-c416-fixtures.mjs';

const run = (data, extra = {}) => prepareRenderC416({ ...entry, data, ...extra });
const fail = (data, extra, reason) => {
  const before = data.snapshot(), p = run(data, extra); assert.equal(p.handled, false);
  assert.equal(p.reason, reason); assert.deepEqual(data.snapshot(), before);
  for (const key of ['operations', 'ioRequests', 'byteWrites']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
};
test('C416 selected negative slot retains original WORD4202, two BYTE4217 reads and hidden highA', () => {
  const data = fixture(), before = data.snapshot(), p = run(data); assert.equal(p.handled, true);
  assert.deepEqual(data.snapshot(), before); assert.equal(p.positionUsed, false); assert.equal(p.pan, 128);
  assert.equal(p.multiplier, 64); assert.equal(p.complement, 63); assert.equal(p.panResultReads, 2);
  assert.deepEqual([p.a, p.x, p.y, p.bank, p.status], [0x1122, 0x1122, entry.y, entry.bank, 0x44]);
  assert.equal(p.work, 6); assert.equal(p.outputBytes, 0); assert.equal(p.byteAccesses, 2);
  assert.deepEqual(p.operations.map(e => [e.kind, e.space, e.address, e.value, e.bytes]), [
    ['write', 'io', 0x804202, 64, 2], ['read', 'data', 0, 65535, 2],
    ['write', 'io', 0x804203, 64, 1], ['read', 'io', 0x804217, 17, 1],
    ['write', 'io', 0x804203, 63, 1], ['read', 'io', 0x804217, 34, 1],
  ]);
  assert.equal(data.commit(p).handled, true); assert.deepEqual(data.snapshot(), before);
});
test('all65536 observed result WORD combinations use the two real BYTEs and final WORD TAX NZ', () => {
  const data = fixture();
  for (let value = 0; value < 65536; value++) {
    const p = run(data, { ioRead4217: [Math.floor(value / 256), value % 256] }); assert.equal(p.handled, true);
    assert.equal(p.a, value); assert.equal(p.x, value);
    assert.equal(p.status, 0x44 | (value === 0 ? 2 : 0) | (value >= 32768 ? 128 : 0));
  }
});
test('all65536 entry operands remain full first WORD stores without calculated multiplier results', () => {
  const data = fixture();
  for (let a = 0; a < 65536; a++) {
    const p = run(data, { a }); assert.equal(p.handled, true); assert.equal(p.operations[0].value, a);
    assert.equal(p.operations[0].bytes, 2); assert.equal(p.a, 0x1122); assert.equal(p.pan, 128);
  }
});
test('all65536 wrapping position sums preserve signed first clamp, unsigned255 cap and final BYTE carry', () => {
  const data = fixture({ index: 2 });
  for (let position = 0; position < 65536; position++) {
    word(data, 0x800E82, position); const p = run(data); assert.equal(p.handled, true);
    const sum = (position + 1536) % 65536;
    const expected = sum >= 32768 ? 0 : Math.min(255, Math.floor(sum / 4));
    assert.equal(p.pan, expected); assert.equal(p.multiplier, Math.floor(expected / 2));
    assert.equal(p.complement, 127 - Math.floor(expected / 2)); assert.equal(p.carry, expected % 2);
    assert.equal(p.signedClamp, sum >= 32768); assert.equal(p.overflow, 0);
  }
});
test('independent signed/unsigned wrapping oracle covers both subtracts, borrow/upper clamps and V', () => {
  const values = [0,1,0x3FB,0x3FC,0x3FF,0x400,0x600,0x7FFF,0x8000,0xF9FF,0xFA00,0xFFFF];
  const signed = n => n < 32768 ? n : n - 65536;
  for (const position of values) for (const other of values) for (const scroll of values) {
    const p = run(fixture({ index: 2, position, other, scroll })); assert.equal(p.handled, true);
    const sum = ((position - other + 65536) % 65536 + 1536) % 65536;
    const first = sum >= 32768 ? 0 : sum, borrowed = first < scroll;
    const delta = (first - scroll + 65536) % 65536;
    const expected = borrowed ? 0 : Math.min(255, Math.floor(delta / 4));
    const signedSum = signed(first) - signed(scroll), overflow = signedSum < -32768 || signedSum > 32767;
    assert.equal(p.pan, expected); assert.equal(p.borrowClamp, borrowed);
    assert.equal(p.upperClamp, !borrowed && Math.floor(delta / 4) >= 255);
    assert.equal(p.carry, expected % 2); assert.equal(p.overflow, Number(overflow));
    assert.equal(p.a, 0x1122); assert.equal(p.status & 0x82, 0);
  }
});
test('signednegative full DP00 gate skips all position/camera reads and retains entry overflow', () => {
  for (const index of [0x8000,0x8001,0xFFFF]) for (const status of [0,1,4,0xC5]) {
    const p = run(fixture({ index }), { status }); assert.equal(p.handled, true);
    assert.equal(p.positionUsed, false); assert.equal(p.pan, 128);
    assert.equal(p.overflow, status >>> 6 & 1); assert.equal(p.carry, 0);
    assert.deepEqual(p.readAddresses, [0x7E0000,0x7E0001]);
  }
});
test('nonnegative odd/full positive indices use actual untruncated DBR-relative sources', () => {
  for (const index of [0,1,2,3,0x7FFF]) {
    const data = fixture({ bank: 0x7E, index, writeWindows: [[0x7E4202,0x7E4203]] });
    const p = run(data,
      { bank: 0x7E, ioRead4217: [] });
    assert.equal(p.handled, false); assert.equal(p.reason, 'render_source_required');
    assert.equal(p.address, 0x7E4217); // All original positions were available first.
    data.seed(0x7E4217,[51]);
    const ready = run(data,{bank:0x7E}); assert.equal(ready.handled,true); assert.equal(ready.a,0x3333);
    assert.equal(ready.carry,1); assert.ok(ready.readAddresses.includes(0x7E0E80 + index));
  }
});
test('all MMIO banks retain actual addresses/bank/Y while final flags come from WORD result, not PLB', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40) continue;
    const p = run(fixture(), { bank, ioRead4217: [128, 0] }); assert.equal(p.handled, true);
    assert.equal(p.bank, bank); assert.equal(p.y, entry.y); assert.equal(p.status, 0xC4);
    assert.deepEqual(p.ioRequests.map(e => e.address - bank * 65536), [0x4202,0x4203,0x4217,0x4203,0x4217]);
  }
  for (const bank of [0x40,0x41,0x7D,0xC0,0xFF]) fail(fixture(), { bank }, 'render_address_required');
});
test('physical WRAM register reads use real bytes and explicit windows without MMIO fallback', () => {
  for (const bank of [0x7E,0x7F]) {
    const base = bank * 65536, data = fixture({ bank, writeWindows: [[base + 0x4202,base + 0x4203]] });
    data.seed(base + 0x4217, [51]); const p = run(data, { bank, ioRead4217: null, ioMode: null });
    assert.equal(p.handled, true); assert.equal(p.panResultReads, 0); assert.equal(p.a, 0x3333);
    assert.equal(p.ioRequests.length, 0); assert.equal(data.commit(p).handled, true);
    assert.equal(data.readByte(base + 0x4202).value, 64); assert.equal(data.readByte(base + 0x4203).value, 63);
    fail(fixture({ bank }), { bank }, 'render_write_window_required');
  }
});
test('initial physical WORD register write may be freshly read as later position operand', () => {
  const data = fixture({ bank: 0x7E, index: 0x3382, writeWindows: [[0x7E4202,0x7E4203]] });
  data.seed(0x7E4217, [17]); const p = run(data, { bank: 0x7E, a: 0xABCD }); assert.equal(p.handled, true);
  assert.ok(p.operations.some(e => e.kind === 'read' && e.address === 0x7E4202 && e.value === 0xABCD));
  assert.equal(p.signedClamp, true); assert.equal(p.multiplier, 0); assert.equal(p.complement, 127);
  assert.equal(p.a, 0x1111);
});
test('every initiallyread positive-path byte is required and provider snapshot stays unchanged', () => {
  const complete = fixture({ index: 2 }), p = run(complete); assert.equal(p.handled, true);
  for (const omitted of p.readAddresses) {
    const data = createRenderData();
    for (const [a,v] of complete.snapshot().bytes) if (a !== omitted) data.seed(a,[v]);
    assert.equal(fail(data, {}, 'render_source_required').address, omitted);
  }
});
test('missing BYTE result/mode and exact shared work budgets reject all alreadyrecorded requests', () => {
  fail(fixture(), { ioMode: null }, 'render_io_context_required');
  for (const ioRead4217 of [null,[],[17]]) fail(fixture(), { ioRead4217 }, 'render_io_read_required');
  assert.equal(run(fixture(), { maxWork: 6 }).handled, true); fail(fixture(), { maxWork: 5 }, 'render_work_budget_required');
  assert.equal(run(fixture({ index: 2 }), { maxWork: 9 }).handled, true);
  fail(fixture({ index: 2 }), { maxWork: 8 }, 'render_work_budget_required');
});
test('entry context and original three-byte stack guards remain explicit with all provider aliases', () => {
  for (const extra of [{ a: null }, { y: null }, { bank: null }, { status: null },
    { status: 0x38 }, { emulation: 1 }, { directPage: 1 }]) fail(fixture(), extra, 'render_entry_required');
  for (const stackWindow of [null,[0x1F00,0x1F01]]) fail(fixture(), { stackWindow }, 'render_stack_required');
  assert.equal(run(fixture(), { stackWindow: [0x1F00,0x1F02] }).handled, true);
  fail(fixture(), { stackWindow: [0,2] }, 'render_stack_alias_required');
  fail(fixture({ index: 2 }), { stackWindow: [0x0E82,0x0E84] }, 'render_stack_alias_required');
});
test('inner calls share global BYTE4217 index, budget and one outer owner with no output increment', () => {
  const data = fixture(), before = data.snapshot(), view = prepareRenderView(data,[0x7E1F00,0x7E1FFF]);
  const observations = { panResultReads: 1 }, budget = { work: 7, maxWork: 19, outputBytes: 8, maxOutputBytes: 8 };
  const context = { ...entry, observations, ioRead4217: [255,17,34,51,68] };
  const first = renderC416(view, context, budget), second = renderC416(view, context, budget);
  assert.equal(first.a,0x1122); assert.equal(second.a,0x3344); assert.equal(observations.panResultReads,5);
  assert.equal(first.work,13); assert.equal(second.work,19); assert.equal(second.outputBytes,8);
  assert.deepEqual(data.snapshot(),before); assert.throws(() => data.commit(first), /Invalid render plan/);
  assert.equal(data.commit(view.finish(second)).handled,true);
});
test('stale or foreign plans and immutable requests cannot change private commit payload', () => {
  const data = fixture(), p = run(data); assert.equal(p.handled,true);
  assert.throws(() => { p.ioRequests[0].value = 0; },TypeError);
  assert.throws(() => fixture().commit(p), /Invalid render plan/);
  word(data,0,0x8000); const before = data.snapshot();
  assert.deepEqual(data.commit(p),{handled:false,reason:'render_plan_stale'}); assert.deepEqual(data.snapshot(),before);
});
test('malformed input/observation contexts reject sparse or out-of-BYTE values', () => {
  for (const extra of [{ a: -1 }, { y: 65536 }, { ioMode: 'hardware' },
    { ioRead4217: [256] }, { ioRead4217: [-1] }, { ioRead4217: Array(1) }, { ioRead4217: [null] },
    { ioRead4217: new Uint8Array([1,2]) }]) assert.throws(() => run(fixture(),extra), /Invalid render C416 context/);
});
test('generated C416 probes preserve synthetic scope, original75/38 and three-byte stack contract', async () => {
  const report = JSON.parse(await readFile('analysis/render-c416-native.json','utf8'));
  assert.match(report.scope,/synthetic/); assert.equal(report.source.covered_bytes,75);
  assert.equal(report.source.instruction_count,38); assert.equal(report.stackProof.minimum_protected_stack_bytes,3);
  assert.equal(report.probes.length,4);
  for (const probe of report.probes) {
    const { fixture: parameters, ...expected } = probe;
    assert.deepEqual(run(fixture(parameters),parameters),expected);
  }
});
