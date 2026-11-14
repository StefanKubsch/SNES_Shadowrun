import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareTaskUnpack9F49 } from '../proof/task/native-unpack.mjs';
import { prepareTaskNativeA9B2 } from '../proof/task/native-a9b2.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { prepareRenderUnpack9F49 } from '../proof/render/unpack-9f49.mjs';
import { prepareRenderA9B2 } from '../proof/render/a9b2.mjs';
import {
  taskUnpackFixture,
  lengthBits,
  fixedBits,
  encodedStream,
} from './task-native-unpack-fixtures.mjs';
const prepare = (f, patch = {}) => {
  const before = f.data.snapshot(),
    p = (f.entry === 0x809f49 ? prepareTaskUnpack9F49 : prepareTaskNativeA9B2)({ ...f, ...patch });
  assert.deepEqual(f.data.snapshot(), before);
  return p;
};
const word = (p, address) => {
  const m = new Map(p.byteWrites);
  return m.get(address) | (m.get(address + 1) << 8);
};
function compareOld(f) {
  const p = prepare(f);
  assert.equal(p.handled, true, JSON.stringify(p));
  const c = f.context;
  const options = {
    data: f.data,
    bank: c.bank,
    status: c.status,
    emulation: 0,
    directPage: 0,
    stackWindow: [0x1f00, 0x1fff],
    maxWork: 1000000,
    maxOutputBytes: 1000000,
    sourceOffset: c.a,
    sourceBankWord: c.y,
    destination: c.x,
    divisionMode: 'stable-native',
  };
  const old = (f.entry === 0x809f49 ? prepareRenderUnpack9F49 : prepareRenderA9B2)(options);
  assert.equal(old.handled, true, JSON.stringify(old));
  assert.deepEqual(
    [
      p.outputContext.a,
      p.outputContext.x,
      p.outputContext.y,
      p.outputContext.bank,
      p.outputContext.status,
    ],
    [old.a, old.x, old.y, old.bank, old.status],
  );
  const writes = new Map(p.byteWrites);
  for (const [address, value] of old.byteWrites)
    assert.equal(writes.get(address), value, `@${address.toString(16)}`);
  if (f.entry === 0x809f49)
    assert.deepEqual(
      [p.bits, p.literals, p.references, p.literalBytes + p.referenceBytes],
      [old.bits, old.literals, old.references, old.outputBytes],
    );
  return p;
}
test('Task unpack: literals, forward MVN, overshoot, both selectors and bit-refill widths agree independently', () => {
  for (const size of [1, 2, 3, 4, 17, 32, 255, 256, 511, 512]) {
    const payload = Array.from({ length: size }, (_, i) => (i * 7) & 255);
    compareOld(
      taskUnpackFixture({ header: size, payload, bits: lengthBits(size), sourceBankWord: 0x3a80 }),
    );
  }
  compareOld(taskUnpackFixture({ header: 5, payload: [0xa7], bits: [1, 0, ...lengthBits(3)] }));
  for (const selector of [0, 1])
    compareOld(
      taskUnpackFixture({
        header: selector ? 7 : 5,
        payload: selector ? [0xa7] : [0xa7, 0xb8],
        bits: [1, 0, 1, selector, ...(selector ? [0, 0, 0, 1] : [1])],
      }),
    );
  for (const size of [255, 256, 511, 512]) {
    compareOld(
      taskUnpackFixture({
        header: size + 3,
        payload: Array.from({ length: size }, (_, i) => i & 255),
        bits: [...lengthBits(size), ...fixedBits(size - 1, size.toString(2).length), 1],
      }),
    );
  }
});
test('Task unpack: both original compressed streams match independent pinned decoded hashes with actual stack returns', () => {
  for (const original of [0, 1]) {
    const f = taskUnpackFixture({ original }),
      p = compareOld(f),
      m = new Map(p.byteWrites),
      length = original ? 1856 : 80;
    const bytes = Uint8Array.from({ length }, (_, i) => m.get(0x7e23a0 + i));
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      original
        ? 'c9b298e9c99f0d829fcf4cf60c3d836b9a7f564e54d8b2abf512f5aae1c11609'
        : '3f42213779cc8c39ce0b7436c68ed0ea4907b5df2f5588b0e6709ee2e45dd0c0',
    );
    assert.equal(p.returnTarget, 0x81a9c0);
    assert.equal(p.outputContext.s, 0x702);
    assert.ok(p.accesses.some((e) => e.label === 'unpack-header-PLA-fresh-low'));
    assert.ok(p.accesses.some((e) => e.label === 'unpack-root-PLP-fresh'));
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  }
});
test('Task unpack: zero WORD lengths retain BYTE tail and zero reference width retains bounded full loop', () => {
  for (const bits of [[1], [...Array(16).fill([0, 0]).flat(), 1]]) {
    const p = compareOld(taskUnpackFixture({ header: 0, payload: [0x81], bits }));
    assert.equal(p.literalBytes, 1);
  }
  const f = taskUnpackFixture({
    header: 1,
    payload: [0x81],
    bits: [...Array(16).fill([0, 0]).flat(), 1, ...Array(64).fill(0)],
  });
  assert.equal(prepare(f, { maxWork: 200 }).reason, 'task_work_budget_required');
});
test('Task unpack: fresh scratch/pointer/output aliases and source overlap preserve source store order', () => {
  for (const [header, payload, bits, destination] of [
    [1, [0xfe], [1], 0xeb],
    [4, [1, 0, 7, 8], lengthBits(4), 0xed],
    [255, [0xfe], [1], 0xe9],
    [4, [0, 0x91, 7, 8], lengthBits(4), 0xe1],
  ]) {
    const f = taskUnpackFixture({ header, payload, bits, destination });
    if (destination === 0xe1) f.data.seed(0x809106, [0x12, 0x34]);
    compareOld(f);
  }
  const f = taskUnpackFixture();
  f.data.seed(0x7e3000, encodedStream(4, [1, 2, 3, 4], lengthBits(4)));
  const c = Object.freeze({ ...f.context, a: 0x3000, y: 0x7e, x: 0x3006 });
  const p = prepare(f, { context: c });
  assert.equal(p.handled, true);
  const m = new Map(p.byteWrites);
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => m.get(0x7e3006 + i)),
    [1, 2, 1, 2],
  );
  const edge = prepare(
    taskUnpackFixture({
      header: 2,
      payload: [0x12, 0x34],
      bits: lengthBits(2),
      destination: 0xffff,
    }),
  );
  assert.equal(edge.handled, true);
  assert.equal(new Map(edge.byteWrites).get(0x7effff), 0x12);
  assert.equal(new Map(edge.byteWrites).get(0x7f0000), 0x34);
});
test('Task unpack: actual bank/status bytes are restored, corrupted real return/status aliases stop atomically', () => {
  for (const bank of [0, 1, 0x7e, 0x80, 0x81, 0xff])
    for (const status of [0, 1, 2, 4, 0x40, 0x80, 0xc7]) {
      const p = compareOld(taskUnpackFixture({ header: 1, payload: [9], bits: [1], bank, status }));
      assert.equal(p.outputContext.bank, bank);
      assert.equal(p.outputContext.status, status);
    }
  for (const s of [0xe1, 0xed, 0x23a0]) {
    const p = prepare(taskUnpackFixture({ s }));
    assert.equal(p.handled, false);
    assert.ok(
      [
        'task_native_helper_return_required',
        'task_text_word_mode_required',
        'task_unpack_word_mode_required',
        'render_source_required',
        'render_address_required',
        'task_stack_alias_required',
      ].includes(p.reason),
      p.reason,
    );
  }
  const f = taskUnpackFixture({
    header: 2,
    payload: [0x20, 0],
    bits: lengthBits(2),
    destination: 0x6fd,
  });
  assert.equal(prepare(f).reason, 'task_unpack_word_mode_required');
});
test('Task A9B2: original decompression, all928 conversion WORDs, observed AF1F and restored real RTL are one plan', () => {
  for (const original of [null, 1]) {
    const f = taskUnpackFixture({
        compose: true,
        original,
        header: 1856,
        payload: Array(1856).fill(0),
        bits: lengthBits(1856),
      }),
      p = compareOld(f);
    assert.equal(p.conversionWords, 928);
    assert.equal(p.returnTarget, 0x81ad96);
    assert.equal(p.outputContext.s, 0x702);
    assert.deepEqual([p.af1f.firstVisits, p.af1f.middleVisits, p.af1f.tableOffset], [3, 3, 50]);
    assert.equal(p.ioRequests.filter((e) => e.kind === 'read').length, 6);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
  }
  const f = taskUnpackFixture({
      compose: true,
      header: 1856,
      payload: Array(1856).fill(0),
      bits: lengthBits(1856),
      values: [2, 7, 5, 1, 3, 4],
    }),
    p = prepare(f);
  assert.equal(p.handled, true);
  assert.deepEqual([p.af1f.firstVisits, p.af1f.middleVisits, p.af1f.tableOffset], [2, 2, 30]);
});
test('Task A9B2: short header cannot imply full conversion source; carry propagates down all928 WORDs', () => {
  const short = taskUnpackFixture({ compose: true, header: 1, payload: [0], bits: [1] });
  assert.equal(prepare(short).reason, 'render_source_required');
  for (const gate of [{ firstGate: 0 }, { secondGate: 0x8001 }]) {
    const payload = Array(1856).fill(0xff),
      f = taskUnpackFixture({
        compose: true,
        header: 1856,
        payload,
        bits: lengthBits(1856),
        ...gate,
        values: [],
      }),
      p = compareOld(f);
    assert.equal(word(p, 0x7e2ade), 0x2016);
    assert.equal(word(p, 0x7e23a0), 0x2017);
    assert.equal(p.ioRequests.length, 0);
  }
});
test('Task unpack/A9B2: late source, work/output/windows, immutable IO and owner failures leave all bytes unchanged', () => {
  for (const compose of [false, true]) {
    const inputs = compose
      ? { header: 1856, payload: Array(1856).fill(0), bits: lengthBits(1856) }
      : {};
    const f = taskUnpackFixture({ compose, ...inputs }),
      p = prepare(f);
    assert.equal(p.handled, true);
    assert.equal(prepare(f, { maxWork: p.work - 1 }).reason, 'task_work_budget_required');
    assert.equal(
      prepare(f, { maxOutputBytes: p.outputBytes - 1 }).reason,
      'task_output_budget_required',
    );
    assert.equal(
      prepare(f, { protectedStackBytes: [...f.protectedStackBytes, 0x7e06ff] }).reason,
      'task_stack_alias_required',
    );
    const other = taskUnpackFixture({ compose, ...inputs });
    assert.equal(commitTaskPlan(other.data, p).reason, 'task_plan_owner_required');
    assert.equal(
      prepare(
        taskUnpackFixture({
          compose,
          ...inputs,
          writeWindows: [[0x7e0000, compose ? 0x7e2add : 0x7e23a2]],
        }),
      ).reason,
      'render_write_window_required',
    );
    for (const omit of compose ? [0x809001, 0x809745, 0x8db8d3, 0x7e33df] : [0x809001, 0x809009]) {
      const missing = prepare(taskUnpackFixture({ compose, ...inputs, omit }));
      assert.equal(missing.reason, 'render_source_required');
      assert.equal(missing.address, omit);
    }
    if (compose) {
      assert.equal(
        prepare(f, { ioObservations: Object.freeze(f.ioObservations.slice(0, -1)) }).reason,
        'task_io_observation_required',
      );
      assert.equal(
        prepare(f, {
          ioObservations: Object.freeze([...f.ioObservations, f.ioObservations.at(-1)]),
        }).reason,
        'task_io_observation_unused',
      );
    }
  }
});
