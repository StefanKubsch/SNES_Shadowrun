import {
  BYTE_MASK,
  BYTE_BITS,
  WORD_MASK,
  WORD_BITS,
  LONG_MASK,
  BANK_MASK,
} from '../../src/constants/bits.mjs';
import { LOROM_OFFSET } from '../../src/constants/memory-map.mjs';
import { isWord } from '../script/runtime.mjs';

const FIRST_TARGET_BANK = 0x99;
const SECOND_TARGET_BANK = 0x9a;
const TARGET_WINDOW_BYTES = 2 * LOROM_OFFSET;
// The A58B/A59E count-prefixed records advance fourteen bytes per entry.
const TARGET_RECORD_BYTES = 14;

const instances = new WeakSet();
export const isSlotTargetData = (data) => instances.has(data);
const isPointer = (value) => Number.isInteger(value) && value >= 0 && value <= LONG_MASK;

// Original F3-indexed data only. The lower halves of banks 99 and 9A are not
// in this extracted window and must never alias neighboring ROM bytes.
export function createSlotTargetData(asset) {
  if (
    asset?.format !== 'shadowrun-e-slot-target-data-v1' ||
    asset.romSha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690' ||
    asset.sourceRomOffset !== '0C8000' ||
    !Array.isArray(asset.sourceCpuWindows) ||
    asset.sourceCpuWindows.join(',') !== '99:8000-FFFF,9A:8000-FFFF' ||
    !Array.isArray(asset.bytes) ||
    asset.bytes.length !== TARGET_WINDOW_BYTES ||
    Array.from(asset.bytes).some(
      (value) => !Number.isInteger(value) || value < 0 || value > BYTE_MASK,
    )
  )
    throw new Error('Invalid slot target data');
  const bytes = Uint8Array.from(asset.bytes);
  const offset = (address) => {
    const bank = address >>> WORD_BITS;
    const word = address & WORD_MASK;
    return (bank === FIRST_TARGET_BANK || bank === SECOND_TARGET_BANK) && word >= LOROM_OFFSET
      ? (bank - FIRST_TARGET_BANK) * LOROM_OFFSET + word - LOROM_OFFSET
      : -1;
  };
  const readWord = (pointer, index = 0) => {
    if (!isPointer(pointer) || !isWord(index)) throw new Error('Invalid slot target pointer');
    const first = offset(pointer + index);
    const second = offset(pointer + index + 1);
    if (first < 0 || second < 0)
      return { available: false, reason: 'slot_target_data_window_required' };
    return { available: true, value: bytes[first] | (bytes[second] << BYTE_BITS) };
  };
  const data = {
    describe: () => ({
      sourceCpuWindows: ['99:8000-FFFF', '9A:8000-FFFF'],
      sourceRomOffset: '0C8000',
      byteLength: bytes.length,
    }),
    readWord,
    deriveF3From9D(pointer9D) {
      if (!isPointer(pointer9D)) throw new Error('Invalid slot target pointer');
      // A58B/A59E perform WORD reads even though they retain only the low
      // byte. SEC/ADC adds one, and stores only the low pointer word.
      const first = readWord(pointer9D);
      if (!first.available) return first;
      const bank = pointer9D & BANK_MASK;
      const intermediatePointer =
        bank |
        (((pointer9D & WORD_MASK) + TARGET_RECORD_BYTES * (first.value & BYTE_MASK) + 1) &
          WORD_MASK);
      const second = readWord(intermediatePointer);
      if (!second.available) return second;
      return {
        available: true,
        pointer:
          bank |
          (((intermediatePointer & WORD_MASK) +
            TARGET_RECORD_BYTES * (second.value & BYTE_MASK) +
            1) &
            WORD_MASK),
        intermediatePointer,
        firstCount: first.value & BYTE_MASK,
        secondCount: second.value & BYTE_MASK,
      };
    },
  };
  instances.add(data);
  return Object.freeze(data);
}
