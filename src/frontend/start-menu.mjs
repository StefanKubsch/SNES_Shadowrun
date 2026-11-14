// The start menu (lifted from 81:E14A/E1B4 with its input 81:E29F, the menu texts
// 81:D531, 81:D555, 81:D59E, 81:E32F, 81:E343, 81:E354, 81:E371, 81:E38D, 81:E3DA,
// 81:E446, the settings 81:D5E4 and 81:EF36 (settings.mjs), the title start 81:E50C with 81:E57E,
// 81:E5DB, 81:E623, and the NMI callback 81:E6AE; register-level reference in
// proof/frontend-reference/start-menu.mjs).
//
// The menu starts its song, shows the title picture with four animations, waits for
// the music, lets a light run down the title and fades its colours in, then offers
// New game, Saved game and Options (and Credits in the port). B or Start chooses,
// Up and Select or Down move; the menu times out as if cancelled. It returns the
// save slot (FFFF: a new game) or FFFE (cancelled).
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { routineCaller } from '../task/routine-call.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
import { decodeOnce, tableEntries } from '../data/named-tables.mjs';
import { taskStop } from '../task/plan.mjs';
import { languageMenuText, languageMenuArrowShift, beginFrontendMenu } from '../data/language.mjs';
import { saveSlotCount } from '../game/save-slots.mjs';
import { sendOutputMode, storeSettingsChecksum } from './settings.mjs';
import { creditsRequested, markStartMenu, requestCredits } from '../game/credits.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { startSceneScreen, enableNmiAndJoypad, disableNmi } from '../system/nmi.mjs';
import { runSceneList } from '../system/scene-list.mjs';
import { unpack } from '../system/unpack.mjs';
import { readJoypad, takePadPresses } from '../system/joypad.mjs';
import { nmiAtBranch, waitForFrame } from '../system/frame-wait.mjs';
import { startSong } from '../apu/music-mode.mjs';
import { setSceneScreen } from '../video/scene-screen.mjs';
import { fadeIn, fadeOut } from '../video/fades.mjs';
import { clearIntroObjects } from '../intro/intro-objects.mjs';
import {
  DP_MENU_CHOICE,
  DP_MENU_CURSOR,
  DP_MENU_TEXT,
  DP_MENU_TEXT_XOR,
  DP_MENU_TIMEOUT,
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
  PAD_B,
  PAD_DOWN,
  PAD_PRESSED,
  PAD_SELECT,
  PAD_START,
  PAD_UP,
  SETTINGS_CONTROL,
  SETTINGS_CONTROL_TYPE_A,
  SETTINGS_MUSIC,
  SETTINGS_MUSIC_EVENT,
  SETTINGS_MUSIC_FULL,
  SETTINGS_MUSIC_MASK,
  SETTINGS_STEREO,
  SETTINGS_STEREO_ON,
  TITLE_ANIMATION_FRAMES,
  TITLE_PALETTE,
  TITLE_PALETTE_BYTES,
  TITLE_STRIPE_SOURCES,
  PAD_HELD,
  WRAM,
} from '../task/wram.mjs';
import {
  A1B0,
  A1T0L,
  APUIO2,
  BBAD0,
  CGADD,
  CGDATA,
  DAS0L,
  DMAP0,
  MDMAEN,
  OBJSEL,
  TM,
  VMADDL,
  VMAINC,
  VMDATAL,
} from '../constants/hardware-registers.mjs';
import {
  COLOUR_MASK,
  DMAP_TWO_PORTS,
  LAYER_BG1,
  LAYER_BG2,
  LAYER_BG3,
  LAYER_OBJ,
  OAM_BYTES,
  TILE_PALETTE_STEP,
  TILE_PRIORITY,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../constants/ppu.mjs';
import {
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_SOUND_VOLUME,
  APU_COMMAND_VOLUME_TARGET,
  APU_FULL_VOLUME,
} from '../constants/sound-commands.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';

const LONG_MASK = 0xffffff,
  WRAM_BANK = WRAM >>> WORD_BITS,
  FRONTEND_BANK = 0x81,
  // Register-level routines for recorded interrupt observations, and the save
  // checksum compare of the save code (src/task/native-main-menu.mjs).
  WAIT_FRAME = 0x81eebb,
  READ_INPUT = 0x80f298,
  CALL_SITE = 0x81e14a,
  SAVE_CHECKSUM_COMPARE = 0x81b1ab,
  SAVE_CHECKSUM_SITE = 0x81e3e5;
// Menu texts of bank 81 (src/data/menu-texts.mjs).
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
// Characters: the font word of c is at MENU_FONT_TILES + 2 (c - 20), shown with priority
// and palette 1 and XORed with DP_MENU_TEXT_XOR (a disabled row XORs palette 1 back to
// 0); the highlight swaps palettes 1 and 2. The font draws the arrow for '#'.
const FONT_FIRST_CODE = 0x20,
  MENU_TEXT_ATTRIBUTES = TILE_PRIORITY | TILE_PALETTE_STEP,
  MENU_DISABLED_XOR = TILE_PALETTE_STEP,
  MENU_HIGHLIGHT_TOGGLE = TILE_PALETTE_STEP * 3,
  MENU_BLANK_CHAR = FONT_FIRST_CODE,
  MENU_ARROW_CHAR = 0x23,
  MENU_BLINKS = 8,
  BLINK_HALF_FRAMES = 2,
  FADE_OUT_X = 0xff;
// Layout as tilemap byte offsets (40 per tile row): rows every second tile row from
// tile row 16, the arrow in column 8, the texts in column 10, the copyright in tile
// row 26, column 2; the tilemap goes to VRAM word 0800.
const MENU_FIRST_ROW = 0x400,
  MENU_ROW_STEP = 0x80,
  MENU_ROW_TILES = 0x20,
  MENU_ARROW_ROW_1 = MENU_FIRST_ROW + 0x10,
  MENU_TEXT_ROW_1 = MENU_FIRST_ROW + 0x14,
  COPYRIGHT_POSITION = 0x684,
  MENU_TILEMAP_VRAM = 0x800,
  // "RESUME GAME 1": its slot digit (12th character) for the four-slot option.
  SLOT_DIGIT = 0x31,
  SLOT_DIGIT_OFFSET = 24;
const menuRow = (row) => MENU_TEXT_ROW_1 + row * MENU_ROW_STEP;
const MUSIC_SETTING_CYCLE = SETTINGS_MUSIC_FULL * 2 + 1;
// The menu: song 2, the scene list 81:F7B5, the title colours 0-15 from 85:EBC0, the
// fade colours 16-63 start white; animation graphics into bank 7F; the music cue 2
// on APU port 2; B or Start chooses, Up moves back, Select or Down forward; the
// timeout (sooner right after the title) acts as cancel.
const SONG_START_MENU = 2,
  START_MENU_LIST = 0x81f7b5,
  TITLE_BASE_COLOURS = 0x85ebc0,
  TITLE_BASE_COLOURS_BYTES = 0x20,
  TITLE_FADE_COLOURS = TITLE_PALETTE + 0x20,
  TITLE_FADE_BYTES = 0x60,
  WRAM_HIGH_BANK = 0x7f,
  LARGE_FRAMES_PACKED = 0x87d71a,
  SMALL_FRAMES_PACKED = 0x84f9e8,
  LARGE_FRAME_GRAPHICS = 0x0018,
  SMALL_FRAME_GRAPHICS = 0x8018,
  MENU_START_CUE = 2,
  MENU_CUE_SITE = 0x81e1b6,
  MENU_CONFIRM = PAD_B | PAD_START,
  MENU_PREVIOUS = PAD_UP,
  MENU_NEXT = PAD_SELECT | PAD_DOWN,
  MENU_MOVE_SOUND = 0x2209,
  MENU_CHOOSE_SOUND = 0x2208,
  MENU_TIMEOUT = 0x960,
  MENU_TIMEOUT_AFTER_TITLE = 0x12c,
  MENU_NONE = WORD_MASK,
  MENU_CANCELLED = 0xfffe,
  MENU_ROWS = 3,
  MENU_SAVED_GAME = 1,
  MENU_OPTIONS = 2,
  MENU_CREDITS = 3,
  OPTIONS_ROWS = 4;
// The title start (81:E50C): music cue 3; a light runs down the gradient colours
// 8-15 (two frames a step, its colour growing by GRADIENT_STEP, the colour three behind
// it back to the base); the colours 16-63 fade in from white over twelve frames.
const TITLE_MUSIC_CUE = 3,
  TITLE_CUE_SITE = 0x81e510,
  CUE_BRANCH_OFFSET = 5,
  TITLE_GRADIENT = TITLE_PALETTE + 0x10,
  TITLE_GRADIENT_BYTES = 0x10,
  TITLE_GRADIENT_TAIL_BYTES = 6,
  TITLE_GRADIENT_STEP = 0x863,
  TITLE_FADE_STEPS = 12,
  TITLE_FADE_TAIL_STEP = 6,
  WORD_INDEX_MASK = 0xfe,
  DP_TITLE_COLOUR = 0x0e,
  DP_TITLE_BASE_COLOUR = 0x1e,
  FADE_SOURCE_COLOURS = 0x85ebe0,
  TITLE_LAYERS = LAYER_BG1 | LAYER_BG2 | LAYER_BG3,
  // 81:E57E: four large objects (high table bits 10), OBJSEL size 1 with name base 3.
  TITLE_OBJECT_BYTES = 16,
  TITLE_SPRITES_HIGH = 0xaa,
  // The sounds of the last two animations (frontend_sound_words) start with them.
  TITLE_START_SOUNDS = [2, 3],
  TITLE_OBJSEL = 0x23;
// The animations (81:E6AE): four of 24 frames; every eighth frame each one below its
// last frame steps on, and a random finished one restarts with a chance of 30 in
// 2048, its sound on voices 1-3, then voice 0 again. Frame graphics (81:E684,
// 81:E699): rows of eight frames of 80 bytes; the second of each pair uses frames
// 24-47; the large ones send four stripes 400 apart. Ten stripes go to the VRAM
// words of frontend_text_vram.
const ANIMATIONS = 4,
  ANIMATION_FRAMES = 24,
  ANIMATION_LAST_FRAME = ANIMATION_FRAMES - 1,
  ANIMATION_PERIOD_MASK = 7,
  ANIMATION_INDEX_MASK = 6,
  RESTART_ROLL_MASK = 0x7ff,
  RESTART_CHANCE = 0x1e,
  RESTART_VOICES = 0x0e,
  RANDOM_INCREMENT = 0xadb,
  FRAME_COLUMN_MASK = 7,
  FRAME_ROW_MASK = 0xf8,
  LARGE_STRIPES = 4,
  // Animations 2 and 3 are large; the second of each pair uses frames 24-47.
  LARGE_ANIMATIONS = [
    [2, 0],
    [3, ANIMATION_FRAMES],
  ],
  LARGE_STRIPE_STEP = 0x400,
  TITLE_STRIPES = 10,
  TITLE_STRIPE_BYTES = 0x80,
  DMA_CHANNEL_0 = 1;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const readLongWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
const writeLongWord = (mem, at, value) => {
  mem.write8(at & LONG_MASK, value & BYTE_MASK);
  mem.write8((at + 1) & LONG_MASK, (value >>> BYTE_BITS) & BYTE_MASK);
};
const swap = (value) => ((value << BYTE_BITS) | (value >>> BYTE_BITS)) & WORD_MASK;

// The menu tables of bank 81 by name (src/data/tables.mjs).
const menuTables = (mem) =>
  decodeOnce(mem, 'start-menu', (image) => {
    const tables = {};
    for (const [key, name] of [
      ['stripeVram', 'frontend_text_vram'],
      ['sounds', 'frontend_sound_words'],
      ['fadeShifts', 'frontend_text_fade_shifts'],
      ['fadeMasks', 'frontend_text_fade_masks'],
      ['objects', 'frontend_oam'],
    ]) {
      const values = tableEntries(image, name);
      tables[key] = (index) => {
        const value = values[index];
        if (value === undefined) taskStop('menu_table_index_frontier', { table: name, index });
        return value;
      };
    }
    return Object.freeze(tables);
  });

// Draw the text at the long address text (00 ends it, or its translation) from
// tilemap offset x (81:D531).
export function drawMenuText(mem, x, text) {
  const xor = word(mem.wram, DP_MENU_TEXT_XOR),
    translated = languageMenuText(mem, text);
  if (translated) x = (x + translated.shift) & WORD_MASK;
  const bank = text & ~WORD_MASK;
  for (let i = 0; ; i++) {
    const c = translated
      ? (translated.codes[i] ?? 0) & BYTE_MASK
      : mem.read8(bank | ((text + i) & WORD_MASK));
    if (c === 0) return;
    const glyph = (((c - FONT_FIRST_CODE) & WORD_MASK) << 1) & WORD_MASK;
    writeLongWord(
      mem,
      MENU_TILEMAP + x,
      (readLongWord(mem, MENU_FONT_TILES + glyph) | MENU_TEXT_ATTRIBUTES) ^ xor,
    );
    x = (x + 2) & WORD_MASK;
  }
}
// Clear the menu tilemap, draw the copyright and enable every row (81:D555).
export function clearMenuTilemap(mem) {
  beginFrontendMenu(mem);
  for (let at = MENU_TILEMAP_BYTES - 2; at >= 0; at -= 2)
    writeLongWord(mem, MENU_TILEMAP + at, MENU_TEXT_ATTRIBUTES);
  setWord(mem.wram, DP_MENU_TEXT_XOR, 0);
  drawMenuText(mem, COPYRIGHT_POSITION, TEXT_COPYRIGHT);
  mem.wram.fill(0, MENU_ROW_DISABLED, MENU_ROW_DISABLED + MENU_ROW_DISABLED_BYTES);
}
// The menu tilemap to VRAM (81:D59E).
function sendMenuTilemap(video) {
  video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
  video.write(DMAP0, DMAP_TWO_PORTS, 1);
  video.write(BBAD0, VMDATAL & BYTE_MASK, 1);
  video.write(A1T0L, MENU_TILEMAP & WORD_MASK, 2);
  video.write(A1B0, WRAM_BANK, 1);
  video.write(DAS0L, MENU_TILEMAP_BYTES, 2);
  video.write(VMADDL, MENU_TILEMAP_VRAM, 2);
  video.write(MDMAEN, DMA_CHANNEL_0, 1);
}
// The tilemap offset of the menu row of cursor plus base: the original swaps the
// bytes and halves, adding the shifted-out bit as the carry.
const rowOffset = (cursor, base) => {
  const swapped = swap(cursor);
  return ((swapped >>> 1) + base + (swapped & 1)) & WORD_MASK;
};
// Draw the character c at the arrow column of the cursor's row (81:E32F); the
// original passes it through DP_MENU_TEXT as a one-character text in the data bank.
function drawArrow(m, c, bank) {
  const { mem, wram } = m;
  setWord(wram, DP_MENU_TEXT, c);
  const x =
    (rowOffset(word(wram, DP_MENU_CURSOR), MENU_ARROW_ROW_1) + languageMenuArrowShift(mem)) &
    WORD_MASK;
  drawMenuText(mem, x, (bank << WORD_BITS) | DP_MENU_TEXT);
}
// Move the arrow to row (81:E343).
export function moveArrow(m, row, bank) {
  drawArrow(m, MENU_BLANK_CHAR, bank);
  setWord(m.wram, DP_MENU_CURSOR, row);
  drawArrow(m, MENU_ARROW_CHAR, bank);
}
// Swap palettes 1 and 2 in the cursor's row (81:E371).
export function toggleMenuHighlight(mem) {
  let x = rowOffset(word(mem.wram, DP_MENU_CURSOR), MENU_FIRST_ROW);
  for (let n = 0; n < MENU_ROW_TILES; n++, x = (x + 2) & WORD_MASK)
    writeLongWord(
      mem,
      MENU_TILEMAP + x,
      readLongWord(mem, MENU_TILEMAP + x) ^ MENU_HIGHLIGHT_TOGGLE,
    );
}

// The start menu texts (81:E38D), with the port's Credits row.
export function drawStartMenu(m) {
  const { mem } = m;
  clearMenuTilemap(mem);
  [TEXT_START_NEW_GAME, TEXT_START_SAVED_GAME, TEXT_OPTIONS].forEach((text, row) =>
    drawMenuText(mem, menuRow(row), text),
  );
  if (m.h.a.vm?.startMenuCredits) {
    const label = mem.languageData ? 'MITWIRKENDE' : 'CREDITS',
      at = menuRow(MENU_CREDITS) + languageMenuArrowShift(mem);
    for (let i = 0; i < label.length; i++) {
      const tile = readLongWord(mem, MENU_FONT_TILES + (label.charCodeAt(i) - FONT_FIRST_CODE) * 2);
      writeLongWord(mem, MENU_TILEMAP + at + i * 2, tile | MENU_TEXT_ATTRIBUTES);
    }
  }
}
// The saved games (81:E3DA): a row per slot, disabled when its checksum fails
// (valid(slot) runs the save code's 81:B1AB), then Exit. Slots 3 and 4 (four-slot
// option, src/game/save-slots.mjs) draw "RESUME GAME 1" with their own digit.
export function drawResumeMenu(m, slots, valid) {
  const { mem, wram } = m;
  clearMenuTilemap(mem);
  for (let slot = slots - 1; slot >= 0; slot--)
    if (!valid(slot)) setWord(wram, MENU_ROW_DISABLED + slot * 2, MENU_DISABLED_XOR);
  for (let slot = 0; slot < slots; slot++) {
    setWord(wram, DP_MENU_TEXT_XOR, word(wram, MENU_ROW_DISABLED + slot * 2));
    const x = menuRow(slot);
    drawMenuText(mem, x, slot === 1 ? TEXT_RESUME_GAME_2 : TEXT_RESUME_GAME_1);
    if (slot < 2) continue;
    const digit = SLOT_DIGIT + slot,
      tile =
        (readLongWord(mem, MENU_FONT_TILES + (digit - FONT_FIRST_CODE) * 2) |
          MENU_TEXT_ATTRIBUTES) ^
        word(wram, DP_MENU_TEXT_XOR),
      translated = languageMenuText(mem, TEXT_RESUME_GAME_1),
      index = translated?.slotIndex ?? translated?.codes.indexOf(SLOT_DIGIT),
      at = translated ? x + translated.shift + 2 * index : x + SLOT_DIGIT_OFFSET;
    if (!translated || index >= 0) writeLongWord(mem, MENU_TILEMAP + at, tile);
  }
  setWord(wram, DP_MENU_TEXT_XOR, 0);
  drawMenuText(mem, menuRow(slots), TEXT_EXIT);
}
// Whether the save slot passes its checksum: the save code's 81:B1AB, called as the
// original does from 81:E3E5 (zero flag set: valid).
export const validSaveSlot = (h, events, routines) => (slot) => {
  h.ctx.a = slot;
  routineCaller(h, events, routines)(SAVE_CHECKSUM_SITE, SAVE_CHECKSUM_COMPARE, true);
  return (h.ctx.status & FLAG_ZERO) !== 0;
};
// The options (81:E446): control type, output mode, music, Exit.
export function drawOptionsMenu(m) {
  const { mem } = m;
  clearMenuTilemap(mem);
  const music = mem.read8(SETTINGS_MUSIC) & SETTINGS_MUSIC_MASK;
  drawMenuText(
    mem,
    menuRow(1),
    mem.read8(SETTINGS_STEREO) & SETTINGS_STEREO_ON ? TEXT_STEREOPHONIC : TEXT_MONOPHONIC,
  );
  drawMenuText(
    mem,
    menuRow(0),
    mem.read8(SETTINGS_CONTROL) & SETTINGS_CONTROL_TYPE_A
      ? TEXT_CONTROL_TYPE_A
      : TEXT_CONTROL_TYPE_B,
  );
  drawMenuText(
    mem,
    menuRow(2),
    music === 0
      ? TEXT_MUSIC_OFF
      : music === SETTINGS_MUSIC_EVENT
        ? TEXT_MUSIC_EVENT
        : TEXT_MUSIC_FULL,
  );
  drawMenuText(mem, menuRow(OPTIONS_ROWS - 1), TEXT_OPTIONS_EXIT);
}

// The graphics source of an animation frame in bank 7F (81:E684 small, 81:E699 large).
const frameSource = (frame, large) => {
  const column = swap(frame & FRAME_COLUMN_MASK) >>> 1,
    row = swap(frame & FRAME_ROW_MASK);
  return (
    (((large ? (row << 1) & WORD_MASK : row >>> 1) | column) +
      (large ? LARGE_FRAME_GRAPHICS : SMALL_FRAME_GRAPHICS)) &
    WORD_MASK
  );
};
// The ten stripe sources of the four animations (81:E623).
export function setAnimationSources(mem) {
  const { wram } = mem,
    frame = (n) => word(wram, TITLE_ANIMATION_FRAMES + n * 2);
  let at = TITLE_STRIPE_SOURCES;
  const put = (value) => {
    writeLongWord(mem, at, value);
    at += 2;
  };
  put(frameSource(frame(0), false));
  put(frameSource((frame(1) + ANIMATION_FRAMES) & WORD_MASK, false));
  for (const [n, offset] of LARGE_ANIMATIONS) {
    let source = frameSource((frame(n) + offset) & WORD_MASK, true),
      carry = 0;
    put(source);
    for (let stripe = 1; stripe < LARGE_STRIPES; stripe++) {
      const total = source + LARGE_STRIPE_STEP + carry;
      source = total & WORD_MASK;
      carry = total >>> WORD_BITS;
      put(source);
    }
  }
}
// One step of the frontend random number (81:E788) with the carry in; returns the
// new value and the carry out.
function nextRandom(mem, carry) {
  const value =
      readLongWord(mem, FRONTEND_RANDOM) ^
      readLongWord(mem, FRONTEND_RANDOM_HIGH) ^
      word(mem.wram, FRONTEND_FRAME_COUNTER),
    total = value + RANDOM_INCREMENT + carry,
    low = total & WORD_MASK,
    rolled = ((low << 1) | (total >>> WORD_BITS)) & WORD_MASK;
  writeLongWord(mem, FRONTEND_RANDOM, low);
  writeLongWord(mem, FRONTEND_RANDOM_HIGH, rolled);
  return { value: rolled, carry: low >>> (WORD_BITS - 1) };
}

// 81:E6AE: the NMI callback of the start menu: the OAM buffer, the menu tilemap and
// the title colours; after the first frame the animation stripes, the animation
// steps, the frame count and a random restart; then the joypad. The random numbers
// take the carry of the interrupted code, as in the original.
export function handleStartMenuNmi(h) {
  const m = sceneRuntime(h),
    { mem, wram, video } = m,
    t = menuTables(mem);
  let carry = h.ctx.status & FLAG_CARRY ? 1 : 0;
  video.copyToOam(WRAM + OAM_SHADOW, OAM_BYTES);
  sendMenuTilemap(video);
  video.write(CGADD, 0, 1);
  video.write(DMAP0, 0, 1);
  video.write(BBAD0, CGDATA & BYTE_MASK, 1);
  video.write(A1T0L, TITLE_PALETTE & WORD_MASK, 2);
  video.write(A1B0, WRAM_BANK, 1);
  video.write(DAS0L, TITLE_PALETTE_BYTES, 2);
  video.write(MDMAEN, DMA_CHANNEL_0, 1);
  if (word(wram, FRONTEND_FRAME_COUNTER) !== 0) {
    video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
    video.write(DMAP0, DMAP_TWO_PORTS, 1);
    video.write(A1B0, WRAM_HIGH_BANK, 1);
    video.write(BBAD0, VMDATAL & BYTE_MASK, 1);
    for (let n = TITLE_STRIPES - 1; n >= 0; n--) {
      video.write(A1T0L, readLongWord(mem, TITLE_STRIPE_SOURCES + n * 2), 2);
      video.write(DAS0L, TITLE_STRIPE_BYTES, 2);
      video.write(VMADDL, t.stripeVram(n), 2);
      video.write(MDMAEN, DMA_CHANNEL_0, 1);
    }
    if ((word(wram, FRONTEND_FRAME_COUNTER) & ANIMATION_PERIOD_MASK) === 0) {
      for (let n = ANIMATIONS - 1; n >= 0; n--) {
        const at = TITLE_ANIMATION_FRAMES + n * 2,
          frame = word(wram, at);
        if (frame === ANIMATION_LAST_FRAME) carry = 1;
        else {
          setWord(wram, at, frame + 1);
          carry = frame === WORD_MASK ? 1 : 0;
        }
      }
      setAnimationSources(mem);
    }
    setWord(wram, FRONTEND_FRAME_COUNTER, word(wram, FRONTEND_FRAME_COUNTER) + 1);
    const first = nextRandom(mem, carry),
      index = first.value & ANIMATION_INDEX_MASK,
      at = TITLE_ANIMATION_FRAMES + index;
    if (word(wram, at) === ANIMATION_LAST_FRAME) {
      // CMP equal leaves the carry set for the second number.
      const roll = nextRandom(mem, 1).value & RESTART_ROLL_MASK;
      if (roll < RESTART_CHANCE) {
        setWord(wram, at, 0);
        m.sound(APU_COMMAND_SOUND_VOICES, RESTART_VOICES);
        m.sound(APU_COMMAND_SOUND_VOLUME, t.sounds(index >>> 1));
        m.sound(APU_COMMAND_SOUND_VOICES, 1);
      }
    }
  }
  setWord(wram, PAD_HELD, readJoypad(m.port));
  return h.rtl();
}

// One fade step of the title colours 16-63 from white (81:E5DB).
export function fadeTitleColours(mem, step) {
  const t = menuTables(mem),
    entry = step >>> 1,
    shift = t.fadeShifts(entry),
    mask = t.fadeMasks(entry);
  for (let at = TITLE_FADE_BYTES - 2; at >= 0; at -= 2) {
    // LSR shift times on a 16-bit word.
    const colour =
      shift >= WORD_BITS
        ? 0
        : ((readLongWord(mem, FADE_SOURCE_COLOURS + at) ^ COLOUR_MASK) & mask) >>> shift;
    writeLongWord(mem, TITLE_FADE_COLOURS + at, colour ^ COLOUR_MASK);
  }
}
// The title objects (81:E57E): four large objects, the animations at their first
// frame with two sounds, OBJSEL and the main screen with objects.
function showTitleObjects(m) {
  const { mem, wram, video } = m,
    t = menuTables(mem);
  for (let n = 0; n < TITLE_OBJECT_BYTES; n++) wram[OAM_SHADOW + n] = t.objects(n);
  setWord(wram, OAM_SHADOW_HIGH, TITLE_SPRITES_HIGH);
  for (let n = 0; n < ANIMATIONS; n++) setWord(wram, TITLE_ANIMATION_FRAMES + n * 2, 0);
  for (const n of TITLE_START_SOUNDS) m.sound(APU_COMMAND_SOUND_VOLUME, t.sounds(n));
  setAnimationSources(mem);
  video.write(OBJSEL, TITLE_OBJSEL, 1);
  video.write(TM, TITLE_LAYERS | LAYER_OBJ, 1);
  // An 8-bit INC: only the low byte of the frame counter counts.
  wram[FRONTEND_FRAME_COUNTER] = (wram[FRONTEND_FRAME_COUNTER] + 1) & BYTE_MASK;
}

// 81:E14A: the start menu. h is the accessor of the native call from the title
// cycle 80:A18C, A nonzero right after the title (the shorter timeout).
export function* startMenuSequence(h, events, routines) {
  const { ctx } = h,
    status = ctx.status,
    afterTitle = ctx.a !== 0,
    call = (site, target) => nativeCallSequence(h, events, routines, site, target, true),
    lifted = lagFree(events);
  ctx.status &= ~(FLAG_MEMORY_8BIT | FLAG_INDEX_8BIT);
  let m;
  const wait = () => (lifted ? waitForFrame(h, events, m.port) : call(CALL_SITE, WAIT_FRAME)),
    input = lifted ? () => [() => takePadPresses(m.wram)] : () => call(CALL_SITE, READ_INPUT),
    cursor = () => word(m.wram, DP_MENU_CURSOR),
    pressed = () => word(m.wram, PAD_PRESSED);
  // The music cue: LDA 2142 / CMP #cue / BNE until the sound driver's port 2 shows it.
  const cue = function* (site, value) {
    for (;;) {
      let port;
      yield () => (port = m.port.read(APUIO2, 1, site));
      if (port === value) return;
      if (!lifted) continue;
      const difference = (port - value) & BYTE_MASK,
        after =
          ((ctx.status | FLAG_MEMORY_8BIT) & ~(FLAG_NEGATIVE | FLAG_ZERO | FLAG_CARRY)) |
          (port >= value ? FLAG_CARRY : 0) |
          (difference & BYTE_SIGN ? FLAG_NEGATIVE : 0);
      yield* nmiAtBranch(h, events, site + CUE_BRANCH_OFFSET, after);
    }
  };
  // The menu draws in data bank 81 (81:E38D), which the arrow text uses.
  const menuBank = () => ctx.bank;
  const disabled = () => word(m.wram, MENU_ROW_DISABLED + ((cursor() << 1) & WORD_MASK)) !== 0;
  const next = (rows) =>
    moveArrow(
      m,
      ((cursor() === ((rows - 1) & WORD_MASK) ? WORD_MASK : cursor()) + 1) & WORD_MASK,
      menuBank(),
    );
  // Choose a row of rows (81:E29F): the cursor, or FFFF after the timeout.
  const choose = function* (rows) {
    yield () => {
      drawArrow(m, MENU_ARROW_CHAR, menuBank());
      while (disabled()) next(rows);
    };
    for (;;) {
      yield* wait();
      const timeout = (word(m.wram, DP_MENU_TIMEOUT) - 1) & WORD_MASK;
      setWord(m.wram, DP_MENU_TIMEOUT, timeout);
      if (timeout === 0 || creditsRequested(h.a.vm)) {
        markStartMenu(h.a.vm, false);
        setWord(m.wram, DP_MENU_CURSOR, MENU_NONE);
        return;
      }
      markStartMenu(h.a.vm, true);
      yield* input();
      if (pressed() & MENU_CONFIRM) break;
      yield () => {
        if (pressed() & MENU_PREVIOUS) {
          m.sound(APU_COMMAND_SOUND_VOLUME, MENU_MOVE_SOUND);
          setWord(m.wram, DP_MENU_TIMEOUT, MENU_TIMEOUT);
          do moveArrow(m, ((cursor() === 0 ? rows : cursor()) - 1) & WORD_MASK, menuBank());
          while (disabled());
        }
        if (pressed() & MENU_NEXT) {
          m.sound(APU_COMMAND_SOUND_VOLUME, MENU_MOVE_SOUND);
          setWord(m.wram, DP_MENU_TIMEOUT, MENU_TIMEOUT);
          do next(rows);
          while (disabled());
        }
      };
    }
    yield () => {
      markStartMenu(h.a.vm, false);
      drawArrow(m, MENU_BLANK_CHAR, menuBank());
      m.sound(APU_COMMAND_SOUND_VOLUME, MENU_CHOOSE_SOUND);
    };
  };
  // Blink the chosen row (81:E354).
  const blink = function* () {
    for (let n = MENU_BLINKS; n > 0; n--) {
      setWord(m.wram, DP_MENU_TEXT, n);
      for (let f = 0; f < BLINK_HALF_FRAMES; f++) yield* wait();
      yield () => toggleMenuHighlight(m.mem);
      for (let f = 0; f < BLINK_HALF_FRAMES; f++) yield* wait();
    }
    setWord(m.wram, DP_MENU_TEXT, 0);
  };
  const finish = function* (result) {
    yield () => m.sound(APU_COMMAND_VOLUME_TARGET, 0);
    yield* fadeOut(m.video, wait);
    let out;
    yield () => {
      disableNmi(m.wram, m.port);
      ctx.a = result;
      // The 8-bit fade out of the original leaves X at FF and clears the high byte
      // of Y; the attract game behind a cancelled menu reads them.
      ctx.x = FADE_OUT_X;
      ctx.y &= BYTE_MASK;
      ctx.status = status;
      out = h.rtl();
    };
    return out;
  };

  yield () => {
    m = sceneRuntime(h);
    const { mem, wram, video, port } = m;
    m.sound(APU_COMMAND_VOLUME_TARGET, APU_FULL_VOLUME);
    startSong(mem, port, SONG_START_MENU);
    startSceneScreen(wram, video, port);
    clearIntroObjects(wram);
    setSceneScreen(video);
    runSceneList(mem, video, port, START_MENU_LIST);
    enableNmiAndJoypad(wram, port);
    clearMenuTilemap(mem);
    for (let at = TITLE_FADE_BYTES - 2; at >= 0; at -= 2)
      writeLongWord(mem, TITLE_FADE_COLOURS + at, COLOUR_MASK);
    for (let at = TITLE_BASE_COLOURS_BYTES - 2; at >= 0; at -= 2)
      writeLongWord(mem, TITLE_PALETTE + at, readLongWord(mem, TITLE_BASE_COLOURS + at));
    unpack(mem, LARGE_FRAMES_PACKED, WRAM_HIGH_BANK, LARGE_FRAME_GRAPHICS);
    unpack(mem, SMALL_FRAMES_PACKED, WRAM_HIGH_BANK, SMALL_FRAME_GRAPHICS);
  };
  yield* cue(MENU_CUE_SITE, MENU_START_CUE);
  yield* fadeIn(m.video, wait);
  yield* titleStart();
  yield () => {
    setWord(m.wram, DP_MENU_TIMEOUT, afterTitle ? MENU_TIMEOUT_AFTER_TITLE : MENU_TIMEOUT);
  };
  for (;;) {
    yield () => {
      ctx.bank = FRONTEND_BANK;
      drawStartMenu(m);
      setWord(m.wram, DP_MENU_CURSOR, 0);
    };
    const rows = h.a.vm?.startMenuCredits ? MENU_ROWS + 1 : MENU_ROWS;
    yield* choose(rows);
    yield () => setWord(m.wram, DP_MENU_CHOICE, MENU_NONE);
    const row = cursor();
    if (row === 0) {
      yield* blink();
      return yield* finish(word(m.wram, DP_MENU_CHOICE));
    }
    if (row & WORD_SIGN) return yield* finish(MENU_CANCELLED);
    if (row === MENU_SAVED_GAME) {
      const slots = saveSlotCount(h.a);
      yield () => {
        drawResumeMenu(m, slots, validSaveSlot(h, events, routines));
        setWord(m.wram, DP_MENU_CURSOR, 0);
      };
      yield* choose(slots + 1);
      const slot = cursor();
      if (slot & WORD_SIGN) return yield* finish(MENU_CANCELLED);
      if (slot === slots) continue;
      yield () => setWord(m.wram, DP_MENU_CHOICE, slot);
      yield* blink();
      return yield* finish(slot);
    }
    if (h.a.vm?.startMenuCredits && row === MENU_CREDITS) {
      requestCredits(h.a.vm);
      return yield* finish(MENU_CANCELLED);
    }
    if (row !== MENU_OPTIONS) continue;
    yield () => setWord(m.wram, DP_MENU_CURSOR, 0);
    for (;;) {
      yield () => {
        storeSettingsChecksum(m.mem);
        sendOutputMode(m);
        drawOptionsMenu(m);
      };
      yield* choose(OPTIONS_ROWS);
      const option = cursor();
      if (option & WORD_SIGN) return yield* finish(MENU_CANCELLED);
      if (option === OPTIONS_ROWS - 1) break;
      yield () => {
        const { mem } = m;
        if (option === 0)
          mem.write8(
            SETTINGS_CONTROL,
            (mem.read8(SETTINGS_CONTROL) ^ SETTINGS_CONTROL_TYPE_A) & SETTINGS_CONTROL_TYPE_A,
          );
        else if (option === 1)
          mem.write8(
            SETTINGS_STEREO,
            (mem.read8(SETTINGS_STEREO) ^ SETTINGS_STEREO_ON) & SETTINGS_STEREO_ON,
          );
        else mem.write8(SETTINGS_MUSIC, (mem.read8(SETTINGS_MUSIC) || MUSIC_SETTING_CYCLE) >>> 1);
      };
    }
  }

  // 81:E50C: the title start after the music cue.
  function* titleStart() {
    ctx.bank = FRONTEND_BANK;
    yield* cue(TITLE_CUE_SITE, TITLE_MUSIC_CUE);
    const { mem, wram } = m,
      gradient = (at, value) => writeLongWord(mem, TITLE_GRADIENT + at, value);
    yield () => {
      const colour = readLongWord(mem, TITLE_GRADIENT);
      setWord(wram, DP_TITLE_COLOUR, colour);
      setWord(wram, DP_TITLE_BASE_COLOUR, colour);
    };
    for (let at = TITLE_GRADIENT_BYTES - 2; at >= 0; at -= 2) {
      yield* wait();
      yield* wait();
      yield () => {
        if (at < TITLE_GRADIENT_BYTES - TITLE_GRADIENT_TAIL_BYTES)
          gradient(at + TITLE_GRADIENT_TAIL_BYTES, word(wram, DP_TITLE_BASE_COLOUR));
        const colour = (word(wram, DP_TITLE_COLOUR) + TITLE_GRADIENT_STEP) & WORD_MASK;
        setWord(wram, DP_TITLE_COLOUR, colour);
        gradient(at, colour);
      };
    }
    for (let step = 0; step < TITLE_FADE_STEPS; step++) {
      yield* wait();
      yield () => {
        fadeTitleColours(mem, step);
        if (step >= TITLE_FADE_TAIL_STEP)
          gradient(
            (((step - TITLE_FADE_TAIL_STEP) & WORD_INDEX_MASK) ^ TITLE_GRADIENT_TAIL_BYTES) - 2,
            word(wram, DP_TITLE_BASE_COLOUR),
          );
        m.video.write(TM, TITLE_LAYERS, 1);
      };
    }
    yield* wait();
    yield () => showTitleObjects(m);
  }
}
