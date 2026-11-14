import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { inspectScriptTables } from './scripts.mjs';
import { createTaskHeap, scriptAllocationBytes } from '../proof/script/task-heap.mjs';

const initial = { byteLength: 0x07D0, headers: [{ offset: 0, sizeWord: 0x07CC, nextOffset: 0 }], headerBytes: [0xCC, 7, 0, 0].map((value, offset) => ({ offset, value })) };
const active = heap => heap.snapshot().headers;
const knownBytes = (heap, offset, count) => Array.from({ length: count }, (_, index) => heap.snapshot().headerBytes.find(byte => byte.offset === offset + index)?.value ?? null);

test('Heap initialization and snapshots preserve the source size and isolate returned data', () => {
  const heap = createTaskHeap();
  assert.deepEqual(heap.snapshot(), initial);
  const copy = heap.snapshot();
  copy.headers[0].sizeWord = 0;
  copy.headers.push({});
  assert.deepEqual(heap.snapshot(), initial);
});

test('Every 16-bit request preserves exact fit, split threshold and both initial return outcomes', () => {
  for (let size = 0; size <= 0xFFFF; size++) {
    const heap = createTaskHeap();
    const result = heap.allocate(size);
    if (size > 0x07CC) {
      assert.deepEqual(result, { allocated: false, accumulatorWord: (0x07CC - size) & 0xFFFF, blockOffset: 0 });
      assert.deepEqual(heap.snapshot(), initial);
    } else {
      assert.deepEqual(result, { allocated: true, accumulatorWord: 0x03D6, blockOffset: 0 });
      const split = size <= 0x07C7;
      assert.deepEqual(active(heap), split ? [
        { offset: 0, sizeWord: size | 0x8000, nextOffset: size + 4 },
        { offset: size + 4, sizeWord: 0x07C8 - size, nextOffset: 0 },
      ] : [{ offset: 0, sizeWord: 0x87CC, nextOffset: 0 }]);
    }
  }
});

test('Odd and zero-byte requests are not aligned and occupied blocks are skipped', () => {
  const heap = createTaskHeap();
  assert.equal(heap.allocate(1).blockOffset, 0);
  assert.deepEqual(heap.allocate(0), { allocated: true, accumulatorWord: 0x03DB, blockOffset: 5 });
  assert.deepEqual(heap.allocate(3), { allocated: true, accumulatorWord: 0x03DF, blockOffset: 9 });
  assert.equal(active(heap).at(-1).offset, 16);
});

test('Release clears only the allocated flag and coalescing waits until a larger request needs it', () => {
  const heap = createTaskHeap();
  heap.allocate(10);
  heap.allocate(20);
  heap.allocate(30);
  assert.deepEqual(heap.release(0), { handled: true, accumulatorWord: 10 });
  assert.deepEqual(heap.release(14), { handled: true, accumulatorWord: 20 });
  assert.equal(active(heap).length, 4);
  assert.equal(heap.allocate(9).blockOffset, 0); // Enough: do not merge adjacent free block.
  heap.release(0);
  assert.equal(heap.allocate(33).blockOffset, 0); // 10 + 4 + 20 = 34, unsplit remainder 1.
  assert.equal(active(heap)[0].sizeWord, 0x8022);
  assert.equal(active(heap)[0].nextOffset, 38);
  assert.deepEqual(knownBytes(heap, 14, 4), [20, 0, 38, 0]); // Obsolete header retained bytewise.
});

test('A too-small free block skips its allocated successor and continues at the next free block', () => {
  const heap = createTaskHeap();
  heap.allocate(10);
  heap.allocate(20);
  heap.release(0);
  assert.deepEqual(heap.allocate(30), { allocated: true, accumulatorWord: 0x03FC, blockOffset: 38 });
  assert.equal(active(heap)[0].sizeWord, 10);
});

test('Exhaustion returns zero at an occupied tail and the subtraction word at a free tail', () => {
  const heap = createTaskHeap();
  heap.allocate(10);
  heap.allocate(0x07BE);
  assert.deepEqual(heap.allocate(11), { allocated: false, accumulatorWord: 0, blockOffset: 14 });
  heap.release(14);
  assert.deepEqual(heap.allocate(0x07BF), { allocated: false, accumulatorWord: 0xFFFF, blockOffset: 14 });
});

test('Lazy merges remain visible after a failed allocation, and complete release restores one free block', () => {
  const heap = createTaskHeap();
  const offsets = [];
  for (;;) {
    const result = heap.allocate(23);
    if (!result.allocated) break;
    offsets.push(result.blockOffset);
  }
  assert.equal(offsets.length, 74); // Heap capacity alone; original task-slot list has 48 slots.
  for (const offset of offsets) heap.release(offset);
  assert.equal(active(heap).length, 74);
  assert.deepEqual(heap.allocate(0x07CD), { allocated: false, accumulatorWord: 0xFFFF, blockOffset: 0 });
  assert.deepEqual(active(heap), initial.headers);
  assert.equal(heap.snapshot().headerBytes.length, 74 * 4); // Obsolete header bytes remain.
  assert.equal(heap.allocate(0x07CC).accumulatorWord, 0x03D6);
});

test('An odd new header overwrites overlapping bytes of an obsolete header without inventing payload data', () => {
  const heap = createTaskHeap();
  heap.allocate(10);
  heap.allocate(20);
  heap.release(0);
  heap.release(14);
  heap.allocate(33); // Merge offsets 0/14, consume the merged 34-byte block.
  heap.release(0);
  heap.allocate(11); // New header at 15 overlaps obsolete header at 14.
  assert.deepEqual(knownBytes(heap, 14, 5), [20, 19, 0, 38, 0]);
  assert.equal(knownBytes(heap, 4, 1)[0], null); // Payload was never zero-filled.
  assert.deepEqual(heap.release(14), { handled: false, reason: 'task_heap_header_required' });
});

test('Invalid requests and uncovered release offsets have no effect; repeated active-header release is covered', () => {
  const heap = createTaskHeap();
  for (const value of [-1, 65536, 0.5, null, NaN, '1']) {
    assert.throws(() => heap.allocate(value), /allocation size/);
    assert.throws(() => heap.release(value), /block offset/);
  }
  assert.deepEqual(heap.release(2), { handled: false, reason: 'task_heap_header_required' });
  assert.deepEqual(heap.snapshot(), initial);
  assert.deepEqual(heap.release(0), { handled: true, accumulatorWord: 0x07CC });
});

test('All two-byte header combinations use byte additions with the carry between ADCs', () => {
  for (let first = 0; first < 256; first++) for (let second = 0; second < 256; second++) {
    // Fold the carry out of the first byte addition back into its low byte.
    const total = first + second;
    const expected = (total - 256 * Math.floor(total / 256) + Math.floor(total / 256) + 23) % 256;
    assert.equal(scriptAllocationBytes({ localBytes: first, stackHeaderBytes: second }), expected);
  }
  assert.equal(scriptAllocationBytes({ localBytes: 250, stackHeaderBytes: 10 }), 28);
  assert.equal(scriptAllocationBytes({ localBytes: 232, stackHeaderBytes: 1 }), 0);
  for (const invalid of [{ localBytes: -1, stackHeaderBytes: 0 }, { localBytes: 0 }, { localBytes: 0, stackHeaderBytes: 256 }]) assert.throws(() => scriptAllocationBytes(invalid), /allocation header/);
});

test('Original profiles and decisive heap, header-size and root-handle instructions match the European ROM', async () => {
  const { bytes, metadata } = inspectRom(await readFile(new URL('../Shadowrun (E).smc', import.meta.url)));
  assert.equal(metadata.rom_sha256, '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  const signatures = [
    [0x41C0, 'A9CC078DD2039CD40360'],
    [0x4242, '8D4A02A20000BDD2031008BDD403F06AAA80F3'],
    [0x4255, '38ED4A02B01EBCD403F05CB9D20330E87DD2036904009DD203B9D4039DD403BDD20380DC'],
    [0x4279, 'C905009030BDD40348188A6D4A026904009DD403A838BDD203ED4A02E9040099D2036899D403AD4A020900809DD203188A69D60360'],
    [0x42AE, 'BDD2030900809DD203188A69D60360A8B9D20329FF7F99D20360'],
    [0x42E1, 'A90000E22018A771A0010077716917C2208D46022042C2'],
    [0x4333, 'AE4E0230119EB2029EA20BBD12038D4E02A5749D520260'],
    [0x4366, '204AC36B'],
    [0x28EF, 'A6009D501360'],
  ];
  for (const [offset, expected] of signatures) assert.equal(bytes.subarray(offset, offset + expected.length / 2).toString('hex').toUpperCase(), expected);
  const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
  const inventory = inspectScriptTables(bytes);
  for (const script of inventory.scripts) {
    const profile = original.scripts.find(entry => entry.id === parseInt(script.id, 16));
    assert.equal(profile.localBytes, script.scratch_bytes);
    assert.equal(profile.stackHeaderBytes, script.max_stack_bytes);
    const heap = createTaskHeap();
    assert.equal(heap.allocate(scriptAllocationBytes(profile)).allocated, true);
  }
});
