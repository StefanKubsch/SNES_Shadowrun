import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView, renderAddress } from '../src/render/data.mjs';
import { prepareRenderA958, renderA958 } from '../proof/render/transfer-list-a958.mjs';
import { cpuToOffset } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-a958-native.json', import.meta.url), 'utf8'));
const entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const cursorWindow = [0x7E0082, 0x7E0083];
const seedWord = (d, a, v) => d.seed(a, [v & 255, v >>> 8]);
const word = (d, a) => d.readByte(a).value | d.readByte(a + 1).value << 8;
function fixture({ gate = 1, cursor = 0, records = [[0, 0xFFC0, 0xABCD, 0xCF]], bank = 0x80,
  writeWindows = [cursorWindow], omit = null } = {}) {
  const data = createRenderData({ writeWindows }), values = new Map(), base = bank * 65536;
  const set = (address, value, bytes = 2) => {
    values.set(renderAddress(address), value & 255);
    if (bytes === 2) values.set(renderAddress(address + 1), value >>> 8);
  };
  for (const [x, pointer, target, sourceBank] of records) {
    set(base + 0x16D4 + x, pointer); set(base + 0x1754 + x, target); set(base + 0x1654 + x, sourceBank, 1);
  }
  if (gate !== null) set(base + 0x1562, gate);
  if (cursor !== null) set(0x82, cursor);
  for (const [address, value] of values) if (address !== omit) data.seed(address, [value]);
  return data;
}
const prepare = (data, options = {}) => prepareRenderA958({ ...entry, data, ...options });
const commit = (data, p) => { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.commit(p), { handled: true }); };
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  for (const key of ['operations', 'ioWrites', 'byteWrites']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}
function physical(cursor, bank = 0x7E) {
  const data = createRenderData({ writeWindows: [cursorWindow, [bank * 65536, bank * 65536 + 65535]] });
  data.seed(bank * 65536 + 0x1654, new Uint8Array(0x1754 + cursor + 2 - 0x1654));
  seedWord(data, bank * 65536 + 0x1562, 1); seedWord(data, 0x82, cursor);
  return data;
}
const physicalEntry = bank => ({ bank, ioMode: null, stackWindow: [0x100, 0x102] });

test('NativeA958 probe pins original54/23 separately from synthetic input/stack/write fixtures', () => {
  const raw = rom.subarray(cpuToOffset(0x81A958, rom.length), cpuToOffset(0x81A98E, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), 'be5e955766edc1794cf7409cbf4d8b041d9b071f4033d8be6ed65051412878e3');
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase()); assert.equal(report.source.instruction_count, 23);
  assert.equal(report.probes.length, 6); assert.match(report.scope, /synthetic/); assert.match(report.scope, /no device execution/);
});

test('Zero1562 reaches only its WORD and preserves X/Y/C/V/I without cursor/tables/write/I/O', () => {
  for (let status = 0; status < 256; status++) {
    if (status & 0x38) continue;
    const data = fixture({ gate: 0, cursor: null, records: [], writeWindows: [] }), p = prepare(data, { status, ioMode: null });
    commit(data, p); assert.equal(p.outcome, 'gate_1562_zero'); assert.equal(p.a, 0); assert.equal(p.status, (status & 0x7D) | 2);
    assert.equal(p.x, entry.x); assert.equal(p.y, entry.y); assert.equal(p.cursor, null); assert.equal(p.iterations, 0);
    assert.equal(p.work, 1); assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []);
    assert.deepEqual(p.readAddresses, [0x7E1562, 0x7E1563]);
  }
});

test('Negative DP82 returns gateA with LDX N1/Z0, needs no tables or writewindow, and never clears82', () => {
  for (const cursor of [0x8000, 0x8001, 0xFFFE, 0xFFFF]) for (const gate of [1, 0x8000, 0xFFFF]) {
    const data = fixture({ gate, cursor, records: [], writeWindows: [] }), p = prepare(data, { ioMode: null }); commit(data, p);
    assert.equal(p.outcome, 'cursor_82_negative'); assert.equal(p.a, gate); assert.equal(p.x, cursor); assert.equal(p.status, 0xC5);
    assert.equal(p.y, entry.y); assert.equal(p.iterations, 0); assert.equal(p.work, 2);
    assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []); assert.equal(word(data, 0x82), cursor);
    assert.equal(word(data, 0x1562), gate);
  }
});

test('Cursor0 is one active visit with six requests and final DP82 store; bankhighbyte is not read', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data); assert.deepEqual(data.snapshot(), before);
  assert.equal(p.iterations, 1); assert.equal(p.cursor, 0); assert.equal(p.x, 0xFFFE); assert.equal(p.a, 0xAB02);
  assert.equal(p.status, 0xC5); assert.equal(p.y, entry.y); assert.equal(p.work, 12);
  assert.deepEqual(p.ioWrites.map(e => [e.address & 65535, e.value, e.bytes]),
    [[0x4312, 0xFFC0, 2], [0x4315, 0x40, 2], [0x2116, 0xABCD, 2], [0x2115, 0x80, 1], [0x4314, 0xCF, 1], [0x420B, 2, 1]]);
  assert.deepEqual(p.operations.at(-1), { kind: 'write', space: 'data', phase: 'cursor', address: 0x82, value: 0xFFFE, bytes: 2 });
  assert.deepEqual(p.byteWrites, [[0x7E0082, 0xFE], [0x7E0083, 0xFF]]);
  assert.equal(data.readByte(0x1655).available, false); assert.ok(!p.readAddresses.includes(0x7E1655));
  commit(data, p); assert.equal(word(data, 0x82), 0xFFFE); assert.equal(word(data, 0x1562), 1);
});

test('Three entries descend from current cursor with fresh read/store order and retain last target highA', () => {
  const records = [[4, 0xFFFF, 0xABCD, 0xFF], [2, 0, 0x8000, 0], [0, 0x1234, 0x5600, 0x3F]], data = fixture({ cursor: 4, records });
  const p = prepare(data, { status: 0x45 }); assert.ok(p.handled);
  assert.equal(p.iterations, 3); assert.equal(p.work, 30); assert.equal(p.a, 0x5602); assert.equal(p.x, 0xFFFE); assert.equal(p.status, 0xC5);
  assert.deepEqual(p.ioWrites.map(e => [e.address & 65535, e.value, e.bytes]), records.flatMap(([, pointer, target, bank]) =>
    [[0x4312, pointer, 2], [0x4315, 64, 2], [0x2116, target, 2], [0x2115, 128, 1], [0x4314, bank, 1], [0x420B, 2, 1]]));
  assert.deepEqual(p.operations.slice(2, 11).map(e => [e.kind, e.address & 65535]),
    [['read', 0x16D8], ['write', 0x4312], ['write', 0x4315], ['read', 0x1758], ['write', 0x2116],
      ['write', 0x2115], ['read', 0x1658], ['write', 0x4314], ['write', 0x420B]]);
  commit(data, p); assert.equal(word(data, 0x82), 0xFFFE);
});

test('Oddcursor3 visits actual odd WORDaddresses3/1 then stores FFFF, without rounding', () => {
  const data = fixture({ cursor: 3, records: [[3, 0x1234, 0x8000, 0x8E], [1, 0xFFFF, 0xAB00, 0xFF]] }), p = prepare(data); commit(data, p);
  assert.equal(p.iterations, 2); assert.equal(p.x, 0xFFFF); assert.equal(word(data, 0x82), 0xFFFF); assert.equal(p.a, 0xAB02);
  assert.deepEqual(p.operations.filter(e => e.kind === 'read' && e.phase === 'records').map(e => e.address & 65535),
    [0x16D7, 0x1757, 0x1657, 0x16D5, 0x1755, 0x1655]);
});

test('All65536 targetWORDs independently preserve highA with low02 while C/V/I remain supplied', () => {
  const data = fixture();
  for (let target = 0; target < 65536; target++) {
    seedWord(data, 0x1754, target); const status = target & 1 ? 0x45 : 0x04, p = prepare(data, { status });
    assert.ok(p.handled); assert.equal(p.a, Math.floor(target / 256) * 256 + 2);
    assert.equal(p.status, status | 128); assert.equal(p.ioWrites[2].value, target);
    assert.equal(p.carry, status % 2); assert.equal(p.overflow, Math.floor(status / 64) % 2);
  }
});

test('DBR7F cursor always reads/writes bank00 DP82 instead of physical7F:0082', () => {
  const data = fixture({ bank: 0x7F, writeWindows: [cursorWindow, [0x7F2000, 0x7F43FF]] }); seedWord(data, 0x7F0082, 4);
  const p = prepare(data, physicalEntry(0x7F)); commit(data, p);
  assert.equal(p.cursor, 0); assert.equal(p.iterations, 1); assert.equal(word(data, 0x82), 0xFFFE); assert.equal(word(data, 0x7F0082), 4);
  assert.equal(word(data, 0x7F4312), 0xFFC0); assert.equal(word(data, 0x7F2116), 0xABCD);
  assert.deepEqual(p.ioWrites, []); assert.ok(p.readAddresses.includes(0x7E0082)); assert.ok(!p.readAddresses.includes(0x7F0082));
});

test('Maximal even/odd activecursors7FFE/7FFF each complete16384 physical visits with correct signedtail', () => {
  for (const cursor of [0x7FFE, 0x7FFF]) {
    const data = physical(cursor, 0x7F), p = prepare(data, physicalEntry(0x7F)); commit(data, p);
    assert.equal(p.iterations, 16384); assert.equal(p.work, 147459); assert.equal(p.x, cursor & 1 ? 0xFFFF : 0xFFFE);
    assert.equal(word(data, 0x82), p.x); assert.equal(p.a, 2); assert.equal(p.status, 0xC5);
    const reads = p.operations.filter(e => e.phase === 'records' && e.kind === 'read');
    assert.equal(reads.length, 49152); assert.equal(reads[0].address, 0x7F16D4 + cursor);
    assert.equal(reads.at(-3).address, 0x7F16D4 + (cursor & 1)); assert.deepEqual(p.ioWrites, []);
  }
});

test('Fresh samevisit target sees earlier pointerstore through physical4312 alias', () => {
  const data = physical(0x2BBE); seedWord(data, 0x7E16D4 + 0x2BBE, 0xABCD);
  const p = prepare(data, physicalEntry(0x7E)); commit(data, p);
  const reads = p.operations.filter(e => e.phase === 'records' && e.kind === 'read');
  assert.equal(reads[1].address, 0x7E4312); assert.equal(reads[1].value, 0xABCD);
  assert.deepEqual(p.operations.slice(2, 7).map(e => e.value), [0xABCD, 0xABCD, 64, 0xABCD, 0xABCD]);
});

test('Fresh samevisit BYTEbank sees WORDsize highbyte4316=00 instead of its original seed', () => {
  const data = physical(0x2CC2); data.seed(0x7E4316, [0xFF]); const p = prepare(data, physicalEntry(0x7E)); commit(data, p);
  const bankRead = p.operations.find(e => e.kind === 'read' && e.address === 0x7E4316);
  assert.equal(bankRead.bytes, 1); assert.equal(bankRead.value, 0); assert.equal(p.operations[9].value, 0);
});

test('A future registerwrite cannot fill an unknown initial pointerread at physical4314', () => {
  const data = physical(0x2C40), snapshot = data.snapshot();
  const unknown = createRenderData({ writeWindows: snapshot.writeWindows });
  for (const [a, v] of snapshot.bytes) if (a !== 0x7E4314) unknown.seed(a, [v]);
  const p = unchanged(unknown, physicalEntry(0x7E), 'render_source_required', 'records'); assert.equal(p.address, 0x7E4314);
});

test('Every reached missing sourcebyte withholds all requestmetadata and cursorwrites', () => {
  const records = [[2, 1, 0xABCD, 0x8E], [0, 2, 0xFFFF, 0xCF]], full = fixture({ cursor: 2, records });
  const reached = prepare(full).readAddresses;
  for (const omit of reached) {
    const data = fixture({ cursor: 2, records, omit }); unchanged(data, {}, 'render_source_required');
  }
});

test('Every incomplete threeentry budget withholds all effects including lastDP82 store', () => {
  const data = fixture({ cursor: 4, records: [[4, 1, 2, 3], [2, 4, 5, 6], [0, 7, 8, 9]] });
  for (let maxWork = 1; maxWork < 30; maxWork++) unchanged(data, { maxWork }, 'render_work_budget_required');
  const p = prepare(data, { maxWork: 30 }); commit(data, p); assert.equal(p.work, 30);
});

test('Either absent cursorwritebyte rejects after allrequests and commits no prefix', () => {
  for (const writeWindows of [[], [[0x7E0082, 0x7E0082]], [[0x7E0083, 0x7E0083]]]) {
    const data = fixture({ writeWindows }); unchanged(data, {}, 'render_write_window_required', 'cursor');
  }
});

test('I/O context is required only for reached stores and no requests imply device completion', () => {
  const data = fixture(); unchanged(data, { ioMode: null }, 'render_io_context_required', 'records');
  const zero = fixture({ gate: 0, cursor: null, records: [] }); assert.ok(prepare(zero, { ioMode: null }).handled);
  const p = prepare(data); assert.equal(p.ioWrites.length, 6); assert.equal(p.transferComplete, undefined);
});

test('Late I/O targetread after two requeststores needs its own readcontract and withholds requests', () => {
  const data = fixture({ cursor: 0x8C2, records: [] }); seedWord(data, 0x1F96, 0x1234);
  const p = unchanged(data, { stackWindow: [0x100, 0x102] }, 'render_address_required', 'records'); assert.equal(p.address, 0x802016);
});

test('Active highindices can read original ROMbytes but missing next record still discards earlierrequests', () => {
  const data = fixture({ cursor: 0x7000, records: [] });
  for (const [a, bytes] of [[0x8086D4, 2], [0x808754, 2], [0x808654, 1]]) {
    const off = cpuToOffset(a, rom.length); data.seed(a, rom.subarray(off, off + bytes));
  }
  const p = unchanged(data, {}, 'render_source_required', 'records'); assert.equal(p.address, 0x8086D2);
});

test('Three protected JSLbytes guard gate/cursorreads and late physical registerstore aliases', () => {
  const data = fixture(); unchanged(data, { stackWindow: [0x1562, 0x1564] }, 'render_stack_alias_required', 'gates');
  unchanged(data, { stackWindow: [0x82, 0x84] }, 'render_stack_alias_required', 'gates');
  const physicalData = fixture({ bank: 0x7E, writeWindows: [cursorWindow, [0x7E2000, 0x7E43FF]] });
  const p = unchanged(physicalData, { bank: 0x7E, ioMode: null, stackWindow: [0x4315, 0x4317] }, 'render_stack_alias_required', 'records');
  assert.equal(p.address, 0x7E4315);
});

test('All128 system DBRs use bank00 cursor and ordered I/Ometadata while preserving supplied C/V/I/Y', () => {
  for (let bank = 0; bank < 256; bank++) if (!(bank & 0x40)) {
    const data = fixture({ bank }), p = prepare(data, { bank }); commit(data, p);
    assert.equal(p.cursor, 0); assert.equal(p.x, 0xFFFE); assert.equal(p.status, 0xC5); assert.equal(p.y, entry.y);
    assert.equal(p.ioWrites[0].address, bank * 65536 + 0x4312); assert.equal(p.operations[1].address, 0x82);
    assert.equal(p.operations.at(-1).address, 0x82);
  }
});

test('InnerA958 shares an outer byteview/budget and has no independently applicable commitpayload', () => {
  const data = fixture({ writeWindows: [cursorWindow, [0x7E1755, 0x7E1755]] });
  const before = data.snapshot(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]);
  view.write(0x1755, 0x56); const budget = { work: 7, maxWork: 19 }, p = renderA958(view, entry, budget);
  assert.equal(p.a, 0x5602); assert.equal(p.work, 19); assert.equal(budget.work, 19);
  assert.equal(p.byteWrites, undefined); assert.throws(() => data.commit(p), /Invalid render plan/); assert.deepEqual(data.snapshot(), before);
  const outer = view.finish(p); commit(data, outer); assert.equal(word(data, 0x1754), 0x56CD); assert.equal(word(data, 0x82), 0xFFFE);
});

test('Late shared budget failure withholds outer prewrites and every inner prefix', () => {
  // The outerowner explicitly owns this source byte for its pending write.
  const outerData = fixture({ writeWindows: [cursorWindow, [0x7E1755, 0x7E1755]] });
  const outerBefore = outerData.snapshot(), outerView = prepareRenderView(outerData, [0x7E1F00, 0x7E1FFF]);
  outerView.write(0x1755, 0x12);
  assert.throws(() => renderA958(outerView, entry, { work: 7, maxWork: 18 }), e => e.renderBoundary && e.reason === 'render_work_budget_required' && e.phase === 'cursor');
  assert.deepEqual(outerData.snapshot(), outerBefore);
});

test('Committed cursor makes repeated A958 take negativegate; planstaleness and ownership remain enforced', () => {
  const data = fixture(), p = prepare(data), q = prepare(data); commit(data, p);
  assert.deepEqual(data.commit(q), { handled: false, reason: 'render_plan_stale' });
  const second = prepare(data, { ioMode: null }); commit(data, second);
  assert.equal(second.outcome, 'cursor_82_negative'); assert.equal(second.a, 1); assert.equal(second.x, 0xFFFE);
  assert.deepEqual(second.ioWrites, []); assert.deepEqual(second.byteWrites, []); assert.equal(word(data, 0x1562), 1);
  assert.throws(() => fixture().commit(p), /Invalid render plan/); assert.ok(Object.isFrozen(p)); assert.ok(Object.isFrozen(p.ioWrites[0]));
});

test('Invalid/unknown context requires explicit binary WORDentry, DP0 and at least3 stackbytes', () => {
  const data = fixture();
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 0x10 }, { status: 8 }, { directPage: 1 }, { emulation: 1 }])
    unchanged(data, options, 'render_entry_required');
  for (const stackWindow of [null, [0x100, 0x101], [0x102, 0x100]]) unchanged(data, { stackWindow }, 'render_stack_required');
  for (const options of [{ x: -1 }, { y: 65536 }, { ioMode: 'execute' }, { maxWork: 0 }, { bank: 256 }, { status: 256 }])
    assert.throws(() => prepare(data, options), /Invalid/);
  const p = prepare(data, { stackWindow: [0x100, 0x102] }); assert.ok(p.handled);
});
