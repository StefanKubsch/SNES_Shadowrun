import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createScriptWordState } from '../proof/state/script-words.mjs';
import { runTaskWithState, visitTailWithState, sweepWithState } from '../proof/state/host.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const request = (nativeId, args) => ({ nativeId, args, returnBytes: nativeId === 0x57 ? 2 : 0 });
const script = (id, bytecode, returnBytes = 2) => ({ id, bytecode, returnBytes, argumentBytes: 0, localBytes: 0 });
const bundle = scripts => ({ format: original.format, scripts, nativeFunctions: original.nativeFunctions });
const wait = [0x00, 1, 0x00, 1, 0x58, 0x9F, 0xBC];

test('State starts unknown; explicit writes initialize words, while reads and bit operations require known bytes', () => {
  const state = createScriptWordState({ byteLength: 6 });
  assert.deepEqual(state.snapshot().bytes, [null, null, null, null, null, null]);
  for (const id of [0x03, 0x57, 0x9B]) {
    assert.deepEqual(state.applyNative(request(id, id === 0x57 ? [2] : [2, 0xFFFF])), { handled: false, reason: 'state_source_required' });
    assert.deepEqual(state.snapshot().bytes, [null, null, null, null, null, null]);
  }
  assert.deepEqual(state.applyNative(request(0x12, [2, 0x1234])), { handled: true, value: null });
  assert.deepEqual(state.snapshot().bytes, [null, null, 0x34, 0x12, null, null]);
  assert.equal(state.applyNative(request(0x57, [2])).value, 0x1234);
  state.applyNative(request(0x03, [2, 0xF00F]));
  assert.equal(state.applyNative(request(0x57, [2])).value, 0x1004);
  state.applyNative(request(0x9B, [2, 0x00A0]));
  assert.equal(state.applyNative(request(0x57, [2])).value, 0x10A4);
});

test('Byte offsets stay unrounded and overlapping odd writes preserve neighboring bytes', () => {
  const state = createScriptWordState({ byteLength: 4 });
  state.seed(0, [0x11, 0x22, 0x33, 0x44]);
  state.applyNative(request(0x12, [1, 0xBEEF]));
  assert.deepEqual(state.snapshot().bytes, [0x11, 0xEF, 0xBE, 0x44]);
  assert.equal(state.applyNative(request(0x57, [0])).value, 0xEF11);
  assert.equal(state.applyNative(request(0x57, [2])).value, 0x44BE);
  assert.equal(state.applyNative(request(0x57, [1])).value, 0xBEEF);
});

test('Mask boundaries produce exact 16-bit AND/OR results without changing other words', () => {
  const state = createScriptWordState({ byteLength: 6 });
  for (const value of [0, 1, 0x8000, 0xFFFF, 0x1234]) {
    for (const mask of [0, 1, 0x8000, 0xFFFF, 0xABCD]) {
      state.seed(0, [0xA5, 0x5A, value & 255, value >>> 8, 0x3C, 0xC3]);
      state.applyNative(request(0x03, [2, mask]));
      assert.equal(state.applyNative(request(0x57, [2])).value, value & mask);
      state.applyNative(request(0x12, [2, value]));
      state.applyNative(request(0x9B, [2, mask]));
      assert.equal(state.applyNative(request(0x57, [2])).value, value | mask);
      assert.deepEqual(state.snapshot().bytes.filter((_, index) => index < 2 || index > 3), [0xA5, 0x5A, 0x3C, 0xC3]);
    }
  }
});

test('Outside-window, partial-byte, malformed ABI and unknown-action requests never mutate state', () => {
  const state = createScriptWordState({ byteLength: 4 });
  state.seed(1, [0xAB]);
  const before = state.snapshot();
  for (const offset of [3, 4, 0xFFFF]) assert.equal(state.applyNative(request(0x12, [offset, 1])).reason, 'state_window_required');
  assert.equal(state.applyNative(request(0x57, [1])).reason, 'state_source_required');
  assert.equal(state.applyNative(request(0x4C, [0xFFFF, 0x38, 0xFF, 3])).reason, 'native_implementation_required');
  const sparseArgs = [0];
  sparseArgs.length = 2; // A hole must not be coerced into a written zero.
  for (const invalid of [request(0x12, [0]), request(0x12, [0, -1]), request(0x12, sparseArgs), { ...request(0x57, [0]), returnBytes: 0 }]) assert.throws(() => state.applyNative(invalid), /ABI mismatch/);
  assert.throws(() => state.seed(0, [1, 256]), /state seed/);
  assert.throws(() => state.seed(3, [1, 2]), /state seed/);
  assert.deepEqual(state.snapshot(), before);
  for (const byteLength of [undefined, 0, 1, 0xC446]) assert.throws(() => createScriptWordState({ byteLength }), /window length/);
  const copy = state.snapshot();
  copy.bytes[1] = 0;
  assert.equal(state.snapshot().bytes[1], 0xAB);
});

test('Original European $060 really writes word zero at $2A, then retains unknown native $B9', () => {
  for (const argument of [0, 0x1234, 0xFFFF]) {
    const state = createScriptWordState({ byteLength: 0x2C });
    const task = createScriptTask(original, 0x060, [argument]);
    const outcome = runTaskWithState(task, state, { maxNativeCalls: 1 });
    assert.equal(outcome.handledCalls, 1);
    assert.deepEqual(outcome.actions.map(a => [a.nativeId, a.args, a.value]), [[0x12, [0x2A, 0], null]]);
    assert.deepEqual(outcome.state.bytes.slice(0x2A), [0, 0]);
    assert.ok(outcome.state.bytes.slice(0, 0x2A).every(value => value === null));
    assert.equal(outcome.execution.status, 'native_call');
    assert.equal(outcome.execution.pending.nativeId, 0xB9);
    assert.equal(outcome.execution.pending.requestId, 2);
    assert.deepEqual(outcome.execution.pending.args, [argument & 255]);
    assert.equal(outcome.execution.result, null);
    assert.deepEqual(outcome.boundary, { nativeId: 0xB9, reason: 'native_implementation_required' });
    const repeated = runTaskWithState(task, state);
    assert.equal(repeated.handledCalls, 0);
    assert.deepEqual(repeated.execution, outcome.execution);
    assert.deepEqual(repeated.state, outcome.state);
  }
});

test('Original $10A/$10B prefixes write two exact words before the unsupported $56 action', () => {
  for (const [id, first, second] of [[0x10A, 0xDA, 0x0120], [0x10B, 0xF6, 0xFFFF]]) {
    const state = createScriptWordState({ byteLength: 0x32 });
    const outcome = runTaskWithState(createScriptTask(original, id), state);
    assert.equal(outcome.handledCalls, 2);
    assert.deepEqual(outcome.state.bytes.slice(0x2E), [first, 0, second & 255, second >>> 8]);
    assert.equal(outcome.execution.status, 'native_call');
    assert.equal(outcome.execution.pending.nativeId, 0x56);
    assert.equal(outcome.execution.result, null);
  }
});

test('A reader suspended on missing source resumes the same request only after bytes are supplied', () => {
  const task = createScriptTask(bundle([script(0, [0x00, 1, 0x58, 0x57, 0x56])]), 0);
  const state = createScriptWordState({ byteLength: 3 });
  const blocked = runTaskWithState(task, state);
  assert.equal(blocked.handledCalls, 0);
  assert.deepEqual(blocked.boundary, { nativeId: 0x57, reason: 'state_source_required' });
  assert.equal(blocked.execution.pending.requestId, 1);
  state.seed(1, [0xFE, 0xCA]); // Explicit test fixture, no invented original starting state.
  const resumed = runTaskWithState(task, state);
  assert.equal(resumed.execution.result.value, 0xCAFE);
  assert.equal(resumed.actions[0].requestId, 1);
});

test('Shared state follows newest-first scheduler effects without double-checking waiters', () => {
  const scheduler = createScriptScheduler(bundle([
    script(0, [...wait, 0x00, 0x2A, 0x58, 0x57, 0x56]),
    script(1, [...wait, 0x14, 0xEF, 0xBE, 0x00, 0x2A, 0x58, 0x12, 0x56], 0),
    script(2, [0x00, 3, 0x00, 1, 0x58, 0x9F, 0x56]),
  ]));
  const state = createScriptWordState({ byteLength: 0x2C });
  const spectator = scheduler.addTask(2);
  visitTailWithState(scheduler, state);
  const older = scheduler.addTask(0);
  visitTailWithState(scheduler, state);
  const newer = scheduler.addTask(1);
  visitTailWithState(scheduler, state);
  sweepWithState(scheduler, state); // Initial cursor preparation.
  const pass = sweepWithState(scheduler, state);
  assert.equal(pass.execution.status, 'ready');
  assert.equal(pass.handledCalls, 2);
  assert.deepEqual(pass.actions.map(a => [a.taskId, a.nativeId, a.value]), [[newer, 0x12, null], [older, 0x57, 0xBEEF]]);
  assert.deepEqual(pass.state.bytes.slice(0x2A), [0xEF, 0xBE]);
  assert.deepEqual(pass.execution.tasks.map(t => [t.taskId, t.checks, t.wait.remaining]), [[spectator, 1, 2]]);
});

test('Host budgets validate before execution and stop before applying an excess known action', () => {
  const task = createScriptTask(bundle([script(0, [0x00, 1, 0xC0, 0x58, 0x12, 0x00, 2, 0xC0, 0x58, 0x12, 0x56], 0)]), 0);
  const state = createScriptWordState({ byteLength: 2 });
  assert.throws(() => runTaskWithState(task, state, { maxSteps: 0 }), /step budget/);
  assert.throws(() => runTaskWithState(task, state, { maxNativeCalls: 0 }), /action budget/);
  assert.throws(() => runTaskWithState(task, {}), /word state/);
  assert.equal(task.snapshot().steps, 0);
  assert.deepEqual(state.snapshot().bytes, [null, null]);
  assert.throws(() => runTaskWithState(task, state, { maxNativeCalls: 1 }), /budget exhausted/);
  assert.deepEqual(state.snapshot().bytes, [1, 0]);
  assert.equal(task.snapshot().pending.requestId, 2);
  assert.deepEqual(task.snapshot().pending.args, [0, 2]);
});

test('State native profiles and byte/word operations are pinned to this European ROM', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const evidence = [
    [0x03, 0xCC26, 2, 0, 'A600BFBB3B7E25029FBB3B7E60'],
    [0x12, 0xCC10, 2, 0, 'A600A5029FBB3B7E60'],
    [0x57, 0xCC07, 1, 2, 'A600BFBB3B7E850060'],
    [0x9B, 0xCC19, 2, 0, 'A600BFBB3B7E05029FBB3B7E60'],
  ];
  for (const [id, address, args, returns, code] of evidence) {
    assert.equal(rom.readUInt16LE(0x157B8 + id * 2), address);
    assert.equal(rom[0x15A4C + id], args);
    assert.equal(rom[0x15970 + id], returns);
    assert.equal(rom.subarray(address - 0x8000, address - 0x8000 + code.length / 2).toString('hex').toUpperCase(), code);
  }
});
