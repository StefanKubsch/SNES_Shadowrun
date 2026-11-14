import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { createTaskHeap } from '../proof/script/task-heap.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { runTaskWithState } from '../proof/state/host.mjs';

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const profiles = JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8'));
const fresh = () => createTaskFrameAllocator({ profileData: createTaskFrameProfiles(profiles) });
const fixture = (id, bytecode, returnBytes = 2) => ({ ...original, scripts: original.scripts.map(script => script.id === id ? { ...script, bytecode, returnBytes } : script) });

test('Original $197 runs with original allocation, writes real locals/stack and releases its taskslot plus heap', () => {
  const allocator = fresh();
  const task = createScriptTask(original, 0x197, [0x08B2], { frameAllocator: allocator });
  const before = task.snapshot();
  assert.equal(before.frames[0].memory.taskOffset, 0);
  assert.equal(before.frames[0].memory.payloadAddress, 0x03D6);
  const result = task.run();
  assert.equal(result.result.value, 0xFFFF);
  assert.equal(result.result.workspaceWord, 0xFFFF);
  assert.equal(allocator.snapshot().workspace[0], 0xFFFF);
  assert.deepEqual(allocator.snapshot().activeOrder, []);
  assert.equal(allocator.snapshot().freeTaskOffset, 0);
  assert.equal(allocator.snapshot().heap.headers[0].sizeWord & 0x8000, 0);
  for (const argument of [0, 0x1458, 0x1B6D, 0xFFFF]) {
    const next = createScriptTask(original, 0x197, [argument], { frameAllocator: allocator });
    assert.equal(next.run().result.value, [0x1458, 0x1B6D].includes(argument) ? 0xFFFF : 0);
  }
});

test('Known Localbytes survive real END/reallocation and are used by the next running frame', () => {
  const allocator = fresh();
  // Synthetic code in original $197's 2-local-byte allocation profile.
  const writer = fixture(0x197, [0xBC, 0x14, 0xEF, 0xBE, 0x34, 0, 0xC0, 0x56]);
  createScriptTask(writer, 0x197, [0], { frameAllocator: allocator }).run();
  const reader = fixture(0x197, [0xBC, 0x16, 0, 0x56]);
  const next = createScriptTask(reader, 0x197, [0], { frameAllocator: allocator });
  assert.deepEqual([...next.snapshot().frames[0].locals], [0xEF, 0xBE]);
  assert.equal(next.run().result.value, 0xBEEF);
});

test('Fresh unknown local reads fault while reused known bytes are not falsely reset to zero', () => {
  const allocator = fresh();
  const reader = fixture(0x197, [0xBC, 0x16, 0, 0x56]);
  const task = createScriptTask(reader, 0x197, [0], { frameAllocator: allocator });
  assert.throws(() => task.run(), /Uninitialized local read/);
  assert.equal(task.snapshot().status, 'faulted');
  assert.deepEqual(allocator.snapshot().activeOrder, [0]);
});

test('A real script call uses original child insertion, reverse workspace, parent continuation and immediate release/resume', () => {
  const allocator = fresh();
  const parentCode = [0x14, 0xB2, 8, 0x52, 0x97, 1, 0x56];
  const bundle = fixture(0x10A, parentCode);
  const task = createScriptTask(bundle, 0x10A, [], { frameAllocator: allocator });
  const result = task.run();
  assert.equal(result.result.value, 0xFFFF);
  const state = allocator.snapshot();
  assert.deepEqual(state.activeOrder, []);
  assert.equal(state.freeTaskOffset, 0);
  assert.equal(state.slots[0].continuationWord, 0xF494);
  assert.equal(state.slots[0].statusWord, 0);
  assert.equal(state.slots[1].predecessorWord, 4);
});

test('Allocated child wait masks remove the child without its continuation and preserve the parent return value', () => {
  const allocator = fresh();
  const child = fixture(0x10B, [0xC0, 0xC0, 0x58, 0x9F, 0x14, 0xAD, 0xDE, 0x56]);
  const bundle = { ...child, scripts: child.scripts.map(script => script.id === 0x10A ? { ...script, bytecode: [0x52, 0x0B, 1, 0x56], returnBytes: 2 } : script) };
  const task = createScriptTask(bundle, 0x10A, [], { frameAllocator: allocator });
  const result = task.run();
  assert.equal(result.result.value, 0);
  assert.equal(result.removedFrames.length, 1);
  assert.equal(allocator.snapshot().slots[1].continuationWord, 0xF508);
  assert.deepEqual(allocator.snapshot().activeOrder, []);
});

test('Original $10A state actions, wait readiness and zero-return END retain their actual shared-word write', () => {
  const allocator = fresh();
  const task = createScriptTask(original, 0x10A, [], { frameAllocator: allocator });
  const state = createScriptState({ byteLength: 0x32 });
  const waiting = runTaskWithState(task, state);
  assert.equal(waiting.execution.status, 'waiting');
  assert.equal(allocator.snapshot().slots[0].statusWord, 1);
  assert.equal(allocator.snapshot().slots[0].continuationWord, 0xF508);
  const result = task.tick();
  assert.equal(result.status, 'ended');
  assert.equal(result.result.value, null);
  // The original zero-return END pops the known next heap header, not a
  // fabricated zero. No word is pushed to a script caller for this profile.
  assert.equal(result.result.workspaceWord, allocator.snapshot().heap.headers[1].sizeWord);
  assert.equal(allocator.snapshot().workspace[0], result.result.workspaceWord);
  assert.equal(allocator.snapshot().slots[0].statusWord, 0);
});

test('Original scheduler order/cursor and allocation order agree, including a sound suspension and exact continuation', () => {
  const allocator = fresh();
  const scheduler = createScriptScheduler(original, { frameAllocator: allocator });
  const older = scheduler.addTask(0x04B);
  scheduler.visitTail();
  const newer = scheduler.addTask(0x04B);
  scheduler.visitTail();
  assert.deepEqual(scheduler.snapshot().memory.activeOrder, [0, 2]);
  assert.equal(scheduler.snapshot().memory.cursorOffset, 0xFFFF);
  scheduler.sweep();
  for (let check = 0; check < 5; check++) scheduler.sweep();
  const paused = scheduler.snapshot();
  assert.equal(paused.pending.taskId, newer);
  assert.equal(paused.pending.nativeId, 0x4C);
  assert.equal(paused.memory.cursorOffset, 2);
  assert.equal(paused.tasks.find(task => task.taskId === older).checks, 4);
  const continued = scheduler.completeNative(newer, paused.pending.requestId);
  assert.equal(continued.memory.freeTaskOffset, 2);
  assert.equal(continued.memory.cursorOffset, 0);
  const rest = scheduler.sweep();
  assert.equal(rest.pending.taskId, older);
  assert.equal(rest.tasks[0].checks, 5);
});

test('Original control metadata is preserved across a suspended native and invalid replies cannot mutate allocation', () => {
  const allocator = fresh();
  const bundle = fixture(0x10A, [0xC0, 0x58, 0x57, 0x56]);
  const task = createScriptTask(bundle, 0x10A, [], { frameAllocator: allocator });
  const pending = task.run();
  const payload = allocator.payloadFor(0).bytes;
  assert.equal(payload[3] | payload[4] << 8, 3);
  assert.equal(payload[9] | payload[10] << 8, 0x57);
  const before = allocator.snapshot();
  assert.throws(() => task.completeNative(pending.pending.requestId, null), /return value/);
  assert.deepEqual(allocator.snapshot(), before);
  assert.equal(task.completeNative(pending.pending.requestId, 0xCAFE).result.value, 0xCAFE);
});

test('Profile mismatches, stack overflow into locals and local-return control aliasing remain explicit boundaries', () => {
  const allocator = fresh();
  const changed = { ...original, scripts: original.scripts.map(script => script.id === 0x10A ? { ...script, localBytes: 1 } : script) };
  const before = allocator.snapshot();
  assert.throws(() => createScriptTask(changed, 0x10A, [], { frameAllocator: allocator }), /profile_mismatch/);
  assert.deepEqual(allocator.snapshot(), before);
  const overflow = fixture(0x10A, [0xC0, 0xC0, 0xC0, 0xC0, 0xC0, 0x56]);
  assert.throws(() => createScriptTask(overflow, 0x10A, [], { frameAllocator: allocator }).run(), /task_stack_window_required/);
  const recursive = fixture(0x10B, [0x4C, 0, 0, 0x56]);
  assert.throws(() => createScriptTask(recursive, 0x10B, [], { frameAllocator: fresh() }).run(), /task_return_control_alias_required/);
});

test('No-return END with unknown bytes in an unsplit remainder stops instead of inventing a scratch word', () => {
  const heap = createTaskHeap();
  heap.allocate(0x07A9); // Synthetic fixture: leave 31 free bytes at the tail.
  const allocator = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(profiles), heap });
  const task = createScriptTask(fixture(0x10A, [0x56], 0), 0x10A, [], { frameAllocator: allocator });
  // Original profile requests 27 bytes, so the allocator absorbs the four
  // leftover bytes. END reads two unknown bytes there instead of a header.
  assert.throws(() => task.run(), /task_end_word_source_required/);
  assert.equal(allocator.snapshot().activeOrder.length, 1);
});
