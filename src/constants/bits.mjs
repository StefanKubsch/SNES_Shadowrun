// Generic widths and masks of the 65816 data model, shared by all modules.
// Module-specific addresses stay with their modules: WRAM fields in
// src/task/wram.mjs, scheduler tables in src/vm/layout.mjs.

/** Low eight bits of a value (an 8-bit register or memory byte). */
export const BYTE_MASK = 0xff;
/** Low sixteen bits of a value (a 16-bit register or memory word). */
export const WORD_MASK = 0xffff;
/** Full 24-bit 65816 address: bank byte and 16-bit offset. */
export const LONG_MASK = 0xffffff;
/** Bank byte of a 24-bit address. */
export const BANK_MASK = 0xff0000;
/** High byte of a 16-bit word. */
export const HIGH_BYTE_MASK = 0xff00;
/** Number of values of a byte; v - BYTE_VALUES turns an unsigned byte above INT8_MAX negative. */
export const BYTE_VALUES = 0x100;
/** Range of a signed 8-bit value. */
export const INT8_MIN = -0x80;
export const INT8_MAX = 0x7f;
/** Sign bit of an 8-bit value. */
export const BYTE_SIGN = 0x80;
/** Sign bit of a 16-bit value. */
export const WORD_SIGN = 0x8000;

/** Bytes of a 24-bit long address (offset word and bank byte). */
export const LONG_BYTES = 3;
/** Bits per nibble; shift distance between the two halves of a byte. */
export const NIBBLE_BITS = 4;
/** Low nibble of a byte. */
export const NIBBLE_MASK = 0x0f;
/** Bits per byte; shift distance between the low and high byte of a word. */
export const BYTE_BITS = 8;
/** Bits per word; shift distance between a 16-bit offset and its bank byte. */
export const WORD_BITS = 16;
/** Bytes per 64 KiB bank; bank * BANK_SIZE + offset gives a long address. */
export const BANK_SIZE = 0x10000;

// Address wrap of the word accessors readWord/writeWord (src/vm/task-accessor.mjs).
/** The second byte wraps inside the 16-bit bank (direct page, stack, bank 0). */
export const BANK_WRAP = 16;
/** The second byte continues in the full 24-bit address space. */
export const LONG_WRAP = 24;

// Hexadecimal notation of addresses and data in JSON assets and labels.
/** Radix of parseInt/toString for hexadecimal text. */
export const HEX_RADIX = 16;
/** Hex digits of a byte, a 16-bit word and a 24-bit long address. */
export const BYTE_HEX_DIGITS = 2;
export const WORD_HEX_DIGITS = 4;
export const LONG_HEX_DIGITS = 6;
