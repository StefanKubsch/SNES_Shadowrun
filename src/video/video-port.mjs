// Video interface for lifted game code (docs/STRATEGY.md, "Lifted code").
// Game code states what the screen needs (a VRAM word, a colour, a scroll
// position, a layer selection); this SNES back end turns each request into
// the register writes of the original, in the original order, so the PPU
// model (src/video/ppu-state.mjs) sees exactly the same writes. Another
// platform implements the same methods on its own display.
import {
  A1B0,
  A1T0L,
  BBAD0,
  BG1HOFS,
  BG34NBA,
  BGMODE,
  CGADD,
  CGADSUB,
  CGDATA,
  CGSWSEL,
  COLDATA,
  DAS0L,
  DMAP0,
  HDMAEN,
  INIDISP,
  M7A,
  M7B,
  M7C,
  M7D,
  M7SEL,
  M7X,
  M7Y,
  MDMAEN,
  MEMSEL,
  NMITIMEN,
  OAMADDL,
  OAMDATA,
  OBJSEL,
  SETINI,
  TM,
  TS,
  VMADDL,
  VMAINC,
  VMDATAL,
  W12SEL,
  WRIO,
} from '../constants/hardware-registers.mjs';
import {
  COLDATA_BLUE,
  COLDATA_GREEN,
  COLDATA_RED,
  DMAP_FIXED_SOURCE,
  DMAP_TWO_PORTS,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../constants/ppu.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// DMA channel registers are 16 bytes apart; the general transfers use channel 0.
const DMA_CHANNEL_STRIDE = 0x10,
  DMA_CHANNEL_0 = 1,
  // A BG layer has a horizontal and a vertical scroll register (BG1HOFS, BG1VOFS, ...).
  SCROLL_REGISTERS_PER_LAYER = 2;
// The scene defaults of 81:EE4F: all WRIO outputs high, COLDATA 0 on all three
// components, colour math prevented everywhere (CGWSEL bits 4-5 = 3) and FastROM.
const WRIO_ALL_HIGH = 0xff,
  COLDATA_ALL_ZERO = COLDATA_RED | COLDATA_GREEN | COLDATA_BLUE,
  CGSWSEL_MATH_PREVENTED = 0x30,
  MEMSEL_FAST_ROM = 1,
  // Registers the reset clears from the top down: OBJSEL-OAMDATA with VMAINC-VMDATAH,
  // BGMODE-BG34NBA with the scroll pairs, W12SEL-CGADSUB with NMITIMEN-HDMAEN-MEMSEL.
  OBJ_GROUP = 3,
  BG_GROUP = BG34NBA - BGMODE + 1,
  WINDOW_GROUP = CGADSUB - W12SEL + 1,
  // The mode 7 matrix: A and D 1.0 (0100), the rest 0, each written low byte first.
  MODE7_IDENTITY = [
    [M7A, 0],
    [M7A, 1],
    [M7B, 0],
    [M7B, 0],
    [M7C, 0],
    [M7C, 0],
    [M7D, 0],
    [M7D, 1],
    [M7X, 0],
    [M7X, 0],
    [M7Y, 0],
    [M7Y, 0],
  ];

export class VideoPort {
  // write(address, value, width) reaches the hardware at a bank-0 bus address.
  constructor(write) {
    this.write = write;
  }
  // One VRAM word at a word address (the increment mode is already set).
  setVramWord(address, value) {
    this.write(VMADDL, address, 2);
    this.write(VMDATAL, value, 2);
  }
  // Consecutive VRAM words from a word address on (the increment mode is already set).
  setVramWords(address, values) {
    this.write(VMADDL, address, 2);
    for (const value of values) this.write(VMDATAL, value, 2);
  }
  // count copies of one word from a word address on.
  fillVramWords(address, value, count) {
    this.write(VMADDL, address, 2);
    for (let n = 0; n < count; n++) this.write(VMDATAL, value, 2);
  }
  // bytes VRAM bytes from a word address on, all taken from the one source word at
  // sourceAddress (a long CPU address), by DMA on channel 0.
  fillVramFromWord(address, sourceAddress, bytes, increment) {
    this.write(VMAINC, increment, 1);
    this.write(DMAP0, DMAP_FIXED_SOURCE | DMAP_TWO_PORTS, 1);
    this.write(VMADDL, address, 2);
    this.write(BBAD0, VMDATAL & BYTE_MASK, 1);
    this.write(A1T0L, sourceAddress & WORD_MASK, 2);
    this.write(A1B0, sourceAddress >>> WORD_BITS, 1);
    this.write(DAS0L, bytes, 2);
    this.write(MDMAEN, DMA_CHANNEL_0, 1);
  }
  // Copies from CPU memory to VRAM by DMA on channel 0. next() returns the following
  // transfer {bytes, increment, source, address} or null at the end of the batch.
  copyToVram(next) {
    this.write(DMAP0, DMAP_TWO_PORTS, 1);
    this.write(BBAD0, VMDATAL & BYTE_MASK, 1);
    for (let t = next(); t !== null; t = next()) {
      this.write(DAS0L, t.bytes, 2);
      this.write(VMAINC, t.increment, 1);
      this.write(A1B0, t.source >>> WORD_BITS, 1);
      this.write(A1T0L, t.source & WORD_MASK, 2);
      this.write(VMADDL, t.address, 2);
      this.write(MDMAEN, DMA_CHANNEL_0, 1);
    }
    this.write(MDMAEN, 0, 1);
  }
  // The whole OAM (bytes from OAM address 0) from a long CPU address, by DMA on
  // channel 0 (81:ED8B).
  copyToOam(source, bytes) {
    this.write(OAMADDL, 0, 2);
    this.write(DMAP0, 0, 1);
    this.write(BBAD0, OAMDATA & BYTE_MASK, 1);
    this.write(A1T0L, source & WORD_MASK, 2);
    this.write(A1B0, source >>> WORD_BITS, 1);
    this.write(DAS0L, bytes, 2);
    this.write(MDMAEN, DMA_CHANNEL_0, 1);
  }
  // Clear all of VRAM from the zero byte at a long CPU address, by DMA on channel 0
  // (81:EE22; a byte count of 0 moves 64 KB).
  clearVram(zeroByte) {
    this.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
    this.write(DMAP0, DMAP_FIXED_SOURCE | DMAP_TWO_PORTS, 1);
    this.write(BBAD0, VMDATAL & BYTE_MASK, 1);
    this.write(A1T0L, zeroByte & WORD_MASK, 2);
    this.write(A1B0, zeroByte >>> WORD_BITS, 1);
    this.write(DAS0L, 0, 2);
    this.write(VMADDL, 0, 2);
    this.write(MDMAEN, DMA_CHANNEL_0, 1);
  }
  // The register state every scene starts from (81:EE4F). As in the original it also
  // clears the CPU registers 4200-420E (interrupts, multiplication, division, DMA).
  resetRegisters() {
    for (let n = OBJ_GROUP - 1; n >= 0; n--) {
      this.write(OBJSEL + n, 0, 1);
      this.write(VMAINC + n, 0, 1);
    }
    for (let n = BG_GROUP - 1; n >= 0; n--) {
      this.write(BGMODE + n, 0, 1);
      this.write(BG1HOFS + n, 0, 1);
      this.write(BG1HOFS + n, 0, 1);
    }
    this.write(CGADD, 0, 1);
    this.write(M7SEL, 0, 1);
    for (const [register, value] of MODE7_IDENTITY) this.write(register, value, 1);
    this.write(SETINI, 0, 1);
    for (let n = WINDOW_GROUP - 1; n >= 0; n--) {
      this.write(W12SEL + n, 0, 1);
      this.write(NMITIMEN + n, 0, 1);
    }
    this.write(WRIO, WRIO_ALL_HIGH, 1);
    this.write(COLDATA, COLDATA_ALL_ZERO, 1);
    this.write(CGSWSEL, CGSWSEL_MATH_PREVENTED, 1);
    this.write(MEMSEL, MEMSEL_FAST_ROM, 1);
  }
  // Forced blank and brightness (INIDISP).
  setDisplay(value) {
    this.write(INIDISP, value, 1);
  }
  // Consecutive colours (15-bit BGR) from a CGRAM index on.
  setColours(index, ...colours) {
    this.write(CGADD, index, 1);
    for (const colour of colours) {
      this.write(CGDATA, colour & BYTE_MASK, 1);
      this.write(CGDATA, colour >>> BYTE_BITS, 1);
    }
  }
  // BG layer 1-4: horizontal then vertical scroll offset.
  setScroll(layer, x, y) {
    const port = BG1HOFS + (layer - 1) * SCROLL_REGISTERS_PER_LAYER;
    for (const [at, value] of [
      [port, x],
      [port + 1, y],
    ]) {
      this.write(at, value & BYTE_MASK, 1);
      this.write(at, (value >>> BYTE_BITS) & BYTE_MASK, 1);
    }
  }
  setVerticalScroll(layer, y) {
    const port = BG1HOFS + (layer - 1) * SCROLL_REGISTERS_PER_LAYER + 1;
    this.write(port, y & BYTE_MASK, 1);
    this.write(port, (y >>> BYTE_BITS) & BYTE_MASK, 1);
  }
  // Layer bits of the main and the sub screen (LAYER_* in src/constants/ppu.mjs).
  setMainLayers(layers) {
    this.write(TM, layers, 1);
  }
  setSubLayers(layers) {
    this.write(TS, layers, 1);
  }
  // Colour math: the source selection and the layers it applies to.
  setColourSelect(select) {
    this.write(CGSWSEL, select, 1);
  }
  setColourMathLayers(layers) {
    this.write(CGADSUB, layers, 1);
  }
  // Fixed colour: the component bits and a 5-bit intensity.
  setFixedColour(value) {
    this.write(COLDATA, value, 1);
  }
  // H-DMA channel: transfer mode, target register, table (long CPU address).
  setUpHdma(channel, mode, register, table) {
    const at = channel * DMA_CHANNEL_STRIDE;
    this.write(DMAP0 + at, mode, 1);
    this.write(BBAD0 + at, register & BYTE_MASK, 1);
    this.write(A1T0L + at, table & WORD_MASK, 2);
    this.write(A1B0 + at, table >>> WORD_BITS, 1);
  }
  enableHdma(channels) {
    this.write(HDMAEN, channels, 1);
  }
}
