import {
  BYTE_MASK,
  BYTE_BITS,
  WORD_BITS,
  WORD_MASK,
  LONG_MASK,
} from '../../src/constants/bits.mjs';
import { WRAM_HIGH_BANK } from '../../src/constants/memory-map.mjs';
import {
  WRAM,
  STATIC_NODE_END,
  STATIC_CELL_HEADS,
  COLLISION_CELL_HEADS,
  COLLISION_NODE_BOX,
  COLLISION_NODE_NEXT,
  COLLISION_BOX_X0,
  COLLISION_BOX_OBJECT,
  COLLISION_BOX_BYTES,
  PLAYER_OBJECT,
  PLAYER_HIT_FRAMES,
} from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';

// Explicit source hydration windows; their holes are never initialized implicitly.
const MOTION_DATA_WINDOWS = [
  [0x7edeaa, 0x7effff],
  [0x7fe214, 0x7fffff],
  [0x7e0cc2, 0x7e0cc3],
  [0x7e1d5a, 0x7e1d6f],
];
const PREFIX_RESET_WORD_ADDRESSES = [0x7e1d5b, 0x7e1d5d, 0x7e1d5f, 0x7e1d65, 0x7e1d6b, 0x7e1d6d];
const MOTION_ADDRESS = Object.freeze({
  STATIC_NODE_END: WRAM + STATIC_NODE_END,
  STATIC_HEADS: WRAM + STATIC_CELL_HEADS,
  DYNAMIC_HEADS: WRAM + COLLISION_CELL_HEADS,
  NODE_RECORD: WRAM + COLLISION_NODE_BOX,
  NODE_NEXT: WRAM + COLLISION_NODE_NEXT,
  BOX_FIELDS: WRAM + COLLISION_BOX_X0,
  SPECIAL_SLOT: WRAM + PLAYER_OBJECT,
  PREFIX_COUNTER: WRAM + PLAYER_HIT_FRAMES,
});
const LOW_WRAM_LAST = WRAM + WORD_MASK;
const HIGH_WRAM_LAST = (WRAM_HIGH_BANK << WORD_BITS) + WORD_MASK;
const LAST_BOX_FIELD = COLLISION_BOX_BYTES / 2 - 1;

const instances = new WeakMap();
export const isSlotMotionData = (data) => instances.has(data);
const windows = MOTION_DATA_WINDOWS;
export const motionPrefixResetAddresses = Object.freeze(PREFIX_RESET_WORD_ADDRESSES);
const covered = (address) => windows.some(([first, last]) => address >= first && address <= last);
// Dedicated 8799 write scope. No first-list/DEAA/special-slot initialization.
export function motionPreludeWordBoundary(address) {
  if (!Number.isInteger(address) || address < 0 || address > LONG_MASK)
    throw Error('Invalid motion prelude address');
  return (address >= MOTION_ADDRESS.DYNAMIC_HEADS && address + 1 <= LOW_WRAM_LAST) ||
    (address >= COLLISION_BOX_OBJECT && address + 1 <= HIGH_WRAM_LAST)
    ? null
    : { handled: false, reason: 'slot_motion_data_window_required', address };
}

// Explicit source bytes and dedicated 8799/DE94/88 writes for motion WRAM data.
// No ROM extraction, fabricated empty first heads or general memory bus.
export function createSlotMotionData() {
  return createData(new Map());
}

// A bounded planning copy retains known bytes and exact Prelude aliases.
// Only the original owner receives writes after the complete AFC4 succeeds.
export function prepareMotionDataView(source, writes) {
  if (!isSlotMotionData(source)) throw Error('Invalid motion data view source');
  const data = createData(new Map(instances.get(source)));
  const result = data.writePreludeWords(writes);
  return result.handled ? { handled: true, data } : result;
}

function createData(bytes) {
  const read = (base, index) => {
    if (!isWord(index)) throw new Error('Invalid slot motion data index');
    const address = base + index;
    // Only reads wholly inside the base bank/window are supported. Bank
    // boundary addressing is not inferred or aliased to another table.
    if (
      address >>> WORD_BITS !== base >>> WORD_BITS ||
      (address + 1) >>> WORD_BITS !== base >>> WORD_BITS ||
      !covered(address) ||
      !covered(address + 1)
    )
      return { available: false, reason: 'slot_motion_data_window_required', address };
    if (!bytes.has(address) || !bytes.has(address + 1))
      return { available: false, reason: 'slot_motion_data_source_required', address };
    return { available: true, value: bytes.get(address) | (bytes.get(address + 1) << BYTE_BITS) };
  };
  const data = {
    seed(address, values) {
      if (
        !Number.isInteger(address) ||
        !(Array.isArray(values) || values instanceof Uint8Array) ||
        values.length < 1 ||
        Array.from(values).some(
          (value, index) =>
            !Number.isInteger(value) || value < 0 || value > BYTE_MASK || !covered(address + index),
        )
      )
        throw new Error('Invalid slot motion data seed');
      for (let index = 0; index < values.length; index++) bytes.set(address + index, values[index]);
    },
    snapshot: () => ({
      windows: windows.map((range) => [...range]),
      bytes: [...bytes].sort(([a], [b]) => a - b).map((entry) => [...entry]),
    }),
    readHead(list, index) {
      if (![0, 1].includes(list)) throw new Error('Invalid slot motion list');
      return read(list === 0 ? MOTION_ADDRESS.STATIC_HEADS : MOTION_ADDRESS.DYNAMIC_HEADS, index);
    },
    readNodeRecord: (node) => read(MOTION_ADDRESS.NODE_RECORD, node),
    readNextNode: (node) => read(MOTION_ADDRESS.NODE_NEXT, node),
    readRecordField(record, field) {
      if (!Number.isInteger(field) || field < 0 || field > LAST_BOX_FIELD)
        throw new Error('Invalid slot motion record field');
      return read(MOTION_ADDRESS.BOX_FIELDS + field * 2, record);
    },
    readMetadata(record) {
      if (!isWord(record)) throw new Error('Invalid slot motion record');
      return read(COLLISION_BOX_OBJECT, record >>> 2);
    },
    readSpecialSlot: () => read(MOTION_ADDRESS.SPECIAL_SLOT, 0),
    readPrefixCounter: () => read(MOTION_ADDRESS.PREFIX_COUNTER, 0),
    // Dedicated DE94 WORD owner; no neighboring byte or initializer writes.
    writePrefixCounter(value) {
      if (!isWord(value)) throw Error('Invalid motion prefix counter');
      bytes.set(MOTION_ADDRESS.PREFIX_COUNTER, value & BYTE_MASK);
      bytes.set(MOTION_ADDRESS.PREFIX_COUNTER + 1, value >>> BYTE_BITS);
    },
    // The complete six-WORD reset uses the same counter bytes as DE94.
    // Check every write before commit; hydration of holes/neighbors grants
    // no write capability for them. No callback or source read during commit.
    writePrefixResetWords(writes) {
      if (
        !Array.isArray(writes) ||
        writes.length !== PREFIX_RESET_WORD_ADDRESSES.length ||
        Array.from(writes).some((w) => !w || !isWord(w.value))
      )
        throw Error('Invalid motion prefix reset writes');
      for (let index = 0; index < writes.length; index++) {
        const { address } = writes[index];
        if (!Number.isInteger(address) || address < 0 || address > LONG_MASK)
          throw Error('Invalid motion prefix reset address');
        if (address !== motionPrefixResetAddresses[index])
          return { handled: false, reason: 'slot_motion_data_window_required', address };
      }
      for (const { address, value } of writes) {
        bytes.set(address, value & BYTE_MASK);
        bytes.set(address + 1, value >>> BYTE_BITS);
      }
      return { handled: true };
    },
    readPreludeNodeBase: () => read(MOTION_ADDRESS.STATIC_NODE_END, 0),
    // Validate the complete dedicated plan before touching any shared bytes.
    // Odd WORD addresses and overlapping source writes retain their order.
    writePreludeWords(writes) {
      if (!Array.isArray(writes) || Array.from(writes).some((w) => !w || !isWord(w.value)))
        throw Error('Invalid motion prelude writes');
      for (const write of writes) {
        const boundary = motionPreludeWordBoundary(write.address);
        if (boundary) return boundary;
      }
      for (const { address, value } of writes) {
        bytes.set(address, value & BYTE_MASK);
        bytes.set(address + 1, value >>> BYTE_BITS);
      }
      return { handled: true };
    },
  };
  instances.set(data, bytes);
  return Object.freeze(data);
}
