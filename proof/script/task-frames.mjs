import { BYTE_MASK, BYTE_BITS, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { CODE_BANK, ROM_BANK_COUNT, LOROM_OFFSET } from '../../src/constants/memory-map.mjs';
import {
  TASK_LAST_SLOT,
  HEAP_DATA,
  FRAME_RETURN,
  FRAME_RETURN_BASE,
  FRAME_OPERAND_STACK,
  FRAME_BANK_BYTE,
  FRAME_PC,
  NATIVE_RESUME,
} from '../../src/vm/layout.mjs';
import { isWord } from './runtime.mjs';
import { createTaskHeap, isTaskHeap, scriptAllocationBytes } from './task-heap.mjs';
import { createHeapFrameStorage } from './frame-storage.mjs';

const SCRIPT_PROFILE_COUNT = 937;
const LAST_SCRIPT_BANK = CODE_BANK + ROM_BANK_COUNT - 1;
const TASK_SLOT_COUNT = TASK_LAST_SLOT / 2 + 1;
// Covered original ABI maxima: eight script words and seven native words.
const WORKSPACE_WORDS = 8;
const NO_TASK = WORD_MASK;
const WAIT_FOR_CHILD = WORD_MASK;
const WAIT_RETURN_WORD = NATIVE_RESUME - 1;
const MIN_FRAME_BYTES = FRAME_OPERAND_STACK + 2;

const instances = new WeakSet();
const allocators = new WeakSet();
export const isTaskFrameAllocator = (value) => allocators.has(value);
export function createTaskFrameProfiles(asset) {
  if (
    asset?.format !== 'shadowrun-e-task-frame-profiles-v1' ||
    asset.romSha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690' ||
    asset.bankTable !== '82:DB28' ||
    asset.pointerTable !== '82:DED1' ||
    asset.argumentTable !== '82:E9CC' ||
    !Array.isArray(asset.profiles) ||
    asset.profiles.length !== SCRIPT_PROFILE_COUNT
  )
    throw new Error('Invalid task frame profile source');
  const profiles = new Map();
  for (const profile of asset.profiles) {
    if (
      !profile ||
      !Number.isInteger(profile.id) ||
      profile.id < 0 ||
      profile.id >= SCRIPT_PROFILE_COUNT ||
      profiles.has(profile.id) ||
      !isWord(profile.headerAddress) ||
      profile.headerAddress < LOROM_OFFSET ||
      !isWord(profile.bankWord) ||
      (profile.bankWord & BYTE_MASK) < CODE_BANK ||
      (profile.bankWord & BYTE_MASK) > LAST_SCRIPT_BANK ||
      ![profile.localBytes, profile.stackHeaderBytes, profile.argumentBytes].every(
        (value) => Number.isInteger(value) && value >= 0 && value <= BYTE_MASK,
      )
    )
      throw new Error('Invalid task frame profile source');
    profiles.set(profile.id, { ...profile });
  }
  const data = {
    lookup(scriptId) {
      if (!isWord(scriptId)) throw new Error('Invalid frame script ID');
      const profile = profiles.get(scriptId);
      return profile
        ? { available: true, profile: { ...profile } }
        : { available: false, reason: 'task_profile_source_required' };
    },
  };
  instances.add(data);
  return data;
}

// Standalone data writes of $C2C8-C349 and the free-slot initialization.
// No outer-list insertion, script execution, scratch RAM or CPU emulation.
export function createTaskFrameAllocator({ profileData, heap = createTaskHeap() }) {
  if (!instances.has(profileData) || !isTaskHeap(heap))
    throw new Error('Invalid task frame allocator source');
  let freeTaskOffset = 0;
  let tailOffset = NO_TASK;
  let cursorOffset = NO_TASK;
  const assigned = new Set();
  const linked = new Set();
  const records = new Map();
  const workspace = Array(WORKSPACE_WORDS).fill(null);
  const slots = Array.from({ length: TASK_SLOT_COUNT }, (_, index) => ({
    offset: index * 2,
    predecessorWord: index === TASK_SLOT_COUNT - 1 ? NO_TASK : (index + 1) * 2,
    successorWord: index === 0 ? NO_TASK : null,
    continuationWord: null,
    statusWord: null,
    eventWord: null,
    payloadAddress: null,
  }));
  const get = (offset) => {
    if (!Number.isInteger(offset) || offset < 0 || offset > TASK_LAST_SLOT || offset & 1)
      throw new Error('Invalid original task offset');
    return slots[offset / 2];
  };
  const requireLinked = (offset) => {
    const slot = get(offset);
    if (!linked.has(offset)) throw new Error('Original task is not linked');
    return slot;
  };
  const activeOrder = () => {
    const order = [];
    for (let offset = tailOffset; !(offset & WORD_SIGN); offset = get(offset).predecessorWord)
      order.unshift(offset);
    return order;
  };
  const allocator = {
    snapshot: () => ({
      freeTaskOffset,
      tailOffset,
      cursorOffset,
      activeOrder: activeOrder(),
      workspace: [...workspace],
      slots: slots.map((slot) => ({ ...slot })),
      heap: heap.snapshot(),
    }),
    validateProfile(profile) {
      const source = profileData.lookup(profile.id);
      if (
        !source.available ||
        ['localBytes', 'stackHeaderBytes', 'argumentBytes'].some(
          (key) => source.profile[key] !== profile[key],
        )
      )
        throw new Error('task_frame_profile_mismatch');
    },
    storageFor(offset) {
      if (!assigned.has(offset)) throw new Error('Original task is not assigned');
      const record = records.get(offset);
      return createHeapFrameStorage(
        heap,
        { ...record.frame, taskOffset: offset },
        record.profile.localBytes,
      );
    },
    // Explicit source/fixture hydration of C9E0's three task WORD columns.
    // No new frame, list mutation, readiness check or inferred initialization.
    seedMotionTaskWords(offset, words) {
      const slot = get(offset);
      if (
        !words ||
        typeof words !== 'object' ||
        Array.isArray(words) ||
        Object.entries(words).some(
          ([key, value]) =>
            !['statusWord', 'successorWord', 'eventWord'].includes(key) ||
            (value !== null && !isWord(value)),
        )
      )
        throw Error('Invalid motion task source');
      Object.assign(slot, words);
    },
    readMotionTaskWord(offset, field) {
      if (!isWord(offset) || !['statusWord', 'successorWord', 'eventWord'].includes(field))
        throw Error('Invalid motion task read');
      if (offset > TASK_LAST_SLOT || offset & 1)
        return { available: false, reason: 'slot_motion_task_window_required', offset };
      const value = slots[offset / 2][field];
      return value === null
        ? { available: false, reason: 'slot_motion_task_word_source_required', offset, field }
        : { available: true, value };
    },
    writeMotionTaskEvents(offset, value) {
      if (!isWord(value)) throw Error('Invalid motion task event write');
      get(offset).eventWord = value;
    },
    readWaitEvents(offset) {
      const value = requireLinked(offset).eventWord;
      if (value === null) throw Error('task_event_source_required');
      return value;
    },
    signalWaitEvents(offset, events) {
      if (!isWord(events)) throw Error('Invalid task event word');
      const slot = requireLinked(offset);
      if (slot.eventWord === null) throw Error('task_event_source_required');
      slot.eventWord |= events;
      return slot.eventWord;
    },
    writeWorkspaceWords(words, startIndex = 0) {
      if (!Array.isArray(words) || Array.from(words).some((value) => !isWord(value)))
        throw new Error('Invalid task workspace words');
      if (
        !Number.isInteger(startIndex) ||
        startIndex < 0 ||
        startIndex + words.length > WORKSPACE_WORDS
      )
        throw new Error('task_workspace_window_required');
      words.forEach((value, index) => {
        workspace[startIndex + index] = value;
      });
    },
    invalidateWorkspace(preserveFirst = false) {
      for (let index = preserveFirst ? 1 : 0; index < workspace.length; index++)
        workspace[index] = null;
    },
    payloadFor(offset) {
      if (!assigned.has(offset)) throw new Error('Original task is not assigned');
      return heap.readPayload(records.get(offset).frame.blockOffset);
    },
    registerWait(offset, mask) {
      if (!isWord(mask)) throw new Error('Invalid original wait mask');
      const slot = requireLinked(offset);
      slot.statusWord = mask;
      slot.eventWord = 0; // C40E STZ0C62, including a zero-mask registration.
      slot.continuationWord = WAIT_RETURN_WORD; // PLA by C411 after JSR F52F at F506.
    },
    readyWait(offset) {
      requireLinked(offset).statusWord = 0;
    },
    setCursor(offset) {
      if (offset !== NO_TASK) requireLinked(offset);
      cursorOffset = offset;
    },
    appendRoot(offset) {
      const slot = get(offset);
      if (!assigned.has(offset) || linked.has(offset))
        throw new Error('Original task is not an unlinked assigned frame');
      slot.predecessorWord = tailOffset;
      slot.successorWord = NO_TASK;
      if (!(tailOffset & WORD_SIGN)) get(tailOffset).successorWord = offset;
      tailOffset = offset;
      linked.add(offset);
      return offset; // C359 TXA: original task offset, not a host ID.
    },
    insertChild(offset, continuationWord) {
      const slot = get(offset);
      if (!assigned.has(offset) || linked.has(offset))
        throw new Error('Original task is not an unlinked assigned frame');
      if (!isWord(continuationWord)) throw new Error('Invalid original continuation word');
      const parent = requireLinked(cursorOffset);
      slot.predecessorWord = cursorOffset;
      slot.successorWord = parent.successorWord;
      parent.successorWord = offset;
      parent.statusWord = WAIT_FOR_CHILD;
      parent.continuationWord = continuationWord;
      if (slot.successorWord & WORD_SIGN) tailOffset = offset;
      else get(slot.successorWord).predecessorWord = offset;
      linked.add(offset);
      return offset;
    },
    removeFrame(offset) {
      const slot = requireLinked(offset);
      const blockOffset = slot.payloadAddress - HEAP_DATA;
      const released = heap.release(blockOffset);
      if (!released.handled) throw new Error('Original task heap header is not covered');
      const predecessor = slot.predecessorWord;
      const successor = slot.successorWord;
      slot.predecessorWord = freeTaskOffset;
      freeTaskOffset = offset;
      if (cursorOffset === offset) cursorOffset = predecessor;
      if (!(predecessor & WORD_SIGN)) get(predecessor).successorWord = successor;
      if (!(successor & WORD_SIGN)) get(successor).predecessorWord = predecessor;
      else tailOffset = predecessor;
      linked.delete(offset);
      assigned.delete(offset);
      records.delete(offset);
      return { predecessor, successor, blockOffset };
    },
    resumeParent(offset) {
      const slot = requireLinked(offset);
      if (!(slot.statusWord & WORD_SIGN)) throw new Error('Original parent is not blocked');
      slot.statusWord = 0; // C229; its continuation word remains stored.
    },
    createFrame(scriptId, workspaceWords = []) {
      if (
        !Array.isArray(workspaceWords) ||
        Array.from(workspaceWords).some((value) => value !== null && !isWord(value))
      )
        throw new Error('Invalid task argument workspace');
      const source = profileData.lookup(scriptId);
      if (!source.available) return { created: false, reason: source.reason };
      const profile = source.profile;
      if (profile.argumentBytes & 1)
        return { created: false, reason: 'task_argument_profile_required' };
      const count = profile.argumentBytes / 2;
      if (
        workspaceWords.length < count ||
        workspaceWords.slice(0, count).some((value) => value === null)
      )
        return { created: false, reason: 'task_argument_source_required' };
      const byteLength = scriptAllocationBytes(profile);
      if (byteLength < MIN_FRAME_BYTES || profile.argumentBytes > byteLength)
        return { created: false, reason: 'task_frame_window_required' };
      const allocation = heap.allocate(byteLength);
      // The source continues writing at A even on allocator failure. Those
      // addresses are outside this initialized heap: retain its real merges,
      // report the actual registers, and stop before uncovered frame writes.
      if (!allocation.allocated)
        return { created: false, reason: 'task_heap_failure_continuation_required', allocation };
      const base = allocation.accumulatorWord;
      const writes = [{ offset: FRAME_RETURN, value: base + FRAME_RETURN_BASE }];
      for (let index = count - 1; index >= 0; index--)
        writes.push({ offset: byteLength - 2 * (count - index), value: workspaceWords[index] });
      writes.push(
        { offset: FRAME_OPERAND_STACK, value: base + byteLength - 1 - profile.argumentBytes },
        { offset: 0, value: (profile.headerAddress + 2) & WORD_MASK },
        // STA $74 at C2F8 replaced the high byte of the word at $73.
        {
          offset: FRAME_BANK_BYTE,
          value: (profile.bankWord & BYTE_MASK) | ((base & BYTE_MASK) << BYTE_BITS),
        },
        { offset: FRAME_PC, value: 0 }, // Overwrites that high byte and byte 4.
      );
      const applied = heap.writePayloadWords(allocation.blockOffset, writes);
      if (!applied.handled) throw new Error('Prevalidated task frame writes escaped their payload');
      const frame = {
        scriptId,
        blockOffset: allocation.blockOffset,
        payloadAddress: base,
        allocationBytes: byteLength,
        args: workspaceWords.slice(0, count).reverse(),
        writes: writes.map((write) => ({ ...write })),
        payload: heap.readPayload(allocation.blockOffset),
      };
      if (freeTaskOffset & WORD_SIGN) {
        // C32E loaded A=0; C333 loaded X=FFFF; C336 goes straight to RTS.
        // Heap allocation and initialization have already happened.
        return {
          created: false,
          reason: 'task_slot_failure_continuation_required',
          allocation,
          frame,
          originalReturn: { accumulatorWord: 0, indexWord: freeTaskOffset },
        };
      }
      const slot = slots[freeTaskOffset / 2];
      const taskOffset = freeTaskOffset;
      slot.continuationWord = slot.statusWord = 0;
      freeTaskOffset = slot.predecessorWord;
      slot.payloadAddress = base;
      assigned.add(taskOffset);
      records.set(taskOffset, {
        frame: {
          blockOffset: frame.blockOffset,
          payloadAddress: base,
          allocationBytes: byteLength,
        },
        profile,
      });
      return {
        created: true,
        taskOffset,
        frame,
        originalReturn: { accumulatorWord: base, indexWord: taskOffset },
      };
    },
  };
  allocators.add(allocator);
  return allocator;
}
