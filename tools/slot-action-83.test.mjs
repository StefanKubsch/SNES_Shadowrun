import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createACState } from '../proof/state/ac-state.mjs';
import { createScriptState, isScriptStateNative } from '../proof/state/script-state.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const original = await load('scripts');
const profiles = createTaskFrameProfiles(await load('task-frame-profiles'));
const definitions = createSlotDefinitions(await load('slot-definitions'));
const data = createSlotActionData(await load('slot-action-data'));
const request = (args = [0, 1, 2, 3]) => ({ nativeId: 0x83, args, returnBytes: 0 });
const keys = ['0E28', '0E80', '0ED8'];
const memory = () => createTaskFrameAllocator({ profileData: profiles });
const codeFor = args => [...args.toReversed().flatMap(word => [0x14, word & 255, word >>> 8]), 0x58, 0x83, 0x58, 0x11, 0x56];
const bundle = args => ({ ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: codeFor(args) } : s) });

test('83 copies every possible word without scaling or signed conversion; getters subsequently shift those words', () => {
  const slots = createSlotState();
  for (let word = 0; word <= 0xFFFF; word++) {
    const values = [word, word ^ 0xFFFF, (word + 1) & 0xFFFF];
    const args = [0, ...values];
    assert.deepEqual(slots.applyNative(request(args)), { handled: true, value: null, workspaceWords: args });
    for (let i = 0; i < 3; i++) assert.equal(slots.applyNative({ nativeId: 0x4F + i, args: [0], returnBytes: 2 }).value, values[i] >>> 2);
  }
});

test('83 writes exactly three columns at all 44 offsets without requiring old fields, occupancy or changing 0F30', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const slots = createSlotState();slots.seedSlotFields(offset, { '0F30': 0xBEEF });
    const expected = slots.snapshot();const values = [0xFFFF, 0x8001, 0x4003];
    keys.forEach((key, i) => { expected.columns[key][offset / 2] = values[i]; });
    slots.applyNative(request([offset, ...values]));assert.deepEqual(slots.snapshot(), expected);
  }
});

test('83 rejects incomplete ABI before any writes and keeps unsupported slot offsets pending', () => {
  const slots = createSlotState();const before = slots.snapshot();
  for (const args of [[], [0, 1, 2], [0, 1, 2, 3, 4], new Array(4), [0, 1, -1, 3], [0, 65536, 2, 3]]) assert.throws(() => slots.applyNative(request(args)), /ABI mismatch/);
  for (const returnBytes of [undefined, 1, 2]) assert.throws(() => slots.applyNative({ ...request(), returnBytes }), /ABI mismatch/);
  for (const offset of [1, 0x57, 0x58, 0xFFFF]) assert.deepEqual(slots.applyNative(request([offset, 1, 2, 3])), { handled: false, reason: 'slot_window_required' });
  assert.deepEqual(slots.snapshot(), before);
  assert.equal(isScriptStateNative(createScriptState({ byteLength: 2 }), 0x83), false);
  assert.equal(isScriptStateNative(createScriptState({ byteLength: 2, slotState: slots }), 0x83), true);
});

test('83 completion preserves all scratch words; forged prefixes and indexed writes fail before scheduler mutation', () => {
  const args = [0x54, 484, 1824, 272];const allocator = memory();
  const scheduler = createScriptScheduler(bundle(args), { frameAllocator: allocator });scheduler.addTask(2);
  allocator.writeWorkspaceWords([11, 12, 13, 14, 15, 16, 17, 18]);
  const first = scheduler.visitTail();const before = allocator.snapshot();
  for (const workspaceWords of [[0x54, 484, 1824, 273], new Array(4), args.slice(0, 3), [...args, 0]]) {
    assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords }), /workspace/);
    assert.deepEqual(scheduler.snapshot(), first);assert.deepEqual(allocator.snapshot(), before);
  }
  assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords: args, workspaceWrites: [{ index: 4, value: 1 }, { index: 5, value: 0x8C }] }), /workspace/);
  assert.deepEqual(allocator.snapshot(), before);
  const slots = createSlotState();const state = createScriptState({ byteLength: 2, slotState: slots });
  assert.throws(() => visitTailWithState(scheduler, state, { maxNativeCalls: 0 }), /Invalid native action budget/);
  assert.equal(slots.snapshot().columns['0E28'][42], null);assert.deepEqual(allocator.snapshot(), before);
  const result = visitTailWithState(scheduler, state, { maxNativeCalls: 1 });
  assert.deepEqual(result.actions.map(a => [a.nativeId, a.args, a.value, a.requestId]), [[0x83, args, null, 1]]);
  assert.equal(result.boundary.nativeId, 0x11);
  assert.deepEqual(allocator.snapshot().workspace, [...args, 15, 16, 17, 18]);
});

test('Actual 252-created 217 performs 83 verbatim writes and D2, then suspends at D9 without revisiting waiting 252', () => {
  const slots = createSlotState({ definitionData: definitions, actionData: data });
  const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  const ac = createACState();ac.seed(38, [0, 0]);
  const state = createScriptState({ byteLength: 0x58, slotState: slots, acState: ac });state.seed(0x56, [0x38, 0x12]);
  const allocator = memory();const scheduler = createScriptScheduler(original, { frameAllocator: allocator });scheduler.addTask(0x252, [0, 0, 0, 0, created.value]);
  const initial = visitTailWithState(scheduler, state);assert.equal(initial.boundary, null);
  const before = slots.snapshot();sweepWithState(scheduler, state);
  assert.throws(() => sweepWithState(scheduler, state, { maxNativeCalls: 5 }), /budget exhausted/);
  const stopped = scheduler.snapshot();assert.equal(stopped.pending.nativeId, 0x83);assert.equal(stopped.pending.requestId, 6);
  assert.deepEqual(slots.snapshot(), before);
  const result = sweepWithState(scheduler, state, { maxNativeCalls: 3 });
  assert.deepEqual(result.actions.map(a => a.nativeId), [0x83, 0xD2]);
  assert.deepEqual(result.actions[0].args, [0x54, 484, 1824, 272]);
  const after = slots.snapshot();keys.forEach((key, i) => assert.equal(after.columns[key][42], [484, 1824, 272][i]));
  assert.equal(after.columns['0F30'][42], before.columns['0F30'][42]);
  for (const key of keys) assert.equal(after.columns[key][43], before.columns[key][43]);
  assert.deepEqual(result.boundary, { nativeId: 0xD9, reason: 'slot_target_data_source_required' });
  assert.equal(result.execution.pending.scriptId, 0x217);assert.equal(result.execution.pending.pc, 50);assert.equal(result.execution.pending.requestId, 8);
  assert.deepEqual(result.execution.pending.args, [0x54, 0]);assert.equal(result.execution.pending.returnBytes, 2);
  assert.equal(result.execution.tasks[0].checks, 0);assert.equal(result.execution.tasks[0].wait.remaining, 20);
  assert.deepEqual(allocator.snapshot().activeOrder, [0, 2]);assert.equal(allocator.snapshot().cursorOffset, 2);
});

test('Complete 18-byte 83 body and four-word/no-return ABI match this European ROM', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  assert.equal(rom.readUInt16LE(0x157B8 + 0x83 * 2), 0xD14A);
  assert.equal(rom[0x15A4C + 0x83], 4);assert.equal(rom[0x15970 + 0x83], 0);
  assert.equal(rom.subarray(0x514A, 0x515C).toString('hex').toUpperCase(), 'A600A5029D280EA5049D800EA5069DD80E60');
});
