// Matrix message window and gauges (lifted from 81:B228-B4B8 and 81:C39F).
// Texts wait in a ring of eight entries and are typed one character per delay
// into a BG3 row that the NMI copies to VRAM; edited language texts replace the
// cartridge bytes of an entry (src/data/matrix-text-edits.mjs).
import { taskStop } from '../task/plan.mjs';
import { VmFault } from '../vm/memory.mjs';
import { MATRIX_COUNT_TEXT } from '../data/matrix-text-edits.mjs';
import { longWord, queueVramCopy, setLongWord, setWord, word } from './matrix-runtime.mjs';
import {
  MATRIX_COLOUR_CYCLE_A,
  MATRIX_COLOUR_CYCLE_B,
  MATRIX_DEATH_COUNTER,
  MATRIX_DMA_RECORDS,
  MATRIX_HEALTH,
  MATRIX_IC_TEXT_BUFFER,
  MATRIX_IC_TEXT_COUNT,
  MATRIX_IC_TEXT_END,
  MATRIX_MEMORY,
  MATRIX_MEMORY_SHOWN,
  MATRIX_MESSAGES,
  MATRIX_TEXT_BUSY,
  MATRIX_TEXT_COLUMNS,
  MATRIX_TEXT_COUNT,
  MATRIX_TEXT_CURSOR,
  MATRIX_TEXT_CURSOR_SHOWN,
  MATRIX_TEXT_DELAY,
  MATRIX_TEXT_FILL,
  MATRIX_TEXT_LINE,
  MATRIX_TEXT_LINES,
  MATRIX_TEXT_PALETTE,
  MATRIX_TEXT_QUEUE,
  MATRIX_TEXT_QUEUE_BANK,
  MATRIX_TEXT_QUEUE_END,
  MATRIX_TEXT_QUEUE_START,
  MATRIX_TEXT_SCROLL,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import {
  SCREEN_MAP_BYTES,
  TILE_H_FLIP,
  TILE_PALETTE_STEP,
  TILE_PRIORITY,
  TILE_SIZE,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../constants/ppu.mjs';

// Text ring: eight entries of four bytes (address word, bank word). The current
// text pointer stays in the direct page (7E:0034-0036) between frames.
const QUEUE_ENTRY_BYTES = 4,
  QUEUE_ENTRIES = 8,
  QUEUE_BYTES = QUEUE_ENTRY_BYTES * QUEUE_ENTRIES,
  TEXT_POINTER = 0x34,
  TEXT_POINTER_BANK = 0x36;
// The window starts at row 0, column 2 of the BG3 map at VRAM word 0800. The intro
// (before the grid) types 16 columns into 24 lines, the matrix 32 columns into 9.
export const BG3_MAP_VRAM = 0x800,
  TEXT_HOME = 0x802,
  TEXT_ROW_MASK = 0x3e0,
  MAP_ROW_WORDS = 0x20,
  GAME_TEXT_COLUMNS = 0x20,
  GAME_TEXT_LINES = 9;
const INTRO_TEXT_COLUMNS = 0x10,
  INTRO_TEXT_LINES = 0x18,
  NEW_LINE_DELAY = 3,
  FIRST_CHARACTER = 0x20,
  // The BG3 tile word of each character, and the row the typed characters gather in.
  CHARACTER_TILES = 0x7effc0,
  TEXT_ROW = 0x7f015a,
  // The fixed source word of the BG3 clear.
  CLEAR_SOURCE = 0x81b258,
  // 81:C515: the message list of each system: a count, then text address and bank.
  MESSAGE_LISTS = 0x81c515,
  MESSAGE_BANK_OFFSET = 2,
  MESSAGE_ENTRY_BYTES = 3;
// Text commands below character 20 (table 81:B370): 1-3 select palette 0-2, 4 starts a
// line, 5 pauses for the frames in the next byte, 6 steps the cursor back.
const COMMAND_PALETTE_LAST = 3,
  COMMAND_NEW_LINE = 4,
  COMMAND_PAUSE = 5,
  COMMAND_BACK = 6;
// Gauges: a row of tiles in bank 7F (cap, full tiles, one partial tile, empty tiles,
// mirrored cap) for a width in pixels; health is 100 pixels wide, memory 64.
const GAUGE_WIDTH = 0x7f01dc,
  GAUGE_FULL = 0x7f00c0,
  GAUGE_PARTIAL = 0x7f00c2,
  GAUGE_EMPTY = 0x7f00d0,
  GAUGE_CAP = 0x7f00d2,
  GAUGE_BANK = 0x7f,
  HEALTH_GAUGE_WIDTH = 100,
  HEALTH_GAUGE_ROW = 0x1de,
  HEALTH_GAUGE_VRAM = 0xec1,
  MEMORY_GAUGE_WIDTH = 0x40,
  MEMORY_GAUGE_ROW = 0x1fa,
  MEMORY_GAUGE_VRAM = 0xf01,
  TILE_SHIFT = 3,
  PIXEL_MASK = TILE_SIZE - 1;
// Language edits: digits of the IC count text.
const FIRST_COUNT = 0x31,
  LAST_COUNT = 0x38;

const next = (offset) =>
  offset + QUEUE_ENTRY_BYTES >= QUEUE_BYTES ? 0 : offset + QUEUE_ENTRY_BYTES;
const increment = (wram, at) => setWord(wram, at, word(wram, at) + 1);

// Edited language texts (memory.matrixTextEdits) follow the ring slots: queueing
// records the edit of the slot, starting a text activates it.
function slotOf(offset) {
  const slot = offset / QUEUE_ENTRY_BYTES;
  if (!Number.isInteger(slot) || slot < 0 || slot >= QUEUE_ENTRIES)
    throw new VmFault('matrix_edit_queue_required');
  return slot;
}
function captureEdit(mem, pointer) {
  if (!mem.matrixTextEdits && !mem.matrixTextState) return;
  const edit = mem.matrixTextEdits?.get(
    pointer === MATRIX_IC_TEXT_BUFFER ? MATRIX_COUNT_TEXT : pointer,
  );
  const slot = slotOf(word(mem.wram, MATRIX_TEXT_QUEUE_END));
  if (!mem.matrixTextState && !edit) return;
  let stream = null;
  if (edit) {
    let bytes = edit.bytes;
    if (edit.countIndex !== -1) {
      const digit = mem.read8(MATRIX_IC_TEXT_COUNT);
      if (digit < FIRST_COUNT || digit > LAST_COUNT)
        throw new VmFault('matrix_edit_count_required');
      bytes = bytes.slice();
      bytes[edit.countIndex] = digit;
    }
    stream = {
      bytes,
      position: 0,
      originalEnd: pointer === MATRIX_IC_TEXT_BUFFER ? MATRIX_IC_TEXT_END : edit.originalEnd,
    };
  }
  mem.matrixTextState ??= { slots: Array(QUEUE_ENTRIES).fill(null), active: null };
  // An unedited text in the slot also discards the edit queued there before.
  mem.matrixTextState.slots[slot] = stream;
}
function readText(mem) {
  const active = mem.matrixTextState?.active;
  if (!active) {
    const w = mem.wram;
    return longWord(mem, (w[TEXT_POINTER_BANK] << WORD_BITS) | word(w, TEXT_POINTER));
  }
  if (active.position >= active.bytes.length - 1) throw new VmFault('matrix_edit_stream_required');
  return active.bytes[active.position] | (active.bytes[active.position + 1] << BYTE_BITS);
}
function advanceText(mem) {
  const active = mem.matrixTextState?.active;
  if (active) active.position++;
  else increment(mem.wram, TEXT_POINTER);
}
// An edited text parks the cartridge pointer at the original terminator, so idle
// calls and a later reset never replay the start of the original text.
function finishText(mem) {
  const state = mem.matrixTextState;
  if (!state?.active) return;
  setWord(mem.wram, TEXT_POINTER, state.active.originalEnd & WORD_MASK);
  state.active = null;
}

// Empty the window: cursor home, no lines, no scroll, an empty ring (81:B2A0).
export function resetTextWindow(m) {
  const { wram } = m;
  m.mem.matrixTextState = null;
  setWord(wram, MATRIX_TEXT_CURSOR, TEXT_HOME);
  setWord(wram, MATRIX_TEXT_CURSOR_SHOWN, TEXT_HOME);
  for (const at of [
    MATRIX_TEXT_LINE,
    MATRIX_TEXT_SCROLL,
    MATRIX_TEXT_PALETTE,
    MATRIX_TEXT_COUNT,
    MATRIX_COLOUR_CYCLE_A,
    MATRIX_COLOUR_CYCLE_B,
    MATRIX_TEXT_QUEUE_START,
    MATRIX_TEXT_QUEUE_END,
    MATRIX_TEXT_BUSY,
  ])
    setWord(wram, at, 0);
  setWord(wram, MATRIX_TEXT_COLUMNS, INTRO_TEXT_COLUMNS);
  setWord(wram, MATRIX_TEXT_LINES, INTRO_TEXT_LINES);
}
// Queue the text at a long address (81:B282). bankWord is the word stored as the
// entry's bank; message lists store their next byte in its upper half.
export function queueText(m, text, bankWord = text >>> WORD_BITS) {
  const { wram } = m,
    address = text & WORD_MASK;
  captureEdit(m.mem, address | ((bankWord & BYTE_MASK) << WORD_BITS));
  const at = word(wram, MATRIX_TEXT_QUEUE_END);
  setWord(wram, MATRIX_TEXT_QUEUE + at, address);
  setWord(wram, MATRIX_TEXT_QUEUE_BANK + at, bankWord);
  setWord(wram, MATRIX_TEXT_QUEUE_END, next(at));
}
// Queue the message list of the current system (81:C39F).
export function queueSystemMessages(m) {
  const { mem, wram } = m,
    list = longWord(mem, MESSAGE_LISTS + (wram[MATRIX_MESSAGES] << 1)),
    entry = (offset) => longWord(mem, (MESSAGE_LISTS & ~WORD_MASK) + list + offset);
  let count = entry(0) & BYTE_MASK,
    offset = 1;
  // A count of 0 runs the list 65536 times, as the original loop does.
  do {
    const text = entry(offset),
      bank = entry(offset + MESSAGE_BANK_OFFSET);
    offset += MESSAGE_ENTRY_BYTES;
    queueText(m, text, bank);
    count = (count - 1) & WORD_MASK;
  } while (count !== 0);
}
// Take the next queued text and start typing it after one frame (81:B259).
function startNextText(m) {
  const { mem, wram } = m,
    at = word(wram, MATRIX_TEXT_QUEUE_START);
  if (at === word(wram, MATRIX_TEXT_QUEUE_END)) return;
  const state = mem.matrixTextState;
  if (state) {
    const slot = slotOf(at);
    state.active = state.slots[slot];
    state.slots[slot] = null;
  }
  setWord(wram, TEXT_POINTER, word(wram, MATRIX_TEXT_QUEUE + at));
  setWord(wram, TEXT_POINTER_BANK, word(wram, MATRIX_TEXT_QUEUE_BANK + at));
  setWord(wram, MATRIX_TEXT_QUEUE_START, next(at));
  setWord(wram, MATRIX_TEXT_DELAY, 1);
}
// A text command; returns true when typing stops for this frame (81:B37E-B3C8).
function runTextCommand(m, command) {
  const { mem, wram } = m;
  if (command >= 1 && command <= COMMAND_PALETTE_LAST) {
    setWord(wram, MATRIX_TEXT_PALETTE, (command - 1) * TILE_PALETTE_STEP);
    return false;
  }
  if (command === COMMAND_NEW_LINE) {
    const cursor = ((word(wram, MATRIX_TEXT_CURSOR) + MAP_ROW_WORDS) & TEXT_ROW_MASK) | TEXT_HOME;
    setWord(wram, MATRIX_TEXT_CURSOR, cursor);
    increment(wram, MATRIX_TEXT_LINE);
    // A full window scrolls one text row up.
    const lines = word(wram, MATRIX_TEXT_LINES);
    if (word(wram, MATRIX_TEXT_LINE) >= lines) {
      setWord(wram, MATRIX_TEXT_LINE, lines);
      setWord(wram, MATRIX_TEXT_SCROLL, word(wram, MATRIX_TEXT_SCROLL) + TILE_SIZE);
    }
    setWord(wram, MATRIX_TEXT_DELAY, NEW_LINE_DELAY);
  } else if (command === COMMAND_PAUSE) {
    const frames = readText(mem) & BYTE_MASK;
    advanceText(mem);
    setWord(wram, MATRIX_TEXT_DELAY, frames);
  } else if (command === COMMAND_BACK) {
    setWord(wram, MATRIX_TEXT_CURSOR, word(wram, MATRIX_TEXT_CURSOR) - 1);
    setWord(wram, MATRIX_TEXT_DELAY, 1);
  } else taskStop('matrix_text_command_frontier', { command });
  return true;
}
// Type the queued texts, one character per delay (81:B2D1). Returns false once the
// last text has ended and the ring is empty.
export function typeText(m) {
  const { mem, wram } = m;
  if (word(wram, MATRIX_TEXT_BUSY) === 0) {
    startNextText(m);
    increment(wram, MATRIX_TEXT_BUSY);
  }
  const delay = (word(wram, MATRIX_TEXT_DELAY) - 1) & WORD_MASK;
  setWord(wram, MATRIX_TEXT_DELAY, delay);
  if (delay !== 0) return true;
  setWord(wram, MATRIX_TEXT_DELAY, 1);
  const start = word(wram, MATRIX_TEXT_CURSOR);
  setWord(wram, MATRIX_TEXT_FILL, 0);
  setWord(wram, MATRIX_TEXT_COUNT, 0);
  let columns = word(wram, MATRIX_TEXT_COLUMNS);
  for (;;) {
    const character = readText(mem) & BYTE_MASK;
    if (character === 0) {
      setWord(wram, MATRIX_TEXT_BUSY, 0);
      finishText(mem);
      return word(wram, MATRIX_TEXT_QUEUE_END) !== word(wram, MATRIX_TEXT_QUEUE_START);
    }
    if (character < FIRST_CHARACTER) {
      advanceText(mem);
      if (runTextCommand(m, character)) break;
      continue;
    }
    const tile =
      longWord(mem, CHARACTER_TILES + character * 2) |
      TILE_PRIORITY |
      word(wram, MATRIX_TEXT_PALETTE);
    const fill = word(wram, MATRIX_TEXT_FILL);
    setLongWord(mem, TEXT_ROW + fill, tile);
    setWord(wram, MATRIX_TEXT_FILL, fill + 2);
    advanceText(mem);
    setWord(wram, MATRIX_TEXT_COUNT, word(wram, MATRIX_TEXT_COUNT) + 2);
    increment(wram, MATRIX_TEXT_CURSOR);
    columns = (columns - 1) & WORD_MASK;
    if (columns === 0) break;
  }
  const bytes = word(wram, MATRIX_TEXT_COUNT);
  if (bytes !== 0) {
    queueVramCopy(wram, bytes, TEXT_ROW, start);
    increment(wram, MATRIX_DMA_RECORDS);
  }
  return true;
}
// Clear the whole BG3 map by DMA from one fixed word (81:B228).
export function clearTextMap(m) {
  m.video.fillVramFromWord(
    BG3_MAP_VRAM,
    CLEAR_SOURCE,
    SCREEN_MAP_BYTES,
    VMAINC_INCREMENT_AFTER_HIGH,
  );
}

// Draw a gauge row for value pixels at the row offset in bank 7F and queue it for
// VRAM (81:B3D3). The row width comes from GAUGE_WIDTH.
function drawGauge(m, value, row, vram) {
  const { mem } = m,
    put = (offset, tile) => setLongWord(mem, (GAUGE_BANK << WORD_BITS) + row + offset, tile);
  let tiles = longWord(mem, GAUGE_WIDTH) >>> TILE_SHIFT,
    full = value >>> TILE_SHIFT,
    offset = 2;
  const partial = longWord(mem, GAUGE_PARTIAL + ((value & PIXEL_MASK) ^ PIXEL_MASK) * 2),
    cap = longWord(mem, GAUGE_CAP);
  put(0, cap);
  put(((tiles + 1) * 2) & WORD_MASK, cap | TILE_H_FLIP);
  let filled = false;
  if (full !== 0) {
    const tile = longWord(mem, GAUGE_FULL);
    do {
      put(offset, tile);
      offset = (offset + 2) & WORD_MASK;
      tiles = (tiles - 1) & WORD_MASK;
      full = (full - 1) & WORD_MASK;
    } while (full !== 0);
    filled = tiles === 0;
  }
  if (!filled) {
    put(offset, partial);
    offset = (offset + 2) & WORD_MASK;
    tiles = (tiles - 1) & WORD_MASK;
    if (tiles !== 0) {
      const tile = longWord(mem, GAUGE_EMPTY);
      do {
        put(offset, tile);
        offset = (offset + 2) & WORD_MASK;
        tiles = (tiles - 1) & WORD_MASK;
      } while (tiles !== 0);
    }
  }
  const bytes = (((longWord(mem, GAUGE_WIDTH) >>> TILE_SHIFT) + 2) * 2) & WORD_MASK;
  queueVramCopy(m.wram, bytes, (GAUGE_BANK << WORD_BITS) | row, vram);
  increment(m.wram, MATRIX_DMA_RECORDS);
}
// One step of a shown value towards its value (81:B473).
function stepShown(wram, shown, value) {
  const target = word(wram, value),
    current = word(wram, shown);
  if (target !== current) setWord(wram, shown, target > current ? current + 1 : current - 1);
}
// Step the shown memory and health one unit towards their values and redraw both
// gauges (81:B485). The death counter is the shown health.
export function updateGauges(m) {
  const { mem, wram } = m;
  stepShown(wram, MATRIX_MEMORY_SHOWN, MATRIX_MEMORY);
  stepShown(wram, MATRIX_DEATH_COUNTER, MATRIX_HEALTH);
  setLongWord(mem, GAUGE_WIDTH, HEALTH_GAUGE_WIDTH);
  drawGauge(m, word(wram, MATRIX_DEATH_COUNTER) >>> 1, HEALTH_GAUGE_ROW, HEALTH_GAUGE_VRAM);
  setLongWord(mem, GAUGE_WIDTH, MEMORY_GAUGE_WIDTH);
  drawGauge(m, word(wram, MATRIX_MEMORY_SHOWN), MEMORY_GAUGE_ROW, MEMORY_GAUGE_VRAM);
}
