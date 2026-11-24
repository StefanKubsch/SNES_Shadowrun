// Video interface for lifted game code (docs/STRATEGY.md, "Lifted code").
// Game code states what the screen needs (a VRAM word, a colour, a scroll
// position, a layer selection); this SNES back end turns each request into
// the register writes of the original, in the original order, so the PPU
// model (src/video/ppu-state.mjs) sees exactly the same writes. Another
// platform implements the same methods on its own display.
//
// The NMI transfers below (sendPalette to readVramToWram) state each transfer in
// full: source, size and destination. The SNES back end writes only the registers the
// original writes there; the mode and B-bus target of the channels it does not set
// come from the channel setup the game made earlier (the font upload 81:AB2C and the
// scene register lists), as each method notes. site arguments are the original
// instructions of the writes; the device model may tell accesses apart by them.
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
  RDVRAMH,
  SETINI,
  TM,
  TMW,
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
  DMAP_ONE_PORT,
  DMAP_TWO_PORTS,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../constants/ppu.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// DMA channel registers are 16 bytes apart; the general transfers use channel 0.
const DMA_CHANNEL_STRIDE = 0x10,
  DMA_CHANNEL_0 = 1,
  // A palette: 15 colours of two bytes.
  PALETTE_COLOURS_BYTES = 0x1e,
  // A BG layer has a horizontal and a vertical scroll register (BG1HOFS, BG1VOFS, ...).
  SCROLL_REGISTERS_PER_LAYER = 2;
// The scene defaults of 81:EE4F: all WRIO outputs high, COLDATA 0 on all three
// components, colour math prevented everywhere (CGWSEL bits 4-5 = 3) and FastROM.
// A channel's register from the channel 0 register, and its MDMAEN bit.
const channelRegister = (register, channel) => register + channel * DMA_CHANNEL_STRIDE,
  channelBit = (channel) => 1 << channel;

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
  // write(address, value, width, site) and read(address, width, site) reach the
  // hardware at a bank-0 bus address.
  constructor(write, read = null) {
    this.write = write;
    this.read = read;
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
  setDisplay(value, site) {
    this.write(INIDISP, value, 1, site);
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
  setMainLayers(layers, site) {
    this.write(TM, layers, 1, site);
  }
  setSubLayers(layers, site) {
    this.write(TS, layers, 1, site);
  }
  // Layer bits of the main screen that its window areas mask.
  setMainWindowLayers(layers, site) {
    this.write(TMW, layers, 1, site);
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
  enableHdma(channels, site) {
    this.write(HDMAEN, channels, 1, site);
  }

  // 15 colours from a long CPU address to CGRAM from colour on, by DMA on channel 4
  // (mode 0 to CGDATA from the channel setup). sites: source, bytes, colour, bank, start.
  sendPalette(source, colour, sites) {
    this.write(channelRegister(A1T0L, 4), source & WORD_MASK, 2, sites.source);
    this.write(channelRegister(DAS0L, 4), PALETTE_COLOURS_BYTES, 2, sites.bytes);
    this.write(CGADD, colour & BYTE_MASK, 1, sites.colour);
    this.write(channelRegister(A1B0, 4), source >>> WORD_BITS, 1, sites.bank);
    this.write(MDMAEN, channelBit(4), 1, sites.start);
  }
  // One colour by CGADD and two CGDATA bytes. sites: colour, low, high.
  setColour(colour, value, sites) {
    this.write(CGADD, colour, 1, sites.colour);
    this.write(CGDATA, value & BYTE_MASK, 1, sites.low);
    this.write(CGDATA, (value >>> BYTE_BITS) & BYTE_MASK, 1, sites.high);
  }
  // bytes of colours from a long CPU address to CGRAM from colour on, by DMA on
  // channel 0 with its whole setup. sites: source, bytes, mode, colour, bank, start.
  sendPaletteStep(source, bytes, colour, sites) {
    this.write(A1T0L, source & WORD_MASK, 2, sites.source);
    this.write(DAS0L, bytes, 2, sites.bytes);
    this.write(DMAP0, ((CGDATA & BYTE_MASK) << BYTE_BITS) | DMAP_ONE_PORT, 2, sites.mode);
    this.write(CGADD, colour, 1, sites.colour);
    this.write(A1B0, source >>> WORD_BITS, 1, sites.bank);
    this.write(MDMAEN, channelBit(0), 1, sites.start);
  }
  // bytes from a long CPU address to VRAM from a word address on, by DMA on channel 1
  // (word mode to VMDATA from the channel setup). sites: source, bytes, address,
  // increment, bank, start.
  sendVramRecord(source, bytes, address, sites) {
    this.write(channelRegister(A1T0L, 1), source & WORD_MASK, 2, sites.source);
    this.write(channelRegister(DAS0L, 1), bytes, 2, sites.bytes);
    this.write(VMADDL, address, 2, sites.address);
    this.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, sites.increment);
    this.write(channelRegister(A1B0, 1), source >>> WORD_BITS, 1, sites.bank);
    this.write(MDMAEN, channelBit(1), 1, sites.start);
  }
  // The OAM from an OAM address word on (with its priority rotation bit): bytes from a
  // WRAM address of bank 7E, by DMA on channel 2 (to OAMDATA from the channel setup).
  // sites: source, bytes, address, start.
  sendOamBuffer(source, bytes, oamAddress, sites) {
    this.write(channelRegister(A1T0L, 2), source & WORD_MASK, 2, sites.source);
    this.write(channelRegister(DAS0L, 2), bytes, 2, sites.bytes);
    this.write(OAMADDL, oamAddress, 2, sites.address);
    this.write(MDMAEN, channelBit(2), 1, sites.start);
  }
  // Channel 0 set up for a later VRAM transfer: bytes from a long CPU address to
  // VMDATA in word mode. sites: bytes, source, bank, target, increment, mode.
  setUpVramTransfer(source, bytes, sites) {
    this.write(DAS0L, bytes, 2, sites.bytes);
    this.write(A1T0L, source & WORD_MASK, 2, sites.source);
    this.write(A1B0, source >>> WORD_BITS, 1, sites.bank);
    this.write(BBAD0, VMDATAL & BYTE_MASK, 1, sites.target);
    this.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, sites.increment);
    this.write(DMAP0, DMAP_TWO_PORTS, 1, sites.mode);
  }
  // Start the VRAM transfer channel 0 holds (setUpVramTransfer) at a word address.
  // sites: address, start.
  startVramTransfer(address, sites) {
    this.write(VMADDL, address, 2, sites.address);
    this.write(MDMAEN, channelBit(0), 1, sites.start);
  }
  // A picture in two halves of bytes each, from a long CPU address to VRAM word 0 and
  // the word address lower, by DMA on channel 0. sites: source, bank, target,
  // increment, mode, upperAddress, upperBytes, upperStart, lowerAddress, lowerBytes,
  // lowerStart.
  sendSplitPicture(source, bytes, lower, sites) {
    this.write(A1T0L, source & WORD_MASK, 2, sites.source);
    this.write(A1B0, source >>> WORD_BITS, 1, sites.bank);
    this.write(BBAD0, VMDATAL & BYTE_MASK, 1, sites.target);
    this.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, sites.increment);
    this.write(DMAP0, DMAP_TWO_PORTS, 1, sites.mode);
    this.write(VMADDL, 0, 2, sites.upperAddress);
    this.write(DAS0L, bytes, 2, sites.upperBytes);
    this.write(MDMAEN, channelBit(0), 1, sites.upperStart);
    this.write(VMADDL, lower, 2, sites.lowerAddress);
    this.write(DAS0L, bytes, 2, sites.lowerBytes);
    this.write(MDMAEN, channelBit(0), 1, sites.lowerStart);
  }
  // OAM entry 0: X, Y, character and attributes. sites: oamAddress, x, y, tile,
  // attributes.
  setFirstSprite(x, y, tile, attributes, sites) {
    this.write(OAMADDL, 0, 2, sites.oamAddress);
    this.write(OAMDATA, x, 1, sites.x);
    this.write(OAMDATA, y, 1, sites.y);
    this.write(OAMDATA, tile, 1, sites.tile);
    this.write(OAMDATA, attributes, 1, sites.attributes);
  }
  // OAM entry 0 hidden: its X and the hidden Y only. sites: oamAddress, x, hidden.
  hideFirstSprite(x, hiddenY, sites) {
    this.write(OAMADDL, 0, 2, sites.oamAddress);
    this.write(OAMDATA, x, 1, sites.x);
    this.write(OAMDATA, hiddenY, 1, sites.hidden);
  }
  // bytes of the zero byte at a long CPU address to VRAM from a word address on, by
  // DMA on channel 6 (fixed source, word mode to VMDATA, bank 81 from the font
  // upload). sites: source, bytes, address, increment, start.
  clearVramChunk(source, bytes, address, sites) {
    this.write(channelRegister(A1T0L, 6), source & WORD_MASK, 2, sites.source);
    this.write(channelRegister(DAS0L, 6), bytes, 2, sites.bytes);
    this.write(VMADDL, address, 2, sites.address);
    this.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, sites.increment);
    this.write(MDMAEN, channelBit(6), 1, sites.start);
  }
  // bytes from a WRAM address of bank 7E to VRAM from a word address on, by DMA on
  // channel 7 (word mode to VMDATA, bank 7E from the font upload). sites: source,
  // bytes, address, increment, start.
  copyWramToVram(source, bytes, address, sites) {
    this.write(channelRegister(A1T0L, 7), source & WORD_MASK, 2, sites.source);
    this.write(channelRegister(DAS0L, 7), bytes, 2, sites.bytes);
    this.write(VMADDL, address, 2, sites.address);
    this.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, sites.increment);
    this.write(MDMAEN, channelBit(7), 1, sites.start);
  }
  // bytes read back from VRAM at a word address into a WRAM address of bank 7E, by
  // DMA on channel 5 (from RDVRAM, bank 7E from the font upload), after the latching
  // dummy read of RDVRAMH. sites: address, bytes, target, increment, latch, start.
  readVramToWram(address, bytes, target, sites) {
    this.write(VMADDL, address, 2, sites.address);
    this.write(channelRegister(DAS0L, 5), bytes, 2, sites.bytes);
    this.write(channelRegister(A1T0L, 5), target & WORD_MASK, 2, sites.target);
    this.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, sites.increment);
    this.read(RDVRAMH, 1, sites.latch);
    this.write(MDMAEN, channelBit(5), 1, sites.start);
  }
}

// The video interface over a hardware port (src/system/hardware-port.mjs); a video
// interface passes through. Register-level callers hand the NMI jobs a hardware port.
export const videoOf = (port) =>
  port instanceof VideoPort ? port : new VideoPort(port.write, port.read);
