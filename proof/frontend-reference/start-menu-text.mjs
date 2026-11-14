// Register-level reference of the start menu texts, the title start 81:E50C and the
// NMI callback 81:E6AE (the lifted version is src/frontend/start-menu.mjs).
import { saveSlotCount } from '../../src/game/save-slots.mjs';
import { taskStop } from '../../src/task/plan.mjs';
import { MAIN_SCENE_ROUTINES } from '../../src/task/main-scene.mjs';
import { AUDIO_REFERENCE_ENTRIES } from '../apu-reference/audio-routines.mjs';
import { compareSaveChecksum } from '../../src/task/native-main-menu.mjs';
import { interruptStep, steppedInterrupts } from '../../src/task/main-wait-interrupt.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  JSR_RETURN_OFFSET,
  JSL_RETURN_OFFSET,
  drainNativeSequence,
  nativeCallSequence,
} from '../../src/task/native-call-continuation.mjs';
import { routineCaller } from '../../src/task/routine-call.mjs';

import {
  DP_MENU_CURSOR,
  DP_MENU_TEXT,
  DP_MENU_TEXT_XOR,
  FRONTEND_FRAME_COUNTER,
  FRONTEND_RANDOM,
  FRONTEND_RANDOM_HIGH,
  MENU_FONT_TILES,
  MENU_ROW_DISABLED,
  MENU_ROW_DISABLED_BYTES,
  MENU_TILEMAP,
  MENU_TILEMAP_BYTES,
  OAM_SHADOW,
  OAM_SHADOW_HIGH,
  SETTINGS_CHECKSUM,
  SETTINGS_CONTROL,
  SETTINGS_CONTROL_TYPE_A,
  SETTINGS_MUSIC,
  SETTINGS_MUSIC_EVENT,
  SETTINGS_MUSIC_FULL,
  SETTINGS_MUSIC_MASK,
  SETTINGS_STEREO,
  SETTINGS_STEREO_ON,
  TITLE_ANIMATION_2_FRAME,
  TITLE_ANIMATION_3_FRAME,
  TITLE_ANIMATION_4_FRAME,
  TITLE_ANIMATION_FRAMES,
  TITLE_PALETTE,
  TITLE_PALETTE_BYTES,
  TITLE_STRIPE_SOURCES,
} from '../../src/task/wram.mjs';
import {
  VMAINC,
  DMAP0,
  BBAD0,
  A1T0L,
  A1B0,
  DAS0L,
  VMADDL,
  MDMAEN,
  OBJSEL,
  TM,
  APUIO2,
  CGADD,
  CGDATA,
  VMDATAL,
} from '../../src/constants/hardware-registers.mjs';
import {
  FLAG_ZERO,
  FLAG_CARRY,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
} from '../../src/constants/cpu-flags.mjs';
import { WORD_MASK, WORD_BITS, BYTE_MASK } from '../../src/constants/bits.mjs';
import { WRAM_BANK, WRAM_HIGH_BANK } from '../../src/constants/memory-map.mjs';
import {
  COLOUR_MASK,
  DMAP_TWO_PORTS,
  LAYER_BG1,
  LAYER_BG2,
  LAYER_BG3,
  LAYER_OBJ,
  TILE_PALETTE_STEP,
  TILE_PRIORITY,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../../src/constants/ppu.mjs';
import {
  APU_COMMAND_OUTPUT_MODE,
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_SOUND_VOLUME,
} from '../../src/constants/sound-commands.mjs';
import {
  languageMenuText,
  languageMenuArrowShift,
  beginFrontendMenu,
} from '../../src/data/language.mjs';

// The slot digit of "RESUME GAME 1" (81:E425), replaced for slots 3 and 4.
const SLOT_DIGIT = 0x31,
  SLOT_DIGIT_OFFSET = 24; // tilemap bytes of the 12th character
// Menu texts of bank 81 (src/data/menu-texts.mjs); the callers load their low word into Y.
const TEXT_COPYRIGHT = 0x81d582,
  TEXT_START_NEW_GAME = 0x81e3b2,
  TEXT_START_SAVED_GAME = 0x81e3c1,
  TEXT_OPTIONS = 0x81e3d2,
  TEXT_RESUME_GAME_1 = 0x81e425,
  TEXT_RESUME_GAME_2 = 0x81e433,
  TEXT_EXIT = 0x81e441,
  TEXT_STEREOPHONIC = 0x81e4a1,
  TEXT_MONOPHONIC = 0x81e4ae,
  TEXT_CONTROL_TYPE_A = 0x81e4b9,
  TEXT_CONTROL_TYPE_B = 0x81e4c8,
  TEXT_OPTIONS_EXIT = 0x81e4d7,
  TEXT_MUSIC_FULL = 0x81e4dc,
  TEXT_MUSIC_EVENT = 0x81e4ec,
  TEXT_MUSIC_OFF = 0x81e4fd;
// 81:D531 turns character c into the word MENU_FONT_TILES + 2 (c - FONT_FIRST_CODE) with
// priority and palette 1, XORed with DP_MENU_TEXT_XOR. A disabled row XORs palette 1 back
// to 0; the highlight 81:E371 swaps palettes 1 and 2.
export const FONT_FIRST_CODE = 0x20, // the space character
  MENU_TEXT_ATTRIBUTES = TILE_PRIORITY | TILE_PALETTE_STEP,
  MENU_DISABLED_XOR = TILE_PALETTE_STEP,
  MENU_HIGHLIGHT_TOGGLE = TILE_PALETTE_STEP * 3,
  MENU_BLANK_CHAR = FONT_FIRST_CODE,
  MENU_ARROW_CHAR = 0x23, // the font draws the arrow for '#'
  MENU_BLINKS = 8; // highlight toggles of 81:E354, four frames each
// Menu layout as tilemap byte offsets (0x40 bytes per tile row): rows every second tile
// row from tile row 16, the arrow in column 8, the texts in column 10, the copyright line
// in tile row 26, column 2. 81:D59E sends the tilemap to VRAM word 0800.
const MENU_FIRST_ROW = 0x400,
  MENU_ROW_STEP = 0x80,
  MENU_ROW_TILES = 0x20,
  MENU_ARROW_ROW_1 = MENU_FIRST_ROW + 0x10,
  MENU_TEXT_ROW_1 = MENU_FIRST_ROW + 0x14,
  MENU_TEXT_ROW_2 = MENU_TEXT_ROW_1 + MENU_ROW_STEP,
  MENU_TEXT_ROW_3 = MENU_TEXT_ROW_2 + MENU_ROW_STEP,
  MENU_TEXT_ROW_4 = MENU_TEXT_ROW_3 + MENU_ROW_STEP,
  COPYRIGHT_POSITION = 0x684,
  MENU_TILEMAP_VRAM = 0x800;
// BYTE checksum of the three settings (81:D5D0): seed plus the bytes, XORed at the end.
const SETTINGS_CHECKSUM_SEED = 0xeb,
  SETTINGS_CHECKSUM_XOR = 0x5a;
// Random step of 81:E788.
const RANDOM_INCREMENT = 0xadb;
// Title start 81:E50C: it waits for the music cue on APU port 2, runs a light down the
// gradient colours 8-15 (DP_TITLE_COLOUR grows by TITLE_GRADIENT_STEP, the colour three
// behind it returns to DP_TITLE_BASE_COLOUR), then fades colours 16-63 in from white over
// twelve frames (81:E5DB: per pair of frames a shift and a mask from 81:E60B/E617).
export const TITLE_MUSIC_CUE = 3,
  TITLE_GRADIENT = TITLE_PALETTE + 0x10,
  TITLE_GRADIENT_BYTES = 0x10,
  TITLE_GRADIENT_TAIL_BYTES = 6,
  TITLE_GRADIENT_STEP = 0x863,
  TITLE_FADE_STEPS = 0x0c,
  TITLE_FADE_TAIL_STEP = 6, // fade step from which the light's tail runs out
  WORD_INDEX_MASK = 0xfe,
  TITLE_FADE_COLOURS = TITLE_PALETTE + 0x20,
  TITLE_FADE_BYTES = 0x60,
  TITLE_FADE_SHIFTS = 0x81e60b,
  TITLE_FADE_MASKS = 0x81e617,
  DP_TITLE_COLOUR = 0x0e,
  DP_TITLE_BASE_COLOUR = 0x1e,
  DP_FADE_SHIFT = 0x10,
  DP_FADE_MASK = 0x12,
  TITLE_LAYERS = LAYER_BG1 | LAYER_BG2 | LAYER_BG3;
// Title objects of 81:E57E: four OAM entries from 81:E5CB, all large (high table bits
// 10), OBJSEL size 1 (8x8 and 32x32) with name base 3; the objects join TITLE_LAYERS.
const TITLE_SPRITES_BYTES = 0x10,
  TITLE_SPRITES_HIGH = 0xaa,
  TITLE_OBJSEL = 0x23,
  TITLE_LAYERS_WITH_OBJECTS = TITLE_LAYERS | LAYER_OBJ;
// Title animations: 24 frames each. 81:E6AE advances every frame below the last one each
// eight frames and restarts a random finished one with a chance of 30 in 2048, playing
// its sound (81:E7B4) on voices 1-3, then setting voice 0 again.
const TITLE_ANIMATION_FRAME_COUNT = 0x18,
  TITLE_ANIMATION_LAST_FRAME = TITLE_ANIMATION_FRAME_COUNT - 1,
  TITLE_ANIMATION_LAST = 6, // byte index of the fourth animation
  TITLE_ANIMATION_INDEX_MASK = 6,
  TITLE_ANIMATION_PERIOD_MASK = 7,
  TITLE_RESTART_ROLL_MASK = 0x7ff,
  TITLE_RESTART_CHANCE = 0x1e,
  TITLE_RESTART_VOICES = 0x0e;
// Animation graphics in bank 7F (81:E684, 81:E699): eight frames of 0x80 bytes per row.
// The first two animations send one stripe from 7F:8018 (rows 0x400 apart), the other two
// four stripes 0x400 apart from 7F:0018 (rows 0x1000 apart). The second animation of each
// pair uses frames 24-47. 81:E6AE sends the ten stripes to the VRAM words of 81:E7A0.
export const FRAME_COLUMN_MASK = 7,
  FRAME_ROW_MASK = 0xf8,
  SMALL_FRAME_GRAPHICS = 0x8018,
  LARGE_FRAME_GRAPHICS = 0x0018,
  LARGE_STRIPE_STEP = 0x400,
  DP_FRAME_COLUMN = 0x32,
  TITLE_STRIPES = 10,
  TITLE_STRIPE_LAST = (TITLE_STRIPES - 1) * 2,
  TITLE_STRIPE_BYTES = 0x80,
  ANIMATION_1_SOURCE = TITLE_STRIPE_SOURCES,
  ANIMATION_2_SOURCE = ANIMATION_1_SOURCE + 2,
  ANIMATION_3_SOURCES = ANIMATION_2_SOURCE + 2,
  ANIMATION_3_SOURCE_2 = ANIMATION_3_SOURCES + 2,
  ANIMATION_3_SOURCE_3 = ANIMATION_3_SOURCE_2 + 2,
  ANIMATION_3_SOURCE_4 = ANIMATION_3_SOURCE_3 + 2,
  ANIMATION_4_SOURCES = ANIMATION_3_SOURCE_4 + 2,
  ANIMATION_4_SOURCE_2 = ANIMATION_4_SOURCES + 2,
  ANIMATION_4_SOURCE_3 = ANIMATION_4_SOURCE_2 + 2,
  ANIMATION_4_SOURCE_4 = ANIMATION_4_SOURCE_3 + 2;
// The same unlabelled frame as routineCaller, as a sequence: a callee with a
// registered continuation pauses inside its frame; any other stays a segment.
export function* frontendCallSequence(h, e, r, pc, target, long = false) {
  const run = r.get(target);
  if (!run) taskStop('main_loop_frontier', { target });
  const bank = h.ctx.programBank,
    raw = (pc + (long ? JSL_RETURN_OFFSET : JSR_RETURN_OFFSET)) & WORD_MASK;
  yield () => {
    if (long) h.pushByte(bank);
    h.a.pushWord(raw);
    h.ctx.programBank = target >>> WORD_BITS;
    h.ctx.pc = target & WORD_MASK;
  };
  const result = yield { target, run, h, events: e, routines: r };
  yield () => {
    if (h.ctx.programBank !== bank || h.ctx.pc !== ((raw + 1) & WORD_MASK))
      taskStop('task_native_helper_return_required', {
        pc,
        target,
        bank: h.ctx.programBank,
        returnPc: h.ctx.pc,
      });
  };
  return result;
}
// Registers fixed frontend sequences as continuations of their own targets.
export function frontendContinuations(entries, defaults) {
  for (const [target, run, sequence] of entries)
    NATIVE_CALL_CONTINUATIONS.set(target, {
      run,
      create: ({ h, events, routines = defaults() }) =>
        new NativeCallContinuation(h.a, sequence(h, events, routines)),
    });
}
const downX = (h) => {
  h.index('x', h.ctx.x - 1);
  h.index('x', h.ctx.x - 1);
};
const phk = (h) => h.pushByte(h.ctx.programBank);

// Original routine $81:D531.
function drawMenuText(h) {
  const { ctx } = h;
  // Text language (src/data/language.mjs): the translated text at its own position.
  const translated = languageMenuText(h.a?.mem, h.abs(0) + ctx.y);
  if (translated) h.index('x', (ctx.x + translated.shift) & WORD_MASK);
  for (let i = 0; ; i++) {
    h.load(translated ? (translated.codes[i] ?? 0) : h.read(h.abs(0) + ctx.y));
    h.load(ctx.a & BYTE_MASK);
    if (ctx.status & FLAG_ZERO) return h.rtl();
    h.phx();
    ctx.status |= FLAG_CARRY;
    h.sbc(FONT_FIRST_CODE);
    h.asl();
    h.index('x', ctx.a);
    h.load(h.read(MENU_FONT_TILES + ctx.x));
    h.load(ctx.a | MENU_TEXT_ATTRIBUTES);
    h.load(ctx.a ^ h.dp(DP_MENU_TEXT_XOR));
    h.plx();
    h.write(MENU_TILEMAP + ctx.x, ctx.a);
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.index('y', ctx.y + 1);
  }
}
// Original routine $81:D555.
function clearMenuTilemap(h, e, r = START_MENU_TEXT_REFERENCE) {
  const { ctx } = h;
  beginFrontendMenu(h.a?.mem);
  h.php();
  h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  h.index('x', MENU_TILEMAP_BYTES - 2);
  h.load(MENU_TEXT_ATTRIBUTES);
  do {
    h.write(MENU_TILEMAP + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.phb();
  phk(h);
  h.plb();
  h.dpWrite(DP_MENU_TEXT_XOR, 0);
  h.index('x', COPYRIGHT_POSITION);
  h.index('y', TEXT_COPYRIGHT & WORD_MASK);
  routineCaller(h, e, r)(0x81d571, 0x81d531, true);
  h.index('x', MENU_ROW_DISABLED_BYTES - 2);
  do {
    h.write(h.abs(MENU_ROW_DISABLED) + ctx.x, 0);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.plb();
  h.plp();
  return h.rtl();
}
// Original routine $81:D59E.
function uploadMenuTilemap(h) {
  const { ctx } = h;
  h.php();
  h.rep(FLAG_MEMORY_8BIT);
  h.sep(FLAG_INDEX_8BIT);
  const xport = (value, port, pc) => {
    h.index('x', value);
    h.portWrite(port, ctx.x, 1, pc);
  };
  xport(VMAINC_INCREMENT_AFTER_HIGH, VMAINC, 0x81d5a5);
  xport(DMAP_TWO_PORTS, DMAP0, 0x81d5aa);
  xport(VMDATAL & BYTE_MASK, BBAD0, 0x81d5af);
  h.load(MENU_TILEMAP & WORD_MASK);
  h.portWrite(A1T0L, ctx.a, 2, 0x81d5b5);
  xport(WRAM_BANK, A1B0, 0x81d5ba);
  h.load(MENU_TILEMAP_BYTES);
  h.portWrite(DAS0L, ctx.a, 2, 0x81d5c0);
  h.load(MENU_TILEMAP_VRAM);
  h.portWrite(VMADDL, ctx.a, 2, 0x81d5c6);
  xport(1, MDMAEN, 0x81d5cb);
  h.plp();
  return h.rtl();
}
// BYTE checksum of the three original global SRAM settings. PHP/PLP keeps
// the caller's incoming carry; only the checksum body explicitly clears it.
// Original routine $81:D5D0.
function runSettingsChecksum(h) {
  const { ctx } = h;
  h.php();
  h.rep(FLAG_INDEX_8BIT);
  h.index('x', 2);
  h.load(SETTINGS_CHECKSUM_SEED);
  ctx.status &= ~FLAG_CARRY;
  do {
    h.adc(h.read(SETTINGS_STEREO + ctx.x));
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(ctx.a ^ SETTINGS_CHECKSUM_XOR);
  h.plp();
  return h.rts();
}
// Original routine $81:D5E4.
function runSettingsChecksumStore(h, e, r = START_MENU_TEXT_REFERENCE) {
  routineCaller(h, e, r)(0x81d5e4, 0x81d5d0);
  h.write(SETTINGS_CHECKSUM, h.ctx.a);
  return h.rtl();
}
// Original routine $81:D5EC.
function runSettingsChecksumCompare(h, e, r = START_MENU_TEXT_REFERENCE) {
  routineCaller(h, e, r)(0x81d5ec, 0x81d5d0);
  h.cmp(h.read(SETTINGS_CHECKSUM));
  return h.rtl();
}
// Original routine $81:D5F4.
function runSettingsDefaults(h, e, r = START_MENU_TEXT_REFERENCE) {
  h.php();
  h.sep(FLAG_MEMORY_8BIT);
  for (const [at, value] of [
    [SETTINGS_STEREO, SETTINGS_STEREO_ON],
    [SETTINGS_CONTROL, 0],
    [SETTINGS_MUSIC, SETTINGS_MUSIC_FULL],
  ]) {
    h.load(value);
    h.write(at, h.ctx.a);
  }
  routineCaller(h, e, r)(0x81d609, 0x81d5e4, true);
  h.plp();
  return h.rtl();
}
// Original routine $81:EF36.
function sendOutputMode(h, e, r = START_MENU_TEXT_REFERENCE) {
  h.php();
  h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  h.load(h.read(SETTINGS_STEREO));
  h.index('x', h.ctx.a);
  h.load(APU_COMMAND_OUTPUT_MODE);
  routineCaller(h, e, r)(0x81ef41, 0x81f007, true);
  h.plp();
  return h.rtl();
}
// Original routine $81:E788.
function advanceFrontendRandom(h) {
  const { ctx } = h;
  h.load(h.read(FRONTEND_RANDOM));
  h.load(ctx.a ^ h.read(FRONTEND_RANDOM_HIGH));
  h.load(ctx.a ^ h.read(h.abs(FRONTEND_FRAME_COUNTER)));
  h.adc(RANDOM_INCREMENT);
  h.write(FRONTEND_RANDOM, ctx.a);
  h.rol();
  h.write(FRONTEND_RANDOM_HIGH, ctx.a);
  return h.rts();
}
// Original routine $81:E32F.
function drawArrowCharacter(h, e, r = START_MENU_TEXT_REFERENCE) {
  const { ctx } = h;
  h.dpWrite(DP_MENU_TEXT, ctx.a);
  h.load(h.dp(DP_MENU_CURSOR));
  h.xba();
  h.lsr();
  h.adc(MENU_ARROW_ROW_1);
  // Text language (src/data/language.mjs): the arrow moves with the translated texts.
  const arrowShift = languageMenuArrowShift(h.a?.mem);
  if (arrowShift) h.load((ctx.a + arrowShift) & WORD_MASK);
  h.phx();
  h.index('x', ctx.a);
  h.index('y', DP_MENU_TEXT);
  routineCaller(h, e, r)(0x81e33d, 0x81d531, true);
  h.plx();
  return h.rts();
}
// Original routine $81:E343.
function moveMenuArrow(h, e, r = START_MENU_TEXT_REFERENCE) {
  const call = routineCaller(h, e, r);
  h.pha();
  h.load(MENU_BLANK_CHAR);
  call(0x81e347, 0x81e32f);
  h.pla();
  h.dpWrite(DP_MENU_CURSOR, h.ctx.a);
  h.load(MENU_ARROW_CHAR);
  call(0x81e350, 0x81e32f);
  return h.rts();
}
// Original routine $81:E371.
function toggleMenuHighlight(h) {
  const { ctx } = h;
  h.load(h.dp(DP_MENU_CURSOR));
  h.xba();
  h.lsr();
  h.adc(MENU_FIRST_ROW);
  h.index('x', ctx.a);
  h.index('y', MENU_ROW_TILES);
  do {
    h.load(h.read(MENU_TILEMAP + ctx.x));
    h.load(ctx.a ^ MENU_HIGHLIGHT_TOGGLE);
    h.write(MENU_TILEMAP + ctx.x, ctx.a);
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.index('y', ctx.y - 1);
  } while (!(ctx.status & FLAG_ZERO));
  return h.rts();
}
// Original routine $81:E354.
function blinkMenuSelection(h, e, r = START_MENU_TEXT_REFERENCE) {
  return drainNativeSequence(blinkMenuSelectionSequence(h, e, r));
}
function* blinkMenuSelectionSequence(h, e, r) {
  const call = (pc, target, long) => frontendCallSequence(h, e, r, pc, target, long);
  h.load(MENU_BLINKS);
  h.dpWrite(DP_MENU_TEXT, h.ctx.a);
  do {
    for (const pc of [0x81e359, 0x81e35d]) yield* call(pc, 0x81eebb, true);
    yield* call(0x81e361, 0x81e371);
    for (const pc of [0x81e364, 0x81e368]) yield* call(pc, 0x81eebb, true);
    h.modify(h.ctx.d + DP_MENU_TEXT, 'dec', true);
  } while (!(h.ctx.status & FLAG_ZERO));
  return h.rts();
}
// Original routine $81:E38D.
function drawStartMenu(h, e, r = START_MENU_TEXT_REFERENCE) {
  const call = routineCaller(h, e, r);
  phk(h);
  h.plb();
  call(0x81e38f, 0x81d555, true);
  for (const [pc, x, y] of [
    [0x81e399, MENU_TEXT_ROW_1, TEXT_START_NEW_GAME & WORD_MASK],
    [0x81e3a3, MENU_TEXT_ROW_2, TEXT_START_SAVED_GAME & WORD_MASK],
    [0x81e3ad, MENU_TEXT_ROW_3, TEXT_OPTIONS & WORD_MASK],
  ]) {
    h.index('x', x);
    h.index('y', y);
    call(pc, 0x81d531, true);
  }
  // The live port adds credits after Options with the installed menu font.
  // Arrow, highlight and tilemap upload use the existing routines.
  if (h.a.vm?.startMenuCredits) {
    const label = h.a.mem.languageData ? 'MITWIRKENDE' : 'CREDITS';
    const position = MENU_TEXT_ROW_4 + languageMenuArrowShift(h.a.mem);
    for (let i = 0; i < label.length; i++) {
      const tile = h.read(MENU_FONT_TILES + (label.charCodeAt(i) - FONT_FIRST_CODE) * 2, 2);
      h.write(MENU_TILEMAP + position + i * 2, tile | MENU_TEXT_ATTRIBUTES, 2);
    }
  }
  return h.rts();
}
// Original routine $81:E3DA.
function drawResumeMenu(h, e, r = START_MENU_TEXT_REFERENCE) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  phk(h);
  h.plb();
  call(0x81e3dc, 0x81d555, true);
  const slots = saveSlotCount(h.a);
  h.index('x', slots - 1);
  do {
    h.phx();
    h.load(ctx.x);
    call(0x81e3e5, 0x81b1ab, true);
    if (!(ctx.status & FLAG_ZERO)) {
      h.plx();
      h.load(ctx.x);
      h.asl();
      h.index('y', ctx.a);
      h.load(MENU_DISABLED_XOR);
      h.write(h.abs(MENU_ROW_DISABLED) + ctx.y, ctx.a);
      h.phx();
    }
    h.plx();
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  for (const [at, x, y, pc] of [
    [MENU_ROW_DISABLED, MENU_TEXT_ROW_1, TEXT_RESUME_GAME_1 & WORD_MASK, 0x81e405],
    [MENU_ROW_DISABLED + 2, MENU_TEXT_ROW_2, TEXT_RESUME_GAME_2 & WORD_MASK, 0x81e414],
  ]) {
    h.load(h.read(h.abs(at)));
    h.dpWrite(DP_MENU_TEXT_XOR, ctx.a);
    h.index('x', x);
    h.index('y', y);
    call(pc, 0x81d531, true);
  }
  // Four-slot option (src/game/save-slots.mjs): rows 3 and 4 draw the text
  // "RESUME GAME 1" and replace its digit with the same tile formula as D531.
  for (let slot = 2; slot < slots; slot++) {
    const x = MENU_TEXT_ROW_1 + slot * MENU_ROW_STEP;
    h.load(h.read(h.abs(MENU_ROW_DISABLED + slot * 2)));
    h.dpWrite(DP_MENU_TEXT_XOR, ctx.a);
    h.index('x', x);
    h.index('y', TEXT_RESUME_GAME_1 & WORD_MASK);
    call(0x81e414, 0x81d531, true);
    const digit = SLOT_DIGIT + slot,
      tile =
        (h.read(MENU_FONT_TILES + (digit - FONT_FIRST_CODE) * 2, 2) | MENU_TEXT_ATTRIBUTES) ^
        h.dp(DP_MENU_TEXT_XOR, 2);
    // The digit of "RESUME GAME 1" (12th character), or of its translation.
    const translated = languageMenuText(h.a?.mem, TEXT_RESUME_GAME_1),
      index = translated?.slotIndex ?? translated?.codes.indexOf(SLOT_DIGIT),
      at = translated ? x + translated.shift + 2 * index : x + SLOT_DIGIT_OFFSET;
    // Empty edited save labels hide their digit too. Never write before the
    // row when a translated or edited label has no substitution character.
    if (!translated || index >= 0) h.write(MENU_TILEMAP + at, tile, 2);
  }
  h.dpWrite(DP_MENU_TEXT_XOR, 0);
  h.index('x', MENU_TEXT_ROW_1 + slots * MENU_ROW_STEP);
  h.index('y', TEXT_EXIT & WORD_MASK);
  call(0x81e420, 0x81d531, true);
  return h.rts();
}
// Original routine $81:E446.
function drawOptionsMenu(h, e, r = START_MENU_TEXT_REFERENCE) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  phk(h);
  h.plb();
  call(0x81e448, 0x81d555, true);
  h.index('x', MENU_TEXT_ROW_2);
  h.index('y', TEXT_MONOPHONIC & WORD_MASK);
  h.load(h.read(SETTINGS_STEREO));
  h.load(ctx.a & SETTINGS_STEREO_ON);
  if (!(ctx.status & FLAG_ZERO)) h.index('y', TEXT_STEREOPHONIC & WORD_MASK);
  call(0x81e45e, 0x81d531, true);
  h.index('x', MENU_TEXT_ROW_1);
  h.index('y', TEXT_CONTROL_TYPE_A & WORD_MASK);
  h.load(h.read(SETTINGS_CONTROL));
  h.load(ctx.a & SETTINGS_CONTROL_TYPE_A);
  if (ctx.status & FLAG_ZERO) h.index('y', TEXT_CONTROL_TYPE_B & WORD_MASK);
  call(0x81e474, 0x81d531, true);
  h.index('x', MENU_TEXT_ROW_3);
  h.index('y', TEXT_MUSIC_OFF & WORD_MASK);
  h.load(h.read(SETTINGS_MUSIC));
  h.load(ctx.a & SETTINGS_MUSIC_MASK);
  if (!(ctx.status & FLAG_ZERO)) {
    h.index('y', TEXT_MUSIC_EVENT & WORD_MASK);
    h.cmp(SETTINGS_MUSIC_EVENT);
    if (!(ctx.status & FLAG_ZERO)) h.index('y', TEXT_MUSIC_FULL & WORD_MASK);
  }
  call(0x81e492, 0x81d531, true);
  h.index('x', MENU_TEXT_ROW_4);
  h.index('y', TEXT_OPTIONS_EXIT & WORD_MASK);
  call(0x81e49c, 0x81d531, true);
  return h.rts();
}
// Original routine $81:E684.
function smallFrameSource(h) {
  const { ctx } = h;
  h.pha();
  h.load(ctx.a & FRAME_COLUMN_MASK);
  h.xba();
  h.lsr();
  h.dpWrite(DP_FRAME_COLUMN, ctx.a);
  h.pla();
  h.load(ctx.a & FRAME_ROW_MASK);
  h.xba();
  h.lsr();
  h.load(ctx.a | h.dp(DP_FRAME_COLUMN));
  ctx.status &= ~FLAG_CARRY;
  h.adc(SMALL_FRAME_GRAPHICS);
  return h.rts();
}
// Original routine $81:E699.
function largeFrameSource(h) {
  const { ctx } = h;
  h.pha();
  h.load(ctx.a & FRAME_COLUMN_MASK);
  h.xba();
  h.lsr();
  h.dpWrite(DP_FRAME_COLUMN, ctx.a);
  h.pla();
  h.load(ctx.a & FRAME_ROW_MASK);
  h.xba();
  h.asl();
  h.load(ctx.a | h.dp(DP_FRAME_COLUMN));
  ctx.status &= ~FLAG_CARRY;
  h.adc(LARGE_FRAME_GRAPHICS);
  return h.rts();
}
// Original routine $81:E623.
function setAnimationSources(h, e, r = START_MENU_TEXT_REFERENCE) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.php();
  h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  h.load(h.read(h.abs(TITLE_ANIMATION_FRAMES)));
  call(0x81e629, 0x81e684);
  h.write(ANIMATION_1_SOURCE, ctx.a);
  h.load(h.read(h.abs(TITLE_ANIMATION_2_FRAME)));
  ctx.status &= ~FLAG_CARRY;
  h.adc(TITLE_ANIMATION_FRAME_COUNT);
  call(0x81e637, 0x81e684);
  h.write(ANIMATION_2_SOURCE, ctx.a);
  h.load(h.read(h.abs(TITLE_ANIMATION_3_FRAME)));
  call(0x81e641, 0x81e699);
  h.write(ANIMATION_3_SOURCES, ctx.a);
  ctx.status &= ~FLAG_CARRY;
  for (const at of [ANIMATION_3_SOURCE_2, ANIMATION_3_SOURCE_3, ANIMATION_3_SOURCE_4]) {
    h.adc(LARGE_STRIPE_STEP);
    h.write(at, ctx.a);
  }
  h.load(h.read(h.abs(TITLE_ANIMATION_4_FRAME)));
  ctx.status &= ~FLAG_CARRY;
  h.adc(TITLE_ANIMATION_FRAME_COUNT);
  call(0x81e665, 0x81e699);
  h.write(ANIMATION_4_SOURCES, ctx.a);
  ctx.status &= ~FLAG_CARRY;
  for (const at of [ANIMATION_4_SOURCE_2, ANIMATION_4_SOURCE_3, ANIMATION_4_SOURCE_4]) {
    h.adc(LARGE_STRIPE_STEP);
    h.write(at, ctx.a);
  }
  h.plp();
  return h.rts();
}
// Original routine $81:E5DB.
function fadeTitleColours(h) {
  const { ctx } = h;
  h.phx();
  h.load(ctx.x);
  h.lsr();
  h.asl();
  h.index('x', ctx.a);
  h.load(h.read(h.abs(TITLE_FADE_SHIFTS & WORD_MASK) + ctx.x));
  h.dpWrite(DP_FADE_SHIFT, ctx.a);
  h.load(h.read(h.abs(TITLE_FADE_MASKS & WORD_MASK) + ctx.x));
  h.dpWrite(DP_FADE_MASK, ctx.a);
  h.index('x', TITLE_FADE_BYTES - 2);
  do {
    h.load(h.read(0x85ebe0 + ctx.x));
    h.load(ctx.a ^ COLOUR_MASK);
    h.load(ctx.a & h.dp(DP_FADE_MASK));
    h.index('y', h.dp(DP_FADE_SHIFT, 2));
    if (!(ctx.status & FLAG_ZERO))
      do {
        h.lsr();
        h.index('y', ctx.y - 1);
      } while (!(ctx.status & FLAG_ZERO));
    h.load(ctx.a ^ COLOUR_MASK);
    h.write(TITLE_FADE_COLOURS + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.plx();
  return h.rts();
}
// Original routine $81:E57E.
function showTitleObjects(h, e, r = START_MENU_TEXT_REFERENCE) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.php();
  h.index('x', TITLE_SPRITES_BYTES - 2);
  do {
    h.load(h.read(0x81e5cb + ctx.x));
    h.write(h.abs(OAM_SHADOW) + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(TITLE_SPRITES_HIGH);
  h.write(h.abs(OAM_SHADOW_HIGH), ctx.a);
  for (const at of [
    TITLE_ANIMATION_FRAMES,
    TITLE_ANIMATION_2_FRAME,
    TITLE_ANIMATION_3_FRAME,
    TITLE_ANIMATION_4_FRAME,
  ])
    h.write(h.abs(at), 0);
  for (const [at, pc] of [
    [0x81e7b8, 0x81e5a7],
    [0x81e7ba, 0x81e5b3],
  ]) {
    h.load(h.read(at));
    h.index('x', ctx.a);
    h.load(APU_COMMAND_SOUND_VOLUME);
    call(pc, 0x81f007, true);
  }
  call(0x81e5b7, 0x81e623);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(TITLE_OBJSEL);
  h.portWrite(OBJSEL, ctx.a & BYTE_MASK, 1, 0x81e5be);
  h.load(TITLE_LAYERS_WITH_OBJECTS);
  h.portWrite(TM, ctx.a & BYTE_MASK, 1, 0x81e5c3);
  h.modify(h.abs(FRONTEND_FRAME_COUNTER), 'inc');
  h.plp();
  return h.rts();
}
// Original routine $81:E50C.
function playTitleStart(h, e, r = START_MENU_TEXT_REFERENCE) {
  return drainNativeSequence(playTitleStartSequence(h, e, r));
}
function* playTitleStartSequence(h, e, r) {
  const { ctx } = h,
    call = (pc, target, long) => frontendCallSequence(h, e, r, pc, target, long);
  phk(h);
  h.plb();
  h.sep(FLAG_MEMORY_8BIT);
  // Music beat wait on port 2: with lag-free frames the NMI arrives at BNE E515.
  const step = (pc) => {
    if (steppedInterrupts(e)) interruptStep(h, e, pc);
  };
  do {
    yield () => {
      step(0x81e510);
      h.load(h.port(APUIO2, 1, 0x81e510));
      step(0x81e513);
      h.cmp(TITLE_MUSIC_CUE);
      step(0x81e515);
    };
  } while (!(ctx.status & FLAG_ZERO));
  h.rep(FLAG_MEMORY_8BIT);
  h.load(h.read(TITLE_GRADIENT));
  h.dpWrite(DP_TITLE_COLOUR, ctx.a);
  h.dpWrite(DP_TITLE_BASE_COLOUR, ctx.a);
  h.index('x', TITLE_GRADIENT_BYTES - 2);
  do {
    yield* call(0x81e524, 0x81eebb, true);
    yield* call(0x81e528, 0x81eebb, true);
    h.cpx(TITLE_GRADIENT_BYTES - TITLE_GRADIENT_TAIL_BYTES);
    if (!(ctx.status & FLAG_CARRY)) {
      h.load(h.dp(DP_TITLE_BASE_COLOUR));
      h.write(TITLE_GRADIENT + TITLE_GRADIENT_TAIL_BYTES + ctx.x, ctx.a);
    }
    h.load(h.dp(DP_TITLE_COLOUR));
    ctx.status &= ~FLAG_CARRY;
    h.adc(TITLE_GRADIENT_STEP);
    h.dpWrite(DP_TITLE_COLOUR, ctx.a);
    h.write(TITLE_GRADIENT + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.index('x', 0);
  do {
    yield* call(0x81e54a, 0x81eebb, true);
    yield* call(0x81e54e, 0x81e5db);
    h.phx();
    h.load(ctx.x);
    ctx.status |= FLAG_CARRY;
    h.sbc(TITLE_FADE_TAIL_STEP);
    if (ctx.status & FLAG_CARRY) {
      h.load(ctx.a & WORD_INDEX_MASK);
      h.load(ctx.a ^ TITLE_GRADIENT_TAIL_BYTES);
      h.index('x', ctx.a);
      h.load(h.dp(DP_TITLE_BASE_COLOUR));
      h.write(TITLE_GRADIENT - 2 + ctx.x, ctx.a);
    }
    h.plx();
    h.sep(FLAG_MEMORY_8BIT);
    h.load(TITLE_LAYERS);
    h.portWrite(TM, ctx.a & BYTE_MASK, 1, 0x81e56b);
    h.rep(FLAG_MEMORY_8BIT);
    h.index('x', ctx.x + 1);
    h.cpx(TITLE_FADE_STEPS);
  } while (!(ctx.status & FLAG_ZERO));
  yield* call(0x81e576, 0x81eebb, true);
  yield* call(0x81e57a, 0x81e57e);
  return h.rts();
}
// The callback installed by the actual E14A data program. The early paths
// return X8, the sound path X16. The surrounding original NMI owns its saved P.
// Original routine $81:E6AE.
function runTitleCallback(h, e, r = START_MENU_TEXT_REFERENCE) {
  return drainNativeSequence(titleCallbackSequence(h, e, r));
}
function* titleCallbackSequence(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  let result;
  yield () => {
    call(0x81e6ae, 0x81ed8b, true);
    call(0x81e6b2, 0x81d59e, true);
    h.sep(FLAG_INDEX_8BIT);
    const yport = (value, port, pc) => {
      h.index('y', value);
      h.portWrite(port, ctx.y, 1, pc);
    };
    yport(0, CGADD, 0x81e6ba);
    yport(0, DMAP0, 0x81e6bf);
    yport(CGDATA & BYTE_MASK, BBAD0, 0x81e6c4);
    h.load(TITLE_PALETTE & WORD_MASK);
    h.portWrite(A1T0L, ctx.a, 2, 0x81e6ca);
    yport(WRAM_BANK, A1B0, 0x81e6cf);
    h.load(TITLE_PALETTE_BYTES);
    h.portWrite(DAS0L, ctx.a, 2, 0x81e6d5);
    yport(1, MDMAEN, 0x81e6da);
    h.load(h.read(h.abs(FRONTEND_FRAME_COUNTER)));
    if (!(ctx.status & FLAG_ZERO)) {
      h.index('x', TITLE_STRIPE_LAST);
      yport(VMAINC_INCREMENT_AFTER_HIGH, VMAINC, 0x81e6e9);
      yport(DMAP_TWO_PORTS, DMAP0, 0x81e6ee);
      yport(WRAM_HIGH_BANK, A1B0, 0x81e6f3);
      yport(VMDATAL & BYTE_MASK, BBAD0, 0x81e6f8);
      do {
        h.load(h.read(TITLE_STRIPE_SOURCES + ctx.x));
        h.portWrite(A1T0L, ctx.a, 2, 0x81e6ff);
        h.load(TITLE_STRIPE_BYTES);
        h.portWrite(DAS0L, ctx.a, 2, 0x81e705);
        h.load(h.read(0x81e7a0 + ctx.x));
        h.portWrite(VMADDL, ctx.a, 2, 0x81e70c);
        yport(1, MDMAEN, 0x81e711);
        downX(h);
      } while (!(ctx.status & FLAG_NEGATIVE));
      h.load(h.read(h.abs(FRONTEND_FRAME_COUNTER)));
      h.load(ctx.a & TITLE_ANIMATION_PERIOD_MASK);
      if (ctx.status & FLAG_ZERO) {
        h.index('x', TITLE_ANIMATION_LAST);
        do {
          h.load(h.read(h.abs(TITLE_ANIMATION_FRAMES) + ctx.x));
          h.cmp(TITLE_ANIMATION_LAST_FRAME);
          if (!(ctx.status & FLAG_ZERO)) {
            ctx.status &= ~FLAG_CARRY;
            h.adc(1);
            h.write(h.abs(TITLE_ANIMATION_FRAMES) + ctx.x, ctx.a);
          }
          downX(h);
        } while (!(ctx.status & FLAG_NEGATIVE));
        call(0x81e735, 0x81e623);
      }
      h.modify(h.abs(FRONTEND_FRAME_COUNTER), 'inc');
      call(0x81e73b, 0x81e788);
      h.load(ctx.a & TITLE_ANIMATION_INDEX_MASK);
      h.index('x', ctx.a);
      h.load(h.read(h.abs(TITLE_ANIMATION_FRAMES) + ctx.x));
      h.cmp(TITLE_ANIMATION_LAST_FRAME);
      if (ctx.status & FLAG_ZERO) {
        call(0x81e74a, 0x81e788);
        h.load(ctx.a & TITLE_RESTART_ROLL_MASK);
        h.cmp(TITLE_RESTART_CHANCE);
        if (!(ctx.status & FLAG_CARRY)) {
          h.load(0);
          h.write(h.abs(TITLE_ANIMATION_FRAMES) + ctx.x, ctx.a);
          h.phx();
          h.rep(FLAG_INDEX_8BIT);
          h.load(APU_COMMAND_SOUND_VOICES);
          h.index('x', TITLE_RESTART_VOICES);
          call(0x81e764, 0x81f007, true);
          h.sep(FLAG_INDEX_8BIT);
          h.plx();
          h.load(h.read(0x81e7b4 + ctx.x));
          h.rep(FLAG_INDEX_8BIT);
          h.index('x', ctx.a);
          h.load(APU_COMMAND_SOUND_VOLUME);
          call(0x81e775, 0x81f007, true);
          h.load(APU_COMMAND_SOUND_VOICES);
          h.index('x', 1);
          call(0x81e77f, 0x81f007, true);
        }
      }
    }
  };
  yield* nativeCallSequence(h, e, r, 0x81e783, 0x80f290, true);
  yield () => {
    result = h.rtl();
  };
  return result;
}
// The text routines of the reference start menu (entries only).
export const START_MENU_TEXT_ENTRIES = [
  [0x81b1ab, compareSaveChecksum],
  [0x81d531, drawMenuText],
  [0x81d555, clearMenuTilemap],
  [0x81d59e, uploadMenuTilemap],
  [0x81d5d0, runSettingsChecksum],
  [0x81d5e4, runSettingsChecksumStore],
  [0x81d5ec, runSettingsChecksumCompare],
  [0x81d5f4, runSettingsDefaults],
  [0x81ef36, sendOutputMode],
  [0x81e788, advanceFrontendRandom],
  [0x81e32f, drawArrowCharacter],
  [0x81e343, moveMenuArrow],
  [0x81e371, toggleMenuHighlight],
  [0x81e354, blinkMenuSelection],
  [0x81e38d, drawStartMenu],
  [0x81e3da, drawResumeMenu],
  [0x81e446, drawOptionsMenu],
  [0x81e684, smallFrameSource],
  [0x81e699, largeFrameSource],
  [0x81e623, setAnimationSources],
  [0x81e5db, fadeTitleColours],
  [0x81e57e, showTitleObjects],
  [0x81e50c, playTitleStart],
  [0x81e6ae, runTitleCallback],
];
export const START_MENU_TEXT_REFERENCE = new Map([
  ...MAIN_SCENE_ROUTINES,
  ...AUDIO_REFERENCE_ENTRIES,
  ...START_MENU_TEXT_ENTRIES,
]);
for (const [run, sequence] of [
  [blinkMenuSelection, blinkMenuSelectionSequence],
  [playTitleStart, playTitleStartSequence],
  [runTitleCallback, titleCallbackSequence],
])
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events, routines = START_MENU_TEXT_REFERENCE }) =>
      new NativeCallContinuation(h.a, sequence(h, events, routines)),
  });
