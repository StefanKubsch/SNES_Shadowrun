// The matrix scene (lifted from 81:C3CA, 81:C029, 81:BFD8-C028 and the NMI callback
// 81:BEC3). The scene is a generator: it pauses at every frame wait so the live game
// can show the frame; the other matrix code is plain functions in matrix-world.mjs
// and matrix-text.mjs. Routines shared with other scenes (frame wait, unpacking,
// fades, sound, input) are still the register-level versions, reached through
// nativeCallSequence with their register inputs.
import { taskStop } from '../task/plan.mjs';
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { entryOf } from './matrix-tables.mjs';
import { readJoypad, takePadPresses } from '../system/joypad.mjs';
import {
  longWord,
  matrixRuntime,
  sendVramCopies,
  setLongWord,
  setWord,
  word,
} from './matrix-runtime.mjs';
import {
  BG3_MAP_VRAM,
  GAME_TEXT_COLUMNS,
  GAME_TEXT_LINES,
  clearTextMap,
  queueSystemMessages,
  queueText,
  resetTextWindow,
  typeText,
  updateGauges,
} from './matrix-text.mjs';
import {
  MAP_BANK,
  MATRIX_MAP_VRAM,
  drawObjects,
  openNodeGates,
  placePersonaAtStart,
  readNodeAhead,
  removeFinishedObjects,
  resetObjects,
  stepPersona,
  uploadMap,
  useNodeAhead,
} from './matrix-world.mjs';
import {
  DECKER_DATA_BITS,
  DECKER_DOWNLOAD_BITS,
  DECKER_HEALTH,
  DECKER_MEMORY,
  MATRIX_ANIMATION,
  MATRIX_ANIMATION_CLOCK,
  MATRIX_ANIMATION_SPEED,
  MATRIX_ANIMATION_STEP,
  MATRIX_COLOUR_CYCLE_A,
  MATRIX_COLOUR_CYCLE_B,
  MATRIX_CPU_BITS,
  MATRIX_DATA_BITS,
  MATRIX_DEATH_COUNTER,
  MATRIX_DIRECTION,
  MATRIX_DMA_END,
  MATRIX_DMA_RECORDS,
  MATRIX_DOWNLOAD_BITS,
  MATRIX_EXTRA_NODES,
  MATRIX_FAR_SCROLL_X,
  MATRIX_FAR_SCROLL_Y,
  MATRIX_HEALTH,
  MATRIX_IC_TEXT_BUFFER,
  MATRIX_MAP,
  MATRIX_MAP_EDIT,
  MATRIX_MEMORY,
  MATRIX_MEMORY_LIMIT,
  MATRIX_MEMORY_SHOWN,
  MATRIX_MESSAGES,
  MATRIX_OBJECT_TYPE,
  MATRIX_PERSONA_X,
  MATRIX_PERSONA_Y,
  MATRIX_SCROLL_X,
  MATRIX_SCROLL_Y,
  MATRIX_SPEED_X,
  MATRIX_SPEED_Y,
  MATRIX_STATE,
  MATRIX_STATE_CLOCK,
  MATRIX_STATE_FRAMES,
  MATRIX_SYSTEM,
  MATRIX_TEXT_COLUMNS,
  MATRIX_TEXT_CURSOR,
  MATRIX_TEXT_CURSOR_SHOWN,
  MATRIX_TEXT_LINES,
  MATRIX_TEXT_SCROLL,
  OAM_SHADOW,
  PAD_HELD,
  PAD_PRESSED,
  PAD_X,
  RANDOM_STATE,
  WRAM,
} from '../task/wram.mjs';
import { BG3SC, BG3VOFS } from '../constants/hardware-registers.mjs';
import {
  CGADSUB_BACKDROP,
  CGSWSEL_SUB_SCREEN,
  COLDATA_BLUE,
  COLDATA_GREEN,
  COLDATA_RED,
  COLOUR_COMPONENT_MASK,
  DMAP_WRITE_TWICE,
  HDMA_LINE_COUNT_MASK,
  LAYER_BG1,
  LAYER_BG2,
  LAYER_BG3,
  LAYER_BG4,
  LAYER_OBJ,
  OAM_BYTES,
} from '../constants/ppu.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
import { enableNmiAndJoypad, startSceneScreen } from '../system/nmi.mjs';
import { unpack } from '../system/unpack.mjs';
import { runSceneList } from '../system/scene-list.mjs';
import { setMusicMode } from '../apu/music-mode.mjs';
import { fadeIn, fadeOut } from '../video/fades.mjs';
import { waitForFrame } from '../system/frame-wait.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// The register-level frame wait, for recorded interrupt observations.
const WAIT_FRAME = 0x81eebb,
  // Return address of these calls: the matrix entry. Nothing reads it.
  BRIDGE_SITE = 0x81c3ca;
// Audio mode 8, the register list 81:CDB2 (it also installs the NMI callback), and the
// packed streams (src/data/lz-streams.mjs) into bank 7F: the text characters to
// 7F:0000, the back map to 7F:0216 (VRAM 2400), the 16 system maps (800 bytes each)
// and one more map to 7F:8216.
const MATRIX_AUDIO_MODE = 8,
  MATRIX_LIST = 0x81cdb2,
  TEXT_CHARACTERS_STREAM = 0x85fd38,
  BACK_MAP_STREAM = 0x89ec1b,
  SYSTEM_MAPS_STREAM = 0x89e14e,
  EXTRA_MAP_STREAM = 0x89eb4b,
  MAP_BUFFER = 0x216,
  EXTRA_MAP_BUFFER = 0x8216,
  MATRIX_BACK_MAP_VRAM = 0x2400,
  SYSTEM_MAP_SHIFT = 11;
// X jacks out: the persona leaves the grid (position 8000) and 60 frames run on.
const TEXT_JACKED_OUT = 0x81c61c,
  JACKED_OUT = 0x8000,
  JACK_OUT_FRAMES = 0x3c;
// Screen set-up (81:C029): H-DMA channel 6 switches BG3SC from the table 81:C101,
// channel 5 the BG3 scroll from 7F:0150 (6 lines, 44 lines of the message window,
// the rest). The persona starts as object 1 facing right with the animation 81:BE71.
const BG3_MAP_TABLE = 0x81c101,
  SCROLL_TABLE = 0x7f0150,
  HDMA_ENTRY_BYTES = 3,
  WINDOW_SCROLL = SCROLL_TABLE + HDMA_ENTRY_BYTES + 1,
  SCROLL_TABLE_BYTES = 10,
  TOP_LINES = 6,
  WINDOW_LINES = 0x44,
  SCROLL_CHANNEL = 5,
  MAP_CHANNEL = 6,
  STATE_START = 2,
  PERSONA_KIND = 1,
  PERSONA_ANIMATION = 0x81be71,
  PERSONA_ANIMATION_SPEED = 8,
  DIRECTION_RIGHT = 4,
  GREETING = 0x81c62e,
  // "FOUND X IC!", copied for the count digit.
  IC_TEXT_TEMPLATE = 0x81c60d,
  IC_TEXT_BYTES = 0x10;
// Colour math: all layers and the backdrop for the fades, then BG1, BG2 and OBJ on the
// main screen with BG3 added from the sub screen.
const ALL_LAYERS = LAYER_BG1 | LAYER_BG2 | LAYER_BG3 | LAYER_BG4 | LAYER_OBJ | CGADSUB_BACKDROP,
  MAIN_LAYERS = LAYER_BG1 | LAYER_BG2 | LAYER_OBJ,
  MATRIX_LAYERS = MAIN_LAYERS | CGADSUB_BACKDROP,
  COLDATA_ALL = COLDATA_RED | COLDATA_GREEN | COLDATA_BLUE,
  COLOUR_LEVELS = COLOUR_COMPONENT_MASK + 1;
// NMI: BG3 colour 1 of palettes 0 and 1 half and full green, colour 0 black; the blink
// colours (m.tables.blinkColours) go to colours 9 and 13 every 16 and 8 frames; the BG3 row that
// scrolls in next (232 lines below the scroll) is cleared; the text cursor is tile 02
// with palette 3 and priority.
const GREEN_HALF = 0x01e0,
  GREEN_FULL = 0x03e0,
  PALETTE_1_TEXT = 5,
  BLINK_INDEX_MASK = 3,
  BLINK_A_FRAMES_MASK = 15,
  BLINK_B_FRAMES_MASK = 7,
  BLINK_A_COLOUR = 9,
  BLINK_B_COLOUR = 13,
  NEXT_ROW_LINES = 0xe8,
  ROW_LINE_MASK = 0xf8,
  ROW_LINE_TO_VRAM_SHIFT = 2,
  ROW_WORDS = 0x20,
  CURSOR_TILE = 0x2c02,
  TEXT_LAYER = 3,
  NEAR_LAYER = 1,
  FAR_LAYER = 2;

function requireWideRegisters(ctx) {
  if (ctx.status & (FLAG_MEMORY_8BIT | FLAG_INDEX_8BIT)) taskStop('matrix_wide_registers_required');
}
const shared = (h, events, routines, target, long = true) =>
  nativeCallSequence(h, events, routines, BRIDGE_SITE, target, long);

// Fade to white by colour addition, one level per frame (81:BFD8).
function* fadeToWhite(m, wait) {
  m.video.setColourSelect(0);
  m.video.setColourMathLayers(ALL_LAYERS);
  for (let level = 0; level < COLOUR_LEVELS; level++) {
    yield* wait();
    yield () => m.video.setFixedColour(level | COLDATA_ALL);
  }
}
// Fade back from white and set the matrix layers and colour math (81:BFF8).
function* fadeFromWhite(m, wait) {
  const { video } = m;
  video.setMainLayers(MAIN_LAYERS);
  for (let level = COLOUR_COMPONENT_MASK; level >= 0; level--) {
    yield* wait();
    yield () => video.setFixedColour(level | COLDATA_ALL);
  }
  yield () => {
    video.setSubLayers(LAYER_BG3);
    video.setMainLayers(MATRIX_LAYERS);
    video.setColourMathLayers(MATRIX_LAYERS);
    video.setColourSelect(CGSWSEL_SUB_SCREEN);
    video.setFixedColour(COLDATA_ALL);
  };
}
// The message window split, the persona at its start, the greeting, the IC text and
// both gauges (81:C029).
function* setUpScreen(m, wait) {
  yield () => {
    const { mem, wram, video } = m;
    video.setUpHdma(MAP_CHANNEL, 0, BG3SC, BG3_MAP_TABLE);
    video.setUpHdma(SCROLL_CHANNEL, DMAP_WRITE_TWICE, BG3VOFS, SCROLL_TABLE);
    const table = [TOP_LINES, 0, 0, WINDOW_LINES, 0, 0, HDMA_LINE_COUNT_MASK, 0, 0, 0];
    for (let n = 0; n < SCROLL_TABLE_BYTES; n++) mem.write8(SCROLL_TABLE + n, table[n]);
    video.enableHdma((1 << SCROLL_CHANNEL) | (1 << MAP_CHANNEL));
    setWord(wram, MATRIX_SCROLL_Y, 0);
    setWord(wram, MATRIX_SCROLL_X, 0);
    setWord(wram, MATRIX_STATE_CLOCK, 1);
    setWord(wram, MATRIX_STATE_FRAMES, 1);
    setWord(wram, MATRIX_STATE, STATE_START);
    setWord(wram, MATRIX_OBJECT_TYPE, PERSONA_KIND);
    setWord(wram, MATRIX_ANIMATION, PERSONA_ANIMATION & WORD_MASK);
    setWord(wram, MATRIX_ANIMATION_STEP, 0);
    setWord(wram, MATRIX_ANIMATION_CLOCK, 1);
    setWord(wram, MATRIX_ANIMATION_SPEED, PERSONA_ANIMATION_SPEED);
    setWord(wram, MATRIX_DIRECTION, DIRECTION_RIGHT);
    setWord(wram, MATRIX_SPEED_X, 0);
    setWord(wram, MATRIX_SPEED_Y, 0);
    placePersonaAtStart(m);
    setWord(wram, MATRIX_MAP_EDIT, 0);
    resetTextWindow(m);
    setWord(wram, MATRIX_TEXT_LINES, GAME_TEXT_LINES);
    setWord(wram, MATRIX_TEXT_COLUMNS, GAME_TEXT_COLUMNS);
    queueText(m, GREETING);
    for (let n = 0; n < IC_TEXT_BYTES; n += 2)
      setLongWord(mem, MATRIX_IC_TEXT_BUFFER + n, longWord(mem, IC_TEXT_TEMPLATE + n));
  };
  yield* wait();
  yield () => {
    clearTextMap(m);
    updateGauges(m);
  };
}

// 81:C3CA: play the matrix until the decker jacks out or the health runs out. h is
// the accessor of the native call from the main loop (80:CC4B).
export function* matrixSceneSequence(h, events, routines) {
  const { ctx } = h,
    call = (target, long) => shared(h, events, routines, target, long),
    // The lifted frame wait takes its NMI from the lag-free frame model; recorded
    // interrupt observations keep the register-level wait.
    wait = () => (lagFree(events) ? waitForFrame(h, events, m.port) : call(WAIT_FRAME));
  let m, more;
  // Entered by JSL from the scene request of the main loop (80:CC4B) with 16-bit registers;
  // the scene changes neither the status nor the data bank it returns with.
  yield () => {
    requireWideRegisters(ctx);
    m = matrixRuntime(h);
  };
  yield () => startSceneScreen(m.wram, m.video, m.port);
  yield () => setMusicMode(m.mem, m.port, MATRIX_AUDIO_MODE);
  yield () => {
    setWord(m.wram, MATRIX_DMA_END, 0);
    setWord(m.wram, MATRIX_DMA_RECORDS, 0);
    runSceneList(m.mem, m.video, m.port, MATRIX_LIST);
  };
  for (const [stream, target] of [
    [TEXT_CHARACTERS_STREAM, 0],
    [BACK_MAP_STREAM, MAP_BUFFER],
    [SYSTEM_MAPS_STREAM, MAP_BUFFER],
    [EXTRA_MAP_STREAM, EXTRA_MAP_BUFFER],
  ]) {
    yield () => unpack(m.mem, stream, MAP_BANK, target);
    if (stream === BACK_MAP_STREAM)
      yield () => uploadMap(m, (MAP_BANK << WORD_BITS) | MAP_BUFFER, MATRIX_BACK_MAP_VRAM);
  }
  yield () => {
    const { wram } = m,
      system = wram[MATRIX_SYSTEM];
    // The original adds with the carry its shifts leave (bit 5 of the system number).
    const carry = (system >>> (WORD_BITS - SYSTEM_MAP_SHIFT)) & 1;
    setWord(wram, MATRIX_MAP, (system << SYSTEM_MAP_SHIFT) + MAP_BUFFER + carry);
    uploadMap(m, (MAP_BANK << WORD_BITS) | word(wram, MATRIX_MAP), MATRIX_MAP_VRAM);
    resetTextWindow(m);
    queueSystemMessages(m);
  };
  yield () => enableNmiAndJoypad(m.wram, m.port);
  yield* fadeIn(m.video, wait);
  do {
    yield* wait();
    yield () => (more = typeText(m));
  } while (more);
  let messages;
  yield () => {
    const { wram } = m;
    setWord(wram, MATRIX_HEALTH, wram[DECKER_HEALTH]);
    for (const at of [MATRIX_DEATH_COUNTER, MATRIX_MEMORY_SHOWN, MATRIX_MEMORY])
      setWord(wram, at, 0);
    setWord(wram, MATRIX_MEMORY_LIMIT, wram[DECKER_MEMORY]);
    for (const at of [MATRIX_DATA_BITS, MATRIX_CPU_BITS, MATRIX_DOWNLOAD_BITS])
      setWord(wram, at, 0);
    // Without messages (the datajack path) the grid is never shown.
    messages = wram[MATRIX_MESSAGES];
  };
  if (messages !== 0) {
    yield* fadeToWhite(m, wait);
    yield () => resetObjects(m);
    yield* setUpScreen(m, wait);
    yield () => {
      openNodeGates(m, word(m.wram, MATRIX_EXTRA_NODES));
      scrollToPersona(m);
      drawObjects(m);
    };
    yield* fadeFromWhite(m, wait);
    let jackOut = false,
      alive = true;
    do {
      yield* wait();
      yield () => {
        const { wram } = m;
        takePadPresses(wram);
        updateGauges(m);
        typeText(m);
        scrollToPersona(m);
        stepPersona(m);
        useNodeAhead(m);
        readNodeAhead(m);
        removeFinishedObjects(m);
        drawObjects(m);
        jackOut = (word(wram, PAD_PRESSED) & PAD_X) !== 0;
        alive = word(wram, MATRIX_DEATH_COUNTER) !== 0;
      };
    } while (!jackOut && alive);
    yield () => {
      queueText(m, TEXT_JACKED_OUT);
      setWord(m.wram, MATRIX_PERSONA_X, JACKED_OUT);
      setWord(m.wram, MATRIX_PERSONA_Y, JACKED_OUT);
    };
    for (let frame = 0; frame < JACK_OUT_FRAMES; frame++) {
      yield* wait();
      yield () => {
        updateGauges(m);
        typeText(m);
        removeFinishedObjects(m);
        drawObjects(m);
      };
    }
  }
  yield* fadeOut(m.video, wait);
  let result;
  yield () => {
    const { wram } = m;
    wram[DECKER_HEALTH] = wram[MATRIX_HEALTH];
    wram[DECKER_DATA_BITS] = wram[MATRIX_DATA_BITS];
    wram[DECKER_DOWNLOAD_BITS] = wram[MATRIX_DOWNLOAD_BITS];
    result = h.rtl();
  };
  return result;
}

// Keep the persona inside the screen columns and rows 60 to 90 (81:B84A).
const SCROLL_LOW = 0x60,
  SCROLL_HIGH = 0x91;
function scrollToPersona(m) {
  const { wram } = m;
  for (const [position, scroll] of [
    [MATRIX_PERSONA_X, MATRIX_SCROLL_X],
    [MATRIX_PERSONA_Y, MATRIX_SCROLL_Y],
  ]) {
    const screen = (word(wram, position) - word(wram, scroll)) & WORD_MASK;
    let shift = 0;
    if (screen < SCROLL_LOW) shift = screen - SCROLL_LOW;
    if (screen >= SCROLL_HIGH) shift = screen - SCROLL_HIGH;
    setWord(wram, scroll, word(wram, scroll) + shift);
  }
}

// 81:BEC3: the matrix NMI callback: sprites, colours, blink, scroll, the message row,
// the queued VRAM copies and the text cursor, then the joypad.
export function handleMatrixNmi(h) {
  requireWideRegisters(h.ctx);
  const m = matrixRuntime(h),
    { mem, wram, video } = m;
  video.copyToOam(WRAM + OAM_SHADOW, OAM_BYTES);
  setWord(wram, MATRIX_FAR_SCROLL_X, word(wram, MATRIX_SCROLL_X) >>> 1);
  setWord(wram, MATRIX_FAR_SCROLL_Y, word(wram, MATRIX_SCROLL_Y) >>> 1);
  video.setColours(0, 0, GREEN_HALF);
  video.setColours(PALETTE_1_TEXT, GREEN_FULL);
  const textScroll = word(wram, MATRIX_TEXT_SCROLL);
  video.setVerticalScroll(TEXT_LAYER, textScroll);
  mem.write8(WINDOW_SCROLL, textScroll & BYTE_MASK);
  mem.write8(WINDOW_SCROLL + 1, textScroll >>> BYTE_BITS);
  video.setScroll(NEAR_LAYER, word(wram, MATRIX_SCROLL_X), word(wram, MATRIX_SCROLL_Y));
  video.setScroll(FAR_LAYER, word(wram, MATRIX_FAR_SCROLL_X), word(wram, MATRIX_FAR_SCROLL_Y));
  const frame = word(wram, RANDOM_STATE);
  for (const [mask, cycle, colour] of [
    [BLINK_A_FRAMES_MASK, MATRIX_COLOUR_CYCLE_A, BLINK_A_COLOUR],
    [BLINK_B_FRAMES_MASK, MATRIX_COLOUR_CYCLE_B, BLINK_B_COLOUR],
  ]) {
    if (frame & mask) continue;
    const step = word(wram, cycle);
    video.setColours(colour, m.tables.blinkColours(entryOf(step)));
    setWord(wram, cycle, (step + 2) & BLINK_INDEX_MASK);
  }
  const row =
    ((((textScroll + NEXT_ROW_LINES) & ROW_LINE_MASK) << ROW_LINE_TO_VRAM_SHIFT) | BG3_MAP_VRAM) &
    WORD_MASK;
  video.fillVramWords(row, 0, ROW_WORDS);
  video.setVramWord(word(wram, MATRIX_TEXT_CURSOR_SHOWN), 0);
  sendVramCopies(wram, video);
  const cursor = word(wram, MATRIX_TEXT_CURSOR);
  setWord(wram, MATRIX_TEXT_CURSOR_SHOWN, cursor);
  video.setVramWord(cursor, CURSOR_TILE);
  setWord(wram, PAD_HELD, readJoypad(m.port));
  return h.rtl();
}
