import {
  BYTE_MASK,
  BYTE_BITS,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../../src/constants/bits.mjs';
import { WRAM_BANK, WRAM_HIGH_BANK } from '../../src/constants/memory-map.mjs';
import {
  WRAM,
  OBJECT_LAST_SLOT,
  OBJECT_IN_GRID,
  COLLISION_CELLS,
  COLLISION_BOX_BYTES,
  MOVING_BOX_FIRST,
  CELL_COORDINATE_MASK,
  COLLISION_CELL_HEADS,
  COLLISION_BOX_X0,
  COLLISION_BOX_Y0,
  COLLISION_BOX_BOTTOM,
  COLLISION_BOX_X1,
  COLLISION_BOX_Y1,
  COLLISION_BOX_TOP,
  COLLISION_NODE_BOX,
  COLLISION_NODE_NEXT,
  COLLISION_BOX_OBJECT,
} from '../../src/task/wram.mjs';
import { CELL_X_INDEX_SHIFT } from './slot-motion-search.mjs';
import { isWord } from '../script/runtime.mjs';
import { isSlotMotionData, motionPreludeWordBoundary } from './slot-motion-data.mjs';

const OBJECT_SLOT_COUNT = OBJECT_LAST_SLOT / 2 + 1;
const CELL_HEAD_BYTES = COLLISION_CELLS * 2;
const NO_NODE = WORD_MASK;
const COLLISION_ADDRESS = Object.freeze({
  HEADS: WRAM + COLLISION_CELL_HEADS,
  X0: WRAM + COLLISION_BOX_X0,
  Y0: WRAM + COLLISION_BOX_Y0,
  BOTTOM: WRAM + COLLISION_BOX_BOTTOM,
  TOP: WRAM + COLLISION_BOX_TOP,
  X1: WRAM + COLLISION_BOX_X1,
  Y1: WRAM + COLLISION_BOX_Y1,
  NODE_BOX: WRAM + COLLISION_NODE_BOX,
  NODE_NEXT: WRAM + COLLISION_NODE_NEXT,
});

export const motionPreludeScratchKeys = Object.freeze([
  'A0',
  '41',
  '44',
  '47',
  '4D',
  '50',
  '53',
  '56',
  '59',
]);
const slotOffset = (value) => isWord(value) && value <= OBJECT_LAST_SLOT && !(value & 1);
const missing = (field, offset) => ({
  handled: false,
  reason: 'slot_motion_source_required',
  field,
  ...(offset !== undefined ? { offset } : {}),
});

// One pure 8799 plan. These are game-data calculations, not CPU/scene execution.
export function prepareMotionPrelude8799({
  lastOffset,
  entries,
  readSlotField = null,
  motionData = null,
}) {
  if (
    (lastOffset !== null && !isWord(lastOffset)) ||
    !Array.isArray(entries) ||
    entries.length > OBJECT_SLOT_COUNT ||
    (readSlotField !== null && typeof readSlotField !== 'function') ||
    (motionData !== null && !isSlotMotionData(motionData))
  )
    throw Error('Invalid motion prelude context');
  if (!motionData) return { handled: false, reason: 'slot_motion_data_source_required' };
  const writes = [],
    scratch = {},
    staged = new Map();
  const write = (address, value, bank = WRAM_BANK) => {
    if (address >>> WORD_BITS !== bank)
      return { handled: false, reason: 'slot_motion_data_window_required', address };
    const boundary = motionPreludeWordBoundary(address);
    if (boundary) return boundary;
    writes.push({ address, value });
    staged.set(address, value & BYTE_MASK);
    staged.set(address + 1, value >>> BYTE_BITS);
    return null;
  };
  // Reset precedes node-base and active-list reads even for an empty list.
  for (let index = 0; index < CELL_HEAD_BYTES; index += 2)
    write(COLLISION_ADDRESS.HEADS + index, NO_NODE);
  const nodeBase = motionData.readPreludeNodeBase();
  if (!nodeBase.available)
    return { handled: false, reason: nodeBase.reason, address: nodeBase.address };
  let node = nodeBase.value;
  scratch.A0 = node;
  if (lastOffset === null) return missing('14B0');
  if (!(lastOffset & WORD_SIGN)) {
    if (lastOffset > OBJECT_LAST_SLOT || lastOffset & 1)
      return {
        handled: false,
        reason: 'slot_motion_active_list_window_required',
        offset: lastOffset,
      };
    let record = MOVING_BOX_FIRST;
    scratch['20'] = record;
    for (let cursor = lastOffset; cursor >= 0; cursor -= 2) {
      const offset = entries[cursor / 2];
      if (offset == null) return missing('14B2', cursor);
      if (!isWord(offset)) throw Error('Invalid motion prelude entry');
      if (!slotOffset(offset)) return { handled: false, reason: 'slot_window_required', offset };
      if (!readSlotField) return missing('1458', offset);
      const values = {};
      const read = (key) => {
        const result = readSlotField(offset, key);
        if (!result || typeof result.available !== 'boolean')
          throw Error('Invalid motion prelude field source');
        if (!result.available) return missing(key, offset);
        if (!isWord(result.value)) throw Error('Invalid motion prelude field source');
        values[key] = result.value;
        return null;
      };
      let boundary = read('1458');
      if (boundary) return boundary;
      if (!(values['1458'] & OBJECT_IN_GRID)) continue;
      boundary = read('7E:43A0');
      if (boundary) return boundary;
      if (values['7E:43A0'] === 0) continue;
      // Preserve the source's conditional reads and f0/f1/f2/f5/f3/f4 writes.
      for (const key of ['0E28', '7E:4240']) {
        boundary = read(key);
        if (boundary) return boundary;
      }
      const first = values['0E28'] >>> 2,
        f0 = (first + values['7E:4240']) & WORD_MASK;
      scratch['1A'] = first;
      scratch['3E'] = (f0 & CELL_COORDINATE_MASK) >>> CELL_X_INDEX_SHIFT;
      boundary = write(COLLISION_ADDRESS.X0 + record, f0);
      if (boundary) return boundary;
      for (const key of ['0E80', '7E:42F0']) {
        boundary = read(key);
        if (boundary) return boundary;
      }
      const second = values['0E80'] >>> 2,
        f1 = (second + values['7E:42F0']) & WORD_MASK;
      scratch['1D'] = second;
      scratch['44'] = (f1 & CELL_COORDINATE_MASK) >>> 1;
      scratch['50'] = scratch['3E'] | scratch['44'];
      boundary = write(COLLISION_ADDRESS.Y0 + record, f1);
      if (boundary) return boundary;
      boundary = read('0ED8');
      if (boundary) return boundary;
      const third = values['0ED8'] >>> 2;
      boundary = write(COLLISION_ADDRESS.BOTTOM + record, third);
      if (boundary) return boundary;
      boundary = read('7E:43A0');
      if (boundary) return boundary;
      boundary = write(COLLISION_ADDRESS.TOP + record, (third + values['7E:43A0']) & WORD_MASK);
      if (boundary) return boundary;
      boundary = read('7E:4298');
      if (boundary) return boundary;
      const f3 = (first + values['7E:4298']) & WORD_MASK;
      boundary = write(COLLISION_ADDRESS.X1 + record, f3);
      if (boundary) return boundary;
      scratch['41'] = (f3 & CELL_COORDINATE_MASK) >>> CELL_X_INDEX_SHIFT;
      boundary = read('7E:4348');
      if (boundary) return boundary;
      const f4 = (second + values['7E:4348']) & WORD_MASK;
      boundary = write(COLLISION_ADDRESS.Y1 + record, f4);
      if (boundary) return boundary;
      scratch['47'] = (f4 & CELL_COORDINATE_MASK) >>> 1;
      scratch['53'] = scratch['41'] | scratch['47'];
      scratch['56'] = scratch['41'] | scratch['44'];
      scratch['59'] = scratch['3E'] | scratch['47'];
      scratch['4D'] = record;
      const indices =
        scratch['50'] === scratch['53']
          ? [scratch['50']]
          : scratch['53'] === scratch['56'] || scratch['53'] === scratch['59']
            ? [scratch['50'], scratch['53']]
            : [scratch['50'], scratch['53'], scratch['56'], scratch['59']];
      for (const index of indices) {
        boundary = write(COLLISION_ADDRESS.NODE_BOX + node, record);
        if (boundary) return boundary;
        const headAddress = COLLISION_ADDRESS.HEADS + index;
        const oldHead = staged.get(headAddress) | (staged.get(headAddress + 1) << BYTE_BITS);
        boundary = write(COLLISION_ADDRESS.NODE_NEXT + node, oldHead);
        if (boundary) return boundary;
        boundary = write(headAddress, node);
        if (boundary) return boundary;
        node = (node + 2) & WORD_MASK;
      }
      scratch.A0 = node;
      scratch['20'] = (record + COLLISION_BOX_BYTES) & WORD_MASK;
      // Source reloads 14B2 after PLY; supported high-WRAM writes cannot alias it.
      boundary = write(COLLISION_BOX_OBJECT + (record >>> 2), offset, WRAM_HIGH_BANK);
      if (boundary) return boundary;
      record = scratch['20'];
    }
  }
  return { handled: true, dataWrites: writes, scratchWords: scratch };
}
