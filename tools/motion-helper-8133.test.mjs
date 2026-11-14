import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlotMotionData } from '../proof/state/slot-motion-data.mjs';
import { prepareMotionHelper8133 } from '../proof/state/slot-motion-helper-8133.mjs';
import { createSlotState } from '../proof/state/slots.mjs';

const source = overrides => ({ '0E28': 400, '0E80': 400, '0ED8': 400, '1458': 0,
  '7E:4240': 0, '7E:4298': 0, '7E:42F0': 0, '7E:4348': 0, '7E:43A0': 0, ...overrides });
const word = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const empty = () => {
  const data = createSlotMotionData();
  data.seed(0x7EDEAC, Array(512).fill(255));
  data.seed(0x7EE0AC, Array(512).fill(255));
  return data;
};
const record = (data, offset, values, metadata = 0) => {
  values.forEach((value, index) => { if (value !== null) word(data, 0x7EE2AC + offset + index * 2, value); });
  if (metadata !== null) word(data, 0x7FE214 + (offset >>> 2), metadata);
};
const chain = (data, list, entries, index = 0x22) => {
  word(data, (list === 0 ? 0x7EDEAC : 0x7EE0AC) + index, entries.length ? entries[0].node : 0xFFFF);
  entries.forEach((entry, i) => {
    word(data, 0x7EEF3C + entry.node, entry.record);
    word(data, 0x7EF79C + entry.node, entries[i + 1]?.node ?? 0xFFFF);
  });
};
const run = (data, fields = source(), offset = 0x54) => prepareMotionHelper8133({ offset, fields, motionData: data });
const box = height => [90, 90, 90, 110, 110, height];

test('Motion data starts entirely unknown; exact byte seeds preserve odd overlaps and both word-read bytes', () => {
  const data = createSlotMotionData();
  assert.deepEqual(data.snapshot().bytes, []);
  assert.deepEqual(data.readHead(0, 0), { available: false, reason: 'slot_motion_data_source_required', address: 0x7EDEAC });
  data.seed(0x7EDEAC, [0x34]); assert.equal(data.readHead(0, 0).available, false);
  data.seed(0x7EDEAD, [0x12, 0xAB]); assert.deepEqual(data.readHead(0, 0), { available: true, value: 0x1234 });
  assert.deepEqual(data.readHead(0, 1), { available: true, value: 0xAB12 });
  word(data, 0x7EE2AC, 0x1234); word(data, 0x7EE2AD, 0xABCD);
  assert.equal(data.readRecordField(0, 0).value, 0xCD34); assert.equal(data.readRecordField(1, 0).value, 0xABCD);
  word(data, 0x7FE214, 0x5678);
  for (const offset of [0, 1, 2, 3]) assert.equal(data.readMetadata(offset).value, 0x5678);
  data.seed(0x7E0CC2, [0]); assert.equal(data.readSpecialSlot().available, false);
  data.seed(0x7E0CC3, [0x80]); assert.equal(data.readSpecialSlot().value, 0x8000);
  const copy = data.snapshot(); copy.bytes[0][1] = 1; copy.windows[0][0] = 0; assert.notDeepEqual(data.snapshot(), copy);
  const input = [1, 2]; data.seed(0x7EDEB0, input); input[0] = 9; assert.equal(data.readHead(0, 4).value, 513);
});

test('Source provider rejects uncovered banks, high-byte crossings and invalid seeds/indices without partial writes', () => {
  const data = createSlotMotionData(); const before = data.snapshot();
  for (const [address, values] of [[0x81DEAC, [1]], [0x7EFFFF, [1, 2]], [0x7F0000, [1]], [0x7E0CC3, [1, 2]], [0x7EDEAC, [1, undefined]], [0x7EDEAC, Array(2)], [0x7EDEAC, []], [-1, [0]]]) assert.throws(() => data.seed(address, values), /Invalid/);
  assert.deepEqual(data.snapshot(), before);
  for (const value of [-1, 65536, 1.5, undefined, '0']) assert.throws(() => data.readNodeRecord(value), /Invalid/);
  for (const value of [-1, 2, undefined]) assert.throws(() => data.readHead(value, 0), /Invalid/);
  for (const value of [-1, 6, undefined]) assert.throws(() => data.readRecordField(0, value), /Invalid/);
  word(data, 0x7EFFFE, 0x1234); assert.equal(data.readNextNode(0x862).value, 0x1234);
  assert.equal(data.readNextNode(0x863).reason, 'slot_motion_data_window_required');
  assert.equal(data.readNextNode(0x864).reason, 'slot_motion_data_window_required');
  assert.equal(data.readMetadata(0xFFFF).reason, 'slot_motion_data_window_required');
});

test('Every word coordinate/extent wraps before masks and shifts, with independent BigInt preparation and empty sourced heads', () => {
  const data = empty();
  for (let n = 0; n <= 0xFFFF; n++) {
    const fields = source({ '0E28': n, '0E80': n ^ 0xFFFF, '0ED8': n,
      '7E:4240': 0xFFFF, '7E:4298': n, '7E:42F0': 0x8000, '7E:4348': n, '7E:43A0': n });
    const plan = run(data, fields), s = plan.scratchWords;
    const wrap = value => Number(value % 65536n);
    const a = BigInt(n) / 4n, b = BigInt(n ^ 65535) / 4n;
    assert.equal(plan.value, 0); assert.equal(plan.carry, 1); assert.equal(Object.hasOwn(s, '68'), false);
    assert.equal(s['1D'], Number(a)); assert.equal(s['20'], wrap(a + BigInt(n)));
    assert.equal(s['11'], wrap(a + 65535n)); assert.equal(s['14'], wrap(a + BigInt(n)));
    assert.equal(s['17'], wrap(b + 32768n)); assert.equal(s['1A'], wrap(b + BigInt(n)));
    assert.equal(s['23'], Number((BigInt(s['11']) & 960n) / 32n));
    assert.equal(s['29'], Number((BigInt(s['17']) & 960n) / 2n)); assert.equal(s['2C'], Number((BigInt(s['1A']) & 960n) / 2n));
    assert.equal(s['32'], s['23'] | s['2C']); assert.equal(s['38'], s['23'] | s['29']);
  }
});

test('Unsigned overlap inequalities accept equality, short-circuit later missing reads and reject exact one-word boundaries', () => {
  const fields = source(), data = empty(); chain(data, 0, [{ node: 0, record: 0 }]);
  // Every rejection occurs before any missing later field or metadata.
  const order = [0, 3, 1, 4, 2, 5];
  for (let rejected = 0; rejected < order.length; rejected++) {
    const partial = empty(); chain(partial, 0, [{ node: 0, record: 0 }]);
    const values = Array(6).fill(null);
    for (let i = 0; i <= rejected; i++) values[order[i]] = i === rejected ? ([0, 1, 2].includes(order[i]) ? 101 : 99) : 100;
    record(partial, 0, values, null);
    assert.equal(run(partial, fields).value, 0);
  }
  record(data, 0, Array(6).fill(100), 0);
  const result = run(data, fields); assert.equal(result.value, 0); assert.equal(result.carry, 1); assert.equal(result.scratchWords['68'], 0);
  // Word values with bit15 set still participate as unsigned comparisons.
  record(data, 0, [0, 0, 0, 0xFFFF, 0xFFFF, 0xFFFF], 0);
  assert.equal(run(data, fields).value, 0xFFFF - 100);
});

test('First-list metadata0 accepts all candidate words and flags remain unnecessary; borrowed heights do not wrap into success', () => {
  const data = empty(); chain(data, 0, [{ node: 0, record: 0 }]); record(data, 0, [0, 0, 0, 0xFFFF, 0xFFFF, 0], 0);
  const fields = source({ '0ED8': 0, '1458': null });
  for (let value = 0; value <= 0xFFFF; value++) {
    word(data, 0x7EE2B6, value); const plan = run(data, fields);
    assert.equal(plan.value, value); assert.equal(plan.carry, value === 0 ? 1 : 0);
  }
  assert.equal(run(data, source({ '0ED8': 0xFFFF })).value, 0xFFFF - 16383);
  word(data, 0x7EE2B6, 99); assert.equal(run(data).value, 0);
});

test('First-list nonzero metadata needs low flags3 and half-open interiors, replaces the candidate with64 and conditionally writes68', () => {
  const data = empty(); chain(data, 0, [{ node: 0, record: 0 }]); record(data, 0, box(103), 0xFFFF);
  for (let flags = 0; flags <= 0xFFFF; flags++) assert.equal(run(data, source({ '1458': flags })).value, (flags & 3) === 3 ? 64 : 0);
  for (const overrides of [{ '0E28': 440 }, { '0E80': 440 }, { '0E28': 356, '7E:4298': 1 }, { '0E80': 356, '7E:4348': 1 }, { '0ED8': 356, '7E:43A0': 1 }]) assert.equal(run(data, source({ '1458': 3, ...overrides })).value, 0);
  assert.equal(run(data, source({ '1458': 3, '0E28': 360, '0E80': 360, '0ED8': 360 })).value, 64);
  assert.deepEqual(run(data, source({ '1458': null })), { handled: false, reason: 'slot_motion_source_required', field: '1458' });
});

test('Second-list self, special-slot and ordinary metadata take distinct paths, with conditional0CC2/flag knowledge', () => {
  const data = empty(); chain(data, 1, [{ node: 0, record: 0 }]); record(data, 0, box(104), 0x54);
  let result = run(data, source({ '1458': null })); assert.equal(result.value, 0); assert.equal(Object.hasOwn(result.scratchWords, '68'), false);
  word(data, 0x7FE214, 0x56); assert.equal(run(data).reason, 'slot_motion_data_source_required');
  word(data, 0x7E0CC2, 0x56);
  for (let flags = 0; flags <= 0xFFFF; flags++) assert.equal(run(data, source({ '1458': flags })).value, (flags & 3) === 3 ? 0 : 4);
  assert.equal(run(data, source({ '1458': null })).field, '1458');
  word(data, 0x7E0CC2, 0xFFFF); result = run(data, source({ '1458': null })); assert.equal(result.value, 4); assert.equal(result.carry, 0);
});

test('Traversal preserves candidate ties, replacement order, conditional68 and visits first index then a distinct second index', () => {
  const data = empty();
  record(data, 0, box(105), 0); record(data, 0x10, box(105), 1); record(data, 0x20, box(164), 0);
  chain(data, 0, [{ node: 0, record: 0 }, { node: 2, record: 0x10 }, { node: 4, record: 0x20 }]);
  const plan = run(data, source({ '1458': 3 })); assert.equal(plan.value, 64); assert.equal(plan.scratchWords['68'], 0x20);
  // Third candidate64 ties the forced64 and writes68. A smaller candidate
  // must not read missing metadata or update68.
  word(data, 0x7EE2B6 + 0x20, 163); assert.equal(run(data, source({ '1458': 3 })).scratchWords['68'], 0x10);
  word(data, 0x7EE2B6, 200); word(data, 0x7EE2B6 + 0x10, 228);
  // A later accepted special record can reduce100 to64. This is not a
  // simple maximum; candidate128 passes the old threshold before override.
  assert.equal(run(data, source({ '1458': 3 })).value, 64);
  const split = empty(); record(split, 0, [90, 90, 90, 110, 210, 103], 0);
  record(split, 0x10, [90, 90, 90, 110, 210, 102], 0);
  // 17=100 gives38=22;1A=200 gives32=62. Run62 before22.
  chain(split, 0, [{ node: 0, record: 0 }], 0x62); chain(split, 0, [{ node: 2, record: 0x10 }], 0x22);
  const later = run(split, source({ '7E:4348': 100 })); assert.equal(later.value, 3); assert.equal(later.scratchWords['68'], 0);
});

test('Original252/217 wait state, workspace and allocation remain unchanged by explicit helper probes and their synthetic head fixture', async () => {
  const { readFile } = await import('node:fs/promises');
  const { createSlotDefinitions } = await import('../proof/state/slot-definitions.mjs');
  const { createSlotActionData } = await import('../proof/state/slot-action-data.mjs');
  const { createSlotTargetData } = await import('../proof/state/slot-target-data.mjs');
  const { createACState } = await import('../proof/state/ac-state.mjs');
  const { createScriptState } = await import('../proof/state/script-state.mjs');
  const { createScriptScheduler } = await import('../proof/script/scheduler.mjs');
  const { createTaskFrameAllocator, createTaskFrameProfiles } = await import('../proof/script/task-frames.mjs');
  const { visitTailWithState, sweepWithState } = await import('../proof/state/host.mjs');
  const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
  const motionData = createSlotMotionData(), targetData = createSlotTargetData(await load('slot-target-data'));
  const slots = createSlotState({ definitionData: createSlotDefinitions(await load('slot-definitions')), actionData: createSlotActionData(await load('slot-action-data')), targetData, motionData });
  slots.seedTargetPointer(targetData.deriveF3From9D(0x99807E).pointer);
  const parent = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  const ac = createACState(); ac.seed(38, [0, 0]);
  const state = createScriptState({ byteLength: 0x58, slotState: slots, acState: ac }); state.seed(0x56, [0x38, 0x12]);
  const allocator = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(await load('task-frame-profiles')) });
  const scheduler = createScriptScheduler(await load('scripts'), { frameAllocator: allocator }); scheduler.addTask(0x252, [0, 0, 0, 0, parent.value]);
  visitTailWithState(scheduler, state); sweepWithState(scheduler, state); sweepWithState(scheduler, state);
  const tasks = scheduler.snapshot(), heap = allocator.snapshot(), before = slots.snapshot();
  assert.equal(tasks.tasks.find(task => task.scriptId === 0x217).wait.remaining, 2912);
  assert.equal(slots.stepMotionHelper8133(0x54).reason, 'slot_motion_data_source_required'); assert.deepEqual(slots.snapshot(), before);
  motionData.seed(0x7EDEAC, Array(512).fill(255)); motionData.seed(0x7EE0AC, Array(512).fill(255));
  assert.deepEqual(slots.stepMotionHelper8133(0x54), { handled: true, value: 0, carry: 1 });
  const expected = slots.snapshot(); expected.motionSource.helperScratchWords = before.motionSource.helperScratchWords;
  assert.deepEqual(expected, before); assert.deepEqual(scheduler.snapshot(), tasks); assert.deepEqual(allocator.snapshot(), heap);
  // All three sourced helpers complete on the explicit synthetic heads.
  assert.deepEqual(slots.stepMotion(0x54), { handled: true });
  assert.equal(slots.snapshot().columns['0ED8'][42], 1725);
  assert.deepEqual(scheduler.snapshot(), tasks); assert.deepEqual(allocator.snapshot(), heap);
});

test('Missing heads, nodes, record fields, metadata, tails and cycles leave slots/data/scratch unchanged; hydration retries succeed', () => {
  const data = createSlotMotionData(), slots = createSlotState({ motionData: data }); slots.seedSlotFields(0x54, source());
  const check = address => { const before = slots.snapshot(), dataBefore = data.snapshot(); assert.deepEqual(slots.stepMotionHelper8133(0x54), { handled: false, reason: 'slot_motion_data_source_required', address }); assert.deepEqual(slots.snapshot(), before); assert.deepEqual(data.snapshot(), dataBefore); };
  check(0x7EDECE); word(data, 0x7EDECE, 0); check(0x7EEF3C);
  word(data, 0x7EEF3C, 0); check(0x7EE2AC);
  record(data, 0, box(103), null); check(0x7FE214);
  word(data, 0x7FE214, 0); check(0x7EF79C);
  word(data, 0x7EF79C, 0xFFFF); check(0x7EE0CE);
  word(data, 0x7EE0CE, 0xFFFF); assert.deepEqual(slots.stepMotionHelper8133(0x54), { handled: true, value: 3, carry: 0 });
  word(data, 0x7EF79C, 0); const before = slots.snapshot(); assert.deepEqual(slots.stepMotionHelper8133(0x54), { handled: false, reason: 'slot_motion_data_cycle_required', list: 0, node: 0 }); assert.deepEqual(slots.snapshot(), before);
  word(data, 0x7EF79C, 2); word(data, 0x7EEF3E, 0); word(data, 0x7EF79E, 0);
  assert.equal(slots.stepMotionHelper8133(0x54).reason, 'slot_motion_data_cycle_required'); assert.deepEqual(slots.snapshot(), before);
});

test('All44 slots commit exactly shared helper scratch, retain unvisited68 and preserve coordinates,6B,D9/list/pool state', () => {
  const data = empty(); record(data, 0, box(103), 0); chain(data, 0, [{ node: 0, record: 0 }]);
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const slots = createSlotState({ motionData: data }); slots.seedSlotFields(offset, source()); const before = slots.snapshot();
    assert.deepEqual(slots.stepMotionHelper8133(offset), { handled: true, value: 3, carry: 0 });
    const after = slots.snapshot(); Object.assign(before.motionSource.helperScratchWords, run(data, source(), offset).scratchWords);
    assert.deepEqual(after, before);
    word(data, 0x7EDECE, 0xFFFF); const retained = slots.snapshot();
    assert.deepEqual(slots.stepMotionHelper8133(offset), { handled: true, value: 0, carry: 1 }); retained.motionSource.helperScratchWords['3B'] = 0;
    assert.deepEqual(slots.snapshot(), retained); word(data, 0x7EDECE, 0);
    const copy = slots.snapshot(); copy.motionSource.helperScratchWords['68'] = 999; assert.equal(slots.snapshot().motionSource.helperScratchWords['68'], 0);
  }
});

test('Invalid helper/provider inputs and unsupported slots are rejected, and missing fields follow source order without writes', () => {
  const data = empty(), fields = source();
  for (const key of Object.keys(fields).filter(key => key !== '1458')) assert.deepEqual(run(data, { ...fields, [key]: null }), { handled: false, reason: 'slot_motion_source_required', field: key });
  assert.equal(run(data, { ...fields, '1458': null }).handled, true);
  for (const bad of [null, [], { ...fields, '0ED8': -1 }, { ...fields, '0E28': undefined }]) assert.throws(() => run(data, bad), /Invalid/);
  for (const bad of [{}, { readHead() {} }]) { assert.throws(() => run(bad), /Invalid/); assert.throws(() => createSlotState({ motionData: bad }), /Invalid/); }
  for (const offset of [1, 0x57, 0x58, 0xFFFF]) assert.deepEqual(run(data, fields, offset), { handled: false, reason: 'slot_window_required' });
  const slots = createSlotState(); slots.seedSlotFields(0, fields); const before = slots.snapshot();
  assert.deepEqual(slots.stepMotionHelper8133(0), { handled: false, reason: 'slot_motion_data_source_required' }); assert.deepEqual(slots.snapshot(), before);
  for (const offset of [-1, 65536, 1.5, undefined, '0']) assert.throws(() => slots.stepMotionHelper8133(offset), /Invalid/);
  const plan = run(data, fields); plan.scratchWords['3E'] = 0; assert.equal(run(data, fields).scratchWords['3E'], 0x54); assert.deepEqual(fields, source());
});
