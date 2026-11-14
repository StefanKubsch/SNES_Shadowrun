import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView, renderAddress } from '../src/render/data.mjs';
import { prepareRenderF25A, renderF25A } from '../proof/render/mode-f25a.mjs';
import { selectionEntry, selectionFixture, selectionZeroFixture } from './render-f25a-fixtures.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
const prepare = (data, options = {}) => prepareRenderF25A({ ...selectionEntry, data, ...options });
const at = (data, address) => data.readByte(address).value;
const word = (data, address) => at(data, address) | at(data, address + 1) << 8;
const commands = p => p.ioWrites.filter(e => e.phase === 'command').map(e => e.value);
const pairs = p => p.ioWrites.filter(e => e.bytes === 1 && ['first', 'second'].includes(e.phase)).map(e => e.value);
function fail(data, options, reason) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  for (const key of ['byteWrites', 'operations', 'ioWrites', 'ioReads', 'calls']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}

test('F25A both accumulator widths and all65536 entry words preserve lowBYTE zero gate and exact mode arithmetic', () => {
  const data = selectionFixture({ entries: [0] }); data.seed(0x908005, [255]);
  for (const status of [0xC5, 0xE5]) for (let a = 0; a <= 65535; a++) {
    const p = prepare(data, { status, a }); assert.ok(p.handled); const mode = a & 255;
    assert.equal(p.status, status); assert.equal(p.bank, selectionEntry.bank);
    assert.equal(p.zeroPath, mode === 0); assert.equal(p.inputMode, mode);
    assert.equal(p.a, mode === 0 ? 0x0400 : 0x0402); assert.equal(p.x, mode === 0 ? 0 : 0x0100 | mode);
    assert.equal(p.y, mode === 0 ? selectionEntry.y : 5);
    assert.equal(p.mode, mode === 0 ? null : mode); assert.equal(p.loaderWord, mode === 0 ? null : 0x80FF - mode);
    assert.equal(p.calls[0].before.a, a & 0xFF00 | 4); assert.equal(p.calls[0].before.x, 0);
    if (mode) {
      assert.equal(p.calls[1].before.a, 0x0400 | mode); assert.equal(p.calls[2].before.a, 0x80FF - mode);
      assert.equal(p.calls[2].before.status & 0xC3, 0x81); // Original ADC: C1 V0 N1 Z0.
      assert.equal(p.calls[3].before.x, 0x0100 | mode); assert.equal(p.calls[3].before.a, 0x0104);
    }
  }
});
test('F25A high-word lowzero always performs only the first command and needs no mode/directory/cache source', () => {
  for (const status of [0xC5, 0xE5]) for (let high = 0; high < 256; high++) {
    const data = selectionZeroFixture(), before = data.snapshot(), p = prepare(data, { a: high << 8, status });
    assert.ok(p.handled); assert.deepEqual(data.snapshot(), before); assert.equal(p.work, 6);
    assert.equal(p.a, 0x0400); assert.equal(p.x, 0); assert.equal(p.y, selectionEntry.y); assert.equal(p.status, status);
    assert.deepEqual(commands(p), [4]); assert.equal(p.calls.length, 1); assert.equal(p.apuPolls, 1);
    assert.deepEqual(p.byteWrites, [[0x7E1CE4, 1]]); assert.deepEqual(p.readAddresses, [0x7E1CE4]);
  }
});
test('F25A all256 initial tokens preserve actual increment/wrap but zero PLA returns A0400 independently', () => {
  for (let token = 0; token < 256; token++) {
    const data = selectionZeroFixture({ token }), p = prepare(data, { a: 0xAB00, ioRead2140: [token] }); assert.ok(p.handled);
    assert.equal(p.calls[0].after.a, 0x0400 | (token + 1 & 255)); assert.equal(p.a, 0x0400);
    assert.deepEqual(data.commit(p), { handled: true }); assert.equal(at(data, 0x1CE4), token + 1 & 255);
  }
});
test('F25A all admissible WORD/BYTE statuses restore complete P across zero, skipped list, raw and repeat paths', () => {
  for (let status = 0; status < 256; status++) {
    if (status & 0x18) continue;
    for (const options of [{ a: 0 }, { entries: [0] }, {},
      { modeLoader: { blocks: [{ kind: 'repeat', count: 1, value: 0x8000 }] } }]) {
      const p = prepare(options.a === 0 ? selectionZeroFixture() : selectionFixture(options), { ...options, status });
      assert.ok(p.handled); assert.equal(p.status, status); assert.equal(p.carry, status & 1); assert.equal(p.overflow, status >>> 6 & 1);
      assert.equal(p.bank, selectionEntry.bank);
    }
  }
});
test('F25A actual F1FA repeated loaders and final repeat loader keep WORD savedmode and actual final Y', () => {
  const data = selectionFixture({ entries: [6, 7, 6, 7, 0], modeLoader: { blocks: [{ kind: 'repeat', count: 2, value: 0xBEEF }] } });
  const before = data.snapshot(), p = prepare(data); assert.ok(p.handled); assert.deepEqual(data.snapshot(), before);
  assert.deepEqual(p.calls.map(c => [c.name, c.role]), [['F007', 'initialCommand'], ['F1FA', 'modeList'], ['F130', 'modeLoader'], ['F007', 'finalCommand']]);
  assert.equal(p.calls[1].matches, 2); assert.equal(p.calls[1].after.y, 0x44); assert.equal(p.calls[2].repeatWords, 2);
  assert.equal(p.calls[2].before.a, 0x80F9); assert.equal(p.calls[2].after.y, 8);
  assert.equal(p.calls[2].after.x, 4); assert.equal(p.calls[3].before.x, 0x0106);
  assert.equal(p.a, 0x040C); assert.equal(p.x, 0x0106); assert.equal(p.y, 8);
  assert.deepEqual(commands(p), [4, 16, 16, 16, 4]); assert.equal(p.polls, 12); assert.equal(p.apuPolls, 12);
  assert.deepEqual(data.commit(p), { handled: true }); assert.equal(word(data, 0x98), 0xBEEF); assert.equal(at(data, 0x1CE5), 6);
});
test('F25A final raw loader has distinct actual data, full request length and BYTE address carry', () => {
  const data = selectionFixture({ modeLoader: { address: 0x12FF, blocks: [{ kind: 'raw', values: [0xAA, 0xBB] }] } });
  const p = prepare(data); assert.ok(p.handled); assert.equal(p.calls[1].rawBytes, 1); assert.equal(p.calls[2].rawBytes, 2);
  assert.deepEqual(pairs(p), [0x34, 0x12, 0xAB, 0xAB, 0xFF, 0x12, 0xAA, 0xBB]);
  assert.equal(p.y, 9); assert.equal(p.x, 0x0106); assert.equal(p.a, 0x0408);
  assert.deepEqual(data.commit(p), { handled: true }); assert.equal(word(data, 0x96), 0x1201);
});
test('F25A full composition retains24bit bankcarry in shared directory, final header and final payload reads', () => {
  for (const { directory, blockPointer } of [{ directory: 0x7EFFFF, blockPointer: 0x908300 },
    { directory: 0x9FFF80, blockPointer: 0x7EFFFF }]) {
    const data = selectionFixture({ directory, modeLoader: { blockPointer,
      blocks: [{ kind: 'raw', pointer: 0x7FFFFF, values: [0xAA, 0xBB] }] } });
    const p = prepare(data); assert.ok(p.handled, JSON.stringify(p)); assert.equal(p.calls[1].matches, 1);
    assert.equal(p.calls[2].rawBytes, 2); assert.equal(p.x, 0x0106); assert.equal(p.y, 9);
    assert.deepEqual(p.operations.filter(e => e.phase === 'raw' && e.kind === 'read' && [0x7FFFFF, 0x800000].includes(e.address))
      .map(e => [e.address, e.value]), [[0x7FFFFF, 0xAA], [0x800000, 0xBB]]);
    assert.deepEqual(pairs(p), [0x34, 0x12, 0xAB, 0xAB, 0x34, 0x12, 0xAA, 0xBB]);
  }
});
test('F25A nonzero mismatch list still invokes real additional loader and final command', () => {
  const p = prepare(selectionFixture({ entries: [5, 99, 0] })); assert.ok(p.handled);
  assert.equal(p.calls[1].matches, 0); assert.equal(p.calls[1].after.y, 0x42);
  assert.equal(p.calls[2].outcome, 'audio_directory_terminated'); assert.equal(p.y, 9);
  assert.deepEqual(commands(p), [4, 4]); assert.equal(p.a, 0x0402); assert.equal(p.x, 0x0106);
});
test('F25A preserved modeWORD survives actual DP98 repeat data and determines full final parameter', () => {
  for (const value of [0, 1, 0x00FF, 0x8000, 0xFFFF]) {
    const data = selectionFixture({ modeLoader: { blocks: [{ kind: 'repeat', count: 1, value }] } }), p = prepare(data);
    assert.ok(p.handled); assert.equal(p.mode, 6); assert.equal(p.x, 0x0106); assert.equal(p.calls[3].before.x, 0x0106);
    assert.deepEqual(data.commit(p), { handled: true }); assert.equal(word(data, 0x98), value);
  }
});
test('F25A shared BYTE2140 polls span initial command, sample list and final command with mismatches/tokenwrap', () => {
  const samples = [77, 254, 88, 255, 0, 1, 99, 2];
  const p = prepare(selectionFixture({ token: 254 }), { ioRead2140: samples }); assert.ok(p.handled);
  assert.deepEqual(p.ioReads.map(e => e.value), samples); assert.equal(p.apuPolls, 8);
  assert.deepEqual(p.calls.map(c => [c.polls, c.apuPolls]), [[2, 2], [4, 6], [0, 6], [2, 8]]);
  assert.equal(p.a, 0x0403); assert.equal(p.x, 0x0106);
});
test('F25A first command tokenwrite aliases the fresh F1FA header rather than freezing it before initial call', () => {
  const data = selectionFixture({ directory: 0x7E1CE4, header: 0x0040, entries: [0], token: 0 });
  // Header low40 is also initial token; first F007 increments it to41.
  // F1FA cache store writes high header6, so the actual header is0641.
  data.seed(0x7E2325, [0]);
  const p = prepare(data, { ioRead2140: [64, 65] }); assert.ok(p.handled);
  assert.equal(p.calls[1].after.y, 0x0641); assert.equal(p.y, 9);
  assert.equal(p.a, 0x0442); assert.equal(p.mode, 6);
});
test('F25A additional loader and final requests read fresh token/cache data and preserve separate EF47 cache', () => {
  const data = selectionFixture(); data.seed(0x1CDE, [0xAA, 0xBB]);
  const p = prepare(data); assert.ok(p.handled); assert.equal(p.a, 0x0405);
  const tokenReads = p.operations.filter(e => e.kind === 'read' && renderAddress(e.address) === 0x7E1CE4);
  assert.deepEqual(tokenReads.map(e => e.value), [0, 1, 2, 3, 4]);
  assert.ok(!p.byteWrites.some(([a]) => a === 0x7E1CDE || a === 0x7E1CDF));
  assert.deepEqual(data.commit(p), { handled: true }); assert.equal(word(data, 0x1CDE), 0xBBAA);
});
test('F25A all returned cacheBYTES including zero use actual F1FA result for savedWORD/additional selector', () => {
  // Explicit synthetic interference is confined to this inner test provider.
  for (let mode = 0; mode < 256; mode++) {
    const data = selectionFixture({ entries: [0] }); data.seed(0x908005, [255]);
    const view = prepareRenderView(data);
    const shared = { write: (a, v) => view.write(a, v), read(a) {
      if (a === 0x908040) view.write(0x1CE5, mode); return view.read(a);
    } };
    const p = renderF25A(shared, selectionEntry, { work: 0, maxWork: 1000 });
    assert.equal(p.inputMode, 6); assert.equal(p.zeroPath, false); assert.equal(p.mode, mode);
    assert.equal(p.loaderWord, 0x80FF - mode); assert.equal(p.x, 0x0100 | mode); assert.equal(p.a, 0x0402);
    assert.equal(p.calls[2].before.a, 0x80FF - mode); assert.equal(p.calls[2].before.status & 0xC3, 0x81);
  }
});
test('F25A all256 DBRs keep actual addressing and physical2140 never consumes observation values', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40 && bank !== 0x7E && bank !== 0x7F) {
      fail(selectionZeroFixture(), { bank, a: 0 }, 'render_address_required'); continue;
    }
    for (const zero of [true, false]) {
      const data = zero ? selectionZeroFixture({ bank }) : selectionFixture({ bank });
      const p = prepare(data, { bank, a: zero ? 0 : selectionEntry.a }); assert.ok(p.handled);
      assert.equal(p.bank, bank); assert.equal(p.apuPolls, bank === 0x7E || bank === 0x7F ? 0 : zero ? 1 : 5);
      if (bank === 0x7E || bank === 0x7F) assert.deepEqual(p.ioRequests, []);
    }
  }
});
test('F25A physical mismatches require actual byte changes; supplied APU samples cannot rescue them', () => {
  for (const bank of [0x7E, 0x7F]) {
    const data = selectionFixture({ bank }); data.seed(bank * 65536 + 0x2140, [99]);
    fail(data, { bank, maxWork: 100 }, 'render_work_budget_required');
  }
});
test('F25A nineteen protected stackbytes cover both widths; all reached pointer/cache/register aliases reject', () => {
  for (const status of [0xC5, 0xE5]) {
    assert.ok(prepare(selectionFixture(), { status, stackWindow: [0x1FED, 0x1FFF] }).handled);
    fail(selectionFixture(), { status, stackWindow: [0x1FEE, 0x1FFF] }, 'render_stack_required');
  }
  for (const address of [0x89, 0x8C, 0x92, 0x94, 0x96, 0x98, 0x1CE4, 0x1CE5, 0x1CE6, 0x1CE7])
    fail(selectionFixture(), { stackWindow: [address, address + 18] }, 'render_stack_alias_required');
  fail(selectionFixture({ bank: 0x7E }), { bank: 0x7E, stackWindow: [0x2140, 0x2152] }, 'render_stack_alias_required');
  assert.ok(prepare(selectionZeroFixture(), { a: 0, stackWindow: [0x8C, 0x9E] }).handled);
});
test('F25A every required initial BYTE and actual write window fails atomically even after earlier real loaders', () => {
  const options = { modeLoader: { blocks: [{ kind: 'repeat', count: 1, value: 0xBEEF }] } };
  const full = selectionFixture(options), p = prepare(full); assert.ok(p.handled);
  const snapshot = full.snapshot(), written = new Set(), required = new Set();
  for (const e of p.operations.filter(e => e.space === 'data')) for (let n = 0; n < e.bytes; n++) {
    const address = renderAddress(e.address + n & 0xFFFFFF);
    if (e.kind === 'write') written.add(address); else if (!written.has(address)) required.add(address);
  }
  for (const missing of required) {
    const data = createRenderData({ writeWindows: snapshot.writeWindows });
    for (const [address, value] of snapshot.bytes) if (address !== missing) data.seed(address, [value]);
    assert.equal(fail(data, {}, 'render_source_required').address, missing);
  }
  for (const [missing] of p.byteWrites) {
    const writeWindows = p.byteWrites.filter(([a]) => a !== missing).map(([a]) => [a, a]);
    assert.equal(fail(selectionFixture({ ...options, writeWindows }), {}, 'render_write_window_required').address, missing);
  }
});
test('F25A every cumulative work/observation prefix holds the initial command and all mode loaders back', () => {
  const options = { modeLoader: { blocks: [{ kind: 'repeat', count: 1, value: 0xBEEF }] } }, p = prepare(selectionFixture(options));
  assert.ok(p.handled);
  for (let maxWork = 1; maxWork < p.work; maxWork++) fail(selectionFixture(options), { maxWork }, 'render_work_budget_required');
  assert.ok(prepare(selectionFixture(options), { maxWork: p.work }).handled);
  for (let n = 0; n < p.apuPolls; n++) fail(selectionFixture(options), { ioRead2140: selectionEntry.ioRead2140.slice(0, n) }, 'render_io_read_required');
  fail(selectionFixture(options), { ioMode: null }, 'render_io_context_required');
  const late = fail(selectionFixture(options), { ioRead2140: selectionEntry.ioRead2140.slice(0, p.apuPolls - 1) }, 'render_io_read_required');
  assert.equal(late.compositionPhase, 'finalCommand'); assert.equal(late.compositionCallIndex, 3);
});
test('F25A late list/directory/payload sources and zero-count do-loop boundaries leave no partial effects', () => {
  const list = fail(selectionFixture({ entries: [6, 7, 6] }), {}, 'render_source_required'); assert.equal(list.compositionPhase, 'modeList');
  const data = selectionFixture(); data.seed(0x908009, [9]);
  const directory = fail(data, {}, 'render_source_required'); assert.equal(directory.compositionPhase, 'modeLoader');
  const repeated = selectionFixture({ modeLoader: { length: 3, blocks: [{ kind: 'repeat', count: 0, value: 0xBEEF }] } });
  const loop = fail(repeated, { maxWork: 300 }, 'render_work_budget_required'); assert.equal(loop.compositionPhase, 'modeLoader');
});
test('F25A inner plans share global polls and cumulative work/output with exactly one outer commit', () => {
  const data = selectionFixture(), before = data.snapshot(), view = prepareRenderView(data);
  const budget = { work: 7, maxWork: 1000, outputBytes: 5, maxOutputBytes: 5 }, observations = { apuPolls: 2 };
  const context = { ...selectionEntry, observations, ioRead2140: [99, 99, ...selectionEntry.ioRead2140] };
  const first = renderF25A(view, context, budget), second = renderF25A(view, context, budget);
  assert.equal(first.apuPolls, 7); assert.equal(second.apuPolls, 12); assert.equal(second.outputBytes, 5);
  assert.equal(second.work, 7 + 2 * prepare(selectionFixture()).work); assert.deepEqual(data.snapshot(), before);
  assert.throws(() => data.commit(first)); assert.throws(() => data.commit(second));
  assert.deepEqual(data.commit(view.finish(second)), { handled: true }); assert.equal(at(data, 0x1CE4), 10);
});
test('F25A foreign/stale plans reject; late failures retain previous outer stores and requests', () => {
  const data = selectionFixture(), p = prepare(data); assert.throws(() => selectionFixture().commit(p));
  data.seed(0x1CE4, [99]); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  const d = selectionFixture(), before = d.snapshot(), view = prepareRenderView(d); view.write(0x1CE7, 0x88);
  assert.throws(() => renderF25A(view, { ...selectionEntry, ioRead2140: [0, 1, 2, 3] }, { work: 0, maxWork: 1000 }),
    e => e.reason === 'render_io_read_required' && e.compositionPhase === 'finalCommand');
  assert.deepEqual(d.snapshot(), before);
});
test('F25A explicit contexts support M0/M1 while unknown Y, decimal, BYTE-X and invalid inputs reject', () => {
  for (const options of [{ a: null }, { y: null }, { bank: null }, { status: null }, { status: 0x10 }, { status: 0x08 },
    { status: 0x30 }, { emulation: 1 }, { directPage: 1 }]) fail(selectionFixture(), options, 'render_entry_required');
  for (const options of [{ a: -1 }, { y: 65536 }, { bank: 256 }, { status: 256 }, { maxWork: 0 },
    { maxOutputBytes: 0 }, { ioMode: 'execute' }, { ioRead2140: [256] }, { ioRead2140: Array(1) }]) assert.throws(() => prepare(selectionFixture(), options));
});
test('F25A synthetic probe pins original53/25 and both19-byte proofs with successful and late failure records', async () => {
  const report = JSON.parse(await readFile('analysis/render-f25a-native.json', 'utf8'));
  assert.match(report.scope, /explicitly synthetic/); assert.match(report.scope, /No audio\/device\/CPU\/clock/);
  assert.equal(report.source.covered_bytes, 53); assert.equal(report.source.instruction_count, 25);
  assert.deepEqual(report.stackProofs.map(p => p.minimum_protected_stack_bytes), [19, 19]);
  assert.ok(report.stackProofs.every(p => p.external_return_assumptions === 0));
  assert.deepEqual(report.probes.map(p => p.handled), [true, true, true, true, true, true, false, false, false]);
  for (const p of report.probes.slice(6)) assert.equal(p.operations, undefined);
});
