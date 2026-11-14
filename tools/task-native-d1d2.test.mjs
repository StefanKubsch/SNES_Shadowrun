import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeD1D2 as root } from '../proof/task/native-d1d2.mjs';
import { prepareTaskNativeOpcodeD1D2 as call } from '../proof/task/native-opcode-bindings.mjs';
import { nativeD1D2Spec as spec } from './task-native-d1d2-spec.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { bodyWord as word, omitBodyBytes as omit } from './task-script-body-fixtures.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { proveNativeOpcode } from './task-native-opcode-source.mjs';
const put = (f, a, v) => sampleWord(f.data, a, v);
const expected = (dx, dy) => {
  dx &= 65535;
  dy &= 65535;
  const negativeX = !!(dx & 32768),
    negativeY = !!(dy & 32768);
  const mx = negativeX ? -dx & 65535 : dx,
    my = negativeY ? -dy & 65535 : dy;
  return my >>> 1 >= mx
    ? negativeY
      ? 4
      : 0
    : mx >>> 1 >= my
      ? negativeX
        ? 6
        : 2
      : negativeX
        ? negativeY
          ? 5
          : 7
        : negativeY
          ? 3
          : 1;
};
function fixture(dx = 0, dy = 0, actionEqual = true) {
  const f = taskLeafFixture(spec.entry);
  put(f, 0x800e48, dx & 65535);
  put(f, 0x800ea0, dy & 65535);
  put(f, 0x8011a8, actionEqual ? expected(dx, dy) : 8);
  return f;
}
test('Native6C: all eight directions, exact half thresholds and wrapped signed WORD extremes precede fresh action equality', () => {
  const values = [0, 1, 2, 3, 4, 7, 0x3fff, 0x7fff, 0x8000, 0x8001, 0xfffc, 0xfffd, 0xfffe, 0xffff],
    directions = new Set();
  for (const dx of values)
    for (const dy of values) {
      const f = fixture(dx, dy),
        p = prepared(root, f),
        direction = expected(dx, dy);
      directions.add(direction);
      assert.equal(p.outputContext.y, direction);
      assert.equal(p.outputContext.x, 16);
      assert.equal(p.outputContext.status & 0x83, 3);
      assert.equal(p.outputContext.s, 0x701);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.deepEqual(
        p.accesses.filter((a) => a.label === 'd2-inner-RTS-low').map((a) => a.value),
        [0xd4, 0xdb],
      );
      assert.equal(commitTaskPlan(f.data, p).handled, true);
      assert.equal(word(f.data, 2), direction);
      assert.equal(word(f.data, 0xa2), dx & 32768 ? -dx & 65535 : dx);
      assert.equal(word(f.data, 0xa5), dy & 32768 ? -dy & 65535 : dy);
    }
  assert.deepEqual([...directions].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
});
test('Native6C: changed action uses full BYTE carry arithmetic and slow whole A985 with three actual inner returns', () => {
  const fast = fixture(4, 4, false);
  put(fast, 0x8010f8, 1);
  put(fast, 0x8010a0, 0x9000);
  put(fast, 0x801200, 0xab80);
  fast.data.seed(0x8c9000 + 8, [0x81]);
  fast.data.seed(0x8c9001, [0x7f]);
  const p = prepared(root, fast);
  assert.equal(commitTaskPlan(fast.data, p).handled, true);
  assert.equal(word(fast.data, 0x801200), 0xab7e);
  const slow = fixture(0, 0, false);
  put(slow, 0x8010f8, 0);
  put(slow, 0x801048, 2);
  put(slow, 0x7e3f38, 0);
  put(slow, 0x8ced8a, 0x9000);
  put(slow, 0x8c9004, 0xa000);
  slow.data.seed(0x8ca000, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  put(slow, 0x8ca008, 0xa509);
  const q = prepared(root, slow);
  assert.deepEqual(
    q.accesses.filter((a) => a.label === 'd2-inner-RTS-low').map((a) => a.value),
    [0xd4, 0xdc, 0xdb],
  );
  assert.equal(q.outputContext.s, 0x701);
  assert.equal(commitTaskPlan(slow.data, q).handled, true);
  assert.equal(word(slow.data, 0x801048), 2);
  unchangedFailure(root, omit(fixture(), 0x800cc3), {}, 'render_source_required');
});
test('Native6C: DP coordinate aliases, actual DBR/full WORD indices, internal and outer return owners, decimal and budgets remain atomic', () => {
  const f = fixture(3, 5),
    p = prepared(root, f);
  prepared(root, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(root, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(root, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  unchangedFailure(
    root,
    f,
    { context: Object.freeze({ ...f.context, status: f.context.status | 8 }) },
    'task_binary_arithmetic_required',
  );
  // actualDBR00 + E28 + F280 reads the just-cleared bank00 A8 WORD.
  const alias = taskLeafFixture(spec.entry, { bank: 0 });
  put(alias, 0, 0xf280);
  put(alias, 0xcc2, 0x10);
  put(alias, 0xe38, 9);
  put(alias, 0xe90, 0);
  put(alias, 0x100, 0);
  put(alias, 0x10418, 2);
  const q = prepared(root, alias);
  assert.equal(q.outputContext.x, 0xf280);
  assert.equal(
    q.accesses.find((a) => a.label === 'leaf-long-WORD-low' && a.address === 0x100a8).value,
    0,
  );
  // D1E3's STZ A8 overwrites the actual pushed D1D4 return at S+1.
  const inner = fixture();
  inner.context = Object.freeze({ ...inner.context, s: 0xa9 });
  put(inner, 0xaa, 0xc20a);
  unchangedFailure(root, inner, {}, 'task_native_helper_return_required');
  unchangedFailure(root, omit(f, 0x701), {}, 'render_source_required');
  const outer = taskLeafFixture(spec.entry, { s: 0xa7, savedOuterS: 0xa7 });
  unchangedFailure(root, outer, {}, 'task_stack_alias_required');
  const window = taskLeafFixture(spec.entry, {
    writeWindows: [
      [0x7e0000, 0x7e00a7],
      [0x7e00aa, 0x7fffff],
    ],
  });
  unchangedFailure(root, window, {}, 'render_write_window_required');
});
test('Native6C: own Native58 metadata, full source graph and four local stack bytes are independently renewed', async () => {
  const f = taskNativeOpcodeFixture(spec),
    p = prepared(call, f),
    s = p.steps[0];
  assert.equal(s.wordPops, 1);
  assert.equal(s.resultPushed, false);
  assert.equal(s.calleeEntry, spec.entry);
  assert.equal(s.calleeReturnWord, 0xf508);
  assert.equal(s.calleeReturnTarget, 0x80f509);
  for (const a of spec.anchors)
    unchangedFailure(call, omit(f, a.start + 1), {}, 'render_source_required');
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    source = await proveNativeOpcode(bytes, spec),
    proof = source.admitted_targets[0].proof;
  assert.equal(proof.maximum_local_stack_bytes, 4);
  assert.equal(proof.minimum_protected_stack_bytes, 6);
  assert.equal(proof.reachable_instructions, 175);
  assert.deepEqual(
    proof.inner_calls.map((c) => c.return_word),
    [0xd1d4, 0xd1db, 0xaadc],
  );
  for (const w of [...spec.windows, ...spec.anchors]) {
    const changed = Buffer.from(bytes);
    changed[cpuToOffset(w.start + w.hex.length / 2 - 1, bytes.length)] ^= 1;
    await assert.rejects(() => proveNativeOpcode(changed, spec));
  }
});
