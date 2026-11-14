import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createACState } from '../proof/state/ac-state.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createScriptState, isScriptStateNative } from '../proof/state/script-state.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { runTaskWithState, visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const profiles = createTaskFrameProfiles(JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8')));
const definitions = createSlotDefinitions(JSON.parse(await readFile(new URL('../assets/slot-definitions.json', import.meta.url), 'utf8')));
const data = createSlotActionData(JSON.parse(await readFile(new URL('../assets/slot-action-data.json', import.meta.url), 'utf8')));
const memory = () => createTaskFrameAllocator({ profileData: profiles });
const request = value => ({ nativeId: 0xAC, args: [value], returnBytes: 0 });
const wordBytes = value => [value & 255, value >>> 8];
const valueAt = (state, offset) => { const bytes = state.snapshot().bytes; return bytes[offset] === null || bytes[offset + 1] === null ? null : bytes[offset] | bytes[offset + 1] << 8; };
const sourceWord = value => ({ readWord3C11: () => ({ handled: true, value }) });
const word = value => [0x14, ...wordBytes(value)];
const call = value => [...word(value), 0x58, 0xAC];
const bundle = (code, other = null) => ({ ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: code } : s.id === 0x20 && other ? { ...s, bytecode: other } : s) });

test('Original AC initialization writes only FFFE cursor and three zero words; repeated initialization preserves other bytes and mode', () => {
  const ac = createACState(); const expected = Array(40).fill(null);
  expected[0] = 0xFE;expected[1] = 0xFF;
  for (const offset of [30, 32, 36]) expected[offset] = expected[offset + 1] = 0;
  assert.deepEqual(ac.snapshot(), { base: '1FB0', byteLength: 40, bytes: expected, word1CDE: null });
  ac.seed(0, Array(40).fill(0xAB));ac.seedWord1CDE(0x1234);ac.initialize();
  const bytes = Array(40).fill(0xAB);bytes[0] = 0xFE;bytes[1] = 0xFF;
  for (const offset of [30, 32, 36]) bytes[offset] = bytes[offset + 1] = 0;
  assert.deepEqual(ac.snapshot(), { base: '1FB0', byteLength: 40, bytes, word1CDE: 0x1234 });
  const copy = ac.snapshot();copy.bytes[0] = 0;copy.word1CDE = 6;
  assert.equal(valueAt(ac, 0), 0xFFFE);assert.equal(ac.snapshot().word1CDE, 0x1234);
});

test('All covered nonzero indices retain odd-byte writes and aliases to named fields without reading first-entry sources', () => {
  for (let next = 1; next <= 36; next++) {
    const ac = createACState();ac.seed(0, wordBytes((next - 2) & 0xFFFF));
    const expected = ac.snapshot();expected.bytes[0] = next;expected.bytes[1] = 0;
    expected.bytes[2 + next] = 0xEF;expected.bytes[3 + next] = 0xBE;
    assert.deepEqual(ac.applyNative(request(0xBEEF), { readWord3C11: () => { throw new Error('Unexpected read'); } }), { handled: true, value: null, workspaceWords: [0xBEEF] });
    assert.deepEqual(ac.snapshot(), expected);
    if (next === 36) assert.equal(valueAt(ac, 38), 0xBEEF); // Append aliases 1FD6 itself.
  }
});

test('Every outside-window cursor remains pending and does not read 3C11 or change any data', () => {
  const ac = createACState();
  for (let next = 37; next <= 0xFFFF; next++) {
    ac.seed(0, wordBytes(next - 2));
    assert.equal(ac.applyNative(request(1), { readWord3C11: () => { throw new Error('Unexpected read'); } }).reason, 'ac_window_required');
    assert.equal(valueAt(ac, 0), next - 2);
  }
  assert.equal(valueAt(ac, 2), null);
});

test('Every first-entry 3C11 word is shifted logically by three with only the exact source writes', () => {
  const ac = createACState();ac.seed(38, [0, 0]);
  for (let value = 0; value <= 0xFFFF; value++) {
    ac.initialize();
    assert.equal(ac.applyNative(request(0xFFFF), sourceWord(value)).handled, true);
    assert.equal(valueAt(ac, 0), 0);assert.equal(valueAt(ac, 2), 0xFFFF);
    assert.equal(valueAt(ac, 26), 0xFFFF);assert.equal(valueAt(ac, 28), Math.floor(value / 8));
  }
});

test('All flag words and all 1CDE values use bit0 and equality to 6; required audio retains all effects as pending', () => {
  const ac = createACState();ac.seedWord1CDE(6);
  for (let flags = 0; flags <= 0xFFFF; flags++) {
    ac.initialize();ac.seed(38, wordBytes(flags));
    assert.equal(ac.applyNative(request(3), sourceWord(0)).handled, true);
  }
  ac.seed(38, [1, 0]);
  for (let mode = 0; mode <= 0xFFFF; mode++) {
    ac.initialize();ac.seedWord1CDE(mode);const before = ac.snapshot();
    const result = ac.applyNative(request(7), sourceWord(0x1238));
    if (mode === 6) assert.equal(result.handled, true);
    else { assert.equal(result.reason, 'ac_audio_helper_required');assert.deepEqual(ac.snapshot(), before); }
  }
});

test('Missing 3C11, flags or 1CDE reads precede all writes; absent bit0 skips 1CDE entirely', () => {
  const ac = createACState();let before = ac.snapshot();
  assert.equal(ac.applyNative(request(1)).reason, 'ac_3c11_source_required');
  assert.equal(ac.applyNative(request(1), sourceWord(0)).reason, 'ac_source_required');assert.deepEqual(ac.snapshot(), before);
  ac.seed(38, [1, 0]);before = ac.snapshot();
  assert.equal(ac.applyNative(request(1), sourceWord(0)).reason, 'ac_1cde_source_required');assert.deepEqual(ac.snapshot(), before);
  assert.equal(ac.applyNative(request(1), { readWord3C11: () => ({ handled: false, reason: 'state_source_required' }) }).reason, 'state_source_required');
  for (const readWord3C11 of [1, () => ({ handled: true, value: -1 })]) assert.throws(() => ac.applyNative(request(1), { readWord3C11 }), /3C11 source/);
  assert.deepEqual(ac.snapshot(), before);
  ac.seed(38, [0, 0]);assert.equal(ac.applyNative(request(1), sourceWord(0)).handled, true);
});

test('AC 3C11 reads share existing script-word bytes and never duplicate or initialize the 3C11 source', () => {
  const ac = createACState();ac.seed(38, [0, 0]);
  const short = createScriptState({ byteLength: 0x57, acState: ac });const before = ac.snapshot();
  assert.equal(short.applyNative(request(5)).reason, 'state_window_required');assert.deepEqual(ac.snapshot(), before);
  const state = createScriptState({ byteLength: 0x58, acState: ac });
  state.seed(0x56, [0x38]);assert.equal(state.applyNative(request(5)).reason, 'state_source_required');assert.deepEqual(ac.snapshot(), before);
  state.seed(0x57, [0x12]);assert.equal(state.applyNative(request(5)).handled, true);assert.equal(valueAt(ac, 28), 0x247);
  state.applyNative({ nativeId: 0x12, args: [0x56, 0xFFFF], returnBytes: 0 });ac.initialize();
  assert.equal(state.applyNative(request(5)).handled, true);assert.equal(valueAt(ac, 28), 0x1FFF);
  assert.equal(state.snapshot().scriptWords.bytes[0x56], 255);
});

test('Sparse/invalid ABI, seeds and provider brands are rejected without writes, and support depends on the supplied AC state', () => {
  const ac = createACState();const before = ac.snapshot();
  for (const args of [[], [1, 2], new Array(1), [-1], [65536]]) assert.throws(() => ac.applyNative({ ...request(1), args }), /ABI mismatch/);
  for (const returnBytes of [undefined, 2, 1]) assert.throws(() => ac.applyNative({ ...request(1), returnBytes }), /ABI mismatch/);
  for (const [offset, values] of [[-1, [0]], [40, [0]], [39, [0, 0]], [0, new Array(1)], [0, [-1]], [0, []]]) assert.throws(() => ac.seed(offset, values), /data seed/);
  assert.throws(() => ac.seedWord1CDE(65536), /1CDE source/);assert.deepEqual(ac.snapshot(), before);
  assert.throws(() => createScriptState({ byteLength: 2, acState: {} }), /AC state/);
  assert.equal(isScriptStateNative(createScriptState({ byteLength: 2 }), 0xAC), false);
  assert.equal(isScriptStateNative(createScriptState({ byteLength: 2, acState: ac }), 0xAC), true);
});

test('AC preserves scratch words 1..7 and rejects changed or sparse completion prefixes before task/memory writes', () => {
  const allocator = memory();const scheduler = createScriptScheduler(bundle([...call(0xFFFF), 0x58, 0x11, 0x56]), { frameAllocator: allocator });
  scheduler.addTask(2);allocator.writeWorkspaceWords([1, 2, 3, 4, 5, 6, 7, 8]);
  const first = scheduler.visitTail();const before = allocator.snapshot();
  for (const workspaceWords of [new Array(1), [0], [0xFFFF, 1]]) {
    assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords }), /workspace/);
    assert.deepEqual(scheduler.snapshot(), first);assert.deepEqual(allocator.snapshot(), before);
  }
  const ac = createACState();ac.seed(0, [0, 0]);
  const result = visitTailWithState(scheduler, createScriptState({ byteLength: 2, acState: ac }));
  assert.equal(result.boundary.nativeId, 0x11);assert.equal(valueAt(ac, 4), 0xFFFF);
  assert.deepEqual(allocator.snapshot().workspace, [0xFFFF, 2, 3, 4, 5, 6, 7, 8]);
});

test('A second append obeys the native action budget and resumes the same pending request exactly once', () => {
  const ac = createACState();ac.seed(38, [0, 0]);const state = createScriptState({ byteLength: 0x58, acState: ac });state.seed(0x56, [0, 0]);
  const task = createScriptTask(bundle([...call(0xFFFF), ...call(123), 0x58, 0x11, 0x56]), 2, [], { frameAllocator: memory() });
  assert.throws(() => runTaskWithState(task, state, { maxNativeCalls: 1 }), /budget exhausted/);
  assert.equal(valueAt(ac, 0), 0);assert.equal(valueAt(ac, 2), 0xFFFF);assert.equal(task.snapshot().pending.requestId, 2);
  const result = runTaskWithState(task, state, { maxNativeCalls: 1 });
  assert.equal(result.actions[0].requestId, 2);assert.equal(valueAt(ac, 0), 2);assert.equal(valueAt(ac, 4), 123);
});

test('Shared appends follow newest-first task order and preserve the original waiting spectator/cursor', () => {
  const allocator = memory();const scheduler = createScriptScheduler(bundle([...call(1), 0x56], [...call(2), 0x56]), { frameAllocator: allocator });
  const ac = createACState();ac.seed(38, [0, 0]);const state = createScriptState({ byteLength: 0x58, acState: ac });state.seed(0x56, [0, 0]);
  const spectator = scheduler.addTask(0x04B);visitTailWithState(scheduler, state);
  const older = scheduler.addTask(2);const newer = scheduler.addTask(0x20);sweepWithState(scheduler, state);
  const result = sweepWithState(scheduler, state);
  assert.deepEqual(result.actions.map(a => [a.taskId, a.nativeId]), [[newer, 0xAC], [older, 0xAC]]);
  assert.equal(valueAt(ac, 2), 2);assert.equal(valueAt(ac, 4), 1);
  assert.equal(result.execution.tasks[0].taskId, spectator);assert.equal(result.execution.tasks[0].checks, 1);
  assert.deepEqual(allocator.snapshot().activeOrder, [0]);
});

test('Original 252 stays pending without 3C11 source, then resumes AC and reaches its actual positive A9 creation', () => {
  const slots = createSlotState({ definitionData: definitions, actionData: data });
  const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  const ac = createACState();const state = createScriptState({ byteLength: 0x58, slotState: slots, acState: ac });
  const allocator = memory();const scheduler = createScriptScheduler(original, { frameAllocator: allocator });scheduler.addTask(0x252, [0, 0, 0, 0, created.value]);
  const first = visitTailWithState(scheduler, state);const before = ac.snapshot();
  assert.deepEqual(first.boundary, { nativeId: 0xAC, reason: 'state_source_required' });assert.equal(first.execution.pending.requestId, 2);assert.equal(first.execution.pending.pc, 145);
  const again = visitTailWithState(scheduler, state);assert.deepEqual(again.execution, first.execution);assert.deepEqual(ac.snapshot(), before);
  state.seed(0x56, [0x38, 0x12]);ac.seed(38, [0, 0]); // Explicit clock/flags fixtures.
  const result = visitTailWithState(scheduler, state);
  assert.deepEqual(result.actions.map(a => [a.nativeId, a.requestId]), [[0xAC, 2], [0xD2, 3], [0xA9, 4]]);
  assert.deepEqual(result.actions[2].args, [0xB9, 0x56, 0, 0, 0x217]);assert.equal(result.actions[2].value, 0x54);
  assert.equal(valueAt(ac, 0), 0);assert.equal(valueAt(ac, 2), 0x56);assert.equal(valueAt(ac, 28), 0x247);
  assert.equal(result.boundary, null);assert.equal(result.execution.tasks.length, 2);
  const spawned = result.execution.tasks.find(t => t.scriptId === 0x217);
  assert.equal(spawned.steps, 0);assert.equal(spawned.status, 'ready');
  assert.equal(slots.snapshot().columns['1350'][42], spawned.frames[0].memory.taskOffset);
  assert.deepEqual(allocator.snapshot().activeOrder, [0, 2]);
  assert.deepEqual(result.execution.tasks[0].wait, { scriptId: 0x252, pc: 38, mask: 1, remaining: 20, events: 0 });
  sweepWithState(scheduler, state); // Prime the original newest-first cursor.
  // Pin the first original instruction without driving later getter support.
  const later = scheduler.sweep();
  assert.equal(later.pending.nativeId, 0x4F);
  assert.equal(later.pending.scriptId, 0x217);assert.equal(later.pending.pc, 3);
  assert.deepEqual(later.pending.args, [0x54]);assert.equal(later.pending.requestId, 1);
  assert.equal(later.tasks[0].checks, 0);assert.equal(later.tasks[0].wait.remaining, 20);
});

test('AC initializer, native ABI and port-handshake instruction bytes are pinned to the original ROM', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  assert.equal(rom.subarray(0x511, 0x521).toString('hex').toUpperCase(), 'A9FEFF8DB01F9CCE1F9CD01F9CD41F60');
  assert.equal(rom.readUInt16LE(0x157B8 + 0xAC * 2), 0x8521);assert.equal(rom[0x15A4C + 0xAC], 1);assert.equal(rom[0x15970 + 0xAC], 0);
  assert.equal(rom.subarray(0xEF47, 0xEF4E).toString('hex').toUpperCase(), '8DDE1C225AF281');
  assert.equal(rom.subarray(0xF007, 0xF024).toString('hex').toUpperCase(), '08E220EBADE41CCD4021D0FB8E42211AEB8D4121EB8D40218DE41C286B');
});
