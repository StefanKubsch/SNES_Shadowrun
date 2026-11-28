// Compatibility view for game workspaces whose callers still supply the shared
// storage. Named records use independent owners; raw scratch aliases remain until
// the comparison projection and the remaining callers have migrated.
import { readStateByte, writeStateByte } from './objects.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
import { WRAM_BASE } from '../constants/memory-map.mjs';
const memories = new WeakMap();
export function workspaceMemory(wram) {
  let mem = memories.get(wram);
  if (mem) return mem;
  const read = (at) => readStateByte(wram, at),
    write = (at, value) => writeStateByte(wram, at, value & BYTE_MASK),
    word = (at) => read(at) | (read(at + 1) << BYTE_BITS),
    setWord = (at, value) => {
      write(at, value);
      write(at + 1, value >>> BYTE_BITS);
    };
  mem = {
    wram,
    read8: (at) => read(at - WRAM_BASE),
    write8: (at, value) => write(at - WRAM_BASE, value),
    read16: (at) => word(at - WRAM_BASE),
    write16: (at, value) => setWord(at - WRAM_BASE, value),
    read16Bank0: word,
    write16Bank0: setWord,
  };
  memories.set(wram, mem);
  return mem;
}
export function scratchWord(mem, at) {
  return {
    enumerable: true,
    get: () => mem.read16Bank0(at),
    set: (value) => mem.write16Bank0(at, value),
  };
}

export function scratchByte(wram, at) {
  return {
    enumerable: true,
    get: () => readStateByte(wram, at),
    set: (value) => writeStateByte(wram, at, value & BYTE_MASK),
  };
}
