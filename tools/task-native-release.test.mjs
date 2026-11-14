import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeA8F5 as prepare } from '../proof/task/native-a8f5.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
const put = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const word = (f, a) => f.data.readByte(a).value | (f.data.readByte(a + 1).value << 8);
test('B9 original list shift leaves the actual tail, uses two fresh DEC stores and frees the full slot', () => {
  const f = taskLeafFixture(0x80a8f5);
  put(f, 0x8014b0, 4);
  put(f, 0x8014b2, 0x10);
  put(f, 0x8014b4, 0x20);
  put(f, 0x8014b6, 0x30);
  const p = commit(prepare, f);
  assert.equal(word(f, 0x8014b0), 2);
  assert.equal(word(f, 0x8014b2), 0x20);
  assert.equal(word(f, 0x8014b4), 0x30);
  assert.equal(word(f, 0x8014b6), 0x30);
  assert.equal(word(f, 0x7e3f38), 65535);
  assert.equal(word(f, 0x801048), 65535);
  for (const address of [
    0x7e4250, 0x7e42a8, 0x7e4300, 0x7e4358, 0x7e43b0, 0x7e40f0, 0x801150, 0x7e3f90, 0x8010a0,
  ])
    assert.equal(word(f, address), 0);
  assert.equal(word(f, 0x7e4040), 0x80);
  assert.equal(word(f, 0x7e3fe8), 1);
  assert.equal(p.outputContext.a, 0x10);
  assert.equal(p.outputContext.x, 0);
  assert.equal(p.outputContext.y, 0x10);
  assert.equal(p.outputContext.status & 0x83, 3);
  assert.equal(p.returnTarget, 0x80c20b);
});
test('AA4C unlinks every actual node and updates free count/head in source order, including wrapped binary ADC', () => {
  for (const free of [0, 0x7fff, 0xfffe]) {
    const f = taskLeafFixture(0x80a8f5);
    put(f, 0x8012b0, 3);
    put(f, 0x801308, 0x200);
    put(f, 0x800d1c, free);
    put(f, 0x800d1e, 0x500);
    for (const [node, next] of [
      [0x200, 0x300],
      [0x300, 0x400],
      [0x400, 0xffff],
    ])
      put(f, 0x801564 + node, next);
    const p = commit(prepare, f);
    assert.equal(word(f, 0x8012b0), 0);
    assert.equal(word(f, 0x801308), 65535);
    assert.equal(word(f, 0x800d1c), (free + 3) & 65535);
    assert.equal(word(f, 0x800d1e), 0x400);
    assert.equal(word(f, 0x801764), 0x500);
    assert.equal(word(f, 0x801864), 0x200);
    assert.equal(word(f, 0x801964), 0x300);
    assert.equal(word(f, 0x17), 0);
    assert.equal(p.accesses.filter((a) => a.label === 'release-DEC-DP17-low').length, 3);
    assert.equal(p.outputContext.status & 0x40, free === 0x7fff ? 0x40 : 0);
  }
});
test('B9 keeps full odd indices and freshly reloads DP00 after helper aliases; changed inner RTS rejects all prior effects', () => {
  const f = taskLeafFixture(0x80a8f5);
  put(f, 0, 0x11);
  put(f, 0x8012b1, 0);
  put(f, 0x8014b2, 0x11);
  assert.equal(commit(prepare, f).outputContext.a, 0x11);
  assert.equal(word(f, 0x7e3f39), 65535);
  const alias = taskLeafFixture(0x80a8f5);
  put(alias, 0, 0xefc8);
  put(alias, 0x810268, 0);
  put(alias, 0x8014b2, 65535);
  const p = commit(prepare, alias);
  assert.equal(word(alias, 0), 65535);
  assert.equal(word(alias, 0x7f3f27), 65535);
  assert.equal(p.outputContext.a, 65535);
  assert.equal(p.outputContext.status & 0x83, 3);
  const bad = taskLeafFixture(0x80a8f5, { s: 0x1049, savedOuterS: 0x1049 });
  unchangedFailure(prepare, bad, {}, 'task_native_helper_return_required');
});
test('B9 never invents termination or truncates the linked WORD count', () => {
  const f = taskLeafFixture(0x80a8f5);
  put(f, 0x8014b2, 0x20);
  put(f, 0x8014b0, 0);
  put(f, 0x8014b0, 0xffff);
  // A present nonmatching source is not proof that any later entry matches.
  unchangedFailure(prepare, f, {}, 'render_source_required');
  const g = taskLeafFixture(0x80a8f5);
  put(g, 0x8012b0, 65535);
  put(g, 0x801308, 0x200);
  put(g, 0x800d1c, 0);
  put(g, 0x800d1e, 0x200);
  put(g, 0x801764, 0x200);
  unchangedFailure(
    prepare,
    g,
    { maxWork: 1000, maxOutputBytes: 10000 },
    'task_work_budget_required',
  );
  const h = taskLeafFixture(0x80a8f5);
  put(h, 0x8012b0, 1);
  put(h, 0x800d1c, 0);
  unchangedFailure(
    prepare,
    h,
    { context: Object.freeze({ ...h.context, status: h.context.status | 8 }) },
    'task_binary_arithmetic_required',
  );
});
