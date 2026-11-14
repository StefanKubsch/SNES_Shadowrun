import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRender80C4, render80C4 } from '../proof/render/palette-80c4.mjs';
import { cpuToOffset } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-80c4-native.json', import.meta.url), 'utf8'));
const windows = [[0x7E1CDA, 0x7E1CDB]];
const entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const seedWord = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const word = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function fixture({ pointer = 0x1234, index = 0, size = 32, palette = 0x80,
  secondSize = null, bank = 0x80, writeWindows = windows, omit = null } = {}) {
  const data = createRenderData({ writeWindows }), base = bank * 65536, values = new Map();
  for (const [offset, value] of [[0x1CDA, pointer], [0x1CDC, index], [0x1CCA, size], [0x1CCC, secondSize]]) if (value !== null) {
    values.set(base + offset, value & 255); values.set(base + offset + 1, value >>> 8);
  }
  if (palette !== null && index !== null) values.set(base + 0x1CC6 + index, palette);
  for (const [address, value] of values) if (address !== omit) data.seed(address, [value]);
  return data;
}
const prepare = (data, options = {}) => prepareRender80C4({ ...entry, data, ...options });
const commit = (data, p) => { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.commit(p), { handled: true }); };
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  for (const key of ['operations', 'ioWrites', 'byteWrites']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}

test('Native80C4 probe pins original51/20 independently from all synthetic fixture bytes', () => {
  const raw = rom.subarray(cpuToOffset(0x8180C4, rom.length), cpuToOffset(0x8180F7, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), 'c2dee31d0f818564457d0cda4708d7ae4eb29bfad2e585604168f6d23ffebc74');
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase());
  assert.equal(report.source.instruction_count, 20); assert.match(report.scope, /synthetic/); assert.match(report.scope, /no device execution/);
});

test('Zero80C4 gate needs only its WORD and preserves all valid C/V/I/X/Y contexts without I/O or clears', () => {
  for (let status = 0; status < 256; status++) {
    if (status & 0x38) continue;
    const data = fixture({ pointer: 0, index: null, size: null, palette: null, writeWindows: [] });
    const p = prepare(data, { status, ioMode: null }); commit(data, p);
    assert.equal(p.outcome, 'gate_1CDA_zero'); assert.equal(p.status, (status & 0x7D) | 2);
    assert.equal(p.a, 0); assert.equal(p.x, entry.x); assert.equal(p.y, entry.y); assert.equal(p.work, 1);
    assert.equal(p.pointer, 0); assert.equal(p.size, null); assert.equal(p.palette, null); assert.equal(p.paletteAddress, null);
    assert.deepEqual(p.readAddresses, [0x7E1CDA, 0x7E1CDB]); assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []);
  }
  const data = fixture({ pointer: 0, index: null, size: null, palette: null });
  assert.equal(prepare(data, { x: null, y: null }).x, null); assert.equal(prepare(data, { x: null, y: null }).y, null);
});

test('Active80C4 preserves exact read/store order and final WORD zero/flags until an explicit commit', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data);
  assert.ok(p.handled); assert.deepEqual(data.snapshot(), before);
  assert.deepEqual(p.ioWrites.map(e => [e.address & 65535, e.value, e.bytes]),
    [[0x4302, 0x1234, 2], [0x4305, 32, 2], [0x4300, 0x2200, 2], [0x2121, 0x80, 1], [0x4304, 0x8B, 1], [0x420B, 1, 1]]);
  assert.deepEqual(p.operations.map(e => [e.kind, e.address & 65535, e.bytes]),
    [['read', 0x1CDA, 2], ['write', 0x4302, 2], ['read', 0x1CDC, 2], ['read', 0x1CCA, 2], ['write', 0x4305, 2],
      ['write', 0x4300, 2], ['read', 0x1CC6, 1], ['write', 0x2121, 1], ['write', 0x4304, 1], ['write', 0x420B, 1], ['write', 0x1CDA, 2]]);
  assert.equal(p.a, 0); assert.equal(p.status, 0x47); assert.equal(p.x, 0); assert.equal(p.y, entry.y);
  assert.equal(p.carry, 1); assert.equal(p.overflow, 1); assert.equal(p.work, 11); assert.equal(p.paletteAddress, 0x801CC6);
  assert.equal(word(data, 0x1CDA), 0x1234); commit(data, p); assert.equal(word(data, 0x1CDA), 0);
  assert.deepEqual(p.byteWrites, [[0x7E1CDA, 0], [0x7E1CDB, 0]]);
});

test('X2 selects the second palette BYTE but still uses the unindexed first size WORD', () => {
  const data = fixture({ index: 2, size: 0x50, secondSize: 0x740, palette: 0xA5 }), p = prepare(data);
  commit(data, p); assert.equal(p.x, 2); assert.equal(p.size, 0x50); assert.equal(p.ioWrites[1].value, 0x50);
  assert.equal(p.ioWrites[3].value, 0xA5); assert.equal(p.paletteAddress, 0x801CC8);
  assert.ok(!p.readAddresses.includes(0x7E1CCC)); assert.equal(word(data, 0x1CCC), 0x740);
  assert.ok(prepare(fixture({ index: 2, secondSize: null })).handled);
});

test('Nonzero FFFF pointer and zero size still retain all six requests without pointer validation', () => {
  const data = fixture({ pointer: 0xFFFF, size: 0 }), p = prepare(data); commit(data, p);
  assert.equal(p.ioWrites.length, 6); assert.equal(p.ioWrites[0].value, 0xFFFF); assert.equal(p.ioWrites[1].value, 0);
  assert.equal(p.ioWrites.at(-1).value, 1); assert.equal(word(data, 0x1CDA), 0);
});

test('All256 paletteBYTEs and valid entry statusflags return WORDzero with preserved C/V/I', () => {
  const data = fixture();
  for (let palette = 0; palette < 256; palette++) {
    data.seed(0x1CC6, [palette]); const p = prepare(data); assert.ok(p.handled);
    assert.equal(p.palette, palette); assert.equal(p.ioWrites[3].value, palette); assert.equal(p.a, 0); assert.equal(p.status, 0x47);
  }
  for (let status = 0; status < 256; status++) {
    if (status & 0x38) continue;
    const p = prepare(data, { status }); assert.equal(p.status, (status & 0x7D) | 2);
    assert.equal(p.carry, status & 1); assert.equal(p.overflow, status >>> 6 & 1); assert.equal(p.y, entry.y);
  }
});

test('Odd index needs exactly its selected BYTE without rounding or reading the adjacent byte', () => {
  const data = fixture({ index: 1, palette: 0x5A }), p = prepare(data); commit(data, p);
  assert.equal(p.x, 1); assert.equal(p.paletteAddress, 0x801CC7); assert.equal(p.palette, 0x5A);
  assert.equal(data.readByte(0x1CC6).available, false); assert.equal(data.readByte(0x1CC8).available, false);
});

test('BYTE palette aliases live pointer/index/size before the final pendingclear', () => {
  for (const [index, expected] of [[0x14, 0x34], [0x15, 0x12], [0x16, 0x16], [0x17, 0], [4, 0xEF], [5, 0xBE]]) {
    const data = fixture({ index, size: 0xBEEF, palette: null }), p = prepare(data); commit(data, p);
    assert.equal(p.palette, expected); assert.equal(p.x, index); assert.equal(p.size, 0xBEEF);
    assert.equal(word(data, 0x1CDA), 0); assert.equal(word(data, 0x1CDC), index); assert.equal(word(data, 0x1CCA), 0xBEEF);
  }
});

test('Physical7E/7F palette reads observe earlier pointer/size/config registerstores through the shared view', () => {
  for (const bank of [0x7E, 0x7F]) for (const [index, expected] of [[0x263C, 0x34], [0x263D, 0x12], [0x263F, 0xEF],
    [0x2640, 0xBE], [0x263A, 0], [0x263B, 0x22]]) {
    const base = bank * 65536, data = fixture({ bank, index, size: 0xBEEF, palette: null, writeWindows: [[base, base + 65535]] });
    const p = prepare(data, { bank, ioMode: null }); commit(data, p);
    assert.equal(p.palette, expected); assert.deepEqual(p.ioWrites, []); assert.equal(data.readByte(base + 0x2121).value, expected);
  }
});

test('Full index carries7E into7F and7F into bank80 WRAM mirror instead of wrapping in the entry bank', () => {
  for (const bank of [0x7E, 0x7F]) for (const index of [0xE33A, 0xFFFF]) {
    const base = bank * 65536, address = base + 0x1CC6 + index;
    const data = fixture({ bank, index, palette: 0x5A, writeWindows: [[base, base + 65535]] });
    const p = prepare(data, { bank, ioMode: null }); commit(data, p);
    assert.equal(p.paletteAddress, address); assert.equal(p.palette, 0x5A); assert.equal(p.x, index);
    const offset = index === 0xE33A ? 0 : 0x1CC5;
    assert.ok(p.readAddresses.includes((bank === 0x7E ? 0x7F0000 : 0x7E0000) + offset));
    assert.equal(data.readByte(base + offset).available, false);
  }
});

test('Later physical registerstores cannot satisfy the earlier paletteBYTE read or initialize its source', () => {
  for (const offset of [0x2121, 0x4304, 0x420B]) {
    const data = fixture({ bank: 0x7E, index: offset - 0x1CC6, palette: null, writeWindows: [[0x7E0000, 0x7EFFFF]] });
    const p = unchanged(data, { bank: 0x7E, ioMode: null }, 'render_source_required', 'palette');
    assert.equal(p.address, 0x7E0000 + offset);
  }
});

test('Selected BYTE at entrybankFFFF reads only that byte and the nextbank boundary remains source-required', () => {
  const bank = 0x7E, data = fixture({ bank, index: 0xE339, palette: 0xA5, writeWindows: [[0x7E0000, 0x7EFFFF]] });
  const p = prepare(data, { bank, ioMode: null }); commit(data, p);
  assert.equal(p.paletteAddress, 0x7EFFFF); assert.equal(p.palette, 0xA5); assert.equal(data.readByte(0x7F0000).available, false);
  const missing = fixture({ bank, index: 0xE33A, palette: null, writeWindows: [[0x7E0000, 0x7EFFFF]] });
  assert.equal(unchanged(missing, { bank, ioMode: null }, 'render_source_required', 'palette').address, 0x7F0000);
});

test('Indexed physicalROM requires an explicit single sourceBYTE and never reads or hydrates the DMA source', () => {
  const data = fixture({ index: 0x633A, palette: 0xA5 }), p = prepare(data); commit(data, p);
  assert.equal(p.paletteAddress, 0x808000); assert.equal(p.palette, 0xA5);
  assert.equal(data.readByte(0x808001).available, false); assert.equal(data.readByte(0x8B1234).available, false);
  assert.equal(unchanged(fixture({ index: 0x633A, palette: null }), {}, 'render_source_required', 'palette').address, 0x808000);
});

test('Reached indexed I/O/SRAM/unsupported-bank reads retain all prior requests as pending', () => {
  for (const [index, address] of [[0x462, 0x802128], [0x33A, 0x802000], [0x6339, 0x807FFF], [0xE33A, 0x810000]]) {
    const p = unchanged(fixture({ index, palette: null }), {}, index === 0xE33A ? 'render_source_required' : 'render_address_required', 'palette');
    assert.equal(p.address, index === 0xE33A ? 0x7E0000 : address);
  }
});

test('Each missing reached inputBYTE rolls back every request and data effect', () => {
  for (const offset of [0x1CDA, 0x1CDB, 0x1CDC, 0x1CDD, 0x1CCA, 0x1CCB, 0x1CC6]) {
    const p = unchanged(fixture({ omit: 0x800000 + offset }), {}, 'render_source_required');
    assert.equal(p.address, 0x7E0000 + offset);
  }
});

test('Either missing finalclearBYTE ownership rolls back all six recorded requests', () => {
  for (const address of [0x7E1CDA, 0x7E1CDB]) {
    const p = unchanged(fixture({ writeWindows: [[address ^ 1, address ^ 1]] }), {}, 'render_write_window_required', 'clear');
    assert.equal(p.address, address);
  }
});

test('Every physical registerBYTE needs write ownership and a late420B failure rolls back earlier writes', () => {
  const addresses = [0x4302, 0x4303, 0x4305, 0x4306, 0x4300, 0x4301, 0x2121, 0x4304, 0x420B].map(a => 0x7E0000 + a);
  for (const missing of addresses) {
    const data = fixture({ bank: 0x7E, writeWindows: [...windows, ...addresses.filter(a => a !== missing).map(a => [a, a])] });
    assert.equal(unchanged(data, { bank: 0x7E, ioMode: null }, 'render_write_window_required').address, missing);
  }
});

test('All ten incomplete active workbudgets discard effects and exact budget11 succeeds', () => {
  for (let maxWork = 1; maxWork < 11; maxWork++) unchanged(fixture(), { maxWork }, 'render_work_budget_required');
  const data = fixture(); commit(data, prepare(data, { maxWork: 11 }));
});

test('Reached I/O stores require an explicit request-only context, including actual DBR00 caller', () => {
  for (const bank of [0, 0x80]) {
    const p = unchanged(fixture({ bank }), { bank, ioMode: null }, 'render_io_context_required', 'setup');
    assert.equal(p.address, bank * 65536 + 0x4302);
  }
});

test('Three protected JSLbytes and every reached read/write stackalias are required before effects', () => {
  unchanged(fixture(), { stackWindow: null }, 'render_stack_required');
  unchanged(fixture(), { stackWindow: [0x1FFE, 0x1FFF] }, 'render_stack_required');
  assert.ok(prepare(fixture(), { stackWindow: [0x1FFD, 0x1FFF] }).handled);
  for (const [lo, phase] of [[0x1CDA, 'gate'], [0x1CDC, 'setup'], [0x1CCA, 'setup'], [0x1CC6, 'palette']])
    unchanged(fixture(), { stackWindow: [lo, lo + 2] }, 'render_stack_alias_required', phase);
  const physical = fixture({ bank: 0x7E, writeWindows: [[0x7E0000, 0x7EFFFF]] });
  unchanged(physical, { bank: 0x7E, stackWindow: [0x420B, 0x420D], ioMode: null }, 'render_stack_alias_required', 'palette');
  const mirror = fixture({ bank: 0x7F, index: 0xFFFF, palette: 1, writeWindows: [[0x7F0000, 0x7FFFFF]] });
  unchanged(mirror, { bank: 0x7F, stackWindow: [0x1CC5, 0x1CC7], ioMode: null }, 'render_stack_alias_required', 'palette');
});

test('All128 systembank mirrors preserve request addresses and use the same physical pendingword owner', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40) continue;
    const data = fixture({ bank }), p = prepare(data, { bank }); commit(data, p);
    assert.equal(p.ioWrites[0].address, bank * 65536 + 0x4302); assert.equal(p.ioWrites.at(-1).address, bank * 65536 + 0x420B);
    assert.equal(word(data, 0x801CDA), 0); assert.equal(data.readByte(bank * 65536 + 0x4300).available, false);
  }
});

test('Physical7E/7F stores actual registerbytes, preserves neighbors and does not require I/O metadata', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 65536, data = fixture({ bank, writeWindows: [[base, base + 65535]] });
    data.seed(base + 0x2120, [0xA5]); data.seed(base + 0x2122, [0x5A]); data.seed(base + 0x4307, [0xCC]);
    const p = prepare(data, { bank, ioMode: null }); assert.deepEqual(p.ioWrites, []); commit(data, p);
    for (const [offset, value] of [[0x4300, 0x2200], [0x4302, 0x1234], [0x4305, 32], [0x1CDA, 0]]) assert.equal(word(data, base + offset), value);
    for (const [offset, value] of [[0x2121, 0x80], [0x4304, 0x8B], [0x420B, 1], [0x2120, 0xA5], [0x2122, 0x5A], [0x4307, 0xCC]])
      assert.equal(data.readByte(base + offset).value, value);
    if (bank === 0x7F) assert.equal(data.readByte(0x7E1CDA).available, false);
  }
});

test('Inner80C4 reads prior shared writes and consumes a shared budget; only outer finish may commit', () => {
  const data = fixture({ index: 0, writeWindows: [...windows, [0x7E1CDC, 0x7E1CDD]] });
  const before = data.snapshot(), view = prepareRenderView(data); view.write(0x1CDC, 0x14);
  const budget = { work: 3, maxWork: 14 }, inner = render80C4(view, entry, budget);
  assert.equal(inner.palette, 0x34); assert.equal(inner.x, 0x14); assert.equal(inner.work, 14); assert.equal(budget.work, 14);
  assert.throws(() => data.commit(inner), /Invalid render plan/); assert.deepEqual(data.snapshot(), before);
  commit(data, view.finish(inner)); assert.equal(word(data, 0x1CDC), 0x14); assert.equal(word(data, 0x1CDA), 0);
  const lateData = fixture({ palette: null, writeWindows: [...windows, [0x7E1CDE, 0x7E1CDF]] }), lateBefore = lateData.snapshot();
  const lateView = prepareRenderView(lateData); lateView.write(0x1CDE, 0xA5);
  assert.throws(() => render80C4(lateView, entry, { work: 0, maxWork: 11 }),
    e => e.renderBoundary && e.reason === 'render_source_required' && e.phase === 'palette');
  assert.deepEqual(lateData.snapshot(), lateBefore);
});

test('Invalid contexts and immutable/stale/foreign/copied plans cannot mutate their data owner', () => {
  const data = fixture();
  for (const options of [{ bank: null }, { status: null }, { status: 8 }, { status: 16 }, { status: 32 }, { emulation: 1 }, { directPage: 1 }])
    unchanged(data, options, 'render_entry_required');
  unchanged(data, { bank: 0x40 }, 'render_address_required', 'gate');
  for (const options of [{ bank: 256 }, { status: -1 }, { x: 65536 }, { y: -1 }, { maxWork: 0 }, { ioMode: 'execute' }])
    assert.throws(() => prepare(data, options), /Invalid render/);
  const p = prepare(data); assert.throws(() => { p.ioWrites[0].value = 0; }, TypeError);
  assert.throws(() => { p.byteWrites[0][1] = 255; }, TypeError); assert.throws(() => { p.operations.push({}); }, TypeError);
  assert.throws(() => fixture().commit(p), /Invalid render plan/); assert.throws(() => data.commit({ ...p }), /Invalid render plan/);
  data.seed(0x1CC6, [1]); const before = data.snapshot();
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), before);
});

test('Six synthetic probes reproduce gate, asymmetric X2 size, oddindex, live pendingalias and ROMbyte', () => {
  assert.equal(report.probes.length, 6);
  for (const probe of report.probes) {
    const f = probe.fixture, data = f.pointer === 0 ? fixture({ pointer: 0, index: null, size: null, palette: null })
      : fixture({ ...f, palette: f.palette ?? null });
    const p = prepare(data);
    for (const key of ['handled', 'outcome', 'a', 'x', 'y', 'bank', 'status', 'carry', 'overflow', 'pointer', 'size', 'palette', 'paletteAddress', 'work', 'operations', 'ioWrites', 'byteWrites', 'readAddresses'])
      assert.deepEqual(p[key], probe[key]);
  }
});
