import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRender999A, render999A } from '../proof/render/palette-999a.mjs';
import { cpuToOffset } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-999a-native.json', import.meta.url), 'utf8'));
const windows = [[0x7E0D0E, 0x7E0D0F]];
const entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const seedWord = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const word = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function fixture({ flag = 1, count = 1, records = [0x800], tail = [0x5A, 0x80],
  bank = 0x80, writeWindows = windows, omit = null } = {}) {
  const data = createRenderData({ writeWindows }), base = bank * 65536;
  const bytes = new Map();
  records.forEach((v, i) => { bytes.set(0xD00 + i * 2, v & 255); bytes.set(0xD01 + i * 2, v >>> 8); });
  for (const [offset, value] of [[0xD0E, flag], [0xD10, count]]) if (value !== null) {
    bytes.set(offset, value & 255); bytes.set(offset + 1, value >>> 8);
  }
  if (tail) tail.forEach((v, i) => bytes.set(0xD12 + i, v));
  for (const [offset, value] of bytes) if (offset !== omit) data.seed(base + offset, [value]);
  return data;
}
const prepare = (data, options = {}) => prepareRender999A({ ...entry, data, ...options });
const commit = (data, plan) => { assert.ok(plan.handled, JSON.stringify(plan)); assert.deepEqual(data.commit(plan), { handled: true }); };
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), plan = prepare(data, options);
  assert.equal(plan.handled, false); assert.equal(plan.reason, reason);
  if (phase) assert.equal(plan.phase, phase);
  assert.deepEqual(data.snapshot(), before);
  for (const key of ['operations', 'ioWrites', 'byteWrites']) assert.equal(plan[key], undefined);
  return plan;
}
// Independent unsigned division / signed range oracle; no instruction execution.
const pointer = value => (value * 32 % 65536 + 0xF624 + Math.floor(value / 2048) % 2) % 65536;
const overflow = value => {
  const shifted = value * 32 % 65536;
  const signedSum = (shifted < 32768 ? shifted : shifted - 65536) - 2524 + Math.floor(value / 2048) % 2;
  return Number(signedSum < -32768 || signedSum > 32767);
};

test('Native999A probe pins all81 original local bytes separately from synthetic data', () => {
  const raw = rom.subarray(cpuToOffset(0x80999A, rom.length), cpuToOffset(0x8099EB, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), 'c90a0be74ae4dbcc7c22e80cfa125f5d2ff78f9e38d975c93af68832d4bb1643');
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase());
  assert.equal(report.source.instruction_count, 40); assert.match(report.scope, /synthetic/);
  assert.match(report.scope, /no device execution/);
});

test('Zero first999A gate reads only its WORD and preserves entry C/V/I/X/Y without I/O', () => {
  for (const status of [0, 1, 4, 0x40, 0xC7]) {
    const data = fixture({ flag: 0, count: null, records: [], tail: null, writeWindows: [] });
    const p = prepare(data, { status, ioMode: null }); commit(data, p);
    assert.equal(p.outcome, 'gate_0D0E_zero'); assert.equal(p.a, 0); assert.equal(p.status, (status & 0x7D) | 2);
    assert.equal(p.x, entry.x); assert.equal(p.y, entry.y); assert.equal(p.count, null);
    assert.equal(p.iterations, 0); assert.equal(p.work, 1); assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []);
    assert.deepEqual(p.readAddresses, [0x7E0D0E, 0x7E0D0F]);
  }
});

test('Zero count returns after two gates with Y preserved and leaves the nonzero pending flag intact', () => {
  const data = fixture({ flag: 0x8001, count: 0, records: [], tail: null, writeWindows: [] });
  const p = prepare(data, { ioMode: null }); commit(data, p);
  assert.equal(p.outcome, 'gate_0D10_zero'); assert.equal(p.status, 0x47); assert.equal(p.y, entry.y);
  assert.equal(p.count, 0); assert.equal(p.initialY, null); assert.equal(p.work, 2);
  assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []); assert.equal(word(data, 0xD0E), 0x8001);
});

test('Three visits descend freshly and pin the five requests per visit plus ordered tail/clear', () => {
  const data = fixture({ count: 3, records: [0x400, 0x800, 0x7FF] }), before = data.snapshot(), p = prepare(data);
  assert.ok(p.handled); assert.deepEqual(data.snapshot(), before);
  assert.deepEqual(p.ioWrites.map(e => [e.address & 65535, e.value, e.bytes]),
    [...[[0x7FF, 6], [0x800, 4], [0x400, 2]].flatMap(([v, y]) =>
      [[0x4342, pointer(v), 2], [0x4345, 30, 2], [0x2121, y * 8 + 1, 1], [0x4344, 0x8C, 1], [0x420B, 16, 1]]),
    [0x2121, 0, 1], [0x2122, 0x5A, 1], [0x2122, 0x80, 1]]);
  assert.deepEqual(p.operations.filter(e => e.kind === 'read').map(e => [e.address & 65535, e.bytes]),
    [[0xD0E, 2], [0xD10, 2], [0xD04, 2], [0xD02, 2], [0xD00, 2], [0xD12, 1], [0xD13, 1]]);
  assert.deepEqual(p.operations.slice(-6).map(e => [e.kind, e.address & 65535, e.bytes]),
    [['write', 0x2121, 1], ['read', 0xD12, 1], ['write', 0x2122, 1], ['read', 0xD13, 1], ['write', 0x2122, 1], ['write', 0xD0E, 2]]);
  assert.equal(p.iterations, 3); assert.equal(p.initialY, 6); assert.equal(p.y, 0); assert.equal(p.work, 26);
  assert.equal(p.a, 0x80); assert.equal(p.status, 0xC4); commit(data, p); assert.equal(word(data, 0xD0E), 0);
});

test('All65536 native record values match independent pointer/overflow arithmetic and ignore entry Carry', () => {
  const data = fixture();
  for (let value = 0; value < 65536; value++) {
    seedWord(data, 0xD00, value); const p = prepare(data, { status: value & 1 ? 0xC4 : 0xC5 });
    assert.ok(p.handled); assert.equal(p.ioWrites[0].value, pointer(value));
    assert.equal(p.overflow, overflow(value)); assert.equal(p.carry, 0); assert.equal(p.status, 0x84 | overflow(value) * 64);
  }
});

test('All256 final BYTEs retain zero highA and BYTE N/Z after WORD return, with ADC V preserved', () => {
  const data = fixture({ records: [0x400] });
  for (let value = 0; value < 256; value++) {
    data.seed(0xD13, [value]); const p = prepare(data); assert.ok(p.handled);
    assert.equal(p.a, value); assert.equal(p.status, 0x44 | (value >= 128 ? 128 : 0) | (value === 0 ? 2 : 0));
    assert.equal(p.x, entry.x); assert.equal(p.y, 0); assert.equal(p.ioWrites.at(-1).value, value);
  }
});

test('Count8001 wraps to Y2 and performs one visit without changing its saved count WORD', () => {
  const data = fixture({ count: 0x8001 }), p = prepare(data); commit(data, p);
  assert.equal(p.initialY, 2); assert.equal(p.iterations, 1); assert.equal(p.ioWrites.length, 8);
  assert.equal(p.work, 14); assert.equal(word(data, 0xD10), 0x8001);
});

test('Count8000 enters at Y0 and completes32768 live physical WRAM visits including bankcarry', () => {
  const data = createRenderData({ writeWindows: [[0x7E0000, 0x7EFFFF]] });
  data.seed(0x7E0CFE, new Uint8Array(65536));
  seedWord(data, 0x7E0D00, 0x400); seedWord(data, 0x7E0D0E, 1); seedWord(data, 0x7E0D10, 0x8000);
  data.seed(0x7E0D12, [0x5A, 0x80]);
  const p = prepare(data, { bank: 0x7E, ioMode: null, stackWindow: [0x100, 0x101] }); assert.ok(p.handled, JSON.stringify(p));
  const reads = p.operations.filter(e => e.phase === 'records' && e.kind === 'read');
  assert.equal(reads.length, 32768); assert.equal(reads[0].address, 0x7E0CFE); assert.equal(reads[1].address, 0x7F0CFC);
  assert.equal(reads.at(-1).address, 0x7E0D00); assert.equal(p.initialY, 0); assert.equal(p.iterations, 32768);
  assert.equal(p.work, 196616); assert.equal(p.operations.length, p.work); assert.equal(p.readAddresses.length, 65536);
  assert.equal(p.a, 0x80); assert.equal(p.status, 0xC4); assert.deepEqual(p.ioWrites, []);
  commit(data, p); assert.equal(word(data, 0x7E0D0E), 0); assert.equal(word(data, 0x7E4342), pointer(0x400));
});

test('CountFFFF reaches the true first indexed record beyond the entry bank without a clamp', () => {
  const data = fixture({ bank: 0x7E, count: 0xFFFF, records: [], tail: null });
  const p = unchanged(data, { bank: 0x7E }, 'render_source_required', 'records');
  assert.equal(p.address, 0x7F0CFC);
});

test('Indexed bankcarry requires both actual7F bytes before any physical register write', () => {
  const data = fixture({ bank: 0x7E, count: 0x7981, records: [], tail: null }); data.seed(0x7F0000, [1]);
  assert.equal(unchanged(data, { bank: 0x7E }, 'render_source_required', 'records').address, 0x7F0001);
});

test('Physical7F indexed carry enters bank80 low WRAM mirrors instead of wrapping inside7F', () => {
  const data = fixture({ bank: 0x7F, count: 0x7981, records: [], tail: null }); data.seed(0x7E0000, [1]);
  assert.equal(unchanged(data, { bank: 0x7F }, 'render_source_required', 'records').address, 0x7E0001);
});

test('Reached I/O record reads remain unsupported even when register request recording is enabled', () => {
  const p = unchanged(fixture({ count: 0x982, records: [], tail: null }), {}, 'render_address_required', 'records');
  assert.equal(p.address, 0x802002);
});

test('Indexed ROM records require explicitly seeded physical source bytes and never hydrate implicitly', () => {
  const data = fixture({ count: 0x3981, records: [], tail: null }); data.seed(0x808000, [0xA5]);
  assert.equal(unchanged(data, {}, 'render_source_required', 'records').address, 0x808001);
});

test('List reads may alias pending flag, saved count and tailbytes before the final clear', () => {
  const data = fixture({ count: 10, records: Array(10).fill(0), flag: 0x1234, tail: [0xA5, 0x80] }), p = prepare(data);
  assert.ok(p.handled);
  const reads = p.operations.filter(e => e.phase === 'records' && e.kind === 'read');
  for (const [offset, value] of [[0xD0E, 0x1234], [0xD10, 10], [0xD12, 0x80A5]])
    assert.equal(reads.find(e => (e.address & 65535) === offset).value, value);
  assert.equal(word(data, 0xD0E), 0x1234); commit(data, p); assert.equal(word(data, 0xD0E), 0);
});

test('Physical registerwrites change the next record read through the same ordered byte view', () => {
  const data = createRenderData({ writeWindows: [[0x7E0000, 0x7EFFFF]] });
  data.seed(0x7E0D00, new Uint8Array(0x4346 - 0xD00));
  seedWord(data, 0x7E4344, 0xABCD); seedWord(data, 0x7E0D0E, 1); seedWord(data, 0x7E0D10, 0x1B23);
  const before = data.snapshot(), p = prepare(data, { bank: 0x7E, ioMode: null, stackWindow: [0x100, 0x101] });
  assert.ok(p.handled); assert.deepEqual(data.snapshot(), before);
  const reads = p.operations.filter(e => e.phase === 'records' && e.kind === 'read');
  assert.equal(reads[0].address, 0x7E4344); assert.equal(reads[0].value, 0xABCD);
  assert.equal(reads[1].address, 0x7E4342); assert.equal(reads[1].value, pointer(0xABCD));
  assert.deepEqual(p.ioWrites, []); commit(data, p);
});

test('Each individually missing reached gate/record/tail byte rolls back all planned requests', () => {
  for (const offset of [0xD0E, 0xD0F, 0xD10, 0xD11, 0xD00, 0xD01, 0xD02, 0xD03, 0xD12, 0xD13]) {
    const p = unchanged(fixture({ count: 2, records: [0x800, 0x400], omit: offset }), {}, 'render_source_required');
    assert.equal(p.address, 0x7E0000 + offset);
  }
});

test('Missing either final flagclear byte ownership rolls back every preceding request and tail write', () => {
  for (const address of [0x7E0D0E, 0x7E0D0F]) {
    const p = unchanged(fixture({ writeWindows: [[address ^ 1, address ^ 1]] }), {}, 'render_write_window_required', 'tail');
    assert.equal(p.address, address);
  }
});

test('Every workbudget boundary retains no partial effects, while the exact complete budget succeeds', () => {
  const options = { count: 3, records: [1, 2, 3] }, p = prepare(fixture(options)); assert.ok(p.handled);
  assert.equal(p.work, 26); assert.equal(p.operations.length, p.work);
  for (let maxWork = 1; maxWork < 26; maxWork++) unchanged(fixture(options), { maxWork }, 'render_work_budget_required');
  const data = fixture(options); commit(data, prepare(data, { maxWork: 26 }));
});

test('Reached systembank registerstores require an explicit request-only I/O context', () => {
  const p = unchanged(fixture(), { ioMode: null }, 'render_io_context_required', 'records'); assert.equal(p.address, 0x804342);
});

test('Two-byte JSRframe and all reached read/write aliases are explicitly stack-protected', () => {
  unchanged(fixture(), { stackWindow: null }, 'render_stack_required');
  unchanged(fixture(), { stackWindow: [0x1FFF, 0x1FFF] }, 'render_stack_required');
  assert.ok(prepare(fixture(), { stackWindow: [0x1FFE, 0x1FFF] }).handled);
  for (const [lo, phase] of [[0xD0E, 'gates'], [0xD00, 'records'], [0xD12, 'tail']])
    unchanged(fixture(), { stackWindow: [lo, lo + 1] }, 'render_stack_alias_required', phase);
  const data = fixture({ bank: 0x7E, writeWindows: [[0x7E0000, 0x7EFFFF]] });
  unchanged(data, { bank: 0x7E, stackWindow: [0x2121, 0x2122] }, 'render_stack_alias_required', 'records');
});

test('All128 systembank mirrors preserve actual register addresses and shared WRAM flagbytes', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40) continue;
    const data = fixture({ bank }), p = prepare(data, { bank }); commit(data, p);
    assert.equal(p.ioWrites[0].address, bank * 65536 + 0x4342); assert.equal(p.ioWrites.at(-1).address, bank * 65536 + 0x2122);
    assert.equal(p.x, entry.x); assert.equal(p.y, 0); assert.equal(word(data, 0x800D0E), 0);
    assert.equal(data.readByte(bank * 65536 + 0x420B).available, false);
  }
});

test('Physical7E/7F keeps registers as owned WRAM writes, preserves BYTE neighbors and stays atomic', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 65536, data = fixture({ bank, writeWindows: [[base, base + 65535]] });
    data.seed(base + 0x2120, [0xA5]); data.seed(base + 0x2123, [0x5A]);
    const p = prepare(data, { bank, ioMode: null }); assert.ok(p.handled); assert.deepEqual(p.ioWrites, []);
    assert.equal(data.readByte(base + 0x4342).available, false); commit(data, p);
    assert.equal(word(data, base + 0x4342), 0xF625); assert.equal(word(data, base + 0x4345), 30);
    assert.equal(data.readByte(base + 0x4344).value, 0x8C); assert.equal(data.readByte(base + 0x420B).value, 16);
    assert.equal(data.readByte(base + 0x2121).value, 0); assert.equal(data.readByte(base + 0x2122).value, 0x80);
    assert.equal(data.readByte(base + 0x2120).value, 0xA5); assert.equal(data.readByte(base + 0x2123).value, 0x5A);
    if (bank === 0x7F) assert.equal(data.readByte(0x7E0D0E).available, false);
  }
  unchanged(fixture({ bank: 0x7E }), { bank: 0x7E }, 'render_write_window_required', 'records');
});

test('Inner999A consumes prior shared writes and budget, while only its outer finished plan commits', () => {
  const data = fixture({ records: [0], writeWindows: [...windows, [0x7E0D00, 0x7E0D01]] });
  const view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]); view.write(0xD01, 8);
  const budget = { work: 3, maxWork: 100 }, inner = render999A(view, entry, budget);
  assert.equal(inner.ioWrites[0].value, 0xF625); assert.equal(inner.work, 17); assert.equal(budget.work, 17);
  assert.throws(() => data.commit(inner), /Invalid render plan/); assert.equal(word(data, 0xD00), 0);
  commit(data, view.finish(inner)); assert.equal(word(data, 0xD00), 0x800);
  const lateData = fixture({ tail: null, writeWindows: [...windows, [0x7E0D00, 0x7E0D01]] });
  const before = lateData.snapshot(), lateView = prepareRenderView(lateData); lateView.write(0xD01, 8);
  assert.throws(() => render999A(lateView, entry, { work: 0, maxWork: 100 }),
    error => error.renderBoundary && error.reason === 'render_source_required' && error.phase === 'tail');
  assert.deepEqual(lateData.snapshot(), before);
});

test('Invalid contexts and immutable/stale/foreign/copied plans cannot mutate their owner', () => {
  const data = fixture();
  for (const options of [{ bank: null }, { status: null }, { status: 8 }, { status: 16 }, { status: 32 }, { emulation: 1 }, { directPage: 1 }])
    unchanged(data, options, 'render_entry_required');
  unchanged(data, { bank: 0x40 }, 'render_address_required', 'gates');
  for (const options of [{ bank: 256 }, { status: -1 }, { x: 65536 }, { y: -1 }, { maxWork: 0 }, { ioMode: 'execute' }])
    assert.throws(() => prepare(data, options), /Invalid render/);
  const p = prepare(data); assert.throws(() => { p.ioWrites[0].value = 0; }, TypeError);
  assert.throws(() => { p.byteWrites[0][1] = 255; }, TypeError); assert.throws(() => { p.operations.push({}); }, TypeError);
  assert.throws(() => fixture().commit(p), /Invalid render plan/); assert.throws(() => data.commit({ ...p }), /Invalid render plan/);
  seedWord(data, 0xD00, 1); const before = data.snapshot();
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), before);
});

test('Ten synthetic probes reproduce both gates, pointer boundaries, BYTE tail and countwrap', () => {
  assert.equal(report.probes.length, 10);
  for (const probe of report.probes) {
    const p = prepare(fixture(probe.fixture));
    for (const key of ['handled', 'outcome', 'a', 'x', 'y', 'bank', 'status', 'carry', 'overflow', 'count', 'initialY', 'iterations', 'work', 'operations', 'ioWrites', 'byteWrites', 'readAddresses'])
      assert.deepEqual(p[key], probe[key]);
  }
});
