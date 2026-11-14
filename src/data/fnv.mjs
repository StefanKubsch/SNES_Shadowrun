// FNV-1a (32 bit) over a list of values, the check value of driver bytes,
// save games, WRAM and sound output. Each value is XORed in whole, so a
// Uint16Array hashes 16-bit words. start continues an earlier hash.
export const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
export function fnv1a(values, start = FNV_OFFSET) {
  let h = start;
  for (let i = 0; i < values.length; i++) h = Math.imul(h ^ values[i], FNV_PRIME) >>> 0;
  return h;
}
