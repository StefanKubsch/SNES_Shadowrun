import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createSlotMotionData, motionPreludeWordBoundary } from '../proof/state/slot-motion-data.mjs';
import { prepareMotionPrelude8799 } from '../proof/state/slot-motion-prelude-8799.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createSlotTargetData } from '../proof/state/slot-target-data.mjs';
import { createACState } from '../proof/state/ac-state.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const word = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const source = overrides => ({ '1458': 0x100, '7E:43A0': 1, '0E28': 0, '0E80': 0, '0ED8': 4,
  '7E:4240': 0, '7E:4298': 0, '7E:42F0': 0, '7E:4348': 0, ...overrides });
const dataWithBase = (base = 0x20) => { const data = createSlotMotionData(); word(data, 0x7EDEAA, base); return data; };
const make = (fields = source(), base = 0x20, offsets = [0]) => {
  const data = dataWithBase(base), slots = createSlotState({ motionData: data }); slots.seedActiveList(offsets);
  for (const offset of new Set(offsets)) slots.seedSlotFields(offset, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null)));
  return { data, slots };
};
const pure = (fields = source(), options = {}) => prepareMotionPrelude8799({ lastOffset: 0, entries: [0],
  readSlotField: (_, key) => fields[key] == null ? { available: false } : { available: true, value: fields[key] }, motionData: dataWithBase(), ...options });
const recordWords = (data, record = 0xA74) => Array.from({ length: 6 }, (_, i) => data.readRecordField(record, i).value);
const bytesAt = (data, address, length) => {
  const bytes = new Map(data.snapshot().bytes); return Array.from({ length }, (_, i) => bytes.get(address + i));
};
const capture = (slots, data) => ({ slots: slots.snapshot(), data: data.snapshot() });
const firstList = data => data.seed(0x7EDEAC, Array(512).fill(255)); // Explicit synthetic empty first list only.
const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const original = await load('scripts'), profiles = createTaskFrameProfiles(await load('task-frame-profiles'));
const originalProbe = async () => {
  const data = createSlotMotionData(), target = createSlotTargetData(await load('slot-target-data'));
  const slots = createSlotState({ motionData: data, targetData: target,
    definitionData: createSlotDefinitions(await load('slot-definitions')), actionData: createSlotActionData(await load('slot-action-data')) });
  slots.seedTargetPointer(target.deriveF3From9D(0x99807E).pointer);
  const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  const ac = createACState(), state = createScriptState({ byteLength: 0x58, slotState: slots, acState: ac });
  state.seed(0x56, [0x38, 0x12]); ac.seed(0x26, [0, 0]);
  const memory = createTaskFrameAllocator({ profileData: profiles }), scheduler = createScriptScheduler(original, { frameAllocator: memory });
  scheduler.addTask(0x252, [0, 0, 0, 0, created.value]);
  visitTailWithState(scheduler, state); sweepWithState(scheduler, state); const result = sweepWithState(scheduler, state);
  assert.equal(result.boundary, null); return { slots, data, memory, scheduler, ac };
};

test('Prelude provider adds only explicit DEAA bytes, preserves unknown partial WORDs and does not initialize them from ROM', () => {
  const data = createSlotMotionData();
  assert.equal(data.snapshot().windows[0][0], 0x7EDEAA); assert.deepEqual(data.snapshot().bytes, []);
  assert.deepEqual(data.readPreludeNodeBase(), { available: false, reason: 'slot_motion_data_source_required', address: 0x7EDEAA });
  data.seed(0x7EDEAA, [0x34]); assert.equal(data.readPreludeNodeBase().available, false);
  data.seed(0x7EDEAB, [0x12]); assert.equal(data.readPreludeNodeBase().value, 0x1234);
  assert.throws(() => data.seed(0x7EDEA9, [0]), /Invalid/); assert.throws(() => data.seed(0x81DEAA, [0]), /Invalid/);
  assert.equal(data.readHead(0, 0).available, false); assert.equal(data.readHead(1, 0).available, false);
});

test('Dedicated prelude writer validates complete batches before changes and preserves odd/overlapping WORD writes', () => {
  const data = dataWithBase(), initial = data.snapshot();
  for (const address of [0x7EDEAA, 0x7EDEAC, 0x7E0CC2, 0x7EFFFF, 0x7F0000, 0x7FE213, 0x7FFFFF, 0x81E0AC]) {
    assert.deepEqual(data.writePreludeWords([{ address: 0x7EE0AC, value: 1 }, { address, value: 2 }]), { handled: false, reason: 'slot_motion_data_window_required', address });
    assert.deepEqual(data.snapshot(), initial);
  }
  for (const bad of [null, [null], Array(1), [{ address: 0x7EE0AC, value: 65536 }], [{ address: -1, value: 0 }]]) {
    assert.throws(() => data.writePreludeWords(bad), /Invalid/); assert.deepEqual(data.snapshot(), initial);
  }
  assert.equal(data.writePreludeWords([{ address: 0x7FE4B1, value: 0x1234 }, { address: 0x7FE4B2, value: 0xABCD }]).handled, true);
  assert.deepEqual(bytesAt(data, 0x7FE4B1, 3), [0x34, 0xCD, 0xAB]);
  for (const address of [0x7EE0AC, 0x7EFFFE, 0x7FE214, 0x7FFFFE]) assert.equal(motionPreludeWordBoundary(address), null);
});

test('Every empty-list node-base WORD is copied without alignment/capacity inference; plan resets256 heads and remains pure', () => {
  const data = dataWithBase();
  for (let base = 0; base <= 0xFFFF; base++) {
    word(data, 0x7EDEAA, base);
    const plan = prepareMotionPrelude8799({ lastOffset: 0xFFFE, entries: [], motionData: data });
    assert.equal(plan.handled, true); assert.equal(plan.dataWrites.length, 256); assert.deepEqual(plan.scratchWords, { A0: base });
    assert.deepEqual(plan.dataWrites[0], { address: 0x7EE0AC, value: 0xFFFF }); assert.deepEqual(plan.dataWrites[255], { address: 0x7EE2AA, value: 0xFFFF });
  }
  assert.equal(data.readHead(1, 0).available, false);
  for (const lastOffset of [0x8000, 0x8001, 0xFFFF]) assert.equal(prepareMotionPrelude8799({ lastOffset, entries: [], motionData: data }).handled, true);
});

test('Empty live list commits only reset and A0; old first heads/node/record/metadata/scratch stay untouched', () => {
  const { slots, data } = make(source(), 0xBEEF, []);
  data.seed(0x7EDEAC, Array(512).fill(0x55)); word(data, 0x7EEF3C, 123); word(data, 0x7EF79C, 456); word(data, 0x7FE214, 789);
  slots.seedMotionScratchWord40(0xAB8C); const before = slots.snapshot();
  assert.deepEqual(slots.stepMotionPrelude8799(), { handled: true });
  before.motionSource.preludeScratchWords.A0 = 0xBEEF; assert.deepEqual(slots.snapshot(), before);
  assert.deepEqual(bytesAt(data, 0x7EDEAC, 512), Array(512).fill(0x55)); assert.deepEqual(bytesAt(data, 0x7EE0AC, 512), Array(512).fill(255));
  assert.equal(data.readNodeRecord(0).value, 123); assert.equal(data.readNextNode(0).value, 456); assert.equal(data.readMetadata(0).value, 789);
  assert.equal(data.readPreludeNodeBase().value, 0xBEEF);
});

test('Unknown DEAA holds back the entire reset; source read precedes lastOffset and active entries', () => {
  const data = createSlotMotionData(), slots = createSlotState({ motionData: data });
  data.seed(0x7EE0AC, [1, 2, 3]); slots.seedMotionScratchWord40(0x008C); const before = capture(slots, data);
  assert.deepEqual(slots.stepMotionPrelude8799(), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDEAA });
  assert.deepEqual(capture(slots, data), before);
  assert.deepEqual(prepareMotionPrelude8799({ lastOffset: null, entries: [], motionData: data }), slots.stepMotionPrelude8799());
  word(data, 0x7EDEAA, 0); assert.deepEqual(prepareMotionPrelude8799({ lastOffset: null, entries: [], motionData: data }), { handled: false, reason: 'slot_motion_source_required', field: '14B0' });
});

test('Active-list window/unknown entry boundaries retain source precedence and all planned writes', () => {
  const data = dataWithBase(), before = data.snapshot();
  for (const lastOffset of [1, 0x57, 0x7FFF]) assert.deepEqual(prepareMotionPrelude8799({ lastOffset, entries: [], motionData: data }), { handled: false, reason: 'slot_motion_active_list_window_required', offset: lastOffset });
  assert.deepEqual(prepareMotionPrelude8799({ lastOffset: 0, entries: [], motionData: data }), { handled: false, reason: 'slot_motion_source_required', field: '14B2', offset: 0 });
  for (const offset of [1, 0x58, 0xFFFF]) assert.deepEqual(prepareMotionPrelude8799({ lastOffset: 0, entries: [offset], motionData: data }), { handled: false, reason: 'slot_window_required', offset });
  assert.deepEqual(data.snapshot(), before);
});

test('0100 gating ignores0400/sign/occupancy and requires no later fields for skipped slots or zero height extent', () => {
  for (const flags of [0, 1, 0x61, 0x400, 0x8000, 0xFEFF, 0xFFFF, 0x100, 0x500, 0x8100]) {
    const log = [], plan = pure({}, { readSlotField: (_, field) => {
      log.push(field); return field === '1458' ? { available: true, value: flags } : { available: false };
    } });
    if (flags & 0x100) { assert.equal(plan.field, '7E:43A0'); assert.deepEqual(log, ['1458', '7E:43A0']); }
    else { assert.equal(plan.handled, true); assert.deepEqual(log, ['1458']); assert.deepEqual(plan.scratchWords, { A0: 0x20, '20': 0xA74 }); }
  }
  const zero = pure({ '1458': 0xFFFF, '7E:43A0': 0 }); assert.equal(zero.handled, true); assert.equal(zero.dataWrites.length, 256);
  const { slots } = make(source({ '1458': 0x8500 })); assert.equal(slots.snapshot().definitions[0], 0xFFFF); assert.equal(slots.stepMotionPrelude8799().handled, true);
});

test('Selected record reads occur exactly in ROM order, including repeated43A0, and f0/f1/f2/f5/f3/f4 writes', () => {
  const reads = [], fields = source(), plan = pure(fields, { readSlotField: (_, key) => { reads.push(key); return { available: true, value: fields[key] }; } });
  assert.deepEqual(reads, ['1458', '7E:43A0', '0E28', '7E:4240', '0E80', '7E:42F0', '0ED8', '7E:43A0', '7E:4298', '7E:4348']);
  assert.deepEqual(plan.dataWrites.slice(256, 262).map(w => w.address), [0x7EED20, 0x7EED22, 0x7EED24, 0x7EED2A, 0x7EED26, 0x7EED28]);
  let heightReads = 0;
  const changed = pure(fields, { readSlotField: (_, key) => ({ available: true, value: key === '7E:43A0' ? ++heightReads : fields[key] }) });
  assert.equal(changed.dataWrites[259].value, 3); assert.equal(heightReads, 2);
});

test('Every coordinate WORD and signed extent wraps with independent BigInt results before quarter/mask operations', () => {
  const data = dataWithBase(), fields = source();
  for (let value = 0; value <= 0xFFFF; value++) {
    Object.assign(fields, { '0E28': value, '0E80': value ^ 0xFFFF, '0ED8': (value * 7) & 0xFFFF,
      '7E:4240': 0xFFFF, '7E:4298': value, '7E:42F0': value ^ 0x8000, '7E:4348': 0xFF80, '7E:43A0': 0xFFFF });
    const plan = pure(fields, { motionData: data }); assert.equal(plan.handled, true);
    const quarter = key => BigInt(Math.floor(fields[key] / 4)), wrap = v => Number((v + 65536n) % 65536n);
    const expected = [wrap(quarter('0E28') + 65535n), wrap(quarter('0E80') + BigInt(fields['7E:42F0'])), Number(quarter('0ED8')),
      wrap(quarter('0E28') + BigInt(value)), wrap(quarter('0E80') + 65408n), wrap(quarter('0ED8') + 65535n)];
    const values = new Map(plan.dataWrites.map(w => [w.address, w.value]));
    assert.deepEqual(Array.from({ length: 6 }, (_, i) => values.get(0x7EED20 + i * 2)), expected);
    assert.equal(plan.scratchWords['3E'], (expected[0] & 0x3C0) >>> 5); assert.equal(plan.scratchWords['41'], (expected[3] & 0x3C0) >>> 5);
    assert.equal(plan.scratchWords['44'], (expected[1] & 0x3C0) >>> 1); assert.equal(plan.scratchWords['47'], (expected[4] & 0x3C0) >>> 1);
  }
});

test('Corner combinations allocate1/2/4 nodes in original order without intermediate cells or extra records', () => {
  for (const [x, y, indices] of [[0, 0, [0]], [64, 0, [0, 2]], [0, 64, [0, 32]], [64, 64, [0, 34, 2, 32]], [960, 960, [0, 510, 30, 480]]]) {
    const { slots, data } = make(source({ '7E:4298': x, '7E:4348': y }));
    assert.equal(slots.stepMotionPrelude8799().handled, true);
    assert.deepEqual(indices.map(i => data.readHead(1, i).value), indices.map((_, i) => 0x20 + i * 2));
    for (let i = 0; i < indices.length; i++) { assert.equal(data.readNodeRecord(0x20 + i * 2).value, 0xA74); assert.equal(data.readNextNode(0x20 + i * 2).value, 0xFFFF); }
    assert.equal(slots.snapshot().motionSource.preludeScratchWords.A0, 0x20 + indices.length * 2);
    assert.equal(data.readNodeRecord(0x20 + indices.length * 2).available, false);
    assert.equal(data.readPreludeNodeBase().value, 0x20);
  }
});

test('All44 game offsets build without occupancy guards and write exact odd/even WORD metadata with3-byte strides', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const { slots, data } = make(source(), 0x20, [offset]);
    assert.equal(slots.stepMotionPrelude8799().handled, true); assert.deepEqual(recordWords(data), [0, 0, 1, 0, 0, 2]);
    assert.equal(data.readMetadata(0xA74).value, offset); assert.deepEqual(bytesAt(data, 0x7FE4B1, 3), [offset, 0, undefined]);
    assert.equal(slots.snapshot().motionSource.helperScratchWords['20'], 0xA80);
  }
  const offsets = Array.from({ length: 44 }, (_, i) => i * 2), { slots, data } = make(source(), 0x20, offsets);
  assert.equal(slots.stepMotionPrelude8799().handled, true);
  for (let i = 0; i < 44; i++) {
    assert.equal(data.readMetadata(0xA74 + i * 12).value, 0x56 - i * 2);
    assert.deepEqual(bytesAt(data, 0x7FE4B1 + i * 3, 3), [0x56 - i * 2, 0, undefined]);
  }
  assert.equal(slots.snapshot().motionSource.helperScratchWords['20'], 0xC84);
  assert.equal(slots.snapshot().motionSource.preludeScratchWords.A0, 0x78);
});

test('Repeated active entries and shared heads prepend the planned previous head in descending list order', () => {
  const { slots, data } = make(source(), 0x20, [0, 2, 0]); const beforeList = slots.snapshot().activeList;
  word(data, 0x7EE0AC, 0x1234); assert.equal(slots.stepMotionPrelude8799().handled, true);
  assert.equal(data.readHead(1, 0).value, 0x24);
  assert.deepEqual([0x20, 0x22, 0x24].map(node => data.readNextNode(node).value), [0xFFFF, 0x20, 0x22]);
  assert.deepEqual([0xA74, 0xA80, 0xA8C].map(r => data.readMetadata(r).value), [0, 2, 0]);
  assert.deepEqual(slots.snapshot().activeList, beforeList); assert.equal(data.readPreludeNodeBase().value, 0x20);
});

test('Shared search scratch and WORD40/41 byte alias retain independent unknown bytes and later writes in both directions', () => {
  const { slots, data } = make(source({ '7E:4298': 64 })); const initial = slots.snapshot();
  assert.equal(slots.stepMotionPrelude8799().handled, true); const after = slots.snapshot();
  assert.equal(after.motionSource.helperScratchWords['20'], 0xA80); assert.equal(after.motionSource.helperScratchWords['3E'], 0);
  assert.equal(after.motionSource.preludeScratchWords['41'], 2); assert.deepEqual(after.motionSource.scratchWord40Bytes, [null, 2]); assert.equal(after.motionSource.scratchWord40, null);
  assert.equal(after.motionSource.scratchWord6B, initial.motionSource.scratchWord6B); assert.deepEqual(after.targetSource, initial.targetSource);
  slots.seedMotionScratchWord40(0xAB8C); assert.equal(slots.snapshot().motionSource.preludeScratchWords['41'], 0xAB);
  assert.equal(slots.stepMotionPrelude8799().handled, true); assert.equal(slots.snapshot().motionSource.scratchWord40, 0x028C);
  slots.seedMotionScratchWord40(0x008C); assert.equal(slots.snapshot().motionSource.preludeScratchWords['41'], 0);
  slots.seedSlotFields(0, { '1458': 0 }); slots.stepMotionPrelude8799(); assert.equal(slots.snapshot().motionSource.scratchWord40, 0x008C);
  const copy = slots.snapshot(); copy.motionSource.preludeScratchWords.A0 = 999; copy.motionSource.scratchWord40Bytes[0] = 1; assert.notDeepEqual(slots.snapshot(), copy);
  assert.equal(data.readPreludeNodeBase().value, 0x20);
});

test('Missing later fields or a later selected slot discard reset, records, nodes, metadata and scratch together', () => {
  for (const field of ['1458', '7E:43A0', '0E28', '7E:4240', '0E80', '7E:42F0', '0ED8', '7E:4298', '7E:4348']) {
    const { slots, data } = make(source({ [field]: null }), 0x20, [0, 2]); slots.seedSlotFields(2, source());
    word(data, 0x7EE0AC, 0x1234); slots.seedMotionScratchWord40(0xAB8C); const before = capture(slots, data);
    assert.deepEqual(slots.stepMotionPrelude8799(), { handled: false, reason: 'slot_motion_source_required', field, offset: 0 });
    assert.deepEqual(capture(slots, data), before);
  }
  const { data } = make(); const fields = source(); let calls = 0;
  const failed = pure(fields, { motionData: data, readSlotField: (_, key) => key === '7E:43A0' && ++calls === 2 ? { available: false } : { available: true, value: fields[key] } });
  assert.equal(failed.handled, false); assert.equal(data.readHead(1, 0).available, false);
});

test('Node/write bank crossings fail atomically even when the resulting numeric address lies inside Bank7F metadata window', () => {
  for (const base of [0x863, 0x1000, 0x6FFF, 0x8000, 0xFFFF]) {
    const { slots, data } = make(source(), base), before = capture(slots, data), result = slots.stepMotionPrelude8799();
    assert.equal(result.handled, false); assert.equal(result.reason, 'slot_motion_data_window_required'); assert.deepEqual(capture(slots, data), before);
  }
  const one = make(source(), 0x862); assert.equal(one.slots.stepMotionPrelude8799().handled, true); assert.equal(one.data.readNextNode(0x862).value, 0xFFFF);
  const two = make(source({ '7E:4298': 64 }), 0x862), before = capture(two.slots, two.data);
  assert.equal(two.slots.stepMotionPrelude8799().address, 0x7F0000); assert.deepEqual(capture(two.slots, two.data), before);
});

test('Odd node WORDs and in-window column aliases preserve actual bytes; no inferred table-capacity guard', () => {
  const { slots, data } = make(source(), 0x85F); word(data, 0x7EF79C, 0x1234);
  assert.equal(slots.stepMotionPrelude8799().handled, true);
  assert.equal(data.readNodeRecord(0x85F).value, 0xA74); assert.equal(data.readNextNode(0x85F).value, 0xFFFF);
  assert.equal(data.readNextNode(0).value, 0x120A); // Odd EF3C+085F crosses the low byte of F79C.
  assert.equal(data.readHead(1, 0).value, 0x85F);
});

test('Existing motion search immediately consumes generated bytes and metadata, skips self and leaves prelude scratch aliases shared', () => {
  const { slots, data } = make(source({ '7E:4298': 64, '7E:4348': 64, '7E:43A0': 8 }), 0x20, [2]);
  firstList(data); word(data, 0x7E0CC2, 0xFFFF);
  slots.seedSlotFields(0, source({ '1458': 0, '7E:43A0': 0, '7E:4298': 64, '7E:4348': 64 }));
  slots.stepMotionPrelude8799(); const prelude = slots.snapshot().motionSource.preludeScratchWords;
  assert.deepEqual(slots.stepMotionHelper8133(0), { handled: true, value: 8, carry: 0 });
  assert.equal(slots.snapshot().motionSource.helperScratchWords['20'], 1);
  assert.deepEqual(slots.snapshot().motionSource.preludeScratchWords, prelude);
  assert.deepEqual(slots.stepMotionHelper8133(2), { handled: true, value: 0, carry: 1 });
  assert.equal(data.readHead(0, 0).value, 0xFFFF); assert.equal(data.readMetadata(0xA74).value, 2);
});

test('Invalid providers, arguments, field sources, entry values and scratch WORDs fail before live effects; plans are independent copies', () => {
  const data = dataWithBase(), slots = createSlotState({ motionData: data }), before = capture(slots, data);
  for (const options of [{ motionData: {} }, { lastOffset: -1 }, { entries: null }, { entries: Array(45) }, { readSlotField: {} }, { entries: ['0'] }]) assert.throws(() => pure(source(), { motionData: data, ...options }), /Invalid/);
  for (const result of [null, {}, { available: true, value: null }, { available: true, value: 65536 }]) assert.throws(() => pure(source(), { readSlotField: () => result }), /Invalid/);
  for (const value of [null, -1, 65536, '1']) assert.throws(() => slots.seedMotionScratchWord40(value), /Invalid/);
  assert.deepEqual(capture(slots, data), before);
  assert.deepEqual(createSlotState().stepMotionPrelude8799(), { handled: false, reason: 'slot_motion_data_source_required' });
  const plan = pure(); plan.dataWrites[0].value = 0; plan.scratchWords.A0 = 0;
  assert.equal(pure().dataWrites[0].value, 0xFFFF); assert.equal(data.readHead(1, 0).available, false);
});

test('Original252/217 waits stay untouched;0061 skips slot54 while originalA368 builds slot56 and first-list source stays open', async () => {
  const { slots, data, memory, scheduler, ac } = await originalProbe(); const tasks = scheduler.snapshot(), heap = memory.snapshot(), acBefore = ac.snapshot();
  const before = slots.snapshot(); assert.equal(slots.stepMotionPrelude8799().address, 0x7EDEAA); assert.deepEqual(slots.snapshot(), before);
  word(data, 0x7EDEAA, 0x20); assert.equal(slots.stepMotionPrelude8799().handled, true);
  assert.equal(slots.snapshot().motionSource.preludeScratchWords.A0, 0x22); assert.equal(data.readMetadata(0xA74).value, 0x56);
  assert.deepEqual(recordWords(data), [121, 454, 64, 127, 460, 88]);
  const after = slots.snapshot(); assert.deepEqual(after.columns, before.columns); assert.deepEqual(after.targetSource, before.targetSource);
  assert.deepEqual(slots.stepMotion(0x54), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDF8E });
  assert.deepEqual(scheduler.snapshot(), tasks); assert.deepEqual(memory.snapshot(), heap); assert.deepEqual(ac.snapshot(), acBefore);
  slots.seedSlotFields(0x54, { '1458': before.columns['1458'][42] | 0x100, '7E:43A0': 1 });
  slots.stepMotionPrelude8799(); assert.equal(data.readMetadata(0xA74).value, 0x54); firstList(data);
  assert.equal(slots.stepMotion(0x54).handled, true);
  assert.deepEqual(['0E28', '0E80', '0ED8', '0F30'].map(k => slots.snapshot().columns[k][42]), [330, 1496, 1725, 913]);
  assert.deepEqual(scheduler.snapshot(), tasks); assert.deepEqual(memory.snapshot(), heap);
});

test('Prelude CLI separates absentDEAA, explicit node base and selected-record fixtures, with unchanged wait checks and argument workspace', () => {
  const base = ['--fixture-no-audio', '--visit-spawned', '--fixture-target-9d'], command = (...flags) => JSON.parse(execFileSync(process.execPath, ['tools/run-slot-action-ac.mjs', ...base, ...flags], { encoding: 'utf8' }));
  const baseline = command(), missing = command('--step-motion-prelude');
  assert.deepEqual(missing.motionPreludeProbe.before, missing.motionPreludeProbe.after); assert.equal(missing.motionPreludeProbe.response.address, 0x7EDEAA);
  const reset = command('--step-motion-prelude', '--fixture-motion-prelude-node-base');
  assert.equal(reset.motionPreludeProbe.after.knownSecondHeads, 256);
  assert.deepEqual(reset.motionPreludeProbe.after.occupiedSecondHeads, [{ index: 0xE2, available: true, value: 0x20 }]);
  assert.equal(reset.motionPreludeProbe.after.source.preludeScratchWords.A0, 0x22); assert.deepEqual(reset.tasks, baseline.tasks); assert.deepEqual(reset.workspace, baseline.workspace);
  const record = command('--step-motion-prelude', '--fixture-motion-prelude-node-base', '--fixture-motion-prelude-record');
  assert.equal(record.motionPreludeProbe.response.handled, true); assert.equal(record.motionPreludeProbe.after.metadata.value, 0x54);
  assert.match(record.motionPreludeProbe.nodeFixture.scope, /Synthetic/); assert.match(record.motionPreludeProbe.recordFixture.scope, /Synthetic/);
  assert.deepEqual(record.tasks, baseline.tasks); assert.deepEqual(record.workspace, baseline.workspace);
  const body = command('--step-motion-prelude', '--fixture-motion-prelude-node-base', '--fixture-motion-prelude-record', '--fixture-motion-empty-heads', '--step-motion');
  assert.equal(body.motionProbe.response.handled, true); assert.equal(body.motionProbe.after.fields['0F30'], 913); assert.deepEqual(body.tasks, baseline.tasks);
  for (const flags of [['--step-motion-prelude'], [...base, '--fixture-motion-prelude-node-base'], [...base, '--step-motion-prelude', '--fixture-motion-prelude-record']]) {
    assert.throws(() => execFileSync(process.execPath, ['tools/run-slot-action-ac.mjs', ...flags], { encoding: 'utf8', stdio: 'pipe' }), /Usage/);
  }
});
