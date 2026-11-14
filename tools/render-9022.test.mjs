import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRender9022, render9022 } from '../proof/render/fields-9022.mjs';
import { render8F20 } from '../proof/render/rows-8f20.mjs';
import { fields9022Entry as entry, fields9022Fixture as fixture, fields9022Bytes as fields,
  fields9022Windows as windows } from './render-9022-fixtures.mjs';
import { rows8F20Bytes, rows8F20Windows } from './render-8f20-fixtures.mjs';
import { cpuToOffset } from './rom.mjs';
const prepare = (data, options = {}) => prepareRender9022({ ...entry, data, ...options });
const word = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false, JSON.stringify(p)); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.compositionPhase, phase);
  for (const k of ['operations', 'ioWrites', 'byteWrites']) assert.equal(p[k], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}

test('Native9022 pins60/25 root,45/18 actual8FF5 and4-byte closedstack proof separately from11 synthetic probes', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const report = JSON.parse(await readFile(new URL('../analysis/render-9022-native.json', import.meta.url), 'utf8'));
  for (const [window, start, end, count, hash] of [[report.source, 0x809022, 0x80905E, 25,
    'df603c3d7538b57c99b2a2908d34723961a75005edbe85b77b69c3e3b04c29c1'], [report.helperSource, 0x808FF5, 0x809022, 18,
    'c1fc51d93929dd0a4fbabfc2fd22a93230285adefc8ac7a669f178682e1a3f54']]) {
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash);
    assert.equal(window.machine_bytes, raw.toString('hex').toUpperCase()); assert.equal(window.instruction_count, count);
  }
  assert.equal(report.stackProof.minimum_protected_stack_bytes, 4); assert.equal(report.stackProof.external_return_assumptions, 0);
  assert.match(report.scope, /synthetic/); assert.match(report.scope, /No CPU\/device/); assert.equal(report.probes.length, 11);
  assert.deepEqual(report.probes.map(p => p.handled), [true, true, true, true, true, false, false, false, false, false, false]);
});

test('Exact prefix/sole8FF5/128 BYTE/16 WORD/tail sequence follows actual waitreturn with one outercommit', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data); assert.ok(p.handled);
  assert.deepEqual(data.snapshot(), before); assert.equal(p.work, 157); assert.equal(p.outputBytes, 168);
  assert.equal(p.fieldOutputBytes, 164); assert.equal(p.byteWrites.length, 167); assert.equal(p.ioWrites.length, 6);
  assert.deepEqual(p.operations.slice(0, 11).map(e => [e.kind, e.space, e.address & 65535, e.value, e.bytes]), [
    ['write', 'data', 0x142, 0x91, 2], ['write', 'io', 0x4305, 0x1000, 2], ['write', 'io', 0x4302, 0x5250, 2],
    ['write', 'io', 0x4304, 0x7F, 1], ['write', 'io', 0x4301, 0x18, 1], ['write', 'io', 0x2115, 0x80, 1],
    ['write', 'io', 0x4300, 1, 1], ['write', 'data', 0x140, 0, 2], ['read', 'data', 0x140, 0, 2],
    ['write', 'external', 0x140, 0x8001, 2], ['read', 'data', 0x140, 0x8001, 2]]);
  assert.deepEqual(p.operations.slice(11, 139).map(e => [e.address, e.value, e.bytes]),
    Array.from({ length: 128 }, (_, n) => [0x7E3F05 - n * 4, 0xF0, 1]));
  assert.deepEqual(p.operations.slice(139, 155).map(e => [e.address, e.value, e.bytes]),
    Array.from({ length: 16 }, (_, n) => [0x7E3F26 - n * 2, 0, 2]));
  assert.deepEqual(p.operations.slice(155).map(e => [e.address, e.value, e.bytes]), [[0x7E3D0C, 0x83A6, 2], [0x7E3D0E, 0x3200, 2]]);
  assert.equal(p.observed, 0x8001); assert.equal(p.polls, 2); assert.equal(p.a, 0x3200); assert.equal(p.x, 0xFFFE);
  assert.equal(p.y, entry.y); assert.equal(p.status, 0x45); assert.equal(p.bank, entry.bank);
  assert.deepEqual(data.commit(p), { handled: true }); assert.equal(word(data, 0x142), 0x91);
});

test('All65536 surrounding7E bytes stay unchanged except exactfields/metadata; later3D0D=83 replaces BYTEF0', () => {
  const data = fixture(), initial = Uint8Array.from({ length: 65536 }, (_, n) => (n * 13 + (n >>> 8) * 37) & 255);
  data.seed(0x7E0000, initial); const p = prepare(data), expected = new Map(); assert.ok(p.handled);
  for (let n = 0; n < 128; n++) expected.set(0x3F05 - n * 4, 0xF0);
  for (let a = 0x3F08; a <= 0x3F27; a++) expected.set(a, 0);
  for (const [a, v] of [[0x3D0C, 0xA6], [0x3D0D, 0x83], [0x3D0E, 0], [0x3D0F, 0x32],
    [0x140, 1], [0x141, 0x80], [0x142, 0x91], [0x143, 0]]) expected.set(a, v);
  assert.equal(expected.size, 167);
  assert.deepEqual(p.operations.filter(e => e.address === 0x7E3D0D || e.address === 0x7E3D0C).map(e => e.value), [0xF0, 0x83A6]);
  assert.deepEqual(data.commit(p), { handled: true });
  for (let a = 0; a < 65536; a++) assert.equal(data.readByte(0x7E0000 + a).value, expected.get(a) ?? initial[a]);
});

test('All32768 negativepoll words return fixedA/X/finalNZ; BYTEhighA never leaks into fields', () => {
  const data = fixture();
  for (let observed = 32768; observed <= 65535; observed++) {
    const p = prepare(data, { waitRead0140: [observed] });
    assert.ok(p.handled); assert.equal(p.observed, observed); assert.equal(p.a, 0x3200); assert.equal(p.x, 0xFFFE);
    assert.equal(p.status, 0x45); assert.equal(p.work, 156); assert.equal(p.outputBytes, 168);
    assert.equal(p.operations[10].value, 0xF0); assert.equal(p.operations[10].bytes, 1);
  }
});

test('All32768 nonnegativepoll words includingzero hold the entirebody before fieldwrites', () => {
  const data = fixture();
  for (let value = 0; value < 32768; value++) {
    const p = prepare(data, { waitRead0140: [value] });
    assert.equal(p.handled, false); assert.equal(p.reason, 'render_wait_read_required');
    assert.equal(p.compositionPhase, 'setupWait'); assert.equal(p.polls, 1); assert.equal(p.byteWrites, undefined);
  }
  assert.deepEqual(data.snapshot(), fixture().snapshot());
});

test('65536 changingnonnegative observations thennegative return retain the entirechronology andlate atomicity', () => {
  const data = fixture(), waitRead0140 = [...Array.from({ length: 65536 }, (_, n) => n & 1), 0x8001];
  const p = prepare(data, { waitRead0140, maxWork: 131227 }); assert.ok(p.handled);
  assert.equal(p.polls, 65537); assert.equal(p.work, 131227); assert.equal(p.operations.length, 131227);
  assert.equal(p.outputBytes, 168); assert.equal(p.observed, 0x8001); assert.equal(p.operations.at(-1).address, 0x7E3D0E);
  unchanged(data, { waitRead0140, maxWork: 131226 }, 'render_work_budget_required', 'tail');
});

test('All256 DBRs keep fixedlong7E fields,128 request banks and2 physicalsetup banks; others stop at prefix', () => {
  for (let bank = 0; bank <= 255; bank++) {
    const data = fixture({ bank }), p = prepare(data, { bank, waitRead0140: [0xFFFF] });
    if (!(bank & 0x40) || bank === 0x7E || bank === 0x7F) {
      assert.ok(p.handled); assert.equal(p.bank, bank); assert.equal(p.work, 156);
      assert.equal(p.outputBytes, bank === 0x7E || bank === 0x7F ? 176 : 168);
      assert.equal(p.ioWrites.length, bank === 0x7E || bank === 0x7F ? 0 : 6);
      assert.ok(p.operations.filter(e => ['byteFields', 'wordFields', 'tail'].includes(e.phase)).every(e => e.address >>> 16 === 0x7E));
    } else { assert.equal(p.handled, false); assert.equal(p.reason, 'render_address_required'); assert.equal(p.compositionPhase, 'prefix'); }
  }
});

test('DBR7F metadata/setup is separate from fixedlong7E fields and retains unrelated7E/7F bytes', () => {
  const data = fixture({ bank: 0x7F }); data.seed(0x7E0140, [0xAA, 0xBB, 0xCC, 0xDD]); data.seed(0x7F3D0C, [1, 2, 3, 4]);
  const p = prepare(data, { bank: 0x7F, ioMode: null }); assert.ok(p.handled); assert.deepEqual(p.ioWrites, []);
  assert.deepEqual(data.commit(p), { handled: true }); assert.equal(word(data, 0x7F0142), 0x91); assert.equal(word(data, 0x7F0140), 0x8001);
  assert.equal(word(data, 0x7E0140), 0xBBAA); assert.equal(word(data, 0x7E0142), 0xDDCC);
  assert.equal(word(data, 0x7F3D0C), 0x0201); assert.equal(word(data, 0x7E3D0C), 0x83A6);
});

test('Everyvalidstatus preservesC/V/I/Y/DBR and returns finalN0/Z0 despite negativepoll/X', () => {
  for (let status = 0; status < 256; status++) if (!(status & 0x38)) for (const y of [null, 0, 0xFFFF]) {
    const p = prepare(fixture(), { status, y }); assert.ok(p.handled);
    assert.equal(p.status, status & ~0x82); assert.equal(p.carry, status & 1); assert.equal(p.overflow, status >>> 6 & 1);
    assert.equal(p.y, y); assert.equal(p.a, 0x3200); assert.equal(p.x, 0xFFFE);
  }
});

test('Previouslynegative0140 is overwritten byX0; no observations or nonnegative exhaustion rolls backprefix/setup', () => {
  for (const initial of [0x8000, 0xFFFF]) {
    const data = fixture({ initial });
    unchanged(data, { waitRead0140: null, waitMode: null, maxWork: 20 }, 'render_work_budget_required', 'setupWait');
    unchanged(data, { waitRead0140: [0, 0x7FFF] }, 'render_wait_read_required', 'setupWait');
    unchanged(data, { waitRead0140: [] }, 'render_wait_read_required', 'setupWait');
  }
});

test('No transferbuffer, incomingA/X, DPpointer or originalfield bytes required;420B not requested', () => {
  const data = fixture(), p = prepare(data); assert.ok(p.handled);
  assert.deepEqual(p.readAddresses, [0x7E0140, 0x7E0141]);
  assert.ok(p.operations.every(e => (e.address & 65535) !== 0x420B)); assert.equal(data.readByte(0x7F5250).available, false);
  for (const k of ['transferComplete', 'dmaComplete', 'callbackComplete', 'scene']) assert.equal(p[k], undefined);
});

test('Every one of167 requiredsystem WRAMbyte permissions fails atomically at its actualbodyphase', () => {
  const addresses = [...fields, 0x7E0140, 0x7E0141, 0x7E0142, 0x7E0143];
  for (const missing of addresses) {
    const writeWindows = addresses.filter(a => a !== missing).map(a => [a, a]);
    const p = unchanged(fixture({ writeWindows }), {}, 'render_write_window_required'); assert.equal(p.address, missing);
    if (missing === 0x7E0142 || missing === 0x7E0143) assert.equal(p.compositionPhase, 'prefix');
    else if (missing < 0x7E2000) assert.equal(p.compositionPhase, 'setupWait');
    else assert.ok(['byteFields', 'wordFields', 'tail'].includes(p.compositionPhase));
  }
});

test('All8 additionalphysicalsetup bytepermissions fail atomically before fields, preserving fullprefix', () => {
  for (const bank of [0x7E, 0x7F]) for (const offset of [0x4305, 0x4306, 0x4302, 0x4303, 0x4304, 0x4301, 0x2115, 0x4300]) {
    const base = bank * 65536, writeWindows = windows(bank).flatMap(([a, b]) => {
      if (base + offset < a || base + offset > b) return [[a, b]];
      return [...(a < base + offset ? [[a, base + offset - 1]] : []), ...(b > base + offset ? [[base + offset + 1, b]] : [])];
    });
    const p = unchanged(fixture({ bank, writeWindows }), { bank, ioMode: null }, 'render_write_window_required', 'setupWait');
    assert.equal(p.address, base + offset); assert.equal(p.calleeCaller, '8FF5');
  }
});

test('Every156 incompletework prefixes and exact157 succeed onlyat fullouter completion', () => {
  const data = fixture();
  for (let maxWork = 1; maxWork < 157; maxWork++) unchanged(data, { maxWork }, 'render_work_budget_required');
  assert.equal(prepare(data, { maxWork: 157 }).work, 157);
  for (const [maxWork, phase] of [[10, 'setupWait'], [138, 'byteFields'], [154, 'wordFields'], [155, 'tail'], [156, 'tail']])
    unchanged(data, { maxWork }, 'render_work_budget_required', phase);
});

test('Allsystem/physical nativeoutput prefixes reject; exact168/176 budgets include overwrittentail bytes', () => {
  for (const bank of [0x80, 0x7F]) {
    const data = fixture({ bank }), expected = bank === 0x7F ? 176 : 168;
    for (let maxOutputBytes = 1; maxOutputBytes < expected; maxOutputBytes++)
      unchanged(data, { bank, maxOutputBytes }, 'render_output_budget_required');
    assert.equal(prepare(data, { bank, maxOutputBytes: expected }).outputBytes, expected);
  }
});

test('Final3D0F permission or output/workbudget failure withholds every earlierfield and allsix requests', () => {
  unchanged(fixture({ writeWindows: windows().filter(([a]) => a !== 0x7E3D0F) }), {}, 'render_write_window_required', 'tail');
  unchanged(fixture(), { maxWork: 156 }, 'render_work_budget_required', 'tail');
  unchanged(fixture(), { maxOutputBytes: 167 }, 'render_output_budget_required', 'tail');
});

test('Four protected root/helperJSR bytes required; prefix/publish/eachfield/late tailstack alias rolls back', () => {
  for (const stackWindow of [null, [0x1FFD, 0x1FFF], [0x1FFF, 0x1FFF]]) unchanged(fixture(), { stackWindow }, 'render_stack_required');
  unchanged(fixture(), { stackWindow: [0x142, 0x145] }, 'render_stack_alias_required', 'prefix');
  unchanged(fixture(), { stackWindow: [0x13D, 0x140] }, 'render_stack_alias_required', 'setupWait');
  for (const address of fields) unchanged(fixture(), { stackWindow: [address & 65535, (address & 65535) + 3] }, 'render_stack_alias_required');
  unchanged(fixture({ bank: 0x7E }), { bank: 0x7E, stackWindow: [0x4305, 0x4308] }, 'render_stack_alias_required', 'setupWait');
  assert.ok(prepare(fixture({ bank: 0x7F }), { bank: 0x7F, stackWindow: [0x140, 0x143] }).handled);
});

test('Explicit I/O/waitmode boundaries and malformed machine/context declarations remain no-effect', () => {
  unchanged(fixture(), { ioMode: null }, 'render_io_context_required', 'setupWait');
  unchanged(fixture(), { waitMode: null }, 'render_wait_context_required', 'setupWait');
  for (const options of [{ bank: null }, { status: null }, { status: 8 }, { status: 0x10 }, { status: 0x20 },
    { emulation: 1 }, { directPage: 1 }]) unchanged(fixture(), options, 'render_entry_required');
  for (const options of [{ y: 65536 }, { y: -1 }, { ioMode: 'execute' }, { waitMode: 'execute' },
    { waitRead0140: Array(2) }, { waitRead0140: [65536] }, { maxWork: 0 }, { maxOutputBytes: 0 }]) assert.throws(() => prepare(fixture(), options));
});

test('Foreign/copied/stale/replayed plans never mutate owner bytes or publish requests', () => {
  const data = fixture(), other = fixture(), p = prepare(data);
  assert.throws(() => other.commit(p)); assert.throws(() => data.commit({ ...p }));
  data.seed(0x200, [0xAA]); const before = data.snapshot();
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), before);
  const fresh = prepare(data); assert.deepEqual(data.commit(fresh), { handled: true });
  assert.deepEqual(data.commit(fresh), { handled: false, reason: 'render_plan_stale' });
});

test('Two realinner9022 calls consume one globaltranscript, share freshwrites/budgets and one outercommit', () => {
  const data = fixture(), before = data.snapshot(), view = prepareRenderView(data, [0x7E1FF8, 0x7E1FFF]);
  const observations = {}, budget = { work: 0, maxWork: 313, outputBytes: 0, maxOutputBytes: 336 };
  const context = { ...entry, waitRead0140: [0, 0x8001, 0x8002, 0x8003], observations };
  const first = render9022(view, context, budget), second = render9022(view, context, budget);
  assert.equal(first.polls, 2); assert.equal(second.polls, 1); assert.equal(second.observed, 0x8002);
  assert.equal(second.waitPolls0140, 3); assert.equal(second.work, 313); assert.equal(second.outputBytes, 336);
  assert.equal(view.read(0x7E3D0D), 0x83); assert.throws(() => data.commit(first)); assert.throws(() => data.commit(second));
  assert.deepEqual(data.snapshot(), before); const p = view.finish({ ...second, operations: [...first.operations, ...second.operations] });
  assert.deepEqual(data.commit(p), { handled: true }); assert.equal(word(data, 0x140), 0x8002);
});

test('Late secondinner9022 failures withhold firstfields and allpreviousrequests under cumulativebudgets', () => {
  const data = fixture(), before = data.snapshot();
  for (const [limits, reason] of [[{ maxWork: 311 }, 'render_work_budget_required'], [{ maxOutputBytes: 335 }, 'render_output_budget_required']]) {
    const view = prepareRenderView(data, [0x7E1FF8, 0x7E1FFF]), observations = {};
    const budget = { work: 0, maxWork: 312, outputBytes: 0, maxOutputBytes: 336, ...limits };
    const context = { ...entry, waitRead0140: [0x8001, 0x8002], observations };
    render9022(view, context, budget);
    assert.throws(() => render9022(view, context, budget), e => e.renderBoundary && e.reason === reason && e.compositionPhase === 'tail');
    assert.deepEqual(data.snapshot(), before);
  }
});

test('Actual inner8F20 followedby9022 shares bytes/budgets; late9022 tail cannot publish prior copiedrows', () => {
  // Synthetic caller checks the existing actualroutines, not full936C/9F6D initialization.
  for (const maxWork of [3739, 3740]) {
    const data = createRenderData({ writeWindows: [...rows8F20Windows, ...windows()] }); data.seed(0x7F5350, rows8F20Bytes);
    const before = data.snapshot(), view = prepareRenderView(data, [0x7E1FFC, 0x7E1FFF]);
    const budget = { work: 0, maxWork, outputBytes: 0, maxOutputBytes: 1960 };
    const rows = render8F20(view, entry, budget);
    if (maxWork === 3739) {
      assert.throws(() => render9022(view, { ...entry, ...rows, waitRead0140: [0x8001] }, budget), e => e.renderBoundary && e.compositionPhase === 'tail');
      assert.deepEqual(data.snapshot(), before);
    } else {
      const fields = render9022(view, { ...entry, ...rows, waitRead0140: [0x8001] }, budget);
      assert.equal(fields.work, 3740); assert.equal(fields.outputBytes, 1960); assert.equal(fields.y, 0x544F);
      assert.equal(fields.carry, 1); assert.equal(fields.overflow, 0); assert.equal(fields.status, 5);
      assert.deepEqual(data.commit(view.finish(fields)), { handled: true }); assert.equal(word(data, 0x7E3D0C), 0x83A6);
      assert.equal(data.readByte(0x7F5450).value, rows8F20Bytes[0]);
    }
  }
});
