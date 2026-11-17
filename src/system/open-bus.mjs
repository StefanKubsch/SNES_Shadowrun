// The open bus of the system area (Book I, PDF page 93): in banks 00-3F and 80-BF the
// addresses 2000-7FFF outside the registers answer nothing, and a read there returns the
// last byte on the data bus. The registers are the B bus 2100-21FF, the joypad ports
// 4016/4017, the CPU registers 4200-421F and the DMA channels 4300-437F. For a read
// through a long pointer ([dp],Y) the last byte on the bus is the pointer's bank byte
// (Mesen evidence in proof/script/native-object-turn.mjs).
import { INIDISP, NMITIMEN, DMAP0 } from '../constants/hardware-registers.mjs';
import { BANK_WITHOUT_IO, IO_AREA_END, IO_AREA_START } from '../constants/memory-map.mjs';
import { BYTE_BITS, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

const B_BUS_END = 0x2200,
  JOYPAD_PORT_1 = 0x4016,
  JOYPAD_PORT_2 = 0x4017,
  CPU_REGISTERS_END = 0x4220,
  DMA_REGISTERS_END = 0x4380,
  NO_IO_BANK_BIT = BANK_WITHOUT_IO << WORD_BITS;

const register = (low) =>
  (low >= INIDISP && low < B_BUS_END) ||
  low === JOYPAD_PORT_1 ||
  low === JOYPAD_PORT_2 ||
  (low >= NMITIMEN && low < CPU_REGISTERS_END) ||
  (low >= DMAP0 && low < DMA_REGISTERS_END);

// Whether a read of the long address returns the open bus.
export function isOpenBus(address) {
  const low = address & WORD_MASK;
  return !(address & NO_IO_BANK_BIT) && low >= IO_AREA_START && low < IO_AREA_END && !register(low);
}
// The word at the long pointer plus index, as LDA [dp],Y reads it: an open bus byte
// reads the pointer's bank byte.
export function pointerWord(mem, pointer, index) {
  const address = (pointer + index) & LONG_MASK,
    bank = pointer >>> WORD_BITS,
    byte = (at) => (isOpenBus(at) ? bank : mem.read8(at));
  return byte(address) | (byte((address + 1) & LONG_MASK) << BYTE_BITS);
}
