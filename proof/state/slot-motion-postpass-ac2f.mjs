import {
  BYTE_MASK,
  BYTE_BITS,
  BYTE_SIGN,
  BYTE_VALUES,
  WORD_MASK,
  WORD_SIGN,
  WORD_BITS,
} from '../../src/constants/bits.mjs';
import { LOROM_OFFSET } from '../../src/constants/memory-map.mjs';
import {
  OBJECT_LAST_SLOT,
  VRAM_UPLOAD_SOURCES,
  VRAM_UPLOAD_BANKS,
  VRAM_UPLOAD_ADDRESSES,
} from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { isSlotActionData } from './slot-action-data.mjs';
import {
  isSlotMotionPostpassData,
  postpassOutputWordBoundary,
} from './slot-motion-postpass-data.mjs';
import { isMotionTaskSource } from '../script/motion-task-plan.mjs';

const GRAPHICS_POOL_NODE_COUNT = 120;
const GRAPHICS_POOL_LAST_NODE = (GRAPHICS_POOL_NODE_COUNT - 1) * 2;
const DP_FRAME_POINTER = 0x11;
const DP_FRAME_POINTER_BANK = 0x13;
const DP_REMAINING_NODES = 0x14;
const DP_POOL_DELTA = 0x17;
const DP_ANIMATION_TOTAL = 0x20;
const DP_FRAME_START = 0x35;
const DP_FRAME_START_BANK = 0x37;
const DP_FRAME_BANK_FLAG = 0x3b;
const DP_STREAM_POINTER = 0x3e;
const DP_STREAM_BANK = 0x40;
const DP_UPLOAD_CURSOR = 0x82;
const ACTION_DATA_BANK = 0x8c;
const FIRST_FRAME_DATA_BANK = 0x9b;
const FRAME_BANK_OFFSET_MASK = 0x3f;
const FRAME_SOURCE_WORD_MASK = 0xffc0;
const FRAME_SOURCE_BANK_BASE = 0x8e;
const UPLOAD_QUEUE_LIMIT = 0x50;
const OUTPUT_NODE_BYTES = 4;
const FRAME_TAIL_OFFSET = 3;
const FRAME_TAIL_MASK = 7;
const TAIL_OFFSET_SCALE = 4;
const BYTE_SIGN_SHIFT = BYTE_BITS - 1;
const WORD_SIGN_SHIFT = WORD_BITS - 1;
const ANIMATION_PHASE_MASK = BYTE_SIGN - 1;
const ANIMATION_END_EVENT = 8;

export const motionPostpassScratchKeys = Object.freeze(['13', '37', '82']);
class SourceBoundary extends Error {
  constructor(detail) {
    super('AC2F source boundary');
    this.detail = { handled: false, ...detail };
  }
}
const requireSource = (result) => {
  if (!result.available) {
    const { available, ...detail } = result;
    throw new SourceBoundary(detail);
  }
  if (!isWord(result.value)) throw Error('Invalid AC2F source word');
  return result.value;
};

// Native AC2F game-data plan from the complete 453-byte source contract.
// No live writes, CPU/register execution, implicit scheduler or rendering.
export function prepareMotionPostpassAC2F({
  offset,
  fields,
  count = null,
  head = null,
  freeCount,
  freeHead,
  links,
  scratchBytes,
  actionData = null,
  postpassData = null,
  tableBank = null,
  frameAllocator = null,
}) {
  if (
    !isWord(offset) ||
    !fields ||
    typeof fields !== 'object' ||
    Array.isArray(fields) ||
    Object.values(fields).some((v) => v !== null && !isWord(v)) ||
    ![count, head].every((v) => v === null || isWord(v)) ||
    !isWord(freeCount) ||
    !isWord(freeHead) ||
    !Array.isArray(links) ||
    links.length !== GRAPHICS_POOL_NODE_COUNT ||
    Array.from(links).some((v) => v !== null && !isWord(v)) ||
    !Array.isArray(scratchBytes) ||
    Array.from(scratchBytes).some(
      (e) =>
        !Array.isArray(e) ||
        e.length !== 2 ||
        !Number.isInteger(e[0]) ||
        e[0] < 0 ||
        e[0] > BYTE_MASK ||
        (e[1] !== null && (!Number.isInteger(e[1]) || e[1] < 0 || e[1] > BYTE_MASK)),
    ) ||
    (actionData !== null && !isSlotActionData(actionData)) ||
    (postpassData !== null && !isSlotMotionPostpassData(postpassData)) ||
    (tableBank !== null &&
      (!Number.isInteger(tableBank) || tableBank < 0 || tableBank > BYTE_MASK)) ||
    (frameAllocator !== null && !isMotionTaskSource(frameAllocator))
  )
    throw Error('Invalid AC2F context');
  if (offset > OBJECT_LAST_SLOT || offset & 1)
    return { handled: false, reason: 'slot_window_required' };
  const working = { ...fields },
    bytes = new Map(scratchBytes),
    poolLinks = [...links];
  const fieldWrites = {},
    scratchWrites = [],
    linkWrites = [],
    outputWrites = [],
    poolWrites = {};
  const missing = (field) => {
    throw new SourceBoundary({ reason: 'slot_motion_source_required', field });
  };
  const field = (key) => (working[key] == null ? missing(key) : working[key]);
  const setField = (key, value) => {
    working[key] = value;
    fieldWrites[key] = value;
  };
  const scratchWord = (address) => {
    const lo = bytes.get(address),
      hi = bytes.get(address + 1);
    if (lo == null || hi == null)
      throw new SourceBoundary({ reason: 'slot_motion_postpass_scratch_source_required', address });
    return lo | (hi << BYTE_BITS);
  };
  const setScratch = (address, value) => {
    bytes.set(address, value & BYTE_MASK);
    bytes.set(address + 1, value >>> BYTE_BITS);
    scratchWrites.push({ address, value });
  };
  const poolIndex = (node) => {
    if (node > GRAPHICS_POOL_LAST_NODE || node & 1)
      throw new SourceBoundary({ reason: 'slot_pool_window_required', offset: node });
    return node / 2;
  };
  const readLink = (node) => {
    const value = poolLinks[poolIndex(node)];
    return value === null ? missing('1564') : value;
  };
  const writeLink = (node, value) => {
    poolLinks[poolIndex(node)] = value;
    linkWrites.push({ offset: node, next: value });
  };
  const slotHead = () => (head === null ? missing('12F8') : head);
  const setHead = (value) => {
    head = value;
    poolWrites.head = value;
  };
  const needData = () => {
    if (!postpassData)
      throw new SourceBoundary({ reason: 'slot_motion_postpass_data_source_required' });
    return postpassData;
  };
  const streamWord = (pointer, index, bank) => {
    if (bank == null)
      throw new SourceBoundary({
        reason: 'slot_motion_postpass_scratch_source_required',
        address: DP_STREAM_BANK,
      });
    if (bank !== ACTION_DATA_BANK)
      throw new SourceBoundary({ reason: 'slot_motion_postpass_stream_bank_required', bank });
    if (!actionData) throw new SourceBoundary({ reason: 'slot_action_data_source_required' });
    return requireSource(actionData.readDataWord(pointer, index));
  };
  const framePointer = () =>
    (bytes.get(DP_FRAME_POINTER_BANK) << WORD_BITS) | scratchWord(DP_FRAME_POINTER);
  const readFrame = (pointer, index = 0) => requireSource(needData().readFrameWord(pointer, index));
  const queueWrite = (address, value) => {
    const boundary = postpassOutputWordBoundary(address);
    if (boundary) throw new SourceBoundary(boundary);
    outputWrites.push({ address, value });
  };
  const finish = (outcome, carry, extra = {}) => ({
    handled: true,
    fields: fieldWrites,
    scratchWrites,
    poolWrites,
    linkWrites,
    outputWrites,
    outcome,
    carry,
    ...extra,
  });
  try {
    let raw = field('1140');
    if (raw === WORD_MASK) {
      setField('1140', 0);
      raw = 0;
    }
    if (raw !== 0) setField('1140', 0);
    else {
      const speed = field('7E:4088'),
        phase = field('7E:4030'),
        total = speed + phase;
      setScratch(DP_ANIMATION_TOTAL, total & WORD_MASK);
      setField('7E:4030', total & ANIMATION_PHASE_MASK);
      if (total < BYTE_SIGN) return finish('fraction_only', 1);
      const carry = Number(total > WORD_MASK),
        stream = field('1090');
      if (stream === 0) return finish('no_stream', carry);
      setScratch(DP_STREAM_POINTER, stream);
      const countdown = (field('7E:3FD8') - 1) & WORD_MASK;
      setField('7E:3FD8', countdown);
      let cursor;
      if (countdown === 0) {
        const reload = field('10E8');
        if (reload === 0) {
          setField('7E:4088', 0);
          setField('1038', field('1038') | WORD_SIGN);
          let task = field('1350');
          if (task & WORD_SIGN) return finish('stopped', carry);
          if (!frameAllocator)
            throw new SourceBoundary({ reason: 'slot_motion_task_source_required' });
          const seen = new Set();
          for (;;) {
            if (seen.has(task))
              throw new SourceBoundary({ reason: 'slot_motion_task_cycle_required', offset: task });
            seen.add(task);
            const status = requireSource(frameAllocator.readMotionTaskWord(task, 'statusWord'));
            if (!(status & WORD_SIGN)) {
              const events = requireSource(frameAllocator.readMotionTaskWord(task, 'eventWord'));
              return finish('stopped', carry, {
                terminalTaskOffset: task,
                taskEventWrite: { offset: task, value: events | ANIMATION_END_EVENT },
              });
            }
            task = requireSource(frameAllocator.readMotionTaskWord(task, 'successorWord'));
          }
        }
        if (reload >= BYTE_SIGN) setField('10E8', 0);
        setField('7E:3FD8', reload >= BYTE_SIGN ? reload & ANIMATION_PHASE_MASK : reload);
        setScratch(DP_FRAME_POINTER, field('1090'));
        setScratch(DP_FRAME_POINTER_BANK, ACTION_DATA_BANK);
        cursor =
          streamWord(scratchWord(DP_FRAME_POINTER), field('1198'), ACTION_DATA_BANK) & BYTE_MASK;
      } else cursor = field('11F0');
      setField('11F0', (cursor + 2) & WORD_MASK);
      raw = streamWord(scratchWord(DP_STREAM_POINTER), cursor, bytes.get(DP_STREAM_BANK));
    }
    setScratch(DP_FRAME_POINTER, raw);
    setScratch(DP_FRAME_BANK_FLAG, (raw & WORD_SIGN) ^ WORD_SIGN);
    const bank = FIRST_FRAME_DATA_BANK + (raw >>> WORD_SIGN_SHIFT);
    setScratch(DP_FRAME_POINTER_BANK, bank);
    setScratch(DP_FRAME_START_BANK, bank);
    setScratch(DP_FRAME_POINTER, raw | LOROM_OFFSET);
    setScratch(DP_FRAME_START, raw | LOROM_OFFSET);
    const n = readFrame(framePointer()) & BYTE_MASK;
    setScratch(DP_REMAINING_NODES, n);
    const outputTotal = n * OUTPUT_NODE_BYTES + scratchWord(DP_UPLOAD_CURSOR);
    if (outputTotal <= WORD_MASK && outputTotal >= UPLOAD_QUEUE_LIMIT) {
      setField('1140', scratchWord(DP_FRAME_POINTER) ^ scratchWord(DP_FRAME_BANK_FLAG));
      return finish('retry_output', 1);
    }
    if (count === null) missing('12A0');
    const delta = n - count;
    if (delta > 0) {
      if (delta >= freeCount) {
        setField('1140', scratchWord(DP_FRAME_POINTER) ^ scratchWord(DP_FRAME_BANK_FLAG));
        return finish('retry_pool', 1);
      }
      setScratch(DP_POOL_DELTA, delta);
      freeCount = (freeCount - delta) & WORD_MASK;
      poolWrites.freeCount = freeCount;
      while (scratchWord(DP_POOL_DELTA) !== 0) {
        const node = freeHead;
        freeHead = readLink(node);
        poolWrites.freeHead = freeHead;
        writeLink(node, slotHead());
        setHead(node);
        setScratch(DP_POOL_DELTA, (scratchWord(DP_POOL_DELTA) - 1) & WORD_MASK);
      }
      count = n;
      poolWrites.count = n;
    } else if (delta < 0) {
      setScratch(DP_POOL_DELTA, -delta);
      freeCount = (freeCount - delta) & WORD_MASK;
      poolWrites.freeCount = freeCount;
      while (scratchWord(DP_POOL_DELTA) !== 0) {
        const node = slotHead();
        setHead(readLink(node));
        const oldFree = freeHead;
        freeHead = node;
        poolWrites.freeHead = freeHead;
        writeLink(node, oldFree);
        setScratch(DP_POOL_DELTA, (scratchWord(DP_POOL_DELTA) - 1) & WORD_MASK);
      }
      count = n;
      poolWrites.count = n;
    }
    setScratch(DP_FRAME_POINTER, (scratchWord(DP_FRAME_POINTER) + 1) & WORD_MASK);
    let cursor = scratchWord(DP_UPLOAD_CURSOR),
      node = slotHead();
    // Source has an unconditional do-loop, including zero header. Coverage
    // stops before any live effects if queue/data/pool words are unsupported.
    do {
      for (const second of [false, true]) {
        cursor = (cursor + 2) & WORD_MASK;
        queueWrite(
          VRAM_UPLOAD_SOURCES + cursor,
          readFrame(framePointer()) & FRAME_SOURCE_WORD_MASK,
        );
        queueWrite(
          VRAM_UPLOAD_BANKS + cursor,
          (readFrame(framePointer()) & FRAME_BANK_OFFSET_MASK) + FRAME_SOURCE_BANK_BASE,
        );
        queueWrite(
          VRAM_UPLOAD_ADDRESSES + cursor,
          requireSource(needData().readTableWord(node, second, tableBank)),
        );
        setScratch(DP_FRAME_POINTER, (scratchWord(DP_FRAME_POINTER) + 2) & WORD_MASK);
      }
      node = readLink(node);
      setScratch(DP_REMAINING_NODES, (scratchWord(DP_REMAINING_NODES) - 1) & WORD_MASK);
    } while (scratchWord(DP_REMAINING_NODES) !== 0);
    setScratch(DP_UPLOAD_CURSOR, cursor);
    setField('7E:3F80', scratchWord(DP_FRAME_POINTER) ^ scratchWord(DP_FRAME_BANK_FLAG));
    const tail = readFrame(framePointer(), FRAME_TAIL_OFFSET) & FRAME_TAIL_MASK;
    setField('0F88', tail);
    let carry = 0;
    if (tail !== 0) {
      setField('0F88', tail | WORD_SIGN);
      setScratch(DP_FRAME_START, (scratchWord(DP_FRAME_START) - 1) & WORD_MASK);
      const byte =
        readFrame((bytes.get(DP_FRAME_START_BANK) << WORD_BITS) | scratchWord(DP_FRAME_START)) &
        BYTE_MASK;
      setField(
        '0FE0',
        ((byte < BYTE_SIGN ? byte : byte - BYTE_VALUES) * TAIL_OFFSET_SCALE) & WORD_MASK,
      );
      carry = byte >>> BYTE_SIGN_SHIFT;
    }
    return finish('output', carry);
  } catch (error) {
    if (error instanceof SourceBoundary) return error.detail;
    throw error;
  }
}
