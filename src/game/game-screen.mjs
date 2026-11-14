// The game screen set-up (lifted from 80:9629 with 81:B064, 80:8FB3, 80:BC1A,
// 81:891A, 81:8CB9, 81:8000, 81:A840, 81:A772, 81:AB2C, 81:AA9C, 81:A9B2, 81:A9E1,
// 80:C1A6, 80:CC44, 80:E41B, 81:EF26 and 80:C109, and Jake's state bar 81:AF1F
// from src/game/state-bar.mjs; register-level versions in
// src/task/main-initialize.mjs, reference in proof/game-reference/game-screen.mjs).
//
// Before a room is entered the game screen is built from scratch: mode 1 with its
// map and character bases behind forced blank, the glove, camera, palettes, object
// slots (OAM cleared by DMA), the font and window style tiles, the window map, the
// task scheduler and the sound state are reset, the game NMI is installed and
// enabled.
import { setNmiCallback } from '../system/nmi.mjs';
import { UNPACK_7E, unpackLong, unpackStream } from '../system/unpack.mjs';
import { languageStreamSource } from '../data/language.mjs';
import { drawJakeStateBar } from './state-bar.mjs';
import {
  BRIGHTNESS_FADE,
  CAMERA_SPEED_X,
  CAMERA_SPEED_Y,
  CAMERA_X,
  CAMERA_Y,
  DP_VRAM_UPLOAD_INDEX,
  DRAW_LIST_INDEX,
  EMPTY_LIST,
  GLOVE_KIND,
  GLOVE_LIMIT_KIND,
  GLOVE_SPEED_X,
  GLOVE_SPEED_Y,
  GLOVE_TARGET_TAG,
  GLOVE_X,
  GLOVE_Y,
  HDMAEN_SHADOW,
  INIDISP_SHADOW,
  LOADED_WINDOW_STYLE,
  MAP_COLUMN_UPLOAD,
  MAP_ROW_UPLOAD,
  MAP_UPLOAD_HELD,
  MEMBER_MENU_ACTIVE,
  MUSIC,
  NMI_JOB_LISTS,
  NOTICE_EFFECT_FRAMES,
  NOTICE_WINDOW_LAST,
  NOTICE_WINDOWS,
  OBJECT_KIND,
  OBJECT_LAST_SLOT,
  OBJECT_PALETTE_COUNT,
  PALETTE_INDEX,
  PALETTE_PROGRESS,
  PALETTE_REQUEST_POINTER,
  PALETTE_SLOT_END,
  PALETTE_SLOTS,
  PALETTE_STEP,
  PALETTE_UPLOAD_LIST_BYTES,
  PLAYER_OBJECT,
  PORTRAIT_DMA_REQUEST,
  SCENE_PALETTE_COUNT,
  SCENE_PALETTE_LAST,
  SCENE_PALETTE_SLOTS,
  SCENE_PALETTE_UPLOAD,
  SCENE_REQUEST,
  SOUND_LOADED_SET,
  SOUND_VOICE_MASK,
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
  VRAM_SLOT_COUNT,
  VRAM_SLOT_FREE_LIST,
  VRAM_SLOT_NEXT,
  WINDOW_ACTIVE,
  WINDOW_FIRST_INDEX,
  WINDOW_LAST_INDEX,
  WINDOW_MAP_BUFFER,
  WINDOW_MAP_SOURCE,
  WINDOW_MAP_SOURCE_BANK,
  WINDOW_NEXT_TILE,
  WRAM,
} from '../task/wram.mjs';
import {
  HEAP_INITIAL_SIZE,
  HEAP_NEXT_WORD,
  HEAP_SIZE_WORD,
  TASK_CURSOR,
  TASK_FREE_LIST,
  TASK_LAST_SLOT,
  TASK_LIST_HEAD,
  TASK_NEXT,
  TASK_PREVIOUS,
} from '../vm/layout.mjs';
import {
  NMITIMEN,
  NMITIMEN_AUTO_JOYPAD,
  NMITIMEN_NMI_ENABLE,
  HDMAEN,
  MEMSEL,
  OAMADDL,
  OAMADDH,
  OAMDATA,
  OBJSEL,
  BGMODE,
  BG1SC,
  BG2SC,
  BG3SC,
  BG12NBA,
  BG34NBA,
  BG3HOFS,
  BG3VOFS,
  VMAINC,
  VMADDL,
  VMDATAL,
  RDVRAML,
  RDVRAMH,
  CGADD,
  CGDATA,
  CGSWSEL,
  CGADSUB,
  MDMAEN,
  DMA_CHANNEL_STRIDE,
  DMAP0,
  BBAD0,
  A1T0L,
  A1B0,
  DAS0L,
  DMAP1,
  BBAD1,
  BBAD2,
  A1T2L,
  A1B2,
  DAS2L,
  DMAP2,
  DMAP3,
  BBAD3,
  A1B3,
  DMAP4,
  BBAD4,
  DMAP5,
  BBAD5,
  A1T5L,
  A1B5,
  DAS5L,
  DMAP6,
  BBAD6,
  A1T6L,
  A1B6,
  DAS6L,
  DMAP7,
  BBAD7,
  A1T7L,
  A1B7,
  DAS7L,
} from '../constants/hardware-registers.mjs';
import {
  BGMODE_BG3_PRIORITY,
  BGMODE_MODE_1,
  BGSC_BASE_SHIFT,
  CGADSUB_BACKDROP,
  CGSWSEL_SUB_SCREEN,
  CHARACTER_BASE_STEP,
  DMAP_B_TO_A,
  DMAP_FIXED_SOURCE,
  DMAP_ONE_PORT,
  DMAP_TWO_PORTS,
  INIDISP_FORCED_BLANK,
  LAYER_BG1,
  LAYER_BG2,
  LAYER_BG3,
  LAYER_OBJ,
  OAM_BYTES,
  OAMADDH_PRIORITY_ROTATION,
  TILE_PRIORITY,
  VMAINC_INCREMENT_AFTER_HIGH,
  VRAM_WORD_BYTES,
} from '../constants/ppu.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  NIBBLE_BITS,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

const NONE = WORD_MASK,
  LONG_MASK = 0xffffff;
// VRAM word addresses of the game screen (Book I PDF 119, 2-27-5): the BG1, BG2 and
// BG3 maps and the character segments of BG1/BG2 and BG3.
const BG1_MAP_VRAM = 0x7000,
  BG2_MAP_VRAM = 0x7400,
  BG3_MAP_VRAM = 0x7800,
  BG12_CHARACTER_VRAM = 0x1000,
  BG3_CHARACTER_VRAM = 0x5000;
const screenBase = (vram) => (vram * VRAM_WORD_BYTES) >> BGSC_BASE_SHIFT,
  characterSegment = (vram) => (vram * VRAM_WORD_BYTES) / CHARACTER_BASE_STEP;
// The MDMAEN bit of a channel by its DMAPx register; a B-bus register as BBADx takes it.
const channel = (dmap) => 1 << ((dmap - DMAP0) / DMA_CHANNEL_STRIDE),
  bBus = (register) => register & BYTE_MASK;
// The game NMI handler (src/task/main-game-nmi.mjs) and the game's main screen layers.
const GAME_NMI = 0x80c152,
  GAME_LAYERS = LAYER_BG1 | LAYER_BG2 | LAYER_OBJ;
// Original instructions of the CPU register writes, the sites of the device model.
const MEMSEL_SITE = 0x80962d,
  NMI_OFF_SITE = 0x809630,
  HDMA_OFF_SITE = 0x809633,
  NMI_ON_SITE = 0x809671,
  VRAM_READ_SITE = 0x81aa8e;
// MEMSEL 1: fast ROM access in banks 80-FF.
const FAST_ROM = 1;
// The glove starts at screen pixel 128 (the high byte of its position words).
const GLOVE_START = 0x8000;
// 81:A772: the byte at 81:A7FB fills the OAM; 64 object VRAM slots, chained in
// steps of 2 from slot 2 to slot EE, skip the lower tile row of 16x16 sprites.
const OAM_FILL_SOURCE = 0x81a7fb,
  OBJECT_VRAM_SLOTS = 0x40,
  VRAM_SLOT_LAST = 0xee,
  VRAM_SLOT_LOWER_ROW = 0x10,
  VRAM_SLOT_FIRST = 2;
// 81:AB2C: the font (2 bits per pixel) and its colours from bank 95, the zero source
// of the text tile clear, the first window tile (above the backgrounds), the windows.
const FONT_SOURCE = 0x95f160,
  FONT_BYTES = 0x170,
  FONT_COLOURS_SOURCE = 0x95f140,
  FONT_COLOURS_BYTES = 0x30,
  TEXT_CLEAR_SOURCE = 0x81ac8c,
  WINDOW_FIRST_TILE = TILE_PRIORITY | 0x27,
  WINDOW_LAST_SLOT = 0x1e,
  FIRST_WINDOW_STYLE = 0;
// 81:AA9C: the window styles at 80:FFAD (three bytes apart): the packed tiles' word
// and bank, the colours' word and bank; the tiles follow the font in VRAM, six colour
// bytes go to CGRAM from colour 13. The original keeps the style in direct page D8.
const WINDOW_STYLES = 0x80ffad,
  STYLE_BYTES = 3,
  STYLE_TILES_BANK = 2,
  STYLE_COLOURS = 3,
  STYLE_COLOURS_BANK = 5,
  WINDOW_TILES_VRAM = BG3_CHARACTER_VRAM + FONT_BYTES / VRAM_WORD_BYTES,
  WINDOW_COLOURS_FIRST = 0x0d,
  WINDOW_COLOUR_BYTES = 6,
  DP_STYLE = 0xd8;
// 81:A9B2: the window map words get the tile bias 2017, carried from word to word.
const WINDOW_MAP_LAST_WORD_OFFSET = 0x73e,
  WINDOW_MAP_TILE_BIAS = 0x2017;
// 81:A9E1: text tiles are cleared in chunks of at most 1400 bytes; the window map
// fills 0740 bytes of the BG3 map; the readback takes 16 bytes of text mask.
const TEXT_TILE_CHUNK = 0x1400,
  WINDOW_MAP_BYTES = 0x740,
  TEXT_READBACK_BYTES = 0x10;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const setWords = (wram, addresses, value) => {
  for (const at of addresses) setWord(wram, at, value);
};
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
// Every second word from last down to 0.
const fillWordList = (wram, start, last, value) => {
  for (let x = last; x >= 0; x -= 2) setWord(wram, start + x, value);
};

// Mode 1, the BG map and character bases, and the screen blanked through the shadows
// (81:B064).
function setUpGameVideo(wram, video) {
  video.write(BGMODE, BGMODE_MODE_1 | BGMODE_BG3_PRIORITY, 1);
  video.write(OBJSEL, 0, 1);
  video.write(BG1SC, screenBase(BG1_MAP_VRAM), 1);
  video.write(BG2SC, screenBase(BG2_MAP_VRAM), 1);
  video.write(BG3SC, screenBase(BG3_MAP_VRAM), 1);
  const bg12 = characterSegment(BG12_CHARACTER_VRAM);
  video.write(BG12NBA, bg12 | (bg12 << NIBBLE_BITS), 1);
  video.write(BG34NBA, characterSegment(BG3_CHARACTER_VRAM), 1);
  setWords(wram, [TM_SHADOW, TS_SHADOW], 0);
  setWord(wram, INIDISP_SHADOW, INIDISP_FORCED_BLANK);
  setWords(wram, [BRIGHTNESS_FADE, TMW_SHADOW, HDMAEN_SHADOW], 0);
}
// The glove stops at its start position without kind or target (80:BC1A).
function resetGlove(wram) {
  setWords(wram, [GLOVE_SPEED_X, GLOVE_SPEED_Y], 0);
  setWords(wram, [GLOVE_X, GLOVE_Y], GLOVE_START);
  setWords(wram, [GLOVE_KIND, GLOVE_LIMIT_KIND], 0);
  setWord(wram, GLOVE_TARGET_TAG, NONE);
}
// No player object, the camera and the map edge uploads cleared; DMA channel 3 for
// VRAM from bank 7E (81:891A).
function resetCamera(wram, video) {
  setWord(wram, PLAYER_OBJECT, NONE);
  setWords(
    wram,
    [CAMERA_X, CAMERA_Y, CAMERA_SPEED_X, CAMERA_SPEED_Y, MAP_COLUMN_UPLOAD, MAP_ROW_UPLOAD],
    0,
  );
  setWord(wram, MAP_UPLOAD_HELD, 0);
  video.write(DMAP3, DMAP_TWO_PORTS, 1);
  video.write(BBAD3, bBus(VMDATAL), 1);
  video.write(A1B3, WRAM_BANK, 1);
}
// The scene palette slots free, DMA channel 4 for CGRAM, the palette request and
// both palette cycles reset (81:8CB9 with 81:8000).
export function resetScenePalettes(wram, video) {
  setWord(wram, SCENE_PALETTE_COUNT, 0);
  fillWordList(wram, SCENE_PALETTE_SLOTS - WRAM, SCENE_PALETTE_LAST, NONE);
  video.write(DMAP4, DMAP_ONE_PORT, 1);
  video.write(BBAD4, bBus(CGDATA), 1);
  setWord(wram, SCENE_PALETTE_UPLOAD, 0);
  setWords(wram, [PALETTE_REQUEST_POINTER, PALETTE_SLOT_END], 0);
  for (const at of [2, 0])
    setWords(
      wram,
      [PALETTE_STEP, PALETTE_PROGRESS, PALETTE_INDEX].map((o) => o + at),
      0,
    );
}
// The palette upload list empty and the object palette slots unset (81:A840).
export function clearPaletteSlots(wram) {
  setWord(wram, PALETTE_UPLOAD_LIST_BYTES, 0);
  for (let n = 0; n < OBJECT_PALETTE_COUNT; n++) setWord(wram, PALETTE_SLOTS + 2 * n, NONE);
}
// The object and palette slots free, the OAM filled from 81:A7FB by DMA, the draw
// list empty and the object VRAM slots linked into the free list (81:A772).
export function resetObjectSlots(wram, video) {
  setWord(wram, NMI_JOB_LISTS, 0);
  clearPaletteSlots(wram);
  fillWordList(wram, OBJECT_KIND, OBJECT_LAST_SLOT, NONE);
  video.write(DMAP1, DMAP_TWO_PORTS, 1);
  video.write(BBAD1, bBus(VMDATAL), 1);
  video.write(BBAD2, bBus(OAMDATA), 1);
  video.write(DAS2L, OAM_BYTES, 2);
  video.write(A1T2L, OAM_FILL_SOURCE & WORD_MASK, 2);
  video.write(A1B2, OAM_FILL_SOURCE >>> WORD_BITS, 1);
  video.write(DMAP2, DMAP_FIXED_SOURCE | DMAP_ONE_PORT, 1);
  video.write(OAMADDL, 0, 1);
  video.write(OAMADDH, OAMADDH_PRIORITY_ROTATION, 1);
  video.write(MDMAEN, channel(DMAP2), 1);
  video.write(DMAP2, DMAP_ONE_PORT, 1);
  video.write(A1B2, WRAM_BANK, 1);
  setWord(wram, DRAW_LIST_INDEX, EMPTY_LIST);
  setWord(wram, DP_VRAM_UPLOAD_INDEX, EMPTY_LIST);
  setWord(wram, VRAM_SLOT_COUNT, OBJECT_VRAM_SLOTS);
  setWord(wram, VRAM_SLOT_FREE_LIST, VRAM_SLOT_FIRST);
  for (let x = VRAM_SLOT_LAST; x >= 0; x -= 2) {
    const next = x + 2;
    setWord(wram, VRAM_SLOT_NEXT + x, next + (next & VRAM_SLOT_LOWER_ROW));
  }
}
// All task slots linked into the free list, the task list empty, the heap one free
// block (80:C1A6).
export function resetTaskScheduler(wram) {
  setWord(wram, TASK_FREE_LIST, 0);
  setWords(wram, [TASK_LIST_HEAD, TASK_CURSOR, TASK_PREVIOUS], NONE);
  for (let x = TASK_LAST_SLOT; x >= 0; x -= 2)
    setWord(wram, TASK_NEXT + x, x === TASK_LAST_SLOT ? NONE : x + 2);
  setWord(wram, HEAP_SIZE_WORD, HEAP_INITIAL_SIZE);
  setWord(wram, HEAP_NEXT_WORD, 0);
}
// No current song, sound set or voices (81:EF26).
function resetMusic(wram) {
  setWord(wram, MUSIC, NONE);
  setWords(wram, [SOUND_LOADED_SET, SOUND_VOICE_MASK], 0);
}

// Unpack the stream at source into bank 7E at target; returns its output length.
function unpackWithLength(mem, source, target) {
  const length = readWord(mem, languageStreamSource(mem, source));
  unpackStream(mem, source, target);
  return length;
}
// The window map (81:A9B2): unpack it from WINDOW_MAP_SOURCE into its buffer (80:9F49,
// with the bank word of WINDOW_MAP_SOURCE_BANK, leaving the unpacker's direct page
// state) and add the tile bias to every word from the last down, each addition taking
// the carry of the one before; then Jake's state bar. m: {mem, wram, port}. Returns
// the index registers {x, y} the original leaves: the bar's when it is drawn, otherwise
// X past the tile loop (FFFE) and the unpacker's Y; with the carry and overflow of the
// last addition (the bar's or the tile loop's).
// The tile bias loop counts X down past the first word.
const TILE_LOOP_END = 0xfffe;
export function unpackWindowMap(m) {
  const { mem, wram } = m;
  const unpackedY = unpackLong(
    mem,
    word(wram, WINDOW_MAP_SOURCE),
    word(wram, WINDOW_MAP_SOURCE_BANK),
    WINDOW_MAP_BUFFER,
    UNPACK_7E,
  );
  let carry = 0,
    overflow = false;
  for (let x = WINDOW_MAP_LAST_WORD_OFFSET; x >= 0; x -= 2) {
    const value = word(wram, WINDOW_MAP_BUFFER + x),
      sum = value + WINDOW_MAP_TILE_BIAS + carry;
    setWord(wram, WINDOW_MAP_BUFFER + x, sum);
    carry = sum >>> WORD_BITS;
    overflow = (~(value ^ WINDOW_MAP_TILE_BIAS) & (value ^ sum) & WORD_SIGN) !== 0;
  }
  return drawJakeStateBar(m) ?? { x: TILE_LOOP_END, y: unpackedY, carry: carry !== 0, overflow };
}
// Load the window style unless it is loaded (81:AA9C): its tiles after the font by
// DMA, its six colour bytes into CGRAM, then the window map from the style's source.
export function loadWindowStyle(m, style) {
  const { mem, wram, video } = m;
  if (style === word(wram, LOADED_WINDOW_STYLE)) return;
  setWord(wram, LOADED_WINDOW_STYLE, style);
  setWord(wram, DP_STYLE, style);
  const entry = WINDOW_STYLES + ((style * STYLE_BYTES) & WORD_MASK);
  const tiles =
    (mem.read8((entry + STYLE_TILES_BANK) & LONG_MASK) << WORD_BITS) | readWord(mem, entry);
  video.write(DAS7L, unpackWithLength(mem, tiles, WINDOW_MAP_BUFFER), 2);
  video.write(A1T7L, WINDOW_MAP_BUFFER, 2);
  video.write(VMADDL, WINDOW_TILES_VRAM, 2);
  video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
  video.write(MDMAEN, channel(DMAP7), 1);
  const bank = mem.read8((entry + STYLE_COLOURS_BANK) & LONG_MASK);
  setWord(wram, WINDOW_MAP_SOURCE_BANK, bank);
  let at = readWord(mem, entry + STYLE_COLOURS);
  video.write(CGADD, WINDOW_COLOURS_FIRST, 1);
  for (let n = 0; n < WINDOW_COLOUR_BYTES; n++) {
    video.write(CGDATA, mem.read8((bank << WORD_BITS) | at), 1);
    at = (at + 1) & WORD_MASK;
  }
  setWord(wram, WINDOW_MAP_SOURCE, at);
  unpackWindowMap(m);
}
// The pending text uploads (81:A9E1): a chunk of the text tile clear, the window map,
// the text buffer, and the readback of text mask bytes from VRAM.
export function runTextUploads(m) {
  const { wram, video, port } = m;
  if (word(wram, TEXT_TILE_UPLOAD) !== 0) {
    video.write(A1T6L, TEXT_CLEAR_SOURCE & WORD_MASK, 2);
    let bytes = word(wram, TEXT_TILE_UPLOAD_BYTES);
    if (bytes > TEXT_TILE_CHUNK) {
      setWord(wram, TEXT_TILE_UPLOAD_BYTES, bytes - TEXT_TILE_CHUNK);
      bytes = TEXT_TILE_CHUNK;
    } else setWord(wram, TEXT_TILE_UPLOAD, 0);
    video.write(DAS6L, bytes, 2);
    const address = word(wram, TEXT_TILE_UPLOAD_ADDRESS);
    video.write(VMADDL, address, 2);
    setWord(wram, TEXT_TILE_UPLOAD_ADDRESS, address + TEXT_TILE_CHUNK / VRAM_WORD_BYTES);
    video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
    video.write(MDMAEN, channel(DMAP6), 1);
  }
  if (word(wram, TEXT_MAP_UPLOAD) !== 0) {
    video.write(A1T7L, WINDOW_MAP_BUFFER, 2);
    video.write(DAS7L, WINDOW_MAP_BYTES, 2);
    video.write(VMADDL, BG3_MAP_VRAM, 2);
    video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
    video.write(MDMAEN, channel(DMAP7), 1);
    setWord(wram, TEXT_MAP_UPLOAD, 0);
  }
  if (word(wram, TEXT_BUFFER_UPLOAD) !== 0) {
    video.write(A1T7L, TEXT_MASK_BUFFER, 2);
    video.write(DAS7L, word(wram, TEXT_BUFFER_BYTES), 2);
    video.write(VMADDL, word(wram, TEXT_BUFFER_VRAM_ADDRESS), 2);
    video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
    video.write(MDMAEN, channel(DMAP7), 1);
    setWord(wram, TEXT_BUFFER_UPLOAD, 0);
  }
  if (word(wram, TEXT_BUFFER_READBACK) !== 0) {
    video.write(VMADDL, word(wram, TEXT_BUFFER_VRAM_ADDRESS), 2);
    video.write(DAS5L, TEXT_READBACK_BYTES, 2);
    video.write(A1T5L, TEXT_MASK_BUFFER, 2);
    video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
    // The original reads RDVRAMH once before the transfer; the value is not used.
    port.read(RDVRAMH, 1, VRAM_READ_SITE);
    video.write(MDMAEN, channel(DMAP5), 1);
    setWord(wram, TEXT_BUFFER_READBACK, 0);
  }
}
// The font and its colours by DMA, DMA channels 5-7 for the text transfers, colour
// math on the backdrop and all layers, BG3 on the main screen, no windows, the first
// window style and the window map upload (81:AB2C).
function uploadFont(m) {
  const { wram, video } = m;
  video.write(VMADDL, BG3_CHARACTER_VRAM, 2);
  video.write(DAS0L, FONT_BYTES, 2);
  video.write(A1T0L, FONT_SOURCE & WORD_MASK, 2);
  video.write(A1B0, FONT_SOURCE >>> WORD_BITS, 1);
  video.write(BBAD0, bBus(VMDATAL), 1);
  video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
  video.write(DMAP0, DMAP_TWO_PORTS, 1);
  video.write(MDMAEN, channel(DMAP0), 1);
  video.write(DAS0L, FONT_COLOURS_BYTES, 2);
  video.write(A1T0L, FONT_COLOURS_SOURCE & WORD_MASK, 2);
  video.write(A1B0, FONT_COLOURS_SOURCE >>> WORD_BITS, 1);
  video.write(CGADD, 0, 1);
  video.write(BBAD0, bBus(CGDATA), 1);
  video.write(DMAP0, DMAP_ONE_PORT, 1);
  video.write(MDMAEN, channel(DMAP0), 1);
  video.write(DMAP7, DMAP_TWO_PORTS, 1);
  video.write(DMAP6, DMAP_FIXED_SOURCE | DMAP_TWO_PORTS, 1);
  video.write(DMAP5, DMAP_B_TO_A | DMAP_TWO_PORTS, 1);
  video.write(BBAD7, bBus(VMDATAL), 1);
  video.write(BBAD6, bBus(VMDATAL), 1);
  video.write(BBAD5, bBus(RDVRAML), 1);
  video.write(A1B7, WRAM_BANK, 1);
  video.write(A1B6, TEXT_CLEAR_SOURCE >>> WORD_BITS, 1);
  video.write(A1B5, WRAM_BANK, 1);
  video.write(CGSWSEL, CGSWSEL_SUB_SCREEN, 1);
  video.write(CGADSUB, CGADSUB_BACKDROP | LAYER_OBJ | LAYER_BG3 | LAYER_BG2 | LAYER_BG1, 1);
  wram[TM_SHADOW] |= LAYER_BG3;
  fillWordList(wram, WINDOW_ACTIVE, WINDOW_LAST_SLOT, 0);
  setWord(wram, LOADED_WINDOW_STYLE, NONE);
  fillWordList(wram, NOTICE_WINDOWS, NOTICE_WINDOW_LAST, NONE);
  loadWindowStyle(m, FIRST_WINDOW_STYLE);
  setWord(wram, WINDOW_NEXT_TILE, WINDOW_FIRST_TILE);
  setWords(
    wram,
    [
      TEXT_MAP_UPLOAD,
      TEXT_TILE_UPLOAD,
      TEXT_BUFFER_UPLOAD,
      TEXT_BUFFER_READBACK,
      WINDOW_FIRST_INDEX,
      NOTICE_EFFECT_FRAMES,
    ],
    0,
  );
  setWord(wram, WINDOW_LAST_INDEX, EMPTY_LIST);
  setWord(wram, TEXT_MAP_UPLOAD, word(wram, TEXT_MAP_UPLOAD) + 1);
  runTextUploads(m);
}

// Build the game screen (80:9629). m: {mem, wram, video, port}.
export function setUpGameScreen(m) {
  const { wram, video, port } = m;
  port.write(MEMSEL, FAST_ROM, 1, MEMSEL_SITE);
  port.write(NMITIMEN, 0, 1, NMI_OFF_SITE);
  port.write(HDMAEN, 0, 1, HDMA_OFF_SITE);
  setUpGameVideo(wram, video);
  setWord(wram, PORTRAIT_DMA_REQUEST, NONE);
  resetGlove(wram);
  resetCamera(wram, video);
  resetScenePalettes(wram, video);
  clearPaletteSlots(wram);
  resetObjectSlots(wram, video);
  uploadFont(m);
  resetTaskScheduler(wram);
  setWord(wram, SCENE_REQUEST, NONE);
  setWord(wram, MEMBER_MENU_ACTIVE, 0);
  resetMusic(wram);
  setNmiCallback(wram, GAME_NMI);
  port.write(NMITIMEN, NMITIMEN_NMI_ENABLE | NMITIMEN_AUTO_JOYPAD, 1, NMI_ON_SITE);
  wram[TM_SHADOW] |= GAME_LAYERS;
  video.write(BG3VOFS, 0, 1);
  video.write(BG3VOFS, 0, 1);
  video.write(BG3HOFS, 0, 1);
  video.write(BG3HOFS, 0, 1);
}
