import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData } from '../src/render/data.mjs';
import { createOriginalRenderData } from '../proof/render/original-data.mjs';
import { seedOriginalAA9CData } from '../proof/render/original-aa9c-data.mjs';
import { seedOriginalAF1FData } from '../proof/render/original-af1f-data.mjs';
import { prepareRenderAA9C } from '../proof/render/aa9c.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const unpackAsset = await load('render-unpack-data'), asset = await load('render-aa9c-data'), afAsset = await load('render-af1f-data');
const a9b2Report = JSON.parse(await readFile(new URL('../analysis/render-a9b2-native.json', import.meta.url), 'utf8'));
const report = JSON.parse(await readFile(new URL('../analysis/render-aa9c-native.json', import.meta.url), 'utf8'));
const fields = [[0x7E0214, 0x7E0215], [0x7E01F4, 0x7E01F5], [0x7E01FE, 0x7E01FF]];
const windows = [...fields, [0x7E23A0, 0x7E2ADF]];
const entry = { request: 0, bank: 0x80, status: 0, emulation: 0, directPage: 0,
  stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const seedWord = (data, a, v) => data.seed(a, [v & 255, v >>> 8]);
const read = (data, a, n) => Array.from({ length: n }, (_, i) => {
  const r = data.readByte(a + i); assert.ok(r.available, (a + i).toString(16)); return r.value;
});
const digest = bytes => createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
function fixture({ writeWindows = windows, gate = 0 } = {}) {
  const data = createOriginalRenderData(unpackAsset, { writeWindows }); seedOriginalAA9CData(data, asset);
  seedWord(data, 0x7E0214, 0xFFFF); seedWord(data, 0x7E1D61, gate); return data;
}
const prepare = (data, options = {}) => prepareRenderAA9C({ ...entry, data, ...options });
function commit(data, p) { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.commit(p), { handled: true }); }
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), result = prepare(data, options);
  assert.equal(result.handled, false); assert.equal(result.reason, reason);
  if (phase) assert.equal(result.phase, phase);
  assert.deepEqual(data.snapshot(), before);
  for (const k of ['byteWrites', 'ioWrites', 'firstUnpack', 'second', 'palette']) assert.equal(result[k], undefined);
  return result;
}

test('AA9C sources are exactly original record7/palette6 ROM bytes without WRAM hydration', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  assert.equal(digest(rom), asset.romSha256);
  for (const w of [asset.record, asset.palette]) {
    assert.deepEqual([...rom.subarray(w.sourceRomOffset, w.sourceRomOffset + w.bytes.length)], w.bytes);
    assert.equal(digest(w.bytes), w.sha256);
  }
  const data = createRenderData(); seedOriginalAA9CData(data, asset);
  assert.equal(data.snapshot().bytes.length, 13); assert.equal(data.readByte(0x214).available, false);
  assert.equal(data.readByte(0x23A0).available, false);
});

test('Equal cache reads only its full WORD and preserves A/X/Y/V without stack or I/O context', () => {
  for (const status of [0, 1, 2, 4, 0x40, 0x80, 0xC7]) {
    const data = createRenderData(); seedWord(data, 0x214, 0xBEEF);
    const p = prepare(data, { request: 0xBEEF, status, stackWindow: null, ioMode: null, x: 0xFFFF, y: 0x1234 });
    assert.ok(p.handled); assert.equal(p.outcome, 'cache_equal'); assert.equal(p.a, 0xBEEF);
    assert.equal(p.x, 0xFFFF); assert.equal(p.y, 0x1234); assert.equal(p.status, (status & 0x7C) | 3);
    assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []); assert.equal(p.work, 0);
    assert.deepEqual(p.readAddresses, [0x7E0214, 0x7E0215]); commit(data, p);
  }
  const data = createRenderData(); seedWord(data, 0x214, 0);
  const p = prepare(data, { stackWindow: null }); assert.equal(p.x, null); assert.equal(p.y, null);
});

test('Original index0 records the first header80 then six palette bytes before common second buffer conversion', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data);
  assert.ok(p.handled); assert.deepEqual(data.snapshot(), before); assert.equal(p.outcome, 'loaded');
  assert.equal(p.index, 0); assert.equal(p.firstUnpack.header, 80); assert.equal(p.firstUnpack.outputBytes, 80);
  assert.equal(p.second.unpack.header, 1856); assert.equal(p.second.conversionWords, 928);
  assert.equal(p.second.outcome, 'af1f_zero');
  assert.deepEqual(p.palette, { bank: 0x81, pointer: 0xFF3A, next: 0xFF40, bytes: [0xD6, 0, 0x10, 0x42, 0, 0] });
  assert.deepEqual(p.ioWrites.map(({ address, value, bytes }) => [address, value, bytes]), [
    [0x804375, 80, 2], [0x804372, 0x23A0, 2], [0x802116, 0x50B8, 2], [0x802115, 0x80, 1], [0x80420B, 0x80, 1],
    [0x812121, 0x0D, 1], ...asset.palette.bytes.map(v => [0x812122, v, 1]),
  ]);
  assert.deepEqual(p.ioWrites.map(w => w.phase), [...Array(5).fill('first_requests'), ...Array(7).fill('palette')]);
  assert.equal(p.second.unpack.work, p.firstUnpack.work + 12 + a9b2Report.probes[0].unpack.work);
  assert.equal(p.work, p.second.work); assert.equal(p.a, 0); assert.equal(p.x, 0xFFFE); assert.equal(p.status, 0x80);
  for (const key of ['outcome', 'a', 'x', 'y', 'bank', 'status', 'carry', 'overflow', 'index', 'work'])
    assert.equal(p[key], report.probes[0][key]);
  assert.deepEqual(p.ioWrites, report.probes[0].ioWrites); assert.deepEqual(p.palette, report.probes[0].palette);
  assert.equal(p.firstUnpack.byteWrites, undefined); assert.equal(p.second.byteWrites, undefined);
  assert.throws(() => data.commit(p.second), /Invalid render plan/);
  commit(data, p);
  assert.deepEqual(read(data, 0x214, 2), [0, 0]); assert.deepEqual(read(data, 0xD8, 2), [0, 0]);
  assert.deepEqual(read(data, 0x1F4, 2), [0x81, 0]); assert.deepEqual(read(data, 0x1FE, 2), [0x40, 0xFF]);
  assert.deepEqual(read(data, 0xDB, 2), [0x40, 7]);
  assert.equal(digest(read(data, 0x7E23A0, 1856)), 'fe45ff8ebeed0f91d25099a9837cb901b831853285e863232f6b101339e034d1');
  assert.equal(data.readByte(0x804375).available, false);
  const fast = prepare(data, { ioMode: null, stackWindow: null }); assert.equal(fast.outcome, 'cache_equal');
});

test('Unequal full WORD cache uses explicit ownership before touching stream sources', () => {
  const data = fixture({ writeWindows: windows.filter(([a]) => a !== 0x7E0214) });
  assert.equal(unchanged(data, {}, 'render_write_window_required', 'cache').address, 0x7E0214);
  const high = createRenderData(); high.seed(0x214, [0]);
  assert.equal(unchanged(high, {}, 'render_source_required', 'cache').address, 0x7E0215);
  const active = fixture(); assert.equal(unchanged(active, { stackWindow: null }, 'render_stack_required').phase, undefined);
});

test('ASL/ADC use real carry, signed overflow and unclamped indexes including requestFFFF indexFFFE', () => {
  for (const request of [0x3000, 0x4000, 0xB000, 0xFFFF]) {
    const data = fixture(); seedWord(data, 0x214, 0);
    const expectedIndex = (request * 3 + Math.floor(request / 32768)) % 65536;
    data.seed(0x80FFAD + expectedIndex, asset.record.bytes);
    const p = prepare(data, { request, status: 0xC7 }); commit(data, p);
    assert.equal(p.index, expectedIndex); assert.deepEqual(read(data, 0xD8, 2), [request % 256, Math.floor(request / 256)]);
    const shifted = request * 2 % 65536, signed = v => v >= 32768 ? v - 65536 : v;
    const unsignedSum = shifted + request + Math.floor(request / 32768);
    const signedSum = signed(shifted) + signed(request) + Math.floor(request / 32768);
    assert.equal(p.firstUnpack.status, 4 | Number(unsignedSum >= 65536)
      | Number(signedSum < -32768 || signedSum > 32767) * 64);
    assert.equal(digest(read(data, 0x7E23A0, 1856)), 'fe45ff8ebeed0f91d25099a9837cb901b831853285e863232f6b101339e034d1');
  }
});

test('request8000 reaches its real carry-derived first bank WORD address and fails atomically', () => {
  const r = unchanged(fixture(), { request: 0x8000 }, 'render_address_required', 'first_unpack');
  assert.equal(r.address, 0x80FFAF + 0x8001);
});

test('Every original loader record and palette byte is a required fresh read', () => {
  for (const w of [asset.record, asset.palette]) for (let omitted = 0; omitted < w.bytes.length; omitted++) {
    const data = createOriginalRenderData(unpackAsset, { writeWindows: windows });
    for (const window of [asset.record, asset.palette]) for (let i = 0; i < window.bytes.length; i++)
      if (window !== w || i !== omitted) data.seed(window.address + i, [window.bytes[i]]);
    seedWord(data, 0x214, 0xFFFF); seedWord(data, 0x1D61, 0);
    const r = unchanged(data, {}, 'render_source_required'); assert.equal(r.address, w.address + omitted);
  }
});

test('Missing I/O recording contract rolls back cache, scratch and completed first unpack', () => {
  assert.equal(unchanged(fixture(), { ioMode: null }, 'render_io_context_required', 'first_requests').address, 0x804375);
});

test('Late pointer write ownership failures discard already recorded transfer and palette requests', () => {
  for (const address of [0x7E01F4, 0x7E01FE]) {
    const data = fixture({ writeWindows: windows.filter(([a]) => a !== address) });
    assert.equal(unchanged(data, {}, 'render_write_window_required', 'palette').address, address);
  }
});

test('A missing second-stream tail or AF1F gate retains all first-phase bytes and cache', () => {
  const data = createRenderData({ writeWindows: windows });
  data.seed(unpackAsset.table.address, unpackAsset.table.bytes);
  for (const [i, w] of unpackAsset.sources.entries()) data.seed(w.address, i ? w.bytes.slice(0, -1) : w.bytes);
  seedOriginalAA9CData(data, asset); seedWord(data, 0x214, 0xFFFF); seedWord(data, 0x1D61, 0);
  const r = unchanged(data, {}, 'render_source_required', 'second_a9b2');
  assert.equal(r.address, 0x81FF7E); assert.equal(r.innerPhase, 'unpack');
  const late = fixture({ gate: 1 }); const result = unchanged(late, {}, 'render_source_required', 'second_a9b2');
  assert.equal(result.address, 0x7E2DE6); assert.equal(result.innerPhase, 'af1f');
});

test('Active AF1F retains its explicit arithmetic contract within the complete loader', () => {
  const data = fixture({ gate: 1 }); seedWord(data, 0x7E2DE6, 0);
  const r = unchanged(data, {}, 'render_division_context_required', 'second_a9b2'); assert.equal(r.innerPhase, 'af1f');
  seedOriginalAF1FData(data, afAsset); seedWord(data, 0x7E3C00, 60); seedWord(data, 0x7E33DE, 0);
  const p = prepare(data, { divisionMode: 'stable-native' }); commit(data, p);
  assert.equal(p.second.outcome, 'af1f_active'); assert.equal(p.second.af1f.divisions.length, 3);
  assert.equal(p.ioWrites.length, 12); assert.equal(p.status, 0x81);
  for (const key of ['outcome', 'a', 'x', 'y', 'bank', 'status', 'carry', 'overflow', 'index', 'work'])
    assert.equal(p[key], report.probes[1][key]);
  assert.equal(digest(read(data, 0x7E23A0, 1856)), '923a0ccabdcfe47fe6657107d71368391791c145093decfa19a385e788f0778d');
});

test('One common work budget stops the second phase after successful first requests without writes', () => {
  const data = fixture(), p = prepare(data); assert.ok(p.handled);
  const r = unchanged(data, { maxWork: p.firstUnpack.work + 12 + 1 }, 'render_work_budget_required', 'second_a9b2');
  assert.equal(r.innerPhase, 'unpack');
  commit(data, prepare(data, { maxWork: p.work }));
});

test('Output limits are enforced per unpack while second-phase failure remains atomic', () => {
  unchanged(fixture(), { maxOutputBytes: 79 }, 'render_output_budget_required', 'first_unpack');
  const r = unchanged(fixture(), { maxOutputBytes: 80 }, 'render_output_budget_required', 'second_a9b2');
  assert.equal(r.innerPhase, 'unpack');
  const data = fixture(); commit(data, prepare(data, { maxOutputBytes: 1856 }));
});

test('Outer PLB flags follow the actual incoming bank, preserving I/C/V from the inner plan', () => {
  for (const bank of [0, 1, 0x1F, 0x3F, 0x80, 0x9F, 0xBF]) {
    const data = fixture({ gate: 1 }); seedWord(data, 0x7E2DE6, 0x8001);
    const p = prepare(data, { bank, status: 0xC7 }); commit(data, p);
    assert.equal(p.bank, bank); assert.equal(p.a, 0x8001); assert.equal(p.status, 4 | (bank & 0x80) | (bank === 0 ? 2 : 0));
    assert.equal(p.firstUnpack.status, 4); assert.equal(p.ioWrites[0].address, bank * 65536 + 0x4375);
    assert.equal(p.ioWrites[5].address, 0x812121);
  }
});

test('DBR7F cache and input01F4 do not silently mirror the later palette-bank81 input', () => {
  const data = fixture({ writeWindows: [...windows, [0x7F0214, 0x7F0215], [0x7F01F4, 0x7F01F5],
    [0x7F2115, 0x7F2117], [0x7F420B, 0x7F420B], [0x7F4372, 0x7F4373], [0x7F4375, 0x7F4376]] });
  seedWord(data, 0x7F0214, 0xFFFF);
  const r = unchanged(data, { bank: 0x7F, ioMode: 'record-requests' }, 'render_source_required', 'second_a9b2');
  assert.equal(r.address, 0x7E01F4); assert.equal(r.innerPhase, 'unpack');
  seedWord(data, 0x7E01F4, 0x81); const p = prepare(data, { bank: 0x7F }); commit(data, p);
  assert.equal(p.ioWrites.length, 7); assert.deepEqual(read(data, 0x7F4375, 2), [80, 0]);
  assert.deepEqual(read(data, 0x7F01F4, 2), [0x81, 0]); assert.deepEqual(read(data, 0x7F0214, 2), [0, 0]);
  assert.deepEqual(read(data, 0x7E0214, 2), [255, 255]);
});

test('WRAM banks map register-shaped stores to owned bytes, including palette read/write aliases', () => {
  const data = fixture({ writeWindows: [...windows, [0x7E2115, 0x7E2122],
    [0x7E420B, 0x7E420B], [0x7E4372, 0x7E4376]] });
  // Palette starts at2121: the preceding store0D replaces the first source
  // byte, and the first2122 store replaces the second before its read.
  data.seed(0x80FFAD, [0x98, 0xFF, 0x80, 0x21, 0x21, 0x7E, 0xC0]);
  data.seed(0x7E2121, [1, 2, 3, 4, 5, 6]);
  data.seed(0x7E2127, unpackAsset.sources[1].bytes);
  const p = prepare(data, { bank: 0x7E, ioMode: null }); commit(data, p);
  assert.deepEqual(p.palette.bytes, [13, 13, 3, 4, 5, 6]); assert.equal(p.palette.next, 0x2127);
  assert.deepEqual(p.ioWrites, []); assert.deepEqual(read(data, 0x7E2121, 2), [13, 6]);
  assert.deepEqual(read(data, 0x7E4375, 2), [80, 0]);
  assert.equal(digest(read(data, 0x7E23A0, 1856)), 'fe45ff8ebeed0f91d25099a9837cb901b831853285e863232f6b101339e034d1');
});

test('Palette INX wraps WORD after all six reads before storing the second source pointer', () => {
  const data = fixture(); data.seed(0x80FFAD, [0x98, 0xFF, 0x80, 0xFA, 0xFF, 0x81, 0xC0]);
  data.seed(0x81FFFA, [1, 2, 3, 4, 5, 6]);
  // cursor0000 resolves actual low WRAM, not a continuation of ROMFFFA.
  data.seed(0x7E0000, unpackAsset.sources[1].bytes);
  const p = prepare(data); commit(data, p);
  assert.equal(p.palette.next, 0); assert.deepEqual(p.palette.bytes, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(read(data, 0x1FE, 2), [0, 0]); assert.equal(p.second.unpack.header, 1856);
});

test('Unsupported palette-bank mappings fail at the actual reached store without device inference', () => {
  const data = fixture(); data.seed(0x80FFB2, [0x40, 0xC0]);
  assert.equal(unchanged(data, {}, 'render_address_required', 'palette').address, 0x402121);
});

test('Stack protection covers cache, first output, palette source and late pointer fields', () => {
  for (const [stackWindow, reason] of [[[0x214, 0x22F], 'render_stack_alias_required'],
    [[0x23A0, 0x23BF], 'render_stack_alias_required'], [[0x1F4, 0x20F], 'render_stack_alias_required'],
    [[0x1F00, 0x1F13], 'render_stack_required']]) unchanged(fixture(), { stackWindow }, reason);
  const data = fixture(); data.seed(0x80FFAD, [0x98, 0xFF, 0x80, 0, 0x1F, 0x81, 0xC0]);
  assert.equal(unchanged(data, {}, 'render_stack_alias_required', 'palette').address, 0x7E1F00);
});

test('Complete plans freeze request metadata and reject stale, foreign or inner commits', () => {
  const data = fixture(), p = prepare(data);
  assert.ok(Object.isFrozen(p)); assert.ok(Object.isFrozen(p.ioWrites)); assert.ok(Object.isFrozen(p.ioWrites[0]));
  assert.ok(Object.isFrozen(p.palette.bytes)); assert.ok(Object.isFrozen(p.firstUnpack)); assert.ok(Object.isFrozen(p.second));
  assert.throws(() => { p.ioWrites[0].value = 1856; }, TypeError);
  assert.throws(() => fixture().commit(p), /Invalid render plan/); assert.throws(() => data.commit(p.firstUnpack), /Invalid render plan/);
  seedWord(data, 0x214, 7); const before = data.snapshot();
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), before);
});

test('Malformed assets and contexts cannot partially seed or prepare the owner', () => {
  const data = fixture(), before = data.snapshot(), invalid = structuredClone(asset); invalid.palette.bytes[5] = 1;
  assert.throws(() => seedOriginalAA9CData(data, invalid), /Invalid original AA9C data/); assert.deepEqual(data.snapshot(), before);
  for (const options of [{ request: -1 }, { request: 65536 }, { x: 65536 }, { y: -1 }, { ioMode: 'execute' },
    { divisionMode: 'automatic' }, { maxWork: 0 }, { maxOutputBytes: 0 }]) {
    assert.throws(() => prepare(data, options), /Invalid render/); assert.deepEqual(data.snapshot(), before);
  }
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 0x10 },
    { status: 8 }, { emulation: 1 }, { directPage: 1 }]) unchanged(data, options, 'render_entry_required');
});
