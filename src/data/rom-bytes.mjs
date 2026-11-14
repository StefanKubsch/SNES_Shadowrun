// Shared byte helpers of the ROM address view (docs/ROM-FREE.md): every data
// module reads its section through read8 at CPU addresses and places it back
// into the cartridge image with the same LoROM mapping.
import { VmFault } from '../vm/memory.mjs';
import {
  WORD_MASK,
  BYTE_BITS,
  HEX_RADIX,
  WORD_BITS,
  WORD_SIGN,
  BYTE_HEX_DIGITS,
  WORD_HEX_DIGITS,
} from '../constants/bits.mjs';
import {
  ROM_BANK_MASK,
  LOROM_BANK_SHIFT,
  LOROM_OFFSET,
  LOROM_OFFSET_MASK,
} from '../constants/memory-map.mjs';

export const romOffset = (cpu) =>
  (((cpu >>> WORD_BITS) & ROM_BANK_MASK) << LOROM_BANK_SHIFT) | (cpu & LOROM_OFFSET_MASK);

// Upper-case hex with leading zeros, the spelling of addresses in the assets.
export const hex = (value, digits) => value.toString(HEX_RADIX).toUpperCase().padStart(digits, '0');

// The "BB:AAAA" label of a CPU address.
export const label = (cpu) =>
  `${hex(cpu >>> WORD_BITS, BYTE_HEX_DIGITS)}:${hex(cpu & WORD_MASK, WORD_HEX_DIGITS)}`;

// Text pointer words (dialogs, kinds, runners, topics, tables): an offset in the
// ROM half of bank 9D, or with bit 15 set of bank 9E.
export const TEXT_BANK_SELECT = WORD_SIGN;
export const textPointerLabel = (w) =>
  `${w & TEXT_BANK_SELECT ? '9E' : '9D'}:${hex(w | LOROM_OFFSET, WORD_HEX_DIGITS)}`;
export const textPointerWord = (bank, offset) =>
  (parseInt(offset, HEX_RADIX) & LOROM_OFFSET_MASK) | (bank === '9E' ? TEXT_BANK_SELECT : 0);

// CPU address of a label in the ROM halves of banks $80-$9F, or null.
export function romAddress(text) {
  const m = /^([89][0-9A-F]):([89A-F][0-9A-F]{3})$/.exec(text ?? '');
  return m ? (parseInt(m[1], HEX_RADIX) << WORD_BITS) | parseInt(m[2], HEX_RADIX) : null;
}

// The same, with a fault at address at for a malformed label.
export function requireRomAddress(text, fault, at) {
  const cpu = romAddress(text);
  if (cpu === null) throw new VmFault(fault, at);
  return cpu;
}

// Little-endian word at a CPU address through a byte reader.
export const wordReader = (read8) => (cpu) => read8(cpu) | (read8(cpu + 1) << BYTE_BITS);

// Writes one byte at a CPU address and marks it present. A byte that is
// already present means the asset no longer fits its layout (fault).
export const romWriter = (rom, present, fault) => (cpu, value) => {
  const o = romOffset(cpu);
  if (present[o]) throw new VmFault(fault, cpu);
  rom[o] = value;
  present[o] = 1;
};

// Reads a byte placed earlier; an absent one means the placement order broke.
export const placedReader = (rom, present) => (cpu) => {
  const o = romOffset(cpu);
  if (!present[o]) throw new VmFault('rom_byte_absent', cpu);
  return rom[o];
};
