import { setNmiCallback } from './main-scene-video.mjs';
import { unpackStreamLong } from './native-unpack.mjs';
import { unpackWindowMap } from './native-render-unpack.mjs';
import { applyObservedTextDma } from './main-dma-readback.mjs';
import { isIoAddress } from '../vm/devices.mjs';
import { LagFreeFrames } from '../vm/frame-events.mjs';
import { routineCaller } from './routine-call.mjs';
import { setUpGameScreen } from '../game/game-screen.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
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
} from './wram.mjs';
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
  DMAP2,
  BBAD2,
  A1T2L,
  A1B2,
  DAS2L,
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
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { BYTE_MASK, NIBBLE_BITS, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
const callFor = (h, e, r) => routineCaller(h, e, r, true);

// Value written to mark a pointer, slot or request as unset (negative).
const NONE = WORD_MASK;
// VRAM word addresses of the game screen: the BG1, BG2 and BG3 maps and the character
// segments of BG1/BG2 and BG3; BGnSC takes the map base in 2 KiB units, BGnnNBA one
// nibble per layer in 4 K word segments (Book I PDF 119, 2-27-5).
export const BG1_MAP_VRAM = 0x7000,
  BG2_MAP_VRAM = 0x7400,
  BG3_MAP_VRAM = 0x7800,
  BG12_CHARACTER_VRAM = 0x1000,
  BG3_CHARACTER_VRAM = 0x5000;
const screenBase = (vram) => (vram * VRAM_WORD_BYTES) >> BGSC_BASE_SHIFT,
  characterSegment = (vram) => (vram * VRAM_WORD_BYTES) / CHARACTER_BASE_STEP;
// MDMAEN bit of the DMA channel whose DMAPx register is given.
const channel = (dmap) => 1 << ((dmap - DMAP0) / DMA_CHANNEL_STRIDE);
// Low byte of a B-bus register, as BBADx takes it.
const bBus = (register) => register & BYTE_MASK;
const sourceBank = (source) => source >>> WORD_BITS;
const sourceOffset = (source) => source & WORD_MASK;
// Glove position words: the high byte is the screen pixel, so 8000 puts it at pixel 128.
const GLOVE_START = 0x8000;
// 81:A772: the byte at 81:A7FB fills the whole OAM; the object VRAM slots (64, two
// tiles wide) are chained in steps of 2 and skip the lower tile row of 16x16 sprites
// (index bit 4), starting from slot 2.
const OAM_FILL_SOURCE = 0x81a7fb,
  OBJECT_VRAM_SLOTS = 0x40,
  VRAM_SLOT_LAST = 0xee,
  VRAM_SLOT_LOWER_ROW = 0x10,
  VRAM_SLOT_FIRST = 2,
  DP_NEXT_SLOT = 0x0e;
// 81:AB2C: font (2 bits per pixel) and its colours from bank 95, the fixed zero source of
// the text tile clear, the first window tile (above the backgrounds) and the windows.
const FONT_SOURCE = 0x95f160,
  FONT_BYTES = 0x170,
  FONT_COLOURS_SOURCE = 0x95f140,
  FONT_COLOURS_BYTES = 0x30,
  TEXT_CLEAR_SOURCE = 0x81ac8c,
  WINDOW_FIRST_TILE = TILE_PRIORITY | 0x27,
  WINDOW_LAST_SLOT = 0x1e;
// 81:AA9C: the window style tiles follow the font in VRAM; three colours from CGRAM entry 13.
const WINDOW_TILES_VRAM = BG3_CHARACTER_VRAM + FONT_BYTES / VRAM_WORD_BYTES,
  WINDOW_COLOURS_FIRST = 0x0d,
  // Each colour byte is read by an LDA absolute,X just before its STA CGDATA.
  LDA_ABSOLUTE_X_BYTES = 3,
  DP_STYLE = 0xd8;
// 81:A9E1: text tiles are cleared in chunks of at most 1400 bytes per frame; the window
// map fills 0740 bytes of the BG3 map; the readback takes 16 bytes of text mask.
const TEXT_TILE_CHUNK = 0x1400,
  WINDOW_MAP_BYTES = 0x740,
  TEXT_READBACK_BYTES = 0x10;

// Original scene initialization. All stores use the actual DBR, including
// register addresses mapped to WRAM. DMA stores are requests; channel-5
// readback can additionally consume an explicitly observed transfer below.
const ports = (h, rows) => {
  for (const [pc, offset, value] of rows) {
    h.load(value);
    h.portWrite(offset, h.ctx.a & (h.m() ? BYTE_MASK : WORD_MASK), h.m() ? 1 : 2, pc);
  }
};
const downX = (h) => {
  h.index('x', h.ctx.x - 1);
  h.index('x', h.ctx.x - 1);
};

// 80:9629 for register-level callers: the lifted game screen set-up with Jake's
// state bar (src/game/game-screen.mjs; register-level reference in
// proof/game-reference/game-screen.mjs).
export function setUpGameScreenRoutine(h) {
  setUpGameScreen(sceneRuntime(h));
  return h.rts();
}
// 81:B064: set mode 1, the BG map and character bases and blank the screen through the shadows.
function setUpGameVideo(h) {
  h.sep(FLAG_MEMORY_8BIT);
  ports(h, [
    [0x81b068, BGMODE, BGMODE_MODE_1 | BGMODE_BG3_PRIORITY],
    [0x81b06d, OBJSEL, 0],
    [0x81b072, BG1SC, screenBase(BG1_MAP_VRAM)],
    [0x81b077, BG2SC, screenBase(BG2_MAP_VRAM)],
    [0x81b07c, BG3SC, screenBase(BG3_MAP_VRAM)],
    [
      0x81b081,
      BG12NBA,
      characterSegment(BG12_CHARACTER_VRAM) |
        (characterSegment(BG12_CHARACTER_VRAM) << NIBBLE_BITS),
    ],
    [0x81b086, BG34NBA, characterSegment(BG3_CHARACTER_VRAM)],
  ]);
  h.rep(FLAG_MEMORY_8BIT);
  h.write(h.abs(TM_SHADOW), 0);
  h.write(h.abs(TS_SHADOW), 0);
  h.load(INIDISP_FORCED_BLANK);
  h.write(h.abs(INIDISP_SHADOW), h.ctx.a);
  for (const o of [BRIGHTNESS_FADE, TMW_SHADOW, HDMAEN_SHADOW]) h.write(h.abs(o), 0);
  return h.rtl();
}
// 80:8FB3: clear the portrait DMA request.
function clearPortraitRequest(h) {
  h.load(NONE);
  h.write(h.abs(PORTRAIT_DMA_REQUEST), h.ctx.a);
  return h.rts();
}
// 80:BC1A: stop the glove cursor at its start position without kind or target.
function resetGlove(h) {
  h.write(h.abs(GLOVE_SPEED_X), 0);
  h.write(h.abs(GLOVE_SPEED_Y), 0);
  h.load(GLOVE_START);
  h.write(h.abs(GLOVE_X), h.ctx.a);
  h.write(h.abs(GLOVE_Y), h.ctx.a);
  h.write(h.abs(GLOVE_KIND), 0);
  h.write(h.abs(GLOVE_LIMIT_KIND), 0);
  h.load(NONE);
  h.write(h.abs(GLOVE_TARGET_TAG), h.ctx.a);
  return h.rts();
}
// 81:891A: clear the player object, camera and map edge uploads and set up DMA channel 3 for VRAM.
function resetCamera(h) {
  h.load(NONE);
  h.write(h.abs(PLAYER_OBJECT), h.ctx.a);
  for (const o of [
    CAMERA_X,
    CAMERA_Y,
    CAMERA_SPEED_X,
    CAMERA_SPEED_Y,
    MAP_COLUMN_UPLOAD,
    MAP_ROW_UPLOAD,
    MAP_UPLOAD_HELD,
  ])
    h.write(h.abs(o), 0);
  h.sep(FLAG_MEMORY_8BIT);
  ports(h, [
    [0x818939, DMAP3, DMAP_TWO_PORTS],
    [0x81893e, BBAD3, bBus(VMDATAL)],
    [0x818943, A1B3, WRAM_BANK],
  ]);
  h.rep(FLAG_MEMORY_8BIT);
  return h.rtl();
}
// 81:8000: clear the palette request and the step, progress and index of both palette cycles.
function resetPaletteCycles(h) {
  const { ctx } = h;
  h.index('x', 2);
  h.load(0);
  h.write(h.abs(PALETTE_REQUEST_POINTER), ctx.a);
  h.write(h.abs(PALETTE_SLOT_END), ctx.a);
  do {
    for (const o of [PALETTE_STEP, PALETTE_PROGRESS, PALETTE_INDEX])
      h.write(h.abs(o) + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  return h.rtl();
}
// 81:8CB9: free the scene palette slots, set up DMA channel 4 for CGRAM and reset the palette
// cycles.
function resetScenePalettes(h, e, r = MAIN_INITIALIZE_ROUTINES) {
  const { ctx } = h;
  h.write(h.abs(SCENE_PALETTE_COUNT), 0);
  h.index('x', SCENE_PALETTE_LAST);
  h.load(NONE);
  do {
    h.write(SCENE_PALETTE_SLOTS + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.sep(FLAG_MEMORY_8BIT);
  ports(h, [
    [0x818cce, DMAP4, DMAP_ONE_PORT],
    [0x818cd3, BBAD4, bBus(CGDATA)],
  ]);
  h.rep(FLAG_MEMORY_8BIT);
  h.write(h.abs(SCENE_PALETTE_UPLOAD), 0);
  callFor(h, e, r)(0x818cdb, 0x818000);
  return h.rtl();
}
// 81:A840: clear the palette upload list and mark the object palette slots unset. An
// unrolled sequence of stores: no X or flags change in its tail.
export function clearPaletteSlots(h) {
  h.write(h.abs(PALETTE_UPLOAD_LIST_BYTES), 0);
  h.load(NONE);
  for (let o = PALETTE_SLOTS; o < PALETTE_SLOTS + 2 * OBJECT_PALETTE_COUNT; o += 2)
    h.write(h.abs(o), h.ctx.a);
  return h.rtl();
}
// 81:A772: free the object slots and palette slots, clear OAM by DMA and link the free object VRAM
// slots.
function resetObjectSlots(h, e, r = MAIN_INITIALIZE_ROUTINES) {
  const { ctx } = h;
  h.write(h.abs(NMI_JOB_LISTS), 0);
  callFor(h, e, r)(0x81a775, 0x81a840);
  h.index('x', OBJECT_LAST_SLOT);
  h.load(NONE);
  do {
    h.write(WRAM + OBJECT_KIND + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.sep(FLAG_MEMORY_8BIT);
  ports(h, [
    [0x81a78b, DMAP1, DMAP_TWO_PORTS],
    [0x81a790, BBAD1, bBus(VMDATAL)],
    [0x81a795, BBAD2, bBus(OAMDATA)],
  ]);
  h.rep(FLAG_MEMORY_8BIT);
  ports(h, [
    [0x81a79d, DAS2L, OAM_BYTES],
    [0x81a7a3, A1T2L, sourceOffset(OAM_FILL_SOURCE)],
  ]);
  h.sep(FLAG_MEMORY_8BIT);
  ports(h, [
    [0x81a7aa, A1B2, sourceBank(OAM_FILL_SOURCE)],
    [0x81a7af, DMAP2, DMAP_FIXED_SOURCE | DMAP_ONE_PORT],
  ]);
  h.portWrite(OAMADDL, 0, 1, 0x81a7b2);
  ports(h, [
    [0x81a7b7, OAMADDH, OAMADDH_PRIORITY_ROTATION],
    [0x81a7bc, MDMAEN, channel(DMAP2)],
    [0x81a7c1, DMAP2, DMAP_ONE_PORT],
    [0x81a7c6, A1B2, WRAM_BANK],
  ]);
  h.rep(FLAG_MEMORY_8BIT);
  h.load(EMPTY_LIST);
  h.write(h.abs(DRAW_LIST_INDEX), ctx.a);
  h.dpWrite(DP_VRAM_UPLOAD_INDEX, ctx.a);
  h.load(OBJECT_VRAM_SLOTS);
  h.write(h.abs(VRAM_SLOT_COUNT), ctx.a);
  h.load(VRAM_SLOT_FIRST);
  h.write(h.abs(VRAM_SLOT_FREE_LIST), ctx.a);
  h.index('x', VRAM_SLOT_LAST);
  ctx.status &= ~FLAG_CARRY;
  do {
    h.load(ctx.x);
    h.load(ctx.a + 1);
    h.load(ctx.a + 1);
    h.dpWrite(DP_NEXT_SLOT, ctx.a);
    h.load(ctx.a & VRAM_SLOT_LOWER_ROW);
    if (!(ctx.status & FLAG_ZERO)) h.adc(h.dp(DP_NEXT_SLOT));
    else h.load(h.dp(DP_NEXT_SLOT));
    h.write(h.abs(VRAM_SLOT_NEXT) + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  return h.rtl();
}
// 80:C1A6: link all task slots into the free list, empty the task list and reset the heap.
function resetTaskScheduler(h) {
  const { ctx } = h;
  h.write(h.abs(TASK_FREE_LIST), 0);
  h.load(NONE);
  for (const o of [TASK_LIST_HEAD, TASK_CURSOR, TASK_PREVIOUS]) h.write(h.abs(o), ctx.a);
  h.index('x', TASK_LAST_SLOT);
  do {
    h.write(h.abs(TASK_NEXT) + ctx.x, ctx.a);
    h.load(ctx.x);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(HEAP_INITIAL_SIZE);
  h.write(h.abs(HEAP_SIZE_WORD), ctx.a);
  h.write(h.abs(HEAP_NEXT_WORD), 0);
  return h.rts();
}
// 80:CC44: clear the scene request.
function clearSceneRequest(h) {
  h.load(NONE);
  h.write(h.abs(SCENE_REQUEST), h.ctx.a);
  return h.rts();
}
// 80:E41B: clear the member menu flag.
function clearMemberMenuFlag(h) {
  h.write(h.abs(MEMBER_MENU_ACTIVE), 0);
  return h.rts();
}
// 81:EF26: forget the current song, loaded sound set and sound voices.
function resetMusic(h) {
  h.load(NONE);
  h.write(h.abs(MUSIC), h.ctx.a);
  h.load(0);
  h.write(h.abs(SOUND_LOADED_SET), h.ctx.a);
  h.write(h.abs(SOUND_VOICE_MASK), h.ctx.a);
  return h.rtl();
}

// 81:AA9C: load the window style tiles and their colours.
export function loadWindowStyleTiles(h, e, r = MAIN_INITIALIZE_ROUTINES) {
  const { ctx } = h;
  h.cmp(h.read(h.abs(LOADED_WINDOW_STYLE)));
  if (ctx.status & FLAG_ZERO) return h.rtl();
  const call = callFor(h, e, r);
  h.phb();
  h.write(h.abs(LOADED_WINDOW_STYLE), ctx.a);
  h.dpWrite(DP_STYLE, ctx.a);
  h.asl();
  h.adc(h.dp(DP_STYLE));
  h.index('x', ctx.a);
  h.load(h.read(0x80ffaf + ctx.x));
  h.index('y', ctx.a);
  h.load(h.read(0x80ffad + ctx.x));
  h.phx();
  h.index('x', WINDOW_MAP_BUFFER);
  call(0x81aabb, 0x809f49);
  h.portWrite(DAS7L, ctx.a, 2, 0x81aabf);
  ports(h, [
    [0x81aac5, A1T7L, WINDOW_MAP_BUFFER],
    [0x81aacb, VMADDL, WINDOW_TILES_VRAM],
  ]);
  h.sep(FLAG_MEMORY_8BIT);
  ports(h, [
    [0x81aad2, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
    [0x81aad7, MDMAEN, channel(DMAP7)],
  ]);
  h.rep(FLAG_MEMORY_8BIT);
  h.plx();
  h.load(h.read(0x80ffb2 + ctx.x));
  h.load(ctx.a & BYTE_MASK);
  h.write(h.abs(WINDOW_MAP_SOURCE_BANK), ctx.a);
  h.xba();
  h.pha();
  h.plb();
  h.plb();
  h.load(h.read(0x80ffb0 + ctx.x));
  h.index('x', ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  ports(h, [[0x81aaf4, CGADD, WINDOW_COLOURS_FIRST]]);
  for (const pc of [0x81aafa, 0x81ab01, 0x81ab08, 0x81ab0f, 0x81ab16, 0x81ab1d]) {
    // A synthetic record may select a bank/address containing a device.
    h.load(h.port(ctx.x, 1, pc - LDA_ABSOLUTE_X_BYTES));
    h.portWrite(CGDATA, ctx.a & BYTE_MASK, 1, pc);
    h.index('x', ctx.x + 1);
  }
  h.rep(FLAG_MEMORY_8BIT);
  h.write(h.abs(WINDOW_MAP_SOURCE), ctx.x, 2);
  call(0x81ab26, 0x81a9b2);
  h.plb();
  return h.rtl();
}
// 81:A9E1: clear the text tiles and the window map.
export function clearTextTiles(h, e) {
  const { ctx } = h;
  h.load(h.read(h.abs(TEXT_TILE_UPLOAD)));
  if (!(ctx.status & FLAG_ZERO)) {
    ports(h, [[0x81a9e9, A1T6L, sourceOffset(TEXT_CLEAR_SOURCE)]]);
    h.load(h.read(h.abs(TEXT_TILE_UPLOAD_BYTES)));
    h.cmp(TEXT_TILE_CHUNK + 1);
    if (ctx.status & FLAG_CARRY) {
      h.sbc(TEXT_TILE_CHUNK);
      h.write(h.abs(TEXT_TILE_UPLOAD_BYTES), ctx.a);
      h.load(TEXT_TILE_CHUNK);
    } else h.write(h.abs(TEXT_TILE_UPLOAD), 0);
    h.portWrite(DAS6L, ctx.a, 2, 0x81aa02);
    h.load(h.read(h.abs(TEXT_TILE_UPLOAD_ADDRESS)));
    h.portWrite(VMADDL, ctx.a, 2, 0x81aa08);
    ctx.status &= ~FLAG_CARRY;
    h.adc(TEXT_TILE_CHUNK / VRAM_WORD_BYTES);
    h.write(h.abs(TEXT_TILE_UPLOAD_ADDRESS), ctx.a);
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [
      [0x81aa16, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
      [0x81aa1b, MDMAEN, channel(DMAP6)],
    ]);
    h.rep(FLAG_MEMORY_8BIT);
  }
  h.load(h.read(h.abs(TEXT_MAP_UPLOAD)));
  if (!(ctx.status & FLAG_ZERO)) {
    ports(h, [
      [0x81aa28, A1T7L, WINDOW_MAP_BUFFER],
      [0x81aa2e, DAS7L, WINDOW_MAP_BYTES],
      [0x81aa34, VMADDL, BG3_MAP_VRAM],
    ]);
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [
      [0x81aa3b, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
      [0x81aa40, MDMAEN, channel(DMAP7)],
    ]);
    h.rep(FLAG_MEMORY_8BIT);
    h.write(h.abs(TEXT_MAP_UPLOAD), 0);
  }
  h.load(h.read(h.abs(TEXT_BUFFER_UPLOAD)));
  if (!(ctx.status & FLAG_ZERO)) {
    ports(h, [[0x81aa50, A1T7L, TEXT_MASK_BUFFER]]);
    h.load(h.read(h.abs(TEXT_BUFFER_BYTES)));
    h.portWrite(DAS7L, ctx.a, 2, 0x81aa56);
    h.load(h.read(h.abs(TEXT_BUFFER_VRAM_ADDRESS)));
    h.portWrite(VMADDL, ctx.a, 2, 0x81aa5c);
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [
      [0x81aa63, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
      [0x81aa68, MDMAEN, channel(DMAP7)],
    ]);
    h.rep(FLAG_MEMORY_8BIT);
    h.write(h.abs(TEXT_BUFFER_UPLOAD), 0);
  }
  h.load(h.read(h.abs(TEXT_BUFFER_READBACK)));
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(h.read(h.abs(TEXT_BUFFER_VRAM_ADDRESS)));
    const vmadd = ctx.a;
    h.portWrite(VMADDL, ctx.a, 2, 0x81aa78);
    ports(h, [
      [0x81aa7e, DAS5L, TEXT_READBACK_BYTES],
      [0x81aa84, A1T5L, TEXT_MASK_BUFFER],
    ]);
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [[0x81aa8b, VMAINC, VMAINC_INCREMENT_AFTER_HIGH]]);
    h.load(h.port(RDVRAMH, 1, 0x81aa8e));
    ports(h, [[0x81aa93, MDMAEN, channel(DMAP5)]]);
    // Live devices perform this transfer themselves from the PPU (frame-events.mjs).
    if (
      isIoAddress(h.abs(MDMAEN)) &&
      !(e?.interrupts instanceof LagFreeFrames) &&
      (e?.interrupts !== undefined || e?.dmaTransfers !== undefined)
    )
      applyObservedTextDma(h, e, vmadd);
    h.rep(FLAG_MEMORY_8BIT);
    h.write(h.abs(TEXT_BUFFER_READBACK), 0);
  }
  return h.rtl();
}
// 81:AB2C: upload the font tiles to the BG3 characters and their colours to CGRAM by DMA,
// then prepare DMA channels 5 to 7 for the text tile transfers.
function uploadFont(h, e, r = MAIN_INITIALIZE_ROUTINES) {
  const { ctx } = h;
  ports(h, [
    [0x81ab2f, VMADDL, BG3_CHARACTER_VRAM],
    [0x81ab35, DAS0L, FONT_BYTES],
    [0x81ab3b, A1T0L, sourceOffset(FONT_SOURCE)],
  ]);
  h.sep(FLAG_MEMORY_8BIT);
  ports(h, [
    [0x81ab42, A1B0, sourceBank(FONT_SOURCE)],
    [0x81ab47, BBAD0, bBus(VMDATAL)],
    [0x81ab4c, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
    [0x81ab51, DMAP0, DMAP_TWO_PORTS],
    [0x81ab56, MDMAEN, channel(DMAP0)],
  ]);
  h.rep(FLAG_MEMORY_8BIT);
  ports(h, [
    [0x81ab5e, DAS0L, FONT_COLOURS_BYTES],
    [0x81ab64, A1T0L, sourceOffset(FONT_COLOURS_SOURCE)],
  ]);
  h.sep(FLAG_MEMORY_8BIT);
  ports(h, [
    [0x81ab6b, A1B0, sourceBank(FONT_COLOURS_SOURCE)],
    [0x81ab70, CGADD, 0],
    [0x81ab75, BBAD0, bBus(CGDATA)],
    [0x81ab7a, DMAP0, DMAP_ONE_PORT],
    [0x81ab7f, MDMAEN, channel(DMAP0)],
    [0x81ab84, DMAP7, DMAP_TWO_PORTS],
    [0x81ab89, DMAP6, DMAP_FIXED_SOURCE | DMAP_TWO_PORTS],
    [0x81ab8e, DMAP5, DMAP_B_TO_A | DMAP_TWO_PORTS],
    [0x81ab93, BBAD7, bBus(VMDATAL)],
  ]);
  h.portWrite(BBAD6, ctx.a & BYTE_MASK, 1, 0x81ab96);
  ports(h, [
    [0x81ab9b, BBAD5, bBus(RDVRAML)],
    [0x81aba0, A1B7, WRAM_BANK],
    [0x81aba5, A1B6, sourceBank(TEXT_CLEAR_SOURCE)],
    [0x81abaa, A1B5, WRAM_BANK],
    [0x81abaf, CGSWSEL, CGSWSEL_SUB_SCREEN],
    [0x81abb4, CGADSUB, CGADSUB_BACKDROP | LAYER_OBJ | LAYER_BG3 | LAYER_BG2 | LAYER_BG1],
  ]);
  h.load(h.read(h.abs(TM_SHADOW)));
  h.load(ctx.a | LAYER_BG3);
  h.write(h.abs(TM_SHADOW), ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.index('x', WINDOW_LAST_SLOT);
  h.load(0);
  do {
    h.write(h.abs(WINDOW_ACTIVE) + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(NONE);
  h.write(h.abs(LOADED_WINDOW_STYLE), ctx.a);
  h.index('x', NOTICE_WINDOW_LAST);
  do {
    h.write(WRAM + NOTICE_WINDOWS + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(0);
  const call = callFor(h, e, r);
  call(0x81abe2, 0x81aa9c);
  h.load(WINDOW_FIRST_TILE);
  h.write(h.abs(WINDOW_NEXT_TILE), ctx.a);
  for (const o of [
    TEXT_MAP_UPLOAD,
    TEXT_TILE_UPLOAD,
    TEXT_BUFFER_UPLOAD,
    TEXT_BUFFER_READBACK,
    WINDOW_FIRST_INDEX,
    NOTICE_EFFECT_FRAMES,
  ])
    h.write(h.abs(o), 0);
  h.load(EMPTY_LIST);
  h.write(h.abs(WINDOW_LAST_INDEX), ctx.a);
  h.modify(h.abs(TEXT_MAP_UPLOAD), 'inc');
  call(0x81ac07, 0x81a9e1);
  return h.rtl();
}
export const MAIN_INITIALIZE_ROUTINES = new Map([
  [0x809629, setUpGameScreenRoutine],
  [0x81b064, setUpGameVideo],
  [0x808fb3, clearPortraitRequest],
  [0x80bc1a, resetGlove],
  [0x81891a, resetCamera],
  [0x818cb9, resetScenePalettes],
  [0x818000, resetPaletteCycles],
  [0x81a840, clearPaletteSlots],
  [0x81a772, resetObjectSlots],
  [0x81ab2c, uploadFont],
  [0x81aa9c, loadWindowStyleTiles],
  [0x81a9e1, clearTextTiles],
  [0x80c1a6, resetTaskScheduler],
  [0x80cc44, clearSceneRequest],
  [0x80e41b, clearMemberMenuFlag],
  [0x81ef26, resetMusic],
  [0x80c109, setNmiCallback],
  [0x809f49, (h, e) => unpackStreamLong(h.a, false, 0x809f49, e)],
  [0x81a9b2, (h, e) => unpackWindowMap(h.a, false, e)],
]);
