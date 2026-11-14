import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeCDB2 as prepare } from '../proof/task/native-cdb2.mjs';
import { prepareTaskNativeOpcodeCDB2 as opcode } from '../proof/task/native-opcode-bindings.mjs';
import { nativeCDB2Spec as s } from './task-native-cdb2-spec.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { nativeOpcodeSpecs } from './task-native-opcode-specs.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { bodyWord as word, omitBodyBytes as omit } from './task-script-body-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { decodeTaskWindows } from './task-partial-source.mjs';
import { proveLeafSource } from './task-native-leaf-source.mjs';
test('Native7B whole source owns five instructions, zero local stack, original pointer/one-word/zero-return metadata and every source byte', async () => {
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    p = proveLeafSource(decodeTaskWindows(bytes, s.windows).map, s);
  assert.equal(p.reachable_instructions, 5);
  assert.equal(p.maximum_local_stack_bytes, 0);
  assert.equal(p.minimum_protected_stack_bytes, 2);
  assert.deepEqual(JSON.parse(await readFile('analysis/render-task-native-cdb2.json')).proofs, [p]);
  for (const a of s.anchors)
    assert.equal(
      bytes
        .subarray(cpuToOffset(a.start, bytes.length), cpuToOffset(a.start, bytes.length) + 2)
        .toString('hex')
        .toUpperCase(),
      a.hex,
    );
  for (let n = 0; n < 12; n++) {
    const changed = Buffer.from(bytes);
    changed[cpuToOffset(s.entry + n, bytes.length)] ^= 1;
    assert.throws(() => proveLeafSource(decodeTaskWindows(changed, s.windows).map, s));
  }
});
test('Native7B fresh fullWORD addition wraps with binary ADC flags, clears incoming carry and preserves explicit long bank/DBR/XY/DP00', () => {
  for (const [left, right] of [
    [0, 0],
    [1, 65535],
    [65535, 1],
    [32767, 1],
    [32768, 32768],
    [0xabcd, 0xfedc],
    [65535, 65535],
  ])
    for (const bank of [0x80, 0x7e]) {
      const f = taskLeafFixture(s.entry, { bank });
      sampleWord(f.data, 0, right);
      sampleWord(f.data, 0x7e3c11, left);
      sampleWord(f.data, 0x7e3c0d, 65535);
      sampleWord(f.data, 0x7e3c0f, 65535);
      f.context = Object.freeze({ ...f.context, status: f.context.status | 1 });
      const p = commit(prepare, f),
        sum = left + right,
        result = sum & 65535;
      assert.equal(word(f.data, 0x7e3c11), result);
      assert.equal(p.outputContext.a, result);
      assert.equal(p.outputContext.bank, bank);
      assert.equal(p.outputContext.status & 1, Number(sum > 65535));
      assert.equal(p.outputContext.status & 2, result === 0 ? 2 : 0);
      assert.equal(p.outputContext.status & 128, result >= 32768 ? 128 : 0);
      assert.equal(p.outputContext.status & 64, ~(left ^ right) & (left ^ result) & 32768 ? 64 : 0);
      assert.equal(p.outputContext.x, f.context.x);
      assert.equal(p.outputContext.y, f.context.y);
      assert.equal(word(f.data, 0), right);
      assert.equal(word(f.data, 0x7e3c0d), 65535);
      assert.equal(word(f.data, 0x7e3c0f), 65535);
    }
});
test('Native7B missing high/DP/return, decimal and budgets fail atomically; changed fresh source invalidates prepared commit', () => {
  const f = taskLeafFixture(s.entry),
    p = prepared(prepare, f);
  for (const address of [1, 0x7e3c12, 0x700])
    unchangedFailure(prepare, omit(f, address), {}, 'render_source_required');
  unchangedFailure(
    prepare,
    f,
    { context: Object.freeze({ ...f.context, status: f.context.status | 8 }) },
    'task_binary_arithmetic_required',
  );
  unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    prepare,
    f,
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  sampleWord(f.data, 0x7e3c11, 1);
  assert.equal(commitTaskPlan(f.data, p).handled, false);
  const fresh = commit(prepare, f);
  assert.equal(fresh.outputContext.a, 17);
});
test('Native7B Native58 bridge pops real full argument and typed F508/zero-return F509 supplies no result PHA; metadata/pointer highs remain source guards', () => {
  const spec = nativeOpcodeSpecs.find((n) => n.id === 0x7b),
    f = taskNativeOpcodeFixture(spec);
  sampleWord(f.data, 0x3f1, 65535);
  sampleWord(f.data, 0x7e3c11, 1);
  const p = commit(opcode, f);
  assert.equal(word(f.data, 0x7e3c11), 0);
  assert.equal(p.steps[0].wordPops, 1);
  assert.equal(p.steps[0].resultPushed, false);
  for (const address of [0x82d8af, 0x82dac8, 0x82d9ec]) {
    const q = taskNativeOpcodeFixture(spec);
    unchangedFailure(opcode, omit(q, address), {}, 'render_source_required');
  }
});
