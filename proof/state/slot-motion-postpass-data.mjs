import {
  BYTE_MASK,
  BYTE_BITS,
  WORD_MASK,
  WORD_BITS,
  LONG_MASK,
} from '../../src/constants/bits.mjs';
import { CODE_BANK, LOROM_OFFSET } from '../../src/constants/memory-map.mjs';
import { VRAM_UPLOAD_BANKS } from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';

const POSTPASS_OUTPUT_LAST = 0x17d3;
const FIRST_FRAME_BANK = 0x9b;
const SECOND_FRAME_BANK = 0x9c;
const FRAME_DATA_BYTES = 2 * LOROM_OFFSET;
const POSTPASS_TABLE_BYTES = 272;
const SECOND_TABLE_OFFSET = 16;
const POSTPASS_TABLE_START = 0xaeb4;

const instances = new WeakSet();
export const isSlotMotionPostpassData = (value) => instances.has(value);
export const postpassOutputWordBoundary = (address) =>
  Number.isInteger(address) && address >= VRAM_UPLOAD_BANKS && address + 1 <= POSTPASS_OUTPUT_LAST
    ? null
    : { handled: false, reason: 'slot_motion_postpass_output_window_required', address };
const byteArray = (values, length) =>
  Array.isArray(values) &&
  values.length === length &&
  Array.from(values).every((v) => Number.isInteger(v) && v >= 0 && v <= BYTE_MASK);

// Fixed extracted data banks 9B/9C and bank 80 table; bounded output byte owner.
// No record meanings, cursor initialisation, DMA or generic ROM/address bus.
export function createSlotMotionPostpassData(asset) {
  if (
    asset?.format !== 'shadowrun-e-motion-postpass-data-v1' ||
    asset.romSha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690' ||
    JSON.stringify(asset.sourceCpuWindows) !== JSON.stringify(['9B:8000-FFFF', '9C:8000-FFFF']) ||
    asset.sourceRomOffset !== '0D8000' ||
    asset.tableCpu !== '80:AEB4' ||
    asset.tableRomOffset !== '002EB4' ||
    !byteArray(asset.bytes, FRAME_DATA_BYTES) ||
    !byteArray(asset.tableBytes, POSTPASS_TABLE_BYTES)
  )
    throw Error('Invalid motion postpass data');
  const frames = Uint8Array.from(asset.bytes),
    table = Uint8Array.from(asset.tableBytes),
    output = new Map();
  const data = {
    readFrameWord(pointer, index = 0) {
      if (!Number.isInteger(pointer) || pointer < 0 || pointer > LONG_MASK || !isWord(index))
        throw Error('Invalid motion postpass pointer');
      const address = pointer + index,
        bank = address >>> WORD_BITS,
        word = address & WORD_MASK;
      if (
        ![FIRST_FRAME_BANK, SECOND_FRAME_BANK].includes(bank) ||
        word < LOROM_OFFSET ||
        word === WORD_MASK
      )
        return { available: false, reason: 'slot_motion_postpass_data_window_required', address };
      const offset = (bank - FIRST_FRAME_BANK) * LOROM_OFFSET + word - LOROM_OFFSET;
      return { available: true, value: frames[offset] | (frames[offset + 1] << BYTE_BITS) };
    },
    readTableWord(node, second, bank) {
      if (
        !isWord(node) ||
        typeof second !== 'boolean' ||
        (bank !== null && (!Number.isInteger(bank) || bank < 0 || bank > BYTE_MASK))
      )
        throw Error('Invalid motion postpass table index');
      if (![0, CODE_BANK].includes(bank))
        return { available: false, reason: 'slot_motion_postpass_table_bank_required' };
      const offset = node + (second ? SECOND_TABLE_OFFSET : 0);
      if (offset + 1 >= table.length)
        return {
          available: false,
          reason: 'slot_motion_postpass_table_window_required',
          address: (bank << WORD_BITS) + POSTPASS_TABLE_START + offset,
        };
      return { available: true, value: table[offset] | (table[offset + 1] << BYTE_BITS) };
    },
    writeOutputWords(writes) {
      if (!Array.isArray(writes) || Array.from(writes).some((w) => !w || !isWord(w.value)))
        throw Error('Invalid motion postpass output writes');
      for (const write of writes) {
        const boundary = postpassOutputWordBoundary(write.address);
        if (boundary) return boundary;
      }
      for (const { address, value } of writes) {
        output.set(address, value & BYTE_MASK);
        output.set(address + 1, value >>> BYTE_BITS);
      }
      return { handled: true };
    },
    snapshot: () => ({
      outputBytes: [...output].sort(([a], [b]) => a - b).map((entry) => [...entry]),
    }),
    describe: () => ({
      sourceCpuWindows: ['9B:8000-FFFF', '9C:8000-FFFF'],
      sourceRomOffset: '0D8000',
      byteLength: FRAME_DATA_BYTES,
      tableCpu: '80:AEB4',
      tableByteLength: POSTPASS_TABLE_BYTES,
      outputWindow: [VRAM_UPLOAD_BANKS, POSTPASS_OUTPUT_LAST],
    }),
  };
  instances.add(data);
  return Object.freeze(data);
}
