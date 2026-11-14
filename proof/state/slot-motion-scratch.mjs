import { BYTE_MASK, BYTE_BITS, HEX_RADIX } from '../../src/constants/bits.mjs';
import { isWord } from '../script/runtime.mjs';

// Shared motion DP bytes only, not a CPU/address bus. Word views preserve
// unknown neighbouring bytes and aliases across all motion data operations.
export function createMotionScratch(keys, sourceBytes = []) {
  const addresses = new Set(
    keys.flatMap((key) => [parseInt(key, HEX_RADIX), parseInt(key, HEX_RADIX) + 1]),
  );
  const bytes = new Map([...addresses].map((address) => [address, null]));
  if (
    !Array.isArray(sourceBytes) ||
    Array.from(sourceBytes).some(
      (entry) =>
        !Array.isArray(entry) ||
        entry.length !== 2 ||
        !addresses.has(entry[0]) ||
        (entry[1] !== null &&
          (!Number.isInteger(entry[1]) || entry[1] < 0 || entry[1] > BYTE_MASK)),
    )
  )
    throw Error('Invalid motion scratch bytes');
  for (const [address, value] of sourceBytes) bytes.set(address, value);
  const readWord = (address) =>
    bytes.get(address) === null || bytes.get(address + 1) === null
      ? null
      : bytes.get(address) | (bytes.get(address + 1) << BYTE_BITS);
  const writeWord = (address, value) => {
    if (!isWord(value) || !addresses.has(address) || !addresses.has(address + 1))
      throw Error('Invalid motion scratch word');
    bytes.set(address, value & BYTE_MASK);
    bytes.set(address + 1, value >>> BYTE_BITS);
  };
  return {
    words(selected) {
      return Object.defineProperties(
        {},
        Object.fromEntries(
          selected.map((key) => [
            key,
            {
              enumerable: true,
              get: () => readWord(parseInt(key, HEX_RADIX)),
              set: (value) => writeWord(parseInt(key, HEX_RADIX), value),
            },
          ]),
        ),
      );
    },
    bytePair(address) {
      return Object.defineProperties(
        [null, null],
        Object.fromEntries(
          [0, 1].map((index) => [
            index,
            {
              enumerable: true,
              configurable: true,
              get: () => bytes.get(address + index),
              set: (value) => {
                if (!Number.isInteger(value) || value < 0 || value > BYTE_MASK)
                  throw Error('Invalid motion scratch byte');
                bytes.set(address + index, value);
              },
            },
          ]),
        ),
      );
    },
    writeWords(writes) {
      if (
        !Array.isArray(writes) ||
        Array.from(writes).some(
          (w) =>
            !w || !isWord(w.value) || !addresses.has(w.address) || !addresses.has(w.address + 1),
        )
      )
        throw Error('Invalid motion scratch writes');
      for (const w of writes) writeWord(w.address, w.value);
    },
    snapshot: () => [...bytes].sort(([a], [b]) => a - b).map((entry) => [...entry]),
  };
}
