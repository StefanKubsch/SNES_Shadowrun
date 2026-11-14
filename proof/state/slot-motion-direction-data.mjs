import { BYTE_MASK, BYTE_BITS } from '../../src/constants/bits.mjs';
import { CODE_BANK } from '../../src/constants/memory-map.mjs';
import { isWord } from '../script/runtime.mjs';

const DIRECTION_COUNT = 8;
const LAST_DIRECTION = DIRECTION_COUNT - 1;
const AXIS_TABLE_BYTES = DIRECTION_COUNT * 2;
const SELECTION_TABLE_BYTES = AXIS_TABLE_BYTES * 2;
const DIRECTION_DATA_BYTES = SELECTION_TABLE_BYTES * 2;

const instances = new WeakSet();
export const isSlotMotionDirectionData = (data) => instances.has(data);

// Four extracted WORD tables only, never a CPU bus or a DBR7E WRAM fallback.
export function createSlotMotionDirectionData(asset) {
  if (
    asset?.format !== 'shadowrun-e-slot-motion-direction-data-v1' ||
    asset.romSha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690' ||
    asset.sourceCpu !== '80:C7CC' ||
    asset.sourceRomOffset !== '0047CC' ||
    !Array.isArray(asset.bytes) ||
    asset.bytes.length !== DIRECTION_DATA_BYTES ||
    Array.from(asset.bytes).some((v) => !Number.isInteger(v) || v < 0 || v > BYTE_MASK)
  )
    throw Error('Invalid slot motion direction data');
  const bytes = Uint8Array.from(asset.bytes);
  const data = {
    readMotionWord(direction, selection, axis, bank) {
      if (
        !Number.isInteger(direction) ||
        direction < 0 ||
        direction > LAST_DIRECTION ||
        !isWord(selection) ||
        ![0, 1].includes(axis) ||
        (bank !== null && (!Number.isInteger(bank) || bank < 0 || bank > BYTE_MASK))
      )
        throw Error('Invalid slot motion direction input');
      if (bank !== 0 && bank !== CODE_BANK)
        return { available: false, reason: 'slot_motion_direction_bank_required' };
      const index =
        (selection === 2 ? SELECTION_TABLE_BYTES : 0) + axis * AXIS_TABLE_BYTES + direction * 2;
      return { available: true, value: bytes[index] | (bytes[index + 1] << BYTE_BITS) };
    },
  };
  instances.add(data);
  return Object.freeze(data);
}
