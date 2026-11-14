import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView, renderAddress } from '../src/render/data.mjs';
import { prepareRenderA617, prepareRenderA5DB, prepareRenderA5F9,
  renderA617, renderA5DB, renderA5F9 } from '../proof/render/list-a617.mjs';
import { listEntry as entry, listFixture as fixture, listWindows as windows } from './render-list-fixtures.mjs';
import { textWord as word } from './render-text-compose-fixtures.mjs';

const run = (data, extra = {}, fn = prepareRenderA617) => fn({ ...entry, data, ...extra });
const get = (data, a) => data.readByte(a).value | data.readByte(a + 1).value << 8;
const fail = (data, extra, reason, fn = prepareRenderA617) => {
  const before = data.snapshot(), p = run(data, extra, fn); assert.equal(p.handled, false);
  assert.equal(p.reason, reason); assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites', 'operations', 'ioRequests']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
};
const callerOps = p => p.operations.filter(e => e.phase === 'A617');
test('A617 owns one atomic ordered row/cursor/token/text/count plan with WORD PHY/PLY', () => {
  const data = fixture(), before = data.snapshot(), p = run(data, { y: null });
  assert.equal(p.handled, true); assert.deepEqual(data.snapshot(), before);
  assert.equal(p.entries, 1); assert.equal(p.visits, 1); assert.equal(p.numbers, 0);
  assert.equal(p.glyphs, 1); assert.equal(p.rows, 8); assert.equal(p.outputBytes, 66);
  assert.equal(p.work, 880); assert.equal(p.resultReads, 3); assert.equal(p.numberQuotientReads, 0);
  assert.equal(p.pollsFA, 1); assert.equal(p.pollsFC, 1);
  assert.deepEqual([p.a, p.x, p.y, p.bank, p.status], [0, 2, 2, 0x80, 6]);
  assert.deepEqual(p.calls.map(c => [c.name, c.role, c.before.y, c.after.y, c.savedY]),
    [['FAAC', 'line', 0, 0, null], ['FE69', 'line', 0, 0, 0]]);
  assert.deepEqual(callerOps(p).map(e => [e.kind, e.address, e.value]), [
    ['read', 0x801D9B, 1], ['write', 0x801D9D, 1], ['read', 6, 1], ['write', 0x801D9F, 1],
    ['read', 0x801D95, 0], ['read', 0x801D99, 1], ['write', 2, 1],
    ['read', 0x801D9D, 1], ['write', 4, 1], ['write', 0x801D9D, 2],
    ['read', 8, 0x1800], ['read', 10, 0x7E], ['read', 0x7E1800, 0x10], ['write', 2, 0x10],
    ['read', 0x801DA5, 0], ['read', 0x801D9F, 1], ['write', 0x801D9F, 0],
    ['read', 8, 0x1800], ['read', 10, 0x7E], ['read', 0x7E1802, 0], ['read', 0x801D95, 0],
  ]);
  assert.equal(data.commit(p).handled, true); assert.equal(get(data, 0x7E1D9D), 2); assert.equal(get(data, 0x7E1D9F), 0);
});
test('null token still increments row and calls FAAC before gate; does not decrement count or require flags', () => {
  const data = fixture({ tokens: [0], count: 0 }), p = run(data);
  assert.equal(p.handled, true); assert.equal(p.visits, 1); assert.equal(p.entries, 0);
  assert.equal(p.outputBytes, 0); assert.equal(p.calls.length, 1); assert.equal(p.calls[0].name, 'FAAC');
  assert.deepEqual([p.a, p.x, p.y, p.status], [0, 2, 0, 6]);
  assert.ok(!p.readAddresses.includes(0x7E1DA5)); assert.equal(data.commit(p).handled, true);
  assert.equal(get(data, 0x7E1D9F), 0); assert.equal(get(data, 0x7E1D9D), 2);
});
test('zero count runs original do-loop and wraps toFFFF before a later null-token stop', () => {
  const data = fixture({ count: 0 }), p = run(data);
  assert.equal(p.handled, true); assert.equal(p.entries, 1); assert.equal(p.visits, 2);
  assert.equal(p.more, false); assert.equal(p.calls.filter(c => c.name === 'FAAC').length, 2);
  assert.equal(data.commit(p).handled, true); assert.equal(get(data, 0x7E1D9F), 65535); assert.equal(get(data, 0x7E1D9D), 3);
});
test('multiple entries preserve WORD Y against every FE69 return and fresh row/count reads', () => {
  const data = fixture({ tokens: [0x10, 0x10, 0], count: 2, row: 65535 }), p = run(data);
  assert.equal(p.handled, true); assert.equal(p.entries, 2); assert.equal(p.visits, 2); assert.equal(p.y, 4);
  assert.equal(p.outputBytes, 132); assert.equal(p.resultReads, 6);
  assert.deepEqual(p.calls.filter(c => c.name === 'FE69').map(c => [c.before.y, c.after.y, c.savedY]), [[0, 0, 0], [2, 2, 2]]);
  assert.equal(data.commit(p).handled, true); assert.equal(get(data, 0x7E1D9D), 1);
  assert.deepEqual(callerOps(p).filter(e => e.kind === 'write' && e.address === 4).map(e => e.value), [65535, 0]);
});
test('optional numbers execute gate/gap/fresh-number in order with distinct division lists and PLY', () => {
  const data = fixture({ numberFlag: 1, numbers: [5] }), p = run(data);
  assert.equal(p.handled, true); assert.equal(p.entries, 1); assert.equal(p.numbers, 1); assert.equal(p.y, 2);
  assert.equal(p.outputBytes, 185); assert.equal(p.glyphs, 3); assert.equal(p.resultReads, 7);
  assert.equal(p.numberQuotientReads, 1); assert.equal(p.numberRemainderReads, 1);
  assert.deepEqual(p.calls.map(c => [c.name, c.role]),
    [['FAAC', 'line'], ['FE69', 'line'], ['FE69', 'number-gap'], ['FD80', 'number']]);
  assert.deepEqual(callerOps(p).filter(e => e.kind === 'read' && e.address === 0x801900).map(e => e.value), [5, 5]);
  const digit = p.operations.find(e => e.space === 'io' && e.address === 0x804204 && e.phase === 'numberFD80');
  assert.equal(digit.bytes, 2); assert.equal(digit.value, 5);
  const beforeReads = p.calls.map(c => c.resultReads); assert.deepEqual(beforeReads, [1, 3, 5, 7]);
});
test('all nonzero numberflag WORDs include highbyte; zero number skips gap/division and unused sources', () => {
  for (const numberFlag of [1, 0x100, 0x8000, 0xFFFF]) {
    const p = run(fixture({ numberFlag, numbers: [0] })); assert.equal(p.handled, true);
    assert.equal(p.numbers, 0); assert.equal(p.calls.length, 2);
    assert.equal(p.numberQuotientReads, 0); assert.equal(p.resultReads, 3);
  }
  const p = run(fixture(), { ioRead4214Word: null, ioRead4216Byte: null }); assert.equal(p.handled, true);
  assert.ok(!p.readAddresses.includes(0x7E000C));
});
test('number freshly rereads aliased text after gap: observed nonzero gate may becomezero before FD80', () => {
  const data = fixture({ bank: 0x7E, numberFlag: 1, numberPointer: 0x21A0 });
  word(data, 0x7E4214, 0); data.seed(0x7E4216, [5]);
  data.seed(0x9DF07D, [0x80, 0]); // Synthetic newline first: gap overwrites text with0.
  const p = run(data, { bank: 0x7E }); assert.equal(p.handled, true); assert.equal(p.numbers, 1);
  assert.deepEqual(callerOps(p).filter(e => e.kind === 'read' && e.address === 0x7E21A0).map(e => e.value), [65, 0]);
  assert.equal(p.operations.find(e => e.phase === 'numberFD80' && e.kind === 'write' && e.address === 0x7E4204).value, 0);
  assert.equal(p.calls.find(c => c.name === 'FD80').savedY, 0);
});
test('fresh list token sees preceding FE69 writes in one overlay rather than original cached list', () => {
  const data = fixture({ pointer: 0x7E21A0, tokens: [0x10, 0x10, 0], count: 2 }); word(data, 0x9D8000, 0xC142);
  const p = run(data); assert.equal(p.handled, true); assert.equal(p.entries, 1); assert.equal(p.visits, 2);
  assert.equal(p.glyphs, 2); assert.equal(p.more, false);
  assert.ok(callerOps(p).some(e => e.kind === 'read' && e.address === 0x7E21A2 && e.value === 0));
});
test('limit and scroll markers use full WORD width/height minus3 and no saved markerY', () => {
  const p = run(fixture({ tokens: [0, 0x10, 0x10], scroll: 2, count: 1, width: 64, height: 8 }));
  assert.equal(p.handled, true); assert.equal(p.more, true); assert.equal(p.previous, true);
  assert.equal(p.entries, 1); assert.equal(p.glyphs, 3); assert.equal(p.y, 0);
  assert.deepEqual(p.calls.map(c => [c.name, c.role]), [['FAAC', 'line'], ['FE69', 'line'],
    ['FAAC', 'more'], ['FE69', 'more'], ['FAAC', 'previous'], ['FE69', 'previous']]);
  const writes = callerOps(p).filter(e => e.kind === 'write' && [2, 4].includes(e.address)).map(e => [e.address, e.value]);
  assert.deepEqual(writes, [[2, 1], [4, 1], [2, 0x10], [2, 61], [4, 5], [2, 0x707A],
    [2, 61], [4, 0], [2, 0x7077]]);
  assert.equal(p.calls.find(c => c.role === 'more' && c.name === 'FE69').savedY, null);
});
test('previous marker still runs after early nulltoken and uses fresh scroll tail', () => {
  const p = run(fixture({ tokens: [0, 0], scroll: 2 }));
  assert.equal(p.handled, true); assert.equal(p.entries, 0); assert.equal(p.previous, true);
  assert.equal(p.more, false); assert.equal(p.glyphs, 1);
  assert.deepEqual(p.calls.map(c => c.role), ['line', 'previous', 'previous']);
});
test('both mark helpers use independent full wrapping subtraction/shift/add and selected literal token', () => {
  for (const [fn, helper, token] of [[prepareRenderA5DB, 'A5DB', 0x707D], [prepareRenderA5F9, 'A5F9', 0x7074]]) {
    for (const [y, scroll, row, column] of [[2, 0, 1, 1], [0, 1, 65535, 0], [65535, 0, 1, 65535], [1, 65535, 32768, 1]]) {
      const p = run(fixture({ scroll, row, column }), { y }, fn); assert.equal(p.handled, true);
      const expectedRow = (Math.floor((y - scroll + 65536) % 65536 / 2) + row) % 65536;
      const ops = p.operations.filter(e => e.phase === helper);
      assert.deepEqual(ops.filter(e => e.kind === 'write').map(e => [e.address, e.value]),
        [[4, expectedRow], [2, (column + 65535) % 65536], [2, token]]);
      assert.equal(p.helper, helper); assert.equal(p.y, 0); assert.equal(p.status, 0x84);
      assert.equal(p.calls[0].before.y, y); assert.equal(p.calls[1].savedY, null);
    }
  }
});
test('all65536 mark indices preserve unsigned wrap/half and fresh WORD row arithmetic', () => {
  const full = fixture({ scroll: 0x8001, row: 0xFFFF, column: 0 });
  // Synthetic dictionary emits newline immediately, reducing output but keeping the real composer.
  full.seed(0x9DF074, [0x80, 0]);
  const probe = run(full, {}, prepareRenderA5F9), first = new Map(); assert.equal(probe.handled, true);
  for (const e of probe.byteOperations) {
    const a = renderAddress(e.address);
    if (!first.has(a)) first.set(a, e.kind);
  }
  const data = createRenderData({ writeWindows: windows });
  for (const [a, v] of full.snapshot().bytes) if (first.get(a) === 'read') data.seed(a, [v]);
  for (let y = 0; y < 65536; y++) {
    const p = run(data, { y }, prepareRenderA5F9); assert.equal(p.handled, true);
    const row = p.operations.find(e => e.kind === 'write' && e.address === 4).value;
    const difference = (y - 32769 + 65536) % 65536;
    assert.equal(row, (Math.floor(difference / 2) + 65535) % 65536);
    assert.equal(p.calls[0].before.y, y);
  }
});
test('WORD Y wraps two INYs while long pointer target and WORD read carry real banks', () => {
  const data = fixture({ pointer: 0x7EFFFF, tokens: [], scroll: 65535, count: 1 });
  word(data, 0x7FFFFE, 0x10); word(data, 0x7F0000, 0);
  const p = run(data); assert.equal(p.handled, true); assert.equal(p.entries, 1); assert.equal(p.previous, true);
  assert.ok(p.readAddresses.includes(0x7FFFFF)); assert.ok(p.readAddresses.includes(0x7F0000));
  assert.equal(p.calls[1].savedY, 65535);
  assert.ok(callerOps(p).some(e => e.address === 0x7F0000 && e.value === 0));
});
test('all supported callerDBRs use actual relative menu fields and restore original bank', () => {
  for (let bank = 0; bank < 256; bank++) {
    const data = fixture({ bank, tokens: [0] });
    if (!(bank & 0x40) || bank === 0x7E || bank === 0x7F) {
      const p = run(data, { bank }); assert.equal(p.handled, true); assert.equal(p.bank, bank);
      assert.equal(p.a, 0); assert.equal(p.status, 6);
      assert.ok(p.operations.some(e => e.address === bank * 65536 + 0x1D95));
    } else fail(data, { bank }, 'render_address_required');
  }
});
test('both markers restore all supported entryDBRs after local FE69 without claiming entryY preservation', () => {
  for (const fn of [prepareRenderA5DB, prepareRenderA5F9]) for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40 && bank !== 0x7E && bank !== 0x7F) continue;
    const p = run(fixture({ bank }), { bank }, fn); assert.equal(p.handled, true);
    assert.equal(p.bank, bank); assert.equal(p.y, 0);
    assert.equal(p.status & 0x82, bank === 0 ? 2 : bank >= 128 ? 128 : 0);
    assert.equal(p.calls[0].before.y, entry.y);
  }
});
test('DBR-relative indirect number WORD reads carry bank atFFFF and keep the actual mirrored second byte', () => {
  const data = fixture({ tokens: [0, 0x10, 0], scroll: 2, numberPointer: 0xFFFD, numberFlag: 1 });
  data.seed(0x80FFFF, [1]); // Second byte at81:0000 is actual DP00-low2.
  const p = run(data); assert.equal(p.handled, true); assert.equal(p.numbers, 1);
  assert.deepEqual(callerOps(p).filter(e => e.kind === 'read' && e.address === 0x80FFFF).map(e => e.value), [513, 513]);
  assert.ok(p.byteOperations.some(e => e.kind === 'read' && e.address === 0x810000 && e.value === 2));
  assert.equal(p.operations.find(e => e.kind === 'write' && e.space === 'io'
    && e.phase === 'numberFD80' && e.address === 0x804204).value, 513);
});
test('full odd and FFFF DP00 indices keep long header/cursor bankcarry across every callee', () => {
  for (const index of [0, 1, 0xDFDF, 65535]) {
    const p = run(fixture({ index, writeWindows: [...windows, [0x7E2000, 0x7FFFFF]] }));
    assert.equal(p.handled, true); assert.equal(p.x, index);
    assert.ok(p.readAddresses.includes(0x7E2020 + index)); assert.ok(p.readAddresses.includes(0x7E20C0 + index));
  }
});
test('global helper observations use original chronology through numbers and following rows', () => {
  const p = run(fixture({ tokens: [0x10, 0x10, 0], count: 2, numberFlag: 1, numbers: [5, 6] }),
    { ioRead4216Byte: [5, 6], ioRead4214Word: [0, 0], waitRead01FC: [3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8, 0] });
  assert.equal(p.handled, true); assert.equal(p.entries, 2); assert.equal(p.numbers, 2);
  assert.equal(p.numberRemainderReads, 2); assert.equal(p.resultReads, 14); assert.equal(p.pollsFC, 12);
  const digits = p.operations.filter(e => e.phase === 'numberFD80' && e.kind === 'read' && e.space === 'io' && e.bytes === 1);
  assert.deepEqual(digits.map(e => e.value), [5, 6]);
});
test('every initiallyread byte is required after excluding values supplied by earlier overlay stores', () => {
  const complete = fixture({ numberFlag: 1, numbers: [5] }), p = run(complete); assert.equal(p.handled, true);
  const first = new Map();
  for (const e of p.byteOperations) {
    const a = !(e.address >>> 16 & 0x40) && (e.address & 65535) < 0x2000
      ? 0x7E0000 + (e.address & 65535) : e.address;
    if (!first.has(a)) first.set(a, e.kind);
  }
  for (const [omitted, kind] of first) if (kind === 'read') {
    const data = createRenderData({ writeWindows: windows });
    for (const [a, v] of complete.snapshot().bytes) if (a !== omitted) data.seed(a, [v]);
    assert.equal(fail(data, {}, 'render_source_required').address, omitted);
  }
});
test('late row/cursor/glyph/number window failures and exact shared budgets remain atomic', () => {
  const fixtureOptions = { numberFlag: 1, numbers: [5] }, p = run(fixture(fixtureOptions)); assert.equal(p.handled, true);
  assert.equal(run(fixture(fixtureOptions), { maxWork: p.work, maxOutputBytes: p.outputBytes }).handled, true);
  fail(fixture(fixtureOptions), { maxWork: p.work - 1 }, 'render_work_budget_required');
  fail(fixture(fixtureOptions), { maxOutputBytes: p.outputBytes - 1 }, 'render_output_budget_required');
  for (const address of [0x7E1D9D, 0x7E1D9E, 0x7E1D9F, 0x7E1DA0, 0x7E20C2, 0x7E2AF0, 0x7E21A5]) {
    const writeWindows = windows.flatMap(([lo, hi]) => address < lo || address > hi ? [[lo, hi]]
      : [[lo, address - 1], [address + 1, hi]].filter(([a, b]) => a <= b));
    assert.equal(fail(fixture({ ...fixtureOptions, writeWindows }), {}, 'render_write_window_required').address, address);
  }
});
test('each late arithmetic/wait transcript exhaustion discards all preceding caller/callee effects', () => {
  for (const extra of [{ ioMode: null }, { ioRead4216: [] }, { ioRead4216: [0] },
    { ioRead4214Word: [] }, { ioRead4216Byte: [] }, { waitRead01FA: [] }, { waitRead01FC: [] }]) {
    const reason = extra.ioMode === null ? 'render_io_context_required' : Object.keys(extra).some(k => k.startsWith('wait'))
      ? 'render_wait_read_required' : 'render_io_read_required';
    fail(fixture({ numberFlag: 1, numbers: [5] }), extra, reason);
  }
});
test('source-derived16/14 stack guards and entry boundaries reject before any commit', () => {
  for (const [fn, minimum] of [[prepareRenderA617, 16], [prepareRenderA5DB, 14], [prepareRenderA5F9, 14]]) {
    fail(fixture(), { stackWindow: [0x1F00, 0x1F00 + minimum - 2] }, 'render_stack_required', fn);
    assert.equal(run(fixture(), { stackWindow: [0x1F00, 0x1F00 + minimum - 1] }, fn).handled, true);
    for (const extra of [{ bank: null }, { status: null }, { emulation: 1 }, { directPage: 1 }, { status: 0x38 }])
      fail(fixture(), extra, 'render_entry_required', fn);
    fail(fixture(), { stackWindow: [0, 31] }, 'render_stack_alias_required', fn);
  }
  fail(fixture(), { y: null }, 'render_entry_required', prepareRenderA5DB);
  fail(fixture(), { y: null }, 'render_entry_required', prepareRenderA5F9);
  fail(fixture(), { stackWindow: [0x1800, 0x180F] }, 'render_stack_alias_required');
});
test('nonterminating list and count0 do-loop end at shared budget without a synthetic rowcap', () => {
  const data = fixture({ count: 0, tokens: Array(100).fill(0x10) });
  fail(data, { maxWork: 10000 }, 'render_work_budget_required');
});
test('inner list/mark sequence shares observations and fresh DP pointers under one outer commit', () => {
  const owner = fixture({ pointer: 0x7E1800 }); word(owner, 0x7F1800, 0);
  const before = owner.snapshot(), shared = prepareRenderView(owner, [0x7E1F00, 0x7E1FFF]), counts = {};
  const allowance = { work: 0, maxWork: 1000000, outputBytes: 0, maxOutputBytes: 10000 };
  const first = renderA617(shared, { ...entry, observations: counts }, allowance);
  assert.equal(first.resultReads, 3); assert.throws(() => owner.commit(first), /Invalid render plan/);
  shared.write(10, 0x7F);
  const empty = renderA617(shared, { ...entry, observations: counts }, allowance);
  assert.equal(empty.entries, 0); assert.equal(empty.resultReads, 4); assert.ok(empty.readAddresses === undefined);
  const removed = renderA5DB(shared, { ...entry, observations: counts }, allowance);
  const marked = renderA5F9(shared, { ...entry, observations: counts }, allowance);
  assert.equal(removed.resultReads, 7); assert.equal(marked.resultReads, 10);
  assert.equal(marked.pollsFC, 3); assert.equal(marked.pollsFA, 3);
  assert.throws(() => owner.commit(marked), /Invalid render plan/);
  assert.deepEqual(owner.snapshot(), before);
  assert.equal(owner.commit(shared.finish(marked)).handled, true);
});
test('immutable ledgers, stale plans and foreign owners cannot alter payload', () => {
  const data = fixture(), p = run(data); assert.equal(p.handled, true);
  assert.throws(() => p.calls.push({}), TypeError); assert.throws(() => { p.calls[0].before.y = 5; }, TypeError);
  assert.throws(() => { p.byteWrites[0][1] = 99; }, TypeError);
  assert.throws(() => fixture().commit(p), /Invalid render plan/);
  word(data, 6, 2); const before = data.snapshot(); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  assert.deepEqual(data.snapshot(), before);
});
test('malformed mixed-width observation lists and explicit entryY are rejected', () => {
  for (const extra of [{ y: -1 }, { y: 65536 }, { ioMode: 'device' }, { waitMode: 'clock' },
    { ioRead4214Word: Array(1) }, { ioRead4216Byte: [256] }, { ioRead4214: [256] }, { ioRead4216: [65536] },
    { ioRead4214Word: [null] }, { waitRead01FC: Array(1) }])
    assert.throws(() => run(fixture(), extra), /Invalid render list context/);
});
test('generated list/mark probes repeat their synthetic source and closed stack contracts', async () => {
  const report = JSON.parse(await readFile('analysis/render-list-native.json', 'utf8'));
  assert.match(report.scope, /synthetic/); assert.equal(report.probes.length, 6);
  const fns = { A617: prepareRenderA617, A5DB: prepareRenderA5DB, A5F9: prepareRenderA5F9 };
  for (const probe of report.probes) {
    const { fixture: parameters, context, helper, ...expected } = probe;
    const p = fns[helper]({ ...report.declaredInputs, ...context, data: fixture(parameters) });
    const { helper: actualHelper, ...actual } = p;
    if (p.handled) assert.equal(actualHelper, helper);
    assert.deepEqual(actual, expected);
  }
});
