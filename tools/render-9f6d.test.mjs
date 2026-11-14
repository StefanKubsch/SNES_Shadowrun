import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRender9F6D, render9F6D } from '../proof/render/unpack-9f6d.mjs';
import { unpack9F6DEntry, unpack9F6DFixture, stream9F6D, lengthBits9F6D, fixedBits9F6D } from './render-9f6d-fixtures.mjs';

const prepare = (data, options = {}) => prepareRender9F6D({ ...unpack9F6DEntry, data, ...options });
const bytes = (data, address, count) => Array.from({ length: count }, (_, n) => {
  const r = data.readByte(address + n); assert.ok(r.available); return r.value;
});
function commit(data, p) { assert.ok(p.handled); assert.deepEqual(data.commit(p), { handled: true }); }
function fail(data, options, reason) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  assert.equal(p.caller, reason.startsWith('render_entry') || reason === 'render_stack_required' ? undefined : '9F6D');
  for (const key of ['byteWrites', 'operations', 'readAddresses', 'ioWrites']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}

test('9F6D literal WORDs and BYTEtails preserve data, exact cursors, high-Y bankword and no table dependency', () => {
  for (const size of [1, 2, 3, 4, 7, 16, 31, 255, 256, 257]) {
    const payload = Array.from({ length: size }, (_, n) => n * 37 & 255);
    const data = unpack9F6DFixture({ header: size, payload, bits: lengthBits9F6D(size), table: false });
    data.seed(0x7F524F, [0x55]); data.seed(0x7F5250 + size, [0x66]);
    const before = data.snapshot(), p = prepare(data); assert.deepEqual(data.snapshot(), before); commit(data, p);
    assert.deepEqual(bytes(data, 0x7F5250, size), payload); assert.equal(p.x, 0x5250 + size); assert.equal(p.y, 4 + size);
    assert.equal(p.a, size); assert.equal(p.emittedCount, size); assert.equal(p.emittedBytes, size); assert.equal(p.outputBytes, size);
    assert.equal(p.bits, lengthBits9F6D(size).length); assert.equal(p.literals, 1); assert.equal(p.references, 0);
    assert.deepEqual(bytes(data, 0xE3, 2), [0x80, 0x3A]); assert.deepEqual(p.ioRequests, []);
    assert.equal(data.readByte(0x7F524F).value, 0x55); assert.equal(data.readByte(0x7F5250 + size).value, 0x66);
  }
});

test('9F6D all65536 destination indices retain full WORD and wrap BYTE increment without a capacity/alignment gate', () => {
  const data = unpack9F6DFixture({ table: false });
  for (let x = 0; x <= 65535; x++) {
    const p = prepare(data, { x }); assert.ok(p.handled); assert.equal(p.x, x + 1 & 65535);
    assert.equal(p.byteWrites.find(([a]) => a === 0x7F0000 + x)?.[1], 0xA7);
    assert.equal(p.outputBytes, 1); assert.equal(p.y, 5);
  }
});

test('9F6D all256 entryDBRs and admissible WORD statuses restore complete P and DBR unchanged', () => {
  const data = unpack9F6DFixture();
  for (let bank = 0; bank < 256; bank++) for (let status = 0; status < 256; status++) if (!(status & 0x38)) {
    const p = prepare(data, { bank, status }); assert.ok(p.handled);
    assert.equal(p.bank, bank); assert.equal(p.status, status); assert.equal(p.carry, status & 1); assert.equal(p.overflow, status >>> 6 & 1);
    assert.equal(p.a, 1); assert.equal(p.x, 0x5251); assert.equal(p.y, 5);
  }
});

test('9F6D all256 high-Y bytes are stored while only low-Y selects fresh source bank', () => {
  const data = unpack9F6DFixture({ table: false });
  for (let high = 0; high < 256; high++) {
    const p = prepare(data, { y: high << 8 | 0x80 }); assert.ok(p.handled);
    assert.equal(p.byteWrites.find(([a]) => a === 0x7E00E4)?.[1], high);
    assert.equal(p.sourceBankWord, high << 8 | 0x80); assert.equal(p.emittedCount, 1);
  }
  assert.ok(prepare(data, { y: 0 }).handled); // same canonical ROM bytes in bank00 upper half
});

test('9F6D LSR carry survives literal data values and WORD loop flags before odd BYTEtail', () => {
  for (const payload of [[0, 0, 0xA7], [0xFF, 0xFF, 0], [0, 0x80, 0xFF]]) {
    const data = unpack9F6DFixture({ header: 3, payload, bits: lengthBits9F6D(3) }), p = prepare(data); commit(data, p);
    assert.deepEqual(bytes(data, 0x7F5250, 3), payload); assert.equal(p.x, 0x5253); assert.equal(p.y, 7);
    const writes = p.operations.filter(e => e.kind === 'write' && e.phase === 'literal');
    assert.deepEqual(writes.filter(e => e.address >= 0x7F0000).map(e => e.bytes), [2, 1]);
    assert.equal(writes.find(e => e.address === 0xED).value, 0);
  }
});

test('9F6D literal WORD atFFFF carries highbyte to80:0000 physical7E:0000 before WORD X wrap', () => {
  const fixture = { header: 2, payload: [0x12, 0x34], bits: lengthBits9F6D(2),
    writeWindows: [[0x7FFFFF, 0x7FFFFF], [0x7E0000, 0x7E0000]] };
  const data = unpack9F6DFixture(fixture), p = prepare(data, { x: 65535 }); commit(data, p);
  assert.equal(data.readByte(0x7FFFFF).value, 0x12); assert.equal(data.readByte(0x7E0000).value, 0x34);
  assert.equal(data.readByte(0x7F0000).available, false); assert.equal(p.x, 1); assert.equal(p.y, 6);
  assert.equal(p.operations.find(e => e.kind === 'write' && e.address === 0x7FFFFF).bytes, 2);
  const restricted = unpack9F6DFixture({ ...fixture, writeWindows: [[0x7FFFFF, 0x7FFFFF]] });
  const failure = fail(restricted, { x: 65535 }, 'render_write_window_required'); assert.equal(failure.address, 0x7E0000);
  fail(unpack9F6DFixture(fixture), { x: 65535, stackWindow: [0, 9] }, 'render_stack_alias_required');
});

test('9F6D forward MVN sees each earlier write, overshoots target and returns actual source/destination X/Y', () => {
  const data = unpack9F6DFixture({ header: 5, bits: [1, 0, ...lengthBits9F6D(3)] }), p = prepare(data); commit(data, p);
  assert.deepEqual(bytes(data, 0x7F5250, 6), Array(6).fill(0xA7)); assert.equal(p.emittedCount, 6); assert.equal(p.outputBytes, 6);
  assert.equal(p.x, 0x5255); assert.equal(p.y, 0x5256); assert.equal(p.references, 1);
  assert.deepEqual(bytes(data, 0xEB, 2), [4, 0]);
  const copy = p.operations.filter(e => e.phase === 'repeat');
  assert.deepEqual(copy.slice(0, 4).map(e => [e.kind, e.address, e.value]),
    [['read', 0x7F5250, 0xA7], ['write', 0x7F5251, 0xA7], ['read', 0x7F5251, 0xA7], ['write', 0x7F5252, 0xA7]]);
});

test('9F6D future reference source is accepted with explicit bytes and no produced-prefix assumption', () => {
  const data = unpack9F6DFixture({ header: 4, bits: [1, 1, 1] }); data.seed(0x7F5251, [9, 8, 7]);
  const p = prepare(data); commit(data, p); assert.deepEqual(bytes(data, 0x7F5250, 4), [0xA7, 9, 8, 7]);
  assert.equal(p.x, 0x5254); assert.equal(p.y, 0x5254);
});

test('9F6D selector0 returns to literal while selector1 starts another fresh copyphase', () => {
  for (const selector of [0, 1]) {
    const bits = [1, 0, 1, selector, ...(selector ? [0, 0, 0, 1] : [1])];
    const data = unpack9F6DFixture({ header: selector ? 7 : 5, payload: selector ? [0xA7] : [0xA7, 0xB8], bits });
    const p = prepare(data); commit(data, p);
    assert.deepEqual(bytes(data, 0x7F5250, selector ? 7 : 5), selector ? Array(7).fill(0xA7) : [0xA7, 0xA7, 0xA7, 0xA7, 0xB8]);
    assert.equal(p.literals, selector ? 1 : 2); assert.equal(p.references, selector ? 2 : 1);
    assert.equal(p.x, selector ? 0x5253 : 0x5255); assert.equal(p.y, selector ? 0x5257 : 6);
  }
});

test('9F6D BYTE width selection follows fresh low/high outputcount and refills swapped bitwords', () => {
  for (const size of [1, 2, 15, 16, 255, 256, 511, 512, 1024]) {
    const width = size.toString(2).length, payload = Array.from({ length: size }, (_, n) => n & 255);
    const bits = [...lengthBits9F6D(size), ...fixedBits9F6D(size - 1, width), 1];
    const data = unpack9F6DFixture({ header: size + 3, payload, bits }), p = prepare(data); commit(data, p);
    assert.deepEqual(bytes(data, 0x7F5250, size + 3), [...payload, payload.at(-1), payload.at(-1), payload.at(-1)]);
    assert.equal(p.bits, lengthBits9F6D(size).length + width + 1);
    assert.equal(p.operations.find(e => e.phase === 'offsetWidth' && e.address >= 0x80A033).bytes, 1);
  }
});

test('9F6D header0 still copies a literal and wrapped literalcode0 copies1 byte but counts0', () => {
  for (const bits of [[1], [...Array(16).fill([0, 0]).flat(), 1]]) {
    const data = unpack9F6DFixture({ header: 0, bits }), p = prepare(data); commit(data, p);
    assert.equal(p.a, 0); assert.equal(p.outputBytes, 1); assert.equal(p.emittedCount, bits.length === 1 ? 1 : 0);
    assert.equal(p.x, 0x5251); assert.equal(p.y, 5); assert.deepEqual(bytes(data, 0x7F5250, 1), [0xA7]);
  }
});

test('9F6D all256 observed tablebytes control actual width, including0 underflow and highcount BYTE ADC wrap', () => {
  for (let width = 0; width < 256; width++) {
    const bits = [1, ...Array(width || 65536).fill(0), 1];
    const data = unpack9F6DFixture({ header: 4, bits }); data.seed(0x80A034, [width]);
    const p = prepare(data); assert.ok(p.handled); assert.equal(p.bits, (width || 65536) + 2);
    assert.equal(p.outputBytes, 4); assert.equal(p.emittedCount, 4);
  }
  const payload = Array.from({ length: 256 }, (_, n) => n);
  const data = unpack9F6DFixture({ header: 259, payload, bits: [...lengthBits9F6D(256), ...Array(7).fill(0), 1] });
  data.seed(0x80A034, [255]); const p = prepare(data); commit(data, p);
  assert.equal(p.bits, lengthBits9F6D(256).length + 8); assert.deepEqual(bytes(data, 0x7F5350, 3), [0, 1, 2]);
});

test('9F6D offsetwidth0 executes complete65536-bit do-loop, with explicit byte budget and no invented width cap', () => {
  const bits = [...Array(16).fill([0, 0]).flat(), 1, ...Array(65536).fill(0), 1];
  const data = unpack9F6DFixture({ header: 1, bits }), p = prepare(data, { maxWork: 1000000, maxOutputBytes: 4 }); commit(data, p);
  assert.equal(p.bits, 65570); assert.equal(p.outputBytes, 4); assert.equal(p.emittedCount, 3);
  assert.equal(p.x, 0x5253); assert.equal(p.y, 0x5254); assert.deepEqual(bytes(data, 0x7F5250, 4), Array(4).fill(0xA7));
  assert.equal(fail(unpack9F6DFixture({ header: 1, bits }), { maxWork: 1000 }, 'render_work_budget_required').phase, 'offsetBits');
});

test('9F6D decodedFFFF wraps INC to0 and MVN copies1 byte; decodedFFFE copies65536 with zero modulo count gain', () => {
  for (const code of [0xFFFF, 0xFFFE]) {
    const bits = [1, 0, ...lengthBits9F6D(code), ...(code === 0xFFFE ? [0, 1] : [])];
    const data = unpack9F6DFixture({ header: 2, payload: code === 0xFFFE ? [0xA7, 0xB8] : [0xA7], bits });
    const p = prepare(data, { maxOutputBytes: 65538 }); commit(data, p);
    assert.equal(p.outputBytes, code === 0xFFFE ? 65538 : 2); assert.equal(p.emittedCount, 2);
    assert.equal(p.literals, code === 0xFFFE ? 2 : 1); assert.equal(p.references, 1);
    if (code === 0xFFFE) {
      assert.deepEqual(bytes(data, 0x7F5250, 3), [0xA7, 0xB8, 0xA7]); assert.equal(data.readByte(0x7F0000).value, 0xA7);
      assert.equal(data.readByte(0x7FFFFF).value, 0xA7); assert.equal(p.x, 0x5252); assert.equal(p.y, 6);
    } else { assert.equal(p.x, 0x5251); assert.equal(p.y, 0x5252); }
  }
});

test('9F6D MVN at bankend wraps7F indices while source DD plus offset wraps as WORD', () => {
  for (const x of [0xFFFE, 0xFFFF]) {
    const data = unpack9F6DFixture({ header: 4, bits: [1, 0, 1] }), p = prepare(data, { x }); commit(data, p);
    const addresses = [x, x + 1 & 65535, x + 2 & 65535, x + 3 & 65535].map(n => 0x7F0000 + n);
    assert.deepEqual(addresses.map(a => data.readByte(a).value), Array(4).fill(0xA7));
    assert.equal(data.readByte(0x7E0000).available, false); assert.equal(p.x, x + 3 & 65535); assert.equal(p.y, x + 4 & 65535);
  }
});

test('9F6D long indirect WORD sources carry from7E into7F, independent of actual entryDBR', () => {
  const data = unpack9F6DFixture({ sourceAddress: 0x7EFFFD }), p = prepare(data, { a: 0xFFFD, y: 0x7E, bank: 0x7F }); commit(data, p);
  assert.equal(p.a, 1); assert.equal(p.outputBytes, 1); assert.equal(p.bank, 0x7F);
  assert.ok(p.readAddresses.includes(0x7EFFFF)); assert.ok(p.readAddresses.includes(0x7F0000));
  assert.equal(data.readByte(0x7F5250).value, 0xA7);
});

test('9F6D overlapping7F literal source sees earlier WORDwrites and returnA keeps original header', () => {
  for (const destination of [0x3000, 0x3006]) {
    const data = unpack9F6DFixture({ sourceAddress: 0x7F3000, header: 4, payload: [1, 2, 3, 4], bits: lengthBits9F6D(4) });
    const p = prepare(data, { a: 0x3000, y: 0x7F, x: destination }); commit(data, p);
    assert.equal(p.a, 4); assert.deepEqual(bytes(data, 0x7F0000 + destination, 4), destination === 0x3006 ? [1, 2, 1, 2] : [1, 2, 3, 4]);
    assert.equal(p.y, 8); assert.equal(p.x, destination + 4);
  }
});

test('9F6D DP source alias sees fresh EB lengthstore instead of original source/header bytes', () => {
  const data = createRenderData({ writeWindows: [[0x7F5250, 0x7F5250]] });
  data.seed(0xE7, [1, 0, 0, 1]); data.seed(0x1E9, [0x80, 0]);
  const p = prepare(data, { a: 0xE7, y: 0 }); commit(data, p);
  assert.equal(p.a, 1); assert.equal(data.readByte(0x7F5250).value, 1); // EB now holds the decoded literal length1
  assert.equal(data.readByte(0xE7).value, 5); assert.equal(p.outputBytes, 1);
  const literalRead = p.operations.find(e => e.phase === 'literal' && e.address === 0xEB && e.bytes === 1);
  assert.equal(literalRead.value, 1);
});

test('9F6D exact transcript puts ordered scratch/header stores before actual bit/literal reads and tail comparison', () => {
  const p = prepare(unpack9F6DFixture({ table: false })); assert.ok(p.handled);
  assert.deepEqual(p.operations.slice(0, 10).map(e => [e.kind, e.address, e.value, e.bytes]), [
    ['write', 0xE1, 0x9000, 2], ['write', 0xE3, 0x3A80, 2], ['write', 0xDD, 0x5250, 2], ['write', 0xDF, 0x5250, 2], ['write', 0xEB, 0, 2],
    ['read', 0xE1, 0x9000, 2], ['read', 0xE3, 0x80, 1], ['read', 0x809000, 1, 2], ['write', 0xDB, 1, 2], ['read', 0xE1, 0x9000, 2],
  ]);
  assert.deepEqual(p.operations.slice(-6).map(e => [e.kind, e.address]),
    [['write', 0xDF], ['write', 0xE7], ['read', 0xEB], ['read', 0xE9], ['write', 0xE9], ['read', 0xDB]]);
  assert.ok(p.operations.every(Object.isFrozen)); assert.ok(Object.isFrozen(p.operations));
  assert.equal(p.work, p.operations.length);
});

test('9F6D every required initial source byte including bitrefill/table/repeat fails without all earlier effects', () => {
  for (const fixture of [{ header: 3, payload: [1, 2, 3], bits: lengthBits9F6D(3) }, { header: 4, bits: [1, 1, 1] }]) {
    const full = unpack9F6DFixture(fixture); if (fixture.header === 4) full.seed(0x7F5251, [9, 8, 7]);
    const p = prepare(full); assert.ok(p.handled); const snapshot = full.snapshot();
    const seeded = new Set(snapshot.bytes.map(([a]) => a));
    for (const missing of p.readAddresses.filter(a => seeded.has(a))) {
      const data = createRenderData({ writeWindows: snapshot.writeWindows });
      for (const [a, v] of snapshot.bytes) if (a !== missing) data.seed(a, [v]);
      assert.equal(fail(data, {}, 'render_source_required').address, missing);
    }
  }
  const missingTable = unpack9F6DFixture({ header: 4, bits: [1, 0, 1], table: false });
  assert.equal(fail(missingTable, {}, 'render_source_required').address, 0x80A034);
});

test('9F6D every outputbyte and work/outputbudget prefix suppresses the complete plan, including late repeat byte', () => {
  const fixture = { header: 5, bits: [1, 0, ...lengthBits9F6D(3)] }, p = prepare(unpack9F6DFixture(fixture)); assert.ok(p.handled);
  for (const [missing] of p.byteWrites.filter(([a]) => a >= 0x7F0000)) {
    const writeWindows = p.byteWrites.filter(([a]) => a >= 0x7F0000 && a !== missing).map(([a]) => [a, a]);
    assert.equal(fail(unpack9F6DFixture({ ...fixture, writeWindows }), {}, 'render_write_window_required').address, missing);
  }
  for (let maxWork = 1; maxWork < p.work; maxWork++) fail(unpack9F6DFixture(fixture), { maxWork }, 'render_work_budget_required');
  for (let maxOutputBytes = 1; maxOutputBytes < p.outputBytes; maxOutputBytes++)
    fail(unpack9F6DFixture(fixture), { maxOutputBytes }, 'render_output_budget_required');
  assert.ok(prepare(unpack9F6DFixture(fixture), { maxWork: p.work, maxOutputBytes: p.outputBytes }).handled);
});

test('9F6D missing bitrefill after first emitted literal and final sourcebyte after65536-byte copy are atomic', () => {
  const cases = [
    [{ header: 1, bits: [...Array(16).fill([0, 0]).flat(), 1, ...Array(64).fill(0)] }, 0x80900B, 'offsetBits'],
    [{ header: 2, payload: [0xA7, 0xB8], bits: [1, 0, ...lengthBits9F6D(0xFFFE), 0, 1] }, 0x809005, 'literal'],
  ];
  for (const [fixture, missing, phase] of cases) {
    const snapshot = unpack9F6DFixture(fixture).snapshot(), data = createRenderData({ writeWindows: snapshot.writeWindows });
    for (const [a, v] of snapshot.bytes) if (a !== missing) data.seed(a, [v]);
    const p = fail(data, { maxOutputBytes: 65538 }, 'render_source_required'); assert.equal(p.address, missing); assert.equal(p.phase, phase);
  }
});

test('9F6D one-byte/one-work-short budgets after full65536-byte MVN suppress every earlier output and scratchwrite', () => {
  const fixture = { header: 2, payload: [0xA7, 0xB8], bits: [1, 0, ...lengthBits9F6D(0xFFFE), 0, 1] };
  const p = prepare(unpack9F6DFixture(fixture), { maxOutputBytes: 65538 }); assert.ok(p.handled);
  assert.equal(fail(unpack9F6DFixture(fixture), { maxOutputBytes: 65537 }, 'render_output_budget_required').phase, 'literal');
  assert.equal(fail(unpack9F6DFixture(fixture), { maxOutputBytes: 65538, maxWork: p.work - 1 }, 'render_work_budget_required').phase, 'literalTail');
  assert.ok(prepare(unpack9F6DFixture(fixture), { maxOutputBytes: 65538, maxWork: p.work }).handled);
});

test('9F6D ten protectedstackbytes suffice; earlyscratch/late WRAMsources and bankcarry output aliases reject', () => {
  assert.ok(prepare(unpack9F6DFixture(), { stackWindow: [0x1FF6, 0x1FFF] }).handled);
  fail(unpack9F6DFixture(), { stackWindow: [0x1FF7, 0x1FFF] }, 'render_stack_required');
  fail(unpack9F6DFixture(), { stackWindow: [0xDB, 0xE4] }, 'render_stack_alias_required');
  for (const stackWindow of [[0x3000, 0x3009], [0x3004, 0x300D], [0x3005, 0x300E]]) {
    fail(unpack9F6DFixture({ sourceAddress: 0x7E3000 }), { a: 0x3000, y: 0x7E, stackWindow }, 'render_stack_alias_required');
  }
});

test('9F6D two inner calls share fresh earlier output and cumulative budgets with one outer commit', () => {
  const nested = stream9F6D(1, [0xB8], [1]);
  const data = unpack9F6DFixture({ header: nested.length, payload: nested, bits: lengthBits9F6D(nested.length) });
  const before = data.snapshot(), view = prepareRenderView(data), budget = { work: 7, maxWork: 10000, outputBytes: 5, maxOutputBytes: 13 };
  const first = render9F6D(view, unpack9F6DEntry, budget);
  const second = render9F6D(view, { ...unpack9F6DEntry, a: 0x5250, y: 0x7F, x: 0x6000 }, budget);
  assert.equal(first.emittedBytes, 7); assert.equal(second.emittedBytes, 1); assert.equal(second.outputBytes, 13);
  assert.equal(second.work, 7 + first.operations.length + second.operations.length);
  assert.deepEqual(data.snapshot(), before); assert.throws(() => data.commit(first)); assert.throws(() => data.commit(second));
  commit(data, view.finish(second)); assert.equal(data.readByte(0x7F6000).value, 0xB8);
  for (const options of [{ maxOutputBytes: 12 }, { maxWork: second.work - 1 }]) {
    const fresh = unpack9F6DFixture({ header: nested.length, payload: nested, bits: lengthBits9F6D(nested.length) }), snapshot = fresh.snapshot();
    const shared = prepareRenderView(fresh), limits = { work: 7, maxWork: 10000, outputBytes: 5, maxOutputBytes: 13, ...options };
    render9F6D(shared, unpack9F6DEntry, limits);
    assert.throws(() => render9F6D(shared, { ...unpack9F6DEntry, a: 0x5250, y: 0x7F, x: 0x6000 }, limits), e => Boolean(e.renderBoundary));
    assert.deepEqual(fresh.snapshot(), snapshot);
  }
});

test('9F6D foreign/stale/copied plans reject; public immutable payload and earlier inner writes remain isolated', () => {
  const data = unpack9F6DFixture(), p = prepare(data); assert.throws(() => unpack9F6DFixture().commit(p));
  assert.throws(() => data.commit({ ...p })); assert.throws(() => { p.byteWrites[0][1] = 7; });
  data.seed(0x809004, [9]); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  const fresh = unpack9F6DFixture({ header: 4, bits: [1, 1, 1] }), before = fresh.snapshot(), view = prepareRenderView(fresh);
  view.write(0x7F6000, 0x55);
  assert.throws(() => render9F6D(view, unpack9F6DEntry, { work: 0, maxWork: 10000, outputBytes: 0, maxOutputBytes: 100 }), e => e.reason === 'render_source_required' && e.phase === 'repeat');
  assert.deepEqual(fresh.snapshot(), before);
});

test('9F6D unknown/unsupported/invalid entry context never guesses source, indices, stack or widths', () => {
  for (const options of [{ a: null }, { x: null }, { y: null }, { bank: null }, { status: null }, { status: 8 },
    { status: 16 }, { status: 32 }, { emulation: 1 }, { directPage: 1 }]) fail(unpack9F6DFixture(), options, 'render_entry_required');
  fail(unpack9F6DFixture(), { stackWindow: null }, 'render_stack_required');
  for (const options of [{ a: -1 }, { x: 65536 }, { y: 0.5 }, { bank: 256 }, { status: 256 },
    { maxWork: 0 }, { maxOutputBytes: 0 }, { maxWork: NaN }, { data: {} }]) assert.throws(() => prepare(unpack9F6DFixture(), options));
  const unsupported = fail(unpack9F6DFixture(), { y: 0xFF }, 'render_address_required'); assert.equal(unsupported.phase, 'header');
});

test('9F6D native report pins source/stack and explicit synthetic probes without dialog lifecycle claims', async () => {
  const source = JSON.parse(await readFile(new URL('../analysis/render-9f6d.json', import.meta.url)));
  const report = JSON.parse(await readFile(new URL('../analysis/render-9f6d-native.json', import.meta.url)));
  assert.deepEqual(report.sources, source.windows); assert.deepEqual(report.stackProof, source.full_graph.proof);
  assert.match(report.scope, /synthetic/); assert.match(report.scope, /one outer commit/); assert.match(report.scope, /No CPU/);
  assert.equal(report.probes.length, 9); assert.ok(report.probes.some(p => !p.handled));
});
