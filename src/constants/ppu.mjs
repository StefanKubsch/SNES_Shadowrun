// PPU, DMA and picture constants shared by src/video, src/browser and src/crt.
// Source: Nintendo Development Manual Book I (Ressources/book1_text.pdf),
// chapter 27 "PPU Registers" (PDF 115-139), chapter 28 "CPU Registers"
// (DMA, PDF 149-152) and appendix A (OAM and VRAM layout, PDF 197-214).
// Register addresses themselves are in hardware-registers.mjs.

// Output picture (224-line mode, SETINI bit 2 clear; PDF 133, 2-27-18).
export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 224;
/** Bytes per RGBA pixel in the output buffers. */
export const RGBA_BYTES = 4;
/** Fully opaque alpha byte of an RGBA pixel. */
export const OPAQUE = 255;

// Video memories.
export const VRAM_BYTES = 0x10000;
/** VRAM word address bits (32 K words). */
export const VRAM_WORD_ADDRESS_MASK = 0x7fff;
export const CGRAM_BYTES = 512;
export const CGRAM_COLOURS = 256;
/** CGRAM high byte: bit 7 does not exist (15-bit colours). */
export const CGRAM_HIGH_BYTE_MASK = 0x7f;
export const OAM_BYTES = 544;
export const OBJECT_COUNT = 128;
/** OAM low table: four bytes per object (X, Y, name, attributes). */
export const OAM_ENTRY_BYTES = 4;
/** Bytes of the OAM low table (PDF 198, A-3). */
export const OAM_LOW_TABLE_BYTES = 512;
/** Start of the OAM high table (size and X bit 8, two bits per object). */
export const OAM_HIGH_TABLE = OAM_LOW_TABLE_BYTES;
/** Bytes of the OAM high table. */
export const OAM_HIGH_TABLE_BYTES = 32;
/** High table word with the size bit set and X bit 8 clear for all eight of its objects. */
export const OAM_HIGH_ALL_LARGE = 0xaaaa;
/** Low table byte 1 of an entry: the vertical position. */
export const OAM_Y_BYTE = 1;
/** Low table byte 2, the name; as a word with byte 3, bit 8 is the name bit 8 (000-1FF). */
export const OAM_NAME_BYTE = 2;
export const OAM_NAME_HIGH = 0x100;
// Low table byte 3 (PDF 198, A-3): V and H flip (bits 7, 6), priority against the
// backgrounds (bits 5, 4), palette (bits 3 to 1) and name bit 8 (bit 0).
export const OAM_FLIP_MASK = 0xc0;
export const OAM_PRIORITY_2 = 0x20;
export const OAM_PRIORITY_3 = 0x30;
/** Byte offset bits inside the 32-byte OAM high table. */
export const OAM_HIGH_TABLE_MASK = 0x1f;
/** OAM byte address bits (OAMADDL/H word address * 2 plus the byte toggle). */
export const OAM_BYTE_ADDRESS_MASK = 0x3ff;

// Register file $2100-$2133 (the write-only PPU registers).
export const PPU_REGISTER_COUNT = 0x34;
/** BG1-BG4 horizontal and vertical scroll registers $210D-$2114. */
export const SCROLL_REGISTER_COUNT = 8;
/** Scroll offsets are 10 bits wide. */
export const SCROLL_MASK = 0x3ff;

// INIDISP $2100.
export const INIDISP_FORCED_BLANK = 0x80;
export const INIDISP_BRIGHTNESS_MASK = 0x0f;
export const MAX_BRIGHTNESS = 15;

// VMAINC $2115.
/** Increment the VRAM address after the high byte ($2119/$213A) instead of the low byte. */
export const VMAINC_INCREMENT_AFTER_HIGH = 0x80;
/** Address remapping (bits 2-3) and unused bits 4-6; the model admits only zero. */
export const VMAINC_REMAP_BITS = 0x7c;
export const VMAINC_STEP_MASK = 0x03;
/** VMAINC step value 1: the address advances by 32 words (one map column). */
export const VMAINC_STEP_32 = 0x01;
/** Word steps selected by VMAINC bits 0-1. */
export const VRAM_ADDRESS_STEPS = [1, 32, 128, 128];

// BGR555 colours (CGDATA, COLDATA, colour math).
export const COLOUR_COMPONENT_BITS = 5;
export const COLOUR_COMPONENT_MASK = 0x1f;
export const COLOUR_COMPONENTS = 3;
export const COLOUR_MASK = 0x7fff;
/** COLDATA $2132: bits 5, 6 and 7 select red, green and blue. */
export const COLDATA_RED = 0x20;
export const COLDATA_GREEN = 0x40;
export const COLDATA_BLUE = 0x80;

// Screen designation and colour math (Book I, book1_text.pdf PDF 128 TM/TS 2-27-14, PDF 130
// CGSWSEL 2-27-16, PDF 131 CGADSUB 2-27-17). TM, TS and CGADSUB share the layer bits 0-4;
// CGADSUB bit 5 adds the backdrop. CGSWSEL bit 1 adds the sub screen instead of the fixed colour.
export const LAYER_BG1 = 0x01;
export const LAYER_BG2 = 0x02;
export const LAYER_BG3 = 0x04;
export const LAYER_BG4 = 0x08;
export const LAYER_OBJ = 0x10;
export const CGADSUB_BACKDROP = 0x20;
export const CGSWSEL_SUB_SCREEN = 0x02;
// CGADSUB bit 6 halves the result (PDF 131, 2-27-17; src/video/ppu-frame.mjs CGADSUB_HALF).
export const CGADSUB_HALF = 0x40;

// Window mask settings W12SEL/W34SEL/WOBJSEL (Book I, book1_text.pdf PDF 126, 2-27-12): one
// nibble per layer (W12SEL BG1 low, BG2 high; W34SEL BG3, BG4; WOBJSEL OBJ, colour). D0
// inverts window 1 (IN/OUT), D1 enables it; D2/D3 do the same for window 2. TMW 212E
// selects the masked layers among the TM bits (PDF 129, 2-27-15).
export const WINDOW_1_INVERT = 0x01;
export const WINDOW_1_ENABLE = 0x02;
export const WINDOW_HIGH_LAYER_SHIFT = 4;

// DMA channels: register offsets inside one channel block ($43x0-$43xA).
export const DMA_CHANNELS = 8;
export const DMA_REGISTER_BYTES = 0x80;
export const DMA_PARAMETERS = 0; // DMAPx
export const DMA_B_ADDRESS = 1; // BBADx: B-bus port - $2100
export const DMA_A_ADDRESS_LOW = 2; // A1TxL
export const DMA_A_ADDRESS_HIGH = 3; // A1TxH
export const DMA_A_BANK = 4; // A1Bx
export const DMA_COUNT_LOW = 5; // DASxL
export const DMA_COUNT_HIGH = 6; // DASxH
/** DMAP bit 7: transfer direction B-bus to A-bus. */
export const DMAP_B_TO_A = 0x80;
/** DMAP bit 6: indirect H-DMA addressing. */
export const DMAP_HDMA_INDIRECT = 0x40;
/** DMAP bit 3: fixed A-bus address (no increment). */
export const DMAP_FIXED_SOURCE = 0x08;
export const DMAP_TRANSFER_MODE_MASK = 0x07;
/** DMAP modes (PDF 149, 2-28-10): one port, two ports low/high, one port written twice. */
export const DMAP_ONE_PORT = 0;
export const DMAP_TWO_PORTS = 1;
export const DMAP_WRITE_TWICE = 2;
/** A byte count of zero transfers 65,536 bytes. */
export const DMA_ZERO_COUNT_LENGTH = 0x10000;
/** H-DMA line header: bit 7 repeat (one unit per line), bits 0-6 line count. */
export const HDMA_REPEAT = 0x80;
export const HDMA_LINE_COUNT_MASK = 0x7f;

// Background and object registers (Book I chapter 27, PDF 115-119; the
// renderer src/video/ppu-frame.mjs and the scene loader src/data/scene-lists.mjs).
/** VRAM holds 16-bit words; word address = byte address / 2. */
export const VRAM_WORD_BYTES = 2;
/** BGMODE $2105: background mode in bits 0-2. */
export const BGMODE_MODE_MASK = 0x07;
/** BGMODE mode 1 and bit 3, which gives BG3 the highest priority in mode 0 or 1 (PDF 117, 2-27-3). */
export const BGMODE_MODE_1 = 0x01;
export const BGMODE_BG3_PRIORITY = 0x08;
/** OAMADDH $2103 bit 7: OAM priority rotation (PDF 116, 2-27-2). */
export const OAMADDH_PRIORITY_ROTATION = 0x80;
/** BGnSC: bits 2-7 select the screen map base in 2 KiB units, bit 0/1 a 64-tile wide/high map. */
export const BGSC_BASE_MASK = 0xfc;
export const BGSC_BASE_SHIFT = 9;
export const BGSC_WIDE = 0x01;
export const BGSC_TALL = 0x02;
/** One screen map of 32 x 32 two-byte entries. */
export const SCREEN_MAP_BYTES = 0x800;
/** BG screen map entry (Book I PDF 205, BG SC data A-10): bits 10-12 palette, 13 priority, 14 horizontal flip. */
export const TILE_PALETTE_STEP = 0x400;
export const TILE_PALETTE_BITS = 0x1c00;
export const TILE_PRIORITY = 0x2000;
export const TILE_H_FLIP = 0x4000;
/** Same entry: bit 15 vertical flip, bits 0-9 the character name (000-3FF). */
export const TILE_V_FLIP = 0x8000;
export const TILE_FLIP_BITS = TILE_V_FLIP | TILE_H_FLIP;
export const TILE_NAME_MASK = 0x3ff;
/** BGnnNBA: one nibble per layer, character base in 8 KiB units. */
export const CHARACTER_BASE_STEP = 0x2000;
/** OBJSEL $2101: object name base in bits 0-2, in 16 KiB units. */
export const OBJSEL_BASE_MASK = 7;
export const OBJ_NAME_BASE_STEP = 0x4000;
/** Characters are 8 x 8 pixels. */
export const TILE_SIZE = 8;
/** Planes are stored in pairs: 16 bytes per pair, row y at 2 y (lower plane) and 2 y + 1. */
export const PLANE_PAIR_BYTES = 16;
