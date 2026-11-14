import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlotMotionData, prepareMotionDataView } from '../proof/state/slot-motion-data.mjs';
import { prepareMotionPrefixReset88 } from '../proof/state/slot-motion-prefix-reset-88.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createScriptState, isScriptStateNative } from '../proof/state/script-state.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { runTaskWithState, visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const original = await load('scripts');
const profiles = createTaskFrameProfiles(await load('task-frame-profiles'));
const memory = () => createTaskFrameAllocator({ profileData: profiles });
// Synthetic bytecode keeps original frame profiles and native table/ABI.
const bundle = code => ({ ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: code } : s) });
const reset = { nativeId: 0x88, args: [], returnBytes: 0 };
// Independent source expectations, without the implementation's constants.
const expectedWrites = [0x1D5B, 0x1D5D, 0x1D5F, 0x1D65, 0x1D6B, 0x1D6D]
  .map((address, i) => ({ address: 0x7E0000 + address, value: i === 0 ? 0xFFFF : 0 }));
const resetBytes = expectedWrites.flatMap(({ address, value }) => [[address, value & 255], [address + 1, value >>> 8]]);
const fixture = (withData = true) => {
  const data = withData ? createSlotMotionData() : null;
  const slots = createSlotState({ motionData: data });
  const state = createScriptState({ byteLength: 4, slotState: slots });
  return { data, slots, state };
};
const capture = s => ({ state: s.state.snapshot(), data: s.data?.snapshot() });

test('Complete88 plan writes the six original odd WORDs in order and reads no unknown bytes', () => {
  const s = fixture(), before = capture(s);
  assert.deepEqual(prepareMotionPrefixReset88({ motionData: s.data, bank: 0x80 }), { handled: true, writes: expectedWrites });
  assert.deepEqual(capture(s), before);
  assert.deepEqual(s.slots.applyNative(reset), { handled: true, value: null });
  assert.deepEqual(s.data.snapshot().bytes, resetBytes);
  assert.deepEqual(s.state.snapshot(), before.state);
  assert.equal(s.data.readPrefixCounter().value, 0);
  assert.equal(s.data.readSpecialSlot().available, false);
});

test('Reset preserves known holes,neighbors,0CC2,all slot columns and scratch; repeated reset is idempotent', () => {
  const s = fixture();
  s.data.seed(0x7E1D5A, Array.from({ length: 22 }, (_, i) => i + 0x80));
  s.data.seed(0x7E0CC2, [0x54, 0]); s.data.seed(0x7EDEAA, [0x20, 0]);
  s.slots.seedSlot(0x54, { definitionWord: 0x1234, count: 3, head: 8, fields: { '0D20': 4, '0D78': 0xFFFC, '1458': 0x61 } });
  s.slots.seedMotionScratchWord('20', 0x4567); s.state.seed(0, [1, 2, 3, 4]);
  const before = capture(s), expected = new Map(before.data.bytes);
  for (const [address, byte] of resetBytes) expected.set(address, byte);
  assert.deepEqual(s.slots.resetMotionPrefix88({ bank: 0x80 }), { handled: true });
  assert.deepEqual(s.data.snapshot().bytes, [...expected].sort(([a], [b]) => a - b));
  assert.deepEqual(s.state.snapshot(), before.state);
  const after = capture(s); s.slots.applyNative(reset); assert.deepEqual(capture(s), after);
});

test('EveryDBR permits exactly lowWRAM mirrors or direct7E; manual reset requires an explicit bank', () => {
  const s = fixture(), before = capture(s);
  assert.equal(s.slots.resetMotionPrefix88().reason, 'slot_motion_prefix_bank_required');
  for (let bank = 0; bank < 256; bank++) {
    const mapped = bank <= 0x3F || bank >= 0x80 && bank <= 0xBF || bank === 0x7E;
    assert.equal(prepareMotionPrefixReset88({ motionData: s.data, bank }).handled, mapped);
    if (!mapped) assert.equal(s.slots.resetMotionPrefix88({ bank }).reason, 'slot_motion_prefix_bank_required');
  }
  assert.deepEqual(capture(s), before);
  for (const bank of [0, 0x3F, 0x7E, 0x80, 0xBF]) {
    const fresh = fixture(); assert.equal(fresh.slots.resetMotionPrefix88({ bank }).handled, true);
    assert.deepEqual(fresh.data.snapshot().bytes, resetBytes);
  }
});

test('Missing reset owner stops atomically,while routing and budget recognition require a slot owner', () => {
  const s = fixture(false), before = capture(s);
  assert.deepEqual(s.state.applyNative(reset), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7E1D5B });
  assert.deepEqual(capture(s), before);
  assert.equal(isScriptStateNative(s.state, 0x88), true);
  const plain = createScriptState({ byteLength: 2 });
  assert.equal(isScriptStateNative(plain, 0x88), false);
  assert.equal(plain.applyNative(reset).reason, 'native_implementation_required');
});

test('Malformed native88 ABI and invalid providers,banks and manual contexts cannot change any state', () => {
  const s = fixture(), before = capture(s);
  for (const request of [{ ...reset, args: null }, { ...reset, args: [0] }, { ...reset, args: new Uint8Array() },
    { ...reset, returnBytes: 2 }, { nativeId: 0x88, args: [] }]) assert.throws(() => s.state.applyNative(request), /ABI mismatch/);
  for (const options of [null, [], 'bank80', { bank: -1 }, { bank: 256 }, { bank: 1.5 }, { bank: NaN }]) {
    assert.throws(() => s.slots.resetMotionPrefix88(options), /Invalid/);
  }
  assert.throws(() => prepareMotionPrefixReset88({ motionData: {}, bank: 0x80 }), /Invalid/);
  assert.deepEqual(capture(s), before);
});

test('Dedicated six-word writer rejects a late gap,neighbor,wrongbank,reordering or invalid word before all writes', () => {
  const s = fixture(); s.data.seed(0x7E1D65, [0xAA]); const before = capture(s);
  for (const address of [0x7E1D61, 0x7E1D67, 0x7E1D6F, 0x7E0CC2, 0x7F1D6D, 0x7E1D5B]) {
    const writes = structuredClone(expectedWrites); writes[5].address = address;
    assert.equal(s.data.writePrefixResetWords(writes).handled, false); assert.deepEqual(capture(s), before);
  }
  const reordered = structuredClone(expectedWrites); [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.equal(s.data.writePrefixResetWords(reordered).handled, false);
  for (const writes of [null, [], expectedWrites.slice(0, 5), new Array(6),
    [...expectedWrites.slice(0, 5), { address: 0x7E1D6D, value: 65536 }],
    [...expectedWrites.slice(0, 5), { address: NaN, value: 0 }]]) assert.throws(() => s.data.writePrefixResetWords(writes), /Invalid/);
  assert.deepEqual(capture(s), before);
});

test('Expanded seed window never authorizes Prelude writes to reset words or holes,including late batch failure', () => {
  const s = fixture(), before = capture(s);
  for (let address = 0x7E1D5A; address <= 0x7E1D6F; address++) {
    assert.equal(s.data.writePreludeWords([{ address: 0x7EE0AC, value: 0 }, { address, value: 0 }]).handled, false);
  }
  for (const address of [0x7E1D59, 0x7E1D70]) assert.throws(() => s.data.seed(address, [1]), /Invalid/);
  assert.deepEqual(capture(s), before);
});

test('Reset and DE94 share both counter bytes; reset leaves existing movement intact and missing pointer unknown', () => {
  const s = fixture(); s.data.seed(0x7E0CC2, [0x54, 0]); s.data.seed(0x7E1D65, [3, 0]);
  assert.equal(s.slots.stepMotionPrefixDE94({ bank: 0x80 }).outcome, 'alternating');
  const before = s.slots.snapshot(); s.slots.applyNative(reset);
  assert.equal(s.data.readPrefixCounter().value, 0);
  assert.equal(s.slots.stepMotionPrefixDE94({ bank: 0x80 }).outcome, 'counter_zero');
  assert.deepEqual(s.slots.snapshot(), before); assert.equal(s.data.readSpecialSlot().value, 0x54);
  const missing = fixture(); missing.slots.applyNative(reset);
  assert.equal(missing.slots.stepMotionPrefixDE94({ bank: 0x80 }).address, 0x7E0CC2);
});

test('Independent AFC4 planning copies and detached snapshots preserve known reset bytes and holes', () => {
  const s = fixture(); s.data.seed(0x7E1D64, [0xAC]); s.slots.applyNative(reset); const before = capture(s);
  const view = prepareMotionDataView(s.data, []).data;
  view.writePrefixCounter(0xFFFF); assert.deepEqual(capture(s), before);
  view.writePrefixResetWords(expectedWrites); assert.deepEqual(view.snapshot(), s.data.snapshot());
  const snapshot = view.snapshot(); snapshot.bytes[0][1] = 0;
  assert.deepEqual(capture(s), before);
});

test('Synthetic native88 task retains known and unknown workspace bytes and heap,then stops at next native', () => {
  for (const hydrated of [false, true]) {
    const allocator = memory(), s = fixture();
    const task = createScriptTask(bundle([0x58, 0x88, 0x58, 0x11, 0x56]), 2, [], { frameAllocator: allocator });
    if (hydrated) allocator.writeWorkspaceWords([0x1234, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(task.run().pending.nativeId, 0x88); // Establish the real task cursor before testing reset completion.
    const before = allocator.snapshot(); const result = runTaskWithState(task, s.state);
    assert.equal(result.handledCalls, 1); assert.deepEqual(result.actions.map(a => [a.nativeId, a.args, a.value]), [[0x88, [], null]]);
    assert.deepEqual(result.boundary, { nativeId: 0x11, reason: 'native_implementation_required' });
    assert.equal(result.execution.checks, 0); assert.deepEqual(allocator.snapshot(), before);
    assert.deepEqual(s.data.snapshot().bytes, resetBytes);
  }
});

test('Repeated88 obeys native-call budget; the second pending request resumes exactly once', () => {
  const s = fixture(), task = createScriptTask(bundle([0x58, 0x88, 0x58, 0x88, 0x58, 0x11, 0x56]), 2);
  assert.throws(() => runTaskWithState(task, s.state, { maxNativeCalls: 1 }), /budget exhausted/);
  assert.equal(task.snapshot().pending.nativeId, 0x88); assert.equal(task.snapshot().pending.requestId, 2);
  s.data.writePrefixCounter(11);
  const resumed = runTaskWithState(task, s.state, { maxNativeCalls: 1 });
  assert.equal(resumed.actions[0].requestId, 2); assert.equal(s.data.readPrefixCounter().value, 0);
  assert.equal(resumed.boundary.nativeId, 0x11);
});

test('Missing provider keeps the same task request pending and preserves workspace on repeated host attempts', () => {
  const allocator = memory(), s = fixture(false);
  const task = createScriptTask(bundle([0x58, 0x88, 0x56]), 2, [], { frameAllocator: allocator });
  assert.equal(task.run().pending.nativeId, 0x88);
  allocator.writeWorkspaceWords([1, 2, 3, 4, 5, 6, 7, 8]); const before = allocator.snapshot();
  const first = runTaskWithState(task, s.state), again = runTaskWithState(task, s.state);
  assert.deepEqual(first.boundary, { nativeId: 0x88, reason: 'slot_motion_data_source_required' });
  assert.equal(first.handledCalls, 0); assert.deepEqual(again.execution, first.execution);
  assert.deepEqual(allocator.snapshot(), before);
});

test('Scheduler dispatch of88 keeps existing waiter checks,eventword and traversal cursor unchanged', () => {
  const allocator = memory(), s = fixture();
  const scheduler = createScriptScheduler(bundle([0x58, 0x88, 0x58, 0x11, 0x56]), { frameAllocator: allocator });
  const spectator = scheduler.addTask(0x04B); visitTailWithState(scheduler, s.state);
  const before = scheduler.snapshot().tasks.find(t => t.taskId === spectator);
  scheduler.addTask(2); const result = visitTailWithState(scheduler, s.state);
  assert.equal(result.handledCalls, 1); assert.equal(result.boundary.nativeId, 0x11);
  assert.deepEqual(result.execution.tasks.find(t => t.taskId === spectator), before);
  assert.deepEqual(s.data.snapshot().bytes, resetBytes);
  assert.equal(sweepWithState(scheduler, s.state).execution.pending.nativeId, 0x11);
});

test('Original zeroarg native88 dispatch pins DBR80/D0 setup and exact reset bytes without CPU execution', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  assert.equal(rom.subarray(0x74F7, 0x7500).toString('hex'), 'a900005bf48080abab');
  assert.equal(rom.readUInt16LE(0x158C8), 0xDE7E); assert.equal(rom[0x15AD4], 0); assert.equal(rom[0x159F8], 0);
  assert.equal(rom.subarray(0x5E7E, 0x5E94).toString('hex'), 'a9ffff8d5b1d9c5d1d9c5f1d9c651d9c6b1d9c6d1d60');
  const profile = original.nativeFunctions.find(n => n.id === 0x88);
  assert.equal(profile.argumentWords, 0); assert.equal(profile.returnBytes, 0);
});
