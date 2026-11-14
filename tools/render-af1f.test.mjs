import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createOriginalRenderData } from '../proof/render/original-data.mjs';
import { seedOriginalAF1FData } from '../proof/render/original-af1f-data.mjs';
import { prepareRenderA9B2 } from '../proof/render/a9b2.mjs';

const unpackAsset = JSON.parse(await readFile(new URL('../assets/render-unpack-data.json', import.meta.url), 'utf8'));
const asset = JSON.parse(await readFile(new URL('../assets/render-af1f-data.json', import.meta.url), 'utf8'));
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-af1f-native.json', import.meta.url), 'utf8'));
const entry = { bank: 0x80, status: 0, emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], divisionMode: 'stable-native' };
const broadWindow = [[0x7E23A0, 0x7F2487]];
const hash = bytes => createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const tableWord = offset => asset.table.bytes[offset] | asset.table.bytes[offset + 1] << 8;
function seedWord(data, address, word) { data.seed(address, [word & 255, word >>> 8]); }
function fixture(row = 60, s = 0, { windows = [[0x7E23A0, 0x7E2ADF]], sources = true, original = false } = {}) {
  const data = createOriginalRenderData(unpackAsset, { writeWindows: windows });
  if (sources) seedOriginalAF1FData(data, asset);
  if (original) seedWord(data, 0x7E01FE, 0xFF40);
  else {
    // Synthetic1856-byte all-zero literal, independently encoded.
    const bits = [...(1856).toString(2).slice(1)].flatMap(c => [0, Number(c)]).concat(1);
    while (bits.length % 16) bits.push(0);
    const bitBytes = [];
    for (let i = 0; i < bits.length; i += 8) bitBytes.push(bits.slice(i, i + 8).reduce((v, b) => v * 2 + b, 0));
    data.seed(0x809000, [0x40, 7, 0x42, 7, ...Array(1856).fill(0), ...bitBytes]); seedWord(data, 0x7E01FE, 0x9000);
  }
  seedWord(data, 0x7E01F4, original ? 0x81 : 0x80);
  seedWord(data, 0x7E1D61, 1); seedWord(data, 0x7E2DE6, 0);
  seedWord(data, 0x7E3C00, row); seedWord(data, 0x7E33DE, s);
  return data;
}
const prepare = (data, options = {}) => prepareRenderA9B2({ ...entry, data, ...options });
function commit(data, plan) { assert.ok(plan.handled, JSON.stringify(plan)); assert.deepEqual(data.commit(plan), { handled: true }); }
function bytes(data, address, count) { return Array.from({ length: count }, (_, i) => { const r = data.readByte(address + i); assert.ok(r.available); return r.value; }); }
const word = (data, address) => { const pair = bytes(data, address, 2); return pair[0] | pair[1] << 8; };
function boundary(data, options, reason) {
  const before = data.snapshot(), result = prepare(data, options);
  assert.equal(result.handled, false); assert.equal(result.reason, reason); assert.equal(result.phase, 'af1f');
  assert.equal(result.byteWrites, undefined); assert.equal(result.unpack, undefined); assert.deepEqual(data.snapshot(), before);
  return result;
}
// Independent geometry oracle for bounded, nonaliased inputs. Expected
// writes are assembled as rows/caps/table cells; no native helper or flags.
function expectedNominal(row, s, initialBytes = null) {
  const q = Math.floor(row / 20), r = row % 20;
  const thirdDividend = s + (r === 0 ? 19 : 9), thirdQ = Math.floor(thirdDividend / 20), thirdR = thirdDividend % 20;
  const difference = q - thirdQ; assert.ok(q > 0 && q <= 10 && difference >= 0);
  const out = new Map();
  const put = (a, v) => { out.set(a, v & 255); out.set(a + 1, v >>> 8); };
  for (let i = 0; i < 928; i++) put(0x7E23A0 + i * 2, initialBytes ? initialBytes[i * 2] | initialBytes[i * 2 + 1] << 8 : 0x2017);
  [[0x7E241C, 0x6C04], [0x7E245C, 0x6C07], [0x7E249C, 0xEC04]].forEach(([a, v]) => put(a, v));
  [0x7E2406, 0x7E2446, 0x7E2486].forEach((base, n) => {
    for (const offset of Array.from({ length: q }, (_, i) => 20 - i * 2)) put(base + offset, [0x2C05, 0x2C10, 0xAC05][n]);
    put(base + 20 - q * 2, r === 0 ? [0x2C04, 0x2C07, 0xAC04][n] : [0x2C06, 0x2C15, 0xAC06][n]);
  });
  for (const offset of Array.from({ length: difference }, (_, i) => 20 - i * 2)) put(0x7E2446 + offset, 0x2C08);
  const x = (20 - 2 * difference) & 0xFFFF;
  const index = thirdR + (r !== 0 && s < 11 ? 11 : 0);
  const skip = r === 0 && s === 0;
  if (!skip) put(0x7E2446 + x, tableWord(index * 2));
  return { bytes: Array.from({ length: 1856 }, (_, i) => out.get(0x7E23A0 + i)),
    a: skip ? 0 : tableWord(index * 2), x, y: r, carry: Number(skip), difference,
    tableOffset: skip ? null : index * 2, thirdDividend };
}

test('AF1F original pointer and complete31-word table are byte-exact ROM sources', () => {
  for (const [window, digest] of [[asset.pointer, 'd328f42314be9bf1b011ba58c7d0325de0416e23fe2506f76236d27c7296bd1c'],
    [asset.table, '4cafea23b5ab8e1f0968d6e19c31fab442a799da84633bb3e687cc843d1c738c']]) {
    assert.equal(hash(window.bytes), digest); assert.equal(window.sha256, digest);
    assert.deepEqual(window.bytes, [...rom.subarray(window.sourceRomOffset, window.sourceRomOffset + window.bytes.length)]);
  }
});

test('Bounded row/cap/table geometry and final registers match an independent nominal oracle', () => {
  for (const row of [20, 21, 39, 40, 60, 61, 100, 101, 199, 200, 219]) for (const s of [0, 1, 5, 10, 11, 19, 20, 21, 40, 100, 180]) {
    if (Math.floor(row / 20) < Math.floor((s + (row % 20 ? 9 : 19)) / 20)) continue;
    const data = fixture(row, s), plan = prepare(data), expected = expectedNominal(row, s); commit(data, plan);
    assert.equal(plan.outcome, 'af1f_active'); assert.deepEqual(bytes(data, 0x7E23A0, 1856), expected.bytes);
    for (const key of ['a', 'x', 'y', 'carry']) assert.equal(plan[key], expected[key]);
    assert.equal(plan.overflow, 0); assert.equal(plan.status, 0x80 | expected.carry);
    assert.equal(plan.af1f.firstVisits, Math.floor(row / 20)); assert.equal(plan.af1f.middleVisits, expected.difference);
    assert.equal(plan.af1f.tableOffset, expected.tableOffset);
    assert.deepEqual(plan.af1f.divisions.map(d => d.dividend), [row, row, expected.thirdDividend]);
  }
});

test('Divisor is BYTE14 and ordered native result reads use the current division', () => {
  const data = fixture(61, 5), plan = prepare(data); commit(data, plan);
  assert.deepEqual(plan.af1f.divisionReads.map(r => [r.division, r.address & 0xFFFF]),
    [[1, 0x4214], [1, 0x4216], [2, 0x4214], [2, 0x4216], [3, 0x4214], [3, 0x4216]]);
  for (const d of plan.af1f.divisions) {
    assert.equal(d.divisor, 20); assert.equal(d.divisorBytes, 1); assert.equal(d.dividendBytes, 2);
    assert.equal(d.dividendRegister, 0x804204); assert.equal(d.divisorRegister, 0x804206);
    assert.equal(d.quotient * d.divisor + d.remainder, d.dividend); assert.ok(d.remainder < 20);
  }
  assert.equal(data.readByte(0x804204).reason, 'render_address_required');
  assert.equal(plan.byteWrites.some(([a]) => a === 0x804204), false);
});

test('A5 zero follows LDY remainder flags and skips the last table write only for A8 zero', () => {
  const data = fixture(60, 0), plan = prepare(data); commit(data, plan);
  assert.equal(plan.af1f.tableOffset, null); assert.equal(plan.af1f.divisionReads.length, 5);
  assert.equal(plan.a, 0); assert.equal(plan.carry, 1); assert.equal(plan.y, 0);
  assert.equal(plan.af1f.divisions[2].dividend, 19);
});

test('Remainder branches below/at11 preserve the source table index and caps', () => {
  for (const s of [0, 10, 11]) {
    const data = fixture(61, s), plan = prepare(data); commit(data, plan);
    const expected = expectedNominal(61, s); assert.equal(plan.af1f.tableOffset, expected.tableOffset);
    assert.equal(word(data, 0x7E241C), 0x6C04); assert.equal(word(data, 0x7E2414), 0x2C06);
  }
});

test('ScratchA2/A5/A8 writes share canonical bytes and preserve their neighbors', () => {
  const data = fixture(61, 5); data.seed(0xA2, Array(10).fill(0x6A));
  const plan = prepare(data); commit(data, plan);
  assert.equal(word(data, 0x8000A2), 3); assert.equal(word(data, 0xA5), 1); assert.equal(word(data, 0x7E00A8), 5);
  for (const a of [0xA4, 0xA7, 0xAA, 0xAB]) assert.equal(data.readByte(a).value, 0x6A);
});

test('Zero first quotient executes65536 bodies and rereads overwritten source and pointer data', () => {
  const data = fixture(0, 200, { windows: broadWindow }), plan = prepare(data); commit(data, plan);
  assert.equal(plan.af1f.firstVisits, 65536); assert.equal(plan.af1f.middleVisits, 0);
  assert.deepEqual(plan.af1f.divisions.map(d => d.dividend), [0, 5, 14]);
  assert.equal(word(data, 0x7E3C00), 0xAC05); assert.equal(word(data, 0x7E33DE), 0xAC05); assert.equal(word(data, 0xA8), 5);
  assert.ok(plan.byteWrites.some(([a]) => a >= 0x7F0000));
});

test('Negative middle difference wrapsWORD and executes a large countdown without clamping', () => {
  const data = fixture(20, 255, { windows: broadWindow }), plan = prepare(data); commit(data, plan);
  assert.equal(plan.af1f.middleVisits, 65524); assert.equal(plan.af1f.firstVisits, 1);
  assert.equal(plan.x, 44); assert.equal(plan.y, 0); assert.equal(word(data, 0x7E3C00), 0x2C08);
  assert.equal(word(data, 0xA8), 255); assert.deepEqual(plan.af1f.divisions.map(d => d.dividend), [20, 20, 274]);
});

test('Zero quotient with a bounded write owner stops at real long bank7F writes atomically', () => {
  const data = fixture(0, 0); const result = boundary(data, {}, 'render_write_window_required');
  assert.equal(result.address, 0x7F2404);
});

test('A positive quotient may also require long capwrites in bank7F', () => {
  const data = fixture(220, 0); assert.equal(boundary(data, {}, 'render_write_window_required').address, 0x7F2404);
});

test('Work budgets protect zero/negative countdowns and retain all prior A9B2 writes', () => {
  for (const [row, s] of [[0, 200], [20, 255]]) boundary(fixture(row, s, { windows: broadWindow }), { maxWork: 20000 }, 'render_work_budget_required');
  const data = fixture(61, 5), plan = prepare(data); assert.ok(plan.handled);
  boundary(data, { maxWork: plan.work - 1 }, 'render_work_budget_required'); assert.ok(prepare(data, { maxWork: plan.work }).handled);
});

test('Division context is explicit, ignored by early gates, and malformed values are rejected', () => {
  const data = fixture(); assert.equal(boundary(data, { divisionMode: null }, 'render_division_context_required').address, 0x81AF32);
  assert.throws(() => prepare(data, { divisionMode: 'guess' }));
  seedWord(data, 0x7E1D61, 0); assert.equal(prepare(data, { divisionMode: null }).outcome, 'af1f_zero');
});

test('Source masks require both highbytes before retaining low values', () => {
  for (const missing of [0x7E3C01, 0x7E33DF]) {
    const data = fixture(60, 0); const snapshot = data.snapshot();
    const sparse = createOriginalRenderData(unpackAsset, { writeWindows: snapshot.writeWindows });
    for (const [a, v] of snapshot.bytes) if (a !== missing) sparse.seed(a, [v]);
    assert.equal(boundary(sparse, {}, 'render_source_required').address, missing);
  }
});

test('Original pointer, reached table bytes and late source holes stop atomically', () => {
  const data = fixture(61, 5, { sources: false }); assert.equal(boundary(data, {}, 'render_source_required').address, 0x8DB8D2);
  data.seed(asset.pointer.address, asset.pointer.bytes); assert.equal(boundary(data, {}, 'render_source_required').address, 0x81B058);
  data.seed(0x81B058, [asset.table.bytes[50]]); assert.equal(boundary(data, {}, 'render_source_required').address, 0x81B059);
});

test('Pointer-derived source read uses the supplied WORD before any nominal33DE assumption', () => {
  const data = fixture(60, 0); seedWord(data, 0x8DB8D2, 0xFFFF);
  assert.equal(boundary(data, {}, 'render_source_required').address, 0x7F0001);
  seedWord(data, 0x7F0001, 1); const plan = prepare(data); commit(data, plan); assert.equal(word(data, 0xA8), 1);
});

test('Pointer/source/DP/table stack conflicts leave the shared plan untouched', () => {
  for (const stackWindow of [[0xA2, 0xB4], [0x33DE, 0x33F0], [0x3C00, 0x3C12]]) boundary(fixture(61, 5), { stackWindow }, 'render_stack_alias_required');
});

test('Active plan metadata is immutable and stale commits cannot apply source or scratch writes', () => {
  const data = fixture(61, 5), plan = prepare(data); assert.ok(plan.handled);
  assert.throws(() => { plan.af1f.divisions[0].dividend = 1; }); assert.throws(() => { plan.af1f.divisionReads[0].value = 1; });
  data.seed(0x7E4000, [1]); const before = data.snapshot(); assert.equal(data.commit(plan).reason, 'render_plan_stale'); assert.deepEqual(data.snapshot(), before);
});

test('Original0740 stream is fully converted then overwritten in the same active AF1F plan', () => {
  const baseline = fixture(61, 5, { original: true }); seedWord(baseline, 0x7E1D61, 0); commit(baseline, prepare(baseline));
  const convertedBytes = bytes(baseline, 0x7E23A0, 1856);
  for (const [i, row, s, digest] of [[0, 60, 0, '923a0ccabdcfe47fe6657107d71368391791c145093decfa19a385e788f0778d'],
    [1, 61, 5, 'a14d1c1806cd2fa5e9de202ea4261251258f8497d981f002f01c0231f343d2b8']]) {
    const data = fixture(row, s, { original: true }), plan = prepare(data); commit(data, plan);
    assert.equal(plan.unpack.header, 1856); assert.equal(plan.af1f.firstVisits, 3); assert.equal(plan.af1f.middleVisits, 3);
    const output = bytes(data, 0x7E23A0, 1856); assert.deepEqual(output, expectedNominal(row, s, convertedBytes).bytes);
    assert.equal(hash(output), digest); assert.equal(hash(output), report.probes[i].outputSha256);
    assert.deepEqual(plan.af1f, report.probes[i].af1f);
    for (const key of ['a', 'x', 'y', 'bank', 'status', 'work']) assert.equal(plan[key], report.probes[i][key]);
  }
});

test('Seeding malformed AF1F assets cannot partially hydrate the original data owner', () => {
  const data = createOriginalRenderData(unpackAsset), before = data.snapshot();
  for (const invalid of [{ ...asset, romSha256: 'wrong' }, { ...asset, table: { ...asset.table, bytes: Array(62) } },
    { ...asset, pointer: { ...asset.pointer, bytes: [0, 0] } }]) assert.throws(() => seedOriginalAF1FData(data, invalid));
  assert.deepEqual(data.snapshot(), before);
});
