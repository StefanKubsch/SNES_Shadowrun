import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlotMotionData } from '../proof/state/slot-motion-data.mjs';
import { prepareMotionHelper81B4 } from '../proof/state/slot-motion-helper-81b4.mjs';
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

const source = overrides => ({ '7E:40E0': 0, '1458': 0x48, '0E28': 4, '0E80': 3, '0ED8': 0,
  '0D20': 0, '0D78': 1, '0DD0': 0, '7E:4240': 0, '7E:4298': 0,
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
const helper = (fields, motionData, offset = 0) => prepareMotionHelper81B4({ offset, fields, motionData });
const run = (fields, motionData, offset = 0) => prepareSlotMotion(fields, { offset, motionData });
const make = (fields, motionData, offset = 0) => {
  const slots = createSlotState({ motionData }); slots.seedSlotFields(offset, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null))); return slots;
};

const heads = (data, index) => { word(data, 0x7EDEAC + index, 0xFFFF); word(data, 0x7EE0AC + index, 0xFFFF); };

test('81B4 preparation covers65536 coordinates/extents with independent word arithmetic and no29/2F/38 writes', () => {
  const data = empty(), mod = v => Number(v % 65536n);
  for (let value = 0; value <= 0xFFFF; value++) {
    const q = BigInt(value) / 4n, low = mod(q + 65535n), high = mod(q + BigInt(value)), top = mod(q + 65534n);
    const x = Math.floor((low & 0x3C0) / 32), y = Math.floor((high & 0x3C0) / 32), z = Math.floor((top & 0x3C0) / 2);
    const f = source({ '0E28': value, '0E80': value, '0ED8': value, '7E:4240': 0xFFFF, '7E:4298': value,
      '7E:42F0': value, '7E:4348': 0xFFFE, '7E:43A0': value, '1458': null });
    assert.deepEqual(helper(f, data, 0x54), { handled: true, value: 0, carry: 1, scratchWords: {
      '3E': 84, '3B': 0, '1D': Number(q), '20': high, '17': high, '1A': top, '2C': z,
      '11': low, '23': x, '32': x + z, '14': high, '26': y, '35': y + z,
    } });
  }
});

test('81B4 searches35 before32 and both lists after a first hit; later forced64 and second-list replacements apply', () => {
  const data = createSlotMotionData(), f = source({ '0E28': 252, '0E80': 252, '7E:4298': 2, '7E:4348': 2, '1458': 3 });
  for (const index of [34, 32]) for (const base of [0x7EDEAC, 0x7EE0AC]) {
    assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_data_source_required', address: base + index }); word(data, base + index, 0xFFFF);
  }
  assert.equal(helper(f, data).value, 0); // No8238 index2/0 needed.
  chain(data, 34, 0, 0); record(data, 0, 100);
  chain(data, 32, 2, 16); record(data, 16, 101, 1);
  const plan = helper(f, data); assert.equal(plan.value, 64); assert.equal(plan.carry, 0); assert.equal(plan.scratchWords['68'], 16);
  chain(data, 32, 4, 32, 1); record(data, 32, 100, 2); word(data, 0x7E0CC2, 0xFFFF);
  assert.equal(helper(f, data).value, 100);
});

test('81B4 duplicate skips, conditional reads and68 written before metadata rejection follow original order', () => {
  const data = createSlotMotionData(); heads(data, 0); const f = source({ '1458': null });
  assert.equal(helper(f, data).carry, 1);
  chain(data, 0, 0, 16); word(data, 0x7EE2BC, 2); // Reject first field; later fields remain unknown.
  assert.equal(helper(f, data).value, 0);
  record(data, 16, 3, 1);
  assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_source_required', field: '1458' });
  const rejected = helper(source({ '1458': 0 }), data); assert.equal(rejected.value, 0); assert.equal(rejected.scratchWords['68'], 16);
  word(data, 0x7EDEAC, 0xFFFF); chain(data, 0, 0, 16, 1); record(data, 16, 3, 0);
  assert.equal(helper(f, data).value, 0); // Self skips unknown0CC2 and flags.
  word(data, 0x7FE218, 2);
  assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7E0CC2 });
  word(data, 0x7E0CC2, 2); assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_source_required', field: '1458' });
  word(data, 0x7E0CC2, 4); assert.equal(helper(f, data).value, 3);
});

test('All65536 results apply exact ABAD caller branches using post-addition0E80 and preserving0D78', () => {
  const data = fixture(0);
  for (let value = 0; value <= 0xFFFF; value++) {
    word(data, 0x7EE2B6, value); const plan = run(source(), data), small = value > 0 && value < 5;
    assert.equal(plan.handled, true);
    assert.deepEqual(plan.fields, { '1458': value < 5 ? 0x40 : 0x48, '0ED8': small ? value * 4 : 0, '0DD0': 0, '0E80': value < 5 ? 4 : 3, '0F30': value < 5 ? 4 : 3 });
    assert.equal(plan.scratchWord6B, small ? value * 4 : 0);
    assert.equal(plan.helperScratchWords['17'], 1); assert.equal(plan.helperScratchWords['1A'], 1); assert.equal(plan.helperScratchWords['3B'], value);
    assert.equal(Object.hasOwn(plan.fields, '0D78'), false); assert.equal(Object.hasOwn(plan.helperScratchWords, '29'), false);
  }
});

test('All65536 second-motion words select81B4 or8238 by unsigned additionCarry across the sign boundary', () => {
  const data = empty();
  for (let motion = 0; motion <= 0xFFFF; motion++) {
    const plan = run(source({ '0E80': 1, '0D78': motion }), data);
    assert.equal(plan.handled, true); assert.equal(plan.fields['0E80'] ?? 1, Number((1n + BigInt(motion)) % 65536n));
    assert.equal(Object.hasOwn(plan, 'helperScratchWords'), motion !== 0);
    assert.equal(Object.hasOwn(plan.helperScratchWords ?? {}, '32'), motion > 0 && motion < 0xFFFF);
    assert.equal(Object.hasOwn(plan.helperScratchWords ?? {}, '29'), motion === 0xFFFF);
  }
  const unknown = createSlotMotionData();
  assert.equal(run(source({ '0D78': 0, '7E:43A0': null }), unknown).handled, true);
  assert.equal(run(source({ '1458': 0, '7E:43A0': null }), unknown).handled, true);
  assert.deepEqual(prepareSlotMotion(source()), { handled: false, reason: 'slot_motion_helper_required', requiredHelper: '80:81B4' });
});

test('Small81B4 results wrap all65536 old heights and replace unknown0DD0 before gravity and82BC', () => {
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
  word(data, 0x7EE2B6, 64);
  const plan = run(source({ '0ED8': 253, '0DD0': null, '1458': 0x60 }), data);
  assert.equal(plan.handled, true); assert.equal(plan.scratchWord6B, 257); assert.equal(plan.fields['0ED8'], 256);
  assert.equal(plan.fields['0DD0'], 0xFFFF); assert.equal(plan.helperScratchWords['1D'], 64);
});

test('Missing/window/cyclic second-index data after first hit leaves complete81B4 helper/body state unchanged', () => {
  for (const kind of ['head', 'second-head', 'record', 'metadata', 'next', 'window', 'cycle']) {
    const data = createSlotMotionData(), f = source({ '0E28': 252, '0E80': 251, '0ED8': 400, '7E:4298': 2, '7E:4348': 2 });
    heads(data, 34); chain(data, 34, 0, 0); record(data, 0, 101);
    if (kind !== 'head') word(data, 0x7EDECC, kind === 'second-head' ? 0xFFFF : 2);
    if (!['head', 'second-head'].includes(kind)) {
      word(data, 0x7EE0CC, 0xFFFF); word(data, 0x7EEF3E, kind === 'window' ? 0xFFFF : 16);
      if (kind !== 'record') [0, 0, 0, 0xFFFF, 0xFFFF, 102].forEach((v, i) => word(data, 0x7EE2BC + i * 2, v));
      if (kind !== 'metadata') word(data, 0x7FE218, 0);
      if (kind !== 'next') word(data, 0x7EF79E, kind === 'cycle' ? 2 : 0xFFFF);
    }
    const slots = make(f, data), before = slots.snapshot(), bytes = data.snapshot();
    const reason = kind === 'window' ? 'slot_motion_data_window_required' : kind === 'cycle' ? 'slot_motion_data_cycle_required' : 'slot_motion_data_source_required';
    assert.equal(slots.stepMotion(0).reason, reason); assert.deepEqual(slots.snapshot(), before);
    // Standalone helper enters with the caller's updated second coordinate.
    slots.seedSlotFields(0, { '0E80': 252 }); const helperBefore = slots.snapshot();
    assert.equal(slots.stepMotionHelper81B4(0).reason, reason); assert.deepEqual(slots.snapshot(), helperBefore); assert.deepEqual(data.snapshot(), bytes);
  }
});

test('Both80B2/81B4/82BC and8133/81B4/82BC propagate earlier callers at all44 slots and25 result combinations', () => {
  for (const positiveFirst of [false, true]) for (const first of [0, 1, 4, 5, 64]) for (const second of [0, 1, 4, 5, 64]) for (const thirdHit of [false, true]) for (let offset = 0; offset <= 0x56; offset += 2) {
    const data = empty(), f = source({ '0E28': 8, '0E80': 252, '0ED8': 400, '0D20': positiveFirst ? 1 : 0xFFFF, '0D78': 4, '0DD0': 4096, '1458': 0x4B });
    const h1 = 400 + (first > 0 && first < 5 ? first * 4 : 0), h2 = h1 + (second > 0 && second < 5 ? second * 4 : 0);
    chain(data, 0, 0, 0); record(data, 0, 100 + (first === 64 ? 100 : first), first === 64 ? 1 : 0);
    chain(data, 32, 2, 16); record(data, 16, (h1 >>> 2) + (second === 64 ? 100 : second), second === 64 ? 1 : 0);
    const thirdUsed = ![first, second].some(v => v > 0 && v < 5), firstPosition = first < 5 ? positiveFirst ? 9 : 7 : 8, secondPosition = second < 5 ? 256 : 252;
    const index = second < 5 ? 32 : 0, finalHeight = !thirdUsed || thirdHit ? h2 : h2 + 4096;
    if (thirdUsed && thirdHit) {
      chain(data, index, 4, 32, 1); record(data, 32, ((h2 + 4096) >>> 2) + 1, 0x100);
      word(data, 0x7EE2D0, (h2 + 4096) >>> 2); word(data, 0x7E0CC2, 0xFFFF);
    }
    const slots = make(f, data, offset), expected = slots.snapshot(), bytes = data.snapshot();
    assert.deepEqual(slots.stepMotion(offset), { handled: true }); const i = offset / 2;
    Object.entries({ '0E28': firstPosition, '0E80': secondPosition, '0ED8': finalHeight, '0DD0': !thirdUsed || thirdHit ? 0 : 4096,
      '1458': first < 5 && second < 5 ? 0x43 : 0x4B, '0F30': Math.floor((firstPosition + secondPosition) / 2) }).forEach(([k, v]) => { expected.columns[k][i] = v; });
    expected.motionSource.scratchWord6B = h2;
    const quarter = Math.floor(firstPosition / 4), heightQuarter = thirdUsed ? (h2 + 4096) / 4 : h1 / 4;
    expected.motionSource.helperScratchWords = { '11': quarter, '14': quarter, '17': thirdUsed ? Math.floor(secondPosition / 4) : 64, '1A': thirdUsed ? Math.floor(secondPosition / 4) : 64,
      '1D': heightQuarter, '20': heightQuarter, '23': 0, '26': 0, '29': thirdUsed ? index : 0, '2C': thirdUsed ? index : 32,
      '2F': thirdUsed ? index : positiveFirst ? 0 : null, '32': thirdUsed ? index : 32, '35': thirdUsed ? index : 32,
      '38': thirdUsed ? index : positiveFirst ? null : 0, '3B': thirdUsed ? thirdHit ? 1 : 0 : second, '3E': offset, '68': 16 };
    assert.deepEqual(slots.snapshot(), expected); assert.deepEqual(data.snapshot(), bytes);
  }
});

test('Missing81B4 after earlier8133, later82BC reads and unknown body fields preserve all earlier live scratch', () => {
  const data = createSlotMotionData(); heads(data, 0); heads(data, 32);
  const f = source({ '0E28': 252, '0E80': 251, '0ED8': 400, '0D20': 0xFFFF, '7E:4298': 2, '7E:4348': 2 });
  const slots = make(f, data); assert.equal(slots.stepMotionHelper8133(0).handled, true); const before = slots.snapshot();
  assert.deepEqual(slots.stepMotion(0), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDECE }); assert.deepEqual(slots.snapshot(), before);
  const later = createSlotMotionData(); heads(later, 34); heads(later, 32);
  const candidate = make({ ...f, '0D20': 0, '0DD0': 4 }, later); assert.equal(candidate.stepMotionHelper81B4(0).handled, true); const saved = candidate.snapshot();
  assert.deepEqual(candidate.stepMotion(0), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDEAC }); assert.deepEqual(candidate.snapshot(), saved);
  for (const field of ['0D78', '0DD0']) {
    const unknown = make(source({ [field]: null }), empty()); unknown.stepMotionHelper81B4(0); const state = unknown.snapshot();
    assert.deepEqual(unknown.stepMotion(0), { handled: false, reason: 'slot_motion_source_required', field }); assert.deepEqual(unknown.snapshot(), state);
  }
  const open = make(source({ '7E:40E0': 1 }), empty()), state = open.snapshot();
  assert.deepEqual(open.stepMotion(0), { handled: false, reason: 'slot_motion_source_required', field: '7E:4138' }); assert.deepEqual(open.snapshot(), state);
});

test('Standalone81B4 preserves prior29/2F/38 and conditional68; subsequent helpers retain35 and helper-free body retains all', () => {
  const data = empty(), f = source({ '0E28': 252, '0E80': 252, '7E:4298': 2, '7E:4348': 2 }), slots = make(f, data);
  slots.stepMotionHelper80B2(0); slots.stepMotionHelper8238(0); const before = slots.snapshot();
  Object.assign(before.motionSource.helperScratchWords, helper(f, data).scratchWords);
  assert.deepEqual(slots.stepMotionHelper81B4(0), { handled: true, value: 0, carry: 1 }); assert.deepEqual(slots.snapshot(), before);
  assert.deepEqual(['29', '2F', '38'].map(k => before.motionSource.helperScratchWords[k]), [0, 2, 0]);
  chain(data, 34, 0, 16); record(data, 16, 1, 1); // Flags48 reject metadata, but68 is still written.
  assert.equal(slots.stepMotionHelper81B4(0).value, 0); assert.equal(slots.snapshot().motionSource.helperScratchWords['68'], 16);
  word(data, 0x7EDECE, 0xFFFF); slots.stepMotionHelper81B4(0); assert.equal(slots.snapshot().motionSource.helperScratchWords['68'], 16);
  slots.stepMotionHelper8133(0); slots.stepMotionHelper8238(0); assert.equal(slots.snapshot().motionSource.helperScratchWords['35'], 34);
  slots.seedSlotFields(0, { '0D78': 0 }); const scratch = slots.snapshot().motionSource.helperScratchWords;
  assert.equal(slots.stepMotion(0).handled, true); assert.deepEqual(slots.snapshot().motionSource.helperScratchWords, scratch);
});

test('81B4 source order, invalid inputs, unsupported slots and input/snapshot copies preserve state', () => {
  const keys = ['0ED8', '7E:43A0', '0E80', '7E:42F0', '7E:4348', '0E28', '7E:4240', '7E:4298'];
  for (let i = 0; i < keys.length; i++) {
    const f = source(Object.fromEntries(keys.slice(i).map(k => [k, null]))), slots = make(f, empty()), before = slots.snapshot();
    assert.deepEqual(slots.stepMotionHelper81B4(0), { handled: false, reason: 'slot_motion_source_required', field: keys[i] }); assert.deepEqual(slots.snapshot(), before);
  }
  const slots = make(source(), null), before = slots.snapshot();
  assert.deepEqual(slots.stepMotionHelper81B4(0), { handled: false, reason: 'slot_motion_data_source_required' });
  for (const offset of [1, 0x58, 0xFFFF]) assert.deepEqual(slots.stepMotionHelper81B4(offset), { handled: false, reason: 'slot_window_required' });
  for (const offset of [-1, 1.5, 0x10000]) assert.throws(() => slots.stepMotionHelper81B4(offset), /Invalid slot motion offset/);
  for (const input of [{}, { offset: 0, fields: [] }, { offset: 0, fields: source({ '0ED8': -1 }) }, { offset: 0, fields: source(), motionData: {} }]) assert.throws(() => prepareMotionHelper81B4(input), /Invalid/);
  assert.deepEqual(slots.snapshot(), before);
  const f = source(), input = { ...f }, hp = helper(f, empty()), bp = run(f, empty()); hp.scratchWords['35'] = 999; bp.fields['0E80'] = 999;
  assert.deepEqual(f, input); assert.equal(helper(f, empty()).scratchWords['35'], 0); assert.equal(run(f, empty()).fields['0E80'], 4);
  const known = make(f, empty()); known.stepMotionHelper81B4(0); const copy = known.snapshot(); copy.motionSource.helperScratchWords['35'] = 999;
  assert.equal(known.snapshot().motionSource.helperScratchWords['35'], 0);
});

test('Original252/217 runs81B4/82BC with explicit second-motion fixture and either first helper without task/workspace/heap effects', async () => {
  const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
  for (const positiveFirst of [false, true]) {
    const data = createSlotMotionData(), targetData = createSlotTargetData(await load('slot-target-data'));
    const slots = createSlotState({ definitionData: createSlotDefinitions(await load('slot-definitions')), actionData: createSlotActionData(await load('slot-action-data')), targetData, motionData: data });
    slots.seedTargetPointer(targetData.deriveF3From9D(0x99807E).pointer);
    const parent = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
    const ac = createACState(); ac.seed(38, [0, 0]); const state = createScriptState({ byteLength: 0x58, slotState: slots, acState: ac }); state.seed(0x56, [0x38, 0x12]);
    const allocator = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(await load('task-frame-profiles')) });
    const scheduler = createScriptScheduler(await load('scripts'), { frameAllocator: allocator }); scheduler.addTask(0x252, [0, 0, 0, 0, parent.value]);
    visitTailWithState(scheduler, state); sweepWithState(scheduler, state); sweepWithState(scheduler, state);
    slots.seedSlotFields(0x54, { '0D78': 4, ...(positiveFirst ? { '0D20': 4 } : {}) }); // Explicit synthetic motions, not original scene data.
    const tasks = scheduler.snapshot(), heap = allocator.snapshot(), expected = slots.snapshot();
    assert.deepEqual(slots.stepMotion(0x54), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDF8E }); assert.deepEqual(slots.snapshot(), expected);
    data.seed(0x7EDEAC, Array(512).fill(255)); data.seed(0x7EE0AC, Array(512).fill(255)); const bytes = data.snapshot();
    assert.deepEqual(slots.stepMotion(0x54), { handled: true });
    Object.entries({ '0E28': positiveFirst ? 488 : 330, '0E80': 1828, '0ED8': 1725, '0DD0': 1453, '0F30': positiveFirst ? 1158 : 1079 }).forEach(([k, v]) => { expected.columns[k][42] = v; });
    expected.motionSource.scratchWord6B = 272;
    expected.motionSource.helperScratchWords = { '11': positiveFirst ? 120 : 80, '14': positiveFirst ? 124 : 84, '17': 455, '1A': 459, '1D': 431, '20': 436,
      '23': 2, '26': 2, '29': 224, '2C': 224, '2F': 226, '32': 226, '35': 226, '38': 226, '3B': 0, '3E': 84, '68': null };
    assert.deepEqual(slots.snapshot(), expected); assert.deepEqual(data.snapshot(), bytes); assert.deepEqual(scheduler.snapshot(), tasks); assert.deepEqual(allocator.snapshot(), heap);
  }
});
