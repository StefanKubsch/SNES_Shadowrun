import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotTargetData } from '../proof/state/slot-target-data.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createACState } from '../proof/state/ac-state.mjs';
import { createScriptState, isScriptStateNative } from '../proof/state/script-state.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const original = await load('scripts');
const asset = await load('slot-target-data');
const realData = createSlotTargetData(asset);
const profiles = createTaskFrameProfiles(await load('task-frame-profiles'));
const definitions = createSlotDefinitions(await load('slot-definitions'));
const actionData = createSlotActionData(await load('slot-action-data'));
const request = (offset = 0, index = 0) => ({ nativeId: 0xD9, args: [offset, index], returnBytes: 2 });
const coordinates = ['0E28', '0E80', '0ED8'];
const motion = ['0D20', '0D78', '0DD0'];
const memory = () => createTaskFrameAllocator({ profileData: profiles });
// Explicit synthetic records exercise integration independently of scene data.
const syntheticData = (words, byteOffset = 1) => {
  const bytes = Array(0x10000).fill(0);
  words.forEach((word, index) => { bytes[byteOffset + index * 2] = word & 255; bytes[byteOffset + index * 2 + 1] = word >>> 8; });
  return createSlotTargetData({ ...asset, bytes });
};
const seedCurrent = (slots, offset = 0, words = [0, 0, 0]) => slots.seedSlotFields(offset, Object.fromEntries(coordinates.map((key, i) => [key, words[i]])));
const make = (data = syntheticData([4, 0, 8]), pointer = 0x998000) => {
  const slots = createSlotState({ targetData: data });slots.seedTargetPointer(pointer);seedCurrent(slots);return slots;
};
const code = (offset = 0, index = 0) => [0x14, index & 255, index >>> 8, 0x14, offset & 255, offset >>> 8, 0x58, 0xD9, 0x58, 0x11, 0x56];
const bundle = bytecode => ({ ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode } : s) });

test('D9 writes only three motion columns and shared scratch, at all 44 offsets without occupancy or old-motion guards', () => {
  const data = syntheticData([4, 0, 8]);
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const slots = createSlotState({ targetData: data });slots.seedTargetPointer(0x998000);seedCurrent(slots, offset);
    const expected = slots.snapshot();motion.forEach((key, i) => { expected.columns[key][offset / 2] = [5, 0, 11][i]; });
    expected.targetSource.scratchWords = { A2: 16, A5: 0, A8: 0, AB: 0, AE: 0, B1: 1, B4: 16, B7: 0, BA: 32 };
    assert.deepEqual(slots.applyNative(request(offset)), { handled: true, value: 3, workspaceWords: [3, 0, 1] });
    assert.deepEqual(slots.snapshot(), expected);
  }
});

test('D9 missing provider, pointer or any current coordinate has no partial effects', () => {
  const bare = createSlotState();const before = bare.snapshot();
  assert.deepEqual(bare.applyNative(request()), { handled: false, reason: 'slot_target_data_source_required' });assert.deepEqual(bare.snapshot(), before);
  const slots = createSlotState({ targetData: realData });const unknown = slots.snapshot();
  assert.deepEqual(slots.applyNative(request()), { handled: false, reason: 'slot_target_pointer_source_required' });assert.deepEqual(slots.snapshot(), unknown);
  slots.seedTargetPointer(0x99811A);
  for (let mask = 0; mask < 7; mask++) {
    const partial = createSlotState({ targetData: realData });partial.seedTargetPointer(0x99811A);
    partial.seedSlotFields(0, Object.fromEntries(coordinates.filter((_, i) => mask & 1 << i).map(key => [key, 0])));
    const snapshot = partial.snapshot();assert.equal(partial.applyNative(request()).reason, 'slot_source_required');assert.deepEqual(partial.snapshot(), snapshot);
  }
});

test('D9 requires all six source bytes before committing and does not alias bank holes or wrap the long pointer', () => {
  for (const pointer of [0x997FFE, 0x99FFFA, 0x99FFFF, 0x9AFFFA, 0x9AFFFF, 0x9B8000]) {
    const slots = make(realData, pointer);const before = slots.snapshot();
    assert.deepEqual(slots.applyNative(request()), { handled: false, reason: 'slot_target_data_window_required' });assert.deepEqual(slots.snapshot(), before);
  }
});

test('D9 honors SBC borrow in word-index addressing and reads supported records without a guessed header count', () => {
  for (const [index, offset] of [[0x2000, 0x4000], [0xFFFF, 0x7FFA]]) {
    const slots = make(syntheticData([4, 0, 8], offset), 0x990000);
    assert.deepEqual(slots.applyNative(request(0, index)), { handled: true, value: 3, workspaceWords: [3, index, 1] });
    assert.deepEqual(motion.map(key => slots.snapshot().columns[key][0]), [5, 0, 11]);
  }
  const slots = make(realData, 0x99811A);seedCurrent(slots, 0, [484, 1824, 272]);
  assert.equal(realData.readWord(0x99811A).value & 255, 0); // D9 does not read/guard this header.
  assert.deepEqual(slots.applyNative(request()), { handled: true, value: 2912, workspaceWords: [2912, 0, 1] });
  assert.deepEqual(motion.map(key => slots.snapshot().columns[key][0]), [0xFF66, 0xFEB8, 0x05AE]);
});

test('Shared F3 and scratch are current global game fields, independent of slots and copied in snapshots', () => {
  const slots = make();seedCurrent(slots, 2, [1, 0, 0]);slots.applyNative(request());
  const first = slots.snapshot();first.targetSource.pointerF3 = 0;first.targetSource.scratchWords.A2 = 999;
  assert.equal(slots.snapshot().targetSource.pointerF3, 0x998000);assert.equal(slots.snapshot().targetSource.scratchWords.A2, 16);
  slots.seedTargetPointer(0x998010); // Synthetic record at this address is zero.
  slots.applyNative(request(2));const second = slots.snapshot();
  assert.equal(second.targetSource.scratchWords.A2, 1);assert.equal(second.targetSource.scratchWords.A8, 0xFFFF);
  assert.deepEqual(motion.map(key => second.columns[key][0]), [5, 0, 11]);assert.deepEqual(motion.map(key => second.columns[key][1]), [0xFFFF, 0, 0]);
});

test('D9 validates brands, dense ABI, slot window and explicit pointer before any effects', () => {
  assert.throws(() => createSlotState({ targetData: { readWord: realData.readWord } }), /Invalid slot target source/);
  const slots = make();const before = slots.snapshot();
  for (const args of [[], [0], [0, 0, 0], new Array(2), [undefined, 0], [0, -1], [65536, 0]]) assert.throws(() => slots.applyNative({ ...request(), args }), /ABI mismatch/);
  for (const returnBytes of [undefined, 0, 1]) assert.throws(() => slots.applyNative({ ...request(), returnBytes }), /ABI mismatch/);
  for (const offset of [1, 0x57, 0x58, 0xFFFF]) assert.equal(slots.applyNative(request(offset)).reason, 'slot_window_required');
  for (const pointer of [-1, 0x1000000, undefined, null, 1.5]) assert.throws(() => slots.seedTargetPointer(pointer), /Invalid slot target pointer/);
  assert.deepEqual(slots.snapshot(), before);
  assert.equal(isScriptStateNative(createScriptState({ byteLength: 2 }), 0xD9), false);
  assert.equal(isScriptStateNative(createScriptState({ byteLength: 2, slotState: slots }), 0xD9), true);
});

test('D9 completion rejects forged three-word prefixes and indexed writes without allocator/scheduler mutation', () => {
  const allocator = memory();const scheduler = createScriptScheduler(bundle(code(0, 7)), { frameAllocator: allocator });scheduler.addTask(2);
  allocator.writeWorkspaceWords([11, 12, 13, 14, 15, 16, 17, 18]);const first = scheduler.visitTail();const before = allocator.snapshot();
  for (const [value, workspaceWords] of [[0, [0, 7, 1]], [0x1000, [0x1000, 7, 1]], [3, [3, 6, 1]], [3, [3, 7, 0]], [3, [3, 7]], [3, [3, 7, 1, 0]], [3, new Array(3)]]) {
    assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, value, { workspaceWords }), /D9 completion workspace/);
    assert.deepEqual(scheduler.snapshot(), first);assert.deepEqual(allocator.snapshot(), before);
  }
  assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, 3, { workspaceWords: [3, 7, 1], workspaceWrites: [{ index: 4, value: 1 }, { index: 5, value: 0x8C }] }), /workspace writes/);
  assert.deepEqual(allocator.snapshot(), before);
  scheduler.completeNative(first.pending.taskId, first.pending.requestId, 3, { workspaceWords: [3, 7, 1] });
  assert.deepEqual(allocator.snapshot().workspace, [3, 7, 1, 14, 15, 16, 17, 18]);
});

test('D9 respects action budgets and preserves workspace words 3-7 in actual host completion', () => {
  const allocator = memory();const scheduler = createScriptScheduler(bundle([...code().slice(0, 8), 0xC0, ...code()]), { frameAllocator: allocator });scheduler.addTask(2);
  allocator.writeWorkspaceWords([11, 12, 13, 14, 15, 16, 17, 18]);const slots = make();const state = createScriptState({ byteLength: 2, slotState: slots });
  const before = slots.snapshot();assert.throws(() => visitTailWithState(scheduler, state, { maxNativeCalls: 0 }), /Invalid native action budget/);assert.deepEqual(slots.snapshot(), before);
  assert.throws(() => visitTailWithState(scheduler, state, { maxNativeCalls: 1 }), /budget exhausted/);
  const stopped = scheduler.snapshot();assert.equal(stopped.pending.nativeId, 0xD9);assert.equal(stopped.pending.requestId, 2);
  const result = visitTailWithState(scheduler, state, { maxNativeCalls: 1 });assert.equal(result.actions.length, 1);assert.equal(result.actions[0].requestId, 2);assert.equal(result.boundary.nativeId, 0x11);
  assert.deepEqual(allocator.snapshot().workspace, [3, 0, 1, 14, 15, 16, 17, 18]);
});

test('Original 252/217 retains missing-F3 D9 request, then resumes into its real wait using an explicit 9D data probe', () => {
  const slots = createSlotState({ definitionData: definitions, actionData, targetData: realData });
  const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  const ac = createACState();ac.seed(38, [0, 0]);const state = createScriptState({ byteLength: 0x58, slotState: slots, acState: ac });state.seed(0x56, [0x38, 0x12]);
  const allocator = memory();const scheduler = createScriptScheduler(original, { frameAllocator: allocator });scheduler.addTask(0x252, [0, 0, 0, 0, created.value]);
  visitTailWithState(scheduler, state);sweepWithState(scheduler, state);const blocked = sweepWithState(scheduler, state);
  assert.deepEqual(blocked.boundary, { nativeId: 0xD9, reason: 'slot_target_pointer_source_required' });
  assert.deepEqual([blocked.execution.pending.pc, blocked.execution.pending.requestId, blocked.execution.pending.args], [50, 8, [0x54, 0]]);
  const before = slots.snapshot();const frames = allocator.snapshot();const repeated = sweepWithState(scheduler, state);
  assert.deepEqual(repeated.execution, blocked.execution);assert.deepEqual(slots.snapshot(), before);assert.deepEqual(allocator.snapshot(), frames);
  assert.equal(repeated.execution.tasks[0].checks, 0);assert.equal(repeated.execution.tasks[0].wait.remaining, 20);
  const target = realData.deriveF3From9D(0x99807E);assert.equal(target.pointer, 0x99811A);slots.seedTargetPointer(target.pointer);
  const resumed = sweepWithState(scheduler, state, { maxNativeCalls: 1 });assert.equal(resumed.boundary, null);assert.equal(resumed.execution.pending, null);
  assert.deepEqual(resumed.actions.map(a => [a.nativeId, a.requestId, a.value]), [[0xD9, 8, 2912]]);
  const [parent, spawned] = resumed.execution.tasks;
  assert.equal(parent.checks, 1);assert.equal(parent.wait.remaining, 19); // Remaining reverse pass now visits parent once.
  assert.equal(spawned.steps, 34);assert.equal(spawned.checks, 0);assert.deepEqual([spawned.wait.pc, spawned.wait.mask, spawned.wait.remaining], [54, 1, 2912]);assert.equal(spawned.frames[0].pc, 56);
  assert.deepEqual(allocator.snapshot().activeOrder, [0, 2]);
  assert.deepEqual(motion.map(key => slots.snapshot().columns[key][42]), [0xFF66, 0xFEB8, 0x05AE]);
});
