import { BYTE_MASK, BYTE_BITS, WORD_MASK, BANK_SIZE } from '../../src/constants/bits.mjs';
import { isWord } from '../script/runtime.mjs';

const DEFINITION_DATA_START = 0xefb4;
const DEFINITION_WINDOW_BYTES = BANK_SIZE - DEFINITION_DATA_START;
const DEFINITION_STRIDE_BYTES = 6;
const DEFINITION_CARRY_BIT = 14;

const instances = new WeakSet();
export const isSlotDefinitions = (data) => instances.has(data);

// The bounded data window actually addressed by native A9. Its logical record
// extent/meanings remain unassigned; this is not a CPU ROM/address-bus reader.
export function createSlotDefinitions(asset) {
  if (
    asset?.format !== 'shadowrun-e-slot-definitions-v1' ||
    asset.romSha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690' ||
    asset.sourceCpu !== '8C:EFB4' ||
    !Array.isArray(asset.bytes) ||
    asset.bytes.length < 2 ||
    asset.bytes.length > DEFINITION_WINDOW_BYTES ||
    Array.from(asset.bytes).some(
      (value) => !Number.isInteger(value) || value < 0 || value > BYTE_MASK,
    )
  )
    throw new Error('Invalid slot definition data');
  const bytes = Uint8Array.from(asset.bytes);
  const data = {
    lookup(definitionWord) {
      if (!isWord(definitionWord)) throw new Error('Invalid slot definition word');
      // A8CB ASL -> save doubled word; A8CE ASL -> carry=original bit 14;
      // A8CF ADC adds doubled word AND that carry, without a preceding CLC.
      const byteOffset =
        (definitionWord * DEFINITION_STRIDE_BYTES +
          ((definitionWord >>> DEFINITION_CARRY_BIT) & 1)) &
        WORD_MASK;
      if (byteOffset + 1 >= bytes.length)
        return { available: false, reason: 'slot_definition_window_required' };
      return {
        available: true,
        value: bytes[byteOffset] | (bytes[byteOffset + 1] << BYTE_BITS),
        byteOffset,
      };
    },
  };
  instances.add(data);
  return data;
}
