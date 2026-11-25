// The picture back end of live play (docs/FRAME-DESCRIPTION.md, phase 5 step 5): it
// implements the video interface of src/video/video-port.mjs on a typed picture state
// (display, BG layers, screens, windows, colour effects, sprites, palette, character
// and map memory) instead of PPU registers, and builds the frame description of
// src/video/frame-renderer.mjs from that state.
//
// Register numbers remain only where the game hands over register data:
// - writeRegister decodes one register byte. The power-on reset (80:E3xx), the scene
//   list's register command and the window tile multiplication (M7A/M7B, whose
//   product readProduct answers) reach it through the hardware port, and it handles
//   MDMAEN and HDMAEN stores that the video interface passes on as CPU writes.
// - H-DMA tables in WRAM and ROM name their per-line target register; the rows of a
//   frame decode them into the renderer's row changes.
// DMA channels keep their parameters (pattern, destination port, source, count), since
// the game sets them up in parts long before a transfer starts. Transfers read their
// source through memory.read8 and write the typed state at once.
//
// The semantics follow the SNES back end (src/video/ppu-state.mjs, ppu-frame.mjs and
// hdma.mjs; Book I chapter 27 PDF 115-134, chapter 28 PDF 143-152). That back end
// also proves that every value the frame reads was written; this one starts from zero
// memories, which the golden traces show the game always overwrites first.
import {
  BYTE_BITS,
  BYTE_MASK,
  NIBBLE_BITS,
  NIBBLE_MASK,
  WORD_BITS,
  WORD_MASK,
} from '../constants/bits.mjs';
import {
  BG12NBA,
  BG1HOFS,
  BG1SC,
  BG4SC,
  BG4VOFS,
  BGMODE,
  CGADD,
  CGADSUB,
  CGDATA,
  CGSWSEL,
  COLDATA,
  HDMAEN,
  INIDISP,
  M7A,
  M7B,
  MDMAEN,
  MOSAIC,
  MPYL,
  NMITIMEN,
  OAMADDH,
  OAMADDL,
  OAMDATA,
  OBJSEL,
  RDVRAMH,
  RDVRAML,
  SETINI,
  TM,
  TMW,
  TS,
  TSW,
  VMADDH,
  VMADDL,
  VMAINC,
  VMDATAH,
  VMDATAL,
  W12SEL,
  WBGLOG,
  WH0,
  WH3,
  WOBJLOG,
  WOBJSEL,
  WRIO,
  MEMSEL,
  BG34NBA,
} from '../constants/hardware-registers.mjs';
import {
  BGSC_BASE_MASK,
  BGSC_BASE_SHIFT,
  BGSC_TALL,
  BGSC_WIDE,
  CGRAM_COLOURS,
  CGRAM_HIGH_BYTE_MASK,
  CHARACTER_BASE_STEP,
  COLDATA_RED,
  COLOUR_COMPONENTS,
  COLOUR_COMPONENT_BITS,
  COLOUR_COMPONENT_MASK,
  DMAP_B_TO_A,
  DMAP_FIXED_SOURCE,
  DMAP_HDMA_INDIRECT,
  DMAP_ONE_PORT,
  DMAP_TRANSFER_MODE_MASK,
  DMAP_TWO_PORTS,
  DMA_CHANNELS,
  DMA_ZERO_COUNT_LENGTH,
  HDMA_LINE_COUNT_MASK,
  HDMA_REPEAT,
  INIDISP_BRIGHTNESS_MASK,
  INIDISP_FORCED_BLANK,
  OAM_BYTES,
  OAM_BYTE_ADDRESS_MASK,
  OAM_ENTRY_BYTES,
  OAM_HIGH_TABLE,
  OAM_HIGH_TABLE_MASK,
  OBJECT_COUNT,
  OBJSEL_BASE_MASK,
  OBJ_NAME_BASE_STEP,
  SCREEN_HEIGHT,
  SCROLL_MASK,
  VMAINC_INCREMENT_AFTER_HIGH,
  VMAINC_REMAP_BITS,
  VMAINC_STEP_MASK,
  VRAM_ADDRESS_STEPS,
  VRAM_BYTES,
  VRAM_WORD_ADDRESS_MASK,
} from '../constants/ppu.mjs';
import {
  BLANK_FRAME,
  COLOUR_WINDOW,
  NO_WINDOW,
  OBJ_LAYER,
  WINDOW_AREAS,
} from './frame-renderer.mjs';
import { DMA_TARGETS, dmaMode } from './video-port.mjs';

// A transfer or frame the picture state cannot describe (as PpuBoundary of the SNES
// back end).
export class PictureBoundary extends Error {
  constructor(reason, details = null) {
    super(reason);
    this.reason = reason;
    this.details = details;
  }
}
const need = (ok, reason, details) => {
  if (!ok) throw new PictureBoundary(reason, details);
};

const BG_LAYERS = 4,
  BG_LAYERS_MODE_1 = 3,
  BG_MODE_1 = 1,
  OBJ_LAYER_BIT = 1 << OBJ_LAYER,
  // Layer bits 5-7 of TM/TS/TMW/TSW are unused.
  LAYER_UNUSED_BITS = 0xe0,
  // BGMODE: mode bits 0-2, BG3 priority bit 3, 16x16 cell bits 4-7.
  BGMODE_MODE_MASK = 0x07,
  BGMODE_BG3_PRIORITY = 0x08,
  // Composition levels of tile priority 0 and 1 for BG1-BG3 in mode 1; the BG3
  // priority bit lifts BG3 high tiles in front of everything (ppu-frame.mjs).
  BG_LEVELS = [
    [6, 9],
    [5, 8],
    [1, 3],
  ],
  BG3_TOP_LEVEL = 11,
  BPP_2 = 2,
  BPP_4 = 4,
  MAP_PIXELS = 256,
  WIDE_MAP_PIXELS = 512,
  LARGE_TILE_SCALE = 2;
// CGWSEL fields: clip bits 6-7, colour math region bits 4-5, sub screen bit 1, direct
// colour bit 0. CGADSUB: layers bits 0-5, half bit 6, subtract bit 7.
const CLIP_SHIFT = 6,
  REGION_SHIFT = 4,
  REGION_MASK = 3,
  ADD_SUB_SCREEN = 0x02,
  DIRECT_COLOUR = 0x01,
  CLIP_NEVER = 0,
  CLIP_OUTSIDE = 1,
  CLIP_INSIDE = 2,
  MATH_INSIDE = 1,
  MATH_OUTSIDE = 2,
  MATH_NEVER = 3,
  MATH_LAYERS = 0x3f,
  MATH_HALF = 0x40,
  MATH_SUBTRACT = 0x80,
  // The scene defaults of 81:EE4F: colour math prevented everywhere.
  MATH_PREVENTED = 0x30;
// Window area nibbles: bit 0/2 invert window 1/2, bit 1/3 enable it.
const WINDOW_1_INVERT = 0x01,
  WINDOW_1_ENABLE = 0x02,
  WINDOW_2_INVERT = 0x04,
  WINDOW_2_ENABLE = 0x08,
  WINDOW_EDGES = 4,
  WINDOW_2_FIRST_EDGE = 2,
  // W12SEL, W34SEL and WOBJSEL hold the areas of two sources each.
  WINDOW_SELECTS = 3;
// OBJSEL: size pair bits 5-7, name gap bits 3-4, name base bits 0-2.
const OBJSEL_SIZE_SHIFT = 5,
  OBJSEL_GAP_SHIFT = 3,
  OBJSEL_GAP_MASK = 3,
  OBJ_NAME_GAP_STEP = 0x2000,
  OBJ_SIZES = [
    [8, 16],
    [8, 32],
    [8, 64],
    [16, 32],
    [16, 64],
    [32, 64],
  ],
  // OAM entry bytes, high table bits, attributes, coordinate ranges.
  OAM_X = 0,
  OAM_Y = 1,
  OAM_NAME = 2,
  OAM_ATTRIBUTES = 3,
  OBJECTS_PER_HIGH_BYTE_SHIFT = 2,
  OBJECT_IN_HIGH_BYTE_MASK = 3,
  HIGH_BITS_PER_OBJECT = 2,
  HIGH_SIZE_BIT = 1,
  OBJ_V_FLIP = 0x80,
  OBJ_H_FLIP = 0x40,
  OBJ_PRIORITY_SHIFT = 4,
  OBJ_PRIORITY_MASK = 3,
  OBJ_PALETTE_SHIFT = 1,
  OBJ_PALETTE_MASK = 7,
  OBJ_SECOND_TABLE = 0x01,
  OBJ_X_HIGH = 256,
  // OAMADDH: bit 0 address bit 8, bit 7 priority rotation.
  OAM_ADDRESS_HIGH_BIT = 0x100,
  OAM_PRIORITY_ROTATION = 0x80;
// The mode 7 multiplication (PDF 134): signed 16-bit times signed 8-bit.
const M7B_SIGN_SHIFT = 24,
  MPY_BYTES = 3;
// DMA: transfer pattern 1 writes two ports alternately; the B-bus ports of the
// destinations; H-DMA's B-bus offsets per pattern (PDF 149-152).
const PATTERN_TWO_PORTS = DMAP_TWO_PORTS,
  B_BUS = 0x2100,
  TRANSFER_UNITS = [[0], [0, 1], [0, 0], [0, 0, 1, 1], [0, 1, 2, 3]];
// The scene default 81:EE4F: all WRIO outputs high, FastROM.
const WRIO_ALL_HIGH = 0xff,
  MEMSEL_FAST_ROM = 1,
  // CPU registers 4200-420E that the scene default clears with the window registers.
  CPU_REGISTERS_CLEARED = CGADSUB - W12SEL + 1;
// The DMA channels of the video interface (video-port.mjs): general transfers, VRAM
// records, the OAM buffer, palettes, the text read-back, text tile clears and WRAM
// copies to VRAM.
const GENERAL = 0,
  RECORD = 1,
  OAM_BUFFER = 2,
  PALETTE = 4,
  READBACK = 5,
  CLEAR = 6,
  WRAM_COPY = 7;

const windowArea = (nibble) => ({
  one: !!(nibble & WINDOW_1_ENABLE),
  oneInvert: !!(nibble & WINDOW_1_INVERT),
  two: !!(nibble & WINDOW_2_ENABLE),
  twoInvert: !!(nibble & WINDOW_2_INVERT),
});
const NO_AREA = windowArea(0);
const newLayer = () => ({ base: 0, wide: false, tall: false, chars: 0, h: 0, v: 0 });
const newChannel = () => ({ mode: 0, port: B_BUS, source: 0, bank: 0, bytes: 0 });
// A map base and size byte (BGnSC) as map fields.
const mapFields = (value) => ({
  base: (value & BGSC_BASE_MASK) << BGSC_BASE_SHIFT,
  wide: !!(value & BGSC_WIDE),
  tall: !!(value & BGSC_TALL),
});
// A layer's map as the renderer's map fields.
const mapOf = (layer, large) => {
  const scale = large ? LARGE_TILE_SCALE : 1;
  return {
    base: layer.base,
    across: layer.wide ? 2 : 1,
    width: (layer.wide ? WIDE_MAP_PIXELS : MAP_PIXELS) * scale,
    height: (layer.tall ? WIDE_MAP_PIXELS : MAP_PIXELS) * scale,
  };
};

export class PictureVideo {
  // memory: read8/write8 at long CPU addresses (DMA sources, H-DMA tables, the VRAM
  // read-back target). system(address, value, width) is the hardware write for the
  // CPU registers the scene default clears (LiveGame sets it).
  constructor(memory) {
    this.memory = memory;
    this.system = null;
    // Whether the display register was written (the picture is defined from then on).
    this.displaySet = false;
    this.blank = false;
    this.brightness = 0;
    this.mode = 0;
    this.bg3Priority = false;
    this.largeTiles = 0;
    this.mosaic = 0;
    this.screenMode = 0;
    this.layers = Array.from({ length: BG_LAYERS }, newLayer);
    this.main = 0;
    this.sub = 0;
    this.mainWindows = 0;
    this.subWindows = 0;
    // Window areas of BG1-BG4, OBJ and the colour window; the logic bytes; the edges.
    this.areas = new Array(WINDOW_AREAS).fill(NO_AREA);
    this.windowLogic = 0;
    this.objectColourLogic = 0;
    this.edges = new Int16Array(WINDOW_EDGES).fill(-1);
    this.clip = CLIP_NEVER;
    this.mathRegion = 0;
    this.mathSub = false;
    this.directColour = false;
    this.mathLayers = 0;
    this.mathHalf = false;
    this.mathSubtract = false;
    this.fixedColour = 0;
    this.objectSizes = 0;
    this.objectBase = 0;
    this.objectGap = OBJ_NAME_GAP_STEP;
    this.objectRotation = false;
    this.palette = new Uint16Array(CGRAM_COLOURS);
    this.colourIndex = 0;
    this.colourLow = null;
    this.vram = new Uint8Array(VRAM_BYTES);
    this.vramAddress = 0;
    this.vramIncrement = 0;
    this.vramReadBuffer = 0;
    this.oam = new Uint8Array(OAM_BYTES);
    this.oamAddress = 0;
    this.oamByte = 0;
    this.oamLow = null;
    // Pending low bytes of a scroll or multiplicand write pair (register data only).
    this.scrollPort = -1;
    this.scrollLow = 0;
    this.m7a = 0;
    this.m7aLow = null;
    this.m7b = 0;
    this.channels = Array.from({ length: DMA_CHANNELS }, newChannel);
    this.hdma = 0;
  }
  // The video interface of the lifted code (sceneRuntime and videoOf).
  get video() {
    return this;
  }

  // ---- Typed state setters --------------------------------------------------------
  #display(value) {
    this.displaySet = true;
    this.blank = !!(value & INIDISP_FORCED_BLANK);
    this.brightness = value & INIDISP_BRIGHTNESS_MASK;
  }
  #objectSelect(value) {
    this.objectSizes = value >>> OBJSEL_SIZE_SHIFT;
    this.objectBase = (value & OBJSEL_BASE_MASK) * OBJ_NAME_BASE_STEP;
    this.objectGap = (((value >>> OBJSEL_GAP_SHIFT) & OBJSEL_GAP_MASK) + 1) * OBJ_NAME_GAP_STEP;
  }
  #bgMode(value) {
    this.mode = value & BGMODE_MODE_MASK;
    this.bg3Priority = !!(value & BGMODE_BG3_PRIORITY);
    this.largeTiles = value >>> NIBBLE_BITS;
  }
  // layer 0-3.
  #mapBase(layer, value) {
    Object.assign(this.layers[layer], mapFields(value));
  }
  // first: layer 0 (BG1/BG2) or 2 (BG3/BG4).
  #characterBases(first, value) {
    this.layers[first].chars = (value & NIBBLE_MASK) * CHARACTER_BASE_STEP;
    this.layers[first + 1].chars = (value >>> NIBBLE_BITS) * CHARACTER_BASE_STEP;
  }
  #scroll(layer, vertical, value) {
    this.layers[layer][vertical ? 'v' : 'h'] = value & SCROLL_MASK;
  }
  // select 0-2: the areas of sources 2*select and 2*select+1.
  #windowSelect(select, value) {
    this.areas[select * 2] = windowArea(value & NIBBLE_MASK);
    this.areas[select * 2 + 1] = windowArea(value >>> NIBBLE_BITS);
  }
  #colourSelect(value) {
    this.clip = value >>> CLIP_SHIFT;
    this.mathRegion = (value >>> REGION_SHIFT) & REGION_MASK;
    this.mathSub = !!(value & ADD_SUB_SCREEN);
    this.directColour = !!(value & DIRECT_COLOUR);
  }
  #colourMath(value) {
    this.mathLayers = value & MATH_LAYERS;
    this.mathHalf = !!(value & MATH_HALF);
    this.mathSubtract = !!(value & MATH_SUBTRACT);
  }
  // The fixed colour: bits 5-7 select red, green and blue for the 5-bit intensity.
  #fixed(value) {
    for (let c = 0; c < COLOUR_COMPONENTS; c++)
      if (value & (COLDATA_RED << c)) {
        const shift = COLOUR_COMPONENT_BITS * c;
        this.fixedColour =
          (this.fixedColour & ~(COLOUR_COMPONENT_MASK << shift)) |
          ((value & COLOUR_COMPONENT_MASK) << shift);
      }
  }
  // Character and map memory: the word address loads the read buffer (PDF 121-122).
  #vramWordAddress(address) {
    this.vramAddress = address & WORD_MASK;
    const at = (this.vramAddress & VRAM_WORD_ADDRESS_MASK) * 2;
    this.vramReadBuffer = this.vram[at] | (this.vram[at + 1] << BYTE_BITS);
  }
  #vramStep() {
    this.vramAddress =
      (this.vramAddress + VRAM_ADDRESS_STEPS[this.vramIncrement & VMAINC_STEP_MASK]) & WORD_MASK;
  }
  // One VRAM byte (high: the word's high byte) at the address; the address steps after
  // the byte the increment mode names.
  #vramByte(high, value) {
    need(!(this.vramIncrement & VMAINC_REMAP_BITS), 'picture_vram_remap_required', {
      mode: this.vramIncrement,
    });
    this.vram[((this.vramAddress & VRAM_WORD_ADDRESS_MASK) << 1) | high] = value;
    if (!!(this.vramIncrement & VMAINC_INCREMENT_AFTER_HIGH) === !!high) this.#vramStep();
  }
  #vramWord(value) {
    this.#vramByte(0, value & BYTE_MASK);
    this.#vramByte(1, (value >>> BYTE_BITS) & BYTE_MASK);
  }
  // One byte of the VRAM read-back (high: the buffer's high byte).
  #vramRead(high) {
    const value = (this.vramReadBuffer >>> (high ? BYTE_BITS : 0)) & BYTE_MASK;
    if (!!(this.vramIncrement & VMAINC_INCREMENT_AFTER_HIGH) === !!high) {
      const at = (this.vramAddress & VRAM_WORD_ADDRESS_MASK) * 2;
      this.vramReadBuffer = this.vram[at] | (this.vram[at + 1] << BYTE_BITS);
      this.#vramStep();
    }
    return value;
  }
  // Palette: the colour index and its pending low byte.
  #colourAt(index) {
    this.colourIndex = index & BYTE_MASK;
    this.colourLow = null;
  }
  #colourByte(value) {
    if (this.colourLow === null) this.colourLow = value;
    else {
      this.palette[this.colourIndex] =
        this.colourLow | ((value & CGRAM_HIGH_BYTE_MASK) << BYTE_BITS);
      this.colourIndex = (this.colourIndex + 1) & BYTE_MASK;
      this.colourLow = null;
    }
  }
  // Sprite memory: the address's low byte, its high byte (bit 8 and the priority
  // rotation) and one data byte; the low table takes byte pairs.
  #oamLowAddress(value) {
    this.oamAddress = (this.oamAddress & OAM_ADDRESS_HIGH_BIT) | value;
    this.oamByte = this.oamAddress * 2;
    this.oamLow = null;
  }
  #oamHighAddress(value) {
    this.oamAddress = (this.oamAddress & BYTE_MASK) | ((value & 1) << BYTE_BITS);
    this.objectRotation = !!(value & OAM_PRIORITY_ROTATION);
    this.oamByte = this.oamAddress * 2;
    this.oamLow = null;
  }
  #oamWordAddress(value) {
    this.#oamLowAddress(value & BYTE_MASK);
    this.#oamHighAddress(value >>> BYTE_BITS);
  }
  #oamData(value) {
    const address = this.oamByte;
    if (address >= OAM_HIGH_TABLE)
      this.oam[OAM_HIGH_TABLE + (address & OAM_HIGH_TABLE_MASK)] = value;
    else if (!(address & 1)) this.oamLow = value;
    else {
      need(this.oamLow !== null, 'picture_oam_low_required');
      this.oam[address - 1] = this.oamLow;
      this.oam[address] = value;
      this.oamLow = null;
    }
    this.oamByte = (address + 1) & OAM_BYTE_ADDRESS_MASK;
  }
  // H-DMA channels; a channel that stops leaves its targets as they were set.
  #enableHdma(mask) {
    this.hdma = mask & BYTE_MASK;
  }

  // ---- DMA ------------------------------------------------------------------------
  #channelSet(channel, { mode, port, source, bytes }) {
    const c = this.channels[channel];
    if (mode !== undefined) c.mode = mode;
    if (port !== undefined) c.port = port;
    if (source !== undefined) {
      c.source = source & WORD_MASK;
      c.bank = source >>> WORD_BITS;
    }
    if (bytes !== undefined) c.bytes = bytes;
  }
  // A destination port of a general DMA.
  #portByte(port, value) {
    if (port === VMDATAL) this.#vramByte(0, value);
    else if (port === VMDATAH) this.#vramByte(1, value);
    else if (port === CGDATA) this.#colourByte(value);
    else if (port === OAMDATA) this.#oamData(value);
    else throw new PictureBoundary('picture_dma_target_required', { port });
  }
  // General DMA on each channel of mask (PDF 143, 149-152): modes 0 and 1, with a
  // fixed source or not, to VRAM, CGRAM or OAM; the VRAM read-back to memory.
  #start(mask) {
    for (let channel = 0; channel < DMA_CHANNELS; channel++)
      if (mask & (1 << channel)) this.#run(channel);
  }
  #run(channel) {
    need(!(this.hdma & (1 << channel)), 'picture_hdma_channel_conflict', { channel });
    const c = this.channels[channel],
      length = c.bytes || DMA_ZERO_COUNT_LENGTH,
      pattern = c.mode & DMAP_TRANSFER_MODE_MASK,
      fixed = !!(c.mode & DMAP_FIXED_SOURCE);
    need(pattern === DMAP_ONE_PORT || pattern === PATTERN_TWO_PORTS, 'picture_dma_mode_required', {
      mode: c.mode,
    });
    let source = c.source;
    if (c.mode & DMAP_B_TO_A) {
      need(c.port === RDVRAML && pattern === PATTERN_TWO_PORTS, 'picture_reverse_dma_required');
      for (let n = 0; n < length; n++) {
        this.memory.write8((c.bank << WORD_BITS) | source, this.#vramRead(n & 1));
        if (!fixed) source = (source + 1) & WORD_MASK;
      }
    } else
      for (let n = 0; n < length; n++) {
        const value = this.memory.read8((c.bank << WORD_BITS) | source);
        this.#portByte(c.port + (pattern === PATTERN_TWO_PORTS ? n & 1 : 0), value);
        if (!fixed) source = (source + 1) & WORD_MASK;
      }
    c.source = source;
    c.bytes = 0;
  }

  // ---- Register data --------------------------------------------------------------
  // A hardware write that reaches the picture (LiveDevices passes every system area
  // write here, as to the SNES back end's PpuBus.write).
  write(pc, address, value, width) {
    for (let n = 0; n < width; n++)
      this.writeRegister((address + n) & WORD_MASK, (value >>> (BYTE_BITS * n)) & BYTE_MASK);
  }
  // One register byte from register data. Registers without picture effect (mode 7
  // matrix C/D, centre, M7SEL, CPU registers other than MDMAEN/HDMAEN) are dropped.
  writeRegister(port, value) {
    if (port === MDMAEN) {
      if (value) this.#start(value);
      return;
    }
    if (port === HDMAEN) return this.#enableHdma(value);
    if (port >= BG1HOFS && port <= BG4VOFS) {
      // Scroll offsets: a low then a high byte to the same register (PDF 119).
      need(this.scrollPort === -1 || this.scrollPort === port, 'picture_scroll_pair_required');
      if (this.scrollPort === -1) {
        this.scrollPort = port;
        this.scrollLow = value;
      } else {
        const at = port - BG1HOFS;
        this.#scroll(at >>> 1, at & 1, (value << BYTE_BITS) | this.scrollLow);
        this.scrollPort = -1;
      }
      return;
    }
    if (port >= BG1SC && port <= BG4SC) return this.#mapBase(port - BG1SC, value);
    if (port >= WH0 && port <= WH3) {
      this.edges[port - WH0] = value;
      return;
    }
    if (port >= W12SEL && port <= WOBJSEL) return this.#windowSelect(port - W12SEL, value);
    switch (port) {
      case INIDISP:
        return this.#display(value);
      case OBJSEL:
        return this.#objectSelect(value);
      case OAMADDL:
        return this.#oamLowAddress(value);
      case OAMADDH:
        return this.#oamHighAddress(value);
      case OAMDATA:
        return this.#oamData(value);
      case BGMODE:
        return this.#bgMode(value);
      case MOSAIC:
        this.mosaic = value;
        return;
      case BG12NBA:
        return this.#characterBases(0, value);
      case BG34NBA:
        return this.#characterBases(2, value);
      case VMAINC:
        this.vramIncrement = value;
        return;
      case VMADDL:
        return this.#vramWordAddress((this.vramAddress & ~BYTE_MASK) | value);
      case VMADDH:
        return this.#vramWordAddress((this.vramAddress & BYTE_MASK) | (value << BYTE_BITS));
      case VMDATAL:
        return this.#vramByte(0, value);
      case VMDATAH:
        return this.#vramByte(1, value);
      case M7A:
        // The multiplicand: a low then a high byte (PDF 124).
        if (this.m7aLow === null) this.m7aLow = value;
        else {
          this.m7a = (value << BYTE_BITS) | this.m7aLow;
          this.m7aLow = null;
        }
        return;
      case M7B:
        need(this.m7aLow === null, 'picture_multiplier_pair_required');
        this.m7b = value;
        return;
      case CGADD:
        return this.#colourAt(value);
      case CGDATA:
        return this.#colourByte(value);
      case WBGLOG:
        this.windowLogic = value;
        return;
      case WOBJLOG:
        this.objectColourLogic = value;
        return;
      case TM:
        this.main = value;
        return;
      case TS:
        this.sub = value;
        return;
      case TMW:
        this.mainWindows = value;
        return;
      case TSW:
        this.subWindows = value;
        return;
      case CGSWSEL:
        return this.#colourSelect(value);
      case CGADSUB:
        return this.#colourMath(value);
      case COLDATA:
        return this.#fixed(value);
      case SETINI:
        this.screenMode = value;
        return;
      default:
    }
    if (port >= B_BUS + DMA_CHANNEL_BLOCK_START) this.#channelRegister(port, value);
  }
  // DMA channel parameters from register data (43x0-43x6).
  #channelRegister(port, value) {
    const offset = port - DMA_CHANNEL_BLOCK,
      channel = offset >>> DMA_CHANNEL_SHIFT;
    if (offset < 0 || channel >= DMA_CHANNELS) return;
    const c = this.channels[channel];
    switch (offset & DMA_CHANNEL_REGISTER_MASK) {
      case DMA_PARAMETERS_OFFSET:
        c.mode = value;
        return;
      case DMA_PORT_OFFSET:
        c.port = B_BUS | value;
        return;
      case DMA_SOURCE_LOW:
        c.source = (c.source & ~BYTE_MASK) | value;
        return;
      case DMA_SOURCE_HIGH:
        c.source = (c.source & BYTE_MASK) | (value << BYTE_BITS);
        return;
      case DMA_BANK_OFFSET:
        c.bank = value;
        return;
      case DMA_COUNT_LOW_OFFSET:
        c.bytes = (c.bytes & ~BYTE_MASK) | value;
        return;
      case DMA_COUNT_HIGH_OFFSET:
        c.bytes = (c.bytes & BYTE_MASK) | (value << BYTE_BITS);
        return;
      default:
    }
  }
  // The signed product of M7A and M7B (PDF 134), one byte of MPYL-MPYH.
  readProduct(port) {
    const at = port - MPYL;
    need(at >= 0 && at < MPY_BYTES, 'picture_read_port_required', { port });
    const multiplicand = (this.m7a << WORD_BITS) >> WORD_BITS,
      multiplier = (this.m7b << M7B_SIGN_SHIFT) >> M7B_SIGN_SHIFT;
    return ((multiplicand * multiplier) >>> (BYTE_BITS * at)) & BYTE_MASK;
  }
  // One byte of the VRAM read-back by register (RDVRAML or RDVRAMH).
  readVram(port) {
    need(port === RDVRAML || port === RDVRAMH, 'picture_read_port_required', { port });
    return this.#vramRead(port === RDVRAMH ? 1 : 0);
  }

  // ---- The video interface (src/video/video-port.mjs) -----------------------------
  setVramWord(address, value) {
    this.#vramWordAddress(address);
    this.#vramWord(value);
  }
  setVramWords(address, values) {
    this.#vramWordAddress(address);
    for (const value of values) this.#vramWord(value);
  }
  fillVramWords(address, value, count) {
    this.#vramWordAddress(address);
    for (let n = 0; n < count; n++) this.#vramWord(value);
  }
  fillVramFromWord(address, sourceAddress, bytes, increment) {
    this.vramIncrement = increment;
    this.#channelSet(GENERAL, { mode: DMAP_FIXED_SOURCE | DMAP_TWO_PORTS });
    this.#vramWordAddress(address);
    this.#channelSet(GENERAL, { port: VMDATAL, source: sourceAddress, bytes });
    this.#run(GENERAL);
  }
  copyToVram(next) {
    this.#channelSet(GENERAL, { mode: DMAP_TWO_PORTS, port: VMDATAL });
    for (let t = next(); t !== null; t = next()) {
      this.#channelSet(GENERAL, { bytes: t.bytes, source: t.source });
      this.vramIncrement = t.increment;
      this.#vramWordAddress(t.address);
      this.#run(GENERAL);
    }
  }
  copyToOam(source, bytes) {
    this.#oamWordAddress(0);
    this.#channelSet(GENERAL, { mode: DMAP_ONE_PORT, port: OAMDATA, source, bytes });
    this.#run(GENERAL);
  }
  clearVram(zeroByte) {
    this.vramIncrement = VMAINC_INCREMENT_AFTER_HIGH;
    this.#channelSet(GENERAL, {
      mode: DMAP_FIXED_SOURCE | DMAP_TWO_PORTS,
      port: VMDATAL,
      source: zeroByte,
      bytes: 0,
    });
    this.#vramWordAddress(0);
    this.#run(GENERAL);
  }
  // The scene defaults (81:EE4F); the CPU registers it clears go to the hardware.
  resetRegisters() {
    this.#objectSelect(0);
    this.#oamWordAddress(0);
    this.vramIncrement = 0;
    this.#vramWordAddress(0);
    this.#bgMode(0);
    this.mosaic = 0;
    for (let layer = 0; layer < BG_LAYERS; layer++) {
      this.#mapBase(layer, 0);
      this.#scroll(layer, 0, 0);
      this.#scroll(layer, 1, 0);
    }
    this.#characterBases(0, 0);
    this.#characterBases(2, 0);
    this.#colourAt(0);
    // The mode 7 matrix: A = 1.0, B = 0 (the multiplier's operands).
    this.m7a = 1 << BYTE_BITS;
    this.m7aLow = null;
    this.m7b = 0;
    this.screenMode = 0;
    for (let select = 0; select < WINDOW_SELECTS; select++) this.#windowSelect(select, 0);
    this.edges.fill(0);
    this.windowLogic = this.objectColourLogic = 0;
    this.main = this.sub = this.mainWindows = this.subWindows = 0;
    this.#colourMath(0);
    for (let n = CPU_REGISTERS_CLEARED - 1; n >= 0; n--) this.system(NMITIMEN + n, 0, 1);
    this.system(WRIO, WRIO_ALL_HIGH, 1);
    this.#fixed(COLDATA_ALL_ZERO);
    this.#colourSelect(MATH_PREVENTED);
    this.system(MEMSEL, MEMSEL_FAST_ROM, 1);
  }
  setDisplay(value) {
    this.#display(value);
  }
  setColours(index, ...colours) {
    this.#colourAt(index);
    for (const colour of colours) {
      this.#colourByte(colour & BYTE_MASK);
      this.#colourByte((colour >>> BYTE_BITS) & BYTE_MASK);
    }
  }
  setScroll(layer, x, y) {
    this.#scroll(layer - 1, 0, x);
    this.#scroll(layer - 1, 1, y);
  }
  setVerticalScroll(layer, y) {
    this.#scroll(layer - 1, 1, y);
  }
  setMainLayers(layers) {
    this.main = layers;
  }
  setSubLayers(layers) {
    this.sub = layers;
  }
  setMainWindowLayers(layers) {
    this.mainWindows = layers;
  }
  setColourSelect(select) {
    this.#colourSelect(select);
  }
  setColourMathLayers(layers) {
    this.#colourMath(layers);
  }
  setFixedColour(value) {
    this.#fixed(value);
  }
  // The 16-bit store: its high byte reaches the OAM address's low byte.
  setObjectSelect(value) {
    this.#objectSelect(value & BYTE_MASK);
    this.#oamLowAddress((value >>> BYTE_BITS) & BYTE_MASK);
  }
  setWindowSelect(value) {
    this.#windowSelect(0, value & BYTE_MASK);
    this.#windowSelect(1, (value >>> BYTE_BITS) & BYTE_MASK);
  }
  setWindowLogic(value) {
    this.windowLogic = value & BYTE_MASK;
    this.objectColourLogic = (value >>> BYTE_BITS) & BYTE_MASK;
  }
  setUpHdmaTable(mode, register, table) {
    this.#channelSet(GENERAL, { mode, port: B_BUS | (register & BYTE_MASK), source: table });
  }
  setUpHdma(channel, mode, register, table) {
    this.#channelSet(channel, { mode, port: B_BUS | (register & BYTE_MASK), source: table });
  }
  enableHdma(channels) {
    this.#enableHdma(channels);
  }
  sendPalette(source, colour) {
    this.#channelSet(PALETTE, { bytes: PALETTE_COLOURS_BYTES });
    this.#channelSet(PALETTE, { source });
    this.#colourAt(colour);
    this.#run(PALETTE);
  }
  setColour(colour, value) {
    this.#colourAt(colour);
    this.#colourByte(value & BYTE_MASK);
    this.#colourByte((value >>> BYTE_BITS) & BYTE_MASK);
  }
  sendPaletteStep(source, bytes, colour) {
    this.#channelSet(GENERAL, { source, bytes, mode: DMAP_ONE_PORT, port: CGDATA });
    this.#colourAt(colour);
    this.#run(GENERAL);
  }
  sendVramRecord(source, bytes, address) {
    this.#channelSet(RECORD, { source, bytes });
    this.#vramWordAddress(address);
    this.vramIncrement = VMAINC_INCREMENT_AFTER_HIGH;
    this.#run(RECORD);
  }
  // The source's bank comes from the channel set-up (WRAM bank 7E).
  sendOamBuffer(source, bytes, oamAddress) {
    this.#setSourceWord(OAM_BUFFER, source);
    this.#channelSet(OAM_BUFFER, { bytes });
    this.#oamWordAddress(oamAddress);
    this.#run(OAM_BUFFER);
  }
  setUpVramTransfer(source, bytes) {
    this.#channelSet(GENERAL, { bytes, source, port: VMDATAL, mode: DMAP_TWO_PORTS });
    this.vramIncrement = VMAINC_INCREMENT_AFTER_HIGH;
  }
  sendToVram(source, bytes, address) {
    this.#vramWordAddress(address);
    this.setUpVramTransfer(source, bytes);
    this.#run(GENERAL);
  }
  startVramTransfer(address) {
    this.#vramWordAddress(address);
    this.#run(GENERAL);
  }
  sendSplitPicture(source, bytes, lower) {
    this.#channelSet(GENERAL, { source, port: VMDATAL, mode: DMAP_TWO_PORTS });
    this.vramIncrement = VMAINC_INCREMENT_AFTER_HIGH;
    this.#vramWordAddress(0);
    this.#channelSet(GENERAL, { bytes });
    this.#run(GENERAL);
    this.#vramWordAddress(lower);
    this.#channelSet(GENERAL, { bytes });
    this.#run(GENERAL);
  }
  setFirstSprite(x, y, tile, attributes) {
    this.#oamWordAddress(0);
    for (const value of [x, y, tile, attributes]) this.#oamData(value & BYTE_MASK);
  }
  hideFirstSprite(x, hiddenY) {
    this.#oamWordAddress(0);
    this.#oamData(x & BYTE_MASK);
    this.#oamData(hiddenY & BYTE_MASK);
  }
  // Channels 6 and 7 keep their bank from the font upload's set-up.
  clearVramChunk(source, bytes, address) {
    this.#setSourceWord(CLEAR, source);
    this.#channelSet(CLEAR, { bytes });
    this.#vramWordAddress(address);
    this.vramIncrement = VMAINC_INCREMENT_AFTER_HIGH;
    this.#run(CLEAR);
  }
  copyWramToVram(source, bytes, address) {
    this.#setSourceWord(WRAM_COPY, source);
    this.#channelSet(WRAM_COPY, { bytes });
    this.#vramWordAddress(address);
    this.vramIncrement = VMAINC_INCREMENT_AFTER_HIGH;
    this.#run(WRAM_COPY);
  }
  setUpDma(channels, order) {
    for (const part of order) for (const [channel, t] of channels) this.#dmaPart(channel, t, part);
  }
  transfer(channel, t, order) {
    for (const part of order) this.#dmaPart(channel, t, part);
  }
  #dmaPart(channel, t, part) {
    const c = this.channels[channel];
    switch (part) {
      case 'mode':
        c.mode = dmaMode(t);
        return;
      case 'target':
        c.port = DMA_TARGETS[t.to][0];
        return;
      case 'modeAndTarget':
        c.mode = dmaMode(t);
        c.port = DMA_TARGETS[t.to][0];
        return;
      case 'source':
        c.source = t.source & WORD_MASK;
        return;
      case 'bank':
        c.bank = t.source >>> WORD_BITS;
        return;
      case 'bytes':
        c.bytes = t.bytes;
        return;
      case 'address':
        if (t.to === 'cgram') this.#colourAt(t.address);
        else if (t.to === 'oam') this.#oamWordAddress(t.address);
        else this.#vramWordAddress(t.address);
        return;
      case 'increment':
        this.vramIncrement = t.increment ?? VMAINC_INCREMENT_AFTER_HIGH;
        return;
      case 'start':
        this.#run(channel);
        return;
      default:
        throw new Error(`unknown DMA part ${part}`);
    }
  }
  // The 16-bit store: its high byte reaches the VRAM address's low byte.
  setVramIncrement(increment, width = 1) {
    this.vramIncrement = increment & BYTE_MASK;
    if (width === 2)
      this.#vramWordAddress(
        (this.vramAddress & ~BYTE_MASK) | ((increment >>> BYTE_BITS) & BYTE_MASK),
      );
  }
  setVramAddress(address) {
    this.#vramWordAddress(address);
  }
  writeVramWords(values) {
    for (const value of values) this.#vramWord(value);
  }
  writeVramBytes(low, high) {
    this.#vramByte(0, low & BYTE_MASK);
    this.#vramByte(1, high & BYTE_MASK);
  }
  setBgMode(value) {
    this.#bgMode(value);
  }
  setObjectSelectByte(value) {
    this.#objectSelect(value);
  }
  setMapBase(layer, value) {
    this.#mapBase(layer - 1, value);
  }
  setCharacterBases(first, value) {
    this.#characterBases(first - 1, value);
  }
  setHorizontalScroll(layer, x) {
    this.#scroll(layer - 1, 0, x);
  }
  setScrollBytes(layer, vertical, low, high) {
    this.#scroll(layer - 1, vertical ? 1 : 0, ((high & BYTE_MASK) << BYTE_BITS) | low);
  }
  setWindowAreas(bg12, bg34, objColour) {
    this.#windowSelect(0, bg12);
    this.#windowSelect(1, bg34);
    this.#windowSelect(2, objColour);
  }
  setWindowLogicBytes(bg, objColour) {
    this.windowLogic = bg;
    this.objectColourLogic = objColour;
  }
  // The 16-bit store's high byte reaches MEMSEL (the ROM speed, no picture effect).
  enableHdmaWord(channels) {
    this.#enableHdma(channels);
  }
  setColourBytes(index, bytes) {
    this.#colourAt(index);
    for (const value of bytes) this.#colourByte(value);
  }
  // The text read-back: VRAM bytes from a word address into WRAM bank 7E, on channel 5
  // with its set-up from the font upload, after the latching read of the buffer's
  // high byte.
  readVramToWram(address, bytes, target) {
    this.#vramWordAddress(address);
    this.#channelSet(READBACK, { bytes });
    this.#setSourceWord(READBACK, target);
    this.vramIncrement = VMAINC_INCREMENT_AFTER_HIGH;
    this.#vramRead(1);
    this.#run(READBACK);
  }
  #setSourceWord(channel, address) {
    this.channels[channel].source = address & WORD_MASK;
  }

  // ---- The frame --------------------------------------------------------------------
  // The H-DMA writes before each output row as [port, value, ...] (hdma.mjs, PDF 87 and
  // 144-152): absolute tables of [repeat|lines] headers, header 0 ends the channel.
  #hdmaWrites() {
    const rows = Array.from({ length: SCREEN_HEIGHT }, () => []);
    for (let channel = 0; channel < DMA_CHANNELS; channel++) {
      if (!(this.hdma & (1 << channel))) continue;
      const c = this.channels[channel];
      need(!(c.mode & (DMAP_B_TO_A | DMAP_HDMA_INDIRECT)), 'picture_hdma_mode_required', {
        channel,
      });
      const unit = TRANSFER_UNITS[c.mode & DMAP_TRANSFER_MODE_MASK];
      need(unit !== undefined, 'picture_hdma_mode_required', { channel });
      let address = c.source,
        row = 0;
      const next = () => {
        const value = this.memory.read8((c.bank << WORD_BITS) | address);
        address = (address + 1) & WORD_MASK;
        return value;
      };
      while (row < SCREEN_HEIGHT) {
        const header = next();
        if (!header) break;
        need(header !== HDMA_REPEAT, 'picture_hdma_line_count_required', { channel });
        const lines = header & HDMA_LINE_COUNT_MASK,
          repeat = header & HDMA_REPEAT;
        for (let n = 0; n < lines && row < SCREEN_HEIGHT; n++, row++)
          if (!n || repeat) for (const offset of unit) rows[row].push(c.port + offset, next());
      }
    }
    return rows;
  }
  // H-DMA writes of one row as the renderer's changes: window edges, main screen
  // layers, map base and size, and scroll words as low/high pairs. Writes to layers
  // the frame does not draw are dropped.
  #rowChanges(w, large) {
    const changes = [];
    let pending = -1,
      low = 0;
    for (let n = 0; n < w.length; n += 2) {
      const port = w[n],
        value = w[n + 1];
      if (port >= WH0 && port <= WH3) changes.push(['edge', port - WH0, value]);
      else if (port === TM) changes.push(['main', value]);
      else if (port >= BG1SC && port <= BG4SC) {
        const layer = port - BG1SC;
        if (!large.has(layer)) continue;
        const { base, across, width, height } = mapOf(mapFields(value), large.get(layer));
        changes.push(['map', layer, base, across, width, height]);
      } else if (port >= BG1HOFS && port <= BG4VOFS) {
        if (pending === -1) {
          pending = port;
          low = value;
          continue;
        }
        need(pending === port, 'picture_scroll_pair_required');
        pending = -1;
        const at = port - BG1HOFS,
          layer = at >>> 1;
        if (!large.has(layer)) continue;
        changes.push(['scroll', layer, at & 1, ((value << BYTE_BITS) | low) & SCROLL_MASK]);
      } else throw new PictureBoundary('picture_hdma_target_required', { port });
    }
    need(pending === -1, 'picture_scroll_pair_required');
    return changes;
  }
  // The frame description of the current picture state (src/video/frame-renderer.mjs).
  describe() {
    if (this.blank || !this.brightness) return BLANK_FRAME;
    need(this.mode === BG_MODE_1, 'picture_mode1_required');
    need(this.mosaic === 0, 'picture_mosaic_required');
    need(this.screenMode === 0, 'picture_screen_mode_required');
    const writes = this.hdma ? this.#hdmaWrites() : null;
    let mainAny = this.main;
    if (writes)
      for (const w of writes)
        for (let n = 0; n < w.length; n += 2) if (w[n] === TM) mainAny |= w[n + 1];
    need(
      !(this.mainWindows & LAYER_UNUSED_BITS) && !this.directColour,
      'picture_composition_required',
    );
    const clip = this.clip,
      prevent = this.mathRegion,
      mathOn = !!this.mathLayers && prevent !== MATH_NEVER,
      useSub = mathOn && this.mathSub,
      sub = useSub ? this.sub : 0,
      tsw = useSub ? this.subWindows : 0;
    need(!(tsw & LAYER_UNUSED_BITS), 'picture_composition_required');
    if (mathOn && this.mathHalf)
      need(useSub && clip === CLIP_NEVER, 'picture_colour_math_half_required');
    const windowAreas = new Array(WINDOW_AREAS).fill(NO_WINDOW),
      edges = new Int16Array(WINDOW_EDGES);
    const areaOf = (area) => {
      need(!(area.one && area.two), 'picture_window_logic_required');
      if (area.one) return { edge: 0, invert: area.oneInvert };
      if (area.two) return { edge: WINDOW_2_FIRST_EDGE, invert: area.twoInvert };
      return NO_WINDOW;
    };
    if (
      clip === CLIP_OUTSIDE ||
      clip === CLIP_INSIDE ||
      (mathOn && (prevent === MATH_INSIDE || prevent === MATH_OUTSIDE))
    )
      windowAreas[COLOUR_WINDOW] = areaOf(this.areas[COLOUR_WINDOW]);
    for (let source = 0; source <= OBJ_LAYER; source++)
      if ((this.mainWindows | tsw) & (1 << source))
        windowAreas[source] = areaOf(this.areas[source]);
    edges.set(this.edges);
    const sprites = [];
    let objBase = 0,
      objGap = 0;
    if ((mainAny | sub) & OBJ_LAYER_BIT) {
      need(this.objectSizes < OBJ_SIZES.length, 'picture_obj_size_required');
      need(!this.objectRotation, 'picture_obj_rotation_required');
      const sizes = OBJ_SIZES[this.objectSizes];
      for (let n = 0; n < OBJECT_COUNT; n++) {
        const entry = n * OAM_ENTRY_BYTES,
          high =
            this.oam[OAM_HIGH_TABLE + (n >>> OBJECTS_PER_HIGH_BYTE_SHIFT)] >>>
            ((n & OBJECT_IN_HIGH_BYTE_MASK) * HIGH_BITS_PER_OBJECT),
          attr = this.oam[entry + OAM_ATTRIBUTES];
        sprites.push({
          x: this.oam[entry + OAM_X] - (high & 1 ? OBJ_X_HIGH : 0),
          y: this.oam[entry + OAM_Y],
          size: sizes[(high >>> HIGH_SIZE_BIT) & 1],
          name: this.oam[entry + OAM_NAME],
          vFlip: !!(attr & OBJ_V_FLIP),
          hFlip: !!(attr & OBJ_H_FLIP),
          priority: (attr >>> OBJ_PRIORITY_SHIFT) & OBJ_PRIORITY_MASK,
          palette: (attr >>> OBJ_PALETTE_SHIFT) & OBJ_PALETTE_MASK,
          table: attr & OBJ_SECOND_TABLE,
        });
      }
      objBase = this.objectBase;
      objGap = this.objectGap;
    }
    const layers = [],
      large = new Map();
    for (let layer = 0; layer < BG_LAYERS_MODE_1; layer++) {
      if (!((mainAny | sub) & (1 << layer))) continue;
      const l = this.layers[layer],
        isLarge = !!(this.largeTiles & (1 << layer)),
        isBg3 = layer === BG_LAYERS_MODE_1 - 1,
        [low, normalHigh] = BG_LEVELS[layer];
      large.set(layer, isLarge);
      layers.push({
        layer,
        ...mapOf(l, isLarge),
        chars: l.chars,
        bpp: isBg3 ? BPP_2 : BPP_4,
        large: isLarge,
        h: l.h,
        v: l.v,
        low,
        high: isBg3 && this.bg3Priority ? BG3_TOP_LEVEL : normalHigh,
      });
    }
    const rows = writes ? writes.map((w) => this.#rowChanges(w, large)) : null;
    return {
      blank: false,
      brightness: this.brightness,
      main: this.main,
      sub,
      mainWindows: this.mainWindows,
      subWindows: tsw,
      windowAreas,
      edges,
      clip,
      math: mathOn
        ? {
            layers: this.mathLayers,
            half: this.mathHalf,
            subtract: this.mathSubtract,
            region: prevent,
            sub: useSub,
            fixed: this.fixedColour,
          }
        : null,
      palette: Int32Array.from(this.palette),
      vram: this.vram,
      layers,
      objects: { base: objBase, gap: objGap, sprites },
      rows,
    };
  }
  // The scalar picture settings as one array (a cache key with the memories).
  settings() {
    const values = [
      this.displaySet,
      this.blank,
      this.brightness,
      this.mode,
      this.bg3Priority,
      this.largeTiles,
      this.mosaic,
      this.screenMode,
      this.main,
      this.sub,
      this.mainWindows,
      this.subWindows,
      this.clip,
      this.mathRegion,
      this.mathSub,
      this.directColour,
      this.mathLayers,
      this.mathHalf,
      this.mathSubtract,
      this.fixedColour,
      this.objectSizes,
      this.objectBase,
      this.objectGap,
      this.objectRotation,
      this.hdma,
      ...this.edges,
    ];
    for (const l of this.layers) values.push(l.base, l.wide, l.tall, l.chars, l.h, l.v);
    for (const a of this.areas) values.push(a.one, a.oneInvert, a.two, a.twoInvert);
    for (const c of this.channels) values.push(c.mode, c.port, c.source, c.bank);
    return Int32Array.from(values, Number);
  }
}

// DMA channel registers 4300-437F: seven parameter registers per 16-byte channel.
const DMA_CHANNEL_BLOCK = 0x4300,
  DMA_CHANNEL_BLOCK_START = DMA_CHANNEL_BLOCK - B_BUS,
  DMA_CHANNEL_SHIFT = 4,
  DMA_CHANNEL_REGISTER_MASK = 0x0f,
  DMA_PARAMETERS_OFFSET = 0,
  DMA_PORT_OFFSET = 1,
  DMA_SOURCE_LOW = 2,
  DMA_SOURCE_HIGH = 3,
  DMA_BANK_OFFSET = 4,
  DMA_COUNT_LOW_OFFSET = 5,
  DMA_COUNT_HIGH_OFFSET = 6,
  // A palette: 15 colours of two bytes; the fixed colour's three components at zero.
  PALETTE_COLOURS_BYTES = 0x1e,
  COLDATA_ALL_ZERO = 0xe0;
