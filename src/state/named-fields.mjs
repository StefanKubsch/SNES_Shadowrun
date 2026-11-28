// Temporary bridge from named records to the existing state owners. Live records
// share their typed arrays; diagnostic fixtures and out-of-range aliases still use
// the original schema. The bridge goes with the remaining legacy state schemas.
import { WRAM_BASE } from '../constants/memory-map.mjs';
import { BYTE_MASK, WORD_MASK, LONG_MASK } from '../constants/bits.mjs';

export function stateField(mem, schema, owner, name, index = 0, bankBase = WRAM_BASE) {
  const { base, count, bytes, stride = bytes } = schema[name],
    address = (bankBase + base + index * stride) & LONG_MASK,
    inRange = Number.isInteger(index) && index >= 0 && index < count,
    mask = bytes === 1 ? BYTE_MASK : WORD_MASK;
  return {
    enumerable: true,
    get() {
      const values = owner(mem.wram)?.[name];
      if (values && inRange) return values[index];
      return bytes === 1 ? mem.read8(address) : mem.read16(address);
    },
    set(value) {
      const values = owner(mem.wram)?.[name];
      if (values && inRange) values[index] = value & mask;
      else if (bytes === 1) mem.write8(address, value & mask);
      else mem.write16(address, value & mask);
    },
  };
}
