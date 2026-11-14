import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeCBCB as prepare } from '../proof/task/native-cbcb.mjs';
import { prepareTaskNativeOpcodeCBCB as opcode } from '../proof/task/native-opcode-bindings.mjs';
import { nativeCBCBSpec as s } from './task-native-cbcb-spec.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { nativeOpcodeSpecs } from './task-native-opcode-specs.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { bodyWord as word, omitBodyBytes as omit } from './task-script-body-fixtures.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { decodeTaskWindows } from './task-partial-source.mjs';
import { proveLeafSource } from './task-native-leaf-source.mjs';
test('Native4B whole24byte/10instruction source proves null merge and BYTE SEP/REP with two protectedRTS bytes and all original anchors', async () => {
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    p = proveLeafSource(decodeTaskWindows(bytes, s.windows).map, s);
  assert.equal(p.reachable_instructions, 10);
  assert.equal(p.maximum_local_stack_bytes, 0);
  assert.equal(p.minimum_protected_stack_bytes, 2);
  assert.deepEqual(
    p,
    JSON.parse(await readFile('analysis/render-task-native-cbcb.json')).proofs[0],
  );
  for (const a of s.anchors)
    assert.equal(
      bytes
        .subarray(cpuToOffset(a.start, bytes.length), cpuToOffset(a.start, bytes.length) + 2)
        .toString('hex')
        .toUpperCase(),
      a.hex,
    );
  for (let n = 0; n < 24; n++) {
    const changed = Buffer.from(bytes);
    changed[cpuToOffset(s.entry + n, bytes.length)] ^= 1;
    assert.throws(() => proveLeafSource(decodeTaskWindows(changed, s.windows).map, s));
  }
});
test('Native4B fullWORD record/table/field carry and BYTE mask retain pointer highA, BYTE NZ, entry CV/DBR/Y and field high', () => {
  for (const index of [0x10, 0x1001, 65535])
    for (const pointer of [0x400, 0x7fff, 65535])
      for (const [old, mask] of [
        [0xab, 0xfffe],
        [255, 128],
        [1, 0xff00],
        [128, 65535],
      ]) {
        const f = taskLeafFixture(s.entry),
          field = 0x7e0001 + pointer;
        sampleWord(f.data, 0, index);
        sampleWord(f.data, 2, mask);
        sampleWord(f.data, 0x8db020 + index, pointer);
        f.data.seed(field, [old, 0xab]);
        f.context = Object.freeze({ ...f.context, status: f.context.status | 0x41 });
        const p = commit(prepare, f),
          value = old & (mask & 255);
        assert.equal(f.data.readByte(field).value, value);
        assert.equal(f.data.readByte(field + 1).value, 0xab);
        assert.equal(p.outputContext.a, (pointer & 0xff00) | value);
        assert.equal(p.outputContext.x, pointer);
        assert.equal(p.outputContext.y, f.context.y);
        assert.equal(p.outputContext.bank, f.context.bank);
        assert.equal(p.outputContext.status & 0x41, 0x41);
        assert.equal(p.outputContext.status & 0x82, (value === 0 ? 2 : 0) | (value & 128));
        assert.equal(p.outputContext.status & 0x30, 0);
        assert.equal(word(f.data, 0), index);
        assert.equal(word(f.data, 2), mask);
        assert.ok(p.byteWrites.some(([a]) => a === field));
      }
  const f = taskLeafFixture(s.entry);
  sampleWord(f.data, 0x8db030, 0);
  const nullSource = omit(f, 2, 3),
    p = commit(prepare, nullSource);
  assert.equal(p.outputBytes, 0);
  assert.equal(p.outputContext.a, 0);
  assert.equal(p.outputContext.x, 0x10);
  assert.equal(p.outputContext.status & 0x82, 2);
  assert.ok(
    !p.accesses.some((a) => a.label === 'record-and-field-BYTE' || a.label === 'leaf-DP-BYTE'),
  );
});
test('Native4B late missing mask/pointerhigh/field, budgets and changed source preserve atomicity; an aliased actual Native58 callee return is rejected', () => {
  const f = taskLeafFixture(s.entry),
    p = prepared(prepare, f);
  for (const a of [0x8db031, 2, 0x7e0401])
    unchangedFailure(prepare, omit(f, a), {}, 'render_source_required');
  unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    prepare,
    f,
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  f.data.seed(0x7e0401, [255]);
  assert.equal(commitTaskPlan(f.data, p).handled, false);
  const spec = nativeOpcodeSpecs.find((n) => n.id === 0x4b),
    q = taskNativeOpcodeFixture(spec),
    good = prepared(opcode, q),
    ret = good.accesses.find((a) => a.kind === 'read' && a.label === 'leaf-outer-RTS-low');
  assert.ok(ret);
  sampleWord(q.data, 0x8db030, (ret.address - 1) & 65535);
  sampleWord(q.data, 0x3f3, 0);
  unchangedFailure(opcode, q, {}, 'task_native_resume_target_required');
});
test('Native4B Native58 really pops record then mask WORDs and returns F508/zero-result without PHA; original metadata/pointer highs stay guards', () => {
  const spec = nativeOpcodeSpecs.find((n) => n.id === 0x4b),
    f = taskNativeOpcodeFixture(spec);
  sampleWord(f.data, 0x3f1, 0x10);
  sampleWord(f.data, 0x3f3, 0xfffe);
  f.data.seed(0x7e0401, [0xab]);
  const p = commit(opcode, f);
  assert.equal(f.data.readByte(0x7e0401).value, 0xaa);
  assert.equal(p.steps[0].wordPops, 2);
  assert.equal(p.steps[0].resultPushed, false);
  assert.equal(p.steps[0].calleeReturnWord, 0xf508);
  for (const address of [0x82d84f, 0x82da98, 0x82d9bc])
    unchangedFailure(
      opcode,
      omit(taskNativeOpcodeFixture(spec), address),
      {},
      'render_source_required',
    );
});
