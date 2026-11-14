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

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const profiles = createTaskFrameProfiles(JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8')));
const request = (offset = 0, mask = 0x80) => ({ nativeId: 0xCF, args: [offset, mask], returnBytes: 0 });
const memory = () => createTaskFrameAllocator({ profileData: profiles });
const word = value => [0x14, value & 255, value >>> 8];
const call = mask => [...word(mask), ...word(0), 0x58, 0xCF];
const bundle = (code, second = null) => ({ ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: code } : s.id === 0x20 && second ? { ...s, bytecode: second } : s) });

test('Every word value and every mask retain unsigned OR semantics including bit 15, zero and FFFF', () => {
  const slots = createSlotState();
  for (const mask of [0, 1, 0x80, 0x8000, 0xFFFF]) {
    for (let value = 0; value <= 0xFFFF; value++) {
      slots.seedSlotFields(0, { '1458': value });
      assert.equal(slots.applyNative(request(0, mask)).handled, true);
      assert.equal(slots.snapshot().columns['1458'][0], value | mask);
    }
  }
  for (let mask = 0; mask <= 0xFFFF; mask++) {
    slots.seedSlotFields(0, { '1458': 0xA368 });
    slots.applyNative(request(0, mask));
    assert.equal(slots.snapshot().columns['1458'][0], mask | 0xA368);
  }
});

test('All 44 offsets modify only 1458 without requiring definition, membership, counters or other fields', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const slots = createSlotState();
    slots.seedSlotFields(offset, { '1458': 0xA368 });
    const expected = slots.snapshot();
    expected.columns['1458'][offset / 2] = 0xA3E8;
    assert.deepEqual(slots.applyNative(request(offset)), { handled: true, value: null, workspaceWords: [offset, 0x80] });
    assert.deepEqual(slots.snapshot(), expected);
  }
});

test('CF validates unknown fields, invalid offsets and sparse ABI before writes and resumes after explicit field hydration', () => {
  const slots = createSlotState();
  const before = slots.snapshot();
  for (const args of [[], [0], [0, 0, 0], new Array(2), [0, -1], [0, 65536]]) assert.throws(() => slots.applyNative({ ...request(), args }), /ABI mismatch/);
  for (const returnBytes of [undefined, 2, 1]) assert.throws(() => slots.applyNative({ ...request(), returnBytes }), /ABI mismatch/);
  for (const offset of [1, 0x57, 0x58, 0xFFFF]) assert.equal(slots.applyNative(request(offset)).reason, 'slot_window_required');
  assert.equal(slots.applyNative(request()).reason, 'slot_source_required');
  assert.deepEqual(slots.snapshot(), before);
  const scheduler = createScriptScheduler(bundle([...call(0x80), 0x56]), { frameAllocator: memory() });
  scheduler.addTask(2);
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const first = visitTailWithState(scheduler, state);
  assert.equal(first.execution.pending.requestId, 1);
  slots.seedSlotFields(0, { '1458': 1 });
  const resumed = visitTailWithState(scheduler, state);
  assert.equal(resumed.execution.status, 'idle');
  assert.equal(resumed.actions[0].requestId, 1);
  assert.equal(slots.snapshot().columns['1458'][0], 0x81);
});

test('CF retains all six higher scratch words and rejects changed, sparse, helper-shaped or byte-write responses', () => {
  const allocator = memory();
  const scheduler = createScriptScheduler(bundle([...call(0x80), 0x58, 0x11, 0x56]), { frameAllocator: allocator });
  scheduler.addTask(2);
  allocator.writeWorkspaceWords([1, 2, 3, 4, 5, 6, 7, 8]);
  const first = scheduler.visitTail();
  const before = allocator.snapshot();
  for (const workspaceWords of [new Array(2), [0, 0x81], [0, 0x80, 3], [0, 0x8C, 2, 0x8C, 3, 0x8C]]) {
    assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords }), /workspace/);
    assert.deepEqual(scheduler.snapshot(), first);
    assert.deepEqual(allocator.snapshot(), before);
  }
  assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords: [0, 0x80], workspaceWrites: [{ index: 4, value: 0x8000 }, { index: 5, value: 0x8C }] }), /workspace/);
  const slots = createSlotState();slots.seedSlotFields(0, { '1458': 0 });
    const result = visitTailWithState(scheduler, createScriptState({ byteLength: 0x32, slotState: slots }));
  assert.equal(result.boundary.nativeId, 0x11);
  assert.deepEqual(allocator.snapshot().workspace, [0, 0x80, 3, 4, 5, 6, 7, 8]);
});

test('A second CF is stopped before effects by the native budget and continues on the same pending frame once', () => {
  const slots = createSlotState();slots.seedSlotFields(0, { '1458': 1 });
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const task = createScriptTask(bundle([...call(0x80), ...call(0x8000), 0x56]), 2, [], { frameAllocator: memory() });
  assert.throws(() => runTaskWithState(task, state, { maxNativeCalls: 1 }), /budget exhausted/);
  assert.equal(slots.snapshot().columns['1458'][0], 0x81);
  assert.equal(task.snapshot().pending.requestId, 2);
  const result = runTaskWithState(task, state, { maxNativeCalls: 1 });
  assert.equal(result.execution.status, 'ended');
  assert.equal(result.actions[0].requestId, 2);
  assert.equal(slots.snapshot().columns['1458'][0], 0x8081);
});

test('Shared CF effects use newest-first task order without repeating a spectator wait', () => {
  const allocator = memory();
  const scheduler = createScriptScheduler(bundle([...call(0x80), 0x56], [...call(0x8000), 0x56]), { frameAllocator: allocator });
  const slots = createSlotState();slots.seedSlotFields(0, { '1458': 0 });
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const spectator = scheduler.addTask(0x04B);visitTailWithState(scheduler, state);
  const older = scheduler.addTask(2);const newer = scheduler.addTask(0x20);
  sweepWithState(scheduler, state);
  const result = sweepWithState(scheduler, state);
  assert.deepEqual(result.actions.map(a => [a.taskId, a.nativeId]), [[newer, 0xCF], [older, 0xCF]]);
  assert.equal(result.execution.tasks[0].taskId, spectator);
  assert.equal(result.execution.tasks[0].checks, 1);
  assert.equal(slots.snapshot().columns['1458'][0], 0x8080);
});

test('Unmodified original 105 runs D2 then CF from real A9 source fields and stops at native 02', async () => {
  const data = createSlotActionData(JSON.parse(await readFile(new URL('../assets/slot-action-data.json', import.meta.url), 'utf8')));
  const definitions = createSlotDefinitions(JSON.parse(await readFile(new URL('../assets/slot-definitions.json', import.meta.url), 'utf8')));
  const slots = createSlotState({ actionData: data, definitionData: definitions });
  const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  const scheduler = createScriptScheduler(original, { frameAllocator: memory() });
  scheduler.addTask(0x105, [created.value]);
  // Pin the next instruction after CF without automatically driving 02.
  const first = scheduler.visitTail();
  const d2 = slots.applyNative(first.pending);
  const second = scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords: d2.workspaceWords });
  assert.equal(second.pending.nativeId, 0xCF);
  const cf = slots.applyNative(second.pending);
  const result = scheduler.completeNative(second.pending.taskId, second.pending.requestId, null, { workspaceWords: cf.workspaceWords });
  assert.equal(result.pending.nativeId, 2);
  assert.equal(result.pending.pc, 157);
  assert.equal(result.pending.requestId, 3);
  assert.deepEqual(result.pending.args, [0x56]);
  assert.equal(result.pending.returnBytes, 2);
  assert.equal(slots.snapshot().columns['1458'][43], 0xA3E8);
});

test('CF complete original source/ABI is pinned; hardware 63 and separate-state AC stay explicit unsupported actions', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  assert.equal(rom.readUInt16LE(0x157B8 + 0xCF * 2), 0xCA15);
  assert.equal(rom[0x15A4C + 0xCF], 2);
  assert.equal(rom[0x15970 + 0xCF], 0);
  assert.equal(rom.subarray(0x4A15, 0x4A20).toString('hex').toUpperCase(), 'A600A5021D58149D581460');
  const slots = createSlotState();const state = createScriptState({ byteLength: 0x32, slotState: slots });
  assert.equal(isScriptStateNative(state, 0xCF), true);
  assert.equal(isScriptStateNative(createScriptState({ byteLength: 0x32 }), 0xCF), false);
  const before = state.snapshot();
  for (const nativeId of [0xAC, 0x63]) {
    assert.equal(isScriptStateNative(state, nativeId), false);
    assert.equal(state.applyNative({ nativeId, args: nativeId === 0xAC ? [0] : [], returnBytes: nativeId === 0x63 ? 2 : 0 }).reason, 'native_implementation_required');
    assert.deepEqual(state.snapshot(), before);
  }
});
