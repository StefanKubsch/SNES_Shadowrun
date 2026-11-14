// SNES memory map of the Shadowrun LoROM cartridge, as mapped by VmMemory
// (src/vm/memory.mjs) and renderAddress (src/render/data.mjs). Source: Nintendo
// Development Manual Book I (Ressources/book1_text.pdf), chapter 21.2 "CPU
// Memory Map", PDF 93 (printed 2-21-1) and figures 2-21-1/2-21-2 (Mode 20);
// cartridge layout as established in docs/ROM-FREE.md.

/** Banks $7E/$7F hold the 128 KiB work RAM. */
export const WRAM_BANK = 0x7e;
export const WRAM_HIGH_BANK = 0x7f;
/** Long address of WRAM offset 0 (bank $7E). */
export const WRAM_BASE = 0x7e0000;

/** Banks $80-$FF mirror banks $00-$7F. */
export const MIRROR_BANK_MASK = 0x7f;
/** Banks with bit 6 set ($40-$7F, $C0-$FF) have no system area. */
export const BANK_WITHOUT_IO = 0x40;
/** In the system area, offsets $0000-$1FFF mirror the first 8 KiB of WRAM. */
export const LOW_RAM_END = 0x2000;
/** System area offsets $2000-$7FFF: registers ($2000-$5FFF, 21.2) and the
 *  expansion area ($6000-$7FFF); neither is memory for this cartridge. */
export const IO_AREA_START = 0x2000;
export const IO_AREA_END = 0x8000;

/** LoROM: each bank maps 32 KiB of ROM into its upper half $8000-$FFFF. */
export const LOROM_OFFSET = 0x8000;
export const LOROM_BANK_SHIFT = 15;
export const LOROM_OFFSET_MASK = 0x7fff;
/** The 1 MiB ROM fills the first 32 banks. */
export const ROM_BANK_COUNT = 0x20;
export const ROM_BANK_MASK = 0x1f;
/** Long address of bank $80, where the game code runs. */
export const CODE_BANK_BASE = 0x800000;

/** Battery-backed SRAM: banks $70-$7D (and mirrors) below $8000. */
export const SRAM_FIRST_BANK = 0x70;
export const SRAM_END_BANK = 0x7e;

/** Program and data bank of the game code and its tables ($80 = FastROM mirror of bank $00). */
export const CODE_BANK = 0x80;
/** PEA operands that load two equal DBR bytes for PLB / PLB. */
export const CODE_BANK_PAIR = 0x8080;
export const WRAM_BANK_PAIR = 0x7e7e;
export const WRAM_HIGH_BANK_PAIR = 0x7f7f;
