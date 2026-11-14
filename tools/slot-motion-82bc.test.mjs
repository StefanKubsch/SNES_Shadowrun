import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlotMotionData } from '../proof/state/slot-motion-data.mjs';
import { prepareMotionHelper82BC } from '../proof/state/slot-motion-helper-82bc.mjs';
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

const source = overrides => ({ '7E:40E0': 0, '1458': 0x48, '0E28': 252, '0E80': 252, '0ED8': 400,
  '0D20': 0, '0D78': 0, '0DD0': 4, '7E:4240': 0, '7E:4298': 2,
  '7E:42F0': 0, '7E:4348': 2, '7E:43A0': 0, ...overrides });
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
const helper = (fields, motionData, offset = 0) => prepareMotionHelper82BC({ offset, fields, motionData });
const run = (fields, motionData, offset = 0) => prepareSlotMotion(fields, { offset, motionData });
const make = (fields, motionData, offset = 0) => {
  const slots = createSlotState({ motionData }); slots.seedSlotFields(offset, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null))); return slots;
};

test('82BC prepares every scratch word including35 before search, with exhaustive word wrapping', () => {
  const data = empty(), mod = v => Number(v % 65536n);
  for (let value = 0; value <= 0xFFFF; value++) {
    const q = BigInt(value) / 4n, f = source({ '0E28': value, '0E80': value, '0ED8': value,
      '7E:4240': 0xFFFF, '7E:4298': value, '7E:42F0': value, '7E:4348': 0xFFFE, '7E:43A0': value, '1458': null });
    const lo = mod(q + 65535n), hi = mod(q + BigInt(value)), s2 = mod(q + 65534n);
    const a = Math.floor((lo & 0x3C0) / 32), b = Math.floor((hi & 0x3C0) / 32), c = Math.floor((s2 & 0x3C0) / 2), d = Math.floor((hi & 0x3C0) / 2);
    assert.deepEqual(helper(f, data, 0x54), { handled: true, value: 0, carry: 1, scratchWords: {
      '3E': 84, '3B': 0, '1D': Number(q), '20': hi, '1A': s2, '2C': c, '17': hi, '29': d,
      '11': lo, '23': a, '38': a + d, '14': hi, '26': b, '2F': b + d, '35': b + c, '32': a + c,
    } });
  }
});

test('82BC visits32/38/2F/35 in order and requires both heads per index', () => {
  const data = createSlotMotionData(), f = source();
  for (const index of [32, 0, 2, 34]) for (const base of [0x7EDEAC, 0x7EE0AC]) {
    assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_data_source_required', address: base + index });
    word(data, base + index, 0xFFFF);
  }
  assert.equal(helper(f, data).carry, 1);
});

test('82BC skips every duplicate-index pattern and returns zero/Carry1 after the final CPY skip', () => {
  for (const [xExtent, yExtent, expected] of [[0, 0, [0]], [2, 0, [0, 2]], [0, 2, [32, 0]], [2, 2, [32, 0, 2, 34]]]) {
    const data = createSlotMotionData(), f = source({ '7E:4298': xExtent, '7E:4348': yExtent });
    for (const index of expected) heads(data, index);
    const plan = helper(f, data);
    assert.equal(plan.handled, true); assert.equal(plan.carry, 1); assert.equal(plan.value, 0);
  }
});

test('82BC stops after a nonzero complete index, leaving later heads unknown and35 prepared', () => {
  for (let hit = 0; hit < 4; hit++) {
    const data = createSlotMotionData();
    for (const index of [32, 0, 2, 34].slice(0, hit + 1)) heads(data, index);
    chain(data, [32, 0, 2, 34][hit], 0, 0); record(data, 0, 101);
    const plan = helper(source(), data);
    assert.equal(plan.value, 1); assert.equal(plan.carry, 0); assert.equal(plan.scratchWords['35'], 34);
  }
});

test('82BC finishes all records and both lists before stopping; forced64 can replace100 within one index', () => {
  const data = createSlotMotionData(), f = source({ '1458': 3 });
  chain(data, 32, 0, 0); record(data, 0, 200);
  assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EE0CC });
  word(data, 0x7EF79C, 2); word(data, 0x7EEF3E, 16); word(data, 0x7EF79E, 0xFFFF); record(data, 16, 201, 1);
  word(data, 0x7EE0CC, 0xFFFF);
  const forced = helper(f, data); assert.equal(forced.value, 64); assert.equal(forced.scratchWords['68'], 16);
  chain(data, 32, 4, 32, 1); record(data, 32, 200, 2); word(data, 0x7E0CC2, 0xFFFF);
  assert.equal(helper(f, data).value, 100);
  // Even a positive first-list result cannot conceal missing second-list bytes.
  word(data, 0x7EE0CC, 6);
  assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EEF42 });
});

test('82BC retains conditional flags/self/special reads and rejects records before unknown later fields', () => {
  const data = createSlotMotionData(), f = source({ '1458': null }); heads(data, 32);
  chain(data, 32, 0, 0); word(data, 0x7EE2AC, 66);
  // Other unique indices still needed after this rejected record.
  for (const i of [0, 2, 34]) heads(data, i);
  assert.equal(helper(f, data).value, 0);
  record(data, 0, 101, 1);
  assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_source_required', field: '1458' });
  word(data, 0x7EDECC, 0xFFFF); chain(data, 32, 0, 0, 1); record(data, 0, 101, 0);
  assert.equal(helper(f, data).value, 0); // Self avoids0CC2 and flags.
  word(data, 0x7FE214, 2);
  assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7E0CC2 });
  word(data, 0x7E0CC2, 2);
  assert.deepEqual(helper(f, data), { handled: false, reason: 'slot_motion_source_required', field: '1458' });
  word(data, 0x7E0CC2, 4); assert.equal(helper(f, data).value, 1);
});

test('82BC caller treats all65472 reachable ordinary result words solely by Carry, reading the already updated third coordinate', () => {
  const data = empty(), f = source({ '0ED8': 0xFFFF, '0DD0': 257 });
  chain(data, 32, 0, 0);
  for (let value = 0; value <= 0xFFFF - 64; value++) {
    // The caller's unsigned third>=256 gate bounds ordinary candidates.
    record(data, 0, 64 + value);
    const plan = run(f, data);
    assert.equal(plan.handled, true); assert.equal(plan.fields['0ED8'], value === 0 ? 256 : 0xFFFF);
    assert.equal(plan.fields['0DD0'] ?? 257, value === 0 ? 257 : 0);
    assert.equal(plan.fields['1458'], 0x40); assert.equal(plan.fields['0F30'], 252);
    assert.equal(plan.scratchWord6B, 0xFFFF); assert.equal(plan.helperScratchWords['1D'], 64);
  }
});

test('Every third-motion word preserves gravity, word wrap, unsigned0100 gate and no-call paths', () => {
  const data = empty();
  for (const flags of [0x40, 0x60]) for (let motion = 0; motion <= 0xFFFF; motion++) {
    const adjusted = flags & 0x20 ? (motion + 65535) % 65536 : motion, third = (400 + adjusted) % 65536;
    const f = source({ '1458': flags, '0DD0': motion }), plan = run(f, data);
    assert.equal(plan.handled, true); assert.equal(plan.fields['0ED8'] ?? 400, third < 256 ? 400 : third);
    assert.equal(plan.fields['0DD0'] ?? motion, third < 256 ? 0 : adjusted);
    assert.equal(Object.hasOwn(plan, 'helperScratchWords'), third >= 256 && third !== 400);
  }
  const unknown = createSlotMotionData();
  assert.equal(run(source({ '0DD0': 0, '7E:43A0': null }), unknown).handled, true);
  assert.equal(run(source({ '0ED8': 0, '0DD0': 1, '7E:43A0': null }), unknown).handled, true);
  assert.equal(run(source({ '1458': 0, '7E:43A0': null }), unknown).handled, true);
  assert.deepEqual(prepareSlotMotion(source()), { handled: false, reason: 'slot_motion_helper_required', requiredHelper: '80:82BC' });
});

test('Three-helper plans retain earlier height/flag/coordinate effects for all44 slots', () => {
  for (const first of [0, 1, 4, 5, 64]) for (const second of [0, 1, 4, 5, 64]) for (const thirdHit of [false, true]) for (let offset = 0; offset <= 0x56; offset += 2) {
    const data = empty(), f = source({ '0E28': 8, '0E80': 512, '0D20': 0xFFFF, '0D78': 0xFFFF, '0DD0': 4096,
      '1458': 0x4B, '7E:4298': 0, '7E:4348': 0 });
    const height1 = 400 + (first > 0 && first < 5 ? 4 * first : 0), height2 = height1 + (second > 0 && second < 5 ? 4 * second : 0);
    chain(data, 64, 0, 0); record(data, 0, 100 + (first === 64 ? 100 : first), first === 64 ? 1 : 0);
    chain(data, 32, 2, 16); record(data, 16, (height1 >>> 2) + (second === 64 ? 100 : second), second === 64 ? 1 : 0);
    const thirdUsed = ![first, second].some(value => value > 0 && value < 5);
    // Small horizontal results have already nulled the third motion. On
    // other paths only82BC can reach this high second-list record.
    if (thirdHit && thirdUsed) {
      chain(data, second < 5 ? 32 : 64, 4, 32, 1); record(data, 32, ((height2 + 4096) >>> 2) + 1, 0x100);
      word(data, 0x7EE2D0, (height2 + 4096) >>> 2); word(data, 0x7E0CC2, 0xFFFF);
    }
    const slots = make(f, data, offset), plan = run(f, data, offset), bytes = data.snapshot();
    assert.equal(plan.handled, true); assert.equal(plan.scratchWord6B, height2);
    assert.equal(plan.fields['0E28'], first < 5 ? 7 : 8); assert.equal(plan.fields['0E80'], second < 5 ? 511 : 512);
    assert.equal(plan.fields['1458'], first < 5 && second < 5 ? 0x43 : 0x4B);
    assert.equal(plan.fields['0ED8'] ?? 400, !thirdUsed || thirdHit ? height2 : height2 + 4096);
    assert.equal(plan.fields['0DD0'] ?? 4096, !thirdUsed || thirdHit ? 0 : 4096);
    assert.equal(Object.hasOwn(plan.helperScratchWords, '35'), thirdUsed);
    const expected = slots.snapshot();
    for (const [key, value] of Object.entries(plan.fields)) expected.columns[key][offset / 2] = value;
    expected.motionSource.scratchWord6B = height2;
    Object.assign(expected.motionSource.helperScratchWords, plan.helperScratchWords);
    assert.deepEqual(slots.stepMotion(offset), { handled: true }); assert.deepEqual(slots.snapshot(), expected); assert.deepEqual(data.snapshot(), bytes);
  }
});

test('Missing/window/cyclic82BC sources discard earlier8133/8238 plans and preserve prior live scratch', () => {
  for (const kind of ['metadata', 'next', 'window', 'cycle', 'head', 'second-head']) {
    const data = createSlotMotionData(), f = source({ '0E28': 253, '0E80': 253, '0D20': 0xFFFF, '0D78': 0xFFFF });
    for (const index of [32, 0, 2]) heads(data, index);
    const slots = make(f, data); slots.stepMotionHelper8133(0); slots.stepMotionHelper8238(0);
    // Index34 belongs only to82BC, after all previous helper calls completed.
    if (kind !== 'head') word(data, 0x7EDECE, kind === 'second-head' ? 0xFFFF : 0);
    if (!['head', 'second-head'].includes(kind)) {
      word(data, 0x7EE0CE, 0xFFFF); word(data, 0x7EEF3C, kind === 'window' ? 0xFFFF : 0);
      [0, 0, 0, 0xFFFF, 0xFFFF, 102].forEach((v, i) => word(data, 0x7EE2AC + i * 2, v));
      if (kind !== 'metadata') word(data, 0x7FE214, 0);
      if (kind !== 'next') word(data, 0x7EF79C, kind === 'cycle' ? 0 : 0xFFFF);
    }
    const before = slots.snapshot(), bytes = data.snapshot(), plan = slots.stepMotion(0);
    assert.equal(plan.handled, false);
    assert.equal(plan.reason, kind === 'window' ? 'slot_motion_data_window_required' : kind === 'cycle' ? 'slot_motion_data_cycle_required' : 'slot_motion_data_source_required');
    if (kind === 'head') assert.equal(plan.address, 0x7EDECE);
    if (kind === 'second-head') assert.equal(plan.address, 0x7EE0CE);
    assert.deepEqual(slots.snapshot(), before); assert.deepEqual(data.snapshot(), bytes);
  }
});

test('Standalone82BC commits exact scratch only, retains68 on empty searches, and earlier helpers retain35', () => {
  const data = empty(), f = source(), slots = make(f, data); chain(data, 32, 0, 16); record(data, 16, 101);
  const expected = slots.snapshot(); Object.assign(expected.motionSource.helperScratchWords, helper(f, data).scratchWords);
  assert.deepEqual(slots.stepMotionHelper82BC(0), { handled: true, value: 1, carry: 0 }); assert.deepEqual(slots.snapshot(), expected);
  word(data, 0x7EDECC, 0xFFFF); assert.equal(slots.stepMotionHelper82BC(0).value, 0);
  assert.equal(slots.snapshot().motionSource.helperScratchWords['68'], 16);
  slots.stepMotionHelper8133(0); slots.stepMotionHelper8238(0);
  assert.equal(slots.snapshot().motionSource.helperScratchWords['35'], 34);
  const before = slots.snapshot(); slots.seedSlotFields(0, { '0DD0': 0 }); const scratch = slots.snapshot().motionSource.helperScratchWords;
  slots.stepMotion(0); assert.deepEqual(slots.snapshot().motionSource.helperScratchWords, scratch);
  const copy = slots.snapshot(); copy.motionSource.helperScratchWords['35'] = 999;
  assert.equal(slots.snapshot().motionSource.helperScratchWords['35'], before.motionSource.helperScratchWords['35']);
});

test('82BC preparation order, missing providers, invalid inputs and unsupported slots preserve state', () => {
  const keys = ['0ED8', '7E:43A0', '0E80', '7E:4348', '7E:42F0', '0E28', '7E:4240', '7E:4298'];
  for (let i = 0; i < keys.length; i++) {
    const f = source(Object.fromEntries(keys.slice(i).map(key => [key, null]))), slots = make(f, empty()), before = slots.snapshot();
    assert.deepEqual(slots.stepMotionHelper82BC(0), { handled: false, reason: 'slot_motion_source_required', field: keys[i] }); assert.deepEqual(slots.snapshot(), before);
  }
  const slots = make(source(), null), before = slots.snapshot();
  assert.deepEqual(slots.stepMotionHelper82BC(0), { handled: false, reason: 'slot_motion_data_source_required' });
  for (const offset of [1, 0x58, 0xFFFF]) assert.deepEqual(slots.stepMotionHelper82BC(offset), { handled: false, reason: 'slot_window_required' });
  for (const offset of [-1, 1.5, 0x10000]) assert.throws(() => slots.stepMotionHelper82BC(offset), /Invalid slot motion offset/);
  for (const input of [{}, { offset: 0, fields: [] }, { offset: 0, fields: source({ '0ED8': -1 }) }, { offset: 0, fields: source(), motionData: {} }]) assert.throws(() => prepareMotionHelper82BC(input), /Invalid/);
  assert.deepEqual(slots.snapshot(), before);
  const f = source(), original = { ...f }, plan = helper(f, empty()); plan.scratchWords['35'] = 999;
  assert.deepEqual(f, original); assert.equal(helper(f, empty()).scratchWords['35'], 34);
});

test('Original252/217 completes all three motion helpers on explicit synthetic heads with unchanged tasks/workspace/heap', async () => {
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
  data.seed(0x7EDEAC, Array(512).fill(255)); data.seed(0x7EE0AC, Array(512).fill(255)); const bytes = data.snapshot();
  const expected = slots.snapshot(); assert.deepEqual(slots.stepMotion(0x54), { handled: true });
  Object.assign(expected.motionSource, { scratchWord6B: 272, helperScratchWords: { '11': 80, '14': 84, '17': 372, '1A': 376, '1D': 431, '20': 436,
    '23': 2, '26': 2, '29': 160, '2C': 160, '2F': 162, '32': 162, '35': 162, '38': 162, '3B': 0, '3E': 84, '68': null } });
  for (const [field, value] of Object.entries({ '0E28': 330, '0E80': 1496, '0ED8': 1725, '0DD0': 1453, '0F30': 913 })) expected.columns[field][42] = value;
  assert.deepEqual(slots.snapshot(), expected); assert.deepEqual(data.snapshot(), bytes); assert.deepEqual(scheduler.snapshot(), tasks); assert.deepEqual(allocator.snapshot(), heap);
});
