import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createScriptState, isScriptStateNative } from '../proof/state/script-state.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { runTaskWithState, visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const profiles = createTaskFrameProfiles(JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8')));
const definitions = createSlotDefinitions(JSON.parse(await readFile(new URL('../assets/slot-definitions.json', import.meta.url), 'utf8')));
const request = (offset = 0, value = 5) => ({ nativeId: 0x6A, args: [offset, value], returnBytes: 0 });
const field = (state, key, offset = 0) => state.snapshot().columns[key][offset / 2];
const allocator = () => createTaskFrameAllocator({ profileData: profiles });
const word = value => [0x14, value & 255, value >>> 8];
const call = value => [...word(value), ...word(0), 0x58, 0x6A];
const fixture = code => ({ ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: code } : s) });

test('All 65536 equal words return without requiring branch/selection/occupancy data or writing any slot field', () => {
  const slots = createSlotState();
  for (let value = 0; value <= 0xFFFF; value++) {
    slots.seedSlotFields(0, { '1198': value });
    assert.deepEqual(slots.applyNative(request(0, value)), { handled: true, value: null, workspaceWords: [0, value] });
  }
  const after = slots.snapshot();
  assert.deepEqual(after.definitions, Array(44).fill(0xFFFF));
  assert.deepEqual(after.counts, Array(44).fill(null));
  assert.deepEqual(after.heads, Array(44).fill(null));
  assert.ok(Object.entries(after.columns).every(([key, values]) => key === '1198' ? values[0] === 0xFFFF && values.slice(1).every(v => v === null) : values.every(v => v === null)));
});

test('Every branch word preserves unsigned 0001..007F byte-path boundaries and zero/0080..FFFF return behavior', () => {
  const slots = createSlotState();
  for (let value = 0; value <= 0xFFFF; value++) {
    slots.seedSlotFields(0, { '1198': 2, '10E8': value, '1038': 0xFFFF });
    const result = slots.applyNative(request());
    if (value > 0 && value < 0x80) {
      assert.deepEqual(result, { handled: false, reason: 'slot_action_data_source_required' });
      assert.equal(field(slots, '1198'), 2);
    } else {
      assert.deepEqual(result, { handled: true, value: null, workspaceWords: [0, 5] });
    }
  }
  assert.equal(field(slots, '1198'), 5);
  assert.equal(field(slots, '1038'), 0xFFFF);
});

test('All 44 offsets change only 1198 on the complete non-helper return path and retain counts, membership and neighboring data', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const slots = createSlotState();
    slots.seedSlotFields(offset, { '1198': 1, '10E8': 0x8000, '1038': 0xFFFF });
    const before = slots.snapshot();
    const expected = structuredClone(before);
    expected.columns['1198'][offset / 2] = 0xBEEF;
    assert.deepEqual(slots.applyNative(request(offset, 0xBEEF)), { handled: true, value: null, workspaceWords: [offset, 0xBEEF] });
    assert.deepEqual(slots.snapshot(), expected);
  }
});

test('Unknown fields and missing helper/byte data retain all data without simulating a source rollback', () => {
  const cases = [
    [{}, 'slot_source_required'],
    [{ '1198': 0 }, 'slot_source_required'],
    [{ '1198': 0, '10E8': 0 }, 'slot_source_required'],
    [{ '1198': 0, '10E8': 0x80, '1038': 0 }, 'slot_action_data_source_required'],
    [{ '1198': 0, '10E8': 0, '1038': 0xFFFE }, 'slot_action_data_source_required'],
    [{ '1198': 0, '10E8': 1 }, 'slot_action_data_source_required'],
    [{ '1198': 0, '10E8': 0x7F, '1038': 0xFFFF }, 'slot_action_data_source_required'],
  ];
  for (const [fields, reason] of cases) {
    const slots = createSlotState();
    slots.seedSlotFields(0, fields);
    const before = slots.snapshot();
    assert.deepEqual(slots.applyNative(request()), { handled: false, reason });
    assert.deepEqual(slots.snapshot(), before);
  }
});

test('ABI, offset and field-hydration validation precede every mutation, including sparse arrays and a late invalid field', () => {
  const slots = createSlotState();
  const before = slots.snapshot();
  for (const args of [[], [0], [0, 5, 1], [0, -1], [0, 65536], new Array(2)]) assert.throws(() => slots.applyNative({ ...request(), args }), /ABI mismatch/);
  for (const returnBytes of [undefined, 2, 1]) assert.throws(() => slots.applyNative({ ...request(), returnBytes }), /ABI mismatch/);
  for (const offset of [1, 0x57, 0x58, 0x8000, 0xFFFF]) assert.equal(slots.applyNative(request(offset)).reason, 'slot_window_required');
  for (const fields of [null, [], { '1198': 5, '10E8': -1 }, { '1198': 5, unknown: 1 }, { '10E8': 65536 }]) assert.throws(() => slots.seedSlotFields(0, fields), /field seed/);
  assert.throws(() => slots.seedSlotFields(1, { '1198': 5 }), /field seed/);
  assert.deepEqual(slots.snapshot(), before);
  const supplied = { '1198': 5 };
  slots.seedSlotFields(0, supplied);
  supplied['1198'] = 0;
  assert.equal(field(slots, '1198'), 5);
  assert.equal(slots.applyNative({ nativeId: 0xD2, args: [0, 0, 0], returnBytes: 0 }).reason, 'slot_source_required');
});

test('A9 initializes 1198/1038 but retains unknown 10E8; 6A equality works on actual creation without extra fixtures', () => {
  const slots = createSlotState({ definitionData: definitions });
  const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  assert.equal(created.value, 0x56);
  const before = slots.snapshot();
  assert.equal(field(slots, '10E8', 0x56), null);
  assert.equal(slots.applyNative(request(0x56, 0)).handled, true);
  assert.equal(slots.applyNative(request(0x56, 1)).reason, 'slot_source_required');
  assert.deepEqual(slots.snapshot(), before);
});

test('An actual original $318 suspends on missing 1198 and resumes the identical request after minimal explicit field hydration', () => {
  const slots = createSlotState();
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const memory = allocator();
  const scheduler = createScriptScheduler(original, { frameAllocator: memory });
  scheduler.addTask(0x318, [0]); // Explicitly synthetic root argument.
  const first = visitTailWithState(scheduler, state);
  assert.deepEqual(first.boundary, { nativeId: 0x6A, reason: 'slot_source_required' });
  assert.equal(first.execution.pending.pc, 75);
  assert.equal(first.execution.pending.requestId, 1);
  assert.equal(isScriptStateNative(state, 0x6A), true);
  slots.seedSlotFields(0, { '1198': 5 }); // Synthetic field source, not a scene initializer.
  const result = visitTailWithState(scheduler, state);
  assert.deepEqual(result.actions.map(a => [a.nativeId, a.requestId]), [[0x6A, 1]]);
  assert.equal(result.execution.pending.requestId, 2);
  assert.equal(result.boundary.nativeId, 0x63);
  assert.equal(result.boundary.reason, 'native_implementation_required');
  assert.deepEqual(slots.snapshot().definitions, Array(44).fill(0xFFFF));
  assert.deepEqual(slots.snapshot().counts, Array(44).fill(null));
  assert.deepEqual(memory.snapshot().activeOrder, [0]);
});

test('Handled 6A preserves all known workspace words and invalid host workspace replies leave the suspended scheduler unchanged', () => {
  const memory = allocator();
  const scheduler = createScriptScheduler(fixture([...call(5), 0x58, 0x11, 0x56]), { frameAllocator: memory });
  scheduler.addTask(2);
  memory.writeWorkspaceWords([1, 2, 3, 4, 5, 6, 7, 8]);
  const slots = createSlotState();
  slots.seedSlotFields(0, { '1198': 5 });
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const first = scheduler.visitTail();
  for (const workspaceWords of [new Array(2), [0, 6], [0, 5, 3]]) {
    assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords }), /workspace/);
    assert.deepEqual(scheduler.snapshot(), first);
  }
  const result = visitTailWithState(scheduler, state);
  assert.equal(result.boundary.nativeId, 0x11);
  assert.deepEqual(memory.snapshot().workspace, [0, 5, 3, 4, 5, 6, 7, 8]);
  const pending = result.execution.pending;
  const before = scheduler.snapshot();
  assert.throws(() => scheduler.completeNative(pending.taskId, pending.requestId, null, { workspaceWords: [0, 5] }), /workspace/);
  assert.deepEqual(scheduler.snapshot(), before);
});

test('Native action budget stops before a second 6A write and resumes that pending request once', () => {
  const task = createScriptTask(fixture([...call(5), ...call(6), 0x56]), 2, [], { frameAllocator: allocator() });
  const slots = createSlotState();
  slots.seedSlotFields(0, { '1198': 0, '10E8': 0, '1038': 0xFFFF });
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  assert.throws(() => runTaskWithState(task, state, { maxNativeCalls: 1 }), /Native action budget exhausted/);
  assert.equal(task.snapshot().pending.requestId, 2);
  assert.equal(field(slots, '1198'), 5);
  const result = runTaskWithState(task, state, { maxNativeCalls: 1 });
  assert.equal(result.execution.status, 'ended');
  assert.equal(result.actions[0].requestId, 2);
  assert.equal(field(slots, '1198'), 6);
});

test('Shared 6A updates keep newest-first ordering and do not repeat another root waiter check', () => {
  const memory = allocator();
  const two = original.scripts.find(s => s.id === 0x20);
  const testBundle = { ...fixture([...call(5), 0x56]), scripts: fixture([...call(5), 0x56]).scripts.map(s => s.id === 0x20 ? { ...two, bytecode: [...call(6), 0x56] } : s) };
  const scheduler = createScriptScheduler(testBundle, { frameAllocator: memory });
  const slots = createSlotState();
  slots.seedSlotFields(0, { '1198': 0, '10E8': 0, '1038': 0xFFFF });
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const spectator = scheduler.addTask(0x04B);
  visitTailWithState(scheduler, state);
  const older = scheduler.addTask(2);
  const newer = scheduler.addTask(0x20);
  sweepWithState(scheduler, state);
  const result = sweepWithState(scheduler, state);
  assert.deepEqual(result.actions.map(a => [a.taskId, a.nativeId, a.args]), [[newer, 0x6A, [0, 6]], [older, 0x6A, [0, 5]]]);
  assert.equal(field(slots, '1198'), 5);
  assert.equal(result.execution.tasks.length, 1);
  assert.equal(result.execution.tasks[0].taskId, spectator);
  assert.equal(result.execution.tasks[0].checks, 1);
});

test('European native 6A ABI, complete entry, both return branches and final RTS match the actual ROM', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  assert.equal(rom.readUInt16LE(0x157B8 + 0x6A * 2), 0xAAAF);
  assert.equal(rom[0x15A4C + 0x6A], 2);
  assert.equal(rom[0x15970 + 0x6A], 0);
  const bytes = 'A600BC9811C402F051A5029D9811BDE810F005C980009018BD3810C9FFFFF03A';
  assert.equal(rom.subarray(0x2AAF, 0x2AAF + bytes.length / 2).toString('hex').toUpperCase(), bytes);
  assert.equal(rom[0x2B09], 0x60);
});
