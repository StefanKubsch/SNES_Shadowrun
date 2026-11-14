import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareMotionHelper80B2 } from '../proof/state/slot-motion-helper-80b2.mjs';
import { prepareSlotMotion } from '../proof/state/slot-motion.mjs';
import { createSlotMotionData } from '../proof/state/slot-motion-data.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createSlotTargetData } from '../proof/state/slot-target-data.mjs';
import { createACState } from '../proof/state/ac-state.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const source = overrides => ({ '7E:40E0': 0, '1458': 0x48, '0E28': 3, '0E80': 0, '0ED8': 400,
  '0D20': 1, '0D78': 0, '0DD0': 0, '7E:4240': 0, '7E:4298': 0,
  '7E:42F0': 0, '7E:4348': 0, '7E:43A0': 0, ...overrides });
const word = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const heads = (data, index) => { word(data, 0x7EDEAC + index, 0xFFFF); word(data, 0x7EE0AC + index, 0xFFFF); };
const empty = () => { const data = createSlotMotionData(); data.seed(0x7EDEAC, Array(512).fill(255)); data.seed(0x7EE0AC, Array(512).fill(255)); return data; };
const record = (data, offset, height, metadata = 0) => {
  [0, 0, 0, 0xFFFF, 0xFFFF, height].forEach((v, i) => word(data, 0x7EE2AC + offset + i * 2, v));
  word(data, 0x7FE214 + (offset >>> 2), metadata);
};
const chain = (data, index, node, offset, list = 0) => {
  word(data, (list ? 0x7EE0AC : 0x7EDEAC) + index, node);
  word(data, 0x7EEF3C + node, offset); word(data, 0x7EF79C + node, 0xFFFF);
};
const fixture = (value, height = 400) => { const data = empty(); chain(data, 0, 0, 0); record(data, 0, (height >>> 2) + value); return data; };
const helper = (fields, motionData, offset = 0) => prepareMotionHelper80B2({ offset, fields, motionData });
const run = (fields, motionData, offset = 0) => prepareSlotMotion(fields, { offset, motionData });
const make = (fields, motionData, offset = 0) => {
  const slots = createSlotState({ motionData }); slots.seedSlotFields(offset, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null))); return slots;
};

test('80B2 word preparation covers65536 coordinates/extents independently, without23/32/38 writes', () => {
  const data = empty(), mod = v => Number(v % 65536n);
  for (let value = 0; value <= 0xFFFF; value++) {
    const q = BigInt(value) / 4n, high = mod(q + BigInt(value)), low = mod(q + 65535n), secondHigh = mod(q + 65534n);
    const x = Math.floor((high & 0x3C0) / 32), y = Math.floor((high & 0x3C0) / 2), z = Math.floor((secondHigh & 0x3C0) / 2);
    const f = source({ '0E28': value, '0E80': value, '0ED8': value, '7E:4240': 0xFFFF, '7E:4298': value,
      '7E:42F0': value, '7E:4348': 0xFFFE, '7E:43A0': value, '1458': null });
    assert.deepEqual(helper(f, data, 0x54), { handled: true, value: 0, carry: 1, scratchWords: {
      '3E': 84, '3B': 0, '1D': Number(q), '20': high, '11': low, '14': high, '26': x,
      '17': high, '29': y, '2F': x + y, '1A': secondHigh, '2C': z, '35': x + z,
    } });
  }
});

test('80B2 visits35 before2F and both lists even after a first hit; second index can replace100 with64', () => {
  const data = createSlotMotionData(), f = source({ '0E28': 252, '0E80': 252, '7E:4298': 2, '7E:4348': 2, '1458': 3 });
  for (const index of [34, 2]) for (const base of [0x7EDEAC, 0x7EE0AC]) {
    assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_data_source_required', address: base + index }); word(data, base + index, 0xFFFF);
  }
  assert.equal(helper(f, data).value, 0); // No8133 index32/0 bytes needed.
  chain(data, 34, 0, 0); record(data, 0, 200);
  chain(data, 2, 2, 16); record(data, 16, 201, 1);
  const plan = helper(f, data); assert.equal(plan.value, 64); assert.equal(plan.carry, 0); assert.equal(plan.scratchWords['68'], 16);
  chain(data, 2, 4, 32, 1); record(data, 32, 200, 2); word(data, 0x7E0CC2, 0xFFFF);
  assert.equal(helper(f, data).value, 100); // Second list also runs after forced64.
});

test('80B2 skips duplicate indices and preserves conditional self/special/flags read order', () => {
  const data = createSlotMotionData(); heads(data, 0);
  const f = source({ '1458': null }); assert.equal(helper(f, data).carry, 1);
  chain(data, 0, 0, 0); word(data, 0x7EE2AC, 1); // Reject first field; later fields remain unknown.
  assert.equal(helper(f, data).value, 0);
  record(data, 0, 101, 1);
  assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_source_required', field: '1458' });
  word(data, 0x7EDEAC, 0xFFFF); chain(data, 0, 0, 0, 1); record(data, 0, 101, 0);
  assert.equal(helper(f, data).value, 0); // Self skips unknown0CC2/flags.
  word(data, 0x7FE214, 2);
  assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7E0CC2 });
  word(data, 0x7E0CC2, 2); assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_source_required', field: '1458' });
  word(data, 0x7E0CC2, 4); assert.equal(helper(f, data).value, 1);
});

test('All65536 result words select exact AB56 caller reactions using the post-addition first coordinate', () => {
  const data = fixture(0, 0), f = source({ '0ED8': 0 });
  for (let value = 0; value <= 0xFFFF; value++) {
    word(data, 0x7EE2B6, value); const plan = run(f, data), height = value > 0 && value < 5 ? value * 4 : 0;
    assert.equal(plan.handled, true); assert.equal(plan.fields['0E28'], value < 5 ? 4 : 3);
    assert.equal(plan.fields['1458'], value < 5 ? 0x40 : 0x48); assert.equal(plan.fields['0F30'], value < 5 ? 2 : 1);
    assert.equal(plan.fields['0ED8'], height); assert.equal(plan.fields['0DD0'], 0); assert.equal(plan.scratchWord6B, height);
    assert.equal(plan.helperScratchWords['11'], 1); assert.equal(plan.helperScratchWords['14'], 1);
    assert.equal(plan.helperScratchWords['3B'], value); assert.equal(plan.helperScratchWords['68'], 0);
    assert.equal(Object.hasOwn(plan.helperScratchWords, '23'), false); assert.equal(Object.hasOwn(plan.fields, '0D20'), false);
  }
});

test('All65536 first-motion words use unsigned additionCarry, selecting80B2 or8133 across the sign boundary', () => {
  const data = empty();
  for (let motion = 0; motion <= 0xFFFF; motion++) {
    const plan = run(source({ '0E28': 1, '0D20': motion }), data);
    assert.equal(plan.handled, true); assert.equal(plan.fields['0E28'] ?? 1, Number((1n + BigInt(motion)) % 65536n));
    assert.equal(Object.hasOwn(plan, 'helperScratchWords'), motion !== 0);
    assert.equal(Object.hasOwn(plan.helperScratchWords ?? {}, '35'), motion > 0 && motion < 0xFFFF);
    assert.equal(Object.hasOwn(plan.helperScratchWords ?? {}, '23'), motion === 0xFFFF);
  }
  const unknown = createSlotMotionData();
  assert.equal(run(source({ '0D20': 0, '7E:43A0': null }), unknown).handled, true);
  assert.equal(run(source({ '1458': 0, '7E:43A0': null }), unknown).handled, true);
  assert.deepEqual(prepareSlotMotion(source()), { handled: false, reason: 'slot_motion_helper_required', requiredHelper: '80:80B2' });
});

test('Small80B2 results wrap all65536 old heights and replace unknown third motion before gravity/82BC', () => {
  const data = fixture(4);
  for (let old = 0; old <= 0xFFFF; old++) {
    word(data, 0x7EE2B6, (old >>> 2) + 4);
    const plan = run(source({ '0ED8': old, '0DD0': null }), data), expected = Number((BigInt(old) + 16n) % 65536n);
    assert.equal(plan.handled, true); assert.equal(plan.fields['0ED8'], expected); assert.equal(plan.fields['0DD0'], 0);
    assert.equal(plan.scratchWord6B, expected); assert.equal(plan.helperScratchWords['1D'], Math.floor(old / 4));
  }
  for (const value of [0, 5]) {
    word(data, 0x7EE2B6, 100 + value);
    assert.deepEqual(run(source({ '0DD0': null }), data), { handled: false, reason: 'slot_motion_source_required', field: '0DD0' });
  }
  word(data, 0x7EE2B6, 64);
  const plan = run(source({ '0ED8': 253, '0DD0': null, '1458': 0x60 }), data);
  assert.equal(plan.handled, true); assert.equal(plan.scratchWord6B, 257); assert.equal(plan.fields['0ED8'], 256);
  assert.equal(plan.fields['0DD0'], 0xFFFF); assert.equal(plan.helperScratchWords['1D'], 64); //82BC observes256 and returns0.
});

test('Missing/window/cyclic second-index data after a first hit leaves all body/helper writes uncommitted', () => {
  for (const kind of ['head', 'second-head', 'record', 'metadata', 'next', 'window', 'cycle']) {
    const data = createSlotMotionData(), f = source({ '0E28': 251, '0E80': 252, '7E:4298': 2, '7E:4348': 2 });
    heads(data, 34); chain(data, 34, 0, 0); record(data, 0, 101);
    if (kind !== 'head') word(data, 0x7EDEAE, kind === 'second-head' ? 0xFFFF : 2);
    if (!['head', 'second-head'].includes(kind)) {
      word(data, 0x7EE0AE, 0xFFFF);
      word(data, 0x7EEF3E, kind === 'window' ? 0xFFFF : 16);
      if (kind !== 'record') [0, 0, 0, 0xFFFF, 0xFFFF, 102].forEach((v, i) => word(data, 0x7EE2BC + i * 2, v));
      if (kind !== 'metadata') word(data, 0x7FE218, 0);
      if (kind !== 'next') word(data, 0x7EF79E, kind === 'cycle' ? 2 : 0xFFFF);
    }
    const slots = make(f, data), before = slots.snapshot(), bytes = data.snapshot();
    const expected = { handled: false, reason: kind === 'window' ? 'slot_motion_data_window_required' : kind === 'cycle' ? 'slot_motion_data_cycle_required' : 'slot_motion_data_source_required' };
    for (const response of [slots.stepMotion(0), slots.stepMotionHelper80B2(0)]) {
      assert.equal(response.handled, false); assert.equal(response.reason, expected.reason);
      if (kind === 'head') assert.equal(response.address, 0x7EDEAE);
      if (kind === 'second-head') assert.equal(response.address, 0x7EE0AE);
    }
    assert.deepEqual(slots.snapshot(), before); assert.deepEqual(data.snapshot(), bytes);
  }
});

test('80B2/8238/82BC retain coordinate/height/flags from earlier callers at all44 slots and25 result combinations', () => {
  for (const first of [0, 1, 4, 5, 64]) for (const second of [0, 1, 4, 5, 64]) for (const thirdHit of [false, true]) for (let offset = 0; offset <= 0x56; offset += 2) {
    const data = empty(), f = source({ '0E28': 6, '0E80': 512, '0D78': 0xFFFF, '0DD0': 4096, '1458': 0x4B });
    const h1 = 400 + (first > 0 && first < 5 ? first * 4 : 0), h2 = h1 + (second > 0 && second < 5 ? second * 4 : 0);
    chain(data, 64, 0, 0); record(data, 0, 100 + (first === 64 ? 100 : first), first === 64 ? 1 : 0);
    chain(data, 32, 2, 16); record(data, 16, (h1 >>> 2) + (second === 64 ? 100 : second), second === 64 ? 1 : 0);
    const thirdUsed = ![first, second].some(v => v > 0 && v < 5), finalHeight = !thirdUsed || thirdHit ? h2 : h2 + 4096;
    if (thirdUsed && thirdHit) {
      chain(data, second < 5 ? 32 : 64, 4, 32, 1); record(data, 32, ((h2 + 4096) >>> 2) + 1, 0x100);
      word(data, 0x7EE2D0, (h2 + 4096) >>> 2); word(data, 0x7E0CC2, 0xFFFF);
    }
    const slots = make(f, data, offset), before = slots.snapshot(), bytes = data.snapshot();
    assert.deepEqual(slots.stepMotion(offset), { handled: true }); const after = slots.snapshot(), i = offset / 2;
    assert.equal(after.columns['0E28'][i], first < 5 ? 7 : 6); assert.equal(after.columns['0E80'][i], second < 5 ? 511 : 512);
    assert.equal(after.columns['0ED8'][i], finalHeight); assert.equal(after.columns['0DD0'][i], !thirdUsed || thirdHit ? 0 : 4096);
    assert.equal(after.columns['1458'][i], first < 5 && second < 5 ? 0x43 : 0x4B); assert.equal(after.motionSource.scratchWord6B, h2);
    assert.equal(after.columns['0F30'][i], Math.floor(((first < 5 ? 7 : 6) + (second < 5 ? 511 : 512)) / 2));
    const quarter = thirdUsed ? second < 5 ? 127 : 128 : 127, index = second < 5 ? 32 : 64;
    const heightQuarter = thirdUsed ? (h2 + 4096) / 4 : h1 / 4;
    assert.deepEqual(after.motionSource.helperScratchWords, { '11': 1, '14': 1, '17': quarter, '1A': quarter, '1D': heightQuarter, '20': heightQuarter,
      '23': 0, '26': 0, '29': thirdUsed ? index : 32, '2C': thirdUsed ? index : 64, '2F': thirdUsed ? index : 32,
      '32': thirdUsed ? index : null, '35': thirdUsed ? index : 64, '38': thirdUsed ? index : 32,
      '3B': thirdUsed ? thirdHit ? 1 : 0 : second, '3E': offset, '68': 16 });
    // Copy only independently expected body writes; all other live state is preserved.
    for (const key of ['0E28', '0E80', '0ED8', '0DD0', '1458', '0F30']) before.columns[key][i] = after.columns[key][i];
    before.motionSource = after.motionSource; assert.deepEqual(after, before); assert.deepEqual(data.snapshot(), bytes);
  }
});

test('Later unknown body fields and82BC sources preserve earlier live scratch and discard80B2 plans', () => {
  for (const [overrides, reason, field] of [[{ '0D78': null }, 'slot_motion_source_required', '0D78'], [{ '0DD0': null }, 'slot_motion_source_required', '0DD0']]) {
    const data = empty(), f = source(overrides), slots = make(f, data); slots.stepMotionHelper8133(0); slots.stepMotionHelper80B2(0);
    const before = slots.snapshot(), response = slots.stepMotion(0); assert.equal(response.reason, reason);
    assert.equal(response.field, field);
    assert.deepEqual(slots.snapshot(), before);
  }
  //80B2 only visits34/2;82BC additionally visits32 first.
  const data = createSlotMotionData(), f = source({ '0E28': 251, '0E80': 252, '0DD0': 4, '7E:4298': 2, '7E:4348': 2 });
  heads(data, 34); heads(data, 2); const slots = make(f, data); slots.stepMotionHelper80B2(0); const before = slots.snapshot();
  assert.deepEqual(slots.stepMotion(0), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDECC }); assert.deepEqual(slots.snapshot(), before);
});

test('Standalone80B2 preserves earlier23/32/38 and conditional68; subsequent8133/8238 retain35', () => {
  const data = empty(), slots = make(source({ '0E28': 252, '0E80': 252, '7E:4298': 2, '7E:4348': 2 }), data);
  slots.stepMotionHelper8133(0); const before = slots.snapshot(), plan = helper(source({ '0E28': 252, '0E80': 252, '7E:4298': 2, '7E:4348': 2 }), data);
  Object.assign(before.motionSource.helperScratchWords, plan.scratchWords);
  assert.deepEqual(slots.stepMotionHelper80B2(0), { handled: true, value: 0, carry: 1 }); assert.deepEqual(slots.snapshot(), before);
  assert.equal(before.motionSource.helperScratchWords['23'], 0); assert.equal(before.motionSource.helperScratchWords['32'], 32); assert.equal(before.motionSource.helperScratchWords['38'], 0);
  chain(data, 34, 0, 16); record(data, 16, 101); slots.stepMotionHelper80B2(0); assert.equal(slots.snapshot().motionSource.helperScratchWords['68'], 16);
  word(data, 0x7EDECE, 0xFFFF); slots.stepMotionHelper80B2(0); assert.equal(slots.snapshot().motionSource.helperScratchWords['68'], 16);
  slots.stepMotionHelper8133(0); slots.stepMotionHelper8238(0); assert.equal(slots.snapshot().motionSource.helperScratchWords['35'], 34);
  slots.seedSlotFields(0, { '0D20': 0 }); const scratch = slots.snapshot().motionSource.helperScratchWords; slots.stepMotion(0); assert.deepEqual(slots.snapshot().motionSource.helperScratchWords, scratch);
});

test('80B2 source order, invalid inputs and unsupported slots preserve state; plans and snapshots are copies', () => {
  const keys = ['0ED8', '7E:43A0', '0E28', '7E:4240', '7E:4298', '0E80', '7E:42F0', '7E:4348'];
  for (let i = 0; i < keys.length; i++) {
    const f = source(Object.fromEntries(keys.slice(i).map(key => [key, null]))), slots = make(f, empty()), before = slots.snapshot();
    assert.deepEqual(slots.stepMotionHelper80B2(0), { handled: false, reason: 'slot_motion_source_required', field: keys[i] }); assert.deepEqual(slots.snapshot(), before);
  }
  const slots = make(source(), null), before = slots.snapshot();
  assert.deepEqual(slots.stepMotionHelper80B2(0), { handled: false, reason: 'slot_motion_data_source_required' });
  for (const offset of [1, 0x58, 0xFFFF]) assert.deepEqual(slots.stepMotionHelper80B2(offset), { handled: false, reason: 'slot_window_required' });
  for (const offset of [-1, 1.5, 0x10000]) assert.throws(() => slots.stepMotionHelper80B2(offset), /Invalid slot motion offset/);
  for (const input of [{}, { offset: 0, fields: [] }, { offset: 0, fields: source({ '0ED8': -1 }) }, { offset: 0, fields: source(), motionData: {} }]) assert.throws(() => prepareMotionHelper80B2(input), /Invalid/);
  assert.deepEqual(slots.snapshot(), before);
  const f = source(), input = { ...f }, hp = helper(f, empty()), bp = run(f, empty()); hp.scratchWords['35'] = 999; bp.fields['0E28'] = 999;
  assert.deepEqual(f, input); assert.equal(helper(f, empty()).scratchWords['35'], 0); assert.equal(run(f, empty()).fields['0E28'], 4);
  const known = make(f, empty()); known.stepMotionHelper80B2(0); const copy = known.snapshot(); copy.motionSource.helperScratchWords['35'] = 999;
  assert.equal(known.snapshot().motionSource.helperScratchWords['35'], 0);
});

test('Original252/217 on explicit first-motion fixture runs80B2/8238/82BC without task/workspace/heap effects', async () => {
  const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
  const data = createSlotMotionData(), targetData = createSlotTargetData(await load('slot-target-data'));
  const slots = createSlotState({ definitionData: createSlotDefinitions(await load('slot-definitions')), actionData: createSlotActionData(await load('slot-action-data')), targetData, motionData: data });
  slots.seedTargetPointer(targetData.deriveF3From9D(0x99807E).pointer);
  const parent = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  const ac = createACState(); ac.seed(38, [0, 0]); const state = createScriptState({ byteLength: 0x58, slotState: slots, acState: ac }); state.seed(0x56, [0x38, 0x12]);
  const allocator = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(await load('task-frame-profiles')) });
  const scheduler = createScriptScheduler(await load('scripts'), { frameAllocator: allocator }); scheduler.addTask(0x252, [0, 0, 0, 0, parent.value]);
  visitTailWithState(scheduler, state); sweepWithState(scheduler, state); sweepWithState(scheduler, state);
  slots.seedSlotFields(0x54, { '0D20': 4 }); // Explicit synthetic first motion, not original scene data.
  const tasks = scheduler.snapshot(), heap = allocator.snapshot(), expected = slots.snapshot();
  assert.deepEqual(slots.stepMotion(0x54), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDF8E }); assert.deepEqual(slots.snapshot(), expected);
  data.seed(0x7EDEAC, Array(512).fill(255)); data.seed(0x7EE0AC, Array(512).fill(255)); const bytes = data.snapshot();
  assert.deepEqual(slots.stepMotion(0x54), { handled: true });
  for (const [key, value] of Object.entries({ '0E28': 488, '0E80': 1496, '0ED8': 1725, '0DD0': 1453, '0F30': 992 })) expected.columns[key][42] = value;
  expected.motionSource.scratchWord6B = 272;
  expected.motionSource.helperScratchWords = { '11': 120, '14': 124, '17': 372, '1A': 376, '1D': 431, '20': 436,
    '23': 2, '26': 2, '29': 160, '2C': 160, '2F': 162, '32': 162, '35': 162, '38': 162, '3B': 0, '3E': 84, '68': null };
  assert.deepEqual(slots.snapshot(), expected); assert.deepEqual(data.snapshot(), bytes); assert.deepEqual(scheduler.snapshot(), tasks); assert.deepEqual(allocator.snapshot(), heap);
});
