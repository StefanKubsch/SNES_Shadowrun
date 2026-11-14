import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData } from '../src/render/data.mjs';
import { createOriginalRenderData } from '../proof/render/original-data.mjs';
import { prepareRenderUnpack9F49 } from '../proof/render/unpack-9f49.mjs';

const asset = JSON.parse(
  await readFile(new URL('../assets/render-unpack-data.json', import.meta.url), 'utf8'),
);
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(
  await readFile(new URL('../analysis/render-unpack-original.json', import.meta.url), 'utf8'),
);
const digest = (bytes) => createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const context = {
  sourceOffset: 0x9000,
  sourceBankWord: 0x80,
  destination: 0x23a0,
  bank: 0x80,
  status: 0,
  emulation: 0,
  directPage: 0,
  stackWindow: [0x1f00, 0x1fff],
};
const table = Array.from({ length: 256 }, (_, n) => (n ? n.toString(2).length : 0));
const lengthBits = (n) => [...n.toString(2).slice(1)].flatMap((c) => [0, Number(c)]).concat(1);
const fixedBits = (value, width) =>
  Array.from({ length: width }, (_, i) => (value >>> (width - 1 - i)) & 1);
// Synthetic token encoder only; does not call the native decoder.
function stream(header, payload, bits) {
  const out = [
    header & 255,
    header >>> 8,
    (payload.length + 2) & 255,
    (payload.length + 2) >>> 8,
    ...payload,
  ];
  while (bits.length % 16) bits = bits.concat(0);
  for (let i = 0; i < bits.length; i += 8)
    out.push(bits.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
  return out;
}
function fixture(header, payload, bits, options = {}) {
  const data = createRenderData({ writeWindows: options.writeWindows ?? [[0x7e23a0, 0x7effff]] });
  data.seed(0x809000, stream(header, payload, bits));
  data.seed(0x80a033, table);
  return data;
}
const prepare = (data, extra = {}) => prepareRenderUnpack9F49({ ...context, data, ...extra });
const read = (data, address, length) =>
  Array.from({ length }, (_, i) => {
    const value = data.readByte(address + i);
    assert.equal(value.available, true);
    return value.value;
  });
function commit(data, plan) {
  assert.equal(plan.handled, true, JSON.stringify(plan));
  assert.deepEqual(data.commit(plan), { handled: true });
}
function unchanged(data, extra, reason) {
  const before = data.snapshot(),
    result = prepare(data, extra);
  assert.equal(result.handled, false);
  assert.equal(result.reason, reason);
  assert.deepEqual(data.snapshot(), before);
  assert.equal(result.byteWrites, undefined);
  return result;
}

test('Original source windows and bit table are byte-exact ROM data, never output seeds', () => {
  assert.equal(digest(rom), asset.romSha256);
  for (const w of [asset.table, ...asset.sources]) {
    assert.deepEqual(w.bytes, [
      ...rom.subarray(w.sourceRomOffset, w.sourceRomOffset + w.bytes.length),
    ]);
    assert.equal(digest(w.bytes), w.sha256);
  }
  assert.deepEqual(asset.table.bytes, table);
  const data = createOriginalRenderData(asset);
  assert.equal(data.snapshot().bytes.length, 340);
  assert.equal(data.readByte(0x7e23a0).available, false);
  assert.equal(data.readByte(0xdb).available, false);
});

test('WORD and odd BYTE literals preserve neighbors and advance exact cursors', () => {
  for (const size of [1, 2, 3, 4, 7, 16, 31]) {
    const payload = Array.from({ length: size }, (_, i) => (i * 7) & 255);
    const data = fixture(size, payload, lengthBits(size));
    data.seed(0x7e239f, [0x55]);
    data.seed(0x7e23a0 + size, [0x66]);
    const before = data.snapshot(),
      plan = prepare(data, { sourceBankWord: 0x3a80 });
    assert.deepEqual(data.snapshot(), before);
    commit(data, plan);
    assert.deepEqual(read(data, 0x7e23a0, size), payload);
    assert.deepEqual(read(data, 0xe3, 2), [0x80, 0x3a]);
    assert.equal(plan.header, size);
    assert.equal(plan.outputBytes, size);
    assert.equal(plan.emittedCount, size);
    assert.equal(plan.x, 0x23a0 + size);
    assert.equal(plan.y, 4 + size);
    assert.equal(data.readByte(0x7e239f).value, 0x55);
    assert.equal(data.readByte(0x7e23a0 + size).value, 0x66);
  }
});

test('Forward reference sees newly emitted bytes and counts EB+1, including overshoot', () => {
  const data = fixture(5, [0xa7], [1, 0, ...lengthBits(3)]);
  const plan = prepare(data);
  commit(data, plan);
  assert.deepEqual(read(data, 0x7e23a0, 6), Array(6).fill(0xa7));
  assert.equal(plan.outputBytes, 6);
  assert.equal(plan.emittedCount, 6);
  assert.equal(plan.references, 1);
  assert.deepEqual(read(data, 0xeb, 2), [4, 0]);
});

test('Reference source need not precede destination when its real bytes are known', () => {
  const data = fixture(4, [0xa7], [1, 1, 1]);
  data.seed(0x7e23a1, [9, 8, 7]);
  const plan = prepare(data);
  commit(data, plan);
  assert.deepEqual(read(data, 0x7e23a0, 4), [0xa7, 9, 8, 7]);
  assert.equal(plan.outputBytes, 4);
});

test('Selector zero chooses another literal; selector one chooses another reference', () => {
  for (const selector of [0, 1]) {
    const bits = [1, 0, 1, selector, ...(selector ? [0, 0, 0, 1] : [1])];
    const data = fixture(selector ? 7 : 5, selector ? [0xa7] : [0xa7, 0xb8], bits);
    const plan = prepare(data);
    commit(data, plan);
    assert.deepEqual(
      read(data, 0x7e23a0, selector ? 7 : 5),
      selector ? Array(7).fill(0xa7) : [0xa7, 0xa7, 0xa7, 0xa7, 0xb8],
    );
    assert.equal(plan.literals, selector ? 1 : 2);
    assert.equal(plan.references, selector ? 2 : 1);
  }
});

test('High-byte E9 alias selects reference width after sixteen-bit bitstream refill', () => {
  for (const size of [255, 256, 511, 512]) {
    const width = size.toString(2).length,
      payload = Array.from({ length: size }, (_, i) => i & 255);
    const data = fixture(size + 3, payload, [
      ...lengthBits(size),
      ...fixedBits(size - 1, width),
      1,
    ]);
    const plan = prepare(data);
    commit(data, plan);
    assert.deepEqual(read(data, 0x7e23a0, size + 3), [
      ...payload,
      payload.at(-1),
      payload.at(-1),
      payload.at(-1),
    ]);
    assert.equal(plan.bits, lengthBits(size).length + width + 1);
    assert.equal(plan.outputBytes, size + 3);
  }
});

test('Zero header still emits one literal; WORD-wrapped zero length also emits one BYTE', () => {
  for (const bits of [[1], [...Array(16).fill([0, 0]).flat(), 1]]) {
    const data = fixture(0, [0x81], bits),
      plan = prepare(data);
    commit(data, plan);
    assert.deepEqual(read(data, 0x7e23a0, 1), [0x81]);
    assert.equal(plan.outputBytes, 1);
    assert.equal(plan.emittedCount, bits.length === 1 ? 1 : 0);
  }
});

test('Zero-width reference retains source do/while semantics and stops at host budget', () => {
  const data = fixture(1, [0x81], [...Array(16).fill([0, 0]).flat(), 1, ...Array(64).fill(0)]);
  unchanged(data, { maxWork: 50 }, 'render_work_budget_required');
});

test('Late unknown literal, bit refill and reference source all leave every scratch byte untouched', () => {
  const cases = [
    [stream(1, [2], [1]).slice(0, 5), -1],
    [stream(3, [1, 2, 3], lengthBits(3)), 6],
    [stream(4, [1], [1, 1, 1]), -1],
  ];
  for (const [bytes, omitted] of cases) {
    const data = createRenderData({ writeWindows: [[0x7e23a0, 0x7e2adf]] });
    bytes.forEach((value, i) => {
      if (i !== omitted) data.seed(0x809000 + i, [value]);
    });
    data.seed(0x80a033, table);
    data.seed(0xdb, Array(24).fill(0x5a));
    unchanged(data, {}, 'render_source_required');
  }
});

test('Missing table read cannot be replaced by a calculated bit length', () => {
  const data = createRenderData({ writeWindows: [[0x7e23a0, 0x7e2adf]] });
  data.seed(0x809000, stream(4, [1], [1, 0, 1]));
  const result = unchanged(data, {}, 'render_source_required');
  assert.equal(result.address, 0x80a034);
});

test('Entry, stack, write authority, output and work boundaries are explicit and atomic', () => {
  const data = fixture(4, [1, 2, 3, 4], lengthBits(4));
  for (const extra of [
    { bank: null },
    { status: null },
    { emulation: 1 },
    { directPage: 1 },
    { status: 8 },
    { status: 0x10 },
    { status: 0x20 },
  ])
    unchanged(data, extra, 'render_entry_required');
  for (const stackWindow of [null, [0x1ff0, 0x1fff], [3, 2], Array(2)])
    unchanged(data, { stackWindow }, 'render_stack_required');
  unchanged(data, { stackWindow: [0x23a2, 0x23b3] }, 'render_stack_alias_required');
  unchanged(data, { stackWindow: [0xdb, 0xf2] }, 'render_stack_alias_required');
  unchanged(data, { maxOutputBytes: 3 }, 'render_output_budget_required');
  unchanged(data, { maxWork: 1 }, 'render_work_budget_required');
  const limited = fixture(4, [1, 2, 3, 4], lengthBits(4), { writeWindows: [[0x7e23a0, 0x7e23a2]] });
  unchanged(limited, {}, 'render_write_window_required');
});

test('All incoming DBRs and binary WORD status bits are restored as opaque caller values', () => {
  const data = fixture(1, [9], [1]);
  for (let bank = 0; bank < 256; bank++)
    for (const status of [0, 1, 2, 4, 0x40, 0x80, 0xc7]) {
      const plan = prepare(data, { bank, status });
      assert.equal(plan.handled, true);
      assert.equal(plan.bank, bank);
      assert.equal(plan.status, status);
    }
});

test('Low WRAM mirrors and original ROM bank aliases have one canonical byte owner', () => {
  const data = fixture(1, [9], [1]);
  // 00:80DB is ROM, whereas 80:00DB and 00:00DB are WRAM aliases.
  data.seed(0x8000db, [0x71]);
  assert.equal(data.readByte(0xdb).value, 0x71);
  assert.equal(data.readByte(0x7e00db).value, 0x71);
  assert.equal(data.readByte(0x009000).value, 1);
  assert.equal(data.readByte(0x804200).reason, 'render_address_required');
  assert.equal(data.readByte(0xa08000).reason, 'render_address_required');
  assert.equal(prepare(data, { sourceBankWord: 0 }).handled, true);
});

test('WRAM source/output overlap observes ordered WORD reads rather than a frozen source copy', () => {
  const data = createRenderData({ writeWindows: [[0x7e3000, 0x7e30ff]] });
  data.seed(0x7e3000, stream(4, [1, 2, 3, 4], lengthBits(4)));
  const plan = prepare(data, { sourceOffset: 0x3000, sourceBankWord: 0x7e, destination: 0x3006 });
  commit(data, plan);
  assert.deepEqual(read(data, 0x7e3006, 4), [1, 2, 1, 2]);
});

test('Output alias to scratch changes the fresh emitted counter and can extend decoding', () => {
  const data = fixture(1, [1], [1]);
  // Literal to EB overwrites the decoded length1 with2; E9 accounting must
  // reread EB, not reuse an isolated length variable.
  data.seed(0x809004, [2]);
  const plan = prepare(data, { destination: 0xeb });
  commit(data, plan);
  assert.equal(plan.outputBytes, 1);
  assert.equal(plan.emittedCount, 2);
  assert.deepEqual(read(data, 0xeb, 2), [2, 0]);
});

test('A literal WORD overwriting ED changes the next loop test rather than an isolated counter', () => {
  const data = fixture(4, [1, 0, 7, 8], lengthBits(4));
  const plan = prepare(data, { destination: 0xed });
  commit(data, plan);
  assert.equal(plan.outputBytes, 2);
  assert.equal(plan.emittedCount, 4);
  assert.equal(plan.x, 0xef);
  assert.equal(plan.y, 6);
  assert.deepEqual(read(data, 0xed, 2), [0, 0]);
});

test('Literal writes to E1/E2 change the pointer used by the very next source WORD', () => {
  const data = fixture(4, [0, 0x91, 7, 8], lengthBits(4));
  data.seed(0x809106, [0x12, 0x34]);
  const plan = prepare(data, { destination: 0xe1 });
  commit(data, plan);
  assert.deepEqual(read(data, 0xe1, 4), [0, 0x91, 0x12, 0x34]);
  assert.equal(plan.outputBytes, 4);
  assert.ok(plan.readAddresses.includes(0x809106));
  assert.ok(!plan.readAddresses.includes(0x809006));
});

test('Output accounting rereads the aliased E9 word after the literal write', () => {
  const data = fixture(255, [0xfe], [1]);
  const plan = prepare(data, { destination: 0xe9 });
  commit(data, plan);
  assert.equal(plan.outputBytes, 1);
  assert.equal(plan.emittedCount, 255);
  assert.deepEqual(read(data, 0xe9, 2), [255, 0]);
});

test('Reference wraps sixteen-bit MVN offsets; literal WORD FFFF is an explicit source boundary', () => {
  const data = fixture(4, [0xa7], [1, 0, 1], {
    writeWindows: [
      [0x7effff, 0x7effff],
      [0x7e0000, 0x7e0002],
    ],
  });
  const plan = prepare(data, { destination: 0xffff });
  commit(data, plan);
  assert.equal(data.readByte(0x7effff).value, 0xa7);
  assert.deepEqual(read(data, 0x7e0000, 3), [0xa7, 0xa7, 0xa7]);
  assert.equal(plan.y, 3);
  unchanged(
    fixture(2, [1, 2], lengthBits(2)),
    { destination: 0xffff },
    'render_word_bank_edge_required',
  );
});

test('Long source crosses banks using actual low-WRAM bytes rather than LoROM continuation', () => {
  const data = createRenderData({ writeWindows: [[0x7e23a0, 0x7e2adf]] });
  const bytes = stream(1, [0x81], [1]);
  data.seed(0x80fffc, bytes.slice(0, 4));
  data.seed(0x810000, bytes.slice(4));
  const plan = prepare(data, { sourceOffset: 0xfffc });
  commit(data, plan);
  assert.deepEqual(read(data, 0x7e23a0, 1), [0x81]);
  const missing = createRenderData({ writeWindows: [[0x7e23a0, 0x7e2adf]] });
  missing.seed(0x80fffc, bytes.slice(0, 4));
  assert.equal(
    unchanged(missing, { sourceOffset: 0xfffc }, 'render_source_required').address,
    0x7e0001,
  );
});

test('Commit rejects stale/foreign plans and successful payload cannot be edited or replayed', () => {
  const data = fixture(1, [2], [1]),
    plan = prepare(data),
    other = fixture(1, [2], [1]);
  assert.throws(() => other.commit(plan));
  assert.throws(() => data.commit({ handled: true }));
  assert.throws(() => {
    plan.byteWrites[0][1] = 0;
  });
  commit(data, plan);
  const before = data.snapshot();
  assert.equal(data.commit(plan).reason, 'render_plan_stale');
  assert.deepEqual(data.snapshot(), before);
  const second = prepare(data);
  data.seed(0x7e4000, [1]);
  assert.equal(data.commit(second).reason, 'render_plan_stale');
});

test('Invalid provider seeds and malformed contexts cannot partially hydrate or write', () => {
  const data = fixture(1, [2], [1]),
    before = data.snapshot();
  for (const values of [
    [1, 300],
    [1, undefined],
    [1, , 2],
  ])
    assert.throws(() => data.seed(0x7e5000, values));
  assert.throws(() => data.seed(0x809fff, [1, -1]));
  assert.deepEqual(data.snapshot(), before);
  for (const extra of [
    { sourceOffset: -1 },
    { sourceBankWord: 65536 },
    { destination: null },
    { maxWork: 0 },
    { maxOutputBytes: NaN },
  ])
    assert.throws(() => prepare(data, extra));
  assert.throws(() => createRenderData({ writeWindows: [[0x804200, 0x804202]] }));
  assert.throws(() => createRenderData({ writeWindows: [Array(2)] }));
  assert.throws(() => createRenderData({ writeWindows: Array(1) }));
  assert.throws(() => createOriginalRenderData({ ...asset, romSha256: 'wrong' }));
});

// Independent stream-only reference for nonaliased original ROM inputs.
// It reads individual bits from bytes, uses ordinary token lengths/output
// arrays and has no scratch, native provider, bit-word buffer or registers.
function originalReference(bytes) {
  const target = bytes[0] + bytes[1] * 256,
    bitStart = bytes[2] + bytes[3] * 256 + 2;
  let bitIndex = 0,
    literalIndex = 4,
    nextLiteral = true;
  const output = [];
  const bit = () => {
    const index = bitStart + Math.floor(bitIndex / 8);
    assert.ok(index < bytes.length);
    return (bytes[index] >>> (7 - (bitIndex++ % 8))) & 1;
  };
  const size = () => {
    let n = 1;
    while (bit() === 0) n = n * 2 + bit();
    return n;
  };
  while (output.length < target) {
    if (nextLiteral) {
      const n = size();
      for (let i = 0; i < n; i++) {
        assert.ok(literalIndex < bitStart);
        output.push(bytes[literalIndex++]);
      }
      nextLiteral = false;
    } else {
      let from = 0;
      for (let i = 0; i < output.length.toString(2).length; i++) from = from * 2 + bit();
      const n = size() + 2;
      for (let i = 0; i < n; i++) {
        assert.ok(from < output.length);
        output.push(output[from++]);
      }
      if (output.length < target) nextLiteral = bit() === 0;
    }
  }
  return output;
}

test('Both original streams match independent token decoding, pinned full output and generated report', () => {
  for (let i = 0; i < 2; i++) {
    const data = createOriginalRenderData(asset, { writeWindows: [[0x7e23a0, 0x7e2adf]] });
    const plan = prepare(data, {
      sourceOffset: i ? 0xff40 : 0xff98,
      sourceBankWord: i ? 0x81 : 0x3a80,
    });
    commit(data, plan);
    const output = read(data, 0x7e23a0, i ? 1856 : 80);
    assert.deepEqual(output, originalReference(asset.sources[i].bytes));
    const r = report.plans[i];
    assert.equal(digest(output), r.outputSha256);
    assert.equal(
      digest(output),
      i
        ? 'c9b298e9c99f0d829fcf4cf60c3d836b9a7f564e54d8b2abf512f5aae1c11609'
        : '3f42213779cc8c39ce0b7436c68ed0ea4907b5df2f5588b0e6709ee2e45dd0c0',
    );
    for (const key of [
      'header',
      'outputBytes',
      'emittedCount',
      'bits',
      'literals',
      'references',
      'x',
      'y',
    ])
      assert.equal(plan[key], r[key]);
    assert.deepEqual(plan.readAddresses, r.readAddresses);
    assert.deepEqual(
      data.snapshot().bytes.filter(([a]) => a >= 0x7e00db && a <= 0x7e00f2),
      r.scratchBytes,
    );
  }
});

test('Every omitted original stream byte stops atomically, including the final bit-word highbyte', () => {
  for (let i = 0; i < 2; i++)
    for (let omitted = 0; omitted < asset.sources[i].bytes.length; omitted++) {
      const data = createRenderData({ writeWindows: [[0x7e23a0, 0x7e2adf]] });
      data.seed(asset.table.address, asset.table.bytes);
      const source = asset.sources[i];
      source.bytes.forEach((v, j) => {
        if (j !== omitted) data.seed(source.address + j, [v]);
      });
      const result = unchanged(
        data,
        { sourceOffset: source.address & 0xffff, sourceBankWord: i ? 0x81 : 0x3a80 },
        'render_source_required',
      );
      assert.equal(result.address, source.address + omitted);
    }
});
