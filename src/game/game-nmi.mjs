// The jobs of the game NMI handler 80:C152 (lifted; the register-level versions in
// src/task/main-game-nmi.mjs are the references, GAME_NMI_ROUTINES).
//
// The handler calls its jobs once per NMI with the direct page at 0 and the data bank
// at 0, so the fields below 2000 lie in WRAM. Each job states its DMA transfers and
// PPU writes through the hardware port, in the original order and with the original
// instruction sites, so the PPU model sees the same writes. The handler restores the
// interrupted registers afterwards, so the jobs leave no registers to their caller
// except the 16-bit modes they came with.
import { accessorPort } from '../system/hardware-port.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { uploadMapEdges } from './camera-scroll.mjs';
import { readJoypad } from '../system/joypad.mjs';
import { NATIVE_CALL_CONTINUATIONS } from '../task/native-call-continuation.mjs';
import { taskStop } from '../task/plan.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
import { GAME_NMI_ROUTINES } from '../task/main-game-nmi.mjs';
import { DP_PORTRAIT_BANK, DP_PORTRAIT_POINTER } from '../task/native-dialog-portrait.mjs';
import { GLOVE_KIND_CROSSHAIR, GLOVE_KIND_SPELL } from '../task/native-glove-crosshair-limits.mjs';
import {
  BRIGHTNESS_FADE,
  BRIGHTNESS_FADE_FRAMES,
  INIDISP_SHADOW,
  MAP_UPLOAD_HELD,
  DP_VRAM_UPLOAD_INDEX,
  GLOVE_KIND,
  GLOVE_LIMIT_KIND,
  GLOVE_SCREEN_X,
  GLOVE_SCREEN_Y,
  HDMAEN_SHADOW,
  NMI_JOB_LISTS,
  OAM_BUFFER,
  PAD_HELD,
  PALETTE_BYTES,
  PALETTE_DIRECTION,
  PALETTE_REQUEST_POINTER,
  PALETTE_REQUEST_SLOT,
  PALETTE_UPLOAD_LIST,
  PALETTE_UPLOAD_LIST_BYTES,
  PORTRAIT_DMA_REQUEST,
  PORTRAIT_PALETTE_START,
  SCENE_BACKDROP,
  SCENE_PALETTE_COUNT,
  SCENE_PALETTE_LIST,
  SCENE_PALETTE_UPLOAD,
  TEXT_BUFFER_BYTES,
  TEXT_BUFFER_READBACK,
  TEXT_BUFFER_UPLOAD,
  TEXT_BUFFER_VRAM_ADDRESS,
  TEXT_MAP_UPLOAD,
  TEXT_MASK_BUFFER,
  TEXT_TILE_UPLOAD,
  TEXT_TILE_UPLOAD_ADDRESS,
  TEXT_TILE_UPLOAD_BYTES,
  TM_SHADOW,
  TMW_SHADOW,
  TS_SHADOW,
  WINDOW_MAP_BUFFER,
  VRAM_UPLOAD_ADDRESSES,
  VRAM_UPLOAD_BANKS,
  VRAM_UPLOAD_BYTES,
  VRAM_UPLOAD_SOURCES,
} from '../task/wram.mjs';
import {
  A1B0,
  A1B1,
  A1B4,
  A1T0L,
  A1T1L,
  A1T2L,
  A1T4L,
  A1T5L,
  A1T6L,
  A1T7L,
  BBAD0,
  CGADD,
  CGDATA,
  DAS0L,
  DAS1L,
  DAS2L,
  DAS4L,
  DAS5L,
  DAS6L,
  DAS7L,
  DMAP0,
  DMAP1,
  DMAP2,
  DMAP4,
  DMAP5,
  DMAP6,
  DMAP7,
  HDMAEN,
  INIDISP,
  MDMAEN,
  OAMADDL,
  OAMDATA,
  RDVRAMH,
  TM,
  TMW,
  TS,
  VMADDL,
  VMAINC,
  VMDATAL,
} from '../constants/hardware-registers.mjs';
import { CYCLE_TABLE } from '../data/palette-cycles.mjs';
import {
  DMAP_ONE_PORT,
  DMAP_TWO_PORTS,
  INIDISP_BRIGHTNESS_MASK,
  INIDISP_FORCED_BLANK,
  MAX_BRIGHTNESS,
  OAM_BYTES,
  OAMADDH_PRIORITY_ROTATION,
  OAM_PRIORITY_3,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../constants/ppu.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const DMA_CHANNEL_STRIDE = 0x10;
// The MDMAEN bit of the DMA channel whose DMAPx register is given.
const channel = (dmap) => 1 << ((dmap - DMAP0) / DMA_CHANNEL_STRIDE);

// The data bank 0 reaches WRAM below 2000; the lists lie there in the game.
const LOW_WRAM_END = 0x2000;
const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// A list entry at base + index, whose bytes must lie below 2000.
function listByte(wram, base, index) {
  if (base + index >= LOW_WRAM_END) taskStop('nmi_list_required', { base, index });
  return wram[base + index];
}
const listWord = (wram, base, index) =>
  listByte(wram, base, index) | (listByte(wram, base, index + 1) << BYTE_BITS);

// The palettes and the 15 colours sent from colour 1 of a slot: the scene palettes
// (bank 8C, 32 bytes each) to the BG slots, the object palettes (bank 8D, 16 bytes each)
// to the OBJ slots from CGRAM colour 128.
const SCENE_PALETTES = 0x8cf624,
  SCENE_PALETTE_SHIFT = 5,
  OBJECT_PALETTES = 0x8df1ba,
  PALETTE_SHIFT = 4,
  PALETTE_COLOURS_BYTES = 0x1e,
  OBJ_FIRST_COLOUR = 0x81,
  // The list index (two bytes per entry) times 8 is the slot's first colour.
  LIST_TO_COLOUR_SHIFT = 3,
  // ASL into the carry: the bit that leaves a word or a byte.
  WORD_TOP = 15,
  BYTE_TOP = 7;
// A palette cycle step comes from the cycle table's bank; CGDATA is the DMA's target.
const CYCLE_BANK = CYCLE_TABLE >>> WORD_BITS,
  CGDATA_PORT = CGDATA & BYTE_MASK;
// The carry the original's last ASL leaves when it shifts a word (or a byte) by shift.
const wordShiftCarry = (value, shift) => (value >>> (WORD_TOP - (shift - 1))) & 1,
  byteShiftCarry = (value, shift) => ((value & BYTE_MASK) >>> (BYTE_TOP - (shift - 1))) & 1;
// A palette's source: the table's offset plus the palette number shifted (with the
// shift's carry), in the table's bank.
const paletteSource = (table, palette, shift) =>
  (table & ~WORD_MASK) |
  (((palette << shift) + (table & WORD_MASK) + wordShiftCarry(palette, shift)) & WORD_MASK);
// One palette by DMA on channel 4: its source, the 15 colours, the first colour, the
// bank and the start, at the sites of the original's writes.
function sendPalette(port, source, colour, sites) {
  port.write(A1T4L, source & WORD_MASK, 2, sites.source);
  port.write(DAS4L, PALETTE_COLOURS_BYTES, 2, sites.bytes);
  port.write(CGADD, colour & BYTE_MASK, 1, sites.colour);
  port.write(A1B4, source >>> WORD_BITS, 1, sites.bank);
  port.write(MDMAEN, channel(DMAP4), 1, sites.start);
}
const SCENE_PALETTE_SITES = Object.freeze({
  source: 0x8099b1,
  bytes: 0x8099b7,
  colour: 0x8099c1,
  bank: 0x8099c6,
  start: 0x8099cb,
});
const BACKDROP_SITES = Object.freeze({ colour: 0x8099d6, low: 0x8099dc, high: 0x8099e2 });
const CYCLE_SITES = Object.freeze({
  source: 0x8180c9,
  bytes: 0x8180d3,
  mode: 0x8180d9,
  colour: 0x8180e1,
  bank: 0x8180e6,
  start: 0x8180eb,
});
const OBJECT_PALETTE_SITES = Object.freeze({
  source: 0x81a92f,
  bytes: 0x81a935,
  colour: 0x81a940,
  bank: 0x81a945,
  start: 0x81a94a,
});
const VRAM_RECORD_SITES = Object.freeze({
  source: 0x81a964,
  bytes: 0x81a96a,
  address: 0x81a970,
  increment: 0x81a977,
  bank: 0x81a97d,
  start: 0x81a982,
});

// 81:A919: with open NMI job lists, each object palette of the upload list (from the
// last entry down) to its OBJ palette slot by DMA on channel 4. The original's shifts
// carry into its additions: the source gets bit 12 of the palette number, the colour
// bit 5 of the list index (0 for the game's lists).
export function uploadObjectPalettes(wram, port) {
  if (!word(wram, NMI_JOB_LISTS)) return;
  const bytes = word(wram, PALETTE_UPLOAD_LIST_BYTES);
  if (!bytes) return;
  let y = (bytes - 2) & WORD_MASK;
  do {
    const palette = listWord(wram, PALETTE_UPLOAD_LIST, y);
    sendPalette(
      port,
      paletteSource(OBJECT_PALETTES, palette, PALETTE_SHIFT),
      (y << LIST_TO_COLOUR_SHIFT) + OBJ_FIRST_COLOUR + byteShiftCarry(y, LIST_TO_COLOUR_SHIFT),
      OBJECT_PALETTE_SITES,
    );
    y = (y - 2) & WORD_MASK;
  } while (!(y & WORD_SIGN));
}

// 80:999A: with a scene palette request, the scene palettes of the list (from the entry
// at twice the count down to the one at index 2; the word at index 0 is not sent) to the
// BG palette slots by DMA on channel 4, then the backdrop colour; the request is then
// cleared. The source gets the shifts' carry (bit 11 of the palette number); the slot's
// first colour is the list index times 8 plus 1.
export function uploadScenePalettes(wram, port) {
  if (!word(wram, SCENE_PALETTE_UPLOAD)) return;
  const count = word(wram, SCENE_PALETTE_COUNT);
  if (!count) return;
  let y = (count << 1) & WORD_MASK;
  do {
    const palette = listWord(wram, SCENE_PALETTE_LIST, y);
    sendPalette(
      port,
      paletteSource(SCENE_PALETTES, palette, SCENE_PALETTE_SHIFT),
      (y << LIST_TO_COLOUR_SHIFT) + 1,
      SCENE_PALETTE_SITES,
    );
    y = (y - 2) & WORD_MASK;
  } while (y);
  port.write(CGADD, 0, 1, BACKDROP_SITES.colour);
  port.write(CGDATA, wram[SCENE_BACKDROP], 1, BACKDROP_SITES.low);
  port.write(CGDATA, wram[SCENE_BACKDROP + 1], 1, BACKDROP_SITES.high);
  setWord(wram, SCENE_PALETTE_UPLOAD, 0);
}

// 81:80C4: a requested palette cycle step by DMA on channel 0 from its pointer in the
// cycle table's bank to the colour in the low byte of its slot's direction word; the
// length is the single PALETTE_BYTES word. The request is then cleared.
export function uploadPaletteCycleStep(wram, port) {
  const pointer = word(wram, PALETTE_REQUEST_POINTER);
  if (!pointer) return;
  port.write(A1T0L, pointer, 2, CYCLE_SITES.source);
  const slot = word(wram, PALETTE_REQUEST_SLOT);
  port.write(DAS0L, word(wram, PALETTE_BYTES), 2, CYCLE_SITES.bytes);
  port.write(DMAP0, (CGDATA_PORT << BYTE_BITS) | DMAP_ONE_PORT, 2, CYCLE_SITES.mode);
  port.write(CGADD, listByte(wram, PALETTE_DIRECTION, slot), 1, CYCLE_SITES.colour);
  port.write(A1B0, CYCLE_BANK, 1, CYCLE_SITES.bank);
  port.write(MDMAEN, channel(DMAP0), 1, CYCLE_SITES.start);
  setWord(wram, PALETTE_REQUEST_POINTER, 0);
}

// 81:A958: with open NMI job lists, each VRAM upload record (from the index in the
// direct page down to 0) by DMA on channel 1: VRAM_UPLOAD_BYTES bytes from its source
// to its VRAM word address. The index is left past the first record (negative).
export function uploadVramRecords(wram, port) {
  if (!word(wram, NMI_JOB_LISTS)) return;
  let x = word(wram, DP_VRAM_UPLOAD_INDEX);
  if (x & WORD_SIGN) return;
  do {
    port.write(A1T1L, listWord(wram, VRAM_UPLOAD_SOURCES, x), 2, VRAM_RECORD_SITES.source);
    port.write(DAS1L, VRAM_UPLOAD_BYTES, 2, VRAM_RECORD_SITES.bytes);
    port.write(VMADDL, listWord(wram, VRAM_UPLOAD_ADDRESSES, x), 2, VRAM_RECORD_SITES.address);
    port.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, VRAM_RECORD_SITES.increment);
    port.write(A1B1, listByte(wram, VRAM_UPLOAD_BANKS, x), 1, VRAM_RECORD_SITES.bank);
    port.write(MDMAEN, channel(DMAP1), 1, VRAM_RECORD_SITES.start);
    x = (x - 2) & WORD_MASK;
  } while (!(x & WORD_SIGN));
  setWord(wram, DP_VRAM_UPLOAD_INDEX, x);
}

// The portrait's colours follow 3 bytes after its pointer; a sent request is negative.
const PORTRAIT_COLOURS_OFFSET = 3,
  REQUEST_SENT = WORD_MASK;
const PORTRAIT_SITES = Object.freeze({
  address: 0x808fbf,
  start: 0x808fc6,
  source: 0x808fd1,
  bytes: 0x808fd7,
  colour: 0x808fdf,
  bank: 0x808fe4,
  colourStart: 0x808fe9,
});
// The glove pictures (bank 8D), one per glove kind, sent as two halves to the OBJ
// characters 0 and 0x10 (VRAM words 0 and 100); the glove is OAM entry 0, hidden at
// Y F0 without a glove.
const GLOVE_CROSSHAIR_PICTURE = 0x8dfb78,
  GLOVE_ACTION_PICTURE = 0x8dfbf8,
  GLOVE_SPELL_PICTURE = 0x8dfc78,
  GLOVE_HALF_BYTES = 0x40,
  GLOVE_LOWER_VRAM = 0x100,
  HIDDEN_Y = 0xf0;
const GLOVE_SITES = Object.freeze({
  source: 0x80c087,
  bank: 0x80c08e,
  target: 0x80c093,
  increment: 0x80c098,
  mode: 0x80c09d,
  upperAddress: 0x80c0a5,
  upperBytes: 0x80c0ab,
  upperStart: 0x80c0b2,
  lowerAddress: 0x80c0ba,
  lowerBytes: 0x80c0c0,
  lowerStart: 0x80c0c7,
  oamAddress: 0x80c0cf,
  x: 0x80c0d7,
  hidden: 0x80c0e1,
  y: 0x80c0e9,
  tile: 0x80c0ec,
  attributes: 0x80c0f1,
});

// 80:8FBA: a requested portrait's characters by DMA on channel 0 (set up by the portrait
// code) to the requested VRAM word address, then its 15 colours by DMA on channel 4
// from its pointer to the portrait palette; the request is then marked as sent.
export function uploadPortraitGraphics(wram, port) {
  const request = word(wram, PORTRAIT_DMA_REQUEST);
  if (request & WORD_SIGN) return;
  port.write(VMADDL, request, 2, PORTRAIT_SITES.address);
  port.write(MDMAEN, channel(DMAP0), 1, PORTRAIT_SITES.start);
  port.write(
    A1T4L,
    (word(wram, DP_PORTRAIT_POINTER) + PORTRAIT_COLOURS_OFFSET) & WORD_MASK,
    2,
    PORTRAIT_SITES.source,
  );
  port.write(DAS4L, PALETTE_COLOURS_BYTES, 2, PORTRAIT_SITES.bytes);
  port.write(CGADD, wram[PORTRAIT_PALETTE_START], 1, PORTRAIT_SITES.colour);
  port.write(A1B4, wram[DP_PORTRAIT_BANK], 1, PORTRAIT_SITES.bank);
  port.write(MDMAEN, channel(DMAP4), 1, PORTRAIT_SITES.colourStart);
  setWord(wram, PORTRAIT_DMA_REQUEST, REQUEST_SENT);
}

// 80:C06B: after a glove change the picture of the new kind (crosshair, spell or action
// glove) by DMA on channel 0, then the glove as OAM entry 0: its X, and its Y, tile 0
// and priority 3, or the hidden Y without a glove.
export function uploadGlove(wram, port) {
  const kind = word(wram, GLOVE_LIMIT_KIND);
  if (kind) {
    const picture =
      kind === GLOVE_KIND_CROSSHAIR
        ? GLOVE_CROSSHAIR_PICTURE
        : kind === GLOVE_KIND_SPELL
          ? GLOVE_SPELL_PICTURE
          : GLOVE_ACTION_PICTURE;
    port.write(A1T0L, picture & WORD_MASK, 2, GLOVE_SITES.source);
    port.write(A1B0, picture >>> WORD_BITS, 1, GLOVE_SITES.bank);
    port.write(BBAD0, VMDATAL & BYTE_MASK, 1, GLOVE_SITES.target);
    port.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, GLOVE_SITES.increment);
    port.write(DMAP0, DMAP_TWO_PORTS, 1, GLOVE_SITES.mode);
    port.write(VMADDL, 0, 2, GLOVE_SITES.upperAddress);
    port.write(DAS0L, GLOVE_HALF_BYTES, 2, GLOVE_SITES.upperBytes);
    port.write(MDMAEN, channel(DMAP0), 1, GLOVE_SITES.upperStart);
    port.write(VMADDL, GLOVE_LOWER_VRAM, 2, GLOVE_SITES.lowerAddress);
    port.write(DAS0L, GLOVE_HALF_BYTES, 2, GLOVE_SITES.lowerBytes);
    port.write(MDMAEN, channel(DMAP0), 1, GLOVE_SITES.lowerStart);
    setWord(wram, GLOVE_LIMIT_KIND, 0);
  }
  port.write(OAMADDL, 0, 2, GLOVE_SITES.oamAddress);
  port.write(OAMDATA, wram[GLOVE_SCREEN_X], 1, GLOVE_SITES.x);
  if (!word(wram, GLOVE_KIND)) {
    port.write(OAMDATA, HIDDEN_Y, 1, GLOVE_SITES.hidden);
    return;
  }
  port.write(OAMDATA, wram[GLOVE_SCREEN_Y], 1, GLOVE_SITES.y);
  port.write(OAMDATA, 0, 1, GLOVE_SITES.tile);
  port.write(OAMDATA, OAM_PRIORITY_3, 1, GLOVE_SITES.attributes);
}

// The text tiles: cleared from the zero byte at 81:AC8C in chunks of 1400 bytes by DMA
// on channel 6, the window map buffer (740 bytes) to the BG3 map, the text buffer's
// mask by channel 7 and its read back from VRAM by channel 5 (10 bytes). The DMA modes,
// B-bus registers and banks of channels 5 to 7 are set by the font upload (81:AB2C).
const TEXT_CLEAR_SOURCE = 0x81ac8c,
  TEXT_TILE_CHUNK = 0x1400,
  VRAM_WORD_BYTES = 2,
  WINDOW_MAP_BYTES = 0x740,
  BG3_MAP_VRAM = 0x7800,
  TEXT_READBACK_BYTES = 0x10;
const TEXT_SITES = Object.freeze({
  clearSource: 0x81a9e9,
  clearBytes: 0x81aa02,
  clearAddress: 0x81aa08,
  clearIncrement: 0x81aa16,
  clearStart: 0x81aa1b,
  mapSource: 0x81aa28,
  mapBytes: 0x81aa2e,
  mapAddress: 0x81aa34,
  mapIncrement: 0x81aa3b,
  mapStart: 0x81aa40,
  bufferSource: 0x81aa50,
  bufferBytes: 0x81aa56,
  bufferAddress: 0x81aa5c,
  bufferIncrement: 0x81aa63,
  bufferStart: 0x81aa68,
  readAddress: 0x81aa78,
  readBytes: 0x81aa7e,
  readTarget: 0x81aa84,
  readIncrement: 0x81aa8b,
  readLatch: 0x81aa8e,
  readStart: 0x81aa93,
});

// 81:8949: unless the map upload is held, with open NMI job lists the marked map edges
// and the scroll registers (81:8954, src/game/camera-scroll.mjs).
export function uploadReadyMapEdges(wram, video) {
  if (word(wram, MAP_UPLOAD_HELD) || !word(wram, NMI_JOB_LISTS)) return;
  uploadMapEdges(wram, video);
}

// 81:A9E1: the text uploads the window code requested. A tile clear sends up to 1400
// bytes per NMI and moves on by as many VRAM words; the window map, the text buffer's
// mask and its read back (after the latching dummy read of VMDATAH) are sent whole.
// Each request is cleared when it is done.
export function clearTextTiles(wram, port) {
  if (word(wram, TEXT_TILE_UPLOAD)) {
    port.write(A1T6L, TEXT_CLEAR_SOURCE & WORD_MASK, 2, TEXT_SITES.clearSource);
    let bytes = word(wram, TEXT_TILE_UPLOAD_BYTES);
    if (bytes > TEXT_TILE_CHUNK) {
      setWord(wram, TEXT_TILE_UPLOAD_BYTES, bytes - TEXT_TILE_CHUNK);
      bytes = TEXT_TILE_CHUNK;
    } else setWord(wram, TEXT_TILE_UPLOAD, 0);
    port.write(DAS6L, bytes, 2, TEXT_SITES.clearBytes);
    const address = word(wram, TEXT_TILE_UPLOAD_ADDRESS);
    port.write(VMADDL, address, 2, TEXT_SITES.clearAddress);
    setWord(wram, TEXT_TILE_UPLOAD_ADDRESS, address + TEXT_TILE_CHUNK / VRAM_WORD_BYTES);
    port.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, TEXT_SITES.clearIncrement);
    port.write(MDMAEN, channel(DMAP6), 1, TEXT_SITES.clearStart);
  }
  if (word(wram, TEXT_MAP_UPLOAD)) {
    port.write(A1T7L, WINDOW_MAP_BUFFER, 2, TEXT_SITES.mapSource);
    port.write(DAS7L, WINDOW_MAP_BYTES, 2, TEXT_SITES.mapBytes);
    port.write(VMADDL, BG3_MAP_VRAM, 2, TEXT_SITES.mapAddress);
    port.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, TEXT_SITES.mapIncrement);
    port.write(MDMAEN, channel(DMAP7), 1, TEXT_SITES.mapStart);
    setWord(wram, TEXT_MAP_UPLOAD, 0);
  }
  if (word(wram, TEXT_BUFFER_UPLOAD)) {
    port.write(A1T7L, TEXT_MASK_BUFFER, 2, TEXT_SITES.bufferSource);
    port.write(DAS7L, word(wram, TEXT_BUFFER_BYTES), 2, TEXT_SITES.bufferBytes);
    port.write(VMADDL, word(wram, TEXT_BUFFER_VRAM_ADDRESS), 2, TEXT_SITES.bufferAddress);
    port.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, TEXT_SITES.bufferIncrement);
    port.write(MDMAEN, channel(DMAP7), 1, TEXT_SITES.bufferStart);
    setWord(wram, TEXT_BUFFER_UPLOAD, 0);
  }
  if (word(wram, TEXT_BUFFER_READBACK)) {
    port.write(VMADDL, word(wram, TEXT_BUFFER_VRAM_ADDRESS), 2, TEXT_SITES.readAddress);
    port.write(DAS5L, TEXT_READBACK_BYTES, 2, TEXT_SITES.readBytes);
    port.write(A1T5L, TEXT_MASK_BUFFER, 2, TEXT_SITES.readTarget);
    port.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, TEXT_SITES.readIncrement);
    port.read(RDVRAMH, 1, TEXT_SITES.readLatch);
    port.write(MDMAEN, channel(DMAP5), 1, TEXT_SITES.readStart);
    setWord(wram, TEXT_BUFFER_READBACK, 0);
  }
}

// Original instructions of the OAM transfer's writes.
const OAM_SITES = Object.freeze({ source: 0x81a996, bytes: 0x81a99c, address: 0x81a9a2 }),
  OAM_START_SITE = 0x81a9a9;

// 81:A98E: with open NMI job lists, the OAM buffer to the OAM by DMA on channel 2 (from
// OAM address 0 with the priority rotation bit); the job lists are then closed.
export function uploadOam(wram, port) {
  if (!word(wram, NMI_JOB_LISTS)) return;
  port.write(A1T2L, OAM_BUFFER, 2, OAM_SITES.source);
  port.write(DAS2L, OAM_BYTES, 2, OAM_SITES.bytes);
  port.write(OAMADDL, OAMADDH_PRIORITY_ROTATION << BYTE_BITS, 2, OAM_SITES.address);
  port.write(MDMAEN, channel(DMAP2), 1, OAM_START_SITE);
  setWord(wram, NMI_JOB_LISTS, 0);
}

// 81:B0D1: one step of a brightness fade. A nonzero fade word counts its frames down;
// at zero a negative fade (out) darkens the INIDISP shadow by one and reloads the
// frames with its magnitude, a positive one (in) brightens it, ends the forced blank
// and reloads the frames with the fade. The fade ends (word cleared) at brightness 0
// out or 15 in.
export function stepBrightnessFade(wram) {
  const fade = word(wram, BRIGHTNESS_FADE);
  if (!fade) return;
  const frames = (word(wram, BRIGHTNESS_FADE_FRAMES) - 1) & WORD_MASK;
  setWord(wram, BRIGHTNESS_FADE_FRAMES, frames);
  if (frames) return;
  const out = Boolean(fade & WORD_SIGN),
    shadow = wram[INIDISP_SHADOW],
    brightness = shadow & INIDISP_BRIGHTNESS_MASK;
  setWord(wram, BRIGHTNESS_FADE_FRAMES, out ? -fade : fade);
  if (out && brightness !== 0) wram[INIDISP_SHADOW] = shadow - 1;
  else if (!out && brightness !== MAX_BRIGHTNESS)
    wram[INIDISP_SHADOW] = (shadow + 1) & BYTE_MASK & ~INIDISP_FORCED_BLANK;
  else setWord(wram, BRIGHTNESS_FADE, 0);
}

// The handler's screen shadows, copied to their registers after the jobs.
const SCREEN_SHADOWS = Object.freeze([
  [INIDISP_SHADOW, INIDISP, 0x80c188],
  [TM_SHADOW, TM, 0x80c18e],
  [TS_SHADOW, TS, 0x80c194],
  [TMW_SHADOW, TMW, 0x80c19a],
  [HDMAEN_SHADOW, HDMAEN, 0x80c1a0],
]);
const BLANK_SITE = 0x80c156;

// 80:C152: the game NMI handler. With the screen blanked it runs its jobs in the
// original order (map edges, text uploads, scene palettes, palette cycle, object
// palettes, VRAM records, OAM, portrait, joypad, glove, brightness fade), then copies
// the screen shadows to INIDISP, TM, TS, TMW and HDMAEN. The jobs' frames are not
// pushed (they lie below the NMI stack's top and nothing reads them).
export function handleGameNmi(h) {
  const { video } = sceneRuntime(h),
    wram = h.a.mem.wram,
    port = accessorPort(h.a);
  port.write(INIDISP, INIDISP_FORCED_BLANK, 1, BLANK_SITE);
  uploadReadyMapEdges(wram, video);
  clearTextTiles(wram, port);
  uploadScenePalettes(wram, port);
  uploadPaletteCycleStep(wram, port);
  uploadObjectPalettes(wram, port);
  uploadVramRecords(wram, port);
  uploadOam(wram, port);
  uploadPortraitGraphics(wram, port);
  setWord(wram, PAD_HELD, readJoypad(port));
  uploadGlove(wram, port);
  stepBrightnessFade(wram);
  for (const [shadow, register, site] of SCREEN_SHADOWS)
    port.write(register, wram[shadow], 1, site);
  return h.rtl();
}

// The jobs as routine table entries for the register-level handler: 80:999A, 80:8FBA
// and 80:C06B are called with JSR, 81:8949, 81:A9E1, 81:80C4, 81:A919, 81:A958, 81:A98E and 81:B0D1 with JSL.
export function uploadPortraitGraphicsRoutine(h) {
  uploadPortraitGraphics(h.a.mem.wram, accessorPort(h.a));
  return h.rts();
}
export function uploadGloveRoutine(h) {
  uploadGlove(h.a.mem.wram, accessorPort(h.a));
  return h.rts();
}
export function uploadReadyMapEdgesRoutine(h) {
  uploadReadyMapEdges(h.a.mem.wram, sceneRuntime(h).video);
  return h.rtl();
}
export function clearTextTilesRoutine(h) {
  clearTextTiles(h.a.mem.wram, accessorPort(h.a));
  return h.rtl();
}
export function uploadOamRoutine(h) {
  uploadOam(h.a.mem.wram, accessorPort(h.a));
  return h.rtl();
}
export function uploadScenePalettesRoutine(h) {
  uploadScenePalettes(h.a.mem.wram, accessorPort(h.a));
  return h.rts();
}
export function uploadPaletteCycleStepRoutine(h) {
  uploadPaletteCycleStep(h.a.mem.wram, accessorPort(h.a));
  return h.rtl();
}
export function uploadObjectPalettesRoutine(h) {
  uploadObjectPalettes(h.a.mem.wram, accessorPort(h.a));
  return h.rtl();
}
export function uploadVramRecordsRoutine(h) {
  uploadVramRecords(h.a.mem.wram, accessorPort(h.a));
  return h.rtl();
}
export function stepBrightnessFadeRoutine(h) {
  stepBrightnessFade(h.a.mem.wram);
  return h.rtl();
}

// The lifted jobs by their entries (the tests run these).
export const GAME_NMI_LIFTED_ROUTINES = new Map([
  [0x80999a, uploadScenePalettesRoutine],
  [0x8180c4, uploadPaletteCycleStepRoutine],
  [0x81a919, uploadObjectPalettesRoutine],
  [0x81a958, uploadVramRecordsRoutine],
  [0x81a98e, uploadOamRoutine],
  [0x81b0d1, stepBrightnessFadeRoutine],
  [0x808fba, uploadPortraitGraphicsRoutine],
  [0x80c06b, uploadGloveRoutine],
  [0x818949, uploadReadyMapEdgesRoutine],
  [0x81a9e1, clearTextTilesRoutine],
  [0x80c152, handleGameNmi],
]);

// The live table entries, bound after the register-level ones in MAIN_SCENE_ROUTINES
// (src/task/main-scene.mjs): the lifted jobs with lag-free frames; a recorded run, whose
// accessor replays observed memory and devices, keeps the register-level jobs.
export const GAME_NMI_LIFTED_JOBS = new Map(
  [...GAME_NMI_LIFTED_ROUTINES].map(([target, run]) => {
    const reference = GAME_NMI_ROUTINES.get(target);
    return [
      target,
      (h, events, routines) => (lagFree(events) ? run(h) : reference(h, events, routines)),
    ];
  }),
);
// The handler's register-level reference pauses at its joypad wait in recorded runs, so
// that continuation is kept for them; with lag-free frames the lifted handler runs whole.
const HANDLER = 0x80c152;
NATIVE_CALL_CONTINUATIONS.set(GAME_NMI_LIFTED_JOBS.get(HANDLER), {
  run: GAME_NMI_LIFTED_JOBS.get(HANDLER),
  create: (call) =>
    lagFree(call.events) ? null : NATIVE_CALL_CONTINUATIONS.get(HANDLER).create(call),
});
