import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderA98E, renderA98E } from '../proof/render/object-buffer-a98e.mjs';
import { renderA958 } from '../proof/render/transfer-list-a958.mjs';
import { cpuToOffset } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-a98e-native.json', import.meta.url), 'utf8'));
const entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const gateWindow = [0x7E1562, 0x7E1563];
const seedWord = (d, a, v) => d.seed(a, [v & 255, v >>> 8]);
const word = (d, a) => d.readByte(a).value | d.readByte(a + 1).value << 8;
function fixture({ gate = 1, bank = 0x80, writeWindows = [gateWindow] } = {}) {
  const data = createRenderData({ writeWindows });
  if (gate !== null) seedWord(data, bank * 65536 + 0x1562, gate);
  return data;
}
const prepare = (data, options = {}) => prepareRenderA98E({ ...entry, data, ...options });
const commit = (data, p) => { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.commit(p), { handled: true }); };
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  for (const key of ['operations', 'ioWrites', 'byteWrites']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}
const stores = [[0x4322, 0x3D08, 2], [0x4325, 0x220, 2], [0x2102, 0x8000, 2], [0x420B, 4, 1]];
const physicalBytes = [[0x4322, 8], [0x4323, 0x3D], [0x4325, 0x20], [0x4326, 2], [0x2102, 0], [0x2103, 0x80], [0x420B, 4], [0x1562, 0], [0x1563, 0]];

test('NativeA98E probe pins original36/14 separately from six synthetic gate/DBR/stack/write fixtures', () => {
  const raw = rom.subarray(cpuToOffset(0x81A98E, rom.length), cpuToOffset(0x81A9B2, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), '1268df78438cbeb285651bdc83ab3a77f3fcc71e3ec52ef179edcf217fce9b11');
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase()); assert.equal(report.source.instruction_count, 14);
  assert.equal(report.probes.length, 6); assert.match(report.scope, /synthetic/); assert.match(report.scope, /no device execution/);
});

test('Zero1562 needs only its WORD with no buffers, channelstate, I/O or writewindows', () => {
  for (let status = 0; status < 256; status++) {
    if (status & 0x38) continue;
    const data = fixture({ gate: 0, writeWindows: [] }), p = prepare(data, { status, ioMode: null }); commit(data, p);
    assert.equal(p.outcome, 'gate_1562_zero'); assert.equal(p.a, 0); assert.equal(p.status, (status & 0x7D) | 2);
    assert.equal(p.x, entry.x); assert.equal(p.y, entry.y); assert.equal(p.work, 1);
    assert.deepEqual(p.ioWrites, []); assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.readAddresses, [0x7E1562, 0x7E1563]);
  }
});

test('All65535 nonzero gateWORDs select identical fixed requests and A8004, without sign/count interpretation', () => {
  const data = fixture();
  for (let gate = 1; gate < 65536; gate++) {
    seedWord(data, 0x1562, gate); const p = prepare(data);
    assert.ok(p.handled); assert.equal(p.gate, gate); assert.equal(p.work, 6); assert.equal(p.a, 0x8004); assert.equal(p.status, 0x45);
    assert.deepEqual(p.ioWrites.map(e => [e.address & 65535, e.value, e.bytes]), stores);
    assert.deepEqual(p.byteWrites, [[0x7E1562, 0], [0x7E1563, 0]]);
  }
});

test('Four exact registerstores precede final WORDclear without demanding544 bufferbytes or channelsetup', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data); assert.deepEqual(data.snapshot(), before);
  assert.deepEqual(p.operations.map(e => [e.kind, e.space, e.address & 65535, e.value, e.bytes]),
    [['read', 'data', 0x1562, 1, 2], ...stores.map(([a, v, n]) => ['write', 'io', a, v, n]), ['write', 'data', 0x1562, 0, 2]]);
  assert.deepEqual(p.operations.map(e => e.phase), ['gate', 'request', 'request', 'request', 'request', 'clear']);
  assert.deepEqual(p.readAddresses, [0x7E1562, 0x7E1563]);
  for (const a of [0x7E3D08, 0x7E3F27, 0x4320, 0x4321, 0x4324]) assert.equal(data.readByte(a).available, false);
  commit(data, p); assert.equal(word(data, 0x1562), 0); assert.equal(p.transferComplete, undefined);
});

test('All legal status combinations retain C/V/I/X/Y but clear N/Z from BYTE04 despite negative WORD A8004', () => {
  for (let status = 0; status < 256; status++) {
    if (status & 0x38) continue;
    const data = fixture(), p = prepare(data, { status }); commit(data, p);
    assert.equal(p.a, 0x8004); assert.equal(p.status, status & 0x7D); assert.equal(p.status & 0x82, 0);
    assert.equal(p.carry, status & 1); assert.equal(p.overflow, status >>> 6 & 1);
    assert.equal(p.x, entry.x); assert.equal(p.y, entry.y);
  }
});

test('Physical7E/7F registeroffset stores create exact bytes and clear that actual DBRgate only', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 65536, data = fixture({ bank, gate: 0xFFFF, writeWindows: [[base + 0x1562, base + 0x1563], [base + 0x2000, base + 0x43FF]] });
    seedWord(data, (bank === 0x7E ? 0x7F0000 : 0x7E0000) + 0x1562, 0x8000);
    const p = prepare(data, { bank, ioMode: null }); assert.deepEqual(p.ioWrites, []);
    assert.deepEqual(p.byteWrites, physicalBytes.map(([a, v]) => [base + a, v])); commit(data, p);
    for (const [a, v] of physicalBytes) assert.equal(data.readByte(base + a).value, v);
    assert.equal(word(data, (bank === 0x7E ? 0x7F0000 : 0x7E0000) + 0x1562), 0x8000);
    assert.equal(p.a, 0x8004); assert.equal(p.status, 0x45);
  }
});

test('Physicalstores leave sourcebuffer and neighboring channelsetup bytes unchanged', () => {
  const data = fixture({ bank: 0x7E, writeWindows: [[0x7E1562, 0x7E1563], [0x7E2000, 0x7E43FF]] });
  for (const [a, v] of [[0x7E4320, 0xAB], [0x7E4321, 0xCD], [0x7E4324, 0x9B], [0x7E3D08, 0x12], [0x7E3F27, 0x34]]) data.seed(a, [v]);
  const before = data.snapshot(), p = prepare(data, { bank: 0x7E, ioMode: null }); commit(data, p);
  for (const [a, v] of before.bytes) if (![0x7E1562, 0x7E1563].includes(a)) assert.equal(data.readByte(a).value, v);
});

test('Every missing gatebyte stops before any request and leaves the owner unchanged', () => {
  for (const seed of [[], [[0x1562, [1]]], [[0x1563, [0]]]]) {
    const data = fixture({ gate: null }); for (const [a, values] of seed) data.seed(a, values);
    unchanged(data, {}, 'render_source_required', 'gate');
  }
});

test('Reached I/O mode is mandatory but zero gate never needs it', () => {
  const data = fixture(); const p = unchanged(data, { ioMode: null }, 'render_io_context_required', 'request'); assert.equal(p.address, 0x804322);
  const zero = fixture({ gate: 0, writeWindows: [] }); assert.ok(prepare(zero, { ioMode: null }).handled);
});

test('Both final gateclear bytes require explicit ownership and withhold all four earlier requests if absent', () => {
  for (const writeWindows of [[], [[0x7E1562, 0x7E1562]], [[0x7E1563, 0x7E1563]]])
    unchanged(fixture({ writeWindows }), {}, 'render_write_window_required', 'clear');
});

test('Each missing physical writebyte rejects its true phase without committing any earlier prefix', () => {
  for (const [missing] of physicalBytes) {
    const writeWindows = physicalBytes.filter(([a]) => a !== missing).map(([a]) => [0x7E0000 + a, 0x7E0000 + a]);
    const data = fixture({ bank: 0x7E, writeWindows }), p = unchanged(data, { bank: 0x7E, ioMode: null }, 'render_write_window_required', missing < 0x2000 ? 'clear' : 'request');
    assert.equal(p.address, 0x7E0000 + missing);
  }
});

test('Every incomplete active workbudget discards requests and finalclear; exact six operations succeed', () => {
  const data = fixture();
  for (let maxWork = 1; maxWork < 6; maxWork++) unchanged(data, { maxWork }, 'render_work_budget_required', maxWork === 5 ? 'clear' : 'request');
  const p = prepare(data, { maxWork: 6 }); commit(data, p); assert.equal(p.work, 6);
});

test('Three protected JSLbytes cover early source and every reached physical registerstore alias', () => {
  unchanged(fixture(), { stackWindow: [0x1562, 0x1564] }, 'render_stack_alias_required', 'gate');
  for (const offset of [0x4322, 0x4323, 0x4325, 0x4326, 0x2102, 0x2103, 0x420B]) {
    const data = fixture({ bank: 0x7E, writeWindows: [[0x7E1562, 0x7E1563], [0x7E2000, 0x7E43FF]] });
    unchanged(data, { bank: 0x7E, ioMode: null, stackWindow: [offset, offset + 2] }, 'render_stack_alias_required', 'request');
  }
});

test('All128 system DBRs share physical lowWRAM gate but preserve actual requested registeraddresses', () => {
  for (let bank = 0; bank < 256; bank++) if (!(bank & 0x40)) {
    const data = fixture({ bank }), p = prepare(data, { bank }); commit(data, p);
    assert.deepEqual(p.ioWrites.map(e => [e.address, e.value, e.bytes]), stores.map(([a, v, n]) => [bank * 65536 + a, v, n]));
    assert.deepEqual(p.byteWrites, [[0x7E1562, 0], [0x7E1563, 0]]); assert.equal(p.a, 0x8004); assert.equal(p.status, 0x45);
  }
});

test('Committed A98E clears the gate so a repeat uses only its zero path, with no repeated requests', () => {
  const data = fixture(), first = prepare(data); commit(data, first);
  const p = prepare(data, { ioMode: null }); commit(data, p);
  assert.equal(p.outcome, 'gate_1562_zero'); assert.equal(p.a, 0); assert.equal(p.status, 0x47);
  assert.deepEqual(p.ioWrites, []); assert.deepEqual(p.byteWrites, []); assert.equal(p.work, 1);
});

test('Shared outer view provides a fresh gate and commonbudget; inner results have no commitpayload', () => {
  const data = fixture({ gate: 0 }), before = data.snapshot(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]);
  view.write(0x1562, 1); const budget = { work: 3, maxWork: 9 }, p = renderA98E(view, entry, budget);
  assert.equal(p.gate, 1); assert.equal(p.work, 9); assert.equal(p.a, 0x8004); assert.equal(budget.work, 9);
  assert.equal(p.byteWrites, undefined); assert.throws(() => data.commit(p), /Invalid render plan/); assert.deepEqual(data.snapshot(), before);
  commit(data, view.finish(p)); assert.equal(word(data, 0x1562), 0);
});

test('A958 thenA98E share table/cursor/gate effects atomically; late A98E budget failure withholds both', () => {
  for (const maxWork of [17, 18]) {
    const data = createRenderData({ writeWindows: [gateWindow, [0x7E0082, 0x7E0083]] });
    seedWord(data, 0x1562, 1); seedWord(data, 0x82, 0); seedWord(data, 0x16D4, 0xFFC0); seedWord(data, 0x1754, 0xABCD); data.seed(0x1654, [0xCF]);
    const before = data.snapshot(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), budget = { work: 0, maxWork };
    const first = renderA958(view, entry, budget), context = { ...entry, x: first.x, status: first.status };
    if (maxWork === 17) {
      assert.throws(() => renderA98E(view, context, budget), e => e.renderBoundary && e.reason === 'render_work_budget_required' && e.phase === 'clear');
      assert.deepEqual(data.snapshot(), before);
    } else {
      const last = renderA98E(view, context, budget); assert.equal(last.a, 0x8004); assert.equal(last.x, 0xFFFE); assert.equal(last.work, 18);
      const outer = view.finish({ ...last, ioWrites: [...first.ioWrites, ...last.ioWrites] }); commit(data, outer);
      assert.equal(word(data, 0x82), 0xFFFE); assert.equal(word(data, 0x1562), 0); assert.equal(outer.ioWrites.length, 10);
    }
  }
});

test('Plan ownership, immutability and revisions prevent committing stale or foreign pending writes', () => {
  const data = fixture(), p = prepare(data), q = prepare(data);
  assert.ok(Object.isFrozen(p)); assert.ok(Object.isFrozen(p.ioWrites)); assert.ok(Object.isFrozen(p.ioWrites[0]));
  assert.ok(Object.isFrozen(p.byteWrites[0])); assert.throws(() => fixture().commit(p), /Invalid render plan/);
  commit(data, p); assert.deepEqual(data.commit(q), { handled: false, reason: 'render_plan_stale' });
  const prepared = prepare(data); seedWord(data, 0x1562, 1); assert.deepEqual(data.commit(prepared), { handled: false, reason: 'render_plan_stale' });
});

test('Explicit binary WORDentry, DP0,3 stackbytes and valid supplied registers/options remain required', () => {
  const data = fixture();
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 0x10 }, { status: 8 }, { directPage: 1 }, { emulation: 1 }])
    unchanged(data, options, 'render_entry_required');
  for (const stackWindow of [null, [0x100, 0x101], [0x102, 0x100]]) unchanged(data, { stackWindow }, 'render_stack_required');
  for (const options of [{ x: -1 }, { y: 65536 }, { ioMode: 'execute' }, { maxWork: 0 }, { bank: 256 }, { status: 256 }])
    assert.throws(() => prepare(data, options), /Invalid/);
  const p = prepare(data, { x: null, y: null, stackWindow: [0x100, 0x102] }); assert.ok(p.handled); assert.equal(p.x, null); assert.equal(p.y, null);
  const wrongBank = fixture(); unchanged(wrongBank, { bank: 0x40 }, 'render_address_required', 'gate');
});
