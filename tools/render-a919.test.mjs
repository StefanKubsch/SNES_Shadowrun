import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView, renderAddress } from '../src/render/data.mjs';
import { prepareRenderA919, renderA919 } from '../proof/render/palette-list-a919.mjs';
import { cpuToOffset } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-a919-native.json', import.meta.url), 'utf8'));
const entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const seedWord = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const word = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function fixture({ gate = 1, count = 2, records = [[0, 0x1000]], bank = 0x80, writeWindows = [], omit = null } = {}) {
  const data = createRenderData({ writeWindows }), values = new Map(), base = bank * 65536;
  const set = (address, value) => {
    values.set(renderAddress(address), value & 255); values.set(renderAddress(address + 1), value >>> 8);
  };
  for (const [y, value] of records) set(base + 0x17D6 + y, value);
  if (gate !== null) set(base + 0x1562, gate);
  if (count !== null) set(base + 0x17D4, count);
  for (const [address, value] of values) if (address !== omit) data.seed(address, [value]);
  return data;
}
const prepare = (data, options = {}) => prepareRenderA919({ ...entry, data, ...options });
const commit = (data, p) => { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.commit(p), { handled: true }); };
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  for (const key of ['operations', 'ioWrites', 'byteWrites']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}
// Independent unsigned decomposition and signed range oracles, no CPU execution.
const pointer = value => (value * 16 % 65536 + 0xF1BA + Math.floor(value / 4096) % 2) % 65536;
const index = y => (y * 8 % 256 + 129 + Math.floor(y / 32) % 2) % 256;
const carry = y => Number(y * 8 % 256 + 129 + Math.floor(y / 32) % 2 >= 256);
const overflow = y => {
  const shifted = y * 8 % 256, sum = (shifted < 128 ? shifted : shifted - 256) - 127 + Math.floor(y / 32) % 2;
  return Number(sum < -128 || sum > 127);
};

test('NativeA919 probe pins original59/31 independently from synthetic gate/list/count/stack fixtures', () => {
  const raw = rom.subarray(cpuToOffset(0x81A919, rom.length), cpuToOffset(0x81A954, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), '866063e7ac09857126708488a5643656ebae5d957fe9909c2fe4eeaf594e2de4');
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase()); assert.equal(report.source.instruction_count, 31);
  assert.match(report.scope, /synthetic/); assert.match(report.scope, /no device execution/);
});

test('Zero1562 requires only its WORD and preserves entry C/V/I/X/Y without count/list/I/O', () => {
  for (let status = 0; status < 256; status++) {
    if (status & 0x38) continue;
    const data = fixture({ gate: 0, count: null, records: [] }), p = prepare(data, { status, ioMode: null }); commit(data, p);
    assert.equal(p.outcome, 'gate_1562_zero'); assert.equal(p.a, 0); assert.equal(p.status, (status & 0x7D) | 2);
    assert.equal(p.x, entry.x); assert.equal(p.y, entry.y); assert.equal(p.count, null); assert.equal(p.work, 1);
    assert.equal(p.initialY, null); assert.equal(p.iterations, 0); assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []);
    assert.deepEqual(p.readAddresses, [0x7E1562, 0x7E1563]);
  }
});

test('Zero17D4 keeps the actual nonzero gateWORD in A but takes N/Z/Y from LDY0, without clearing either gate', () => {
  for (const gate of [1, 0x7FFF, 0x8000, 0xFFFF]) {
    const data = fixture({ gate, count: 0, records: [] }), p = prepare(data, { ioMode: null }); commit(data, p);
    assert.equal(p.outcome, 'gate_17D4_zero'); assert.equal(p.a, gate); assert.equal(p.status, 0x47); assert.equal(p.y, 0);
    assert.equal(p.x, entry.x); assert.equal(p.work, 2); assert.equal(p.count, 0); assert.equal(p.initialY, null);
    assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []); assert.equal(word(data, 0x1562), gate); assert.equal(word(data, 0x17D4), 0);
  }
});

test('Three fresh A919 visits descend with five ordered requests each and no tail or countclear', () => {
  const records = [[4, 0xFFF], [2, 0x1000], [0, 1]], data = fixture({ count: 6, records });
  const before = data.snapshot(), p = prepare(data); assert.ok(p.handled); assert.deepEqual(data.snapshot(), before);
  assert.deepEqual(p.ioWrites.map(e => [e.address & 65535, e.value, e.bytes]), records.flatMap(([y, value]) =>
    [[0x4342, pointer(value), 2], [0x4345, 30, 2], [0x2121, index(y), 1], [0x4344, 0x8D, 1], [0x420B, 16, 1]]));
  assert.deepEqual(p.operations.filter(e => e.kind === 'read').map(e => [e.address & 65535, e.value]),
    [[0x1562, 1], [0x17D4, 6], [0x17DA, 0xFFF], [0x17D8, 0x1000], [0x17D6, 1]]);
  assert.equal(p.a, 0x10); assert.equal(p.y, 0xFFFE); assert.equal(p.x, entry.x); assert.equal(p.status, 0x84);
  assert.equal(p.initialY, 4); assert.equal(p.iterations, 3); assert.equal(p.work, 20); assert.equal(p.operations.length, 20);
  assert.deepEqual(p.byteWrites, []); commit(data, p); assert.equal(word(data, 0x17D4), 6); assert.equal(word(data, 0x1562), 1);
});

test('All65536 recordWORDs use inputbit12 pointerCarry and return flags from BYTEADC rather than WORDADC', () => {
  const data = fixture();
  for (let value = 0; value < 65536; value++) {
    seedWord(data, 0x17D6, value); const p = prepare(data, { status: value & 1 ? 0xC4 : 0xC5 });
    assert.ok(p.handled); assert.equal(p.ioWrites[0].value, pointer(value)); assert.equal(p.ioWrites[2].value, 0x81);
    assert.equal(p.carry, 0); assert.equal(p.overflow, 0); assert.equal(p.status, 0x84); assert.equal(p.a, 16);
  }
});

test('All256 lastvisit lowY values match independent BYTEindex/Carry/overflow with A0010/N1/Z0', () => {
  for (let low = 0; low < 256; low++) {
    const y = 0x8100 + low, data = fixture({ count: y + 2, records: [[y, 0x800]] }), p = prepare(data);
    assert.ok(p.handled); assert.equal(p.iterations, 1); assert.equal(p.initialY, y); assert.equal(p.y, y - 2);
    assert.equal(p.ioWrites[2].value, index(y)); assert.equal(p.carry, carry(y)); assert.equal(p.overflow, overflow(y));
    assert.equal(p.status, 0x84 | carry(y) | overflow(y) * 64); assert.equal(p.a, 16); assert.equal(p.x, entry.x);
  }
});

test('Oddcounts use actual odd WORDaddresses and end on FFFF without alignment or byte-count scaling', () => {
  const data = fixture({ count: 5, records: [[3, 0xFFF], [1, 0x1000]] }), p = prepare(data); commit(data, p);
  assert.equal(p.initialY, 3); assert.equal(p.iterations, 2); assert.equal(p.y, 0xFFFF);
  assert.deepEqual(p.operations.filter(e => e.phase === 'records' && e.kind === 'read').map(e => [e.address, e.value]),
    [[0x8017D9, 0xFFF], [0x8017D7, 0x1000]]);
  assert.equal(p.status, 0x84); assert.equal(p.ioWrites.at(-3).value, 0x89);
});

test('Count1 performs its unconditional YFFFF visit through the next-bank WRAM mirror and returns FFFD/C1/V1', () => {
  const data = fixture({ count: 1, records: [[0xFFFF, 0x1000]] }), p = prepare(data); commit(data, p);
  assert.equal(p.count, 1); assert.equal(p.initialY, 0xFFFF); assert.equal(p.y, 0xFFFD); assert.equal(p.iterations, 1);
  assert.equal(p.operations[2].address, 0x8117D5); assert.equal(p.operations[2].value, 0x1000);
  assert.equal(p.ioWrites[0].value, 0xF1BB); assert.equal(p.ioWrites[2].value, 0x7A); assert.equal(p.status, 0xC5);
});

test('Highcount8004 and FFFF keep one visit without an initial signgate and preserve actual signed tails', () => {
  for (const [count, y, value] of [[0x8004, 0x8002, 0], [0xFFFF, 0xFFFD, 0xFF00]]) {
    const data = fixture({ count, records: [[y, value]] }), p = prepare(data); commit(data, p);
    assert.equal(p.iterations, 1); assert.equal(p.initialY, y); assert.equal(p.y, y - 2);
    assert.equal(p.ioWrites[0].value, pointer(value)); assert.equal(p.status, 0x84 | carry(y) | overflow(y) * 64);
    assert.equal(word(data, 0x17D4), count);
  }
});

test('Counts8002/8003 complete16385 physical visits after their negative first indices wrap nonnegative', () => {
  for (const count of [0x8002, 0x8003]) {
    const data = createRenderData({ writeWindows: [[0x7E0000, 0x7EFFFF]] });
    data.seed(0x7E17D6, new Uint8Array(0x8003)); seedWord(data, 0x7E1562, 1); seedWord(data, 0x7E17D4, count);
    const before = data.snapshot(), p = prepare(data, { bank: 0x7E, ioMode: null, stackWindow: [0x100, 0x102] });
    assert.ok(p.handled); assert.deepEqual(data.snapshot(), before);
    assert.equal(p.initialY, count - 2); assert.equal(p.iterations, 16385); assert.equal(p.work, 98312);
    assert.equal(p.y, count & 1 ? 0xFFFF : 0xFFFE); assert.equal(p.status, 0x84); assert.equal(p.a, 16);
    const reads = p.operations.filter(e => e.phase === 'records' && e.kind === 'read');
    assert.equal(reads.length, 16385); assert.equal(reads[0].address, 0x7E17D6 + count - 2);
    assert.equal(reads[1].address, reads[0].address - 2); assert.equal(reads.at(-1).address, 0x7E17D6 + (count & 1));
    assert.deepEqual(p.ioWrites, []); commit(data, p); assert.equal(word(data, 0x7E17D4), count);
    assert.equal(word(data, 0x7E4342), 0xF1BA); assert.equal(data.readByte(0x7E2121).value, count & 1 ? 0x89 : 0x81);
  }
});

test('Physical aliaswrites replace later listWORDs in order, including fresh 1E8D and pointerwords', () => {
  const data = createRenderData({ writeWindows: [[0x7E0000, 0x7EFFFF]] });
  data.seed(0x7E17D6, new Uint8Array(0x4348 - 0x17D6));
  seedWord(data, 0x7E4346, 0xABCC); seedWord(data, 0x7E1562, 1); seedWord(data, 0x7E17D4, 0x2B72);
  const p = prepare(data, { bank: 0x7E, ioMode: null, stackWindow: [0x100, 0x102] }); assert.ok(p.handled);
  const reads = p.operations.filter(e => e.phase === 'records' && e.kind === 'read');
  assert.deepEqual(reads.slice(0, 3).map(e => [e.address, e.value]),
    [[0x7E4346, 0xABCC], [0x7E4344, 0x1E8D], [0x7E4342, pointer(0x1E8D)]]);
  commit(data, p); assert.equal(word(data, 0x7E17D4), 0x2B72);
});

test('Odd WORDatFFFF reads both actualbanks including7F-to80 mirrored highbyte, without bankwrapping', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 65536, data = fixture({ bank, count: 0xE82B, records: [[0xE829, 0x1000]], writeWindows: [[base, base + 65535]] });
    const p = prepare(data, { bank, ioMode: null }); commit(data, p);
    assert.equal(p.operations[2].address, base + 0xFFFF); assert.equal(p.operations[2].value, 0x1000);
    assert.ok(p.readAddresses.includes(bank === 0x7E ? 0x7F0000 : 0x7E0000));
    assert.equal(data.readByte(base).available, false); assert.equal(p.iterations, 1); assert.equal(p.y, 0xE827);
  }
});

test('Missing highbyte after WORDatFFFF is a real nextbank sourceboundary and rolls back every effect', () => {
  const data = fixture({ bank: 0x7E, count: 0xE82B, records: [[0xE829, 0x1000]],
    writeWindows: [[0x7E0000, 0x7EFFFF]], omit: 0x7F0000 });
  assert.equal(unchanged(data, { bank: 0x7E, ioMode: null }, 'render_source_required', 'records').address, 0x7F0000);
});

test('Reached I/O recordreads are unsupported even with explicit register requestrecording', () => {
  const p = unchanged(fixture({ count: 0x82C, records: [] }), {}, 'render_address_required', 'records');
  assert.equal(p.address, 0x802000);
});

test('Indexed ROMwords require both explicit sourcebytes and never read or hydrate actual DMA sources', () => {
  const options = { count: 0x8004, records: [[0x8002, 0x1000]] }, data = fixture(options), p = prepare(data);
  commit(data, p); assert.equal(p.operations[2].address, 0x8097D8); assert.equal(p.operations[2].value, 0x1000);
  assert.equal(p.ioWrites[0].value, 0xF1BB); assert.equal(data.readByte(0x8DF1BB).available, false);
  assert.equal(data.readByte(0x8097DA).available, false);
  assert.equal(unchanged(fixture({ ...options, omit: 0x8097D9 }), {}, 'render_source_required', 'records').address, 0x8097D9);
  // One valid ROM visit cannot permit the next unmapped low-half read.
  const edge = fixture({ count: 0x682C, records: [[0x682A, 0x1000]] });
  assert.equal(unchanged(edge, {}, 'render_address_required', 'records').address, 0x807FFE);
});

test('Every individually missing reached gate or recordbyte rolls back earlier completed visits', () => {
  const records = [[4, 1], [2, 0x1000], [0, 0xFFF]];
  for (const offset of [0x1562, 0x1563, 0x17D4, 0x17D5, 0x17D6, 0x17D7, 0x17D8, 0x17D9, 0x17DA, 0x17DB]) {
    const p = unchanged(fixture({ count: 6, records, omit: 0x7E0000 + offset }), {}, 'render_source_required');
    assert.equal(p.address, 0x7E0000 + offset);
  }
});

test('Each physical registerbyte needs explicit ownership, including the final420B after earlywrites', () => {
  const addresses = [0x4342, 0x4343, 0x4345, 0x4346, 0x2121, 0x4344, 0x420B].map(a => 0x7E0000 + a);
  for (const missing of addresses) {
    const data = fixture({ bank: 0x7E, writeWindows: addresses.filter(a => a !== missing).map(a => [a, a]) });
    assert.equal(unchanged(data, { bank: 0x7E, ioMode: null }, 'render_write_window_required', 'records').address, missing);
  }
});

test('Every incomplete three-visit budget discards requests and writes; exact20 budget succeeds', () => {
  const options = { count: 6, records: [[4, 1], [2, 2], [0, 3]] };
  for (let maxWork = 1; maxWork < 20; maxWork++) unchanged(fixture(options), { maxWork }, 'render_work_budget_required');
  const data = fixture(options); commit(data, prepare(data, { maxWork: 20 }));
});

test('Systembankstores require explicit request-only I/O including the actual DBR00 callback', () => {
  for (const bank of [0, 0x80]) {
    const p = unchanged(fixture({ bank }), { bank, ioMode: null }, 'render_io_context_required', 'records');
    assert.equal(p.address, bank * 65536 + 0x4342);
  }
});

test('Protected JSLframe covers three bytes and every reached gate/record/register stackalias', () => {
  unchanged(fixture(), { stackWindow: null }, 'render_stack_required');
  unchanged(fixture(), { stackWindow: [0x1FFE, 0x1FFF] }, 'render_stack_required');
  assert.ok(prepare(fixture(), { stackWindow: [0x1FFD, 0x1FFF] }).handled);
  for (const [lo, phase] of [[0x1562, 'gates'], [0x17D4, 'gates'], [0x17D6, 'records']])
    unchanged(fixture(), { stackWindow: [lo, lo + 2] }, 'render_stack_alias_required', phase);
  const physical = fixture({ bank: 0x7E, writeWindows: [[0x7E0000, 0x7EFFFF]] });
  unchanged(physical, { bank: 0x7E, ioMode: null, stackWindow: [0x420B, 0x420D] }, 'render_stack_alias_required', 'records');
  const crossed = fixture({ bank: 0x7F, count: 0xE82B, records: [[0xE829, 0x1000]], writeWindows: [[0x7F0000, 0x7FFFFF]] });
  assert.equal(unchanged(crossed, { bank: 0x7F, ioMode: null, stackWindow: [0, 2] }, 'render_stack_alias_required', 'records').address, 0x7E0000);
});

test('All128 systembank mirrors preserve actual requestaddresses and shared gate/count/record WRAM', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40) continue;
    const data = fixture({ bank }), p = prepare(data, { bank }); commit(data, p);
    assert.equal(p.ioWrites[0].address, bank * 65536 + 0x4342); assert.equal(p.ioWrites.at(-1).address, bank * 65536 + 0x420B);
    assert.equal(word(data, 0x8017D4), 2); assert.equal(data.readByte(bank * 65536 + 0x420B).available, false);
  }
});

test('Physical7E/7F retains owned registerwrites, BYTEneighbors and shared count without I/O metadata', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 65536, data = fixture({ bank, writeWindows: [[base, base + 65535]] });
    data.seed(base + 0x2120, [0xA5]); data.seed(base + 0x2122, [0x5A]); data.seed(base + 0x4347, [0xCC]);
    const p = prepare(data, { bank, ioMode: null }); assert.deepEqual(p.ioWrites, []); commit(data, p);
    assert.equal(word(data, base + 0x4342), 0xF1BB); assert.equal(word(data, base + 0x4345), 30);
    for (const [offset, value] of [[0x2121, 0x81], [0x4344, 0x8D], [0x420B, 16], [0x2120, 0xA5], [0x2122, 0x5A], [0x4347, 0xCC]])
      assert.equal(data.readByte(base + offset).value, value);
    assert.equal(word(data, base + 0x17D4), 2); if (bank === 0x7F) assert.equal(data.readByte(0x7E17D4).available, false);
  }
});

test('InnerA919 shares prior recordwrites and budget while only outer finish creates a commitpayload', () => {
  const data = fixture({ count: 4, records: [[2, 0], [0, 0]], writeWindows: [[0x7E17D6, 0x7E17D7]] });
  const before = data.snapshot(), view = prepareRenderView(data); view.write(0x17D6, 0xFF); view.write(0x17D7, 0x10);
  const budget = { work: 3, maxWork: 17 }, inner = renderA919(view, entry, budget);
  assert.equal(inner.ioWrites[5].value, pointer(0x10FF)); assert.equal(inner.work, 17); assert.equal(budget.work, 17);
  assert.throws(() => data.commit(inner), /Invalid render plan/); assert.deepEqual(data.snapshot(), before);
  commit(data, view.finish(inner)); assert.equal(word(data, 0x17D6), 0x10FF);
  const late = fixture({ records: [], writeWindows: [[0x7E1562, 0x7E1563]] }), lateBefore = late.snapshot();
  const lateView = prepareRenderView(late); lateView.write(0x1562, 2);
  assert.throws(() => renderA919(lateView, entry, { work: 0, maxWork: 8 }),
    e => e.renderBoundary && e.reason === 'render_source_required' && e.phase === 'records');
  assert.deepEqual(late.snapshot(), lateBefore);
});

test('Repeating an unchanged nonzero list requests it again, preserving gates without invented acknowledgment', () => {
  const data = fixture(), first = prepare(data); commit(data, first);
  const second = prepare(data); commit(data, second);
  assert.deepEqual(second.operations, first.operations); assert.equal(word(data, 0x17D4), 2); assert.equal(word(data, 0x1562), 1);
});

test('Invalid contexts and immutable/stale/foreign/copied plans cannot change the manual owner', () => {
  const data = fixture();
  for (const options of [{ bank: null }, { status: null }, { status: 8 }, { status: 16 }, { status: 32 }, { emulation: 1 }, { directPage: 1 }])
    unchanged(data, options, 'render_entry_required');
  unchanged(data, { bank: 0x40 }, 'render_address_required', 'gates');
  for (const options of [{ bank: 256 }, { status: -1 }, { x: 65536 }, { y: -1 }, { maxWork: 0 }, { ioMode: 'execute' }])
    assert.throws(() => prepare(data, options), /Invalid render/);
  const p = prepare(data); assert.throws(() => { p.ioWrites[0].value = 0; }, TypeError);
  assert.throws(() => { p.operations.push({}); }, TypeError); assert.throws(() => fixture().commit(p), /Invalid render plan/);
  assert.throws(() => data.commit({ ...p }), /Invalid render plan/); seedWord(data, 0x17D6, 1);
  const before = data.snapshot(); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), before);
});

test('Nine synthetic probes reproduce both gates, oddcount, descending requests, highcount and BYTE C/V', () => {
  assert.equal(report.probes.length, 9);
  for (const probe of report.probes) {
    const f = probe.fixture, p = prepare(fixture({ ...f, count: f.count ?? null, records: f.records ?? [] }));
    for (const key of ['handled', 'outcome', 'a', 'x', 'y', 'bank', 'status', 'carry', 'overflow', 'gate', 'count', 'initialY', 'iterations', 'work', 'operations', 'ioWrites', 'byteWrites', 'readAddresses'])
      assert.deepEqual(p[key], probe[key]);
  }
});
