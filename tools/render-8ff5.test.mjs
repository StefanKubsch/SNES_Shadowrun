import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRender8FF5, render8FF5 } from '../proof/render/setup-8ff5.mjs';
import { setup8FF5Entry as entry, setup8FF5Fixture as fixture } from './render-8ff5-fixtures.mjs';
import { cpuToOffset } from './rom.mjs';

const prepare = (data, options = {}) => prepareRender8FF5({ ...entry, data, ...options });
const word = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
const stores = [[0x4305, 0x1000, 2], [0x4302, 0x5250, 2], [0x4304, 0x7F, 1],
  [0x4301, 0x18, 1], [0x2115, 0x80, 1], [0x4300, 1, 1]];
const setupBytes = [[0x4305, 0], [0x4306, 0x10], [0x4302, 0x50], [0x4303, 0x52],
  [0x4304, 0x7F], [0x4301, 0x18], [0x2115, 0x80], [0x4300, 1]];
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false, JSON.stringify(p)); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  for (const k of ['operations', 'ioWrites', 'byteWrites']) assert.equal(p[k], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}

test('8FF5 probe pins original45/18 and independent2-byte stack proof separately from11 synthetic probes', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const report = JSON.parse(await readFile(new URL('../analysis/render-8ff5-native.json', import.meta.url), 'utf8'));
  const raw = rom.subarray(cpuToOffset(0x808FF5, rom.length), cpuToOffset(0x809022, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), 'c1fc51d93929dd0a4fbabfc2fd22a93230285adefc8ac7a669f178682e1a3f54');
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase());
  assert.equal(report.source.covered_bytes, 45); assert.equal(report.source.instruction_count, 18);
  assert.equal(report.stackProof.minimum_protected_stack_bytes, 2); assert.equal(report.stackProof.external_return_assumptions, 0);
  assert.equal(report.probes.length, 11); assert.match(report.scope, /synthetic/); assert.match(report.scope, /No CPU\/device/);
  assert.deepEqual(report.probes.map(p => p.handled), [true, true, true, true, true, false, false, false, false, false, false]);
});

test('Six ordered setupstores precede fullX publication and all fresh polls including zero', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data);
  assert.ok(p.handled); assert.deepEqual(data.snapshot(), before);
  assert.deepEqual(p.operations.map(e => [e.kind, e.space, e.address & 65535, e.value, e.bytes]), [
    ...stores.map(([a, v, b]) => ['write', 'io', a, v, b]), ['write', 'data', 0x140, 0x1234, 2],
    ['read', 'data', 0x140, 0x1234, 2], ['write', 'external', 0x140, 0, 2],
    ['read', 'data', 0x140, 0, 2], ['write', 'external', 0x140, 0x8001, 2], ['read', 'data', 0x140, 0x8001, 2]]);
  assert.equal(p.work, 12); assert.equal(p.outputBytes, 2); assert.equal(p.polls, 3); assert.equal(p.a, 0x8001);
  assert.equal(p.status, 0xC5); assert.equal(p.x, entry.x); assert.equal(p.y, entry.y);
  assert.deepEqual(p.readAddresses, [0x7E0140, 0x7E0141]); assert.deepEqual(p.byteWrites, [[0x7E0140, 1], [0x7E0141, 128]]);
  assert.deepEqual(data.commit(p), { handled: true }); assert.equal(word(data, 0x140), 0x8001);
});

test('All65536 fullX words are published before poll, only negativeX can return without observations', () => {
  const data = fixture();
  for (let x = 0; x <= 65535; x++) {
    const p = prepare(data, { x, waitRead0140: null, waitMode: null, maxWork: 8, maxOutputBytes: 2 });
    if (x < 32768) {
      assert.equal(p.handled, false); assert.equal(p.reason, 'render_work_budget_required'); assert.equal(p.phase, 'wait'); assert.equal(p.polls, 1);
    } else {
      assert.ok(p.handled); assert.equal(p.a, x); assert.equal(p.x, x); assert.equal(p.polls, 1); assert.equal(p.work, 8);
      assert.equal(p.operations[6].value, x); assert.equal(p.operations[7].value, x); assert.equal(p.status, 0xC5);
    }
  }
  assert.deepEqual(data.snapshot(), fixture().snapshot());
});

test('All65536 observedWORD values use signedBPL; zero/positive require further observations', () => {
  const data = fixture();
  for (let value = 0; value <= 65535; value++) {
    const p = prepare(data, { x: 0, waitRead0140: [value], maxWork: 9 });
    if (value < 32768) {
      assert.equal(p.handled, false); assert.equal(p.reason, 'render_wait_read_required'); assert.equal(p.polls, 1);
    } else {
      assert.ok(p.handled); assert.equal(p.a, value); assert.equal(p.polls, 1); assert.equal(p.work, 9);
      assert.equal(p.status & 0x82, 0x80);
    }
  }
});

test('Previouslynegative0140 never bypasses overwritten X0 or exhausted wait transcript', () => {
  for (const initial of [0x8000, 0xFFFF]) {
    const data = fixture({ initial });
    unchanged(data, { x: 0, waitRead0140: [0, 0x7FFF] }, 'render_wait_read_required', 'wait');
    unchanged(data, { x: 0, waitRead0140: null, maxWork: 10 }, 'render_work_budget_required', 'wait');
    const p = prepare(data, { x: 0, waitRead0140: [0, 0xFFFF] });
    assert.equal(p.operations[6].value, 0); assert.equal(p.operations[7].value, 0); assert.equal(p.polls, 2);
  }
});

test('Everyvalid P preserves C/V/I, WORD modes and DBR/X/Y; replaces only N/Z from actual poll', () => {
  for (let status = 0; status < 256; status++) if (!(status & 0x38)) {
    const p = prepare(fixture(), { status, x: 0xFFFF, waitRead0140: [0xFFFF], y: 0 });
    assert.ok(p.handled); assert.equal(p.status, (status & ~0x82) | 0x80);
    assert.equal(p.carry, status & 1); assert.equal(p.overflow, status >>> 6 & 1);
    assert.equal(p.x, 0xFFFF); assert.equal(p.y, 0); assert.equal(p.bank, entry.bank);
  }
});

test('All256 DBRs distinguish128 system request banks, physical7E/7F bytes and126 unsupported banks', () => {
  for (let bank = 0; bank <= 255; bank++) {
    const data = fixture({ bank }), p = prepare(data, { bank, x: 0x8000, waitRead0140: null });
    if (!(bank & 0x40)) {
      assert.ok(p.handled); assert.deepEqual(p.ioWrites.map(e => [e.address, e.value, e.bytes]),
        stores.map(([a, v, b]) => [bank * 65536 + a, v, b]));
      assert.deepEqual(p.byteWrites, [[0x7E0140, 0], [0x7E0141, 128]]); assert.equal(p.outputBytes, 2);
    } else if (bank === 0x7E || bank === 0x7F) {
      assert.ok(p.handled); assert.deepEqual(p.ioWrites, []); assert.equal(p.outputBytes, 10);
    } else {
      assert.equal(p.handled, false); assert.equal(p.reason, 'render_address_required'); assert.equal(p.address, bank * 65536 + 0x4305);
    }
  }
});

test('Physical7E/7F setup writes exact10 bytes, retain surrounding bytes and require no I/O mode', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 65536, data = fixture({ bank });
    data.seed(base + 0x4300, Array(9).fill(0xAA)); data.seed(base + 0x2114, [0xAA, 0xAA, 0xAA]);
    const p = prepare(data, { bank, ioMode: null, x: 0xABCD, waitRead0140: null });
    assert.ok(p.handled); assert.equal(p.work, 8); assert.equal(p.outputBytes, 10); assert.deepEqual(p.ioWrites, []);
    assert.equal(p.operations[6].address, base + 0x140); assert.equal(p.a, 0xABCD); assert.deepEqual(data.commit(p), { handled: true });
    for (const [a, v] of setupBytes) assert.equal(data.readByte(base + a).value, v);
    for (const a of [0x4307, 0x4308, 0x2114, 0x2116]) assert.equal(data.readByte(base + a).value, 0xAA);
    assert.equal(word(data, base + 0x140), 0xABCD);
  }
});

test('No preexisting sourcebytes, incomingA, sourcebuffer, DPpointer,0142, or420B start needed', () => {
  const data = fixture(), p = prepare(data, { x: 0x8000, waitRead0140: null }); assert.ok(p.handled);
  assert.deepEqual(p.readAddresses, [0x7E0140, 0x7E0141]);
  for (const a of [0x142, 0xF6, 0xF7, 0xF8, 0x7F5250]) assert.equal(data.readByte(a).available, false);
  assert.ok(p.operations.every(e => (e.address & 65535) !== 0x420B));
  for (const k of ['transferComplete', 'dmaComplete', 'callbackComplete']) assert.equal(p[k], undefined);
});

test('Each missing publishbyte rejects late after six requests and withholds all effects', () => {
  for (const writeWindows of [[], [[0x7E0140, 0x7E0140]], [[0x7E0141, 0x7E0141]]])
    unchanged(fixture({ writeWindows }), {}, 'render_write_window_required', 'publish');
});

test('All10 missing physical destinationbyte windows fail at reached phase without prefix effects', () => {
  for (const bank of [0x7E, 0x7F]) for (const [missing] of [...setupBytes, [0x140, 0], [0x141, 0]]) {
    const base = bank * 65536, writeWindows = [...setupBytes, [0x140, 0], [0x141, 0]]
      .filter(([a]) => a !== missing).map(([a]) => [base + a, base + a]);
    const p = unchanged(fixture({ bank, writeWindows }), { bank, ioMode: null },
      'render_write_window_required', missing < 0x2000 ? 'publish' : 'setup');
    assert.equal(p.address, base + missing);
  }
});

test('Everywork prefix through final externalwrite/read rejects atomically, exact12 succeeds', () => {
  const data = fixture();
  for (let maxWork = 1; maxWork < 12; maxWork++)
    unchanged(data, { maxWork }, 'render_work_budget_required', maxWork < 6 ? 'setup' : maxWork === 6 ? 'publish' : 'wait');
  assert.equal(prepare(data, { maxWork: 12 }).work, 12);
});

test('All native outputbudget prefixes and exact2/system,10/physical bytes, external observations excluded', () => {
  unchanged(fixture(), { maxOutputBytes: 1 }, 'render_output_budget_required', 'publish');
  assert.equal(prepare(fixture(), { maxOutputBytes: 2 }).outputBytes, 2);
  for (let maxOutputBytes = 1; maxOutputBytes < 10; maxOutputBytes++)
    unchanged(fixture({ bank: 0x7F }), { bank: 0x7F, maxOutputBytes }, 'render_output_budget_required', maxOutputBytes < 8 ? 'setup' : 'publish');
  assert.equal(prepare(fixture({ bank: 0x7F }), { bank: 0x7F, maxOutputBytes: 10 }).outputBytes, 10);
});

test('Empty/exhausted/trailing observations have exact chronology; unchanged samples add no externalwrites', () => {
  unchanged(fixture(), { waitRead0140: [] }, 'render_wait_read_required', 'wait');
  const p = prepare(fixture(), { x: 0, waitRead0140: [0, 0, 1, 1, 0, 0x8000, 7] });
  assert.equal(p.polls, 6); assert.equal(p.waitPolls0140, 6); assert.equal(p.work, 16); assert.equal(p.a, 0x8000);
  assert.deepEqual(p.operations.filter(e => e.space === 'external').map(e => e.value), [1, 0, 0x8000]);
});

test('Late transcript exhaustion after32768 fresh zero polls rolls back allsetup/publication', () => {
  const p = unchanged(fixture(), { x: 0, waitRead0140: Array(32768).fill(0) }, 'render_wait_read_required', 'wait');
  assert.equal(p.polls, 32768);
});

test('Explicit I/O and observation modes are required only when reached; native negativeX needs no waitmode', () => {
  unchanged(fixture(), { ioMode: null }, 'render_io_context_required', 'setup');
  unchanged(fixture(), { waitMode: null }, 'render_wait_context_required', 'wait');
  assert.ok(prepare(fixture(), { x: 0x8000, waitMode: null, waitRead0140: null }).handled);
});

test('Two protected rootJSR bytes suffice; smaller/missing stack or0140 alias rejects atomically', () => {
  assert.ok(prepare(fixture()).handled);
  for (const stackWindow of [null, [0x1FFF, 0x1FFF], [0x2000, 0x1FFF]])
    unchanged(fixture(), { stackWindow }, 'render_stack_required');
  for (const stackWindow of [[0x13F, 0x140], [0x140, 0x141], [0x141, 0x142]])
    unchanged(fixture(), { stackWindow }, 'render_stack_alias_required', 'publish');
  for (const [offset] of setupBytes) unchanged(fixture({ bank: 0x7E }),
    { bank: 0x7E, stackWindow: [offset, offset + 1] }, 'render_stack_alias_required', 'setup');
  assert.ok(prepare(fixture({ bank: 0x7F }), { bank: 0x7F, stackWindow: [0x140, 0x141] }).handled);
});

test('Entry requires WORDX, binaryWORD modes/E0/D0/actualDBR; malformed contexts throw', () => {
  for (const options of [{ x: null }, { bank: null }, { status: null }, { status: 8 }, { status: 0x10 },
    { status: 0x20 }, { emulation: 1 }, { directPage: 1 }]) unchanged(fixture(), options, 'render_entry_required');
  for (const options of [{ x: -1 }, { x: 65536 }, { y: -1 }, { bank: 256 }, { maxWork: 0 },
    { maxOutputBytes: 0 }, { ioMode: 'execute' }, { waitMode: 'execute' }, { waitRead0140: [65536] },
    { waitRead0140: [null] }, { waitRead0140: Array(2) }, { waitRead0140: '8000' }])
    assert.throws(() => prepare(fixture(), options));
  assert.ok(prepare(fixture(), { y: null }).handled);
});

test('Foreign, copied, replayed and stale plans cannot change state', () => {
  const data = fixture(), other = fixture(), p = prepare(data), before = other.snapshot();
  assert.throws(() => other.commit(p)); assert.throws(() => data.commit({ ...p })); assert.deepEqual(other.snapshot(), before);
  data.seed(0x200, [3]); const seeded = data.snapshot();
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), seeded);
  const fresh = prepare(data); assert.deepEqual(data.commit(fresh), { handled: true });
  assert.deepEqual(data.commit(fresh), { handled: false, reason: 'render_plan_stale' });
});

function outer(data, options = {}) {
  // Explicitly synthetic caller, not an original9022/936C call graph.
  const view = prepareRenderView(data, [0x7E1FFC, 0x7E1FFF]);
  const budget = { work: 1, maxWork: 20, outputBytes: 1, maxOutputBytes: 5, ...options };
  const observations = {}, context = { ...entry, x: 0, waitRead0140: [0, 0x8001, 0x8002], observations };
  view.write(0x200, 0xA5);
  const first = render8FF5(view, context, budget), second = render8FF5(view, context, budget);
  assert.throws(() => data.commit(first)); assert.throws(() => data.commit(second));
  return view.finish({ ...second, operations: [...first.operations, ...second.operations], firstPolls: first.polls });
}

test('Two actual inner8FF5 calls consume one globaltranscript/budget and own one outercommit', () => {
  const data = fixture({ writeWindows: [[0x7E0140, 0x7E0141], [0x7E0200, 0x7E0200]] }), before = data.snapshot();
  const p = outer(data); assert.deepEqual(data.snapshot(), before);
  assert.equal(p.firstPolls, 2); assert.equal(p.polls, 1); assert.equal(p.waitPolls0140, 3);
  assert.equal(p.a, 0x8002); assert.equal(p.work, 20); assert.equal(p.outputBytes, 5);
  assert.deepEqual(p.operations.filter(e => e.kind === 'read').map(e => e.value), [0, 0x8001, 0x8002]);
  assert.deepEqual(data.commit(p), { handled: true }); assert.equal(word(data, 0x140), 0x8002); assert.equal(data.readByte(0x200).value, 0xA5);
});

test('Later second-call work/output failures withhold prior outerbyte and first-call effects', () => {
  const data = fixture({ writeWindows: [[0x7E0140, 0x7E0141], [0x7E0200, 0x7E0200]] }), before = data.snapshot();
  for (const [options, reason] of [[{ maxWork: 19 }, 'render_work_budget_required'], [{ maxOutputBytes: 4 }, 'render_output_budget_required']]) {
    assert.throws(() => outer(data, options), e => e.renderBoundary && e.reason === reason);
    assert.deepEqual(data.snapshot(), before);
  }
});

test('Fresh outer WRAMsetup writes are overwritten precisely; a later caller reads observed0140 alias', () => {
  const data = fixture({ bank: 0x7F }), view = prepareRenderView(data, [0x7E1FFE, 0x7E1FFF]);
  view.write(0x7F4305, 0xAA); view.write(0x7F4306, 0xBB);
  const p = render8FF5(view, { ...entry, bank: 0x7F, ioMode: null, x: 0, waitRead0140: [0xFEDC] },
    { work: 2, maxWork: 11, outputBytes: 2, maxOutputBytes: 12 });
  assert.equal(view.read(0x7F4305) | view.read(0x7F4306) << 8, 0x1000);
  assert.equal(view.read(0x7F0140) | view.read(0x7F0141) << 8, 0xFEDC);
  assert.equal(p.work, 11); assert.equal(p.outputBytes, 12); assert.equal(data.readByte(0x7F0140).available, false);
  assert.deepEqual(data.commit(view.finish(p)), { handled: true }); assert.equal(word(data, 0x7F0140), 0xFEDC);
});
