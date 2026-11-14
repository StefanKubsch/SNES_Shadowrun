import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { createTaskHeap, scriptAllocationBytes } from '../proof/script/task-heap.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { inspectRom } from './rom.mjs';
import { europeanTables, inspectScriptTables } from './scripts.mjs';

const asset = JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8'));
const profileData = createTaskFrameProfiles(asset);
const sourceProfile = id => profileData.lookup(id).profile;
const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const word = (bytes, offset) => bytes[offset] | bytes[offset + 1] << 8;

test('Task-frame profiles validate source/IDs, copy input data and reject unsourced IDs', () => {
  const input = { ...asset, profiles: asset.profiles.map(profile => ({ ...profile })) };
  const data = createTaskFrameProfiles(input);
  input.profiles[0].headerAddress = 0;
  const copy = data.lookup(0);
  copy.profile.argumentBytes = 0;
  assert.deepEqual(data.lookup(0), profileData.lookup(0));
  assert.deepEqual(data.lookup(937), { available: false, reason: 'task_profile_source_required' });
  assert.throws(() => data.lookup(-1), /script ID/);
  const duplicate = asset.profiles.map(profile => ({ ...profile }));
  duplicate[1].id = 0;
  for (const invalid of [{ ...asset, romSha256: 'wrong' }, { ...asset, bankTable: '83:DB28' }, { ...asset, profiles: [] }, { ...asset, profiles: duplicate }, { ...asset, profiles: Array(937) }]) assert.throws(() => createTaskFrameProfiles(invalid), /profile source/);
  assert.throws(() => createTaskFrameAllocator({ profileData: {}, heap: createTaskHeap() }), /allocator source/);
  assert.throws(() => createTaskFrameAllocator({ profileData, heap: {} }), /allocator source/);
});

test('Frame allocator begins with the 48 exact free links and unknown assignment fields', () => {
  const allocator = createTaskFrameAllocator({ profileData });
  const before = allocator.snapshot();
  assert.equal(before.freeTaskOffset, 0);
  assert.equal(before.slots.length, 48);
  assert.deepEqual(before.slots.map(slot => slot.predecessorWord), [...Array.from({ length: 47 }, (_, index) => index * 2 + 2), 0xFFFF]);
  assert.deepEqual(before.slots.map(slot => slot.successorWord), [0xFFFF, ...Array(47).fill(null)]);
  assert.ok(before.slots.every(slot => slot.continuationWord === null && slot.statusWord === null && slot.payloadAddress === null));
  before.slots[0].predecessorWord = 42;
  assert.equal(allocator.snapshot().slots[0].predecessorWord, 2);
});

test('Zero-argument original frame writes exactly five metadata words in their original order', () => {
  const allocator = createTaskFrameAllocator({ profileData });
  const created = allocator.createFrame(0x10A);
  assert.equal(created.created, true);
  const profile = sourceProfile(0x10A);
  const base = 0x03D6;
  const size = scriptAllocationBytes(profile);
  assert.equal(created.taskOffset, 0);
  assert.deepEqual(created.originalReturn, { accumulatorWord: base, indexWord: 0 });
  assert.deepEqual(created.frame.writes, [
    { offset: 5, value: base + 17 }, { offset: 7, value: base + size - 1 },
    { offset: 0, value: profile.headerAddress + 2 }, { offset: 2, value: (profile.bankWord & 255) | 0xD600 }, { offset: 3, value: 0 },
  ]);
  const payload = created.frame.payload.bytes;
  assert.equal(word(payload, 0), profile.headerAddress + 2);
  assert.equal(payload[2], profile.bankWord & 255);
  assert.equal(word(payload, 3), 0);
  assert.ok(payload.slice(9).every(value => value === null));
  assert.deepEqual(allocator.snapshot().slots[0], { offset: 0, predecessorWord: 2, successorWord: 0xFFFF, continuationWord: 0, statusWord: 0, eventWord: null, payloadAddress: base });
  assert.equal(allocator.snapshot().freeTaskOffset, 2);
});

test('All 937 original profiles initialize exact stack bytes, workspace reversal and untouched locals', () => {
  for (const profile of asset.profiles) {
    const allocator = createTaskFrameAllocator({ profileData });
    const workspace = Array.from({ length: profile.argumentBytes / 2 }, (_, index) => (0x1111 * (index + 1)) & 0xFFFF);
    const result = allocator.createFrame(profile.id, workspace);
    assert.equal(result.created, true, `script ${profile.id}`);
    const frame = result.frame;
    assert.deepEqual(frame.args, workspace.toReversed());
    const size = scriptAllocationBytes(profile);
    const expected = Array(size).fill(null);
    const put = (offset, value) => { expected[offset] = value & 255; expected[offset + 1] = value >>> 8; };
    // Final metadata words; arguments lie at the opposite end of the payload.
    put(0, profile.headerAddress + 2);
    expected[2] = profile.bankWord & 255;
    put(3, 0);
    put(5, frame.payloadAddress + 17);
    put(7, frame.payloadAddress + size - 1 - profile.argumentBytes);
    for (let index = 0; index < workspace.length; index++) put(size - profile.argumentBytes + index * 2, workspace[index]);
    assert.deepEqual(frame.payload.bytes, expected);
    assert.ok(frame.payload.bytes.slice(0x13, 0x13 + profile.localBytes).every(value => value === null));
  }
});

test('Missing workspace/profile or invalid inputs stop before allocation, while unused unknown words are allowed', () => {
  const allocator = createTaskFrameAllocator({ profileData });
  const before = allocator.snapshot();
  for (const workspace of [[], [null]]) assert.deepEqual(allocator.createFrame(0x197, workspace), { created: false, reason: 'task_argument_source_required' });
  assert.deepEqual(allocator.createFrame(937), { created: false, reason: 'task_profile_source_required' });
  for (const workspace of [[-1], [65536], [undefined], [0.5], null]) assert.throws(() => allocator.createFrame(0x197, workspace), /argument workspace/);
  assert.deepEqual(allocator.snapshot(), before);
  assert.equal(allocator.createFrame(0x197, [0x08B2, null]).created, true);
});

test('Payload writes validate all ranges first, retain unknown data and preserve known bytes across source-fixture reuse', () => {
  const heap = createTaskHeap();
  assert.deepEqual(heap.readPayload(0), { available: false, reason: 'task_heap_payload_required' });
  const size = scriptAllocationBytes(sourceProfile(0x197));
  heap.allocate(size);
  const before = heap.readPayload(0);
  assert.deepEqual(heap.writePayloadWords(0, [{ offset: 0, value: 7 }, { offset: size - 1, value: 9 }]), { handled: false, reason: 'task_frame_window_required' });
  assert.deepEqual(heap.readPayload(0), before);
  assert.throws(() => heap.writePayloadWords(0, [{ offset: 0, value: -1 }]), /payload writes/);
  assert.deepEqual(heap.writePayloadWords(0, [{ offset: 0x13, value: 0xBEEF }]), { handled: true });
  heap.release(0); // Explicit synthetic fixture, not a ported task-slot release.
  const allocator = createTaskFrameAllocator({ profileData, heap });
  const created = allocator.createFrame(0x197, [0x08B2]);
  assert.deepEqual(created.frame.payload.bytes.slice(0x13, 0x15), [0xEF, 0xBE]);
  created.frame.payload.bytes[0] = 0;
  created.frame.args[0] = 0;
  assert.equal(word(heap.readPayload(0).bytes, 0), sourceProfile(0x197).headerAddress + 2);
});

test('Taskslot exhaustion retains the initialized 49th payload and actual A=0/X=FFFF without assigning a slot', () => {
  const allocator = createTaskFrameAllocator({ profileData });
  for (let index = 0; index < 48; index++) assert.equal(allocator.createFrame(0x10A).taskOffset, index * 2);
  const before = allocator.snapshot();
  assert.equal(before.freeTaskOffset, 0xFFFF);
  const result = allocator.createFrame(0x10A);
  assert.equal(result.created, false);
  assert.equal(result.reason, 'task_slot_failure_continuation_required');
  assert.deepEqual(result.originalReturn, { accumulatorWord: 0, indexWord: 0xFFFF });
  assert.equal(result.allocation.allocated, true);
  assert.equal(word(result.frame.payload.bytes, 3), 0);
  assert.deepEqual(allocator.snapshot().slots, before.slots);
  assert.notDeepEqual(allocator.snapshot().heap, before.heap);
});

test('Both heap-failure returns are retained before uncovered frame writes and lazy merges survive failure', () => {
  for (const fill of [0x07CC, 0x07C0]) {
    const heap = createTaskHeap();
    heap.allocate(fill);
    const allocator = createTaskFrameAllocator({ profileData, heap });
    const before = allocator.snapshot();
    const result = allocator.createFrame(0x10A);
    assert.equal(result.created, false);
    assert.equal(result.reason, 'task_heap_failure_continuation_required');
    assert.equal(result.allocation.accumulatorWord, fill === 0x07CC ? 0 : (8 - scriptAllocationBytes(sourceProfile(0x10A))) & 0xFFFF);
    assert.deepEqual(allocator.snapshot(), before);
  }
  const heap = createTaskHeap();
  heap.allocate(10);
  heap.allocate(20);
  heap.allocate(0x07A6); // Consume all remaining payload at offset 38.
  heap.release(0);
  heap.release(14);
  const allocator = createTaskFrameAllocator({ profileData, heap });
  const largest = asset.profiles.find(profile => scriptAllocationBytes(profile) === 67);
  const args = Array(largest.argumentBytes / 2).fill(0);
  const result = allocator.createFrame(largest.id, args);
  assert.equal(result.reason, 'task_heap_failure_continuation_required');
  assert.deepEqual(heap.snapshot().headers[0], { offset: 0, sizeWord: 34, nextOffset: 38 });
  assert.equal(allocator.snapshot().freeTaskOffset, 0);
});

test('Unsupported odd argument profiles and uncovered frame writes do not claim successful creation', () => {
  for (const replacement of [{ argumentBytes: 1 }, { localBytes: 232, stackHeaderBytes: 1 }]) {
    const altered = { ...asset, profiles: asset.profiles.map(profile => ({ ...profile, ...(profile.id === 0 ? replacement : {}) })) };
    const allocator = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(altered) });
    const before = allocator.snapshot();
    assert.equal(allocator.createFrame(0, [123]).reason, replacement.argumentBytes ? 'task_argument_profile_required' : 'task_frame_window_required');
    assert.deepEqual(allocator.snapshot(), before);
  }
});

test('Source-initialized original $197 arguments run through the existing script engine without reading ROM', () => {
  for (const [argument, expected] of [[0x08B2, 0xFFFF], [0, 0]]) {
    const allocator = createTaskFrameAllocator({ profileData });
    const created = allocator.createFrame(0x197, [argument]);
    const task = createScriptTask(original, created.frame.scriptId, created.frame.args);
    assert.equal(task.run().result.value, expected);
  }
});

test('Frame source profiles, complete initialization and first consumer instructions match the European ROM', async () => {
  const { bytes, metadata } = inspectRom(await readFile(new URL('../Shadowrun (E).smc', import.meta.url)));
  assert.equal(metadata.rom_sha256, asset.romSha256);
  const signatures = [
    [0x42C8, 'BF28DB828573BFCCE98229FF008D48028A0AAABFD1DE828571'],
    [0x42F8, '857418691100A005009174A5746D46023AAC4802F00DAAB9FEFFCA9500CA8888D0F58A'],
    [0x431B, 'A007009174A5711A1A9274A00200A5739174C8A900009174AE4E0230119EB2029EA20BBD12038D4E02A5749D520260'],
    [0x7378, 'BD52025BD401ABAB3B8DF201A5071BA403'],
  ];
  for (const [offset, expected] of signatures) assert.equal(bytes.subarray(offset, offset + expected.length / 2).toString('hex').toUpperCase(), expected);
  const inventory = inspectScriptTables(bytes);
  for (let id = 0; id < 937; id++) {
    const profile = sourceProfile(id);
    const script = inventory.scripts[id];
    assert.equal(profile.headerAddress, bytes.readUInt16LE(europeanTables.scriptPointers + id * 2));
    assert.equal(profile.bankWord, bytes.readUInt16LE(europeanTables.scriptBanks + id));
    assert.equal(profile.localBytes, script.scratch_bytes);
    assert.equal(profile.stackHeaderBytes, script.max_stack_bytes);
    assert.equal(profile.argumentBytes, script.argument_bytes);
  }
});
