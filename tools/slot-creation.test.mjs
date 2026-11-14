import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { runTaskWithState, visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const asset = JSON.parse(await readFile(new URL('../assets/slot-definitions.json', import.meta.url), 'utf8'));
const request = (args = [11, 123, 456, 64, 0xFFFF]) => ({ nativeId: 0xA9, args, returnBytes: 2 });
const create = [0x0A, 0xFF, 0x00, 64, 0x14, 0xC8, 1, 0x00, 123, 0x00, 11, 0x58, 0xA9];
const wrapper = (id, bytecode, returnBytes = 2) => ({ id, bytecode, returnBytes, argumentBytes: 0, localBytes: 0 });
const bundle = (...scripts) => ({ ...original, scripts: [...original.scripts, ...scripts] });
const sourced = () => createSlotState({ definitionData: createSlotDefinitions(asset) });

test('Definition lookup preserves carry from second ASL, 16-bit wrap and byte alignment for all input words', () => {
  const data = createSlotDefinitions(asset);
  for (let word = 0; word <= 0xFFFF; word++) {
    const doubled = (word << 1) & 0xFFFF;
    const carry = doubled >>> 15;
    const quadrupled = (doubled << 1) & 0xFFFF;
    const index = (quadrupled + doubled + carry) & 0xFFFF;
    const lookup = data.lookup(word);
    if (index + 1 >= asset.bytes.length) assert.deepEqual(lookup, { available: false, reason: 'slot_definition_window_required' });
    else assert.deepEqual(lookup, { available: true, value: asset.bytes[index] | asset.bytes[index + 1] << 8, byteOffset: index });
  }
  assert.equal(data.lookup(0x5556).byteOffset, 5); // carry 1, odd word read
  assert.equal(data.lookup(0xAAAB).byteOffset, 2); // wrap, carry 0
  assert.equal(data.lookup(11).value, 0xA368);
});

test('Definition assets validate provenance/bytes and cannot mutate the loaded data', () => {
  const input = { ...asset, bytes: [...asset.bytes] };
  const data = createSlotDefinitions(input);
  const before = data.lookup(0);
  input.bytes[0] = input.bytes[1] = 0;
  assert.deepEqual(data.lookup(0), before);
  const sparse = new Array(2);
  for (const invalid of [{ ...asset, sourceCpu: '8D:EFB4' }, { ...asset, romSha256: 'wrong' }, { ...asset, bytes: [0] }, { ...asset, bytes: [0, 256] }, { ...asset, bytes: sparse }, { ...asset, bytes: Array(0x104D).fill(0) }]) assert.throws(() => createSlotDefinitions(invalid), /definition data/);
  assert.throws(() => data.lookup(-1), /definition word/);
  assert.throws(() => createSlotState({ definitionData: {} }), /definition source/);
});

test('Native A9 initializes every written field, appends highest free offset and preserves skipped task-handle field', () => {
  for (const fifth of [0x8000, 0x8001, 0xFFFF]) {
    const slots = sourced();
    slots.seedSlot(0x56, { definitionWord: 0xFFFF, count: 2, head: 4, fields: { '1350': 0xBEEF } });
    const pool = slots.snapshot().pool;
    assert.deepEqual(slots.applyNative(request([11, 123, 456, 64, fifth])), { handled: true, value: 0x56, workspaceWords: [0x56, 22, 456, 64, fifth] });
    const after = slots.snapshot();
    const expected = {
      '7E:4240': 0, '7E:4298': 0, '7E:42F0': 0, '7E:4348': 0, '7E:43A0': 0,
      '7E:43F8': 0, '7E:4450': 0, '7E:40E0': 0, '1140': 0, '7E:3F80': 0,
      '0D20': 0, '0D78': 0, '0DD0': 0, '0F88': 0, '1090': 0, '1198': 0,
      '13A8': 0, '1400': 0, '1038': 0xFFFF, '150A': 0xFFFF,
      '7E:4030': 0x80, '7E:3FD8': 1, '0E28': 492, '0E80': 1824,
      '0ED8': 256, '0F30': 1158, '1458': 0xA368, '1350': 0xBEEF, '10E8': null, '11F0': null, '7E:4088': null, '1248': null,
      '7E:4138': null, '7E:4190': null, '7E:41E8': null, '0FE0': null,
    };
    assert.deepEqual(Object.fromEntries(Object.entries(after.columns).map(([key, values]) => [key, values[43]])), expected);
    assert.ok(Object.values(after.columns).every(values => values.slice(0, 43).every(value => value === null)));
    assert.deepEqual(after.definitions.slice(0, 43), Array(43).fill(0xFFFF));
    assert.equal(after.definitions[43], 11);
    assert.equal(after.counts[43], 0);
    assert.equal(after.heads[43], 0);
    assert.equal(after.activeList.lastOffset, 0);
    assert.equal(after.activeList.entries[0], 0x56);
    assert.deepEqual(after.pool, pool);
  }
});

test('Creation scales positions as words and wraps their sum before a logical half', () => {
  for (const [first, second, third, expected] of [[0xFFFF, 1, 0x8000, [0xFFFC, 4, 0, 0]], [0x4000, 0xFFFF, 0x4001, [0, 0xFFFC, 4, 0x7FFE]], [0x2000, 0, 0xFFFF, [0x8000, 0, 0xFFFC, 0x4000]]]) {
    const slots = sourced();
    slots.applyNative(request([0, first, second, third, 0xFFFF]));
    const cols = slots.snapshot().columns;
    assert.deepEqual(['0E28', '0E80', '0ED8', '0F30'].map(key => cols[key][43]), expected);
  }
});

test('Descending slot search fills all 44 slots, then returns the unchanged first argument without further data/task work', () => {
  const slots = sourced();
  for (let i = 43; i >= 0; i--) assert.equal(slots.applyNative(request([0, 0, 0, 0, 0xFFFF])).value, i * 2);
  const before = slots.snapshot();
  assert.equal(before.activeList.lastOffset, 0x56);
  assert.deepEqual(before.activeList.entries, Array.from({ length: 44 }, (_, i) => 0x56 - i * 2));
  for (const word of [0, 1, 0x8000, 0xCAFE, 0xFFFF]) assert.deepEqual(slots.applyNative(request([word, 1, 2, 3, 0])), { handled: true, value: word, workspaceWords: [word, 1, 2, 3, 0] });
  assert.deepEqual(slots.snapshot(), before);
  slots.applyNative({ nativeId: 0xB9, args: [0x28], returnBytes: 0 });
  assert.equal(slots.applyNative(request()).value, 0x28);
  assert.equal(slots.snapshot().activeList.entries.at(-1), 0x28);
});

test('Sign-bit free detection is retained, including repeated selection and bounded-list overflow on wrapped definitions', () => {
  const slots = sourced();
  for (let i = 0; i < 44; i++) assert.equal(slots.applyNative(request([0xAAAB, 0, 0, 0, 0xFFFF])).value, 0x56);
  assert.equal(slots.snapshot().definitions[43], 0xAAAB);
  assert.ok(slots.snapshot().activeList.entries.every(offset => offset === 0x56));
  const before = slots.snapshot();
  assert.equal(slots.applyNative(request([0xAAAB, 0, 0, 0, 0xFFFF])).reason, 'slot_list_window_required');
  assert.deepEqual(slots.snapshot(), before);
});

test('Missing definition source, outside-window lookup and unsupported task creation leave all slot data untouched', () => {
  const missing = createSlotState();
  const beforeMissing = missing.snapshot();
  assert.equal(missing.applyNative(request()).reason, 'slot_definition_source_required');
  assert.deepEqual(missing.snapshot(), beforeMissing);
  const slots = sourced();
  const before = slots.snapshot();
  assert.equal(slots.applyNative(request([0xFFFF, 0, 0, 0, 0xFFFF])).reason, 'slot_definition_window_required');
  for (const script of [0, 1, 0x7FFF]) assert.equal(slots.applyNative(request([11, 0, 0, 0, script])).reason, 'slot_task_creation_required');
  assert.deepEqual(slots.snapshot(), before);
  const exhausted = createSlotState(); // Exhaustion skips even the missing-data/task branch.
  for (let offset = 0; offset <= 0x56; offset += 2) exhausted.seedSlot(offset, { definitionWord: 0, count: 0, head: 0 });
  assert.deepEqual(exhausted.applyNative(request([0xCAFE, 1, 2, 3, 0])), { handled: true, value: 0xCAFE, workspaceWords: [0xCAFE, 1, 2, 3, 0] });
});

test('Malformed A9 argument/return profiles fail before any slot effect', () => {
  const slots = sourced();
  const before = slots.snapshot();
  for (const args of [[], [0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, -1], [0, 0, 0, 0, 65536], new Array(5)]) assert.throws(() => slots.applyNative(request(args)), /ABI mismatch/);
  assert.throws(() => slots.applyNative({ ...request(), returnBytes: 0 }), /ABI mismatch/);
  assert.deepEqual(slots.snapshot(), before);
});

test('Source-backed creation feeds the original $060 and removes its slot without occupied-slot fixtures', () => {
  // Only orchestration is synthetic: original native A9 + unmodified $060.
  const testBundle = bundle(wrapper(0xFFFF, [...create, 0x52, 0x60, 0, 0x56], 0));
  const slots = sourced();
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const result = runTaskWithState(createScriptTask(testBundle, 0xFFFF), state);
  assert.equal(result.execution.status, 'ended');
  assert.equal(result.execution.result.value, null);
  assert.deepEqual(result.actions.map(a => a.nativeId), [0xA9, 0x12, 0xB9]);
  assert.equal(result.actions[0].value, 0x56);
  assert.deepEqual(result.actions[2].args, [0x56]);
  assert.deepEqual(result.state.scriptWords.bytes.slice(0x2A, 0x2C), [0, 0]);
  assert.ok(result.state.slots.definitions.every(word => word === 0xFFFF));
  assert.equal(result.state.slots.activeList.lastOffset, 0xFFFE);
  assert.equal(result.state.slots.activeList.entries[0], 0x56);
  assert.equal(result.state.slots.columns['1458'][43], 0xA368);
  assert.equal(result.state.slots.columns['0E28'][43], 492);
  assert.equal(result.state.slots.columns['1350'][43], null);
});

test('Shared creations follow reverse task order, allocate distinct offsets and preserve another waiter check', () => {
  const testBundle = bundle(wrapper(0xFFFF, [...create, 0x56]), wrapper(0xFFFE, [...create, 0x56]));
  const scheduler = createScriptScheduler(testBundle);
  const state = createScriptState({ byteLength: 0x32, slotState: sourced() });
  const spectator = scheduler.addTask(0x04B);
  visitTailWithState(scheduler, state);
  const older = scheduler.addTask(0xFFFF);
  const newer = scheduler.addTask(0xFFFE);
  sweepWithState(scheduler, state);
  const result = sweepWithState(scheduler, state);
  assert.deepEqual(result.actions.map(a => [a.taskId, a.nativeId, a.value]), [[newer, 0xA9, 0x56], [older, 0xA9, 0x54]]);
  assert.deepEqual(result.state.slots.activeList.entries.slice(0, 2), [0x56, 0x54]);
  assert.equal(result.execution.tasks.length, 1);
  assert.equal(result.execution.tasks[0].taskId, spectator);
  assert.equal(result.execution.tasks[0].checks, 1);
  assert.equal(result.execution.tasks[0].wait.remaining, 4);
});

test('Native budget stops before a second creation and resumes its exact request without reallocating the first slot', () => {
  const testBundle = bundle(wrapper(0xFFFF, [...create, 0xBC, ...create, 0x56]));
  const task = createScriptTask(testBundle, 0xFFFF);
  const state = createScriptState({ byteLength: 0x32, slotState: sourced() });
  assert.throws(() => runTaskWithState(task, state, { maxNativeCalls: 1 }), /budget exhausted/);
  assert.equal(task.snapshot().pending.requestId, 2);
  assert.equal(state.snapshot().slots.activeList.lastOffset, 0);
  assert.equal(state.snapshot().slots.definitions[42], 0xFFFF);
  const result = runTaskWithState(task, state, { maxNativeCalls: 1 });
  assert.equal(result.actions[0].requestId, 2);
  assert.equal(result.execution.result.value, 0x54);
  assert.deepEqual(result.state.slots.activeList.entries.slice(0, 2), [0x56, 0x54]);
});

test('Definition asset, A9 profile and index/list/task-skip instruction bytes match this European ROM', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  assert.deepEqual(asset.bytes, Array.from(rom.subarray(0x66FB4, 0x68000)));
  assert.equal(rom.readUInt16LE(0x157B8 + 0xA9 * 2), 0xA835);
  assert.equal(rom[0x15A4C + 0xA9], 5);
  assert.equal(rom[0x15970 + 0xA9], 2);
  const code = '8600BF283F7E0A85020A6502AABFB4EF8CA6009D58148AAEB014E8E88EB0149DB214A60830092266C380A6009D501360';
  assert.equal(rom.subarray(0x28C5, 0x28C5 + code.length / 2).toString('hex').toUpperCase(), code);
});
