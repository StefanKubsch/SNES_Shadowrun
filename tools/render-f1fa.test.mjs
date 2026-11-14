import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView, renderAddress } from '../src/render/data.mjs';
import { prepareRenderF1FA, renderF1FA } from '../proof/render/mode-f1fa.mjs';
import { modeEntry, modeFixture } from './render-f1fa-fixtures.mjs';
import { sampleWord, samplePointer } from './render-f130-fixtures.mjs';
const prepare = (data, options = {}) => prepareRenderF1FA({ ...modeEntry, data, ...options });
const at = (data, address) => data.readByte(address).value;
const pairs = p => p.ioWrites.filter(e => e.bytes === 1 && ['first', 'second'].includes(e.phase)).map(e => e.value);
function fail(data, options, reason) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  for (const key of ['byteWrites', 'operations', 'ioWrites', 'ioReads', 'calls']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}

test('F1FA all65536 entry words store only lowBYTE and return actual header highA, terminalY and entryX', () => {
  const data = modeFixture({ header: 0x0140, entries: [0] });
  for (let a = 0; a <= 65535; a++) {
    const p = prepare(data, { a, ioMode: null, ioRead2140: null }); assert.ok(p.handled);
    assert.equal(p.a, 0x0100 | (a & 255)); assert.equal(p.x, modeEntry.x); assert.equal(p.y, 0x0140);
    assert.equal(p.status, (modeEntry.status & ~0x82) | ((a & 255) === 0 ? 2 : a & 128));
    assert.equal(p.matches, 0); assert.equal(p.visits, 1); assert.deepEqual(p.ioRequests, []);
    assert.deepEqual(p.byteWrites, [[0x7E1CE5, a & 255]]);
  }
});
test('F1FA zero terminator precedes any cache compare and never reads an unavailable sample byte', () => {
  const data = modeFixture({ entries: [0] }), p = prepare(data, { a: 0 }); assert.ok(p.handled);
  assert.equal(p.work, 8); assert.equal(p.y, 0x40); assert.equal(p.status & 0x82, 2);
  const reads = p.operations.filter(e => e.kind === 'read');
  assert.equal(reads.filter(e => e.address === 0x801CE5).length, 1);
  assert.ok(!reads.some(e => e.address === 0x908041));
  assert.deepEqual(p.operations[0], { kind: 'write', space: 'data', phase: 'modeF1FA', address: 0x801CE5, value: 0, bytes: 1 });
});
test('F1FA mismatch skips an unavailable second byte and requires no APU context', () => {
  const data = modeFixture({ entries: [5] }); data.seed(0x908042, [0]);
  const p = prepare(data, { ioMode: null, ioRead2140: null }); assert.ok(p.handled);
  assert.equal(p.matches, 0); assert.equal(p.y, 0x42); assert.equal(p.x, modeEntry.x);
  assert.ok(!p.readAddresses.includes(0x908041)); assert.equal(p.a, 6);
});
test('F1FA all256 sample bytes form exact8000|sample and call the actual directory loader including FF priority', () => {
  for (let sample = 0; sample < 256; sample++) {
    const p = prepare(modeFixture({ entries: [6, sample, 0], selector: sample, blocks: [] })); assert.ok(p.handled);
    assert.equal(p.matches, 1); assert.equal(p.calls[0].before.a, 0x8000 | sample);
    assert.equal(p.calls[0].before.y, 0x41); assert.equal(p.calls[0].before.status & 0x38, 0);
    assert.equal(p.calls[0].after.y, sample === 255 ? 5 : 4); assert.equal(p.y, 0x42);
    assert.equal(p.a, sample === 255 ? 0x8006 : 6); assert.equal(p.x, modeEntry.x);
    assert.equal(p.calls[0].outcome, sample === 255 ? 'audio_directory_terminated' : 'audio_data_requests_prepared');
  }
});
test('F1FA all legal BYTE statuses restore C/V/I/M/X with N/Z from final cache on empty/raw/repeat paths', () => {
  for (let status = 0; status < 256; status++) {
    if ((status & 0x38) !== 32) continue;
    for (const options of [{ a: 0, entries: [0] }, { a: 0xABFF, entries: [0] }, {},
      { blocks: [{ kind: 'repeat', count: 1, value: 0xABCD }] }]) {
      const p = prepare(modeFixture(options), { ...options, status }); assert.ok(p.handled);
      const byte = (options.a ?? modeEntry.a) & 255;
      assert.equal(p.status, status & ~0x82 | (byte === 0 ? 2 : byte & 128));
      assert.equal(p.carry, status & 1); assert.equal(p.overflow, status >>> 6 & 1);
    }
  }
});
test('F1FA repeated and duplicate matching records each perform real raw/repeat loaders with restored outerY', () => {
  for (const blocks of [[{ kind: 'raw', values: [0xAB] }], [{ kind: 'repeat', count: 2, value: 0xBEEF }]]) {
    const data = modeFixture({ entries: [6, 7, 5, 99, 6, 7, 0], blocks }), before = data.snapshot();
    const p = prepare(data); assert.ok(p.handled); assert.deepEqual(data.snapshot(), before);
    assert.equal(p.visits, 4); assert.equal(p.matches, 2); assert.equal(p.y, 0x46); assert.equal(p.a, 6);
    assert.deepEqual(p.calls.map(c => c.before.y), [0x41, 0x45]); assert.equal(p.x, blocks[0].kind === 'raw' ? 1 : 4);
    assert.equal(p.polls, blocks[0].kind === 'raw' ? 6 : 8); assert.equal(p.apuPolls, p.polls);
    assert.deepEqual(pairs(p), blocks[0].kind === 'raw' ? [0x34, 0x12, 0xAB, 0xAB, 0x34, 0x12, 0xAB, 0xAB]
      : [0x34, 0x12, 0xEF, 0xBE, 0xEF, 0xBE, 0x34, 0x12, 0xEF, 0xBE, 0xEF, 0xBE]);
    assert.deepEqual(data.commit(p), { handled: true }); assert.equal(at(data, 0x1CE5), 6);
  }
});
test('F1FA different selectors and early missing directory sample preserve actual highA/X after later call', () => {
  const data = modeFixture({ entries: [6, 7, 6, 8, 0] }), p = prepare(data); assert.ok(p.handled);
  assert.equal(p.matches, 2); assert.deepEqual(p.calls.map(c => c.before.a), [0x8007, 0x8008]);
  assert.equal(p.calls[1].outcome, 'audio_directory_terminated'); assert.equal(p.x, 1);
  assert.equal(p.a, 0x8006); assert.equal(p.y, 0x44); assert.equal(p.polls, 3);
});
test('F1FA WORDY wrap respects shared header bytes on mismatch and sample read at zero on match', () => {
  const mismatch = prepare(modeFixture({ directory: 0x7E5000, header: 0xFFFF, entries: [5, 255, 255, 99, 0] }));
  assert.ok(mismatch.handled); assert.equal(mismatch.header, 65535); assert.equal(mismatch.y, 3);
  assert.equal(mismatch.visits, 3); assert.equal(mismatch.a, 0xFF06);
  const data = modeFixture({ directory: 0x7E5000, header: 0xFFFF, entries: [6, 255, 255, 99, 0] }), p = prepare(data);
  assert.ok(p.handled); assert.equal(p.matches, 1); assert.equal(p.calls[0].before.y, 0);
  assert.equal(p.calls[0].before.a, 0x80FF); assert.equal(p.y, 3); assert.equal(p.a, 0x8006);
});
test('F1FA all65536 WORDY values advance twice with wrap and no inferred record limit', () => {
  // Explicit synthetic inner byte provider isolates index arithmetic from the
  // header/list alias at Y0/1. It is not a public scene or runtime observation API.
  for (let header = 0; header <= 65535; header++) {
    const data = modeFixture({ entries: [0] }), view = prepareRenderView(data); let pass = 0;
    const shared = { write: (a, v) => view.write(a, v), read(a) {
      if (a === 0x908000 && pass < 2) { pass++; return header & 255; }
      if (a === 0x908001 && pass === 1) { pass++; return header >>> 8; }
      if (a === (0x908000 + header)) { pass++; return 5; }
      if (a === (0x908000 + ((header + 2) & 65535))) return 0;
      return view.read(a);
    } };
    const p = renderF1FA(shared, modeEntry, { work: 0, maxWork: 30 });
    assert.equal(p.header, header); assert.equal(p.y, (header + 2) & 65535); assert.equal(p.matches, 0);
    assert.equal(p.a, (header & 0xFF00) | 6);
  }
});
test('F1FA pointer/header/list BYTE and WORD reads use full24bit bankcarry including wrap', () => {
  for (const directory of [0x7EFFFF, 0x7FFFFF, 0x9FFF80, 0xFFFFFF]) {
    // FFFFFF is explicitly unsupported physical mapping, never mirrored.
    if (directory === 0xFFFFFF) {
      const data = modeFixture(); samplePointer(data, 0x8C, directory); fail(data, {}, 'render_address_required'); continue;
    }
    const p = prepare(modeFixture({ directory, entries: [5, 99, 0] })); assert.ok(p.handled);
    assert.equal(p.header, 0x40); assert.equal(p.y, 0x42);
    assert.ok(p.operations.some(e => e.address === (directory + 0x40 & 0xFFFFFF)));
  }
});
test('F1FA initial cache write aliases the fresh long header and changes the actual starting index', () => {
  const data = modeFixture({ directory: 0x7E1CE5, header: 0x0060, entries: [0] });
  data.seed(0x7E1CEA, [255, 6, 8, 0]);
  const p = prepare(data); assert.ok(p.handled); assert.equal(p.header, 6); assert.equal(p.matches, 1);
  assert.equal(p.calls[0].before.a, 0x8008); assert.equal(p.a, 0x8006); assert.equal(p.y, 8);
});
test('F1FA real loader stores change subsequent list bytes, which must be read freshly', () => {
  const data = modeFixture({ directory: 0x7E1CA9, header: 0x0040, entries: [6, 7, 5, 99, 0] });
  // Earlier mode/sample at1CE2/3; the next mode is the actual token1CE4.
  // The first real loader changes that zero to3; pairflag1CE6 then ends.
  sampleWord(data, 0x7E1CA9, 0x39); data.seed(0x7E1CE2, [6, 7, 0, 0, 0, 0]);
  const p = prepare(data); assert.ok(p.handled);
  assert.equal(p.matches, 1); assert.equal(p.visits, 3); assert.equal(p.y, 0x3D);
  assert.deepEqual(p.operations.filter(e => e.phase === 'modeF1FA' && e.kind === 'read' && e.address === 0x7E1CE4)
    .map(e => e.value), [3]);
});
test('F1FA synthetic outer provider proves fresh cache and long pointer reloads between real calls', () => {
  const data = modeFixture({ entries: [6, 7, 0] }); data.seed(0x918040, [5, 99, 0]);
  const view = prepareRenderView(data), before = data.snapshot();
  let switched = false;
  const shared = { read(a) {
    if (!switched && renderAddress(a) === 0x7E1CE4) { switched = true; view.write(0x8C, 0); view.write(0x8D, 0x80); view.write(0x8E, 0x91);
      view.write(0x1CE5, 5); }
    return view.read(a);
  }, write: (a, v) => view.write(a, v) };
  const p = renderF1FA(shared, modeEntry, { work: 0, maxWork: 1000 }); assert.equal(p.a, 5);
  assert.equal(p.status & 0x82, 0); assert.equal(p.y, 0x42);
  assert.ok(p.operations.some(e => e.phase === 'modeF1FA' && e.address === 0x918042));
  assert.throws(() => data.commit(p)); assert.deepEqual(data.snapshot(), before);
});
test('F1FA global BYTE2140 transcript spans repeated loaders with different poll sequences and tokenwrap', () => {
  const data = modeFixture({ token: 254, entries: [6, 7, 6, 7, 0] });
  const samples = [99, 254, 99, 99, 255, 0, 88, 1, 2, 77, 3];
  const p = prepare(data, { ioRead2140: samples }); assert.ok(p.handled);
  assert.equal(p.apuPolls, samples.length); assert.deepEqual(p.calls.map(c => [c.polls, c.apuPolls]), [[6, 6], [5, 11]]);
  assert.deepEqual(p.ioReads.map(e => e.value), samples); assert.equal(p.a, 6);
  assert.deepEqual(data.commit(p), { handled: true }); assert.equal(at(data, 0x1CE4), 4);
});
test('F1FA all256 DBRs keep cache addressing actual; unmapped banks fail and physical2140 uses actual data', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40 && bank !== 0x7E && bank !== 0x7F) {
      fail(modeFixture(), { bank }, 'render_address_required'); continue;
    }
    for (const entries of [[0], [6, 7, 0]]) {
      const p = prepare(modeFixture({ bank, entries }), { bank }); assert.ok(p.handled); assert.equal(p.bank, bank);
      assert.equal(p.operations[0].address, bank * 65536 + 0x1CE5);
      assert.equal(p.apuPolls, entries.length === 1 || bank === 0x7E || bank === 0x7F ? 0 : 3);
    }
  }
});
test('F1FA physical2140 mismatch cannot be rescued by supplied observations and remains atomic', () => {
  for (const bank of [0x7E, 0x7F]) {
    const data = modeFixture({ bank }); data.seed(bank * 65536 + 0x2140, [99]);
    fail(data, { bank, maxWork: 100 }, 'render_work_budget_required');
  }
});
test('F1FA final BYTE cache reload independently sets N/Z after saved status restoration', () => {
  // Explicit synthetic interference supplied only by this inner test caller.
  for (let value = 0; value < 256; value++) {
    const data = modeFixture({ header: 0x0140, entries: [0] }), view = prepareRenderView(data);
    const shared = { write: (a, v) => view.write(a, v), read(a) {
      if (a === 0x908140) view.write(0x1CE5, value); return view.read(a);
    } };
    const p = renderF1FA(shared, modeEntry, { work: 0, maxWork: 100 });
    assert.equal(p.a, 0x0100 | value); assert.equal(p.status, modeEntry.status & ~0x82 | (value === 0 ? 2 : value & 128));
    assert.equal(p.x, modeEntry.x); assert.equal(p.y, 0x0140); assert.equal(p.matches, 0);
  }
});
test('F1FA selected original header94/mode pair bytes remain distinct from synthetic loader and poll fixtures', async () => {
  const report = JSON.parse(await readFile('analysis/render-ef47.json', 'utf8'));
  const entries = [...Buffer.from(report.tables.find(t => t.name === 'selectedModePairs9FFF0A').machine_bytes, 'hex')];
  assert.deepEqual(entries, [2, 56, 5, 55, 6, 57, 12, 56, 0]);
  for (const [a, sample] of [[2, 56], [5, 55], [6, 57], [12, 56], [0, null]]) {
    const p = prepare(modeFixture({ header: 94, entries, selector: sample ?? 7 }), { a }); assert.ok(p.handled);
    assert.equal(p.header, 94); assert.equal(p.visits, 5); assert.equal(p.y, 102);
    assert.equal(p.matches, sample === null ? 0 : 1);
    if (sample !== null) assert.equal(p.calls[0].before.a, 0x8000 | sample);
  }
});
test('F1FA fifteen protected stackbytes and all reached data/cache/pointer/loader aliases reject atomically', () => {
  assert.ok(prepare(modeFixture(), { stackWindow: [0x1FF1, 0x1FFF] }).handled);
  fail(modeFixture(), { stackWindow: [0x1FF2, 0x1FFF] }, 'render_stack_required');
  for (const address of [0x89, 0x8C, 0x92, 0x94, 0x96, 0x98, 0x1CE4, 0x1CE5, 0x1CE6, 0x1CE7])
    fail(modeFixture(), { stackWindow: [address, address + 14] }, 'render_stack_alias_required');
  fail(modeFixture({ bank: 0x7E }), { bank: 0x7E, stackWindow: [0x2140, 0x214E] }, 'render_stack_alias_required');
});
test('F1FA every required initial byte and every actual write window fail without prior stores or requests', () => {
  const options = { entries: [6, 7, 6, 7, 0] }, full = modeFixture(options), p = prepare(full); assert.ok(p.handled);
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
    assert.equal(fail(modeFixture({ ...options, writeWindows }), {}, 'render_write_window_required').address, missing);
  }
});
test('F1FA every work/observation prefix and late missing list byte hold all earlier loaders/cache back', () => {
  const options = { entries: [6, 7, 6, 7, 0] }, p = prepare(modeFixture(options)); assert.ok(p.handled);
  for (let maxWork = 1; maxWork < p.work; maxWork++) fail(modeFixture(options), { maxWork }, 'render_work_budget_required');
  assert.ok(prepare(modeFixture(options), { maxWork: p.work }).handled);
  for (let n = 0; n < p.apuPolls; n++) fail(modeFixture(options), { ioRead2140: modeEntry.ioRead2140.slice(0, n) }, 'render_io_read_required');
  fail(modeFixture(options), { ioMode: null }, 'render_io_context_required');
  const q = fail(modeFixture({ entries: [6, 7, 6] }), {}, 'render_source_required');
  assert.equal(q.caller, 'F1FA'); assert.equal(q.matchIndex, 1);
});
test('F1FA nonterminating WORD pair scan exhausts work without repairing a list or committing the cache', () => {
  const data = modeFixture({ directory: 0x7E5000 }); data.seed(0x7E5000, new Uint8Array(65536).fill(5)); sampleWord(data, 0x7E5000, 0x40);
  fail(data, { maxWork: 200000 }, 'render_work_budget_required');
});
test('F1FA inner calls share cumulative work/output and global observations with a single outer commit', () => {
  const data = modeFixture(), before = data.snapshot(), view = prepareRenderView(data);
  const budget = { work: 7, maxWork: 1000, outputBytes: 5, maxOutputBytes: 5 }, observations = { apuPolls: 2 };
  const context = { ...modeEntry, observations, ioRead2140: [99, 99, ...modeEntry.ioRead2140] };
  const first = renderF1FA(view, context, budget), second = renderF1FA(view, context, budget);
  assert.equal(first.apuPolls, 5); assert.equal(second.apuPolls, 8); assert.equal(second.outputBytes, 5);
  assert.equal(second.work, 7 + 2 * prepare(modeFixture()).work); assert.deepEqual(data.snapshot(), before);
  assert.throws(() => data.commit(first)); assert.throws(() => data.commit(second));
  assert.deepEqual(data.commit(view.finish(second)), { handled: true }); assert.equal(at(data, 0x1CE4), 6);
});
test('F1FA stale/foreign plans reject and late failures preserve earlier synthetic outer writes', () => {
  const data = modeFixture(), p = prepare(data); assert.throws(() => modeFixture().commit(p));
  data.seed(0x1CE5, [99]); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  const d = modeFixture(), before = d.snapshot(), view = prepareRenderView(d); view.write(0x1CE7, 0x88);
  assert.throws(() => renderF1FA(view, { ...modeEntry, ioRead2140: [0, 1] }, { work: 0, maxWork: 1000 }),
    e => e.reason === 'render_io_read_required'); assert.deepEqual(d.snapshot(), before);
});
test('F1FA missing/invalid public contexts keep BYTEA/WORDX and explicit budgets required', () => {
  for (const options of [{ a: null }, { x: null }, { bank: null }, { status: null }, { status: 0 },
    { status: 0x30 }, { status: 0x28 }, { emulation: 1 }, { directPage: 1 }]) fail(modeFixture(), options, 'render_entry_required');
  for (const options of [{ a: -1 }, { x: 65536 }, { bank: 256 }, { status: 256 }, { maxWork: 0 },
    { maxOutputBytes: 0 }, { ioMode: 'execute' }, { ioRead2140: [256] }, { ioRead2140: Array(1) }])
    assert.throws(() => prepare(modeFixture(), options));
});
test('F1FA synthetic probe pins original47/25 and15-byte proof plus successful and late failure records', async () => {
  const report = JSON.parse(await readFile('analysis/render-f1fa-native.json', 'utf8'));
  assert.match(report.scope, /explicitly synthetic/); assert.match(report.scope, /No audio\/device\/CPU\/clock/);
  assert.equal(report.source.covered_bytes, 47); assert.equal(report.source.instruction_count, 25);
  assert.equal(report.stackProof.minimum_protected_stack_bytes, 15); assert.equal(report.stackProof.external_return_assumptions, 0);
  assert.deepEqual(report.probes.map(p => p.handled), [true, true, true, true, true, true, false, false]);
  for (const p of report.probes.slice(6)) assert.equal(p.operations, undefined);
});
