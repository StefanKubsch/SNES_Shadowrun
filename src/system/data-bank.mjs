// Words the original reaches through its data bank 80 with a 16-bit index (absolute
// indexed addressing, LDA $1458,Y): the address is 80:offset plus the index in 24 bits,
// so an index past the bank's end reaches bank 81. The low 8 KB of both banks mirror
// WRAM 7E:0000-1FFF; above lie the system registers and the ROM (the memory map of
// src/vm/memory.mjs). A script's "none" (FFFF) as an object index thus reads the WRAM
// word just below the field, as the original does.
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';
import { LONG_MASK } from '../constants/bits.mjs';

const address = (offset, index) => (CODE_BANK_BASE + offset + index) & LONG_MASK;

// The word at offset + index through the data bank 80.
export const dataBankWord = (mem, offset, index = 0) => mem.read16(address(offset, index));
// Write the word at offset + index through the data bank 80.
export const setDataBankWord = (mem, offset, index, value) =>
  mem.write16(address(offset, index), value);
