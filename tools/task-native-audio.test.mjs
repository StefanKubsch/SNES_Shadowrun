import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeAudioCompose as prepare } from '../proof/task/native-audio-compose.mjs';
import { taskAudioFixture as fixture, declaredAudioReads } from './task-native-audio-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { sampleWord, samplePointer } from './render-f130-fixtures.mjs';
const pairValues = (p) =>
  p.ioRequests
    .filter((r) => r.kind === 'write' && [0x81f050, 0x81f054].includes(r.pc))
    .map((r) => r.value);
const word = (data, address) =>
  data.readByte(address).value | (data.readByte(address + 1).value << 8);
const freeze = (v) => Object.freeze(v.map((r) => Object.freeze(r)));
const omit = (f, ...addresses) => {
  const set = new Set(addresses.map(renderAddress)),
    data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes) if (!set.has(a)) data.seed(a, [v]);
  return { ...f, data };
};
const readPairs = (n) => [[0x81f00e, 0], ...Array.from({ length: n }, (_, i) => [0x81f046, i + 1])];
test('OwnF130: complete raw/repeat/mixed paths, real savedY/savedLength, BYTE versus WORD addresswrap and actual tailA', () => {
  for (const count of [1, 2, 3, 4, 7]) {
    const values = Array.from({ length: count }, (_, i) => 0x80 + i),
      f = fixture(0x81f130, { address: 0x12ff, blocks: [{ kind: 'raw', values }] });
    f.ioObservations = declaredAudioReads(readPairs(1 + Math.ceil(count / 2)));
    const p = prepared(prepare, f);
    assert.equal(p.rawBytes, count);
    assert.equal(p.repeatWords, 0);
    assert.equal(p.outputContext.x, count);
    assert.equal(p.outputContext.y, 9);
    assert.equal(p.outputContext.a, 0);
    assert.equal(p.outputContext.status, 0xc5);
    assert.equal(p.returnTarget, 0x80f509);
    assert.deepEqual(pairValues(p), [255, 18, ...values, ...(count % 2 ? [values.at(-1)] : [])]);
    assert.ok(p.accesses.some((r) => r.label === 'F130-PHY-low'));
    assert.ok(p.accesses.some((r) => r.label === 'F130-PLY-fresh-high'));
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(word(f.data, 0x96), 0x1200 + count - 1);
  }
  for (const count of [1, 2, 3, 16]) {
    const f = fixture(0x81f130, {
      address: 65534,
      blocks: [{ kind: 'repeat', count, value: 0xabcd }],
    });
    f.ioObservations = declaredAudioReads(readPairs(count + 1));
    const p = prepared(prepare, f);
    assert.equal(p.repeatWords, count);
    assert.equal(p.rawBytes, 0);
    assert.equal(p.outputContext.x, count * 2);
    assert.equal(p.outputContext.y, 8);
    assert.deepEqual(pairValues(p), [
      254,
      255,
      ...Array.from({ length: count }, () => [205, 171]).flat(),
    ]);
    assert.ok(p.accesses.some((r) => r.label === 'F130-length-PHA-low'));
    assert.ok(p.accesses.some((r) => r.label === 'F130-length-PLX-fresh-high'));
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(word(f.data, 0x96), (65534 + 2 * count) % 65536);
  }
  const f = fixture(0x81f130, {
    blocks: [
      { kind: 'raw', values: [0xaa] },
      { kind: 'repeat', count: 2, value: 0xbeef },
      { kind: 'raw', values: [0x12, 0x34] },
    ],
  });
  f.ioObservations = declaredAudioReads(
    [
      0x81f00e, 0x81f046, 0x81f046, 0x81f00e, 0x81f046, 0x81f046, 0x81f046, 0x81f00e, 0x81f046,
      0x81f046,
    ].map((pc, value) => [pc, value]),
  );
  const p = prepared(prepare, f);
  assert.deepEqual(
    p.blocks.map((b) => [b.kind, b.headerIndex]),
    [
      ['raw', 4],
      ['repeat', 9],
      ['raw', 13],
    ],
  );
  assert.equal(p.outputContext.y, 18);
  assert.equal(p.rawBytes, 3);
  assert.equal(p.repeatWords, 2);
});
test('OwnF130: full directoryWORD wrap, fresh overlapping pointers/header/payload aliases and source-defined zero-count do-loops', () => {
  const wrapped = fixture(0x81f130, { directory: 0x7e5000, a: 0xab07 });
  wrapped.data.seed(0x7e5000, new Uint8Array(65536).fill(1));
  samplePointer(wrapped.data, 0x8c, 0x7e5000);
  wrapped.data.seed(0x7e5001, [255]);
  wrapped.ioObservations = Object.freeze([]);
  const w = prepared(prepare, wrapped);
  assert.equal(w.scanned, 16384);
  assert.equal(w.outputContext.y, 1);
  assert.equal(w.outputContext.a, 0xabff);
  const alias = fixture(0x81f130, {
    blocks: [{ kind: 'raw', pointer: 0x7e1ce4, values: [0, 0x42, 0, 0] }],
  });
  alias.ioObservations = declaredAudioReads(readPairs(3));
  const p = prepared(prepare, alias);
  assert.deepEqual(pairValues(p), [0x34, 0x12, 2, 0x42, 0, 0]);
  for (const [kind, expected] of [
    ['raw', [1, 0, 0xab, 0xab]],
    ['repeat', [2, 0, 2, 0]],
  ]) {
    const f = fixture(0x81f130, {
      blockPointer: 0x7e0090,
      ...(kind === 'repeat' ? { blocks: [{ kind, count: 1, value: 0xbeef }] } : {}),
    });
    f.data.seed(1, [0xab]);
    const q = prepared(prepare, f);
    assert.deepEqual(pairValues(q), expected);
  }
  for (const kind of ['raw', 'repeat']) {
    const f = fixture(0x81f130, {
      length: 3,
      blocks:
        kind === 'raw'
          ? [{ kind, count: 0, values: Array(64).fill(0) }]
          : [{ kind, count: 0, value: 0xabcd }],
    });
    f.ioObservations = declaredAudioReads(readPairs(255));
    unchangedFailure(prepare, f, { maxWork: 300 }, 'task_work_budget_required');
  }
});
test('OwnF100/F122/F1E8: fresh WORDdifference flags and actual WORD-PHA/two BYTE-PLAs without a cached saved word', () => {
  for (const left of [0, 1, 32767, 32768, 65535])
    for (const input of [0, 1, 32767, 32768, 65535]) {
      const f = fixture(0x81f100, { a: input });
      sampleWord(f.data, 0x92, left);
      const p = prepared(prepare, f),
        difference = (left - input) & 65535;
      const signed = (n) => (n < 32768 ? n : n - 65536),
        sd = signed(left) - signed(input);
      assert.equal(p.outputContext.a, difference);
      assert.equal(
        p.outputContext.status,
        4 |
          Number(left >= input) |
          (sd < -32768 || sd > 32767 ? 64 : 0) |
          (difference === 0 ? 2 : difference >= 32768 ? 128 : 0),
      );
    }
  for (const entry of [0x81f122, 0x81f1e8])
    for (const input of [0, 1, 0xab34, 32768, 65535]) {
      const f = fixture(entry, { a: input, address: 65535, flag: 0 }),
        p = prepared(prepare, f);
      assert.deepEqual(pairValues(p), [input & 255, input >>> 8]);
      assert.equal(p.outputContext.a, (input >>> 8) * 256 + 1);
      assert.equal(
        p.accesses.find((r) => r.label === 'audio-word-PLA-low-fresh').value,
        input & 255,
      );
      assert.equal(
        p.accesses.find((r) => r.label === 'audio-word-PLA-high-fresh').value,
        input >>> 8,
      );
      if (entry === 0x81f1e8) {
        assert.equal(commitTaskPlan(f.data, p).handled, true);
        assert.equal(word(f.data, 0x96), 1);
      }
    }
  const sentFirst = prepared(prepare, fixture(0x81f122, { a: 0xab34, flag: 1, buffer: 0x56 }));
  assert.deepEqual(pairValues(sentFirst), [0x56, 0x34]);
  assert.equal(sentFirst.outputContext.a, 0x34ab);
  const alias = fixture(0x81f122, { s: 0x1ce8 });
  const r = unchangedFailure(prepare, alias, {}, 'task_native_helper_return_required');
  assert.equal(r.pc, 0x81f126);
  assert.equal(r.raw, 0xf100);
});
test('Own audio: actual WRAM register banks need no MMIO observation and full long pointers carry into the next bank', () => {
  for (const entry of [0x81f130, 0x81f122, 0x81f1e8])
    for (const bank of [0x7e, 0x7f]) {
      const f = fixture(entry, { bank }),
        p = prepared(prepare, f);
      assert.equal(p.ioRequests.length, 0);
      assert.equal(p.outputContext.bank, bank);
      assert.equal(p.observationsUsed, 0);
      assert.equal(commitTaskPlan(f.data, p).handled, true);
    }
  for (const options of [
    { directory: 0x7efff9 },
    { blockPointer: 0x7effff },
    { blocks: [{ kind: 'raw', pointer: 0x7fffff, values: [0xaa, 0xbb] }] },
  ]) {
    const f = fixture(0x81f130, options),
      p = prepared(prepare, f);
    assert.equal(p.rawBytes, options.blocks ? 2 : 1);
    if (options.blocks) assert.deepEqual(pairValues(p), [0x34, 0x12, 0xaa, 0xbb]);
  }
});
test('OwnC46E: original forced PHK bank, low/high/cache/voice branches, actual saved-sound token alias and nonroot zero-voice RTS', () => {
  for (const bank of [0x80, 0x7e, 0x7f])
    for (const sound of [45, 0x8007])
      for (const cachedSound of [0, sound])
        for (const cachedVoice of [0, 3]) {
          const f = fixture(0x80c46e, { bank, sound, cachedSound, cachedVoice }),
            p = prepared(prepare, f);
          assert.equal(p.outputContext.bank, 0x80);
          assert.equal(p.sound, sound);
          assert.equal(p.loaderUsed, sound >= 32768 && cachedSound !== sound);
          assert.equal(p.voiceCacheHit, cachedVoice === 3);
          assert.equal(p.soundCacheHit, cachedSound === sound);
          assert.equal(p.rawReturnWord, 0xf508);
          assert.equal(p.returnTarget, 0x80f509);
          assert.equal(p.returnTargetExecuted, false);
          assert.equal(
            p.ioRequests.filter((r) => r.pc === 0x81f013).at(-1).value,
            0xff00 | (sound & 255),
          );
        }
  const alias = fixture(0x80c46e, { s: 0x1ce5 });
  alias.ioObservations = freeze([
    ...alias.ioObservations.slice(0, 2),
    ...[45, 46, 0xc4].map((value) => ({ pc: 0x81f00e, address: 0x802140, width: 1, value })),
  ]);
  // After actual sound PLA, the final JSL high return byte becomes token1CE4.
  // Its tokenstore increments C4 to C5 and corrupts the real C4B1 RTL WORD.
  const q = unchangedFailure(prepare, alias, {}, 'task_native_helper_return_required');
  assert.equal(q.pc, 0x80c4ae);
  assert.equal(q.raw, 0xc5b1);
  const zero = fixture(0x80c46e, { voice: 0 }),
    z = unchangedFailure(prepare, zero, {}, 'task_audio_return_required');
  assert.equal(z.rawReturnWord, 45);
  assert.equal(z.returnTarget, 0x80002e);
});
test('Whole own audio: source bytes, exact cumulative limits, real inner frame aliases and late observations fail atomically', () => {
  for (const entry of [0x80c46e, 0x81f130, 0x81f100, 0x81f122, 0x81f1e8]) {
    const f = fixture(entry),
      p = prepared(prepare, f);
    prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    unchangedFailure(prepare, omit(f, 0x701), {}, 'render_source_required');
    unchangedFailure(
      prepare,
      fixture(entry, { writeWindows: [] }),
      {},
      'render_write_window_required',
    );
    if (entry !== 0x81f100) {
      unchangedFailure(
        prepare,
        f,
        { ioObservations: Object.freeze(f.ioObservations.slice(0, -1)) },
        'task_io_observation_required',
      );
      unchangedFailure(
        prepare,
        f,
        { ioObservations: freeze([...f.ioObservations, f.ioObservations.at(-1)]) },
        'task_io_observation_unused',
      );
    }
  }
  const alias = fixture(0x81f130, {
    s: 0x9c,
    blocks: [{ kind: 'repeat', count: 1, value: 0xabcd }],
  });
  const r = unchangedFailure(prepare, alias, {}, 'task_native_helper_return_required');
  assert.equal(r.pc, 0x81f1c0);
  assert.equal(r.raw, 2);
  const low = fixture(0x81f130, { a: 7 });
  low.ioObservations = Object.freeze([]);
  const p = prepared(prepare, low);
  assert.equal(p.outcome, 'audio_loader_skipped');
  assert.equal(p.outputContext.a, 7);
  assert.equal(p.outputContext.status, 0xc5);
  const f = fixture(0x81f130),
    full = prepared(prepare, f),
    written = new Set(),
    required = new Set();
  for (const op of full.accesses)
    if (['write', 'read'].includes(op.kind)) {
      const owner = renderAddress(op.address);
      if (op.kind === 'write') written.add(owner);
      else if (!written.has(owner)) required.add(owner);
    }
  for (const address of required)
    unchangedFailure(prepare, omit(f, address), {}, 'render_source_required');
});
