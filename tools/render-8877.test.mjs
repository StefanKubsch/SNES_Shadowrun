import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRender8877, render8877 } from '../proof/render/color-8877.mjs';
import { renderB0D1 } from '../proof/render/fade-b0d1.mjs';

const context = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1EE0, 0x1EEF], ioMode: 'record-requests' };
const seedWord = (d, a, v) => d.seed(a, [v % 256, Math.floor(v / 256)]);
const word = (d, a) => d.readByte(a).value + d.readByte(a + 1).value * 256;
const table = JSON.parse(await readFile(new URL('../assets/render-8877-data.json', import.meta.url), 'utf8')).sources[0];
function fixture({ gate = 2, phaseWord = 0x100, tableByte = null, bank = 0x80, missing = [],
  writeWindows = [[bank === 0x7F ? 0x7F1FDC : 0x7E1FDC, bank === 0x7F ? 0x7F1FDF : 0x7E1FDF]] } = {}) {
  const d = createRenderData({ writeWindows }), base = bank * 65536;
  for (const [offset, v] of [[0x1FDC, gate], [0x1FDE, phaseWord]])
    for (let j = 0; j < 2; j++) if (!missing.includes(base + offset + j)) d.seed(base + offset + j, [j ? Math.floor(v / 256) : v % 256]);
  if (!(gate & 0x8001) && gate & 6) {
    const index = (phaseWord + (gate & 2 ? 64 : 16)) % 512, address = base + 0xD3D1 + index;
    if (!missing.includes(address)) d.seed(address, [tableByte ?? table.bytes[index]]);
  }
  return d;
}
const prepare = (data, options = {}) => prepareRender8877({ ...context, data, ...options });
const committed = (d, p) => { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(d.commit(p), { handled: true }); };
function unchanged(d, options, reason) {
  const before = d.snapshot(), p = prepare(d, options); assert.equal(p.handled, false); assert.equal(p.reason, reason);
  for (const key of ['operations', 'ioWrites', 'byteWrites']) assert.equal(p[key], undefined);
  assert.deepEqual(d.snapshot(), before); return p;
}
const requests = p => p.ioWrites.map(e => [e.address & 65535, e.value, e.bytes]);

test('Ten synthetic probes reproduce exactly; original185/82 and512BYTE table stay separate', async () => {
  const report = JSON.parse(await readFile(new URL('../analysis/render-8877-native.json', import.meta.url), 'utf8'));
  assert.equal(report.probes.length, 10); assert.match(report.scope, /synthetic/);
  assert.equal(report.source.reduce((n, s) => n + s.covered_bytes, 0), 185); assert.equal(report.table.length, 512);
  for (const p of report.probes) {
    const data = fixture({ ...p.fixture, writeWindows: p.writeWindows });
    assert.deepEqual(prepare(data, { bank: p.fixture.bank }), Object.fromEntries(Object.entries(p).filter(([k]) => !['fixture', 'writeWindows'].includes(k))));
  }
});
test('Every originaltable index is read as one BYTE atactualDBR and yields exact requests', () => {
  const d = fixture(); d.seed(table.address, table.bytes);
  for (const gate of [2, 4]) for (let index = 0; index < 512; index++) {
    seedWord(d, 0x1FDC, gate); seedWord(d, 0x1FDE, (index + 512 - (gate === 2 ? 64 : 16)) % 512);
    const p = prepare(d), divided = Math.floor(table.bytes[index] / (gate === 2 ? 8 : 16));
    assert.equal(p.x, index); assert.equal(p.tableByte, table.bytes[index]);
    assert.equal(p.ioWrites[0].value, (gate === 2 ? 0xE0 : 0x20) + Math.max(0, divided - 1));
    const reads = p.operations.filter(e => e.kind === 'read' && (e.address & 65535) >= 0xD3D1);
    assert.deepEqual(reads.map(e => [e.address, e.bytes]), [[0x80D3D1 + index, 1]]);
  }
});

test('ThreeJSLbytes and reached stackaliases excluded for source/write/table', () => {
  unchanged(fixture(), { stackWindow: [0x1FFD, 0x1FFE] }, 'render_stack_required');
  assert.ok(prepare(fixture(), { stackWindow: [0x1FFD, 0x1FFF] }).handled);
  for (const stackWindow of [[0x1FDC, 0x1FDE], [0x1FDE, 0x1FE0]]) unchanged(fixture(), { stackWindow }, 'render_stack_alias_required');
  unchanged(fixture({ bank: 0x7E }), { bank: 0x7E, stackWindow: [0xD510, 0xD512] }, 'render_stack_alias_required');
});
test('Sharedouterview sees priorwrites; late8877 failure also discards earlier fade effects', () => {
  const d = createRenderData({ writeWindows: [[0x7E01C6, 0x7E01C9], [0x7E01BC, 0x7E01BC], [0x7E1FDC, 0x7E1FDF]] });
  seedWord(d, 0x1C6, 1); seedWord(d, 0x1C8, 1); d.seed(0x1BC, [0]); seedWord(d, 0x1FDC, 1);
  const before = d.snapshot(), v = prepareRenderView(d), budget = { work: 0, maxWork: 100 };
  const first = renderB0D1(v, context, budget); assert.equal(first.byteWrites, undefined);
  assert.throws(() => render8877(v, { ...context, status: first.status, ioMode: null }, budget), e => e.reason === 'render_io_context_required');
  assert.deepEqual(d.snapshot(), before);
  const v2 = prepareRenderView(d), b2 = { work: 0, maxWork: 100 }; v2.write(0x1FDC, 0); v2.write(0x1FDD, 0);
  const inner = render8877(v2, context, b2); assert.equal(inner.byteWrites, undefined); assert.equal(inner.a, 0);
  assert.throws(() => d.commit(inner), /Invalid render plan/); committed(d, v2.finish(inner));
});
test('Plans immutable andowned/revision-bound; nextmanualcall uses freshgate', () => {
  const d = fixture({ gate: 1 }), p = prepare(d); assert.ok(Object.isFrozen(p)); assert.ok(Object.isFrozen(p.operations[0]));
  assert.throws(() => fixture().commit(p), /Invalid render plan/); committed(d, p);
  assert.deepEqual(d.commit(p), { handled: false, reason: 'render_plan_stale' });
  const next = prepare(d, { ioMode: null }); assert.equal(next.outcome, 'gate_zero'); assert.equal(next.ioWrites.length, 0);
});
test('Missingorunsupported entry stays explicit; malformedcontext throws', () => {
  const d = fixture();
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 8 }, { emulation: 1 }, { directPage: 1 }])
    unchanged(d, options, 'render_entry_required');
  unchanged(d, { bank: 0x40 }, 'render_address_required');
  for (const options of [{ ioMode: 'execute' }, { x: 65536 }, { y: -1 }, { maxWork: 0 }]) assert.throws(() => prepare(d, options));
});

test('All binaryWORD statuses preserve I and retain/replace CV at source-defined paths', () => {
  for (let status = 0; status <= 255; status++) {
    if (status & 0x38) continue;
    for (const [gate, phaseWord, tableByte, mask, expected] of [[0, 0, 0, 0x82, 2], [1, 0, 0, 0x82, 0],
      [0x8000, 0, 0, 0x82, 128], [2, 0x100, 64, 0xC3, 128], [4, 0x100, 64, 0xC3, 1]]) {
      const p = prepare(fixture({ gate, phaseWord, tableByte }), { status }); assert.equal(p.status, (status & ~mask) | expected);
      assert.equal(p.y, context.y); assert.equal(p.bank, context.bank);
    }
  }
});
test('DBR00/80 tablealiases and DBR81 actualBYTE; missingtable never receives implicitROM', () => {
  for (const bank of [0, 0x80, 0x81]) {
    const d = fixture({ bank, tableByte: bank === 0x81 ? 255 : 64 }), p = prepare(d, { bank });
    assert.equal(p.tableByte, bank === 0x81 ? 255 : 64);
    assert.equal(p.operations.find(e => (e.address & 65535) >= 0xD3D1).address, bank * 65536 + 0xD511);
  }
  unchanged(fixture({ missing: [0x80D511] }), {}, 'render_source_required');
});
test('Physical7E/7F writes actual registerBYTES twice and shares WORD/BYTE aliases', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 65536, d = fixture({ gate: 4, tableByte: 0, bank, writeWindows: [[base + 0x1FDC, base + 0x1FDF], [base + 0x2131, base + 0x2132]] });
    d.seed(base + 0x2133, [0xA5]); const p = prepare(d, { bank, ioMode: null });
    assert.deepEqual(p.ioWrites, []);
    assert.deepEqual(p.operations.filter(e => (e.address & 65535) === 0x2132).map(e => e.value), [0x20, 0xC0]);
    committed(d, p); assert.equal(word(d, base + 0x2132), 0xA5C0); assert.equal(d.readByte(base + 0x2131).value, 0x23);
  }
});
test('Every reached missing sourceBYTE rolls back earlier writes andrequests', () => {
  for (const [gate, phaseWord] of [[1, 0], [0xFFFF, 0], [2, 0x140], [4, 0x100]]) {
    const good = prepare(fixture({ gate, phaseWord }));
    for (const address of good.readAddresses) {
      const raw = address >= 0x7E0000 && address < 0x7E2000 ? address - 0x7E0000 + 0x800000 : address;
      unchanged(fixture({ gate, phaseWord, missing: [raw] }), {}, 'render_source_required');
    }
  }
});
test('Each writepermission andI/O context failure isatomic including lateclear', () => {
  for (const [gate, phaseWord] of [[1, 0], [0xFFFF, 0], [2, 0x140], [4, 0x100]]) {
    const good = prepare(fixture({ gate, phaseWord }));
    for (const [address] of good.byteWrites) {
      const writeWindows = good.byteWrites.filter(([a]) => a !== address).map(([a]) => [a, a]);
      unchanged(fixture({ gate, phaseWord, writeWindows }), {}, 'render_write_window_required');
    }
    unchanged(fixture({ gate, phaseWord }), { ioMode: null }, 'render_io_context_required');
  }
});
test('Exactwork threshold includes allreads/writes/requests; lowerbudgets discard all effects', () => {
  for (const [gate, phaseWord] of [[0, 0], [8, 0], [1, 0], [0xFFFF, 0], [2, 0x100], [2, 0x140], [4, 0x100]]) {
    const d = fixture({ gate, phaseWord }), p = prepare(d); assert.equal(p.work, p.operations.length);
    for (let maxWork = 1; maxWork < p.work; maxWork++) unchanged(d, { maxWork }, 'render_work_budget_required');
    assert.ok(prepare(d, { maxWork: p.work }).handled);
  }
});

test('All WORDphase inputs wrap before mask; ADC/CMP flags may differ from returned A', () => {
  const d = fixture({ tableByte: 0 }); d.seed(0x80D3D1, Array(512).fill(0));
  for (let phaseWord = 0; phaseWord <= 65535; phaseWord++) {
    seedWord(d, 0x1FDE, phaseWord); const p = prepare(d), phase = (phaseWord + 64) % 512;
    assert.equal(p.x, phase); assert.equal(p.phaseWord, phase);
    const overflow = phaseWord >= 0x7FC0 && phaseWord <= 0x7FFF ? 64 : 0;
    assert.equal(p.a, phase === 384 ? 2 : phase);
    assert.equal(p.status, 4 | overflow | (phase < 384 ? 128 : 0) | (phase >= 384 ? 1 : 0));
  }
});
test('All256 tablebytes give exact3/4shift decrement, lastLSR Carry and SBC overflow replacement', () => {
  for (const gate of [2, 4]) for (const phaseWord of [0x100, gate === 2 ? 0x7FC0 : 0x7FF0]) {
    const d = fixture({ gate, phaseWord }), index = (phaseWord + (gate === 2 ? 64 : 16)) % 512;
    for (let tableByte = 0; tableByte <= 255; tableByte++) {
      d.seed(0x80D3D1 + index, [tableByte]); const p = prepare(d), divisor = gate === 2 ? 8 : 16;
      const shifted = Math.floor(tableByte / divisor), level = shifted === 0 ? 0 : shifted - 1;
      assert.deepEqual(requests(p), gate === 2 ? [[0x2132, 0xE0 + level, 1], [0x2131, 0x23, 1]]
        : [[0x2132, 0x20 + level, 1], [0x2132, 0xC0, 1], [0x2131, 0x23, 1]]);
      const overflow = phaseWord >= 0x7FC0 && shifted === 0 ? 64 : 0;
      assert.equal(p.overflow, overflow / 64);
      if (gate === 4) assert.equal(p.status, 4 | overflow | (shifted ? 1 : Math.floor(tableByte / 8) % 2));
    }
  }
});
test('Ramp2 clearsbit2 at0180 after freshcompare and leavesbit4 for nextmanualcall', () => {
  const d = fixture({ gate: 6, phaseWord: 0x140 }), p = prepare(d);
  assert.equal(p.outcome, 'ramp2_stopped'); assert.equal(p.a, 2); assert.equal(p.status, 5); assert.equal(p.x, 0x180);
  assert.deepEqual(p.operations.slice(-4).map(e => [e.kind, e.address & 65535, e.value]),
    [['write', 0x2131, 0x23], ['read', 0x1FDE, 0x180], ['read', 0x1FDC, 6], ['write', 0x1FDC, 4]]);
  committed(d, p); d.seed(0x80D561, [table.bytes[0x190]]);
  const second = prepare(d); assert.equal(second.outcome, 'ramp4_prepared'); committed(d, second);
  assert.equal(word(d, 0x1FDC), 4); assert.equal(word(d, 0x1FDE), 0x190);
});
test('Ramp4 never clearsmask atphase0180 and returns freshgate rather thanphase/highA', () => {
  const d = fixture({ gate: 0x4004, phaseWord: 0x170 }), p = prepare(d);
  assert.equal(p.a, 0x4004); assert.equal(p.x, 0x180); assert.equal(p.outcome, 'ramp4_prepared');
  committed(d, p); assert.equal(word(d, 0x1FDC), 0x4004);
});
test('Fresh TRBmemory supplies Z; freshphase supplies CMP; sharedview readings can differ', () => {
  for (const [gate, phaseWord, changedPhase, changedGate, expectedA, expectedZ] of
    [[1, 0, null, 0, 1, 2], [2, 0x100, 0x180, 0, 2, 2], [2, 0x140, 0x181, 2, 0x181, 0], [4, 0x100, null, 0x8000, 0x8000, 0]]) {
    const d = fixture({ gate, phaseWord }), v = prepareRenderView(d), budget = { work: 0, maxWork: 100 };
    // Explicit synthetic provider interleaving; no actual device/interrupt.
    const lateAt = gate === 1 ? 4 : gate === 4 ? 8 : 7;
    const view = { ...v, read(address) {
      if (budget.work >= lateAt && address === 0x801FDE && changedPhase !== null) {
        v.write(0x1FDE, changedPhase & 255); v.write(0x1FDF, changedPhase >>> 8);
      }
      if (budget.work >= lateAt && address === 0x801FDC) {
        v.write(0x1FDC, changedGate & 255); v.write(0x1FDD, changedGate >>> 8);
      }
      return v.read(address);
    } };
    const p = v.finish(render8877(view, context, budget));
    assert.equal(p.a, expectedA); assert.equal(p.status & 2, expectedZ);
    if (gate === 4) assert.equal(p.status & 128, 128);
  }
});

test('Zero and irrelevant masks need no phase/table/write/I/O context; BIT sets Z independently of A', () => {
  for (const gate of [0, 8, 0x7FF8]) {
    const d = createRenderData(); seedWord(d, 0x1FDC, gate); const p = prepare(d, { ioMode: null });
    assert.equal(p.a, gate); assert.equal(p.status, 0x47); assert.equal(p.work, 1);
    assert.deepEqual(p.readAddresses, [0x7E1FDC, 0x7E1FDD]); assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []);
  }
});
test('Every65536 gate chooses negative/zero/one-shot/2/4 priority exactly', () => {
  const d = fixture(); d.seed(0x80D511, [64]); d.seed(0x80D4E1, [64]);
  for (let gate = 0; gate <= 65535; gate++) {
    seedWord(d, 0x1FDC, gate); const p = prepare(d); assert.ok(p.handled);
    const outcome = gate >= 32768 ? 'reset_prepared' : gate === 0 ? 'gate_zero' : gate % 2 ? 'one_shot_prepared'
      : gate & 2 ? 'ramp2_prepared' : gate & 4 ? 'ramp4_prepared' : 'no_active_mask';
    assert.equal(p.outcome, outcome);
    assert.equal(p.x, outcome.startsWith('ramp') ? outcome.startsWith('ramp2') ? 0x140 : 0x110 : context.x);
  }
});
test('Negative path retains masked highA, clears low2 bits before E0/zero without phase/table reads', () => {
  const d = fixture({ gate: 0xFFFF }), p = prepare(d);
  assert.equal(p.a, 0x7FE0); assert.equal(p.status, 0xC5); assert.equal(p.x, context.x);
  assert.deepEqual(requests(p), [[0x2132, 0xE0, 1], [0x2131, 0, 1]]);
  assert.equal(p.operations[1].kind, 'write'); assert.deepEqual(p.readAddresses, [0x7E1FDC, 0x7E1FDD]);
  committed(d, p); assert.equal(word(d, 0x1FDC), 0x7FFC);
});
test('One-shot clears onlybit1 after requests and preserves X/Y/C/V without phase/table reads', () => {
  const d = fixture({ gate: 7 }), p = prepare(d); assert.equal(p.a, 1); assert.equal(p.status, 0x45);
  assert.deepEqual(requests(p), [[0x2132, 0xE5, 1], [0x2131, 0xE3, 1]]);
  assert.equal(p.operations[3].address, 0x801FDC); assert.equal(p.operations[3].kind, 'read');
  committed(d, p); assert.equal(word(d, 0x1FDC), 6); assert.equal(word(d, 0x1FDE), 0x100);
});
