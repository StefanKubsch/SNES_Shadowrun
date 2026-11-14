import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRender8FBA, render8FBA } from '../proof/render/transfer-palette-8fba.mjs';
import { renderA98E } from '../proof/render/object-buffer-a98e.mjs';
import { cpuToOffset } from './rom.mjs';

const entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const seedWord = (d, a, v) => d.seed(a, [v & 255, v >>> 8]);
const word = (d, a) => d.readByte(a).value | d.readByte(a + 1).value << 8;
function fixture({ gate = 0, pointer = 0xFFFF, paletteIndex = 0xA1, sourceBank = 0x8D, bank = 0x80,
  writeWindows = [[0x7E0140, 0x7E0141]], missing = [] } = {}) {
  const data = createRenderData({ writeWindows });
  for (const [a, v] of [[bank * 65536 + 0x140, gate & 255], [bank * 65536 + 0x141, gate >>> 8],
    [0xF6, pointer & 255], [0xF7, pointer >>> 8], [0xF8, sourceBank], [bank * 65536 + 0x142, paletteIndex]])
    if (!missing.includes(a)) data.seed(a, [v]);
  return data;
}
const prepare = (data, options = {}) => prepareRender8FBA({ ...entry, data, ...options });
const commit = (data, p) => { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.commit(p), { handled: true }); };
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  for (const key of ['operations', 'ioWrites', 'byteWrites']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}
const stores = [[0x2116, 0, 2], [0x420B, 1, 1], [0x4342, 2, 2], [0x4345, 0x1E, 2],
  [0x2121, 0xA1, 1], [0x4344, 0x8D, 1], [0x420B, 0x10, 1]];
const physicalBytes = [[0x2116, 0], [0x2117, 0], [0x420B, 0x10], [0x4342, 2], [0x4343, 0],
  [0x4345, 0x1E], [0x4346, 0], [0x2121, 0xA1], [0x4344, 0x8D], [0x140, 0xFF], [0x141, 0xFF]];

test('Native8FBA probe pins original59/24 separately from eight synthetic fixtures', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const raw = rom.subarray(cpuToOffset(0x808FBA, rom.length), cpuToOffset(0x808FF5, rom.length));
  const report = JSON.parse(await readFile(new URL('../analysis/render-8fba-native.json', import.meta.url), 'utf8'));
  assert.equal(createHash('sha256').update(raw).digest('hex'), '18655de4a121db47dcfeba902f2669aaf96cd7e6278346678cef3845029487fb');
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase()); assert.equal(report.source.instruction_count, 24);
  assert.equal(report.probes.length, 8); assert.match(report.scope, /synthetic/); assert.match(report.scope, /no device execution/);
});

test('All32768 negative gates return their WORD, preserved C/V/I, and only one read', () => {
  const data = createRenderData();
  for (let gate = 0x8000; gate <= 0xFFFF; gate++) {
    seedWord(data, 0x140, gate); const p = prepare(data, { ioMode: null });
    assert.ok(p.handled); assert.equal(p.a, gate); assert.equal(p.status, 0xC5); assert.equal(p.work, 1);
    assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []); assert.deepEqual(p.readAddresses, [0x7E0140, 0x7E0141]);
  }
});

test('All32768 nonnegative gates include zero as actual target without count semantics', () => {
  const data = fixture();
  for (let gate = 0; gate < 0x8000; gate++) {
    seedWord(data, 0x140, gate); const p = prepare(data);
    assert.ok(p.handled); assert.equal(p.ioWrites[0].value, gate); assert.equal(p.work, 12); assert.equal(p.a, 0xFFFF);
    assert.equal(p.status, 0x85); assert.equal(p.ioWrites.length, 7);
  }
});

test('All65536 pointers have WORDwrap, Carry from unsigned addition and Overflow from signed range', () => {
  const data = fixture();
  for (let pointer = 0; pointer <= 65535; pointer++) {
    seedWord(data, 0xF6, pointer); const p = prepare(data);
    const signed = pointer < 32768 ? pointer : pointer - 65536, sum = signed + 3;
    assert.ok(p.handled); assert.equal(p.pointerOffset, (pointer + 3) % 65536);
    assert.equal(p.carry, Number(pointer + 3 >= 65536)); assert.equal(p.overflow, Number(sum > 32767 || sum < -32768));
    assert.equal(p.sourceBank, 0x8D); assert.equal(p.a, 0xFFFF);
  }
});

test('Every valid incoming status preserves I/X/Y and replaces C/V/N/Z exactly', () => {
  for (let status = 0; status < 256; status++) {
    if (status & 0x38) continue;
    for (const [pointer, cv] of [[0, 0], [0x7FFD, 0x40], [0xFFFD, 1]]) {
      const p = prepare(fixture({ pointer }), { status });
      assert.equal(p.status, (status & 0x3C) | 0x80 | cv); assert.equal(p.x, entry.x); assert.equal(p.y, entry.y);
    }
    const p = prepare(fixture({ gate: 0x8000 }), { status }); assert.equal(p.status, (status & 0x7D) | 0x80);
  }
});

test('Fresh reads interleave seven ordered stores, including both420B requests, before lateFFFF marker', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data); assert.deepEqual(data.snapshot(), before);
  assert.deepEqual(p.operations.map(e => [e.kind, e.address & 65535, e.value, e.bytes]),
    [['read', 0x140, 0, 2], ...stores.slice(0, 2).map(([a, v, b]) => ['write', a, v, b]), ['read', 0xF6, 0xFFFF, 2],
      ...stores.slice(2, 4).map(([a, v, b]) => ['write', a, v, b]), ['read', 0x142, 0xA1, 1],
      ['write', 0x2121, 0xA1, 1], ['read', 0xF8, 0x8D, 1], ['write', 0x4344, 0x8D, 1], ['write', 0x420B, 0x10, 1], ['write', 0x140, 0xFFFF, 2]]);
  assert.deepEqual(p.ioWrites.map(e => [e.address & 65535, e.value, e.bytes]), stores);
  assert.deepEqual(p.byteWrites, [[0x7E0140, 255], [0x7E0141, 255]]); commit(data, p); assert.equal(word(data, 0x140), 0xFFFF);
  assert.equal(p.transferComplete, undefined);
});

test('BYTE sources exclude neighbors and do not require transferbuffers or channelsetup', () => {
  const data = fixture(), p = prepare(data); assert.ok(p.handled);
  assert.deepEqual(p.readAddresses, [0x7E00F6, 0x7E00F7, 0x7E00F8, 0x7E0140, 0x7E0141, 0x7E0142]);
  for (const a of [0xF9, 0x143, 0x4340, 0x4341, 0x8D0002]) assert.equal(data.readByte(a).available, false);
});

test('DBR7F gate and index coexist with bank00 DP, preserving unrelated7F DPbytes', () => {
  const data = fixture({ bank: 0x7F, writeWindows: [[0x7F0140, 0x7F0141], [0x7F2000, 0x7F43FF]] });
  data.seed(0x7F00F6, [0x11, 0x22, 0x33]); const p = prepare(data, { bank: 0x7F, ioMode: null });
  assert.ok(p.handled); assert.equal(p.pointer, 0xFFFF); assert.equal(p.sourceBank, 0x8D); commit(data, p);
  assert.equal(word(data, 0x7F00F6), 0x2211); assert.equal(data.readByte(0x7F00F8).value, 0x33);
});

test('Physical7E/7F stores produce exact WRAM bytes and leave source parameters intact', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 65536, data = fixture({ bank, writeWindows: [[base + 0x140, base + 0x141], [base + 0x2000, base + 0x43FF]] });
    const p = prepare(data, { bank, ioMode: null }); assert.deepEqual(p.ioWrites, []);
    assert.equal(p.operations.filter(e => e.address === base + 0x420B).length, 2);
    commit(data, p); for (const [a, v] of physicalBytes) assert.equal(data.readByte(base + a).value, v);
    assert.equal(word(data, 0xF6), 0xFFFF); assert.equal(data.readByte(0xF8).value, 0x8D); assert.equal(data.readByte(base + 0x142).value, 0xA1);
  }
});

test('All128 system DBRs record requests with actual bank and common low WRAM aliases', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40) continue;
    const p = prepare(fixture({ bank }), { bank }); assert.ok(p.handled);
    assert.deepEqual(p.ioWrites.map(e => e.address), stores.map(([a]) => bank * 65536 + a));
  }
});

test('Every missing source byte rejects its reached phase and publishes no prefix', () => {
  for (const a of [0x800140, 0x800141, 0xF6, 0xF7, 0x800142, 0xF8])
    unchanged(fixture({ missing: [a] }), {}, 'render_source_required', a === 0x800140 || a === 0x800141 ? 'gate' : 'request');
});

test('Both late marker bytes require permission and withhold all seven prior requests', () => {
  for (const writeWindows of [[], [[0x7E0140, 0x7E0140]], [[0x7E0141, 0x7E0141]]])
    unchanged(fixture({ writeWindows }), {}, 'render_write_window_required', 'marker');
});

test('Every missing physical writebyte rejects atomically at its true phase', () => {
  for (const [missing] of physicalBytes) {
    const writeWindows = physicalBytes.filter(([a]) => a !== missing).map(([a]) => [0x7E0000 + a, 0x7E0000 + a]);
    const p = unchanged(fixture({ bank: 0x7E, writeWindows }), { bank: 0x7E, ioMode: null }, 'render_write_window_required', missing < 0x2000 ? 'marker' : 'request');
    assert.equal(p.address, 0x7E0000 + missing);
  }
});

test('All eleven incomplete active budgets roll back; exact12 and negative1 succeed', () => {
  const data = fixture();
  for (let maxWork = 1; maxWork < 12; maxWork++) unchanged(data, { maxWork }, 'render_work_budget_required', maxWork === 11 ? 'marker' : 'request');
  assert.equal(prepare(data, { maxWork: 12 }).work, 12);
  assert.equal(prepare(fixture({ gate: 0x8000 }), { maxWork: 1 }).work, 1);
});

test('Reached I/O requires explicit request mode, but negative gate does not', () => {
  const p = unchanged(fixture(), { ioMode: null }, 'render_io_context_required', 'request'); assert.equal(p.address, 0x802116);
  assert.ok(prepare(fixture({ gate: 0x8000 }), { ioMode: null }).handled);
});

test('Two protected JSRbytes suffice; smaller or undeclared stack does not', () => {
  const data = fixture(); assert.ok(prepare(data, { stackWindow: [0x1FFE, 0x1FFF] }).handled);
  for (const stackWindow of [null, [0x1FFF, 0x1FFF]]) unchanged(data, { stackWindow }, 'render_stack_required');
});

test('Early gate, late DP and physical register stack aliases discard all effects', () => {
  for (const [stackWindow, phase] of [[[0x140, 0x141], 'gate'], [[0xF6, 0xF7], 'request'], [[0xF8, 0xF9], 'request']])
    unchanged(fixture(), { stackWindow }, 'render_stack_alias_required', phase);
  unchanged(fixture({ bank: 0x7E, writeWindows: [[0x7E0140, 0x7E0141], [0x7E2000, 0x7E43FF]] }),
    { bank: 0x7E, ioMode: null, stackWindow: [0x4344, 0x4345] }, 'render_stack_alias_required', 'request');
});

test('Entry declaration rejects byte widths, decimal mode and missing machine assumptions', () => {
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 0x10 }, { status: 8 }, { emulation: 1 }, { directPage: 1 }])
    unchanged(fixture(), options, 'render_entry_required');
  for (const options of [{ x: -1 }, { y: 65536 }, { ioMode: 'execute' }, { maxWork: 0 }]) assert.throws(() => prepare(fixture(), options));
});

test('Marker commit makes next invocation negative without requiring further parameters', () => {
  const data = fixture(); commit(data, prepare(data)); const p = prepare(data, { ioMode: null });
  assert.equal(p.outcome, 'gate_0140_negative'); assert.equal(p.a, 0xFFFF); assert.equal(p.work, 1); assert.deepEqual(p.byteWrites, []);
});

test('Shared outer owner sees freshly written gate/DP values and owns sole commit payload', () => {
  const data = fixture({ writeWindows: [[0x7E0140, 0x7E0141], [0x7E00F6, 0x7E00F8]] });
  const view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), budget = { work: 0, maxWork: 12 };
  view.write(0x140, 8); view.write(0xF6, 0xFD); view.write(0xF7, 0x7F); view.write(0xF8, 0x7E);
  const inner = render8FBA(view, entry, budget); assert.equal(inner.gate, 8); assert.equal(inner.pointerOffset, 0x8000); assert.equal(inner.overflow, 1);
  assert.equal(inner.sourceBank, 0x7E); assert.throws(() => data.commit(inner)); assert.equal(word(data, 0x140), 0);
  commit(data, view.finish(inner)); assert.equal(word(data, 0x140), 0xFFFF);
});

test('Late8FBA budget boundary discards earlierA98E requests and its clear in shared plan', () => {
  const data = fixture({ writeWindows: [[0x7E0140, 0x7E0141], [0x7E1562, 0x7E1563]] }); seedWord(data, 0x1562, 1);
  const before = data.snapshot(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), budget = { work: 0, maxWork: 17 };
  const first = renderA98E(view, entry, budget); assert.equal(first.ioWrites.length, 4);
  assert.throws(() => render8FBA(view, entry, budget), error => error.renderBoundary && error.phase === 'marker');
  assert.deepEqual(data.snapshot(), before);
  const completeView = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), completeBudget = { work: 0, maxWork: 18 };
  renderA98E(completeView, entry, completeBudget); const last = render8FBA(completeView, entry, completeBudget);
  commit(data, completeView.finish(last)); assert.equal(word(data, 0x1562), 0); assert.equal(word(data, 0x140), 0xFFFF);
});

test('Owner/revision and frozen public results preserve private commit payload', () => {
  const data = fixture(), p = prepare(data); assert.throws(() => fixture().commit(p));
  assert.ok(Object.isFrozen(p)); assert.ok(Object.isFrozen(p.operations)); assert.ok(Object.isFrozen(p.operations[0]));
  assert.throws(() => { p.byteWrites[0][1] = 0; });
  data.seed(0xF8, [0]); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  const first = prepare(data), second = prepare(data); commit(data, first); assert.deepEqual(data.commit(second), { handled: false, reason: 'render_plan_stale' });
});
