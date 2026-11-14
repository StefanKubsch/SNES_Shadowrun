import { BYTE_MASK, BYTE_BITS, WORD_MASK } from '../../src/constants/bits.mjs';
import { LOROM_OFFSET } from '../../src/constants/memory-map.mjs';
import { isWord } from '../script/runtime.mjs';

// Original definition pointer table at 8C:ED8A, relative to 8C:8000.
const ACTION_DEFINITION_TABLE_OFFSET = 0x6d8a;

const instances = new WeakSet();
export const isSlotActionData = (data) => instances.has(data);

// Fixed extracted game-data window. Only the table and indexed data reads
// used by A985/6A are exposed; no CPU, generic address bus or ROM loading.
export function createSlotActionData(asset) {
  if (
    asset?.format !== 'shadowrun-e-slot-action-data-v1' ||
    asset.romSha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690' ||
    asset.sourceCpu !== '8C:8000' ||
    asset.sourceRomOffset !== '060000' ||
    !Array.isArray(asset.bytes) ||
    asset.bytes.length !== LOROM_OFFSET ||
    Array.from(asset.bytes).some(
      (value) => !Number.isInteger(value) || value < 0 || value > BYTE_MASK,
    )
  )
    throw new Error('Invalid slot action data');
  const bytes = Uint8Array.from(asset.bytes);
  const read = (byteOffset, width) => {
    if (byteOffset < 0 || byteOffset + width > bytes.length)
      return { available: false, reason: 'slot_action_data_window_required' };
    return {
      available: true,
      value:
        width === 1 ? bytes[byteOffset] : bytes[byteOffset] | (bytes[byteOffset + 1] << BYTE_BITS),
      byteOffset,
    };
  };
  const indexedOffset = (pointerWord, indexWord) => {
    if (!isWord(pointerWord) || !isWord(indexWord))
      throw new Error('Invalid slot action data index');
    // Original long-indexed addressing adds Y without wrapping the low word.
    // Bank 8D and low-bank RAM/hardware are outside this source-data window.
    return pointerWord + indexWord - LOROM_OFFSET;
  };
  const data = {
    describe: () => ({ sourceCpu: '8C:8000', sourceRomOffset: '060000', byteLength: bytes.length }),
    readDefinitionPointer(definitionWord) {
      if (!isWord(definitionWord)) throw new Error('Invalid slot action definition word');
      // A999 ASL/TAX makes a wrapped 16-bit X. The following long table
      // access adds that X to 8C:ED8A; it does not wrap inside bank 8C.
      return read(ACTION_DEFINITION_TABLE_OFFSET + ((definitionWord * 2) & WORD_MASK), 2);
    },
    readDataByte(pointerWord, indexWord = 0) {
      return read(indexedOffset(pointerWord, indexWord), 1);
    },
    readDataWord(pointerWord, indexWord = 0) {
      return read(indexedOffset(pointerWord, indexWord), 2);
    },
  };
  instances.add(data);
  return Object.freeze(data);
}
