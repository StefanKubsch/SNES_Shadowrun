import {
  INIDISP,
  VMAINC,
  HDMAEN,
  VMADDL,
  VMADDH,
  VMDATAL,
  VMDATAH,
  OAMADDL,
  OAMADDH,
  OAMDATA,
  CGADD,
  CGDATA,
  COLDATA,
  BG1HOFS,
  BG4VOFS,
  M7A,
  M7B,
  M7Y,
  MPYL,
  MPYH,
  RDVRAML,
  RDVRAMH,
  SETINI,
  DMAP0,
  NTRL7,
  MDMAEN,
  DMA_CHANNEL_STRIDE,
} from '../constants/hardware-registers.mjs';
import { WORD_MASK, BYTE_MASK, BYTE_BITS, HIGH_BYTE_MASK, WORD_BITS } from '../constants/bits.mjs';
import {
  CGRAM_BYTES,
  CGRAM_HIGH_BYTE_MASK,
  COLDATA_RED,
  COLOUR_COMPONENTS,
  COLOUR_COMPONENT_BITS,
  COLOUR_COMPONENT_MASK,
  DMAP_B_TO_A,
  DMAP_FIXED_SOURCE,
  DMAP_TRANSFER_MODE_MASK,
  DMA_A_ADDRESS_HIGH,
  DMA_A_ADDRESS_LOW,
  DMA_A_BANK,
  DMA_B_ADDRESS,
  DMA_CHANNELS,
  DMA_COUNT_HIGH,
  DMA_COUNT_LOW,
  DMA_PARAMETERS,
  DMA_REGISTER_BYTES,
  DMA_ZERO_COUNT_LENGTH,
  INIDISP_FORCED_BLANK,
  OAM_BYTES,
  OAM_BYTE_ADDRESS_MASK,
  OAM_HIGH_TABLE,
  OAM_HIGH_TABLE_MASK,
  PPU_REGISTER_COUNT,
  SCROLL_MASK,
  SCROLL_REGISTER_COUNT,
  VMAINC_INCREMENT_AFTER_HIGH,
  VMAINC_REMAP_BITS,
  VMAINC_STEP_MASK,
  VRAM_ADDRESS_STEPS,
  VRAM_BYTES,
  VRAM_WORD_ADDRESS_MASK,
} from '../constants/ppu.mjs';
import { BANK_WITHOUT_IO, IO_AREA_END, IO_AREA_START } from '../constants/memory-map.mjs';

// Nintendo Book I, chapter 27, PDF 115-125. This bounded write-side device
// admits forced blank and explicitly observed VBlank transfers. No beam
// position or elapsed time is inferred. See docs/PPU-ROOM.md.
export class PpuBoundary extends Error {
  constructor(reason, details = null) {
    super(reason);
    this.reason = reason;
    this.details = details;
  }
}
export const requireValue = (ok, reason, details) => {
  if (!ok) throw new PpuBoundary(reason, details);
};

// Bytes between two plane pairs of a tile row in planar tile data.
const PLANE_PAIR_STRIDE = 16;
// Address halves written so far: bit 0 low byte, bit 1 high byte.
const LOW_KNOWN = 1,
  HIGH_KNOWN = 2,
  BOTH_KNOWN = LOW_KNOWN | HIGH_KNOWN;
// Four one-flags packed into one 32-bit word (allKnown).
const FOUR_KNOWN_FLAGS = 0x01010101,
  FLAGS_PER_WORD = 4,
  WORD_ALIGNMENT_MASK = 3;
// OAM address bit 8 (OAMADDH bit 0).
const OAM_ADDRESS_HIGH_BIT = 0x100;
// Sign extension of the 8-bit mode 7 multiplier (PDF 134).
const M7B_SIGN_SHIFT = 24;
// DMA registers $43x0-$43x6 read by a general purpose transfer.
const DMA_TRANSFER_REGISTERS = 7;
// H-DMA: channel number from the register offset, and the registers $43x0-$43x4
// that can change an enabled field.
const DMA_CHANNEL_SHIFT = 4,
  DMA_REGISTER_INDEX_MASK = 0x0f,
  HDMA_FIELD_REGISTERS = 5;
// DMA transfer mode 1: alternating low/high B-bus ports.
const TRANSFER_MODE_ALTERNATING = 1;
// General purpose DMA: admitted modes (0 and 1, each optionally with a fixed
// source) and targets.
const DMA_MODES = [
  0,
  TRANSFER_MODE_ALTERNATING,
  DMAP_FIXED_SOURCE,
  DMAP_FIXED_SOURCE | TRANSFER_MODE_ALTERNATING,
];
const DMA_TARGETS = [OAMDATA, VMDATAL, CGDATA];
// The one reverse (B-bus to A-bus) transfer of the original: channel 5 reads
// 16 VRAM bytes through RDVRAML/H into $7E:2AE0 (docs/PPU-ROOM.md).
const REVERSE_DMA = Object.freeze({
  mode: DMAP_B_TO_A | TRANSFER_MODE_ALTERNATING,
  channel: 5,
  port: RDVRAML,
  bank: 0x7e,
  addressLow: 0xe0,
  addressHigh: 0x2a,
  length: 16,
});

// Colour index of one pixel in planar tile data (sources in ppu-frame.mjs): plane pairs
// interleave per row, higher pairs follow 16 bytes later; bit is 7 - x.
export function planarIndex(vram, start, bit, planes) {
  let index = 0;
  for (let plane = 0; plane < planes; plane++)
    index |=
      ((vram[(start + (plane >>> 1) * PLANE_PAIR_STRIDE + (plane & 1)) & WORD_MASK] >>> bit) & 1) <<
      plane;
  return index;
}
// Every flag byte is 1. Compares four flags at once where the array is word aligned.
function allKnown(known) {
  let n = 0;
  if (!(known.byteOffset & WORD_ALIGNMENT_MASK)) {
    const words = new Uint32Array(known.buffer, known.byteOffset, known.length >>> 2);
    for (; n < words.length; n++) if (words[n] !== FOUR_KNOWN_FLAGS) return false;
    n *= FLAGS_PER_WORD;
  }
  for (; n < known.length; n++) if (known[n] !== 1) return false;
  return true;
}
// B-bus offsets written per transfer unit of DMA mode 0-4 (Book I PDF 149-152).
export const TRANSFER_UNITS = [[0], [0, 1], [0, 0], [0, 0, 1, 1], [0, 1, 2, 3]];
export class PpuState {
  constructor() {
    this.vram = new Uint8Array(VRAM_BYTES);
    this.cgram = new Uint8Array(CGRAM_BYTES);
    this.oam = new Uint8Array(OAM_BYTES);
    this.vramKnown = new Uint8Array(VRAM_BYTES);
    this.cgramKnown = new Uint8Array(CGRAM_BYTES);
    this.oamKnown = new Uint8Array(OAM_BYTES);
    this.registers = new Uint8Array(PPU_REGISTER_COUNT);
    this.registerKnown = new Uint8Array(PPU_REGISTER_COUNT);
    this.scroll = new Uint16Array(SCROLL_REGISTER_COUNT);
    this.scrollKnown = new Uint8Array(SCROLL_REGISTER_COUNT);
    this.scrollPending = -1;
    this.scrollLow = 0;
    this.vramAddress = 0;
    this.vramAddressKnown = 0;
    this.oamAddress = 0;
    this.oamAddressKnown = 0;
    this.oamByte = 0;
    this.oamLow = null;
    this.cgAddress = null;
    this.cgLow = null;
    this.observedVblank = false;
    this.vramReadBuffer = null;
    this.m7a = 0;
    this.m7aKnown = false;
    this.m7aLow = null;
    this.m7b = 0;
    this.m7bKnown = false;
    this.hdmaEnabled = 0;
    // COLDATA 2132 (PDF 132, 2-27-18): bits 5/6/7 select R/G/B for the 5-bit
    // intensity. fixedKnown has one bit per component (R 1, G 2, B 4).
    this.fixedColor = 0;
    this.fixedKnown = 0;
  }
  register(port) {
    const i = port - INIDISP;
    requireValue(this.registerKnown[i] === 1, 'ppu_register_required', { port });
    return this.registers[i];
  }
  writable() {
    requireValue(
      (this.register(INIDISP) & INIDISP_FORCED_BLANK) !== 0 || this.observedVblank,
      'ppu_observed_write_window_required',
    );
  }
  // Steps the VRAM word address after the byte that VMAINC bit 7 selects.
  stepVramAddress(mode) {
    this.vramAddress = (this.vramAddress + VRAM_ADDRESS_STEPS[mode & VMAINC_STEP_MASK]) & WORD_MASK;
  }
  readVram(port) {
    requireValue(port === RDVRAML || port === RDVRAMH, 'ppu_read_port_required');
    this.writable();
    const mode = this.register(VMAINC);
    requireValue(
      !(mode & VMAINC_REMAP_BITS) && this.vramAddressKnown === BOTH_KNOWN,
      'ppu_vram_read_address_required',
    );
    requireValue(this.vramReadBuffer !== null, 'ppu_vram_read_buffer_required');
    const value = (this.vramReadBuffer >>> (port & 1 ? 0 : BYTE_BITS)) & BYTE_MASK;
    if (Boolean(mode & VMAINC_INCREMENT_AFTER_HIGH) === Boolean(!(port & 1))) {
      const at = (this.vramAddress & VRAM_WORD_ADDRESS_MASK) * 2;
      requireValue(this.vramKnown[at] && this.vramKnown[at + 1], 'ppu_vram_read_memory_required');
      this.vramReadBuffer = this.vram[at] | (this.vram[at + 1] << BYTE_BITS);
      this.stepVramAddress(mode);
    }
    return value;
  }
  writeByte(port, value) {
    requireValue(
      Number.isInteger(port) &&
        port >= INIDISP &&
        port <= SETINI &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= BYTE_MASK,
      'ppu_write_required',
    );
    if (port === VMDATAL || port === VMDATAH) {
      this.writable();
      const mode = this.register(VMAINC);
      requireValue((mode & VMAINC_REMAP_BITS) === 0, 'ppu_vram_remap_required', { mode });
      requireValue(this.vramAddressKnown === BOTH_KNOWN, 'ppu_vram_address_required');
      const address = ((this.vramAddress & VRAM_WORD_ADDRESS_MASK) << 1) | (port & 1);
      this.vram[address] = value;
      this.vramKnown[address] = 1;
      if (Boolean(mode & VMAINC_INCREMENT_AFTER_HIGH) === Boolean(port & 1))
        this.stepVramAddress(mode);
    } else if (port === OAMDATA) {
      this.writable();
      requireValue(this.oamAddressKnown === BOTH_KNOWN, 'ppu_oam_address_required');
      const address = this.oamByte;
      if (address >= OAM_HIGH_TABLE) {
        const at = OAM_HIGH_TABLE + (address & OAM_HIGH_TABLE_MASK);
        this.oam[at] = value;
        this.oamKnown[at] = 1;
      } else if (!(address & 1)) this.oamLow = value;
      else {
        requireValue(this.oamLow !== null, 'ppu_oam_low_required');
        this.oam[address - 1] = this.oamLow;
        this.oam[address] = value;
        this.oamKnown[address - 1] = this.oamKnown[address] = 1;
        this.oamLow = null;
      }
      this.oamByte = (address + 1) & OAM_BYTE_ADDRESS_MASK;
    } else if (port === CGDATA) {
      this.writable();
      requireValue(this.cgAddress !== null, 'ppu_cgram_address_required');
      if (this.cgLow === null) this.cgLow = value;
      else {
        const at = this.cgAddress * 2;
        this.cgram[at] = this.cgLow;
        this.cgram[at + 1] = value & CGRAM_HIGH_BYTE_MASK;
        this.cgramKnown[at] = this.cgramKnown[at + 1] = 1;
        this.cgAddress = (this.cgAddress + 1) & BYTE_MASK;
        this.cgLow = null;
      }
    } else if (port === VMADDL || port === VMADDH) {
      if (port === VMADDL) {
        this.vramAddress = (this.vramAddress & HIGH_BYTE_MASK) | value;
        this.vramAddressKnown |= LOW_KNOWN;
      } else {
        this.vramAddress = (this.vramAddress & BYTE_MASK) | (value << BYTE_BITS);
        this.vramAddressKnown |= HIGH_KNOWN;
      }
      if (this.vramAddressKnown === BOTH_KNOWN) {
        const at = (this.vramAddress & VRAM_WORD_ADDRESS_MASK) * 2;
        this.vramReadBuffer =
          this.vramKnown[at] && this.vramKnown[at + 1]
            ? this.vram[at] | (this.vram[at + 1] << BYTE_BITS)
            : null;
      }
    } else if (port === OAMADDL || port === OAMADDH) {
      if (port === OAMADDL) {
        this.oamAddress = (this.oamAddress & OAM_ADDRESS_HIGH_BIT) | value;
        this.oamAddressKnown |= LOW_KNOWN;
      } else {
        this.oamAddress = (this.oamAddress & BYTE_MASK) | ((value & 1) << BYTE_BITS);
        this.oamAddressKnown |= HIGH_KNOWN;
      }
      this.oamByte = this.oamAddress * 2;
      this.oamLow = null;
    } else if (port === CGADD) {
      this.cgAddress = value;
      this.cgLow = null;
    } else if (port === COLDATA) {
      for (let c = 0; c < COLOUR_COMPONENTS; c++)
        if (value & (COLDATA_RED << c)) {
          const shift = COLOUR_COMPONENT_BITS * c;
          this.fixedColor =
            (this.fixedColor & ~(COLOUR_COMPONENT_MASK << shift)) |
            ((value & COLOUR_COMPONENT_MASK) << shift);
          this.fixedKnown |= 1 << c;
        }
    } else if (port >= BG1HOFS && port <= BG4VOFS) {
      // The original boot writes each scroll word as an adjacent low/high
      // pair. Reject interleaving rather than inventing shared-latch state.
      requireValue(
        this.scrollPending === -1 || this.scrollPending === port,
        'ppu_scroll_latch_required',
      );
      if (this.scrollPending === -1) {
        this.scrollPending = port;
        this.scrollLow = value;
      } else {
        const at = port - BG1HOFS;
        this.scroll[at] = ((value << BYTE_BITS) | this.scrollLow) & SCROLL_MASK;
        this.scrollKnown[at] = 1;
        this.scrollPending = -1;
      }
    } else if (port >= M7A && port <= M7Y) {
      // Book I PDF 124 (2-27-10): 16 bits to 211B as two writes low/high, then
      // 8 bits once to 211C. Like the scroll pairs, an interleaved M7 write
      // before the high byte is a boundary, not a shared-latch assumption.
      if (port === M7A) {
        if (this.m7aLow === null) {
          this.m7aLow = value;
          this.m7aKnown = false;
        } else {
          this.m7a = (value << BYTE_BITS) | this.m7aLow;
          this.m7aKnown = true;
          this.m7aLow = null;
        }
      } else {
        requireValue(this.m7aLow === null, 'ppu_multiplier_latch_required');
        if (port === M7B) {
          this.m7b = value;
          this.m7bKnown = true;
        }
      }
    }
    this.registers[port - INIDISP] = value;
    this.registerKnown[port - INIDISP] = 1;
  }
  // PDF 134 (2-27-20): 2134-2136 hold the signed 24-bit product (two's complement).
  readProduct(port) {
    requireValue(port >= MPYL && port <= MPYH, 'ppu_read_port_required');
    requireValue(this.m7aKnown && this.m7bKnown, 'ppu_multiplier_operands_required');
    const multiplicand = (this.m7a << WORD_BITS) >> WORD_BITS,
      multiplier = (this.m7b << M7B_SIGN_SHIFT) >> M7B_SIGN_SHIFT;
    return ((multiplicand * multiplier) >>> (BYTE_BITS * (port - MPYL))) & BYTE_MASK;
  }
  // Called per output frame.
  requireComplete() {
    requireValue(allKnown(this.vramKnown), 'ppu_initial_memory_required', { name: 'VRAM' });
    requireValue(allKnown(this.cgramKnown), 'ppu_initial_memory_required', { name: 'CGRAM' });
    requireValue(allKnown(this.oamKnown), 'ppu_initial_memory_required', { name: 'OAM' });
  }
}

// Write-side DMA from actual CPU channel registers, not recorded output bytes.
// Book I chapter 28 PDF149/151; only the source-proved forward modes are admitted.
// 420C (PDF 144) only enables H-DMA channels; their per-line writes are
// computed for each output frame by hdma.mjs. beforeHdmaWrite sees each write
// that can change an enabled field (420C itself and enabled channels' 43x0-43x4).
export class PpuBus {
  constructor(
    memory,
    ppu = new PpuState(),
    { beforePpuWrite = null, reverseDma = null, beforeHdmaWrite = null } = {},
  ) {
    this.memory = memory;
    this.ppu = ppu;
    this.dma = new Uint8Array(DMA_REGISTER_BYTES);
    this.dmaKnown = new Uint8Array(DMA_REGISTER_BYTES);
    this.dmaBytes = 0;
    this.ppuWrites = 0;
    this.beforePpuWrite = beforePpuWrite;
    this.reverseDma = reverseDma;
    this.beforeHdmaWrite = beforeHdmaWrite;
  }
  write(pc, address, value, width) {
    for (let n = 0; n < width; n++)
      this.writeByte((address + n) & WORD_MASK, (value >>> (BYTE_BITS * n)) & BYTE_MASK);
  }
  writeByte(port, value) {
    if (port >= INIDISP && port <= SETINI) {
      this.beforePpuWrite?.(this.ppuWrites, port, value);
      this.ppu.writeByte(port, value);
      this.ppuWrites++;
    } else if (port >= DMAP0 && port <= NTRL7) {
      const channel = (port - DMAP0) >>> DMA_CHANNEL_SHIFT;
      if (
        (port & DMA_REGISTER_INDEX_MASK) < HDMA_FIELD_REGISTERS &&
        this.ppu.hdmaEnabled & (1 << channel)
      )
        this.beforeHdmaWrite?.(port, value);
      this.dma[port - DMAP0] = value;
      this.dmaKnown[port - DMAP0] = 1;
    } else if (port === MDMAEN && value) this.transfer(value);
    else if (port === HDMAEN) this.enableHdma(value);
  }
  // A disabled channel leaves its targets at the last H-DMA value of the field,
  // which this frame model does not track: they become unknown registers.
  enableHdma(mask) {
    if (mask !== this.ppu.hdmaEnabled) this.beforeHdmaWrite?.(HDMAEN, mask);
    for (let channel = 0; channel < DMA_CHANNELS; channel++)
      if (this.ppu.hdmaEnabled & ~mask & (1 << channel)) {
        const at = channel * DMA_CHANNEL_STRIDE,
          mode = this.dma[at + DMA_PARAMETERS] & DMAP_TRANSFER_MODE_MASK,
          target = this.dma[at + DMA_B_ADDRESS];
        for (const offset of new Set(TRANSFER_UNITS[mode] ?? [])) {
          if (target + offset < PPU_REGISTER_COUNT) this.ppu.registerKnown[target + offset] = 0;
          // Scroll words have their own known flags (BG1HOFS-BG4VOFS).
          const scroll = INIDISP + target + offset - BG1HOFS;
          if (scroll >= 0 && scroll <= BG4VOFS - BG1HOFS) this.ppu.scrollKnown[scroll] = 0;
        }
      }
    this.ppu.hdmaEnabled = mask;
  }
  transfer(mask) {
    for (let channel = 0; channel < DMA_CHANNELS; channel++)
      if (mask & (1 << channel)) {
        const at = channel * DMA_CHANNEL_STRIDE;
        // PDF 143: a channel enabled in 420C must not be used for general DMA.
        requireValue(!(this.ppu.hdmaEnabled & (1 << channel)), 'ppu_hdma_channel_conflict', {
          channel,
        });
        for (let n = 0; n < DMA_TRANSFER_REGISTERS; n++)
          requireValue(this.dmaKnown[at + n] === 1, 'ppu_dma_register_required', { channel, n });
        const mode = this.dma[at + DMA_PARAMETERS],
          target = INIDISP + this.dma[at + DMA_B_ADDRESS],
          bank = this.dma[at + DMA_A_BANK];
        if (mode === REVERSE_DMA.mode) {
          requireValue(
            this.reverseDma !== null &&
              channel === REVERSE_DMA.channel &&
              target === REVERSE_DMA.port &&
              bank === REVERSE_DMA.bank &&
              this.dma[at + DMA_A_ADDRESS_LOW] === REVERSE_DMA.addressLow &&
              this.dma[at + DMA_A_ADDRESS_HIGH] === REVERSE_DMA.addressHigh &&
              this.dma[at + DMA_COUNT_LOW] === REVERSE_DMA.length &&
              this.dma[at + DMA_COUNT_HIGH] === 0,
            'ppu_reverse_dma_required',
          );
          const bytes = Uint8Array.from({ length: REVERSE_DMA.length }, (_, n) =>
            this.ppu.readVram(RDVRAML + (n & 1)),
          );
          this.reverseDma(bytes);
          this.dma[at + DMA_A_ADDRESS_LOW] = REVERSE_DMA.addressLow + REVERSE_DMA.length;
          this.dma[at + DMA_COUNT_LOW] = this.dma[at + DMA_COUNT_HIGH] = 0;
          this.dmaBytes += REVERSE_DMA.length;
          continue;
        }
        requireValue(DMA_MODES.includes(mode), 'ppu_dma_mode_required', { mode });
        requireValue(DMA_TARGETS.includes(target), 'ppu_dma_target_required', { target });
        const length =
          this.dma[at + DMA_COUNT_LOW] | (this.dma[at + DMA_COUNT_HIGH] << BYTE_BITS) ||
          DMA_ZERO_COUNT_LENGTH;
        const alternating = (mode & DMAP_TRANSFER_MODE_MASK) === TRANSFER_MODE_ALTERNATING;
        let source =
          this.dma[at + DMA_A_ADDRESS_LOW] | (this.dma[at + DMA_A_ADDRESS_HIGH] << BYTE_BITS);
        for (let n = 0; n < length; n++) {
          const address = (bank << WORD_BITS) | source;
          requireValue(
            (bank & BANK_WITHOUT_IO) !== 0 || source < IO_AREA_START || source >= IO_AREA_END,
            'ppu_dma_source_required',
            { address },
          );
          this.writeByte(target + (alternating ? n & 1 : 0), this.memory.read8(address));
          if (!(mode & DMAP_FIXED_SOURCE)) source = (source + 1) & WORD_MASK;
        }
        this.dma[at + DMA_A_ADDRESS_LOW] = source & BYTE_MASK;
        this.dma[at + DMA_A_ADDRESS_HIGH] = source >>> BYTE_BITS;
        this.dma[at + DMA_COUNT_LOW] = this.dma[at + DMA_COUNT_HIGH] = 0;
        this.dmaBytes += length;
      }
  }
}
