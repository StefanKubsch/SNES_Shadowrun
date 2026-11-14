import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { runTaskWithState, visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const asset = JSON.parse(await readFile(new URL('../assets/slot-action-data.json', import.meta.url), 'utf8'));
const data = createSlotActionData(asset);
const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const profiles = createTaskFrameProfiles(JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8')));
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const memory = () => createTaskFrameAllocator({ profileData: profiles });
const request = (offset = 0, value = 1) => ({ nativeId: 0x6A, args: [offset, value], returnBytes: 0 });
const word = value => [0x14, value & 255, value >>> 8];
const call = value => [...word(value), ...word(0), 0x58, 0x6A];
const fixture = (code, second = null) => ({ ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: code } : s.id === 0x20 && second ? { ...s, bytecode: second } : s) });
const sourced = (fields = {}) => {
  const slots = createSlotState({ actionData: data });
  slots.seedSlotFields(0, { '1198': 0, '10E8': 1, '1090': 0x8000, '11F0': 0xAB80, ...fields });
  return slots;
};

test('Every low byte and 256 original data indices use modular SBC/CLC/ADC without changing the high byte', () => {
  const slots = sourced();
  const oldIndex = 127;
  const oldData = rom[0x60000 + oldIndex];
  for (let next = 0; next <= 255; next++) {
    if (next === oldIndex) continue; // Equality is already separately covered.
    const newData = rom[0x60000 + next];
    for (let byte = 0; byte <= 255; byte++) {
      slots.seedSlotFields(0, { '1198': oldIndex, '11F0': 0xAB00 | byte });
      assert.equal(slots.applyNative(request(0, next)).handled, true);
      const after = slots.snapshot();
      assert.equal(after.columns['11F0'][0], 0xAB00 | ((byte + 256 - oldData + newData) % 256));
      assert.equal(after.columns['1198'][0], next);
      assert.equal(after.columns['7E:4030'][0], 0x80);
      assert.equal(after.columns['1140'][0], 0xFFFF);
    }
  }
});

test('A byte write needs only a known low byte, preserves an unknown high byte and synchronizes later byte/word hydration', () => {
  const slots = createSlotState({ actionData: data });
  slots.seedSlotFields(0, { '1198': 0, '10E8': 1, '1090': 0x8000 });
  slots.seedSlotFieldByte(0, '11F0', 0, 0xF0);
  const result = slots.applyNative(request());
  assert.equal(result.handled, true);
  const expected = (0xF0 - rom[0x60000] + rom[0x60001]) & 255;
  const after = slots.snapshot();
  assert.deepEqual(after.fieldBytes['11F0'][0], [expected, null]);
  assert.equal(after.columns['11F0'][0], null);
  after.fieldBytes['11F0'][0][1] = 0;
  assert.equal(slots.snapshot().fieldBytes['11F0'][0][1], null);
  slots.seedSlotFieldByte(0, '11F0', 1, 0xCA);
  assert.equal(slots.snapshot().columns['11F0'][0], 0xCA00 | expected);
  slots.seedSlotFields(0, { '11F0': 0xBEEF });
  assert.deepEqual(slots.snapshot().fieldBytes['11F0'][0], [0xEF, 0xBE]);
  slots.seedSlot(0, { definitionWord: 11, count: 0, head: 0, fields: { '11F0': 0x1234 } });
  assert.deepEqual(slots.snapshot().fieldBytes['11F0'][0], [0x34, 0x12]);
});

test('All 44 byte-path slots change only four original fields and two scratch words; selection/count/list data are not prerequisites', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const slots = createSlotState({ actionData: data });
    slots.seedSlotFields(offset, { '1198': 0, '10E8': 0x7F, '1090': 0x8000, '11F0': 0xAB80 });
    const before = slots.snapshot();
    const expected = structuredClone(before);
    const byte = (0x80 - rom[0x60000] + rom[0x60001]) & 255;
    const i = offset / 2;
    expected.columns['1198'][i] = 1;
    expected.columns['11F0'][i] = 0xAB00 | byte;
    expected.fieldBytes['11F0'][i] = [byte, 0xAB];
    expected.columns['7E:4030'][i] = 0x80;
    expected.columns['1140'][i] = 0xFFFF;
    assert.deepEqual(slots.applyNative(request(offset)), { handled: true, value: null, workspaceWords: [offset, 1], workspaceWrites: [{ index: 4, value: 0x8000 }, { index: 5, value: 0x8C }] });
    assert.deepEqual(slots.snapshot(), expected);
  }
});

test('Missing providers, pointers/low bytes and either outside-window read stop before every slot effect; equality bypasses them', () => {
  const missing = createSlotState();
  missing.seedSlotFields(0, { '1198': 0, '10E8': 1 });
  const beforeMissing = missing.snapshot();
  assert.equal(missing.applyNative(request()).reason, 'slot_action_data_source_required');
  assert.deepEqual(missing.snapshot(), beforeMissing);
  for (const [pointer, oldIndex, nextIndex] of [[0xFFFF, 0, 1], [0x7FFF, 0, 1], [0x7FFF, 1, 0], [0x8000, 0xFFFF, 1], [0x8000, 0, 0x8000]]) {
    const slots = sourced({ '1090': pointer, '1198': oldIndex });
    const before = slots.snapshot();
    assert.equal(slots.applyNative(request(0, nextIndex)).reason, 'slot_action_data_window_required');
    assert.deepEqual(slots.snapshot(), before);
  }
  for (const fields of [{ '1198': 0, '10E8': 1, '11F0': 0 }, { '1198': 0, '10E8': 1, '1090': 0x8000 }]) {
    const slots = createSlotState({ actionData: data });
    slots.seedSlotFields(0, fields);
    const before = slots.snapshot();
    assert.equal(slots.applyNative(request()).reason, 'slot_source_required');
    assert.deepEqual(slots.snapshot(), before);
    assert.equal(slots.applyNative(request(0, 0)).handled, true);
  }
});

test('16-bit Y indices stay unrounded, and a pointer below ROM can index into the selected source window', () => {
  for (const [pointer, oldIndex, newIndex] of [[0, 0x8000, 0x8001], [0x8000, 0x100, 0x101], [0xFFFD, 0, 2], [0x7FFF, 1, 2]]) {
    const slots = sourced({ '1090': pointer, '1198': oldIndex });
    assert.equal(slots.applyNative(request(0, newIndex)).handled, true);
    const oldByte = rom[0x60000 + pointer + oldIndex - 0x8000];
    const newByte = rom[0x60000 + pointer + newIndex - 0x8000];
    assert.equal(slots.snapshot().columns['11F0'][0], 0xAB00 | ((0x80 - oldByte + newByte) & 255));
  }
});

test('Provider/byte-hydration validation never mutates fields; A9 and B9 preserve known or unknown 11F0 bytes', async () => {
  assert.throws(() => createSlotState({ actionData: {} }), /slot action source/);
  const definitions = createSlotDefinitions(JSON.parse(await readFile(new URL('../assets/slot-definitions.json', import.meta.url), 'utf8')));
  const slots = createSlotState({ actionData: data, definitionData: definitions });
  const before = slots.snapshot();
  for (const args of [[1, '11F0', 0, 1], [0, '1198', 0, 1], [0, '11F0', 2, 1], [0, '11F0', 0, -1], [0, '11F0', 0, 256], [0, '11F0', 0, 1.5]]) assert.throws(() => slots.seedSlotFieldByte(...args), /byte seed/);
  assert.deepEqual(slots.snapshot(), before);
  slots.seedSlotFieldByte(0x56, '11F0', 0, 0xAB);
  slots.applyNative({ nativeId: 0xA9, args: [11, 0, 0, 0, 0xFFFF], returnBytes: 2 });
  assert.deepEqual(slots.snapshot().fieldBytes['11F0'][43], [0xAB, null]);
  slots.applyNative({ nativeId: 0xB9, args: [0x56], returnBytes: 0 });
  assert.deepEqual(slots.snapshot().fieldBytes['11F0'][43], [0xAB, null]);
  assert.equal(slots.snapshot().columns['11F0'][43], null);
});

test('Byte-path workspace writes preserve untouched words and malformed sparse or cross-native replies cannot alter suspension', () => {
  const allocator = memory();
  const scheduler = createScriptScheduler(fixture([...call(1), 0x58, 0x11, 0x56]), { frameAllocator: allocator });
  scheduler.addTask(2);
  allocator.writeWorkspaceWords([1, 2, 3, 4, 5, 6, 7, 8]);
  const first = scheduler.visitTail();
  for (const workspaceWrites of [new Array(2), [{ index: 4, value: 0x8000 }], [{ index: 3, value: 0x8000 }, { index: 5, value: 0x8C }], [{ index: 4, value: 0x8000 }, { index: 5, value: 0x8D }], [{ index: 4, value: 65536 }, { index: 5, value: 0x8C }]]) {
    assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords: [0, 1], workspaceWrites }), /workspace/);
    assert.deepEqual(scheduler.snapshot(), first);
  }
  const slots = sourced();
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const result = visitTailWithState(scheduler, state);
  assert.equal(result.boundary.nativeId, 0x11);
  assert.deepEqual(allocator.snapshot().workspace, [0, 1, 3, 4, 0x8000, 0x8C, 7, 8]);
  const paused = scheduler.snapshot();
  assert.throws(() => scheduler.completeNative(paused.pending.taskId, paused.pending.requestId, null, { workspaceWords: [0, 1], workspaceWrites: [{ index: 4, value: 0x8000 }, { index: 5, value: 0x8C }] }), /workspace/);
  assert.deepEqual(scheduler.snapshot(), paused);
  const oldMemory = allocator.snapshot();
  assert.throws(() => allocator.writeWorkspaceWords([1, 2], 7), /workspace_window/);
  assert.throws(() => allocator.writeWorkspaceWords([1], -1), /workspace_window/);
  assert.deepEqual(allocator.snapshot(), oldMemory);
});

test('Native budget prevents a second byte update and its pending request resumes once on the same original frame', () => {
  const allocator = memory();
  const task = createScriptTask(fixture([...call(1), ...call(2), 0x56]), 2, [], { frameAllocator: allocator });
  const slots = sourced();
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  assert.throws(() => runTaskWithState(task, state, { maxNativeCalls: 1 }), /budget exhausted/);
  const afterFirst = slots.snapshot();
  assert.equal(afterFirst.columns['1198'][0], 1);
  assert.equal(task.snapshot().pending.requestId, 2);
  const result = runTaskWithState(task, state, { maxNativeCalls: 1 });
  assert.equal(result.execution.status, 'ended');
  assert.equal(result.actions[0].requestId, 2);
  assert.equal(slots.snapshot().columns['11F0'][0], 0xAB00 | ((0x80 - rom[0x60000] + rom[0x60002]) & 255));
});

test('Shared byte effects occur newest-first and preserve the already waiting spectator and repaired original cursor', () => {
  const allocator = memory();
  const scheduler = createScriptScheduler(fixture([...call(1), 0x56], [...call(2), 0x56]), { frameAllocator: allocator });
  const slots = sourced();
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const spectator = scheduler.addTask(0x04B);
  visitTailWithState(scheduler, state);
  const older = scheduler.addTask(2);
  const newer = scheduler.addTask(0x20);
  sweepWithState(scheduler, state);
  const result = sweepWithState(scheduler, state);
  assert.deepEqual(result.actions.map(a => [a.taskId, a.nativeId, a.args]), [[newer, 0x6A, [0, 2]], [older, 0x6A, [0, 1]]]);
  assert.equal(result.execution.tasks[0].taskId, spectator);
  assert.equal(result.execution.tasks[0].checks, 1);
  assert.deepEqual(allocator.snapshot().activeOrder, [0]);
  assert.equal(slots.snapshot().columns['11F0'][0], 0xAB00 | ((0x80 - rom[0x60000] + rom[0x60001]) & 255));
});

test('Unmodified original $318 uses the actual byte path with explicit field fixtures and stops at the next native 63', () => {
  const allocator = memory();
  const scheduler = createScriptScheduler(original, { frameAllocator: allocator });
  const slots = sourced();
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  scheduler.addTask(0x318, [0]);
  const result = visitTailWithState(scheduler, state);
  assert.deepEqual(result.actions.map(a => [a.nativeId, a.requestId]), [[0x6A, 1]]);
  assert.deepEqual(result.boundary, { nativeId: 0x63, reason: 'native_implementation_required' });
  assert.equal(result.execution.pending.pc, 77);
  assert.equal(slots.snapshot().columns['1198'][0], 5);
  assert.equal(slots.snapshot().columns['11F0'][0], 0xAB00 | ((0x80 - rom[0x60000] + rom[0x60005]) & 255));
  assert.deepEqual(allocator.snapshot().workspace, [0, 5, null, null, 0x8000, 0x8C, null, null]);
  assert.deepEqual(slots.snapshot().definitions, Array(44).fill(0xFFFF));
});
