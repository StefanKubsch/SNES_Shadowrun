import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createScriptState } from '../proof/state/script-state.mjs';
import { runTaskWithState, visitTailWithState, sweepWithState } from '../proof/state/host.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const native56 = value => ({ nativeId: 0x56, args: [value], returnBytes: 0 });

test('Native $56 writes its two fixed words for every 16-bit input without changing the script-word window', () => {
  const state = createScriptState({ byteLength: 4 });
  assert.deepEqual(state.snapshot(), { scriptWords: { byteLength: 4, bytes: [null, null, null, null] }, action56: { argumentWord: null, markerWord: null } });
  state.seed(1, [0xAB]);
  for (let value = 0; value <= 0xFFFF; value++) {
    assert.deepEqual(state.applyNative(native56(value)), { handled: true, value: null });
    assert.deepEqual(state.snapshot().action56, { argumentWord: value, markerWord: 0x7FFF });
  }
  assert.deepEqual(state.snapshot().scriptWords.bytes, [null, 0xAB, null, null]);
  const copy = state.snapshot();
  copy.action56.argumentWord = 0;
  assert.equal(state.snapshot().action56.argumentWord, 0xFFFF);
});

test('Malformed native $56 profiles and unknown actions preserve both state slices', () => {
  const state = createScriptState({ byteLength: 2 });
  const before = state.snapshot();
  for (const args of [[], [1, 2], [-1], [65536], [NaN], new Array(1)]) assert.throws(() => state.applyNative({ nativeId: 0x56, args, returnBytes: 0 }), /ABI mismatch/);
  assert.throws(() => state.applyNative({ ...native56(1), returnBytes: 2 }), /ABI mismatch/);
  assert.equal(state.applyNative({ nativeId: 0xB9, args: [0], returnBytes: 0 }).reason, 'native_implementation_required');
  assert.deepEqual(state.snapshot(), before);
});

test('Original $10A/$10B execute native $56, wait once, and end only after the timeout check', () => {
  for (const [id, first, second, argument] of [[0x10A, 0xDA, 0x0120, 0xF1], [0x10B, 0xF6, 0xFFFF, 0x1D1]]) {
    const task = createScriptTask(original, id);
    const state = createScriptState({ byteLength: 0x32 });
    const outcome = runTaskWithState(task, state);
    assert.equal(outcome.handledCalls, 3);
    assert.deepEqual(outcome.actions.map(a => [a.nativeId, a.args]), [[0x12, [0x2E, first]], [0x12, [0x30, second]], [0x56, [argument]]]);
    assert.deepEqual(outcome.state.action56, { argumentWord: argument, markerWord: 0x7FFF });
    assert.deepEqual(outcome.state.scriptWords.bytes.slice(0x2E), [first, 0, second & 255, second >>> 8]);
    assert.equal(outcome.execution.status, 'waiting');
    assert.equal(outcome.execution.checks, 0);
    assert.equal(outcome.execution.wait.remaining, 1);
    assert.equal(outcome.execution.result, null);
    assert.equal(outcome.boundary, null);
    assert.equal(runTaskWithState(task, state).execution.checks, 0);
    const ended = task.tick();
    assert.equal(ended.status, 'ended');
    assert.equal(ended.checks, 1);
    assert.equal(ended.result.value, null);
    assert.equal(ended.result.endPc, 0x17);
    assert.deepEqual(ended.result.stack, []);
    assert.deepEqual(state.snapshot(), outcome.state);
  }
});

test('Original $060 retains $B9 and leaves native $56 fields unknown in the extended state', () => {
  const state = createScriptState({ byteLength: 0x32 });
  const task = createScriptTask(original, 0x060, [0x1234]);
  const outcome = runTaskWithState(task, state);
  assert.equal(outcome.handledCalls, 1);
  assert.deepEqual(outcome.state.scriptWords.bytes.slice(0x2A, 0x2C), [0, 0]);
  assert.deepEqual(outcome.state.action56, { argumentWord: null, markerWord: null });
  assert.deepEqual(outcome.execution.pending.args, [0x34]);
  assert.deepEqual(outcome.boundary, { nativeId: 0xB9, reason: 'native_implementation_required' });
  assert.deepEqual(runTaskWithState(task, state).execution, outcome.execution);
});

test('Original state writers share native $56 fields in reverse scheduler order without extra waiter checks', () => {
  const spectatorScript = { id: 0, argumentBytes: 0, returnBytes: 0, localBytes: 0, bytecode: [0x00, 3, 0x00, 1, 0x58, 0x9F, 0xBC, 0x56] };
  const bundle = { ...original, scripts: [spectatorScript, ...original.scripts.filter(s => s.id === 0x10A || s.id === 0x10B)] };
  const scheduler = createScriptScheduler(bundle);
  const state = createScriptState({ byteLength: 0x32 });
  const spectator = scheduler.addTask(0);
  visitTailWithState(scheduler, state);
  const older = scheduler.addTask(0x10A);
  const newer = scheduler.addTask(0x10B);
  sweepWithState(scheduler, state); // Prepare the initially empty traversal cursor.
  const first = sweepWithState(scheduler, state);
  assert.equal(first.handledCalls, 6);
  assert.deepEqual(first.actions.filter(a => a.nativeId === 0x56).map(a => [a.taskId, a.args]), [[newer, [0x1D1]], [older, [0xF1]]]);
  assert.deepEqual(first.state.action56, { argumentWord: 0xF1, markerWord: 0x7FFF });
  assert.deepEqual(first.state.scriptWords.bytes.slice(0x2E), [0xDA, 0, 0x20, 1]);
  const checks = id => first.execution.tasks.find(t => t.taskId === id).checks;
  assert.equal(checks(older), 0);
  assert.equal(checks(newer), 0);
  assert.equal(checks(spectator), 1);
  const next = sweepWithState(scheduler, state);
  assert.equal(next.handledCalls, 0);
  assert.equal(next.execution.tasks.length, 1);
  assert.equal(next.execution.tasks[0].taskId, spectator);
  assert.equal(next.execution.tasks[0].checks, 2);
  assert.equal(next.execution.tasks[0].wait.remaining, 1);
});

test('Native budget exhaustion leaves $56 pending and its state unknown until explicitly resumed', () => {
  const task = createScriptTask(original, 0x10A);
  const state = createScriptState({ byteLength: 0x32 });
  assert.throws(() => runTaskWithState(task, state, { maxNativeCalls: 2 }), /budget exhausted/);
  assert.equal(task.snapshot().pending.nativeId, 0x56);
  assert.deepEqual(state.snapshot().action56, { argumentWord: null, markerWord: null });
  const resumed = runTaskWithState(task, state, { maxNativeCalls: 1 });
  assert.equal(resumed.handledCalls, 1);
  assert.equal(resumed.actions[0].requestId, 3);
  assert.equal(resumed.execution.status, 'waiting');
  assert.deepEqual(resumed.state.action56, { argumentWord: 0xF1, markerWord: 0x7FFF });
});

test('Native $56 complete routine and ABI are pinned to the European ROM', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  assert.equal(rom.readUInt16LE(0x157B8 + 0x56 * 2), 0xCC97);
  assert.equal(rom[0x15A4C + 0x56], 1);
  assert.equal(rom[0x15970 + 0x56], 0);
  assert.equal(rom.subarray(0x4C97, 0x4CA4).toString('hex').toUpperCase(), 'A5008FE22D7EA9FF7F8DE91C60');
});
