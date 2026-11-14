import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createACState } from '../proof/state/ac-state.mjs';
import { createScriptState, isScriptStateNative } from '../proof/state/script-state.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { runTaskWithState, visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const profiles = createTaskFrameProfiles(JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8')));
const definitions = createSlotDefinitions(JSON.parse(await readFile(new URL('../assets/slot-definitions.json', import.meta.url), 'utf8')));
const data = createSlotActionData(JSON.parse(await readFile(new URL('../assets/slot-action-data.json', import.meta.url), 'utf8')));
const fields = [[0x4F, '0E28'], [0x50, '0E80'], [0x51, '0ED8']];
const request = (nativeId, offset = 0) => ({ nativeId, args: [offset], returnBytes: 2 });
const memory = () => createTaskFrameAllocator({ profileData: profiles });
const call = id => [0x14, 0, 0, 0x58, id];
const bundle = code => ({ ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: code } : s) });

test('All 65536 field words for each original getter return logical word/4 without sign extension', () => {
  const slots = createSlotState();
  for (const [id, key] of fields) {
    for (let value = 0; value <= 0xFFFF; value++) {
      slots.seedSlotFields(0, { [key]: value });
      assert.deepEqual(slots.applyNative(request(id)), { handled: true, value: Math.floor(value / 4), workspaceWords: [Math.floor(value / 4)] });
    }
  }
});

test('All 44 offsets require only their one field and preserve every slot, list and pool byte', () => {
  for (const [id, key] of fields) for (let offset = 0; offset <= 0x56; offset += 2) {
    const slots = createSlotState();slots.seedSlotFields(offset, { [key]: 0xFFFC });
    const before = slots.snapshot();
    assert.deepEqual(slots.applyNative(request(id, offset)), { handled: true, value: 0x3FFF, workspaceWords: [0x3FFF] });
    assert.deepEqual(slots.snapshot(), before);
  }
});

test('Actual A9 scaled-word writes preserve wrapping: all three getters return original arguments modulo 4000', () => {
  for (const values of [[123, 456, 64], [0xFFFF, 0x8000, 0x4001], [0x8001, 0x7FFF, 0xBEEF], [0, 0, 0]]) {
    const slots = createSlotState({ definitionData: definitions });
    const created = slots.applyNative({ nativeId: 0xA9, args: [11, ...values, 0xFFFF], returnBytes: 2 });
    for (let i = 0; i < 3; i++) assert.equal(slots.applyNative(request(fields[i][0], created.value)).value, values[i] % 0x4000);
  }
});

test('Unknown fields, bad offsets and sparse or wrong ABI retain all data, with support limited to supplied slot states', () => {
  const slots = createSlotState();const before = slots.snapshot();
  for (const [id] of fields) {
    assert.equal(slots.applyNative(request(id)).reason, 'slot_source_required');
    for (const offset of [1, 0x57, 0x58, 0xFFFF]) assert.equal(slots.applyNative(request(id, offset)).reason, 'slot_window_required');
    for (const args of [[], [0, 0], new Array(1), [-1], [65536]]) assert.throws(() => slots.applyNative({ ...request(id), args }), /ABI mismatch/);
    for (const returnBytes of [undefined, 0, 1]) assert.throws(() => slots.applyNative({ ...request(id), returnBytes }), /ABI mismatch/);
    assert.equal(isScriptStateNative(createScriptState({ byteLength: 2 }), id), false);
    assert.equal(isScriptStateNative(createScriptState({ byteLength: 2, slotState: slots }), id), true);
  }
  assert.deepEqual(slots.snapshot(), before);
});

test('All getter completions change only workspace word 0 and reject oversized returns or malformed prefixes before writes', () => {
  for (const [id, key] of fields) {
    const allocator = memory();const scheduler = createScriptScheduler(bundle([...call(id), 0x58, 0x11, 0x56]), { frameAllocator: allocator });
    scheduler.addTask(2);allocator.writeWorkspaceWords([1, 2, 3, 4, 5, 6, 7, 8]);
    const first = scheduler.visitTail();const before = allocator.snapshot();
    for (const [value, workspaceWords] of [[0x4000, [0x4000]], [0xFFFF, [0xFFFF]], [1, [2]], [1, new Array(1)], [1, [1, 2]]]) {
      assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, value, { workspaceWords }), /return value|workspace/);
      assert.deepEqual(scheduler.snapshot(), first);assert.deepEqual(allocator.snapshot(), before);
    }
    const slots = createSlotState();slots.seedSlotFields(0, { [key]: 0x8003 });
    const result = visitTailWithState(scheduler, createScriptState({ byteLength: 2, slotState: slots }));
    assert.equal(result.actions[0].value, 0x2000);assert.equal(result.boundary.nativeId, 0x11);
    assert.deepEqual(allocator.snapshot().workspace, [0x2000, 2, 3, 4, 5, 6, 7, 8]);
  }
});

test('Getter action budgets retain the second pending read and resume exactly that request', () => {
  const allocator = memory();const slots = createSlotState();slots.seedSlotFields(0, { '0E28': 4, '0E80': 8 });
  const state = createScriptState({ byteLength: 2, slotState: slots });
  const task = createScriptTask(bundle([...call(0x4F), 0xC0, ...call(0x50), 0x58, 0x11, 0x56]), 2, [], { frameAllocator: allocator });
  const before = slots.snapshot();
  assert.throws(() => runTaskWithState(task, state, { maxNativeCalls: 1 }), /budget exhausted/);
  assert.equal(task.snapshot().pending.nativeId, 0x50);assert.equal(task.snapshot().pending.requestId, 2);
  assert.deepEqual(slots.snapshot(), before);
  const result = runTaskWithState(task, state, { maxNativeCalls: 1 });
  assert.equal(result.actions[0].requestId, 2);assert.equal(result.actions[0].value, 2);
  assert.equal(result.boundary.nativeId, 0x11);assert.deepEqual(slots.snapshot(), before);
});

test('Original 252 creates 217; its real getter sequence uses child and parent fields then suspends at native 83', () => {
  const slots = createSlotState({ definitionData: definitions, actionData: data });
  const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  const ac = createACState();ac.seed(38, [0, 0]);
  const state = createScriptState({ byteLength: 0x58, slotState: slots, acState: ac });state.seed(0x56, [0x38, 0x12]);
  const allocator = memory();const scheduler = createScriptScheduler(original, { frameAllocator: allocator });scheduler.addTask(0x252, [0, 0, 0, 0, created.value]);
  const first = visitTailWithState(scheduler, state);assert.equal(first.boundary, null);assert.equal(first.execution.tasks[1].steps, 0);
  sweepWithState(scheduler, state);
  // Pin the five getter cutpoints independently of later native support.
  let execution = scheduler.sweep();const actions = [];
  for (let i = 0; i < 5; i++) {
    const pending = execution.pending;const response = state.applyNative(pending);
    actions.push({ ...pending, value: response.value });
    execution = scheduler.completeNative(pending.taskId, pending.requestId, response.value, { workspaceWords: response.workspaceWords });
  }
  const result = { actions, execution };
  assert.deepEqual(result.actions.map(a => [a.nativeId, a.args[0], a.value, a.requestId]), [[0x4F, 0x54, 86, 1], [0x50, 0x54, 0, 2], [0x51, 0x56, 64, 3], [0x50, 0x56, 456, 4], [0x4F, 0x56, 123, 5]]);
  assert.equal(result.execution.pending.nativeId, 0x83);
  assert.equal(result.execution.pending.scriptId, 0x217);assert.equal(result.execution.pending.pc, 40);assert.equal(result.execution.pending.requestId, 6);
  assert.deepEqual(result.execution.pending.args, [0x54, 484, 1824, 272]);assert.equal(result.execution.pending.returnBytes, 0);
  assert.equal(result.execution.tasks[0].checks, 0);assert.equal(result.execution.tasks[0].wait.remaining, 20);
  assert.deepEqual(allocator.snapshot().activeOrder, [0, 2]);assert.equal(allocator.snapshot().cursorOffset, 2);
});

test('All thirty getter bytes and native ABI entries match this European original', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const expected = ['A600BD280E4A4A850060', 'A600BD800E4A4A850060', 'A600BDD80E4A4A850060'];
  for (let i = 0; i < 3; i++) {
    const id = fields[i][0];const address = 0xA959 + i * 10;
    assert.equal(rom.readUInt16LE(0x157B8 + id * 2), address);assert.equal(rom[0x15A4C + id], 1);assert.equal(rom[0x15970 + id], 2);
    assert.equal(rom.subarray(address - 0x8000, address - 0x8000 + 10).toString('hex').toUpperCase(), expected[i]);
  }
});
