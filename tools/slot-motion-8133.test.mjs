import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareSlotMotion } from '../proof/state/slot-motion.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotMotionData } from '../proof/state/slot-motion-data.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createSlotTargetData } from '../proof/state/slot-target-data.mjs';
import { createACState } from '../proof/state/ac-state.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const source = overrides => ({ '7E:40E0': 0, '1458': 0x48, '0E28': 4, '0E80': 0, '0ED8': 400,
  '0D20': 0xFFFF, '0D78': 0, '0DD0': 0, '7E:4240': 0, '7E:4298': 0,
  '7E:42F0': 0, '7E:4348': 0, '7E:43A0': 0, ...overrides });
const word = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const empty = () => {
  const data = createSlotMotionData(); data.seed(0x7EDEAC, Array(512).fill(255)); data.seed(0x7EE0AC, Array(512).fill(255)); return data;
};
const fixture = (value, oldThird = 400) => {
  const data = empty(); word(data, 0x7EDEAC, 0); word(data, 0x7EEF3C, 0); word(data, 0x7EF79C, 0xFFFF);
  [0, 0, 0, 0xFFFF, 0xFFFF, (oldThird >>> 2) + value].forEach((v, i) => word(data, 0x7EE2AC + i * 2, v));
  word(data, 0x7FE214, 0); return data;
};
const run = (fields, motionData, offset = 0) => prepareSlotMotion(fields, { offset, motionData });
const make = (fields, motionData, offset = 0) => {
  const slots = createSlotState({ motionData }); slots.seedSlotFields(offset, Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null))); return slots;
};

test('All65536 helper results select exact AB6D carry, under5 height adjustment or coordinate restore, using post-addition helper fields', () => {
  const data = fixture(0, 0), fields = source({ '0ED8': 0 });
  for (let value = 0; value <= 0xFFFF; value++) {
    word(data, 0x7EE2B6, value); const plan = run(fields, data); assert.equal(plan.handled, true);
    assert.equal(plan.fields['0E28'], value < 5 ? 3 : 4);
    assert.equal(plan.fields['1458'], value < 5 ? 0x40 : 0x48);
    assert.equal(plan.fields['0ED8'] ?? 0, value > 0 && value < 5 ? value * 4 : 0);
    assert.equal(plan.fields['0F30'], value < 5 ? 1 : 2);
    assert.equal(plan.scratchWord6B, value > 0 && value < 5 ? value * 4 : 0);
    assert.equal(plan.helperScratchWords['3B'], value); assert.equal(plan.helperScratchWords['11'], 0);
    assert.equal(plan.helperScratchWords['14'], 0); // New3>>>2, not old4>>>2.
    assert.equal(plan.helperScratchWords['1D'], 0); assert.equal(plan.helperScratchWords['68'], 0);
  }
  assert.deepEqual(fields, source({ '0ED8': 0 }));
});

test('Small-result ADC wraps every old third word with no extra carry and STZ supplies an unknown old motion before final6B capture', () => {
  const data = fixture(4);
  for (let old = 0; old <= 0xFFFF; old++) {
    word(data, 0x7EE2B6, (old >>> 2) + 4);
    const plan = run(source({ '0ED8': old, '0DD0': null }), data);
    const expected = Number((BigInt(old) + 16n) % 65536n);
    assert.equal(plan.handled, true); assert.equal(plan.fields['0ED8'], expected);
    assert.equal(plan.fields['0DD0'], 0); assert.equal(plan.scratchWord6B, expected);
    assert.equal(plan.helperScratchWords['1D'], Math.floor(old / 4));
  }
  for (const value of [0, 5]) {
    word(data, 0x7EE2B6, 100 + value);
    assert.deepEqual(run(source({ '0DD0': null }), data), { handled: false, reason: 'slot_motion_source_required', field: '0DD0' });
  }
  for (const [old, expected] of [[0, 4], [251, 255], [252, 256]]) {
    word(data, 0x7EE2B6, (old >>> 2) + 1);
    const plan = run(source({ '0ED8': old, '0DD0': null, '1458': 0x60 }), data);
    assert.equal(plan.handled, true); assert.equal(plan.fields['0ED8'], expected);
    assert.equal(plan.fields['0DD0'], 0); assert.equal(plan.scratchWord6B, expected);
  }
  word(data, 0x7EE2B6, (253 >>> 2) + 1);
  const continued = run(source({ '0ED8': 253, '1458': 0x60 }), data);
  assert.equal(continued.handled, true); assert.equal(continued.fields['0ED8'], 256); assert.equal(continued.helperScratchWords['1D'], 64);
});

test('All first-motion words retain the original carry helper choice; zero motion and clear0040 require no helper sources', () => {
  const data = empty();
  for (let motion = 0; motion <= 0xFFFF; motion++) {
    const plan = run(source({ '0E28': 0xFFFF, '0D20': motion }), data);
    assert.equal(plan.handled, true);
    assert.equal(plan.fields['0E28'] ?? 0xFFFF, Number((65535n + BigInt(motion)) % 65536n));
    assert.equal(Object.hasOwn(plan, 'helperScratchWords'), motion !== 0);
  }
  const unknown = createSlotMotionData();
  assert.equal(run(source({ '0D20': 0, '7E:43A0': null }), unknown).handled, true);
  assert.equal(run(source({ '1458': 0, '7E:43A0': null }), unknown).handled, true);
  assert.deepEqual(run(source({ '0E28': 1, '0D20': 1 }), unknown), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDEAC });
});

test('Later unknown reads discard all earlier helper/body plans, preserving previously known scratch', () => {
  for (const [value, overrides, expected] of [
    [4, { '0D78': null }, { reason: 'slot_motion_source_required', field: '0D78' }],
    [0, { '0DD0': null }, { reason: 'slot_motion_source_required', field: '0DD0' }],
  ]) {
    const data = fixture(value), slots = make(source(overrides), data);
    assert.equal(slots.stepMotionHelper8133(0).handled, true);
    const before = slots.snapshot(), bytes = data.snapshot();
    assert.deepEqual(slots.stepMotion(0), { handled: false, ...expected });
    assert.deepEqual(slots.snapshot(), before); assert.deepEqual(data.snapshot(), bytes);
  }
});

test('Missing helper fields/bytes, outside-window records and cyclic lists remain atomic; explicit hydration resumes the same manual operation', () => {
  const data = createSlotMotionData(), slots = make(source(), data);
  let before = slots.snapshot();
  assert.deepEqual(slots.stepMotion(0), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDEAC }); assert.deepEqual(slots.snapshot(), before);
  data.seed(0x7EDEAC, Array(512).fill(255)); data.seed(0x7EE0AC, Array(512).fill(255));
  assert.deepEqual(slots.stepMotion(0), { handled: true });
  slots.seedSlotFields(0, source()); before = slots.snapshot();
  word(data, 0x7EDEAC, 0); word(data, 0x7EEF3C, 0xFFFF);
  assert.equal(slots.stepMotion(0).reason, 'slot_motion_data_window_required'); assert.deepEqual(slots.snapshot(), before);
  word(data, 0x7EEF3C, 0); word(data, 0x7EE2AC, 1); word(data, 0x7EF79C, 0);
  assert.equal(slots.stepMotion(0).reason, 'slot_motion_data_cycle_required'); assert.deepEqual(slots.snapshot(), before);
  for (const field of ['0ED8', '0E80', '7E:4240', '7E:4298', '7E:42F0', '7E:4348', '7E:43A0']) {
    const candidate = make(source({ [field]: null }), empty()), original = candidate.snapshot();
    assert.deepEqual(candidate.stepMotion(0), { handled: false, reason: 'slot_motion_source_required', field }); assert.deepEqual(candidate.snapshot(), original);
  }
  const fields = source(); delete fields['7E:43A0'];
  assert.deepEqual(run(fields, empty()), { handled: false, reason: 'slot_motion_source_required', field: '7E:43A0' });
  for (const context of [{ motionData: {} }, { motionData: empty() }, { offset: -1 }, { offset: 0, motionData: {} }]) assert.throws(() => prepareSlotMotion(source(), context), /Invalid slot motion helper context/);
});

test('All44 slots commit exact caller/coordinate/6B and shared scratch writes for zero, small, large and forced64 results', () => {
  for (const value of [0, 1, 4, 5, 64, 0xFFFF]) for (let offset = 0; offset <= 0x56; offset += 2) {
    const third = value > 0 && value < 5 ? value * 4 : 0;
    const flags = value === 64 ? 0x4B : 0x48;
    const data = fixture(value, 0);
    if (value === 64) word(data, 0x7FE214, 1); // Actual forced0040 path with low flags3.
    const slots = make(source({ '0ED8': 0, '1458': flags }), data, offset), expected = slots.snapshot(), bytes = data.snapshot();
    assert.deepEqual(slots.stepMotion(offset), { handled: true });
    expected.columns['0E28'][offset / 2] = value < 5 ? 3 : 4;
    expected.columns['1458'][offset / 2] = value < 5 ? flags & 0xFFF7 : flags;
    expected.columns['0F30'][offset / 2] = value < 5 ? 1 : 2;
    expected.columns['0ED8'][offset / 2] = third;
    expected.motionSource.scratchWord6B = third;
    expected.motionSource.helperScratchWords = { ...expected.motionSource.helperScratchWords, '11': 0, '14': 0, '17': 0, '1A': 0, '1D': 0, '20': 0, '23': 0, '29': 0, '2C': 0, '32': 0, '38': 0, '3B': value, '3E': offset, '68': 0 };
    assert.deepEqual(slots.snapshot(), expected); assert.deepEqual(data.snapshot(), bytes);
  }
});

test('Later helper-free and empty-list body paths retain68 and prior scratch appropriately; writeplans do not alias input or state', () => {
  const data = fixture(1), slots = make(source(), data);
  word(data, 0x7EEF3C, 0x10);
  [0, 0, 0, 0xFFFF, 0xFFFF, 101].forEach((v, i) => word(data, 0x7EE2BC + i * 2, v)); word(data, 0x7FE218, 0);
  slots.stepMotion(0); assert.equal(slots.snapshot().motionSource.helperScratchWords['68'], 16);
  slots.seedSlotFields(0, { '0D20': 0 }); const scratch = slots.snapshot().motionSource.helperScratchWords;
  assert.equal(slots.stepMotion(0).handled, true); assert.deepEqual(slots.snapshot().motionSource.helperScratchWords, scratch);
  slots.seedSlotFields(0, { '0D20': 0xFFFF }); word(data, 0x7EDEAC, 0xFFFF);
  slots.stepMotion(0); assert.equal(slots.snapshot().motionSource.helperScratchWords['68'], 16); assert.equal(slots.snapshot().motionSource.helperScratchWords['3B'], 0);
  const fields = source(), before = { ...fields }, plan = run(fields, empty());
  plan.fields['0E28'] = 999; plan.helperScratchWords['11'] = 999; assert.deepEqual(fields, before); assert.equal(run(fields, empty()).helperScratchWords['11'], 0);
});

test('Original252/217 keeps unknown sources atomic; explicit remaining-motion fixture permits a complete body and preserves waits/workspace/heap', async () => {
  const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
  const motionData = createSlotMotionData(), targetData = createSlotTargetData(await load('slot-target-data'));
  const slots = createSlotState({ definitionData: createSlotDefinitions(await load('slot-definitions')), actionData: createSlotActionData(await load('slot-action-data')), targetData, motionData });
  slots.seedTargetPointer(targetData.deriveF3From9D(0x99807E).pointer);
  const parent = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  const ac = createACState(); ac.seed(38, [0, 0]); const state = createScriptState({ byteLength: 0x58, slotState: slots, acState: ac }); state.seed(0x56, [0x38, 0x12]);
  const allocator = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(await load('task-frame-profiles')) });
  const scheduler = createScriptScheduler(await load('scripts'), { frameAllocator: allocator }); scheduler.addTask(0x252, [0, 0, 0, 0, parent.value]);
  visitTailWithState(scheduler, state); sweepWithState(scheduler, state); sweepWithState(scheduler, state);
  const tasks = scheduler.snapshot(), heap = allocator.snapshot(), before = slots.snapshot();
  assert.deepEqual(slots.stepMotion(0x54), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDF8E }); assert.deepEqual(slots.snapshot(), before);
  motionData.seed(0x7EDEAC, Array(512).fill(255)); motionData.seed(0x7EE0AC, Array(512).fill(255));
  // Synthetic remaining-motion words, retaining original flag0061. These
  // are not original scene data or a collision result.
  slots.seedSlotFields(0x54, { '0D78': 0, '0DD0': 1 }); const expected = slots.snapshot();
  assert.deepEqual(slots.stepMotion(0x54), { handled: true });
  expected.columns['0E28'][42] = 330; expected.columns['0DD0'][42] = 0; expected.columns['0F30'][42] = 1077;
  expected.motionSource.scratchWord6B = 272;
  expected.motionSource.helperScratchWords = { ...expected.motionSource.helperScratchWords, '11': 80, '14': 84, '17': 454, '1A': 458, '1D': 68, '20': 73, '23': 2, '29': 224, '2C': 224, '32': 226, '38': 226, '3B': 0, '3E': 84, '68': null };
  assert.deepEqual(slots.snapshot(), expected); assert.deepEqual(scheduler.snapshot(), tasks); assert.deepEqual(allocator.snapshot(), heap);
  assert.deepEqual(tasks.tasks.find(task => task.scriptId === 0x217).wait, { scriptId: 0x217, pc: 54, mask: 1, remaining: 2912, events: 0 });
});
