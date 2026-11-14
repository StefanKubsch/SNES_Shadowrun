import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
const request = (offset = 0) => ({ nativeId: 0x02, args: [offset], returnBytes: 2 });
const words = offset => [offset, 0xABCD, 0x1234, 0xFF80, 0x5678, 0x8000, 0xFE01, 0xCAEF];
const word = value => [0x14, value & 255, value >>> 8];
const call = offset => [...word(offset), 0x58, 2];
const bundle = (code, other = []) => ({ ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: code } : other.find(entry => entry.id === s.id) ?? s) });
const sourced = pointer => { const slots = createSlotState(); slots.seedSlotFields(0, { '13A8': pointer }); return slots; };

test('All 44 slots and all 14 covered record pointers read the live scratch byte without changing any slot field', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const slots = createSlotState();
    const workspaceWords = words(offset);
    const bytes = workspaceWords.flatMap(value => [value & 255, value >>> 8]);
    for (let pointer = 0; pointer <= 13; pointer++) {
      slots.seedSlotFields(offset, { '13A8': pointer });
      const before = slots.snapshot();
      assert.deepEqual(slots.applyNative(request(offset), { workspaceWords }), { handled: true, value: bytes[pointer + 1], workspaceWords: [bytes[pointer + 1]] });
      assert.deepEqual(slots.snapshot(), before);
    }
  }
});

test('All 65536 record words return the unsigned low byte and never sign extend it', () => {
  const slots = sourced(1); // First byte is low byte of workspace word 1.
  const workspaceWords = words(0);
  for (let value = 0; value <= 0xFFFF; value++) {
    workspaceWords[1] = value;
    assert.deepEqual(slots.applyNative(request(), { workspaceWords }), { handled: true, value: value % 256, workspaceWords: [value % 256] });
  }
});

test('A word read requires both source bytes even when the high read byte is later discarded; long addressing does not wrap', () => {
  const slots = sourced(0);
  const workspaceWords = [0, null, null, null, null, null, null, null];
  const before = slots.snapshot();
  assert.equal(slots.applyNative(request(), { workspaceWords }).reason, 'slot_record_source_required');
  assert.equal(slots.applyNative(request()).reason, 'slot_record_workspace_required');
  workspaceWords[1] = 0xCAFE;
  assert.equal(slots.applyNative(request(), { workspaceWords }).value, 0);
  for (const pointer of [14, 15, 0xFFFF]) {
    slots.seedSlotFields(0, { '13A8': pointer });
    assert.equal(slots.applyNative(request(), { workspaceWords: words(0) }).reason, 'slot_record_window_required');
  }
  slots.seedSlotFields(0, { '13A8': 0 });
  assert.deepEqual(slots.snapshot(), before);
});

test('Invalid ABI, offsets and mismatched, sparse or malformed scratch sources are rejected before mutation', () => {
  const slots = sourced(1); const before = slots.snapshot();
  for (const args of [[], [0, 0], new Array(1), [-1], [65536]]) assert.throws(() => slots.applyNative({ ...request(), args }), /ABI mismatch/);
  for (const returnBytes of [undefined, 0, 1]) assert.throws(() => slots.applyNative({ ...request(), returnBytes }), /ABI mismatch/);
  for (const offset of [1, 0x57, 0x58, 0xFFFF]) assert.equal(slots.applyNative(request(offset)).reason, 'slot_window_required');
  for (const workspaceWords of [[], new Array(8), [0, -1, 0, 0, 0, 0, 0, 0], [2, 1, 0, 0, 0, 0, 0, 0], { 0: 0 }, [0, 0, 0, 0, 0, 0, 0, 65536]]) assert.throws(() => slots.applyNative(request(), { workspaceWords }), /workspace source/);
  assert.deepEqual(slots.snapshot(), before);
  assert.equal(createSlotState().applyNative(request(), { workspaceWords: words(0) }).reason, 'slot_source_required');
  assert.equal(isScriptStateNative(createScriptState({ byteLength: 0x32 }), 2), false);
  assert.equal(isScriptStateNative(createScriptState({ byteLength: 0x32, slotState: slots }), 2), true);
});

test('Task and scheduler workspace reads are copies tied to the current request; forged or stale requests cannot observe them', () => {
  const allocator = memory();
  const task = createScriptTask(bundle([...call(0), 0x56]), 2, [], { frameAllocator: allocator });
  assert.throws(() => task.readNativeWorkspace(1), /pending native/);
  allocator.writeWorkspaceWords(words(0)); const first = task.run();
  const copy = task.readNativeWorkspace(first.pending.requestId); copy[1] = 0;
  assert.equal(task.readNativeWorkspace(first.pending.requestId)[1], 0xABCD);
  assert.throws(() => task.readNativeWorkspace(2), /pending native/);
  task.completeNative(1, 0, { workspaceWords: [0] });
  assert.throws(() => task.readNativeWorkspace(1), /pending native/);
  const scheduler = createScriptScheduler(bundle([...call(0), 0x56]), { frameAllocator: memory() });
  scheduler.addTask(2); const pending = scheduler.visitTail().pending;
  const before = scheduler.snapshot();
  for (const bad of [{ ...pending, taskId: 2 }, { ...pending, requestId: 2 }, { ...pending, nativeId: 3 }, { ...pending, args: [2] }, { ...pending, returnBytes: 0 }, { ...pending, args: new Array(1) }]) assert.throws(() => scheduler.readNativeWorkspace(bad), /matching/);
  assert.deepEqual(scheduler.snapshot(), before);
  const unallocated = createScriptTask(bundle([...call(0), 0x56]), 2); unallocated.run();
  assert.equal(unallocated.readNativeWorkspace(1), null);
  assert.equal(runTaskWithState(unallocated, createScriptState({ byteLength: 0x32, slotState: sourced(0) })).boundary.reason, 'slot_record_workspace_required');
});

test('Source-backed completion overwrites only scratch word 0; malformed byte-return responses preserve suspended state and memory', () => {
  const allocator = memory();
  const scheduler = createScriptScheduler(bundle([...call(0), 0x58, 0x11, 0x56]), { frameAllocator: allocator });
  scheduler.addTask(2); allocator.writeWorkspaceWords(words(0));
  const first = scheduler.visitTail(); const before = allocator.snapshot();
  for (const [value, workspaceWords] of [[256, [256]], [0, [1]], [0, new Array(1)], [0, [0, 1]], [0xFFFF, [0xFFFF]]]) {
    assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, value, { workspaceWords }), /return value|workspace/);
    assert.deepEqual(scheduler.snapshot(), first);assert.deepEqual(allocator.snapshot(), before);
  }
  const result = visitTailWithState(scheduler, createScriptState({ byteLength: 0x32, slotState: sourced(1) }));
  assert.equal(result.actions[0].value, 0xCD);
  assert.equal(result.boundary.nativeId, 0x11);
  assert.deepEqual(allocator.snapshot().workspace, [0xCD, ...words(0).slice(1)]);
});

test('A missing read byte retains the pending native and resumes the same original allocation after explicit workspace hydration', () => {
  const allocator = memory();
  const scheduler = createScriptScheduler(bundle([...call(0), 0x56]), { frameAllocator: allocator });
  scheduler.addTask(2);
  const slots = sourced(0);const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const first = visitTailWithState(scheduler, state); const before = allocator.snapshot();
  assert.deepEqual(first.boundary, { nativeId: 2, reason: 'slot_record_source_required' });
  assert.deepEqual(visitTailWithState(scheduler, state).execution, first.execution);
  assert.deepEqual(allocator.snapshot(), before);
  allocator.writeWorkspaceWords([0xABCD], 1); // Explicit source fixture, not a record initializer.
  const result = visitTailWithState(scheduler, state);
  assert.equal(result.actions[0].requestId, 1);assert.equal(result.actions[0].value, 0);
  assert.equal(result.execution.status, 'idle');assert.deepEqual(allocator.snapshot().activeOrder, []);
});

test('The action budget stops before a second record read and that request resumes exactly once', () => {
  const allocator = memory();const slots = sourced(1);const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const task = createScriptTask(bundle([...call(0), 0xC0, ...call(0), 0x58, 0x11, 0x56]), 2, [], { frameAllocator: allocator });
  allocator.writeWorkspaceWords(words(0));
  assert.throws(() => runTaskWithState(task, state, { maxNativeCalls: 1 }), /budget exhausted/);
  assert.equal(task.snapshot().pending.requestId, 2);assert.equal(task.snapshot().pending.nativeId, 2);
  const result = runTaskWithState(task, state, { maxNativeCalls: 1 });
  assert.equal(result.actions[0].requestId, 2);assert.equal(result.actions[0].value, 0xCD);
  assert.equal(result.boundary.nativeId, 0x11);
});

test('Child 02 completion resumes its parent without replacing the shared workspace or disturbing original list release', () => {
  const parent = { ...original.scripts.find(s => s.id === 0x10A), bytecode: [0x52, 2, 0, 0x58, 0x11, 0x56] };
  const allocator = memory();const scheduler = createScriptScheduler(bundle([...call(0), 0x56], [parent]), { frameAllocator: allocator });
  scheduler.addTask(0x10A);allocator.writeWorkspaceWords(words(0));
  const result = visitTailWithState(scheduler, createScriptState({ byteLength: 0x32, slotState: sourced(1) }));
  assert.equal(result.actions[0].value, 0xCD);assert.equal(result.execution.pending.scriptId, 0x10A);
  assert.deepEqual(allocator.snapshot().activeOrder, [0]);assert.equal(allocator.snapshot().cursorOffset, 0);
  assert.deepEqual(allocator.snapshot().workspace, [0xCD, ...words(0).slice(1)]);
});

test('Original 105 runs D2/CF/two 02 calls, waits in original 101 and continues the same child-wait loop', () => {
  const slots = createSlotState({ definitionData: definitions, actionData: data });
  const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  const allocator = memory();const scheduler = createScriptScheduler(original, { frameAllocator: allocator });
  scheduler.addTask(0x105, [created.value]);const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const first = visitTailWithState(scheduler, state);
  assert.deepEqual(first.actions.map(a => [a.nativeId, a.requestId, a.value]), [[0xD2, 1, null], [0xCF, 2, null], [2, 3, 0], [2, 4, 0]]);
  assert.equal(first.boundary, null);assert.equal(first.execution.tasks[0].status, 'waiting');
  assert.deepEqual(first.execution.tasks[0].wait, { scriptId: 0x101, pc: 5, mask: 1, remaining: 1, events: 0 });
  assert.deepEqual(first.execution.tasks[0].frames.map(f => f.id), [0x105, 0x101]);
  assert.deepEqual(allocator.snapshot().activeOrder, [0, 2]);
  assert.equal(sweepWithState(scheduler, state).execution.tasks[0].checks, 0); // First sweep primes cursor only.
  const again = sweepWithState(scheduler, state);
  assert.deepEqual(again.actions.map(a => [a.nativeId, a.requestId, a.value]), [[2, 5, 0]]);
  assert.equal(again.execution.tasks[0].checks, 1);assert.equal(again.execution.tasks[0].status, 'waiting');
  assert.deepEqual(again.execution.tasks[0].frames.map(f => f.id), [0x105, 0x101]);
  assert.deepEqual(allocator.snapshot().activeOrder, [0, 2]);
});

test('Native 02 pointer, ABI, fifteen original bytes and global Direct Page zero switch are source-pinned', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  assert.equal(rom.readUInt16LE(0x157B8 + 4), 0xCA3A);assert.equal(rom[0x15A4C + 2], 1);assert.equal(rom[0x15970 + 2], 2);
  assert.equal(rom.subarray(0x4A3A, 0x4A49).toString('hex').toUpperCase(), 'A400BEA813BF01007E29FF00850060');
  assert.equal(rom.subarray(0x74F7, 0x7500).toString('hex').toUpperCase(), 'A900005BF48080ABAB');
});
