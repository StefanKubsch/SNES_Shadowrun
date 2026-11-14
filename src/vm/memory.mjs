// Memory of the native interpreter: a WRAM buffer (128 KiB), the LoROM as a
// Uint8Array and the arithmetic unit of the SNES ($4202-$4217).
// Mapping as in renderAddress (src/render/data.mjs): $7E/$7F = WRAM,
// banks without bit 6 with offset < $2000 = WRAM mirror, LoROM upper halves of the
// first 32 banks = ROM, optionally SRAM (8 KiB, banks $70-$7D and $F0-$FD below
// $8000, mirrored; 16 KiB with the four-slot option) and the port's own read-only
// data bank $A0:8000-FFFF (src/data/port-extension.mjs, only when installed). Writes to the ROM have no effect, as on the hardware (user decision
// 2026-10-14, for example STA $97AE,X in $9D15); they are counted and, in diagnostic mode (romWriteLog = []),
// logged with their address. In bank $00 they arise only from overflows of the stack or direct page and remain
// a proof limit (error). Everything else is an error, no invented values.
import {
  WORD_BITS,
  WORD_MASK,
  BYTE_MASK,
  BYTE_BITS,
  HIGH_BYTE_MASK,
  LONG_MASK,
} from '../constants/bits.mjs';
import {
  WRDIVB,
  WRDIVH,
  WRDIVL,
  WRMPYA,
  WRMPYB,
  RDDIVH,
  RDDIVL,
  RDMPYH,
  RDMPYL,
} from '../constants/hardware-registers.mjs';
import {
  BANK_WITHOUT_IO,
  LOROM_BANK_SHIFT,
  LOROM_OFFSET,
  LOROM_OFFSET_MASK,
  LOW_RAM_END,
  MIRROR_BANK_MASK,
  ROM_BANK_COUNT,
  ROM_BANK_MASK,
  SRAM_END_BANK,
  SRAM_FIRST_BANK,
  WRAM_BANK,
  WRAM_BASE,
  WRAM_HIGH_BANK,
} from '../constants/memory-map.mjs';

// Fault messages print long addresses as six hexadecimal digits.
const HEX = 16,
  LONG_ADDRESS_DIGITS = 6;

export class VmFault extends Error {
  constructor(reason, address = null, details = null) {
    super(
      address === null
        ? reason
        : `${reason} at $${address.toString(HEX).toUpperCase().padStart(LONG_ADDRESS_DIGITS, '0')}`,
    );
    this.reason = reason;
    this.address = address;
    this.details = details; // optional details on the limit (for example the PC of a missing observation)
  }
}

// A proven module stops at a source boundary by throwing {taskBoundary, reason, ...}.
// The VM reports it as VmFault('<kind>:<reason>') at the native or main target.
export function boundaryFault(error, kind, target) {
  if (!error?.taskBoundary) return error;
  const { taskBoundary, reason, ...details } = error;
  return new VmFault(kind + ':' + reason, target, details);
}

export const WRAM_SIZE = 0x20000;
export const ROM_SIZE = 0x100000;
export const SRAM_SIZE = 0x2000;
// Four save slots (docs/SAVING.md): slots 3/4 from 2000 and 2FFE.
export const SRAM_SIZE_FOUR_SLOTS = 0x4000;
export const PORT_BANK = 0xa0;
// Packed streams of the text language at $A1:8000 (src/data/language.mjs, only when installed).
export const LANGUAGE_BANK = 0xa1;
// Temporary edited intro/credits sources, installed as one coherent set.
export const PACKED_TEXT_BANK = 0xa2;

// SRAM: banks $70-$7D and $F0-$FD below $8000 (8 KiB, mirrored).
const isSram = (bank, offset) =>
  (bank & MIRROR_BANK_MASK) >= SRAM_FIRST_BANK &&
  (bank & MIRROR_BANK_MASK) < SRAM_END_BANK &&
  offset < LOROM_OFFSET;
// Start values of the arithmetic unit model (all ones).
const INITIAL_MULTIPLICAND = 0xff,
  INITIAL_DIVIDEND = 0xffff,
  // On the hardware, division by 0 returns $FFFF and the dividend as the remainder.
  DIVIDE_BY_ZERO_QUOTIENT = 0xffff;

export class VmMemory {
  // present: optional, per ROM byte 1 = present (data package without code,
  // src/data/cartridge.mjs); a read of a missing byte is an error.
  constructor(rom, wram = new Uint8Array(WRAM_SIZE), sram = null, present = null) {
    if (!(rom instanceof Uint8Array) || rom.length !== ROM_SIZE)
      throw new VmFault('rom_size_required');
    if (present !== null && (!(present instanceof Uint8Array) || present.length !== ROM_SIZE))
      throw new VmFault('rom_present_size_required');
    this.present = present;
    if (!(wram instanceof Uint8Array) || wram.length !== WRAM_SIZE)
      throw new VmFault('wram_size_required');
    if (
      sram !== null &&
      (!(sram instanceof Uint8Array) || ![SRAM_SIZE, SRAM_SIZE_FOUR_SLOTS].includes(sram.length))
    )
      throw new VmFault('sram_size_required');
    this.rom = rom;
    this.wram = wram;
    this.sram = sram; // without SRAM content, accesses to it are errors
    this.extension = null; // port data bank A0 (installPortExtension)
    this.languageBank = null; // language streams bank A1 (installLanguage)
    this.packedTextSnapshot = null;
    // Arithmetic unit: WRMPYA, WRDIV (WORD), RDDIV, RDMPY.
    this.multiplicand = INITIAL_MULTIPLICAND;
    this.dividend = INITIAL_DIVIDEND;
    this.quotient = 0;
    this.product = 0; // RDMPY: product or division remainder
    this.romWrites = 0;
    this.romWriteLog = null; // diagnostics: array of the addresses of ineffective ROM writes
  }

  read8(address) {
    const bank = address >>> WORD_BITS,
      offset = address & WORD_MASK;
    if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK) return this.wram[address - WRAM_BASE];
    if (!(bank & BANK_WITHOUT_IO)) {
      if (offset < LOW_RAM_END) return this.wram[offset];
      if (offset >= LOROM_OFFSET) {
        if ((bank & MIRROR_BANK_MASK) < ROM_BANK_COUNT) {
          const o = ((bank & ROM_BANK_MASK) << LOROM_BANK_SHIFT) | (offset & LOROM_OFFSET_MASK);
          if (this.present !== null && this.present[o] === 0)
            throw new VmFault('rom_byte_absent', address);
          return this.rom[o];
        }
      } else {
        switch (offset) {
          case RDDIVL:
            return this.quotient & BYTE_MASK;
          case RDDIVH:
            return this.quotient >>> BYTE_BITS;
          case RDMPYL:
            return this.product & BYTE_MASK;
          case RDMPYH:
            return this.product >>> BYTE_BITS;
        }
      }
    } else if (this.sram !== null && isSram(bank, offset))
      return this.sram[offset & (this.sram.length - 1)];
    if (bank === PORT_BANK && offset >= LOROM_OFFSET && this.extension !== null) {
      const o = offset - LOROM_OFFSET;
      if (o < this.extension.length) return this.extension[o];
    }
    const languageBank = this.packedTextSnapshot?.languageBank ?? this.languageBank;
    if (bank === LANGUAGE_BANK && offset >= LOROM_OFFSET && languageBank !== null) {
      const o = offset - LOROM_OFFSET;
      if (o < languageBank.length) return languageBank[o];
    }
    if (bank === PACKED_TEXT_BANK && offset >= LOROM_OFFSET && this.packedTextSnapshot?.bank) {
      const o = offset - LOROM_OFFSET;
      if (o < this.packedTextSnapshot.bank.length) return this.packedTextSnapshot.bank[o];
    }
    throw new VmFault('unmapped_read', address);
  }

  write8(address, value) {
    const bank = address >>> WORD_BITS,
      offset = address & WORD_MASK;
    if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK) {
      this.wram[address - WRAM_BASE] = value;
      return;
    }
    if (!(bank & BANK_WITHOUT_IO)) {
      if (offset < LOW_RAM_END) {
        this.wram[offset] = value;
        return;
      }
      if (offset >= LOROM_OFFSET && bank !== 0 && (bank & MIRROR_BANK_MASK) < ROM_BANK_COUNT) {
        this.romWrites++;
        if (this.romWriteLog !== null) this.romWriteLog.push(address);
        return;
      }
      switch (offset) {
        case WRMPYA:
          this.multiplicand = value;
          return;
        case WRMPYB:
          this.product = this.multiplicand * value;
          return;
        case WRDIVL:
          this.dividend = (this.dividend & HIGH_BYTE_MASK) | value;
          return;
        case WRDIVH:
          this.dividend = (this.dividend & BYTE_MASK) | (value << BYTE_BITS);
          return;
        case WRDIVB:
          if (value === 0) {
            this.quotient = DIVIDE_BY_ZERO_QUOTIENT;
            this.product = this.dividend;
          } else {
            this.quotient = (this.dividend / value) | 0;
            this.product = this.dividend % value;
          }
          return;
      }
    } else if (this.sram !== null && isSram(bank, offset)) {
      this.sram[offset & (this.sram.length - 1)] = value;
      return;
    }
    throw new VmFault('unmapped_write', address);
  }

  // WORD with 24-bit address wrap (absolute and long addresses).
  read16(address) {
    return this.read8(address) | (this.read8((address + 1) & LONG_MASK) << BYTE_BITS);
  }
  write16(address, value) {
    this.write8(address, value & BYTE_MASK);
    this.write8((address + 1) & LONG_MASK, value >>> BYTE_BITS);
  }

  // WORD in bank 0 with 16-bit wrap (direct page, stack).
  read16Bank0(offset) {
    return this.read8(offset) | (this.read8((offset + 1) & WORD_MASK) << BYTE_BITS);
  }
  write16Bank0(offset, value) {
    this.write8(offset, value & BYTE_MASK);
    this.write8((offset + 1) & WORD_MASK, value >>> BYTE_BITS);
  }
}
