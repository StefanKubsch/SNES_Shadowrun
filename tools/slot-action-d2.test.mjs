import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createScriptState, isScriptStateNative } from '../proof/state/script-state.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { runTaskWithState, visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const asset = JSON.parse(await readFile(new URL('../assets/slot-action-data.json', import.meta.url), 'utf8'));
const data = createSlotActionData(asset);
const definitions = createSlotDefinitions(JSON.parse(await readFile(new URL('../assets/slot-definitions.json', import.meta.url), 'utf8')));
const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const profiles = createTaskFrameProfiles(JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8')));
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const memory = () => createTaskFrameAllocator({ profileData: profiles });
const request = (offset = 0, selection = 0, next = 1) => ({ nativeId: 0xD2, args: [offset, selection, next], returnBytes: 0 });
const word = value => [0x14, value & 255, value >>> 8];
const call = (selection, next) => [...word(next), ...word(selection), ...word(0), 0x58, 0xD2];
const bundle = (code, second = null) => ({ ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: code } : s.id === 0x20 && second ? { ...s, bytecode: second } : s) });
function fixture({ branchByte = 0x81, counterPointer = 0x8108 } = {}) {
  const patched = structuredClone(asset);
  const putWord = (pointer, value) => { patched.bytes[pointer - 0x8000] = value & 255; patched.bytes[pointer - 0x8000 + 1] = value >>> 8; };
  putWord(0xED8A + 22, 0x8000);
  putWord(0x8000, 0x8100);
  const bytes = [1, branchByte, 2, 127, 128, 255, 0, 255, 0x20, 0x60, 0x90];
  for (let i = 0; i < bytes.length; i++) patched.bytes[0x100 + i] = bytes[i];
  // Two non-overlapping entry words allow selecting record FFF6, whose
  // current counter word is covered but next index 2 leaves the bank.
  if (counterPointer === 0xFFFE) {
    putWord(0x8000, 0xFFF6);
    for (let i = 0; i < 8; i++) patched.bytes[0x7FF6 + i] = bytes[i];
    putWord(0xFFFE, 0xAB20);
  }
  return createSlotActionData(patched);
}
function sourced(actionData = fixture(), fields = {}) {
  const slots = createSlotState({ actionData });
  slots.seedSlot(0, { definitionWord: 11, count: 0, head: 0, fields: { '1198': 0, '1038': 0xFFFF, ...fields } });
  return slots;
}

test('All 44 D2 offsets with two equality returns need no data provider or branch field and restore only words 0/1', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const slots = createSlotState();
    slots.seedSlotFields(offset, { '1038': 0xBEEF, '1198': 5 });
    const before = slots.snapshot();
    assert.deepEqual(slots.applyNative(request(offset, 0xBEEF, 5)), { handled: true, value: null, workspaceWords: [offset, 5, 5] });
    assert.deepEqual(slots.snapshot(), before);
  }
});

test('Helper equality followed by byte 6A preserves unknown high 11F0 and unrelated scratch word 3', () => {
  const slots = createSlotState({ actionData: data });
  slots.seedSlotFields(0, { '1038': 7, '1198': 0, '10E8': 1, '1090': 0x8000 });
  slots.seedSlotFieldByte(0, '11F0', 0, 0x80);
  const allocator = memory();
  const scheduler = createScriptScheduler(bundle([...call(7, 1), 0x58, 0x11, 0x56]), { frameAllocator: allocator });
  scheduler.addTask(2);
  allocator.writeWorkspaceWords([1, 2, 3, 4, 5, 6, 7, 8]);
  const result = visitTailWithState(scheduler, createScriptState({ byteLength: 0x32, slotState: slots }));
  assert.equal(result.boundary.nativeId, 0x11);
  assert.deepEqual(allocator.snapshot().workspace, [0, 1, 1, 4, 0x8000, 0x8C, 7, 8]);
  const low = (0x80 - rom[0x60000] + rom[0x60001]) & 255;
  assert.deepEqual(slots.snapshot().fieldBytes['11F0'][0], [low, null]);
  assert.equal(slots.snapshot().columns['1038'][0], 7);
});

test('Helper equality can lead to the complete non-helper 6A return without a provider', () => {
  const slots = createSlotState();
  slots.seedSlotFields(0, { '1038': 0xFFFF, '1198': 0, '10E8': 0 });
  assert.deepEqual(slots.applyNative(request(0, 0xFFFF, 6)), { handled: true, value: null, workspaceWords: [0, 6, 6] });
  assert.equal(slots.snapshot().columns['1198'][0], 6);
});

test('A985 loads using OLD 1198; equality or byte 6A then keeps the record pointer instead of restoring original word 2', () => {
  for (const next of [0, 1]) {
    const slots = sourced();
    const result = slots.applyNative(request(0, 0, next));
    assert.deepEqual(result, { handled: true, value: null, workspaceWords: [0, next, 0x8100, 0x8C, 0x8108, 0x8C] });
    const after = slots.snapshot();
    assert.equal(after.columns['1198'][0], next);
    assert.equal(after.columns['11F0'][0], next === 0 ? 0x20 : 0x60);
    assert.deepEqual(after.fieldBytes['11F0'][0], [next === 0 ? 0x20 : 0x60, 0]);
    assert.equal(after.columns['10E8'][0], 1);
    assert.equal(after.columns['1038'][0], 0);
  }
});

test('A985 followed by helper 6A performs the second load at the NEW index and may replace the restored slot again', () => {
  const patched = structuredClone(asset);
  const put = (pointer, values) => { for (let i = 0; i < values.length; i++) patched.bytes[pointer - 0x8000 + i] = values[i]; };
  put(0xED8A + 22, [0, 0x80]);
  // First selection 8000 adds ASL carry: entry 8001 -> record A181.
  // 6A masks selection to 0: entry 8000 -> record 8100.
  put(0x8000, [0, 0x81, 0xA1]);
  put(0xA181, [1, 0x80, 2, 3, 4, 5, 6, 7, 0x22, 0x33, 0]);
  put(0x8100, [8, 0x80, 9, 10, 11, 12, 13, 14, 0x44, 0xEE, 0]);
  const slots = sourced(createSlotActionData(patched));
  assert.deepEqual(slots.applyNative(request(0, 0x8000, 1)), { handled: true, value: null, workspaceWords: [0x8000, 0x8C, 0x8100, 0x8C, 0x8108, 0x8C] });
  const after = slots.snapshot();
  assert.equal(after.columns['1198'][0], 1);
  assert.equal(after.columns['1038'][0], 0);
  assert.equal(after.columns['11F0'][0], 0xEE);
  assert.equal(after.columns['7E:4088'][0], 8);
  assert.equal(after.columns['7E:43A0'][0], 14);
});

test('A985 equality followed by helper 6A replaces all six scratch words and reads the new index', () => {
  const slots = sourced(fixture({ branchByte: 0x80 }), { '1038': 0, '10E8': 0 });
  assert.deepEqual(slots.applyNative(request()), { handled: true, value: null, workspaceWords: [0x8000, 0x8C, 0x8100, 0x8C, 0x8108, 0x8C] });
  assert.equal(slots.snapshot().columns['11F0'][0], 0x60);
  assert.equal(slots.snapshot().columns['1198'][0], 1);
});

test('A second-phase data gap leaves first-phase selection and fields untouched and keeps the same pending request', () => {
  const slots = sourced(fixture({ counterPointer: 0xFFFE }));
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const allocator = memory();
  const scheduler = createScriptScheduler(bundle([...call(0, 2), 0x56]), { frameAllocator: allocator });
  scheduler.addTask(2);
  const beforeSlots = slots.snapshot();
  const result = visitTailWithState(scheduler, state);
  assert.deepEqual(result.boundary, { nativeId: 0xD2, reason: 'slot_action_data_window_required' });
  assert.equal(result.execution.pending.requestId, 1);
  assert.deepEqual(slots.snapshot(), beforeSlots);
  const beforeMemory = allocator.snapshot();
  const again = visitTailWithState(scheduler, state);
  assert.deepEqual(again.execution, result.execution);
  assert.deepEqual(allocator.snapshot(), beforeMemory);
  // Explicit equality hydration removes the two source gaps, same request.
  slots.seedSlotFields(0, { '1038': 0, '1198': 2 });
  const resumed = visitTailWithState(scheduler, state);
  assert.equal(resumed.execution.status, 'idle');
  assert.deepEqual(resumed.execution.tasks, []);
  assert.equal(resumed.actions[0].requestId, 1);
});

test('D2 missing data, sparse/invalid ABI and offset validation precede all mutations and host support is state-dependent', () => {
  const slots = createSlotState();
  const before = slots.snapshot();
  for (const args of [[], [0, 0], [0, 0, 0, 0], new Array(3), [0, -1, 0], [0, 0, 65536]]) assert.throws(() => slots.applyNative({ ...request(), args }), /ABI mismatch/);
  for (const returnBytes of [undefined, 2, 1]) assert.throws(() => slots.applyNative({ ...request(), returnBytes }), /ABI mismatch/);
  for (const offset of [1, 0x57, 0x58, 0xFFFF]) assert.equal(slots.applyNative(request(offset)).reason, 'slot_window_required');
  assert.equal(slots.applyNative(request()).reason, 'slot_source_required');
  assert.deepEqual(slots.snapshot(), before);
  assert.equal(isScriptStateNative(createScriptState({ byteLength: 0x32 }), 0xD2), false);
  assert.equal(isScriptStateNative(createScriptState({ byteLength: 0x32, slotState: slots }), 0xD2), true);
  slots.seedSlotFields(0, { '1038': 0xFFFF, '1198': 0 });
  const seeded = slots.snapshot();
  assert.equal(slots.applyNative(request()).reason, 'slot_action_data_source_required');
  assert.deepEqual(slots.snapshot(), seeded);
});

test('Invalid D2 scratch layouts and additional writes cannot mutate a pending scheduler or its allocator', () => {
  const allocator = memory();
  const scheduler = createScriptScheduler(bundle([...call(7, 1), 0x56]), { frameAllocator: allocator });
  scheduler.addTask(2);
  const first = scheduler.visitTail();
  const before = allocator.snapshot();
  for (const workspaceWords of [new Array(3), new Array(6), [0, 7, 1], [0, 1, 2], [0, 1], [0, 1, 0x8100, 0, 0x8108, 0x8C], [2, 1, 0x8100, 0x8C, 0x8108, 0x8C]]) {
    assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords }), /workspace/);
    assert.deepEqual(scheduler.snapshot(), first);
    assert.deepEqual(allocator.snapshot(), before);
  }
  assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords: [0, 1, 0x8100, 0x8C, 0x8108, 0x8C], workspaceWrites: [{ index: 4, value: 0x8108 }, { index: 5, value: 0x8C }] }), /workspace/);
  assert.deepEqual(allocator.snapshot(), before);
});

test('D2 is one budgeted native action despite both phases; a second pending D2 resumes exactly once', () => {
  const slots = sourced();
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const task = createScriptTask(bundle([...call(0, 1), ...call(0, 2), 0x56]), 2, [], { frameAllocator: memory() });
  assert.throws(() => runTaskWithState(task, state, { maxNativeCalls: 1 }), /budget exhausted/);
  assert.equal(slots.snapshot().columns['1198'][0], 1);
  assert.equal(task.snapshot().pending.requestId, 2);
  const result = runTaskWithState(task, state, { maxNativeCalls: 1 });
  assert.equal(result.execution.status, 'ended');
  assert.equal(result.actions[0].requestId, 2);
  assert.equal(slots.snapshot().columns['11F0'][0], 0x90);
});

test('Shared D2 effects use newest-first task order and preserve a waiting spectator and the original cursor', () => {
  const allocator = memory();
  const scheduler = createScriptScheduler(bundle([...call(0, 1), 0x56], [...call(0, 2), 0x56]), { frameAllocator: allocator });
  const slots = sourced();
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const spectator = scheduler.addTask(0x04B);
  visitTailWithState(scheduler, state);
  const older = scheduler.addTask(2);
  const newer = scheduler.addTask(0x20);
  sweepWithState(scheduler, state);
  const result = sweepWithState(scheduler, state);
  assert.deepEqual(result.actions.map(a => [a.taskId, a.nativeId]), [[newer, 0xD2], [older, 0xD2]]);
  assert.equal(slots.snapshot().columns['1198'][0], 1);
  assert.equal(slots.snapshot().columns['11F0'][0], 0x60);
  assert.equal(result.execution.tasks[0].taskId, spectator);
  assert.equal(result.execution.tasks[0].checks, 1);
  assert.deepEqual(allocator.snapshot().activeOrder, [0]);
});

test('D2 pointer, ABI and complete 17 machine bytes match the European original', () => {
  assert.equal(rom.readUInt16LE(0x157B8 + 0xD2 * 2), 0xD15C);
  assert.equal(rom[0x15A4C + 0xD2], 3);
  assert.equal(rom[0x15970 + 0xD2], 0);
  assert.equal(rom.subarray(0x515C, 0x516D).toString('hex').toUpperCase(), 'D404D4002085A968850068850220AFAA60');
});

test('Actual A9 creation allows unmodified original 105/252 through D2 using original data without extra field fixtures', () => {
  for (const [id, args, nativeId, pc, nativeArgs, next, counter] of [[0x105, offset => [offset], 0xCF, 154, [0x56, 0x80], 0, 8], [0x252, offset => [0, 0, 0, 0, offset], 0xAC, 145, [0x56], 6, 20]]) {
    const slots = createSlotState({ actionData: data, definitionData: definitions });
    const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
    const allocator = memory();
    const scheduler = createScriptScheduler(original, { frameAllocator: allocator });
    scheduler.addTask(id, args(created.value));
    // Stop after D2 itself; later supported actions do not change this proof.
    const first = scheduler.visitTail();
    assert.equal(first.pending.nativeId, 0xD2);
    assert.equal(first.pending.args[0], created.value);
    const action = slots.applyNative(first.pending);
    assert.equal(action.handled, true);
    const result = scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords: action.workspaceWords });
    assert.equal(result.pending.nativeId, nativeId);
    assert.equal(result.pending.pc, pc);
    assert.deepEqual(result.pending.args, nativeArgs);
    assert.equal(result.pending.requestId, 2);
    assert.equal(slots.snapshot().columns['1038'][43], 0);
    assert.equal(slots.snapshot().columns['1198'][43], next);
    assert.equal(slots.snapshot().columns['11F0'][43], counter);
  }
});
