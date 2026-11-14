import { BYTE_MASK, BYTE_BITS, WORD_MASK } from '../../src/constants/bits.mjs';
import {
  FRAME_FIXED_BYTES,
  HEAP_DATA,
  HEAP_HEADER_BYTES,
  HEAP_USED,
  HEAP_SIZE_MASK,
  HEAP_INITIAL_SIZE,
} from '../../src/vm/layout.mjs';
import { isWord } from './runtime.mjs';

const HEAP_BYTES = HEAP_INITIAL_SIZE + HEAP_HEADER_BYTES;
const HEAP_MIN_SPLIT_BYTES = HEAP_HEADER_BYTES + 1;

const instances = new WeakSet();
export const isTaskHeap = (heap) => instances.has(heap);

// Data algorithm from $80:C242-C2C7, initialized by $80:C1C0-C1C6.
// Header offsets are relative to $03D2; payload addresses start at $03D6.
// This is not a memory bus and does not execute machine instructions.
export function scriptAllocationBytes({ localBytes, stackHeaderBytes }) {
  if (
    ![localBytes, stackHeaderBytes].every(
      (value) => Number.isInteger(value) && value >= 0 && value <= BYTE_MASK,
    )
  )
    throw new Error('Invalid allocation header');
  const sum = localBytes + stackHeaderBytes;
  // Both ADCs use M=1. Carry from the first is retained by ADC #$17.
  return ((sum & BYTE_MASK) + FRAME_FIXED_BYTES + (sum > BYTE_MASK ? 1 : 0)) & BYTE_MASK;
}

export function createTaskHeap() {
  // Byte writes matter: a new odd-offset header can overlap obsolete words.
  // Only allocator-written bytes are known; payload data is not initialized.
  const bytes = new Map([
    [0, HEAP_INITIAL_SIZE & BYTE_MASK],
    [1, HEAP_INITIAL_SIZE >>> BYTE_BITS],
    [2, 0],
    [HEAP_HEADER_BYTES - 1, 0],
  ]);
  const headerOffsets = new Set(bytes.keys());
  const readWord = (offset) => {
    if (!bytes.has(offset) || !bytes.has(offset + 1))
      throw new Error('Task heap header bytes are unknown');
    return bytes.get(offset) | (bytes.get(offset + 1) << BYTE_BITS);
  };
  const writeWord = (offset, value, header = true) => {
    bytes.set(offset, value & BYTE_MASK);
    bytes.set(offset + 1, value >>> BYTE_BITS);
    if (header) {
      headerOffsets.add(offset);
      headerOffsets.add(offset + 1);
    }
  };
  const readHeader = (offset) => ({ sizeWord: readWord(offset), nextOffset: readWord(offset + 2) });
  const activeOffsets = () => {
    const offsets = [];
    let offset = 0;
    do {
      offsets.push(offset);
      offset = readWord(offset + 2);
    } while (offset !== 0);
    return offsets;
  };
  const payload = (blockOffset) => {
    if (!isWord(blockOffset)) throw new Error('Invalid task block offset');
    if (!activeOffsets().includes(blockOffset)) return null;
    const header = readHeader(blockOffset);
    return header.sizeWord & HEAP_USED
      ? { payloadAddress: blockOffset + HEAP_DATA, byteLength: header.sizeWord & HEAP_SIZE_MASK }
      : null;
  };
  const heap = {
    snapshot() {
      return {
        byteLength: HEAP_BYTES,
        headers: activeOffsets().map((offset) => ({ offset, ...readHeader(offset) })),
        headerBytes: [...headerOffsets]
          .sort((a, b) => a - b)
          .map((offset) => ({ offset, value: bytes.get(offset) })),
      };
    },
    readPayload(blockOffset) {
      const covered = payload(blockOffset);
      if (!covered) return { available: false, reason: 'task_heap_payload_required' };
      return {
        available: true,
        ...covered,
        bytes: Array.from(
          { length: covered.byteLength },
          (_, index) => bytes.get(blockOffset + HEAP_HEADER_BYTES + index) ?? null,
        ),
      };
    },
    readKnownBytes(offset, byteLength) {
      if (
        !Number.isInteger(offset) ||
        !Number.isInteger(byteLength) ||
        byteLength < 1 ||
        offset < 0 ||
        offset + byteLength > HEAP_BYTES
      )
        return { available: false, reason: 'task_heap_window_required' };
      const values = Array.from(
        { length: byteLength },
        (_, index) => bytes.get(offset + index) ?? null,
      );
      return values.some((value) => value === null)
        ? { available: false, reason: 'task_heap_byte_source_required' }
        : { available: true, bytes: values };
    },
    writePayloadBytes(blockOffset, writes) {
      if (
        !Array.isArray(writes) ||
        Array.from(writes).some(
          (write) =>
            !write ||
            !Number.isInteger(write.offset) ||
            write.offset < 0 ||
            !Number.isInteger(write.value) ||
            write.value < 0 ||
            write.value > BYTE_MASK,
        )
      )
        throw new Error('Invalid task payload byte writes');
      const covered = payload(blockOffset);
      if (!covered) return { handled: false, reason: 'task_heap_payload_required' };
      if (writes.some((write) => write.offset >= covered.byteLength))
        return { handled: false, reason: 'task_frame_window_required' };
      for (const write of writes)
        bytes.set(blockOffset + HEAP_HEADER_BYTES + write.offset, write.value);
      return { handled: true };
    },
    writePayloadWords(blockOffset, writes) {
      if (
        !Array.isArray(writes) ||
        Array.from(writes).some(
          (write) =>
            !write || !Number.isInteger(write.offset) || write.offset < 0 || !isWord(write.value),
        )
      )
        throw new Error('Invalid task payload writes');
      const covered = payload(blockOffset);
      if (!covered) return { handled: false, reason: 'task_heap_payload_required' };
      if (writes.some((write) => write.offset + 1 >= covered.byteLength))
        return { handled: false, reason: 'task_frame_window_required' };
      // Validate all writes before changing data; apply their original order.
      for (const write of writes)
        writeWord(blockOffset + HEAP_HEADER_BYTES + write.offset, write.value, false);
      return { handled: true };
    },
    allocate(byteLength) {
      if (!isWord(byteLength)) throw new Error('Invalid task allocation size');
      let offset = 0;
      for (;;) {
        const header = readHeader(offset);
        if (header.sizeWord & HEAP_USED) {
          if (header.nextOffset === 0)
            return { allocated: false, accumulatorWord: 0, blockOffset: offset };
          offset = header.nextOffset;
          continue;
        }
        const remainder = header.sizeWord - byteLength;
        if (remainder < 0) {
          if (header.nextOffset === 0)
            return {
              allocated: false,
              accumulatorWord: remainder & WORD_MASK,
              blockOffset: offset,
            };
          const next = readHeader(header.nextOffset);
          if (next.sizeWord & HEAP_USED) {
            offset = header.nextOffset;
            continue;
          }
          // SBC failed, so its carry is zero for ADC of the two free sizes.
          // This initialized 2 KiB heap cannot overflow either addition.
          writeWord(offset, header.sizeWord + next.sizeWord + HEAP_HEADER_BYTES);
          writeWord(offset + 2, next.nextOffset);
          continue;
        }
        if (remainder >= HEAP_MIN_SPLIT_BYTES) {
          const nextOffset = offset + byteLength + HEAP_HEADER_BYTES;
          writeWord(offset + 2, nextOffset);
          writeWord(nextOffset, remainder - HEAP_HEADER_BYTES);
          writeWord(nextOffset + 2, header.nextOffset);
          writeWord(offset, byteLength | HEAP_USED);
        } else writeWord(offset, header.sizeWord | HEAP_USED);
        return { allocated: true, accumulatorWord: offset + HEAP_DATA, blockOffset: offset };
      }
    },
    release(blockOffset) {
      if (!isWord(blockOffset)) throw new Error('Invalid task block offset');
      // Covered scope: active headers created here, including repeated release.
      // Arbitrary payload/stale-header writes require a broader data model.
      if (!activeOffsets().includes(blockOffset))
        return { handled: false, reason: 'task_heap_header_required' };
      const sizeWord = readWord(blockOffset) & HEAP_SIZE_MASK;
      writeWord(blockOffset, sizeWord);
      return { handled: true, accumulatorWord: sizeWord };
    },
  };
  instances.add(heap);
  return heap;
}
