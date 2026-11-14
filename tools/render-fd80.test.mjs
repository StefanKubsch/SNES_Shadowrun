import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderFD80, renderFD80 } from '../proof/render/number-fd80.mjs';
import { numberEntry as entry, numberFixture as fixture } from './render-fd80-fixtures.mjs';
import { textWord as word, textWindows as windows } from './render-text-compose-fixtures.mjs';

const run = (data, extra = {}) => prepareRenderFD80({ ...entry, data, ...extra });
const numberOps = p => p.operations.filter(o => o.phase === 'numberFD80');
const empty = { ioRead4214Word: [1, 1, 1, 1, 0], ioRead4216Byte: [1, 1, 1, 1, 208] };
const fail = (data, extra, reason) => {
  const before = data.snapshot(), p = run(data, extra);
  assert.equal(p.handled, false); assert.equal(p.reason, reason); assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites', 'operations', 'ioRequests']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
};
test('FD80 preserves original mixed-width chronological reads, forward null copy and one atomic composer', () => {
  const data = fixture(), before = data.snapshot(), p = run(data);
  assert.equal(p.handled, true); assert.deepEqual(data.snapshot(), before);
  assert.equal(p.divisions, 1); assert.equal(p.firstCharacterIndex, 4); assert.equal(p.copiedBytes, 2);
  assert.equal(p.glyphs, 1); assert.equal(p.rows, 8); assert.equal(p.numberQuotientReads, 1);
  assert.equal(p.numberRemainderReads, 1); assert.equal(p.resultReads, 2); assert.equal(p.quotientReads, 0);
  assert.equal(p.pollsFA, 1); assert.equal(p.pollsFC, 1); assert.equal(p.outputBytes, 69);
  assert.deepEqual(numberOps(p).map(o => [o.kind, o.space, o.address, o.value, o.bytes]), [
    ['write', 'data', 0x7E21A5, 0, 2], ['read', 'data', 2, 5, 2],
    ['write', 'io', 0x804204, 5, 2], ['write', 'io', 0x804206, 10, 1],
    ['read', 'io', 0x804216, 5, 1], ['write', 'data', 0x7E21A4, 53, 1],
    ['read', 'io', 0x804214, 0, 2], ['read', 'data', 0x7E21A4, 53, 1],
    ['write', 'data', 0x7E21A0, 53, 1], ['read', 'data', 0x7E21A5, 0, 1],
    ['write', 'data', 0x7E21A1, 0, 1],
  ]);
  assert.deepEqual(p.composerEntry, { a: 0, x: 5, y: 1, bank: 0x7E, status: 7 });
  assert.equal(p.bank, entry.bank); assert.equal(p.status, 0x84); assert.equal(p.a, 0); assert.equal(p.x, 2);
  assert.equal(p.byteAccesses, p.byteOperations.length);
  assert.ok(p.byteOperations.some(e => e.phase === 'FB39' && e.kind === 'read' && e.address === 0x7E21A0 && e.value === 53));
  assert.equal(data.commit(p).handled, true); assert.equal(data.readByte(0x7E21A0).value, 53);
  assert.equal(data.readByte(0x7E21A1).value, 0); assert.equal(data.readByte(0x7E21A6).value, 0);
});
test('WORD quotient stays full, feeds next dividend and five digits skip copy retaining entryY', () => {
  const data = fixture({ number: 65535 }), p = run(data, {
    ioRead4214Word: [6553, 655, 65, 6, 0], ioRead4216Byte: [5, 3, 5, 5, 6] });
  assert.equal(p.handled, true); assert.equal(p.divisions, 5); assert.equal(p.copiedBytes, 0);
  assert.equal(p.firstCharacterIndex, 0); assert.equal(p.composerEntry.y, entry.y); assert.equal(p.composerEntry.a, 0);
  assert.deepEqual(numberOps(p).filter(e => e.kind === 'write' && e.space === 'io' && e.bytes === 2).map(e => e.value),
    [65535, 6553, 655, 65, 6]);
  assert.equal(data.commit(p).handled, true);
  assert.deepEqual(Array.from({ length: 7 }, (_, i) => data.readByte(0x7E21A0 + i).value), [54, 53, 53, 51, 53, 0, 0]);
});
test('all65536 dividends use fresh full DP02; results remain explicitly independent', () => {
  const data = fixture();
  for (let n = 0; n < 65536; n++) {
    word(data, 2, n); const p = run(data, { ioRead4214Word: [0], ioRead4216Byte: [208] });
    assert.equal(p.handled, true); assert.equal(numberOps(p)[2].value, n);
    assert.equal(p.divisions, 1); assert.equal(p.glyphs, 0);
  }
});
test('all65536 observed WORD quotients decide original repetition without BYTE truncation', () => {
  const data = fixture();
  for (let q = 0; q < 65536; q++) {
    const p = run(data, { ioRead4214Word: [q, 0], ioRead4216Byte: [208, 208] });
    assert.equal(p.handled, true); assert.equal(p.divisions, q === 0 ? 1 : 2);
    const dividends = numberOps(p).filter(e => e.kind === 'write' && e.space === 'io' && e.bytes === 2);
    if (q !== 0) assert.equal(dividends[1].value, q);
  }
});
test('all256 BYTE remainders wrap character addition without quotient/list-width contamination', () => {
  const data = fixture();
  for (let remainder = 0; remainder < 256; remainder++) {
    // Put the variable remainder atX4 and wrapped zero atX0 to close FB39.
    const zero = run(data, { ...empty, ioRead4216Byte: [remainder, 208, 208, 208, 208] });
    assert.equal(zero.handled, true);
    const write = numberOps(zero).find(e => e.address === 0x7E21A4 && e.kind === 'write');
    assert.equal(write.value, (48 + remainder) % 256);
  }
});
test('zero input still divides once; BYTE character zero and exact X0 copy gate are preserved', () => {
  const p = run(fixture({ number: 0 }), { ioRead4214Word: [0], ioRead4216Byte: [0] });
  assert.equal(p.handled, true); assert.equal(p.glyphs, 1); assert.equal(p.divisions, 1);
  const zero = run(fixture(), { ioRead4216Byte: [208] });
  assert.equal(zero.handled, true); assert.equal(zero.copiedBytes, 1); assert.equal(zero.glyphs, 0);
  const five = run(fixture(), empty); assert.equal(five.handled, true);
  assert.equal(five.copiedBytes, 0); assert.equal(five.composerEntry.y, entry.y);
});
test('BYTE ADC overflow survives CPX and fresh copy while hidden highA is replaced by WORD quotient', () => {
  for (const remainder of [0, 79, 80, 127, 128, 207, 208, 255]) {
    const data = fixture({ number: 0xABCD }), character = (48 + remainder) % 256;
    if (character !== 0) {
      word(data, 0x81AC0C + character, 4);
      data.seed(0x95F2D0 + character * 8, [15, 1, 2, 4, 8, 16, 32, 64]);
    }
    const p = run(data, { ioRead4216Byte: [remainder] }); assert.equal(p.handled, true);
    assert.equal(p.composerEntry.a, 0);
    assert.equal(p.composerEntry.status & 0x41, 1 | (remainder >= 80 && remainder <= 127 ? 64 : 0));
    assert.equal(numberOps(p)[2].value, 0xABCD);
  }
});
test('sixth digit underflows X and carries long address into7F; fresh copy includes its zero', () => {
  const data = fixture(), p = run(data, { ioRead4214Word: [1, 1, 1, 1, 1, 0],
    ioRead4216Byte: [1, 1, 1, 1, 1, 208] });
  assert.equal(p.handled, true); assert.equal(p.divisions, 6); assert.equal(p.firstCharacterIndex, 65535);
  assert.equal(p.copiedBytes, 1); assert.equal(p.composerEntry.x, 65535); assert.equal(p.glyphs, 0);
  assert.ok(p.byteOperations.some(e => e.kind === 'write' && e.address === 0x7F219F && e.value === 0));
  assert.ok(p.byteOperations.some(e => e.kind === 'read' && e.address === 0x7F219F && e.value === 0));
});
test('fresh forward copy wraps X separately and sees prior writes; no fixed digit limit', () => {
  const options = { ioRead4214Word: [1, 1, 1, 1, 1, 0], ioRead4216Byte: [208, 1, 1, 1, 1, 2], maxWork: 100 };
  // The first store replaces21A0=0; after Xwrap each store replaces the next
  // source byte. The original forward copy propagates50 instead of finding0.
  const data = fixture(); fail(data, options, 'render_work_budget_required');
  const view = prepareRenderView(data), reads = [];
  const shared = { write: (a, v) => view.write(a, v), read: a => {
    const v = view.read(a); reads.push([a, v]); return v;
  } };
  assert.throws(() => renderFD80(shared, { ...entry, ...options },
    { work: 0, maxWork: 100, outputBytes: 0, maxOutputBytes: 1000 }),
  e => e.reason === 'render_work_budget_required');
  assert.deepEqual(reads.slice(2, 5), [[0x7F219F, 50], [0x7E21A0, 50], [0x7E21A1, 50]]);
});
test('all MMIO DBRs preserve actual request bank and restore final PLB flags; others fail explicitly', () => {
  for (let bank = 0; bank < 256; bank++) {
    const data = fixture();
    if (!(bank & 0x40)) {
      const p = run(data, { bank }); assert.equal(p.handled, true); assert.equal(p.bank, bank);
      assert.equal(p.ioRequests[0].address, bank * 65536 + 0x4204);
      assert.equal(p.status & 0x82, bank >= 128 ? 128 : bank === 0 ? 2 : 0);
      assert.ok(p.ioRequests.slice(4).every(e => e.address >= 0x804200 && e.address <= 0x804216));
    } else if (bank !== 0x7E && bank !== 0x7F) fail(data, { bank }, 'render_address_required');
  }
});
test('physical WRAM arithmetic addresses require real bytes and windows, never observation fallback', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 65536, writeWindows = [...windows, [base + 0x4204, base + 0x4206]];
    const data = fixture({ writeWindows });
    word(data, base + 0x4214, 0); data.seed(base + 0x4216, [5]);
    const p = run(data, { bank, ioRead4214Word: null, ioRead4216Byte: null });
    assert.equal(p.handled, true); assert.equal(p.numberQuotientReads, 0); assert.equal(p.numberRemainderReads, 0);
    assert.ok(numberOps(p).filter(e => e.address >= base + 0x4204 && e.address <= base + 0x4216).every(e => e.space === 'data'));
    assert.equal(data.commit(p).handled, true); assert.equal(data.readByte(base + 0x4206).value, 10);
    const missing = fixture({ writeWindows }); fail(missing, { bank }, 'render_source_required');
    const loop = fixture({ writeWindows }); word(loop, base + 0x4214, 256); loop.seed(base + 0x4216, [5]);
    fail(loop, { bank, maxWork: 1000 }, 'render_work_budget_required');
  }
});
test('separate mixed-width lists exhaust independently and late text/wait failure withholds every effect', () => {
  for (const extra of [{ ioMode: null }, { ioRead4214Word: null }, { ioRead4216Byte: null },
    { ioRead4214Word: [256], ioRead4216Byte: [5, 5] }, { ioRead4214Word: [256, 0] },
    { ioRead4216: [] }, { waitRead01FA: [] }, { waitRead01FC: [] }]) {
    const reason = extra.ioMode === null ? 'render_io_context_required'
      : Object.keys(extra).some(k => k.startsWith('wait')) ? 'render_wait_read_required' : 'render_io_read_required';
    fail(fixture(), extra, reason);
  }
});
test('every initially read byte is mandatory; writes generated in overlay are sufficient fresh sources', () => {
  const complete = fixture(), p = run(complete); assert.equal(p.handled, true);
  const first = new Map();
  for (const event of p.byteOperations) {
    const address = event.address < 0x2000 ? 0x7E0000 + event.address : event.address;
    if (!first.has(address)) first.set(address, event.kind);
  }
  for (const [omitted, kind] of first) if (kind === 'read') {
    const data = createRenderData({ writeWindows: windows });
    for (const [a, v] of complete.snapshot().bytes) if (a !== omitted) data.seed(a, [v]);
    assert.equal(fail(data, {}, 'render_source_required').address, omitted);
  }
});
test('exact cumulative budgets, late windows, protected stack and incomplete entry remain atomic', () => {
  const p = run(fixture()); assert.equal(p.handled, true);
  assert.equal(run(fixture(), { maxWork: p.work, maxOutputBytes: p.outputBytes }).handled, true);
  fail(fixture(), { maxWork: p.work - 1 }, 'render_work_budget_required');
  fail(fixture(), { maxOutputBytes: p.outputBytes - 1 }, 'render_output_budget_required');
  for (const address of [0x7E21A5, 0x7E21A6, 0x7E21A4, 0x7E21A0, 0x7E21A1, 0x7E2AF0]) {
    const writeWindows = windows.flatMap(([a, b]) => address < a || address > b ? [[a, b]]
      : [[a, address - 1], [address + 1, b]].filter(([lo, hi]) => lo <= hi));
    assert.equal(fail(fixture({ writeWindows }), {}, 'render_write_window_required').address, address);
  }
  for (const extra of [{ bank: null }, { status: null }, { y: null }, { status: 0x38 }, { directPage: 1 }, { emulation: 1 }])
    fail(fixture(), extra, 'render_entry_required');
  for (const stackWindow of [null, [0x1F00, 0x1F0A]]) fail(fixture(), { stackWindow }, 'render_stack_required');
  assert.equal(run(fixture(), { stackWindow: [0x1F00, 0x1F0B] }).handled, true);
  fail(fixture(), { stackWindow: [0, 11] }, 'render_stack_alias_required');
  fail(fixture(), { stackWindow: [0x21A0, 0x21AB] }, 'render_stack_alias_required');
});
test('repeated inner calls share both division widths, geometry/wait lists, bytes and one outer commit', () => {
  const data = fixture(), before = data.snapshot(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]);
  const observations = {}, budget = { work: 0, maxWork: 1000000, outputBytes: 0, maxOutputBytes: 1000 };
  const context = { ...entry, observations, ioRead4214Word: [0, 0], ioRead4216Byte: [5, 6],
    ioRead4216: [0, 0, 0, 0], waitRead01FA: [0, 0], waitRead01FC: [0, 0] };
  const first = renderFD80(view, context, budget), second = renderFD80(view, context, budget);
  assert.equal(first.handled, true); assert.equal(second.handled, true);
  assert.equal(second.numberQuotientReads, 2); assert.equal(second.numberRemainderReads, 2);
  assert.equal(second.resultReads, 4); assert.equal(second.pollsFA, 2); assert.equal(second.pollsFC, 2);
  // Fresh offset4 after the first glyph changes the later mask visits.
  assert.equal(first.outputBytes, 69); assert.equal(second.outputBytes, 122); assert.ok(second.work > first.work);
  assert.deepEqual(data.snapshot(), before); assert.throws(() => data.commit(first), /Invalid render plan/);
  const p = view.finish(second); assert.equal(data.commit(p).handled, true); assert.equal(data.readByte(0x7E21A0).value, 54);
});
test('full odd and FFFF text indices retain long bank carry through the inner FB39', () => {
  for (const index of [0, 1, 0xDFDF, 0xFFFF]) {
    const p = run(fixture({ index, writeWindows: [...windows, [0x7E2000, 0x7FFFFF]] }));
    assert.equal(p.handled, true); assert.equal(p.x, index);
    assert.ok(p.readAddresses.includes(0x7E2020 + index));
    assert.ok(p.readAddresses.includes(0x7E20C0 + index));
  }
});
test('late stale and foreign plans cannot commit even after fully prepared requests', () => {
  const data = fixture(), p = run(data); assert.equal(p.handled, true);
  word(data, 2, 7); const before = data.snapshot();
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), before);
  assert.throws(() => fixture().commit(p), /Invalid render plan/);
});
test('malformed BYTE/WORD observation lists, modes and explicit Y are rejected', () => {
  for (const extra of [{ y: 65536 }, { y: -1 }, { ioMode: 'calculate' }, { waitMode: 'clock' },
    { ioRead4216Byte: Array(1) }, { ioRead4214Word: Array(1) }, { ioRead4214Word: new Uint16Array([0]) },
    ...['ioRead4214Word', 'ioRead4216', 'waitRead01FA', 'waitRead01FC'].flatMap(key =>
      [65536, -1, 1.5, null].map(value => ({ [key]: [value] }))),
    ...['ioRead4216Byte', 'ioRead4214'].flatMap(key => [256, -1, 1.5, null].map(value => ({ [key]: [value] })))])
    assert.throws(() => run(fixture(), extra), /Invalid render FD80 context/);
});
test('generated FD80 probes reproduce source/stack contracts and all explicit synthetic boundaries', async () => {
  const report = JSON.parse(await readFile('analysis/render-fd80-native.json', 'utf8'));
  assert.match(report.scope, /synthetic/); assert.equal(report.source.covered_bytes, 79);
  assert.equal(report.source.instruction_count, 38); assert.equal(report.stackProof.minimum_protected_stack_bytes, 12);
  assert.equal(report.probes.length, 5);
  for (const probe of report.probes) {
    const data = fixture(probe.fixture), p = prepareRenderFD80({ ...report.declaredInputs, data, ...probe.fixture });
    const { fixture: input, ...expected } = probe; assert.deepEqual(p, expected);
  }
});
