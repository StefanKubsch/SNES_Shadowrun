import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { decodeTaskWindows } from './task-partial-source.mjs';
import { createNativeSpec } from './task-native-create-spec.mjs';
import { proveLeafSource } from './task-native-leaf-source.mjs';
import { prepareTaskNativeA835 as prepare } from '../proof/task/native-a835.mjs';
import { prepareTaskAppendC34A as append } from '../proof/task/append-c34a.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { appendWindows, proveTaskAppend } from './task-append-source.mjs';
import { taskAppendFixture } from './task-append-fixtures.mjs';
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc'));
const put = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const word = (f, a) => f.data.readByte(a).value | (f.data.readByte(a + 1).value << 8);
function callbackFixture({ id = 0x56, slot = 2, tail = 4, heap = 0x100 } = {}) {
  const f = taskLeafFixture(0x80a835, { maxOutputBytes: 2048 });
  put(f, 8, id);
  for (const address of [0x82db28 + id, 0x82e9cc + id, 0x82ded1 + 2 * id])
    put(f, address, bytes.readUInt16LE(cpuToOffset(address, bytes.length)));
  const header = (word(f, 0x82db28 + id) & 255) * 65536 + word(f, 0x82ded1 + 2 * id),
    off = cpuToOffset(header, bytes.length);
  f.data.seed(header, bytes.subarray(off, off + 2));
  put(f, 0x8003d2, heap);
  put(f, 0x8003d4, 0);
  put(f, 0x80024e, slot);
  put(f, 0x80024c, tail);
  if (!(slot & 0x8000)) put(f, 0x800312 + slot, 65535);
  return f;
}
test('A9 whole callback executes actual mixed JSL/JSR/RTL frames and appends an original56 frame without visiting it', () => {
  const f = callbackFixture(),
    p = commit(prepare, f);
  assert.equal(word(f, 0), 0x56);
  assert.equal(word(f, 2), 0x20);
  assert.equal(word(f, 0x7e3f7e), 0x10);
  assert.equal(word(f, 0x8014ae), 0x2468);
  assert.equal(word(f, 0x8014b0), 2);
  assert.equal(word(f, 0x8014b4), 0x56);
  assert.equal(word(f, 0x8013a6), 2);
  assert.equal(word(f, 0x80024e), 65535);
  assert.equal(word(f, 0x80024c), 2);
  assert.equal(word(f, 0x800254), 0x3d6);
  assert.equal(word(f, 0x800314), 4);
  assert.equal(word(f, 0x800374), 65535);
  assert.equal(word(f, 0x800376), 2);
  assert.equal(word(f, 0x8003d2), 0x8019);
  assert.equal(word(f, 0x8003d4), 0x1d);
  assert.equal(word(f, 0x8003ef), 0xe3);
  assert.equal(word(f, 0x8003f1), 0);
  assert.equal(word(f, 0x8003d6), 0xfa24);
  assert.equal(word(f, 0x8003d8), 0x82);
  assert.equal(word(f, 0x8003d9), 0);
  assert.equal(word(f, 0x8003db), 0x3e7);
  assert.equal(word(f, 0x8003dd), 0x3ee);
  assert.equal(p.outputContext.a, 2);
  assert.equal(p.outputContext.x, 0x56);
  assert.equal(p.outputContext.y, 3);
  assert.equal(p.outputContext.s, 0x701);
  assert.equal(p.returnTarget, 0x80c20b);
  assert.equal(p.returnTargetExecuted, false);
  assert.deepEqual(
    p.accesses
      .filter((r) => r.kind === 'write' && r.label.startsWith('create-slot-JSL'))
      .map((r) => [r.address, r.value]),
    [
      [0x6ff, 0x80],
      [0x6fe, 0xa8],
      [0x6fd, 0xee],
    ],
  );
  assert.deepEqual(
    p.accesses.filter((r) => r.label.startsWith('create-slot-C369-RTL')).map((r) => r.value),
    [0xee, 0xa8, 0x80],
  );
});
test('A9 exhausted object scan returns unchanged A and final DEX flags without invented failure sentinel or writes', () => {
  const f = taskLeafFixture(0x80a835);
  for (let x = 0; x < 0x58; x += 2) put(f, 0x7e3f28 + x, 7);
  const p = prepared(prepare, f);
  assert.equal(p.outputContext.a, 7);
  assert.equal(p.outputContext.x, 65534);
  assert.equal(p.outputContext.status, 0xc5);
  assert.equal(p.outputBytes, 0);
});
test('A9 second ASL carry is retained by definition ADC, and DP08 negative skips only its actual callback', () => {
  const f = taskLeafFixture(0x80a835);
  put(f, 0, 0xd000);
  put(f, 0x8dcfb5, 0xa55a);
  const p = commit(prepare, f);
  assert.equal(word(f, 2), 0xa000);
  assert.equal(word(f, 0x8014ae), 0xa55a);
  assert.equal(p.outputContext.a, 0x56);
  assert.equal(p.outputContext.x, 65535);
  assert.equal(p.outputContext.status & 0x82, 0x80);
  assert.ok(
    !p.accesses.some((r) => r.label.startsWith('append-') || r.label.startsWith('create-slot-JSL')),
  );
});
test('C34A remains a standalone actual DBR append with a real inner return and fresh prior tail', () => {
  const f = callbackFixture({ tail: 65535 });
  f.entry = 0x80c34a;
  f.context = Object.freeze({ ...f.context, pc: 0xc34a, x: 0x56 });
  const p = commit(append, f);
  assert.equal(word(f, 0x800314), 65535);
  assert.equal(word(f, 0x80024c), 2);
  assert.equal(p.outputContext.a, 2);
  assert.equal(p.outputContext.x, 65535);
  assert.equal(p.outputContext.status & 0x82, 0x80);
  assert.equal(p.rawReturnWord, 0xc20a);
});
test('slot exhaustion still executes unguarded C34A full-index stores and returns its actual negative offset', () => {
  const f = callbackFixture({ slot: 65535 }),
    p = commit(prepare, f);
  assert.equal(word(f, 0x8013a6), 65535);
  assert.equal(word(f, 0x810311), 4);
  assert.equal(word(f, 0x810371), 65535);
  assert.equal(word(f, 0x80024c), 65535);
  assert.equal(p.outputContext.a, 65535);
  assert.equal(word(f, 0x8003d6), 0xfa24);
});
test('heap exhaustion does not bypass real frame writes and fresh DP00 is reloaded after frame-zero aliasing', () => {
  const f = callbackFixture({ heap: 0x8001 }),
    p = commit(prepare, f);
  assert.equal(word(f, 0x74), 0);
  assert.equal(word(f, 0), 0xfa24);
  assert.equal(word(f, 0x800254), 0);
  assert.equal(word(f, 0x810d74), 2);
  assert.equal(p.outputContext.x, 0xfa24);
  assert.equal(p.outputContext.a, 2);
});
test('late mixed-return/source/budget/protected-owner failures retain no object, list, heap or task effects', () => {
  const f = callbackFixture(),
    p = prepared(prepare, f);
  unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    prepare,
    f,
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(
    prepare,
    f,
    { protectedStackBytes: [...f.protectedStackBytes, 0x7e06fd] },
    'task_stack_alias_required',
  );
  const bad = callbackFixture({ slot: 0x88c });
  bad.context = Object.freeze({ ...bad.context, s: 0xc00 });
  bad.protectedStackBytes = [0x7e0c01, 0x7e0c02];
  put(bad, 0xc01, 0xc20a);
  unchangedFailure(prepare, bad, {}, 'task_native_long_return_required');
});
test('A9 source proof contains all positive/negative callback paths and individually typed three-/two-byte returns', () => {
  const { map } = decodeTaskWindows(bytes, createNativeSpec.windows),
    p = proveLeafSource(map, createNativeSpec);
  assert.equal(p.reachable_instructions, 201);
  assert.equal(p.maximum_local_stack_bytes, 11);
  assert.equal(p.minimum_protected_stack_bytes, 13);
  assert.equal(p.inner_calls.find((c) => c.at === '80:A8EB').return_kind, 'RTL');
  assert.equal(p.inner_calls.find((c) => c.at === '80:A8EB').return_bytes, 3);
  assert.equal(p.inner_calls.find((c) => c.at === '80:C366').return_kind, 'RTS');
  assert.equal(p.external_return_assumptions, 0);
  const bad = new Map(map);
  bad.set(0x80a8eb, { ...bad.get(0x80a8eb), target: 0x80c36a });
  assert.throws(() => proveLeafSource(bad, createNativeSpec));
});
test('Standalone native C34A evidence renews its complete original graph and reproduces actual byte plans with exact budgets', async () => {
  const { map } = decodeTaskWindows(bytes, appendWindows),
    proof = proveTaskAppend(map),
    source = JSON.parse(await readFile('analysis/render-task-append-c34a.json'));
  assert.deepEqual(source.proofs, [proof]);
  assert.equal(proof.minimum_protected_stack_bytes, 8);
  assert.equal(proof.maximum_local_stack_bytes, 6);
  assert.equal(proof.external_return_assumptions, 0);
  const f = taskAppendFixture(0x80c34a),
    p = prepared(append, f),
    native = JSON.parse(await readFile('analysis/render-task-append-c34a-native.json'));
  assert.deepEqual(native.probes[0].outputContext, p.outputContext);
  assert.deepEqual(native.probes[0].byteWrites, p.byteWrites);
  unchangedFailure(append, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(append, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  for (const [pc, i] of map) {
    const bad = new Map(map),
      raw = Buffer.from(i.raw);
    raw[0] ^= 1;
    bad.set(pc, { ...i, raw });
    assert.throws(() => proveTaskAppend(bad));
  }
});
