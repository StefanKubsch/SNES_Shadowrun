import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { createTaskHeap } from '../proof/script/task-heap.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { sweepWithState, visitTailWithState } from '../proof/state/host.mjs';

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const profiles = createTaskFrameProfiles(JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8')));
const definitions = createSlotDefinitions(JSON.parse(await readFile(new URL('../assets/slot-definitions.json', import.meta.url), 'utf8')));
const word = value => [0x14, value & 255, value >>> 8];
const creation = (scriptId, definition = 11) => [scriptId, 64, 456, 123, definition].flatMap(word).concat([0x58, 0xA9]);
// Synthetic control code, using original $002's sourced 12-byte stack profile.
const bundle = (code, other = []) => ({ ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: code } : other.find(x => x.id === s.id) ?? s) });
const setup = (code, { heap, sources = definitions, other = [] } = {}) => {
  const allocator = createTaskFrameAllocator({ profileData: profiles, ...(heap ? { heap } : {}) });
  const slots = createSlotState({ definitionData: sources });
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const scheduler = createScriptScheduler(bundle(code, other), { frameAllocator: allocator });
  return { allocator, slots, state, scheduler };
};

test('A9 spawns an independent original task, passes mutated workspace and stores its original offset without visiting it', () => {
  const { allocator, scheduler, state, slots } = setup([...creation(0x197), 0x58, 0x11, 0x56]);
  const caller = scheduler.addTask(2);
  const result = visitTailWithState(scheduler, state);
  assert.equal(result.boundary.nativeId, 0x11);
  assert.equal(result.actions[0].value, 0x56);
  const created = result.execution.tasks[1];
  assert.equal(created.scriptId, 0x197);
  assert.equal(created.status, 'ready');
  assert.equal(created.steps, 0);
  assert.deepEqual(created.frames[0].stack, [0x56]);
  assert.equal(created.frames[0].memory.taskOffset, 2);
  assert.equal(slots.snapshot().columns['1350'][43], 2);
  assert.deepEqual(allocator.snapshot().activeOrder, [0, 2]);
  assert.equal(allocator.snapshot().cursorOffset, 0);
  assert.equal(result.execution.pending.taskId, caller);
});

test('A9 preserves the rest of a reverse sweep and leaves its new root until the next reset', () => {
  const { scheduler, state, allocator } = setup([...creation(0x197), 0x56]);
  const spectator = scheduler.addTask(0x04B);
  visitTailWithState(scheduler, state);
  const caller = scheduler.addTask(2);
  sweepWithState(scheduler, state);
  const result = sweepWithState(scheduler, state);
  assert.equal(result.actions[0].taskId, caller);
  assert.deepEqual(result.execution.tasks.map(t => [t.scriptId, t.status, t.steps, t.checks]), [[0x04B, 'waiting', 3, 1], [0x197, 'ready', 0, 0]]);
  assert.equal(result.execution.tasks[0].taskId, spectator);
  const createdOffset = result.execution.tasks[1].frames[0].memory.taskOffset;
  assert.equal(result.state.slots.columns['1350'][43], createdOffset);
  assert.notEqual(result.execution.tasks[1].taskId, createdOffset);
  assert.equal(allocator.snapshot().cursorOffset, createdOffset);
  const next = sweepWithState(scheduler, state);
  assert.equal(next.execution.tasks.length, 1);
  assert.equal(next.execution.tasks[0].checks, 2);
  assert.equal(allocator.snapshot().slots[createdOffset / 2].statusWord, 0);
});

test('Original $060 frees the created game slot without deleting the independently spawned script task or stale handle', () => {
  const { scheduler, state, allocator, slots } = setup([...creation(0x197), 0x52, 0x60, 0, 0x56]);
  scheduler.addTask(2);
  const result = visitTailWithState(scheduler, state);
  assert.deepEqual(result.actions.map(action => action.nativeId), [0xA9, 0x12, 0xB9]);
  assert.equal(result.execution.tasks.length, 1);
  assert.equal(result.execution.tasks[0].scriptId, 0x197);
  assert.equal(result.execution.tasks[0].steps, 0);
  assert.equal(slots.snapshot().definitions[43], 0xFFFF);
  assert.equal(slots.snapshot().activeList.lastOffset, 0xFFFE);
  assert.equal(slots.snapshot().columns['1350'][43], 2);
  assert.deepEqual(allocator.snapshot().activeOrder, [2]);
});

test('The full modified ABI prefix initializes a five-argument task in reverse order and retains sourced tail words', () => {
  const { scheduler, state, allocator } = setup([...creation(0x00B), 0x58, 0x11, 0x56]);
  scheduler.addTask(2);
  allocator.writeWorkspaceWords([1, 2, 3, 4, 5, 0xBEEF, 0xCAFE]);
  const result = visitTailWithState(scheduler, state);
  assert.deepEqual(result.execution.tasks[1].frames[0].stack, [0xB, 64, 456, 22, 0x56]);
  // The following unknown native invalidates scratch only on completion.
  assert.deepEqual(allocator.snapshot().workspace.slice(0, 7), [0x56, 22, 456, 64, 0xB, 0xBEEF, 0xCAFE]);
});

test('Negative script words and exhausted game slots preserve their different proven scratch effects without allocation', () => {
  for (const exhausted of [false, true]) {
    const { scheduler, state, allocator, slots } = setup([...creation(exhausted ? 0x197 : 0xFFFF), 0x58, 0x11, 0x56]);
    if (exhausted) for (let offset = 0; offset <= 0x56; offset += 2) slots.seedSlot(offset, { definitionWord: 0, count: 0, head: 0 });
    scheduler.addTask(2);
    const result = visitTailWithState(scheduler, state);
    assert.equal(result.execution.tasks.length, 1);
    assert.deepEqual(allocator.snapshot().workspace.slice(0, 5), exhausted ? [11, 123, 456, 64, 0x197] : [0x56, 22, 456, 64, 0xFFFF]);
    assert.equal(slots.snapshot().columns['1350'][43], null);
    assert.equal(allocator.snapshot().heap.headers.length, 2);
  }
});

test('Missing definitions, script profiles, workspace words and mismatched headers retain the pending request without partial creation', () => {
  const eightArgs = original.scripts.find(s => s.argumentBytes === 16);
  const cases = [
    { sources: null, target: 0x197, reason: 'slot_definition_source_required' },
    { target: 0x7000, reason: 'task_profile_source_required' },
    { target: eightArgs.id, reason: 'task_argument_source_required' },
    { target: 0x197, other: [{ ...original.scripts.find(s => s.id === 0x197), localBytes: 4 }], reason: 'task_frame_profile_mismatch' },
  ];
  for (const { target, reason, ...options } of cases) {
    const { scheduler, state, allocator, slots } = setup([...creation(target), 0x56], options);
    scheduler.addTask(2);
    const beforeSlots = slots.snapshot();
    const result = visitTailWithState(scheduler, state);
    assert.equal(result.boundary.reason, reason);
    assert.equal(result.handledCalls, 0);
    assert.deepEqual(slots.snapshot(), beforeSlots);
    assert.deepEqual(allocator.snapshot().activeOrder, [0]);
    assert.equal(allocator.snapshot().heap.headers.length, 2);
  }
});

test('A9 allocation failure retains earlier game slot/list writes and stops before inventing a task handle', () => {
  const heap = createTaskHeap();
  heap.allocate(0x0799); // Leaves exactly enough to allocate the caller, then no callee.
  const { scheduler, state, allocator, slots } = setup([...creation(0x197), 0x56], { heap });
  scheduler.addTask(2);
  assert.throws(() => visitTailWithState(scheduler, state), /task_heap_failure_continuation_required/);
  assert.equal(scheduler.snapshot().status, 'faulted');
  assert.equal(slots.snapshot().definitions[43], 11);
  assert.equal(slots.snapshot().activeList.entries[0], 0x56);
  assert.equal(slots.snapshot().columns['1350'][43], null);
  assert.deepEqual(allocator.snapshot().workspace.slice(0, 5), [0x56, 22, 456, 64, 0x197]);
  assert.deepEqual(allocator.snapshot().activeOrder, [0]);
});

test('Native budget prevents a second A9 spawn and resumes the same request exactly once', () => {
  const { scheduler, state, slots } = setup([...creation(0x197), 0xBC, ...creation(0x197), 0x56]);
  scheduler.addTask(2);
  assert.throws(() => visitTailWithState(scheduler, state, { maxNativeCalls: 1 }), /Native action budget exhausted/);
  assert.equal(scheduler.snapshot().tasks.length, 2);
  assert.equal(scheduler.snapshot().pending.requestId, 2);
  assert.equal(slots.snapshot().activeList.lastOffset, 0);
  const result = visitTailWithState(scheduler, state, { maxNativeCalls: 1 });
  assert.equal(result.actions[0].requestId, 2);
  assert.equal(result.execution.tasks.length, 2);
  assert.deepEqual(slots.snapshot().columns['1350'].slice(42), [4, 2]);
  assert.ok(result.execution.tasks.every(t => t.steps === 0));
});

test('Only the matching pending A9 can prepare one spawn; modified, reused or stale requests cannot change memory', () => {
  const { scheduler, allocator } = setup([...creation(0x197), 0x58, 0x11, 0x56]);
  scheduler.addTask(2);
  const request = scheduler.visitTail().pending;
  const words = [0x56, 22, 456, 64, 0x197];
  const before = scheduler.snapshot();
  assert.throws(() => scheduler.prepareNativeTask({ ...request, requestId: 99 }, words), /matching/);
  assert.throws(() => scheduler.prepareNativeTask({ ...request, args: [11, 1, 2, 3, 4] }, words), /matching/);
  assert.throws(() => scheduler.prepareNativeTask(request, [0x56, 66, 456, 64, 0x197]), /workspace/);
  assert.deepEqual(scheduler.snapshot(), before);
  const prepared = scheduler.prepareNativeTask(request, words);
  const another = scheduler.prepareNativeTask(request, words);
  assert.equal(prepared.spawn(), 2);
  assert.throws(() => prepared.spawn(), /Stale/);
  assert.throws(() => another.spawn(), /Stale/);
  assert.throws(() => scheduler.prepareNativeTask(request, words), /already created/);
  assert.deepEqual(allocator.snapshot().activeOrder, [0, 2]);
});

test('Invalid workspace completion is rejected before mutating or faulting a suspended scheduler', () => {
  const { scheduler } = setup([...creation(0x197), 0x56]);
  scheduler.addTask(2);
  const request = scheduler.visitTail().pending;
  const before = scheduler.snapshot();
  for (const workspaceWords of [new Array(5), [0x56, 66, 456, 64, 0x197], [0x56]]) {
    assert.throws(() => scheduler.completeNative(request.taskId, request.requestId, 0x56, { workspaceWords }), /workspace/);
    assert.deepEqual(scheduler.snapshot(), before);
  }
});

test('Taskslot exhaustion keeps the initialized orphan payload and earlier game-list writes without storing a fabricated handle', () => {
  const { scheduler, state, allocator, slots } = setup([...creation(0x197), 0x56]);
  scheduler.addTask(2);
  // Explicit allocator fixtures consume the other original task slots.
  for (let i = 1; i < 48; i++) {
    const created = allocator.createFrame(0x10A);
    assert.equal(created.created, true);
    allocator.appendRoot(created.taskOffset);
  }
  const before = allocator.snapshot();
  assert.throws(() => visitTailWithState(scheduler, state), /task_slot_failure_continuation_required/);
  const after = allocator.snapshot();
  assert.equal(after.freeTaskOffset, 0xFFFF);
  assert.equal(after.activeOrder.length, 48);
  assert.equal(after.heap.headers.length, before.heap.headers.length + 1);
  assert.ok(after.heap.headers.at(-2).sizeWord & 0x8000);
  assert.equal(slots.snapshot().activeList.entries[0], 0x56);
  assert.equal(slots.snapshot().columns['1350'][43], null);
});

test('A9 from a suspended child appends an independent root after the full chain and preserves the blocked parent', () => {
  const parent = { ...original.scripts.find(s => s.id === 0x10A), bytecode: [0x52, 2, 0, 0xC0, 0x56] };
  const { scheduler, state, allocator } = setup([...creation(0x197), 0x58, 0x11, 0x56], { other: [parent] });
  scheduler.addTask(0x10A);
  const result = visitTailWithState(scheduler, state);
  assert.equal(result.execution.pending.scriptId, 2);
  assert.deepEqual(allocator.snapshot().activeOrder, [0, 2, 4]);
  assert.equal(allocator.snapshot().cursorOffset, 2);
  assert.equal(allocator.snapshot().slots[0].statusWord, 0xFFFF);
  assert.equal(result.state.slots.columns['1350'][43], 4);
  assert.equal(result.execution.tasks[1].frames[0].memory.taskOffset, 4);
  assert.equal(result.execution.tasks[1].steps, 0);
});

test('Unallocated schedulers keep positive A9 at its explicit allocation boundary', () => {
  const scheduler = createScriptScheduler(bundle([...creation(0x197), 0x56]));
  scheduler.addTask(2);
  const state = createScriptState({ byteLength: 0x32, slotState: createSlotState({ definitionData: definitions }) });
  const result = visitTailWithState(scheduler, state);
  assert.equal(result.boundary.reason, 'slot_task_creation_required');
  assert.equal(result.state.slots.activeList.lastOffset, 0xFFFE);
});

test('Original European A9 source proves the two scratch writes, pre-allocation list append, handle store and absence of immediate visit', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const code = '8600BF283F7E0A85020A6502AABFB4EF8CA6009D58148AAEB014E8E88EB0149DB214A60830092266C380A6009D501360';
  assert.equal(rom.subarray(0x28C5, 0x28C5 + code.length / 2).toString('hex').toUpperCase(), code);
  assert.equal(rom.subarray(0x4366, 0x436A).toString('hex').toUpperCase(), '204AC36B');
});

test('Unmodified original A9 callers stop at their earlier unsourced actions without synthetic success or slot creation', () => {
  for (const [id, args, nativeId, pc, nativeArgs] of [
    [0x318, [0], 0x6A, 75, [0, 5]],
    [0x105, [0], 0xD2, 149, [0, 0, 0]],
    [0x252, [0, 0, 0, 0, 0], 0xD2, 139, [0, 0, 6]],
  ]) {
    const allocator = createTaskFrameAllocator({ profileData: profiles });
    const scheduler = createScriptScheduler(original, { frameAllocator: allocator });
    const slots = createSlotState({ definitionData: definitions });
    const state = createScriptState({ byteLength: 0x32, slotState: slots });
    scheduler.addTask(id, args); // Synthetically supplied root arguments only.
    const beforeSlots = slots.snapshot();
    const result = visitTailWithState(scheduler, state);
    assert.deepEqual(result.boundary, { nativeId, reason: 'slot_source_required' });
    assert.equal(result.execution.pending.pc, pc);
    assert.deepEqual(result.execution.pending.args, nativeArgs);
    assert.equal(result.handledCalls, 0);
    assert.deepEqual(slots.snapshot(), beforeSlots);
    assert.deepEqual(allocator.snapshot().activeOrder, [0]);
  }
});
