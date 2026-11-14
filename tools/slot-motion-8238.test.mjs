import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlotMotionData } from '../proof/state/slot-motion-data.mjs';
import { prepareMotionHelper8238 } from '../proof/state/slot-motion-helper-8238.mjs';
import { prepareSlotMotion } from '../proof/state/slot-motion.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createSlotTargetData } from '../proof/state/slot-target-data.mjs';
import { createACState } from '../proof/state/ac-state.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const source = overrides => ({ '7E:40E0': 0, '1458': 0x48, '0E28': 4, '0E80': 4, '0ED8': 0,
  '0D20': 0, '0D78': 0xFFFF, '0DD0': 0, '7E:4240': 0, '7E:4298': 0,
  '7E:42F0': 0, '7E:4348': 0, '7E:43A0': 0, ...overrides });
const word = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const empty = () => {
  const data = createSlotMotionData(); data.seed(0x7EDEAC, Array(512).fill(255)); data.seed(0x7EE0AC, Array(512).fill(255)); return data;
};
const record = (data, offset, height, metadata = 0) => {
  [0, 0, 0, 0xFFFF, 0xFFFF, height].forEach((v, i) => word(data, 0x7EE2AC + offset + i * 2, v));
  word(data, 0x7FE214 + (offset >>> 2), metadata);
};
const chain = (data, index, node, offset, list = 0) => {
  word(data, (list ? 0x7EE0AC : 0x7EDEAC) + index, node);
  word(data, 0x7EEF3C + node, offset); word(data, 0x7EF79C + node, 0xFFFF);
};
const fixture = value => { const data = empty(); chain(data, 0, 0, 0); record(data, 0, value); return data; };
const helper = (fields, motionData, offset = 0) => prepareMotionHelper8238({ offset, fields, motionData });
const run = (fields, motionData, offset = 0) => prepareSlotMotion(fields, { offset, motionData });
const make = (fields, motionData, offset = 0) => {
  const slots = createSlotState({ motionData }); slots.seedSlotFields(offset, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null))); return slots;
};

test('8238 preparation retains exact word wrapping and distinct indices for all65536 words, without writes2C/32', () => {
  const data = empty(), mod = v => Number(v % 65536n);
  for (let value = 0; value <= 0xFFFF; value++) {
    const f = source({ '0E28': value, '0E80': value, '0ED8': value, '7E:4240': 0xFFFF, '7E:4298': value,
      '7E:42F0': value, '7E:4348': 0xFFFE, '7E:43A0': value, '1458': null });
    const q = BigInt(value) / 4n, lowFirst = mod(q + 65535n), highFirst = mod(q + BigInt(value)), lowSecond = highFirst;
    const plan = helper(f, data, 0x54), s = plan.scratchWords;
    assert.equal(plan.handled, true); assert.equal(plan.value, 0); assert.equal(plan.carry, 1);
    assert.deepEqual(s, { '3E': 84, '3B': 0, '1D': Number(q), '20': highFirst, '1A': mod(q + 65534n), '17': lowSecond,
      '29': Math.floor((lowSecond & 0x3C0) / 2), '11': lowFirst, '23': Math.floor((lowFirst & 0x3C0) / 32),
      '38': Math.floor((lowFirst & 0x3C0) / 32) + Math.floor((lowSecond & 0x3C0) / 2),
      '14': highFirst, '26': Math.floor((highFirst & 0x3C0) / 32),
      '2F': Math.floor((highFirst & 0x3C0) / 32) + Math.floor((lowSecond & 0x3C0) / 2) });
  }
});

test('8238 visits2F before38, first list before second, retains forced64 replacement and conditional68 across visits', () => {
  const data = createSlotMotionData(), f = source({ '0E28': 252, '0E80': 252, '7E:4298': 2, '7E:4348': 2, '1458': 3 });
  assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDEAE });
  word(data, 0x7EDEAE, 0xFFFF);
  assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EE0AE });
  word(data, 0x7EE0AE, 0xFFFF);
  assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDEAC });
  word(data, 0x7EDEAC, 0xFFFF); word(data, 0x7EE0AC, 0xFFFF);
  assert.equal(helper(f, data).handled, true); // No reads at8133's index32.
  chain(data, 2, 0, 0); record(data, 0, 100);
  chain(data, 0, 2, 16); record(data, 16, 101, 1);
  const plan = helper(f, data); assert.equal(plan.value, 64); assert.equal(plan.carry, 0); assert.equal(plan.scratchWords['68'], 16);
  chain(data, 0, 4, 32, 1); record(data, 32, 100, 2); word(data, 0x7E0CC2, 0xFFFF);
  assert.equal(helper(f, data).value, 100); // Second list follows the forced64 result.
  word(data, 0x7EDEAC, 0xFFFF); word(data, 0x7EE0AC, 0xFFFF);
  assert.equal(helper(f, data).scratchWords['68'], 0); // No erasure by an empty later index.
});

test('8238 skips duplicate indices and preserves unknown conditional sources with original self/special-slot order', () => {
  const data = createSlotMotionData(); word(data, 0x7EDEAC, 0xFFFF); word(data, 0x7EE0AC, 0xFFFF);
  assert.equal(helper(source({ '7E:4348': 64, '1458': null }), data).handled, true);
  chain(data, 0, 0, 0); word(data, 0x7EE2AC, 2); // Reject on first field, with all later bytes unknown.
  assert.equal(helper(source({ '1458': null }), data).handled, true);
  record(data, 0, 3, 1);
  assert.deepEqual(helper(source({ '1458': null }), data), { handled: false, reason: 'slot_motion_source_required', field: '1458' });
  word(data, 0x7EDEAC, 0xFFFF); chain(data, 0, 0, 0, 1); record(data, 0, 3, 0);
  assert.equal(helper(source({ '1458': null }), data).value, 0); // Self skip avoids unknown0CC2/flags.
  word(data, 0x7FE214, 2);
  assert.deepEqual(helper(source({ '1458': null }), data), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7E0CC2 });
  word(data, 0x7E0CC2, 2);
  assert.deepEqual(helper(source({ '1458': null }), data), { handled: false, reason: 'slot_motion_source_required', field: '1458' });
  word(data, 0x7E0CC2, 4); assert.equal(helper(source({ '1458': null }), data).value, 3);
});

test('8238-only body selects exact three caller branches for all65536 result words using the post-addition second value', () => {
  const data = fixture(0);
  for (let value = 0; value <= 0xFFFF; value++) {
    word(data, 0x7EE2B6, value);
    const plan = run(source(), data), small = value > 0 && value < 5;
    assert.equal(plan.handled, true);
    assert.deepEqual(plan.fields, { '1458': value < 5 ? 0x40 : 0x48, ...(small ? { '0ED8': value * 4, '0DD0': 0 } : { '0ED8': 0, '0DD0': 0 }), '0E80': value < 5 ? 3 : 4, '0F30': value < 5 ? 3 : 4 });
    assert.equal(plan.scratchWord6B, small ? value * 4 : 0);
    assert.equal(plan.helperScratchWords['17'], 0); assert.equal(plan.helperScratchWords['1A'], 0);
    assert.equal(plan.helperScratchWords['11'], 1); assert.equal(plan.helperScratchWords['3B'], value);
    assert.equal(Object.hasOwn(plan.helperScratchWords, '2C'), false);
  }
});

test('All second-motion words retain original carry choice; helper-free paths and the81B4 source boundary require no8238 sources', () => {
  const data = empty();
  for (let motion = 0; motion <= 0xFFFF; motion++) {
    const plan = run(source({ '0E80': 0xFFFF, '0D78': motion }), data);
    assert.equal(plan.handled, true);
    assert.equal(plan.fields['0E80'] ?? 0xFFFF, Number((65535n + BigInt(motion)) % 65536n));
    assert.equal(Object.hasOwn(plan, 'helperScratchWords'), motion !== 0);
  }
  const unknown = createSlotMotionData();
  assert.equal(run(source({ '0D78': 0, '7E:43A0': null }), unknown).handled, true);
  assert.equal(run(source({ '1458': 0, '7E:43A0': null }), unknown).handled, true);
  assert.deepEqual(run(source({ '0E80': 1, '0D78': 1 }), unknown), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDEAC });
  assert.deepEqual(prepareSlotMotion(source()), { handled: false, reason: 'slot_motion_helper_required', requiredHelper: '80:8238' });
});

test('Small8238 results wrap height independently over all65536 old words, replace unknown0DD0 and retain third-axis limits', () => {
  const data = fixture(4);
  for (let old = 0; old <= 0xFFFF; old++) {
    word(data, 0x7EE2B6, (old >>> 2) + 4);
    const plan = run(source({ '0ED8': old, '0DD0': null }), data), expected = Number((BigInt(old) + 16n) % 65536n);
    assert.equal(plan.handled, true); assert.equal(plan.fields['0ED8'], expected); assert.equal(plan.fields['0DD0'], 0);
    assert.equal(plan.scratchWord6B, expected); assert.equal(plan.helperScratchWords['1D'], Math.floor(old / 4));
  }
  for (const value of [0, 5]) {
    word(data, 0x7EE2B6, 100 + value);
    assert.deepEqual(run(source({ '0ED8': 400, '0DD0': null }), data), { handled: false, reason: 'slot_motion_source_required', field: '0DD0' });
  }
  for (const [old, expected] of [[0, 4], [251, 255], [252, 256]]) {
    word(data, 0x7EE2B6, (old >>> 2) + 1);
    assert.equal(run(source({ '0ED8': old, '0DD0': null, '1458': 0x60 }), data).fields['0ED8'], expected);
  }
  word(data, 0x7EE2B6, (253 >>> 2) + 1);
  const continued = run(source({ '0ED8': 253, '1458': 0x60 }), data);
  assert.equal(continued.handled, true); assert.equal(continued.fields['0ED8'], 256); assert.equal(continued.helperScratchWords['1D'], 64);
});

test('Combined8133/8238 plans read earlier height/coordinate/flag effects and preserve exact scratch words for all44 slots', () => {
  for (const first of [0, 1, 4, 5, 64]) for (const second of [0, 1, 4, 5, 64]) for (let offset = 0; offset <= 0x56; offset += 2) {
    const data = empty(), f = source({ '0E28': 8, '0E80': 512, '0D20': 0xFFFF, '1458': 0x4B });
    const height1 = first > 0 && first < 5 ? first * 4 : 0, height2 = height1 + (second > 0 && second < 5 ? second * 4 : 0);
    chain(data, 64, 0, 0); record(data, 0, first === 64 ? 100 : first, first === 64 ? 1 : 0);
    chain(data, 32, 2, 16); record(data, 16, (height1 >>> 2) + (second === 64 ? 100 : second), second === 64 ? 1 : 0);
    const slots = make(f, data, offset), expected = slots.snapshot(), bytes = data.snapshot();
    assert.deepEqual(slots.stepMotion(offset), { handled: true });
    const i = offset / 2, firstPosition = first < 5 ? 7 : 8, secondPosition = second < 5 ? 511 : 512;
    expected.columns['0E28'][i] = firstPosition; expected.columns['0E80'][i] = secondPosition; expected.columns['0ED8'][i] = height2;
    expected.columns['0F30'][i] = Math.floor((firstPosition + secondPosition) / 2);
    expected.columns['1458'][i] = first < 5 && second < 5 ? 0x43 : 0x4B;
    expected.motionSource.scratchWord6B = height2;
    expected.motionSource.helperScratchWords = { ...expected.motionSource.helperScratchWords, '11': Math.floor(firstPosition / 4), '14': Math.floor(firstPosition / 4), '17': 127, '1A': 127,
      '1D': height1 / 4, '20': height1 / 4, '23': 0, '26': 0, '29': 32, '2C': 64, '2F': 32, '32': 64, '38': 32, '3B': second, '3E': offset, '68': 16 };
    assert.deepEqual(slots.snapshot(), expected); assert.deepEqual(data.snapshot(), bytes);
  }
  // An empty second search must retain the first search's conditional68.
  const data = empty(); chain(data, 64, 0, 16); record(data, 16, 1);
  const plan = run(source({ '0E28': 8, '0E80': 512, '0D20': 0xFFFF }), data);
  assert.equal(plan.handled, true); assert.equal(plan.helperScratchWords['68'], 16);
  assert.equal(plan.helperScratchWords['3B'], 0); assert.equal(plan.helperScratchWords['1D'], 1);
  assert.equal(plan.helperScratchWords['2C'], 64); assert.equal(plan.helperScratchWords['32'], 64);
});

test('Standalone8238 preserves8133-only scratch and conditional68 across successive calls, without any slot/6B writes', () => {
  const data = fixture(3), slots = make(source(), data);
  assert.equal(slots.stepMotionHelper8133(0).handled, true);
  const before = slots.snapshot(), f = source(), plan = helper(f, data);
  Object.assign(before.motionSource.helperScratchWords, plan.scratchWords);
  assert.deepEqual(slots.stepMotionHelper8238(0), { handled: true, value: 3, carry: 0 }); assert.deepEqual(slots.snapshot(), before);
  word(data, 0x7EDEAC, 0xFFFF); const retained = slots.snapshot(); retained.motionSource.helperScratchWords['3B'] = 0;
  assert.deepEqual(slots.stepMotionHelper8238(0), { handled: true, value: 0, carry: 1 }); assert.deepEqual(slots.snapshot(), retained);
  const copy = slots.snapshot(); copy.motionSource.helperScratchWords['26'] = 999; assert.equal(slots.snapshot().motionSource.helperScratchWords['26'], 0);
  slots.seedSlotFields(0, { '0E28': 252, '7E:4298': 2 });
  assert.equal(slots.stepMotionHelper8238(0).handled, true);
  assert.equal(slots.snapshot().motionSource.helperScratchWords['26'], 2);
  assert.equal(slots.snapshot().motionSource.helperScratchWords['2F'], 2);
  slots.seedSlotFields(0, { '0E28': 4, '7E:4298': 0 });
  assert.equal(slots.stepMotionHelper8133(0).handled, true);
  assert.equal(slots.snapshot().motionSource.helperScratchWords['26'], 2);
  assert.equal(slots.snapshot().motionSource.helperScratchWords['2F'], 2);
});

test('Second helper missing/window/cycle boundaries discard the complete combined plan and preserve earlier live scratch', () => {
  for (const kind of ['missing-head', 'window', 'cycle', 'missing-metadata', 'missing-next', 'missing-third']) {
    const data = empty(), fields = source({ '0E28': 8, '0E80': 512, '0D20': 0xFFFF, '0ED8': 400 });
    if (kind === 'missing-third') fields['0DD0'] = null;
    const slots = make(fields, data); assert.equal(slots.stepMotionHelper8133(0).handled, true);
    if (kind === 'missing-head') {
      const partial = createSlotMotionData(); word(partial, 0x7EDEEC, 0xFFFF); word(partial, 0x7EE0EC, 0xFFFF);
      const candidate = make(fields, partial), before = candidate.snapshot();
      assert.deepEqual(candidate.stepMotion(0), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDECC });
      assert.deepEqual(candidate.snapshot(), before); continue;
    }
    if (['window', 'cycle', 'missing-metadata', 'missing-next'].includes(kind)) {
      word(data, 0x7EDECC, 0); word(data, 0x7EEF3C, kind === 'window' ? 0xFFFF : 0);
      if (kind !== 'window') {
        [0, 0, 0, 0xFFFF, 0xFFFF, 100].forEach((v, i) => word(data, 0x7EE2AC + i * 2, v));
        if (kind !== 'missing-metadata') word(data, 0x7FE214, 0);
        if (kind !== 'missing-next') word(data, 0x7EF79C, 0);
      }
    }
    const before = slots.snapshot(), bytes = data.snapshot(), response = slots.stepMotion(0);
    const expectedReasons = { window: 'slot_motion_data_window_required', cycle: 'slot_motion_data_cycle_required', 'missing-metadata': 'slot_motion_data_source_required', 'missing-next': 'slot_motion_data_source_required', 'missing-third': 'slot_motion_source_required' };
    assert.equal(response.reason, expectedReasons[kind]); assert.deepEqual(slots.snapshot(), before); assert.deepEqual(data.snapshot(), bytes);
  }
});

test('8238 missing fields follow preparation order; invalid inputs and unsupported slots have no effects', () => {
  const keys = ['0ED8', '7E:43A0', '0E80', '7E:4348', '7E:42F0', '0E28', '7E:4240', '7E:4298'];
  for (let index = 0; index < keys.length; index++) {
    const f = source(Object.fromEntries(keys.slice(index).map(key => [key, null]))), slots = make(f, empty()), before = slots.snapshot();
    assert.deepEqual(slots.stepMotionHelper8238(0), { handled: false, reason: 'slot_motion_source_required', field: keys[index] }); assert.deepEqual(slots.snapshot(), before);
  }
  const slots = make(source(), null), before = slots.snapshot();
  assert.deepEqual(slots.stepMotionHelper8238(0), { handled: false, reason: 'slot_motion_data_source_required' });
  for (const offset of [1, 0x58, 0xFFFF]) assert.deepEqual(slots.stepMotionHelper8238(offset), { handled: false, reason: 'slot_window_required' });
  for (const offset of [-1, 1.5, 0x10000]) assert.throws(() => slots.stepMotionHelper8238(offset), /Invalid slot motion offset/);
  for (const input of [{}, { offset: 0, fields: [] }, { offset: 0, fields: source({ '0ED8': -1 }) }, { offset: 0, fields: source(), motionData: {} }]) assert.throws(() => prepareMotionHelper8238(input), /Invalid/);
  assert.deepEqual(slots.snapshot(), before);
});

test('Helper/body plans copy their inputs; helper-free bodies preserve prior8238-only scratch', () => {
  const data = fixture(3), f = source(), input = { ...f };
  const helperPlan = helper(f, data), bodyPlan = run(f, data);
  helperPlan.scratchWords['26'] = 999; bodyPlan.helperScratchWords['2F'] = 999; bodyPlan.fields['0E80'] = 999;
  assert.deepEqual(f, input); assert.equal(helper(f, data).scratchWords['26'], 0); assert.equal(run(f, data).fields['0E80'], 3);
  const slots = make(f, data); slots.stepMotionHelper8238(0); slots.seedSlotFields(0, { '0D78': 0 }); const scratch = slots.snapshot().motionSource.helperScratchWords;
  assert.deepEqual(slots.stepMotion(0), { handled: true }); assert.deepEqual(slots.snapshot().motionSource.helperScratchWords, scratch);
});

test('Original252/217 keeps both helper source boundaries atomic; a height-only fixture allows both original horizontal motions without task/workspace/heap effects', async () => {
  const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
  const data = createSlotMotionData(), targetData = createSlotTargetData(await load('slot-target-data'));
  const slots = createSlotState({ definitionData: createSlotDefinitions(await load('slot-definitions')), actionData: createSlotActionData(await load('slot-action-data')), targetData, motionData: data });
  slots.seedTargetPointer(targetData.deriveF3From9D(0x99807E).pointer);
  const parent = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  const ac = createACState(); ac.seed(38, [0, 0]); const state = createScriptState({ byteLength: 0x58, slotState: slots, acState: ac }); state.seed(0x56, [0x38, 0x12]);
  const allocator = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(await load('task-frame-profiles')) });
  const scheduler = createScriptScheduler(await load('scripts'), { frameAllocator: allocator }); scheduler.addTask(0x252, [0, 0, 0, 0, parent.value]);
  visitTailWithState(scheduler, state); sweepWithState(scheduler, state); sweepWithState(scheduler, state);
  const tasks = scheduler.snapshot(), heap = allocator.snapshot(), before = slots.snapshot();
  assert.deepEqual(slots.stepMotion(0x54), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDF8E }); assert.deepEqual(slots.snapshot(), before);
  word(data, 0x7EDF8E, 0xFFFF); word(data, 0x7EE18E, 0xFFFF);
  assert.deepEqual(slots.stepMotion(0x54), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDF4E }); assert.deepEqual(slots.snapshot(), before);
  data.seed(0x7EDEAC, Array(512).fill(255)); data.seed(0x7EE0AC, Array(512).fill(255));
  slots.seedSlotFields(0x54, { '0DD0': 1 }); const expected = slots.snapshot();
  assert.deepEqual(slots.stepMotion(0x54), { handled: true });
  expected.columns['0E28'][42] = 330; expected.columns['0E80'][42] = 1496; expected.columns['0DD0'][42] = 0; expected.columns['0F30'][42] = 913;
  expected.motionSource.scratchWord6B = 272;
  expected.motionSource.helperScratchWords = { ...expected.motionSource.helperScratchWords, '11': 80, '14': 84, '17': 372, '1A': 376, '1D': 68, '20': 73, '23': 2, '26': 2, '29': 160, '2C': 224, '2F': 162, '32': 226, '38': 162, '3B': 0, '3E': 84, '68': null };
  assert.deepEqual(slots.snapshot(), expected); assert.deepEqual(scheduler.snapshot(), tasks); assert.deepEqual(allocator.snapshot(), heap);
  assert.deepEqual(tasks.tasks.find(t => t.scriptId === 0x217).wait, { scriptId: 0x217, pc: 54, mask: 1, remaining: 2912, events: 0 });
});
