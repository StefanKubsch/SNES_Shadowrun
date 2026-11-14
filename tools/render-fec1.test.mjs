import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareRenderFEC1 } from '../proof/render/notice-fec1.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { noticeEntry, noticeFixture } from './render-fec1-fixtures.mjs';
import { heldWord as word, heldGet as get, heldWindows } from './render-be6d-fixtures.mjs';
import { seedOriginalAF1FData } from '../proof/render/original-af1f-data.mjs';

const prepare = (data, extra = {}) => prepareRenderFEC1({ data, ...noticeEntry, ...extra });
const names = p => p.calls.map(c => c.name);
function failure(data, extra, reason) {
  const before = data.snapshot(), p = prepare(data, extra);
  assert.equal(p.handled, false); assert.equal(p.reason, reason, JSON.stringify(p));
  assert.deepEqual(data.snapshot(), before); assert.ok(!('byteWrites' in p)); assert.throws(() => data.commit(p)); return p;
}
test('FEC1 chooses first signedfree6/4/2/0 from fresh slots after text with one outercommit', () => {
  for (let mask = 0; mask < 15; mask++) {
    const occupied = Array.from({ length: 4 }, (_, i) => mask & 1 << i ? 4 : 0x8000);
    const selected = [3, 2, 1, 0].find(i => !(mask & 1 << i)) * 2;
    const data = noticeFixture({ occupied }), before = data.snapshot(), p = prepare(data);
    assert.ok(p.handled); assert.equal(p.slot, selected); assert.equal(p.visits, (6 - selected) / 2 + 1);
    assert.equal(p.outcome, 'notice_inserted'); assert.equal(p.a, 2); assert.equal(p.status & 0x82, 0);
    assert.deepEqual(names(p), ['F963', 'FE69']); assert.deepEqual(data.snapshot(), before);
    assert.ok(!p.calls.some(c => 'commit' in c)); assert.ok(data.commit(p).handled);
    assert.equal(get(data, 0x7E0216 + selected), 2); assert.equal(get(data, 0x21E + selected), 60);
  }
});
test('fullslot selection uses unsignedminimum and last equality, all FFFF ties choose0', () => {
  const rows = [[60, 60, 60, 60], [65535, 65535, 65535, 65535], [0, 65535, 32768, 1],
    [32768, 32767, 65535, 32768], [10, 10, 9, 9], [5, 4, 3, 2]];
  for (const lifetimes of rows) {
    const min = Math.min(...lifetimes), expected = lifetimes.indexOf(min) * 2;
    const data = noticeFixture({ occupied: [4, 4, 4, 4], lifetimes }), p = prepare(data);
    assert.ok(p.handled); assert.equal(p.slot, expected); assert.equal(p.outcome, 'notice_replaced');
    assert.equal(p.visits, 4); assert.deepEqual(names(p), ['F963', 'FE69', 'AD92']);
    data.commit(p); assert.equal(get(data, 0x7E0216 + expected), 2);
  }
});
test('capacityend still saves existing DP00 and runs FE69 without multiplication or transfer', () => {
  const data = noticeFixture(), p = prepare(data, { ioRead2134: null });
  assert.ok(p.handled); assert.equal(p.calls[0].outcome, 'capacity_end'); assert.equal(p.allocation, 2);
  assert.equal(p.productReads, 0); assert.equal(p.pollsF6, 0); assert.equal(p.pollsF8, 0); assert.ok(p.outputBytes > 0);
  assert.deepEqual(names(p), ['F963', 'FE69']);
});
test('active allocation shares actual product and requestwait chronology before text and registration', () => {
  const data = noticeFixture({ cursor: 0 }), p = prepare(data, { waitRead01F6: [3, 0], waitRead01F8: [8, 0] });
  assert.ok(p.handled); assert.equal(p.calls[0].outcome, 'allocation_prepared'); assert.equal(p.allocation, 2);
  assert.equal(p.productReads, 1); assert.equal(p.pollsF6, 2); assert.equal(p.pollsF8, 2);
  assert.ok(p.calls[1].outputBytes > p.calls[0].outputBytes);
  assert.equal(p.byteOperations.at(-1).address, 0x7E021D);
});
test('exact DP08=0400 gate writes0202 before capacityread, neighbouring values do not', () => {
  for (const input of [0, 0x3FF, 0x400, 0x401, 65535]) {
    const data = noticeFixture(); word(data, 8, input); word(data, 0x202, 0xBEEF);
    const p = prepare(data); assert.ok(p.handled); data.commit(p);
    assert.equal(get(data, 0x202), input === 0x400 ? 30 : 0xBEEF);
    if (input === 0x400) assert.ok(p.operations.findIndex(v => v.kind === 'write' && v.address === 0x800202)
      < p.operations.findIndex(v => v.kind === 'read' && v.address === 0x800204));
  }
});
test('textselector retains full WORD ASLwrap and absoluteindexed real bankcarry', () => {
  for (const selector of [0, 1, 0x7FFF, 0x8000, 65535]) {
    const data = noticeFixture(), index = selector << 1 & 65535, address = 0x80D9B8 + index;
    word(data, 10, selector); word(data, address, 0x10);
    const p = prepare(data); assert.ok(p.handled); assert.ok(p.operations.some(v => v.kind === 'read' && v.address === address));
    assert.equal(p.allocation, 2);
  }
});
test('every supported bank reads actual D9B8 source and relative lifetimes with fixed7E slots', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (renderAddress(bank * 65536 + 0xD9B8) === null || renderAddress(bank * 65536 + 0x204) === null) continue;
    const data = noticeFixture({ bank }), p = prepare(data, { bank }); assert.ok(p.handled, `${bank}: ${JSON.stringify(p)}`);
    assert.equal(p.bank, bank); assert.equal(p.slot, 6); data.commit(p);
    assert.equal(get(data, bank * 65536 + 0x224), 60); assert.equal(get(data, 0x7E021C), 2);
  }
});
test('returnA is saved allocationword despite callee scratch changes, final NZ from actual secondPLA', () => {
  for (const allocation of [0, 1, 2, 32768, 65535]) {
    const data = noticeFixture(); word(data, 0, allocation);
    const index = allocation, field = offset => 0x7E0000 + offset + index;
    for (const [offset, value] of [[0x2020, 10], [0x2040, 8], [0x2060, 32], [0x2080, 256],
      [0x20C0, 32], [0x20E0, 0], [0x2100, 0], [0x2140, 0]]) word(data, field(offset), value);
    const p = prepare(data); assert.ok(p.handled, JSON.stringify(p)); assert.equal(p.a, allocation);
    assert.equal(p.status & 0x82, (allocation & 32768 ? 128 : 0) | (allocation === 0 ? 2 : 0));
  }
});
test('eviction rereads chosen slot and restores X around FA3E while preserving actual AD92 Y', () => {
  const data = noticeFixture({ occupied: [6, 8, 10, 12], lifetimes: [40, 10, 30, 20] }), p = prepare(data);
  assert.ok(p.handled); assert.equal(p.slot, 2); assert.equal(p.y, p.calls.at(-1).y);
  const reads = p.operations.filter(v => v.kind === 'read' && v.address === 0x7E0218);
  assert.equal(reads.length, 2); assert.equal(reads[1].value, 8);
  const remove = p.operations.find(v => v.kind === 'write' && v.phase === 'removeFA3E' && v.address === 0x80022E);
  assert.equal(remove.value, 0); data.commit(p); assert.equal(get(data, 0x7E0218), 2);
});
test('lastallocation eviction trims cursor fromfresh backwardflags before unconditional AD92', () => {
  const data = noticeFixture({ occupied: [30, 4, 4, 4], lifetimes: [0, 60, 60, 60] });
  word(data, 0x7E2060, 0x2027);
  const p = prepare(data); assert.ok(p.handled); data.commit(p);
  assert.equal(get(data, 0x204), 65534); assert.equal(get(data, 0x212), 0x2027);
  assert.equal(p.calls.at(-1).name, 'AD92'); assert.equal(p.slot, 0);
});
test('global F8 transcript covers active allocation then eviction without reuse of samples', () => {
  const data = noticeFixture({ cursor: 0, occupied: [4, 4, 4, 4] });
  const p = prepare(data, { waitRead01F8: [3, 0, 4, 0] }); assert.ok(p.handled); assert.equal(p.pollsF8, 4);
  assert.deepEqual(p.waitOperations.filter(v => v.kind === 'read' && v.phase === 'wait' && (v.address & 65535) === 0x1F8).map(v => v.value), [3, 0, 4, 0]);
  failure(noticeFixture({ cursor: 0, occupied: [4, 4, 4, 4] }), { waitRead01F8: [0] }, 'render_wait_read_required');
});
test('every initiallyrequired byte is necessary and missinglate sourcewithholds all effects', () => {
  const sample = noticeFixture({ occupied: [4, 4, 4, 4] }), snapshot = sample.snapshot(), p = prepare(sample);
  assert.ok(p.handled); const written = new Set(), required = new Set();
  for (const event of p.byteOperations) {
    const address = renderAddress(event.address);
    if (event.kind === 'read' && !written.has(address)) required.add(address);
    else if (event.kind === 'write') written.add(address);
  }
  for (const omit of required) {
    const data = createRenderData({ writeWindows: snapshot.writeWindows });
    for (const [address, value] of snapshot.bytes) if (address !== omit) data.seed(address, [value]);
    failure(data, {}, 'render_source_required');
  }
});
test('finalslot writewindow and overlapping protectedstack stop the entire textandreset plan', () => {
  const windows = heldWindows.flatMap(([lo, hi]) => lo <= 0x7E021C && hi >= 0x7E021C
    ? [[lo, 0x7E021B], [0x7E021E, hi]] : [[lo, hi]]);
  failure(noticeFixture({ writeWindows: windows }), {}, 'render_write_window_required');
  failure(noticeFixture(), { stackWindow: [0x210, 0x23F] }, 'render_stack_alias_required');
  failure(noticeFixture(), { stackWindow: [0x1F00, 0x1F1E] }, 'render_stack_required');
  assert.ok(prepare(noticeFixture(), { stackWindow: [0x1F00, 0x1F1F] }).handled);
});
test('exact cumulative workandoutput budgets pass, one less rejects all lateeffects', () => {
  const p = prepare(noticeFixture({ occupied: [4, 4, 4, 4] })); assert.ok(p.handled);
  assert.ok(prepare(noticeFixture({ occupied: [4, 4, 4, 4] }), { maxWork: p.work, maxOutputBytes: p.outputBytes }).handled);
  failure(noticeFixture({ occupied: [4, 4, 4, 4] }), { maxWork: p.work - 1 }, 'render_work_budget_required');
  failure(noticeFixture({ occupied: [4, 4, 4, 4] }), { maxOutputBytes: p.outputBytes - 1 }, 'render_output_budget_required');
});
test('missing arithmetic or waitvalues reject activecontext and all prior writes', () => {
  failure(noticeFixture({ cursor: 0 }), { ioRead2134: [] }, 'render_io_read_required');
  failure(noticeFixture(), { ioRead4216: [] }, 'render_io_read_required');
  failure(noticeFixture(), { waitRead01FC: [] }, 'render_wait_read_required');
  failure(noticeFixture({ occupied: [4, 4, 4, 4] }), { waitRead01F8: [] }, 'render_wait_read_required');
});
test('physical WRAM multiplication uses true bytes, counterwrap does not invent transfercompletion', () => {
  for (const bank of [0x7E, 0x7F]) {
    const data = noticeFixture({ cursor: 0, bank }); word(data, bank * 65536 + 0x2134, 1);
    const p = prepare(data, { bank, ioRead2134: [] }); assert.ok(p.handled, JSON.stringify(p)); assert.equal(p.productReads, 1);
    assert.equal(p.ioRequests.some(v => (v.address & 65535) === 0x2134), false);
  }
  const data = noticeFixture({ cursor: 0 }); word(data, 0x1F8, 65535);
  const p = prepare(data, { waitRead01F8: null }); assert.ok(p.handled); assert.equal(p.pollsF8, 1);
});
test('preparedplans are immutable and staleplans cannot apply any internal or external effect', () => {
  const data = noticeFixture(), p = prepare(data); assert.ok(p.handled); assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.byteWrites)); assert.ok(Object.isFrozen(p.calls));
  word(data, 12, 99); const before = data.snapshot(); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  assert.deepEqual(data.snapshot(), before);
});
test('active AF1F eviction requires explicit stablecontext and retains cumulative outputlimits', async () => {
  const asset = JSON.parse(await readFile(new URL('../assets/render-af1f-data.json', import.meta.url)));
  const fixture = () => {
    const data = noticeFixture({ occupied: [4, 4, 4, 4] }); seedOriginalAF1FData(data, asset);
    for (const [address, value] of [[0x1D61, 1], [0x7E2DE6, 0], [0x7E3C00, 60], [0x7E33DE, 0]]) word(data, address, value);
    return data;
  };
  failure(fixture(), {}, 'render_division_context_required');
  const p = prepare(fixture(), { divisionMode: 'stable-native' }); assert.ok(p.handled);
  assert.equal(p.calls.at(-1).stableDivisions.length, 3);
  failure(fixture(), { divisionMode: 'stable-native', maxOutputBytes: p.outputBytes - 1 }, 'render_output_budget_required');
});
test('nonterminating dictionary traversal ends at sharedworkbudget without committing allocation', () => {
  const data = noticeFixture({ cursor: 0 }); word(data, 0x9D8000, 0); word(data, 0x9D8002, 0);
  data.seed(0x9D8010, Array(100).fill(0));
  failure(data, { maxWork: 3000 }, 'render_work_budget_required');
});
test('entryandobservation validation rejects unsupportedcontext without liveeffects', () => {
  failure(noticeFixture(), { x: null }, 'render_entry_required');
  failure(noticeFixture(), { status: 0x20 }, 'render_entry_required');
  for (const extra of [{ ioRead2134: [65536] }, { ioRead4214: [256] }, { waitRead01F8: [null] }, { divisionMode: 'guessed' }, { y: -1 }])
    assert.throws(() => prepare(noticeFixture(), extra), /Invalid render FEC1 context/);
});
test('recorded manualprobes stay synthetic and latefailure has no plannedbytes', async () => {
  const report = JSON.parse(await readFile(new URL('../analysis/render-fec1-native.json', import.meta.url)));
  assert.equal(report.probes.length, 6); assert.ok(report.probes.every(p => /synthetic/.test(p.qualification)));
  assert.equal(report.probes.at(-1).result.handled, false); assert.equal(report.probes.at(-1).plannedBytes, 0);
});
