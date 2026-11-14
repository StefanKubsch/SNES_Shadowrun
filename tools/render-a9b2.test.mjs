import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData } from '../src/render/data.mjs';
import { createOriginalRenderData } from '../proof/render/original-data.mjs';
import { prepareRenderA9B2 } from '../proof/render/a9b2.mjs';
import { prepareRenderUnpack9F49 } from '../proof/render/unpack-9f49.mjs';

const asset = JSON.parse(
  await readFile(new URL('../assets/render-unpack-data.json', import.meta.url), 'utf8'),
);
const report = JSON.parse(
  await readFile(new URL('../analysis/render-a9b2-native.json', import.meta.url), 'utf8'),
);
const entry = { bank: 0x80, status: 0, emulation: 0, directPage: 0, stackWindow: [0x1f00, 0x1fff] };
const bytesOf = (words) => words.flatMap((w) => [w & 255, w >>> 8]);
const digest = (bytes) => createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
function seedWord(data, address, value) {
  data.seed(address, [value & 255, value >>> 8]);
}
function inputs(data, sourceOffset = 0x9000, sourceBankWord = 0x80, bank = 0x80) {
  seedWord(data, bank * 0x10000 + 0x1fe, sourceOffset);
  seedWord(data, bank * 0x10000 + 0x1f4, sourceBankWord);
}
function stream(payload) {
  const size = payload.length,
    bits = [...size.toString(2).slice(1)].flatMap((c) => [0, Number(c)]).concat(1);
  while (bits.length % 16) bits.push(0);
  const bitBytes = [];
  for (let i = 0; i < bits.length; i += 8)
    bitBytes.push(bits.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
  return [size & 255, size >>> 8, (size + 2) & 255, (size + 2) >>> 8, ...payload, ...bitBytes];
}
function fixture(
  words = Array(928).fill(0),
  { gate = 0, secondGate, writeWindows = [[0x7e23a0, 0x7e2adf]] } = {},
) {
  const data = createRenderData({ writeWindows });
  data.seed(0x809000, stream(bytesOf(words)));
  inputs(data);
  seedWord(data, 0x7e1d61, gate);
  if (secondGate !== undefined) seedWord(data, 0x7e2de6, secondGate);
  return data;
}
function original(index = 1, { gate = 0, secondGate, bank = 0x80 } = {}) {
  const data = createOriginalRenderData(asset, { writeWindows: [[0x7e23a0, 0x7e2adf]] });
  inputs(data, index ? 0xff40 : 0xff98, index ? 0x81 : 0x3a80, bank);
  seedWord(data, 0x7e1d61, gate);
  if (secondGate !== undefined) seedWord(data, 0x7e2de6, secondGate);
  return data;
}
const prepare = (data, options = {}) => prepareRenderA9B2({ ...entry, data, ...options });
const read = (data, address, length) =>
  Array.from({ length }, (_, i) => {
    const r = data.readByte(address + i);
    assert.ok(r.available);
    return r.value;
  });
function commit(data, plan) {
  assert.ok(plan.handled, JSON.stringify(plan));
  assert.deepEqual(data.commit(plan), { handled: true });
}
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(),
    result = prepare(data, options);
  assert.equal(result.handled, false);
  assert.equal(result.reason, reason);
  if (phase) assert.equal(result.phase, phase);
  assert.deepEqual(data.snapshot(), before);
  assert.equal(result.byteWrites, undefined);
  assert.equal(result.unpack, undefined);
  return result;
}
// Separate unsigned/signed arithmetic oracle; uses no native conversion helper.
function converted(bytes) {
  const words = Array.from({ length: 928 }, (_, i) => bytes[i * 2] + bytes[i * 2 + 1] * 256);
  let carry = 0,
    overflow = 0;
  for (let i = words.length - 1; i >= 0; i--) {
    const unsigned = words[i] + 8215 + carry;
    const signed = (words[i] >= 32768 ? words[i] - 65536 : words[i]) + 8215 + carry;
    overflow = Number(signed < -32768 || signed > 32767);
    words[i] = unsigned % 65536;
    carry = Number(unsigned >= 65536);
  }
  return { bytes: bytesOf(words), carry, overflow };
}

test('Original0740 unpack and all928 conversions share one plan, with no implicit WRAM seeds', () => {
  const data = original(),
    before = data.snapshot(),
    plan = prepare(data);
  assert.deepEqual(data.snapshot(), before);
  assert.ok(plan.handled);
  assert.equal(plan.conversionWords, 928);
  assert.equal(plan.unpack.header, 1856);
  assert.equal(plan.unpack.outputBytes, 1856);
  assert.equal(plan.outcome, 'af1f_zero');
  assert.equal(plan.work, plan.unpack.work + 928);
  assert.equal(plan.a, 0);
  assert.equal(plan.x, 0xfffe);
  assert.equal(plan.y, plan.unpack.y);
  const raw = original(),
    rawPlan = prepareRenderUnpack9F49({
      ...entry,
      data: raw,
      sourceOffset: 0xff40,
      sourceBankWord: 0x81,
      destination: 0x23a0,
    });
  commit(raw, rawPlan);
  const expected = converted(read(raw, 0x7e23a0, 1856));
  commit(data, plan);
  assert.deepEqual(read(data, 0x7e23a0, 1856), expected.bytes);
  assert.equal(
    digest(expected.bytes),
    'fe45ff8ebeed0f91d25099a9837cb901b831853285e863232f6b101339e034d1',
  );
  assert.equal(digest(expected.bytes), report.probes[0].outputSha256);
  for (const key of [
    'a',
    'x',
    'y',
    'bank',
    'status',
    'carry',
    'overflow',
    'work',
    'conversionWords',
    'outcome',
  ])
    assert.equal(plan[key], report.probes[0][key]);
  assert.equal(plan.carry, expected.carry);
  assert.equal(plan.overflow, expected.overflow);
  assert.equal(plan.readAddresses.includes(0x7e2de6), false);
  assert.equal(data.readByte(0x7e2de6).available, false);
});

test('Single CLC and descending order retain carry between neighboring WORDs', () => {
  const words = Array(928).fill(0);
  words[927] = 0xdfe9;
  words[926] = 0;
  words[0] = 0xdfe9;
  const data = fixture(words),
    plan = prepare(data);
  commit(data, plan);
  const out = read(data, 0x7e23a0, 1856);
  assert.deepEqual(out.slice(-4), [0x18, 0x20, 0, 0]);
  assert.deepEqual(out.slice(2, 4), [0x17, 0x20]);
  assert.deepEqual(out.slice(0, 2), [0, 0]);
  assert.equal(plan.carry, 1);
  assert.deepEqual(out, converted(bytesOf(words)).bytes);
});

test('Signed overflow, final carry and PLB-derived N/Z cover arithmetic boundary combinations', () => {
  for (const low of [0, 0x5fe8, 0x5fe9, 0x7fff, 0x8000, 0xdfe8, 0xdfe9, 0xffff])
    for (const incomingCarry of [0, 1]) {
      const words = Array(928).fill(incomingCarry ? 0xffff : 0);
      words[0] = low;
      const data = fixture(words),
        plan = prepare(data, { status: 0xc7 });
      commit(data, plan);
      const expected = converted(bytesOf(words));
      assert.deepEqual(read(data, 0x7e23a0, 1856), expected.bytes);
      assert.equal(plan.carry, expected.carry);
      assert.equal(plan.overflow, expected.overflow);
      assert.equal(plan.status, 0x84 | expected.carry | (expected.overflow * 64));
      assert.equal(plan.unpack.status, 0x45); // LDX23A0 clears the caller's N/Z before PHP.
    }
});

test('Negative AF1F returns the actual gate WORD and preserves completed conversion', () => {
  for (const secondGate of [0x8000, 0x8001, 0xfffe, 0xffff]) {
    const data = original(1, { gate: 1, secondGate }),
      plan = prepare(data);
    commit(data, plan);
    assert.equal(plan.outcome, 'af1f_negative');
    assert.equal(plan.a, secondGate);
    assert.equal(plan.x, 0xfffe);
    assert.ok(plan.readAddresses.includes(0x7e2de6));
    assert.ok(plan.readAddresses.includes(0x7e2de7));
    if (secondGate === 0xffff) {
      assert.equal(digest(read(data, 0x7e23a0, 1856)), report.probes[1].outputSha256);
      assert.equal(plan.a, report.probes[1].a);
      assert.equal(plan.status, report.probes[1].status);
    }
  }
});

test('Gate1D61 is a full WORD and skips2DE6 only when both bytes are zero', () => {
  const data = original();
  seedWord(data, 0x7e1d61, 0x0100);
  assert.equal(unchanged(data, {}, 'render_source_required', 'af1f').address, 0x7e2de6);
  const missing = createOriginalRenderData(asset, { writeWindows: [[0x7e23a0, 0x7e2adf]] });
  inputs(missing, 0xff40, 0x81);
  missing.seed(0x7e1d61, [0]);
  assert.equal(unchanged(missing, {}, 'render_source_required', 'af1f').address, 0x7e1d62);
});

test('Active AF1F without explicit division context stops before all live writes', () => {
  for (const secondGate of [0, 1, 0x7fff]) {
    const data = original(1, { gate: 1, secondGate });
    data.seed(0xdb, Array(24).fill(0x6a));
    const result = unchanged(data, {}, 'render_division_context_required', 'af1f');
    assert.equal(result.address, 0x81af32);
    assert.throws(() => data.commit(result));
  }
});

test('Missing late AF1F bytes roll back successful unpack and all conversion writes', () => {
  for (const address of [0x7e1d61, 0x7e2de6, 0x7e2de7]) {
    const data = createOriginalRenderData(asset, { writeWindows: [[0x7e23a0, 0x7e2adf]] });
    inputs(data, 0xff40, 0x81);
    if (address !== 0x7e1d61) seedWord(data, 0x7e1d61, 1);
    if (address === 0x7e2de7) data.seed(0x7e2de6, [0]);
    assert.equal(unchanged(data, {}, 'render_source_required', 'af1f').address, address);
  }
});

test('Original0050 still requires the high conversion WORD instead of shortening the928 loop', () => {
  const data = original(0);
  const result = unchanged(data, {}, 'render_source_required', 'conversion');
  assert.equal(result.address, 0x7e2ade);
});

test('Explicit tail bytes let Original0050 participate in the complete conversion', () => {
  const data = original(0),
    raw = original(0),
    tail = Array.from({ length: 1776 }, (_, i) => (i * 13) & 255);
  data.seed(0x7e23f0, tail);
  const rawPlan = prepareRenderUnpack9F49({
    ...entry,
    data: raw,
    sourceOffset: 0xff98,
    sourceBankWord: 0x3a80,
    destination: 0x23a0,
  });
  commit(raw, rawPlan);
  const expected = converted([...read(raw, 0x7e23a0, 80), ...tail]);
  const plan = prepare(data);
  commit(data, plan);
  assert.equal(plan.unpack.header, 80);
  assert.deepEqual(read(data, 0x7e23a0, 1856), expected.bytes);
});

test('Final bank restore sets N/Z from incoming DBR even when A is negative and X isFFFE', () => {
  for (const bank of [0, 1, 0x3f, 0x7e, 0x7f, 0x80, 0xbf]) {
    const data = original(1, { gate: 1, secondGate: 0xffff, bank }),
      plan = prepare(data, { bank });
    assert.ok(plan.handled);
    assert.equal(plan.bank, bank);
    assert.equal(plan.a, 0xffff);
    assert.equal(plan.status & 0x82, (bank & 0x80) | (bank === 0 ? 2 : 0));
  }
});

test('Input01FE/01F4 reads use incoming DBR7F rather than the low-WRAM mirror', () => {
  const data = original(1, { bank: 0x7f });
  inputs(data, 0x1234, 0x8040, 0x80);
  const plan = prepare(data, { bank: 0x7f });
  assert.ok(plan.handled);
  assert.equal(plan.unpack.header, 1856);
  assert.ok(plan.readAddresses.includes(0x7f01fe));
  assert.ok(plan.readAddresses.includes(0x7f01f4));
  assert.ok(!plan.readAddresses.includes(0x7e01fe));
  assert.ok(plan.readAddresses.includes(0x7e1d61));
});

test('Both bytes of the source bank WORD are real input and scratch writes', () => {
  const data = original();
  seedWord(data, 0x7e01f4, 0xc081);
  const plan = prepare(data);
  commit(data, plan);
  assert.deepEqual(read(data, 0xe3, 2), [0x81, 0xc0]);
  assert.ok(plan.readAddresses.includes(0x7e01f5));
  const missing = createOriginalRenderData(asset, { writeWindows: [[0x7e23a0, 0x7e2adf]] });
  seedWord(missing, 0x7e01fe, 0xff40);
  missing.seed(0x7e01f4, [0x81]);
  assert.equal(unchanged(missing, {}, 'render_source_required', 'unpack').address, 0x7e01f5);
});

test('A later missing conversion byte leaves already converted higher words unchanged', () => {
  const data = fixture([0x5566]);
  data.seed(0x7e23a4, Array(1852).fill(0xff));
  const result = unchanged(data, {}, 'render_source_required', 'conversion');
  assert.equal(result.address, 0x7e23a2);
  assert.equal(data.readByte(0x7e2ade).value, 0xff);
});

test('Conversion observes bytes written by unpack even when stale target bytes were hydrated', () => {
  const data = original();
  data.seed(0x7e23a0, Array(1856).fill(0xff));
  const plan = prepare(data);
  commit(data, plan);
  const clean = original(),
    expected = prepare(clean);
  commit(clean, expected);
  assert.deepEqual(read(data, 0x7e23a0, 1856), read(clean, 0x7e23a0, 1856));
});

test('Gate2DE6 observes a planned unpack overwrite before choosing the early return', () => {
  const words = Array(1316).fill(0);
  words[1315] = 0x8000;
  const data = fixture(words, { gate: 1, secondGate: 0, writeWindows: [[0x7e23a0, 0x7e2de7]] });
  const plan = prepare(data);
  commit(data, plan);
  assert.equal(plan.outcome, 'af1f_negative');
  assert.equal(plan.a, 0x8000);
  assert.equal(plan.unpack.outputBytes, 2632);
  assert.deepEqual(read(data, 0x7e2de6, 2), [0, 0x80]);
});

test('One shared work budget stops conversion after an otherwise successful unpack', () => {
  const data = original(),
    unpackData = original();
  const unpack = prepareRenderUnpack9F49({
    ...entry,
    data: unpackData,
    sourceOffset: 0xff40,
    sourceBankWord: 0x81,
    destination: 0x23a0,
  });
  unchanged(data, { maxWork: unpack.work + 927 }, 'render_work_budget_required', 'conversion');
  assert.ok(prepare(data, { maxWork: unpack.work + 928 }).handled);
  unchanged(data, { maxOutputBytes: 1855 }, 'render_output_budget_required', 'unpack');
});

test('Protected stack reads and writes are rejected across input, unpack, conversion and gates', () => {
  for (const [stackWindow, phase] of [
    [[0x1f4, 0x20f], 'unpack'],
    [[0xdb, 0xf3], 'unpack'],
    [[0x2ade, 0x2af0], 'unpack'],
    [[0x1d61, 0x1d80], 'af1f'],
  ])
    unchanged(original(), { stackWindow }, 'render_stack_alias_required', phase);
  // Short stream avoids the protected high buffer; its later conversion hits it.
  const short = original(0);
  short.seed(0x7e23f0, Array(1776).fill(0));
  unchanged(short, { stackWindow: [0x2ade, 0x2af0] }, 'render_stack_alias_required', 'conversion');
});

test('Write scope is checked before commit and cannot be replaced by known target bytes', () => {
  const data = fixture([0x5566], { writeWindows: [[0x7e23a0, 0x7e23a1]] });
  data.seed(0x7e23a2, Array(1854).fill(0));
  assert.equal(unchanged(data, {}, 'render_write_window_required', 'conversion').address, 0x7e2ade);
});

test('Entry/stack/address validation and foreign or stale combined plans leave all bytes unchanged', () => {
  const data = original();
  for (const extra of [
    { bank: null },
    { status: 8 },
    { status: 0x10 },
    { status: 0x20 },
    { emulation: 1 },
    { directPage: 1 },
  ])
    unchanged(data, extra, 'render_entry_required');
  for (const stackWindow of [null, Array(2), [0x1f00, 0x1f11]])
    unchanged(data, { stackWindow }, 'render_stack_required');
  unchanged(data, { bank: 0x40 }, 'render_address_required', 'unpack');
  assert.throws(() => prepare(data, { maxWork: 0 }));
  const plan = prepare(data);
  assert.throws(() => original().commit(plan));
  assert.throws(() => {
    plan.unpack.header = 0;
  });
  assert.equal(plan.unpack.byteWrites, undefined);
  data.seed(0x7e4000, [1]);
  const before = data.snapshot();
  assert.equal(data.commit(plan).reason, 'render_plan_stale');
  assert.deepEqual(data.snapshot(), before);
  commit(data, prepare(data));
});

test('Every original0740 source byte remains necessary and late failures expose no inner plan', () => {
  const source = asset.sources[1];
  for (let omitted = 0; omitted < source.bytes.length; omitted++) {
    const data = createRenderData({ writeWindows: [[0x7e23a0, 0x7e2adf]] });
    inputs(data, 0xff40, 0x81);
    seedWord(data, 0x7e1d61, 0);
    data.seed(asset.table.address, asset.table.bytes);
    source.bytes.forEach((b, i) => {
      if (i !== omitted) data.seed(source.address + i, [b]);
    });
    assert.equal(
      unchanged(data, {}, 'render_source_required', 'unpack').address,
      source.address + omitted,
    );
  }
});
