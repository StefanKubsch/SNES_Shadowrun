import { BYTE_MASK, BYTE_BITS } from '../../src/constants/bits.mjs';
import {
  FRAME_LOCALS,
  FRAME_PC,
  FRAME_CALL_ID,
  FRAME_OPERAND_STACK,
  FRAME_RETURN,
  FRAME_RETURN_BASE,
  HEAP_HEADER_BYTES,
} from '../../src/vm/layout.mjs';

// Four return words fit above the saved callee ID at frame bytes 9 and 10.
const MAX_LOCAL_RETURN_DEPTH = 4;
const instances = new WeakSet();
export const isHeapFrameStorage = (storage) => instances.has(storage);

// Restricted storage for supported script operations. No CPU/address bus.
// Stack/local/control aliasing is an explicit boundary of this adapter.
export function createHeapFrameStorage(heap, frame, localBytes) {
  const { taskOffset, blockOffset, payloadAddress: base, allocationBytes: size } = frame;
  const payload = () => {
    const result = heap.readPayload(blockOffset);
    if (!result.available) throw new Error(result.reason);
    return result;
  };
  const initial = payload();
  if (!initial.available || FRAME_LOCALS + localBytes > size)
    throw new Error('task_local_window_required');
  const writeWords = (writes) => {
    const result = heap.writePayloadWords(blockOffset, writes);
    if (!result.handled) throw new Error(result.reason);
  };
  const stackOffset = (depth) => {
    const offset = size - depth * 2;
    if (
      !Number.isInteger(depth) ||
      depth < 1 ||
      offset < FRAME_LOCALS + localBytes ||
      offset + 1 >= size
    )
      throw new Error('task_stack_window_required');
    return offset;
  };
  const storage = {
    initialLocals: () => initial.bytes.slice(FRAME_LOCALS, FRAME_LOCALS + localBytes),
    describe: () => ({ taskOffset, blockOffset, payloadAddress: base, allocationBytes: size }),
    writeLocal(offset, width, value) {
      const result = heap.writePayloadBytes(
        blockOffset,
        Array.from({ length: width }, (_, index) => ({
          offset: FRAME_LOCALS + offset + index,
          value: (value >>> (index * BYTE_BITS)) & BYTE_MASK,
        })),
      );
      if (!result.handled) throw new Error(result.reason);
    },
    writeStack(depth, value) {
      writeWords([{ offset: stackOffset(depth), value }]);
    },
    saveCall(pc, id, depth) {
      writeWords([
        { offset: FRAME_PC, value: pc },
        { offset: FRAME_CALL_ID, value: id },
        { offset: FRAME_OPERAND_STACK, value: base + size - 1 - depth * 2 },
      ]);
    },
    pushReturn(depth, pc) {
      if (depth >= MAX_LOCAL_RETURN_DEPTH) throw new Error('task_return_control_alias_required');
      const offset = FRAME_RETURN_BASE - depth * 2;
      writeWords([
        { offset, value: pc },
        { offset: FRAME_RETURN, value: base + offset - 2 },
      ]);
    },
    popReturn(depth) {
      const offset = FRAME_RETURN_BASE - (depth - 1) * 2;
      const data = payload().bytes;
      if (data[offset] === null || data[offset + 1] === null)
        throw new Error('task_return_source_required');
      writeWords([{ offset: FRAME_RETURN, value: base + offset }]);
      return data[offset] | (data[offset + 1] << BYTE_BITS);
    },
    endWord(depth) {
      // END always PLA, even for a zero-return profile and an empty JS stack.
      const read = heap.readKnownBytes(blockOffset + HEAP_HEADER_BYTES + size - depth * 2, 2);
      if (!read.available) throw new Error('task_end_word_source_required');
      return read.bytes[0] | (read.bytes[1] << BYTE_BITS);
    },
  };
  instances.add(storage);
  return storage;
}
