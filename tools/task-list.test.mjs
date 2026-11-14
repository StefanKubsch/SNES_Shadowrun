import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { createTaskHeap } from '../proof/script/task-heap.mjs';

const asset = JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8'));
const profileData = createTaskFrameProfiles(asset);
const fresh = () => createTaskFrameAllocator({ profileData });
const append = allocator => {
  const result = allocator.createFrame(0x10A);
  assert.equal(result.created, true);
  allocator.appendRoot(result.taskOffset);
  return result;
};

test('Appending original roots repairs both links and tail without moving the initially empty cursor', () => {
  const allocator = fresh();
  assert.deepEqual(allocator.snapshot().activeOrder, []);
  append(allocator);
  append(allocator);
  append(allocator);
  const state = allocator.snapshot();
  assert.deepEqual(state.activeOrder, [0, 2, 4]);
  assert.equal(state.tailOffset, 4);
  assert.equal(state.cursorOffset, 0xFFFF);
  assert.deepEqual(state.slots.slice(0, 3).map(slot => [slot.predecessorWord, slot.successorWord]), [[0xFFFF, 2], [0, 4], [2, 0xFFFF]]);
});

test('Child insertion behind an earlier parent keeps a later root and blocks exactly that parent', () => {
  const allocator = fresh();
  append(allocator);
  append(allocator);
  const child = allocator.createFrame(0x10A);
  allocator.setCursor(0);
  allocator.insertChild(child.taskOffset, 0xF494);
  const state = allocator.snapshot();
  assert.deepEqual(state.activeOrder, [0, 4, 2]);
  assert.equal(state.tailOffset, 2);
  assert.equal(state.cursorOffset, 0);
  assert.equal(state.slots[0].statusWord, 0xFFFF);
  assert.equal(state.slots[0].continuationWord, 0xF494);
  assert.equal(state.slots[1].statusWord, 0);
  assert.equal(state.slots[1].predecessorWord, 4);
});

test('A child behind the tail becomes the new tail; removal preserves the blocked parent until its explicit resume', () => {
  const allocator = fresh();
  append(allocator);
  const child = allocator.createFrame(0x10A);
  allocator.setCursor(0);
  allocator.insertChild(child.taskOffset, 0xF494);
  assert.equal(allocator.snapshot().tailOffset, 2);
  allocator.setCursor(2);
  allocator.removeFrame(2);
  const after = allocator.snapshot();
  assert.equal(after.cursorOffset, 0);
  assert.equal(after.tailOffset, 0);
  assert.equal(after.slots[0].statusWord, 0xFFFF);
  allocator.resumeParent(0);
  assert.equal(allocator.snapshot().slots[0].statusWord, 0);
  assert.equal(allocator.snapshot().slots[0].continuationWord, 0xF494);
});

test('Removing head, middle or tail repairs original links and retains stale removed-slot fields', () => {
  for (const offset of [0, 2, 4]) {
    const allocator = fresh();
    const frames = [append(allocator), append(allocator), append(allocator)];
    const before = allocator.snapshot();
    allocator.setCursor(offset);
    const result = allocator.removeFrame(offset);
    const after = allocator.snapshot();
    const order = [0, 2, 4].filter(value => value !== offset);
    assert.deepEqual(after.activeOrder, order);
    assert.equal(after.tailOffset, order.at(-1));
    assert.equal(after.freeTaskOffset, offset);
    assert.equal(after.cursorOffset, before.slots[offset / 2].predecessorWord);
    const removed = after.slots[offset / 2];
    assert.equal(removed.predecessorWord, 6);
    for (const key of ['successorWord', 'continuationWord', 'statusWord', 'payloadAddress']) assert.equal(removed[key], before.slots[offset / 2][key]);
    assert.equal(result.blockOffset, frames[offset / 2].frame.blockOffset);
    assert.equal(after.heap.headers.find(header => header.offset === result.blockOffset).sizeWord & 0x8000, 0);
    assert.equal(after.slots[order[0] / 2].predecessorWord, 0xFFFF);
    assert.equal(after.slots[order[1] / 2].successorWord, 0xFFFF);
  }
});

test('Removing the only node restores negative tail/cursor and reuses its slot plus unchanged payload bytes', () => {
  const heap = createTaskHeap();
  const allocator = createTaskFrameAllocator({ profileData, heap });
  const first = append(allocator);
  heap.writePayloadWords(first.frame.blockOffset, [{ offset: 0x13, value: 0xCAFE }]);
  allocator.setCursor(0);
  allocator.removeFrame(0);
  assert.equal(allocator.snapshot().tailOffset, 0xFFFF);
  assert.equal(allocator.snapshot().cursorOffset, 0xFFFF);
  const next = append(allocator);
  assert.equal(next.taskOffset, 0);
  assert.equal(next.frame.blockOffset, first.frame.blockOffset);
  assert.deepEqual(next.frame.payload.bytes.slice(0x13, 0x15), [0xFE, 0xCA]);
});

test('Removal leaves an unrelated cursor untouched and recycled taskslots use LIFO while heap lookup stays first-fit', () => {
  const allocator = fresh();
  const frames = [append(allocator), append(allocator), append(allocator)];
  allocator.setCursor(4);
  allocator.removeFrame(0);
  assert.equal(allocator.snapshot().cursorOffset, 4);
  allocator.removeFrame(2);
  const next = append(allocator);
  assert.equal(next.taskOffset, 2);
  assert.equal(next.frame.blockOffset, frames[0].frame.blockOffset);
  const later = append(allocator);
  assert.equal(later.taskOffset, 0);
  assert.equal(later.frame.blockOffset, frames[1].frame.blockOffset);
  assert.deepEqual(allocator.snapshot().activeOrder, [4, 2, 0]);
});

test('Invalid links, double removal and missing child context fail before changing data', () => {
  const allocator = fresh();
  const frame = allocator.createFrame(0x10A);
  const before = allocator.snapshot();
  for (const offset of [-1, 1, 0x60, 65536]) assert.throws(() => allocator.appendRoot(offset), /task offset/);
  assert.throws(() => allocator.appendRoot(2), /unlinked assigned/);
  assert.throws(() => allocator.insertChild(frame.taskOffset, 0xF494), /task offset/);
  assert.throws(() => allocator.removeFrame(0), /not linked/);
  assert.deepEqual(allocator.snapshot(), before);
  allocator.appendRoot(0);
  const linked = allocator.snapshot();
  assert.throws(() => allocator.appendRoot(0), /unlinked assigned/);
  assert.throws(() => allocator.resumeParent(0), /not blocked/);
  assert.deepEqual(allocator.snapshot(), linked);
  allocator.removeFrame(0);
  const removed = allocator.snapshot();
  assert.throws(() => allocator.removeFrame(0), /not linked/);
  assert.deepEqual(allocator.snapshot(), removed);
});

test('A full list can release and reuse all 48 original slots without capacity leakage', () => {
  const allocator = fresh();
  for (let i = 0; i < 48; i++) append(allocator);
  for (let offset = 94; offset >= 0; offset -= 2) allocator.removeFrame(offset);
  assert.deepEqual(allocator.snapshot().activeOrder, []);
  for (let i = 0; i < 48; i++) assert.equal(append(allocator).taskOffset, i * 2);
  assert.equal(allocator.snapshot().freeTaskOffset, 0xFFFF);
  assert.equal(allocator.snapshot().activeOrder.length, 48);
});

test('Original append, child insertion and complete task removal bytes are pinned to the European ROM', async () => {
  const bytes = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const signatures = [
    [0x434D, 'AD4C029D1203A9FFFF9D72038AAE4C0230039D72038D4C0260'],
    [0x436D, 'AD50029D1203A8B972039D72038A997203A9FFFF99A20B6899B202BC720330058A991203608E4C0260'],
    [0x4396, '38BD5202E9D60320BDC2'],
    [0x43A0, 'BC1203AD4E029D12038E4E02EC5002D0038C5002BD7203BB3003997203A830058A991203608E4C0260'],
    [0x4221, 'AE5002BDA20B10059EA20B80D0'],
  ];
  for (const [offset, expected] of signatures) assert.equal(bytes.subarray(offset, offset + expected.length / 2).toString('hex').toUpperCase(), expected);
});
