import { taskStop } from '../../src/task/plan.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from '../../src/task/native-call-continuation.mjs';
import { routineCaller } from '../../src/task/routine-call.mjs';
import {
  captureMatrixText,
  beginMatrixText,
  readMatrixText,
  advanceMatrixText,
  finishMatrixText,
  resetMatrixText,
} from './matrix-text-stream.mjs';

import {
  DMA_RECORD_BANK,
  DMA_RECORD_BYTES,
  DMA_RECORD_COUNT,
  DMA_RECORD_SOURCE,
  DMA_RECORD_VMAINC,
  DMA_RECORD_VRAM,
  MATRIX_ANIMATION,
  MATRIX_ANIMATION_CLOCK,
  MATRIX_ANIMATION_SPEED,
  MATRIX_ANIMATION_STEP,
  MATRIX_COLOUR_CYCLE_A,
  MATRIX_COLOUR_CYCLE_B,
  MATRIX_DEATH_COUNTER,
  MATRIX_DIRECTION,
  MATRIX_DMA_END,
  MATRIX_DMA_RECORDS,
  MATRIX_HEALTH,
  MATRIX_IC_TEXT_BUFFER,
  MATRIX_MAP,
  MATRIX_MAP_EDIT,
  MATRIX_MEMORY,
  MATRIX_MEMORY_SHOWN,
  MATRIX_MESSAGES,
  MATRIX_NODE_COLUMNS,
  MATRIX_NODE_ROWS,
  MATRIX_OBJECT_END,
  MATRIX_OBJECT_FLAGS,
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
} from '../../src/task/wram.mjs';
import {
  BANK_MASK,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
} from '../../src/constants/bits.mjs';
import {
  VMADDL,
  VMDATAL,
  VMAINC,
  DMAP0,
  BBAD0,
  A1T0L,
  A1B0,
  DAS0L,
  MDMAEN,
  CGSWSEL,
  CGADSUB,
  COLDATA,
  TM,
  TS,
  BG3SC,
  BG3VOFS,
  DMAP6,
  BBAD6,
  A1T6L,
  A1B6,
  DMAP5,
  BBAD5,
  A1T5L,
  A1B5,
  HDMAEN,
} from '../../src/constants/hardware-registers.mjs';
import {
  CGADSUB_BACKDROP,
  CGSWSEL_SUB_SCREEN,
  COLDATA_BLUE,
  COLDATA_GREEN,
  COLDATA_RED,
  COLOUR_COMPONENT_MASK,
  DMAP_FIXED_SOURCE,
  DMAP_TWO_PORTS,
  DMAP_WRITE_TWICE,
  HDMA_LINE_COUNT_MASK,
  LAYER_BG1,
  LAYER_BG2,
  LAYER_BG3,
  LAYER_BG4,
  LAYER_OBJ,
  SCREEN_MAP_BYTES,
  TILE_H_FLIP,
  TILE_PALETTE_STEP,
  TILE_PRIORITY,
  TILE_SIZE,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../../src/constants/ppu.mjs';
import {
  FLAG_CARRY,
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_MEMORY_8BIT,
} from '../../src/constants/cpu-flags.mjs';
// Matrix map, text queue and display setup. The object/gameplay graph and the
// NMI callback installed by CDB2 have separate owners. No callback is scheduled here.

// The matrix map has 32 x 32 tiles; a tile number (bits 0-9) is 8 tiles wide per row of
// the sheet, and 81:B4B9 turns it into the top left character of a 16 x 16 tile.
export const MAP_LAST = 0x1f,
  MAP_ROW_WORDS = 0x20,
  TILE_NUMBER_MASK = 0x3ff,
  TILE_ROW_BITS = 0x3f8,
  TILE_COLUMN_BITS = 7,
  TILE_ATTRIBUTE_BITS = 0xfc00,
  TILE_BITS = 3;
// Map tiles 21-27 are the seven nodes whose column and row 81:B4D3 records.
export const FIRST_NODE_TILE = 0x21,
  NODE_TILE_END = 0x28,
  NODE_TABLE_BYTES = (NODE_TILE_END - FIRST_NODE_TILE) * 2;
// 81:B818 places the persona on the first map tile 59 of the map in bank 7F; byte offset
// masks of row and column.
export const MAP_BANK = 0x7f,
  PERSONA_TILE = 0x59,
  MAP_ROW_OFFSET_MASK = 0xffc0,
  MAP_COLUMN_OFFSET_MASK = 0x3e;
// Text queue: eight four-byte entries; DP34/DP36 hold the long pointer of the current text.
const QUEUE_ENTRY_BYTES = 4,
  QUEUE_BYTES = 0x20,
  DP_TEXT = 0x34,
  DP_TEXT_BANK = 0x36;
// The message window starts at row 0, column 2 of the BG3 map at VRAM 0800; a new line
// waits three frames. Characters below 20 are the commands of the table 81:B370 (1-6).
export const BG3_MAP_VRAM = 0x800,
  TEXT_HOME = 0x802,
  TEXT_ROW_MASK = 0x3e0,
  NEW_LINE_DELAY = 3,
  INTRO_TEXT_COLUMNS = 0x10,
  INTRO_TEXT_LINES = 0x18,
  GAME_TEXT_COLUMNS = 0x20,
  GAME_TEXT_LINES = 9,
  FIRST_CHARACTER = 0x20,
  LAST_COMMAND_INDEX = 12,
  COMMAND_TABLE = 0x81b370,
  CHARACTER_TILES = 0x7effc0,
  TEXT_ROW = 0x7f015a;
// Gauges 81:B3D3: width in pixels, full tile, partial tiles by remaining pixels, empty
// tile and end cap in bank 7F; health (100 pixels) and memory (64 pixels) gauges.
const GAUGE_WIDTH = 0x7f01dc,
  GAUGE_FULL = 0x7f00c0,
  GAUGE_PARTIAL = 0x7f00c2,
  GAUGE_EMPTY = 0x7f00d0,
  GAUGE_CAP = 0x7f00d2,
  GAUGE_BANK = GAUGE_WIDTH >>> WORD_BITS,
  HEALTH_GAUGE_WIDTH = 100,
  HEALTH_GAUGE_ROW = 0x1de,
  HEALTH_GAUGE_VRAM = 0xec1,
  MEMORY_GAUGE_WIDTH = 0x40,
  MEMORY_GAUGE_ROW = 0x1fa,
  MEMORY_GAUGE_VRAM = 0xf01;
// 81:B84A scrolls when the persona leaves the screen columns or rows 60 to 90.
const SCROLL_LOW = 0x60,
  SCROLL_HIGH = 0x91;
// 81:BD99 places and animates only objects with flag bit 15.
const OBJECT_FLAGS_START = 0x8000;
// Colour math: all layers and the backdrop for the fades, then BG1, BG2 and OBJ on the main
// screen with BG3 added from the sub screen. TM has no bit 5; CGADSUB takes the same value.
const ALL_LAYERS = LAYER_BG1 | LAYER_BG2 | LAYER_BG3 | LAYER_BG4 | LAYER_OBJ | CGADSUB_BACKDROP,
  MAIN_LAYERS = LAYER_BG1 | LAYER_BG2 | LAYER_OBJ,
  MATRIX_LAYERS = MAIN_LAYERS | CGADSUB_BACKDROP,
  COLDATA_ALL = COLDATA_RED | COLDATA_GREEN | COLDATA_BLUE,
  COLOUR_LEVELS = COLOUR_COMPONENT_MASK + 1;
// 81:C029: H-DMA channel 6 switches BG3SC from the table 81:C101, channel 5 the BG3 scroll
// from 7F:0150 (6 lines, 44 lines of the message window, the rest).
export const BG3_MAP_TABLE = 0x81c101,
  SCROLL_TABLE = 0x7f0150,
  HDMA_ENTRY_BYTES = 3,
  HDMA_ENTRIES = 3,
  TOP_LINES = 6,
  WINDOW_LINES = 0x44,
  SCROLL_CHANNEL = 5,
  MAP_CHANNEL = 6,
  CLEAR_SOURCE = 0x81b258,
  STATE_START = 2,
  PERSONA_ANIMATION = 0x81be71,
  PERSONA_ANIMATION_SPEED = 8,
  DIRECTION_RIGHT = 4,
  GREETING = 0x81c62e,
  TEXT_TEMPLATE = 0x81c60d,
  TEXT_TEMPLATE_BYTES = 0x10,
  MESSAGE_LISTS = 0x81c515;
// Copy of the text 81:C60D ("FOUND X IC!") that 81:B959 completes with the IC count.
export const TEXT_BUFFER = MATRIX_IC_TEXT_BUFFER;
const DP_LIST = 0xe;
const carry = (h, set) => {
  h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(set);
};
// 81:B4B9: convert the matrix map value in A into its BG tilemap entry (character, palette and flip
// bits).
function toMatrixTilemapEntry(h) {
  const DP_TILE = 0x1e,
    DP_CHARACTER = 0x1c;
  h.dpWrite(DP_TILE, h.ctx.a);
  h.load(h.ctx.a & TILE_ROW_BITS);
  h.asl();
  h.dpWrite(DP_CHARACTER, h.ctx.a);
  h.load(h.dp(DP_TILE) & TILE_COLUMN_BITS);
  h.load(h.ctx.a | h.dp(DP_CHARACTER));
  h.asl();
  h.dpWrite(DP_CHARACTER, h.ctx.a);
  h.load(h.dp(DP_TILE) & TILE_ATTRIBUTE_BITS);
  h.load(h.ctx.a | h.dp(DP_CHARACTER));
  return h.rts();
}
// 81:B4D3: write the 32x32 matrix map at A (bank Y) to VRAM word address X and record the column
// and row of each node tile.
function uploadMatrixMap(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  const DP_COLUMN = 0xe,
    DP_ROW = 0x10,
    DP_VRAM = 0x12,
    DP_COLUMNS_LEFT = 0x14,
    DP_ROWS_LEFT = 0x16,
    DP_TILE = 0x1e,
    DP_MAP = 0x20,
    DP_MAP_BANK = 0x22;
  h.dpWrite(DP_MAP, ctx.a);
  h.dpWrite(DP_MAP_BANK, ctx.y, 2);
  h.dpWrite(DP_VRAM, ctx.x, 2);
  h.dpWrite(DP_COLUMN, 0);
  h.dpWrite(DP_ROW, 0);
  h.index('x', 0);
  h.load(WORD_MASK);
  do {
    h.write(h.abs(MATRIX_NODE_COLUMNS) + ctx.x, ctx.a);
    h.write(h.abs(MATRIX_NODE_ROWS) + ctx.x, ctx.a);
    h.index('x', ctx.x + 2);
    h.cpx(NODE_TABLE_BYTES);
  } while (!(ctx.status & FLAG_ZERO));
  h.index('y', 0);
  h.load(MAP_LAST);
  h.dpWrite(DP_ROWS_LEFT, ctx.a);
  do {
    h.dpWrite(DP_COLUMN, 0);
    h.load(MAP_LAST);
    h.dpWrite(DP_COLUMNS_LEFT, ctx.a);
    do {
      h.load(h.dp(DP_ROW) | h.dp(DP_COLUMN));
      h.load(ctx.a | h.dp(DP_VRAM));
      h.portWrite(VMADDL, ctx.a, 2, 0x81b505);
      h.load(h.read(h.indirect(DP_MAP, ctx.y)));
      call(0x81b50a, 0x81b4b9);
      h.portWrite(VMDATAL, ctx.a, 2, 0x81b50d);
      h.load(h.dp(DP_TILE) & TILE_NUMBER_MASK);
      h.cmp(FIRST_NODE_TILE);
      if (ctx.status & FLAG_CARRY) {
        h.cmp(NODE_TILE_END);
        if (!(ctx.status & FLAG_CARRY)) {
          carry(h, true);
          h.sbc(FIRST_NODE_TILE);
          h.asl();
          h.index('x', ctx.a);
          carry(h, true);
          h.load(MAP_LAST);
          h.sbc(h.dp(DP_COLUMNS_LEFT));
          h.write(h.abs(MATRIX_NODE_COLUMNS) + ctx.x, ctx.a);
          carry(h, true);
          h.load(MAP_LAST);
          h.sbc(h.dp(DP_ROWS_LEFT));
          h.write(h.abs(MATRIX_NODE_ROWS) + ctx.x, ctx.a);
        }
      }
      h.index('y', ctx.y + 1);
      h.index('y', ctx.y + 1);
      h.modify(DP_COLUMN, 'inc', true);
      h.modify(DP_COLUMNS_LEFT, 'dec', true);
    } while (!(ctx.status & FLAG_NEGATIVE));
    carry(h, false);
    h.load(h.dp(DP_ROW));
    h.adc(MAP_ROW_WORDS);
    h.dpWrite(DP_ROW, ctx.a);
    h.modify(DP_ROWS_LEFT, 'dec', true);
  } while (!(ctx.status & FLAG_NEGATIVE));
  return h.rts();
}
// 81:B259: take the next text from the queue into DP_TEXT and start typing it after one frame.
function startNextMatrixText(h) {
  const { ctx } = h;
  h.index('x', h.read(h.abs(MATRIX_TEXT_QUEUE_START), 2));
  h.cpx(h.read(h.abs(MATRIX_TEXT_QUEUE_END), 2));
  if (!(ctx.status & FLAG_ZERO)) {
    beginMatrixText(h.a.mem, ctx.x);
    h.load(h.read(h.abs(MATRIX_TEXT_QUEUE) + ctx.x));
    h.dpWrite(DP_TEXT, ctx.a);
    h.load(h.read(h.abs(MATRIX_TEXT_QUEUE_BANK) + ctx.x));
    h.dpWrite(DP_TEXT_BANK, ctx.a);
    h.load(ctx.x);
    carry(h, false);
    h.adc(QUEUE_ENTRY_BYTES);
    h.cmp(QUEUE_BYTES);
    if (ctx.status & FLAG_CARRY) h.load(0);
    h.write(h.abs(MATRIX_TEXT_QUEUE_START), ctx.a);
    h.load(1);
    h.write(h.abs(MATRIX_TEXT_DELAY), ctx.a);
  }
  return h.rts();
}
// 81:B282: queue the text X (bank Y) for the message window.
export function queueMatrixText(h) {
  const { ctx } = h;
  captureMatrixText(h);
  h.phy();
  h.phx();
  h.index('x', h.read(h.abs(MATRIX_TEXT_QUEUE_END), 2));
  h.pla();
  h.write(h.abs(MATRIX_TEXT_QUEUE) + ctx.x, ctx.a);
  h.pla();
  h.write(h.abs(MATRIX_TEXT_QUEUE_BANK) + ctx.x, ctx.a);
  h.load(ctx.x);
  carry(h, false);
  h.adc(QUEUE_ENTRY_BYTES);
  h.cmp(QUEUE_BYTES);
  if (ctx.status & FLAG_CARRY) h.load(0);
  h.write(h.abs(MATRIX_TEXT_QUEUE_END), ctx.a);
  return h.rts();
}
// 81:B2A0: reset the message window: cursor, lines, scroll and the text queue.
export function resetMatrixTextWindow(h) {
  resetMatrixText(h.a.mem);
  h.load(TEXT_HOME);
  h.write(h.abs(MATRIX_TEXT_CURSOR), h.ctx.a);
  h.write(h.abs(MATRIX_TEXT_CURSOR_SHOWN), h.ctx.a);
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
    h.write(h.abs(at), 0);
  h.load(INTRO_TEXT_COLUMNS);
  h.write(h.abs(MATRIX_TEXT_COLUMNS), h.ctx.a);
  h.load(INTRO_TEXT_LINES);
  h.write(h.abs(MATRIX_TEXT_LINES), h.ctx.a);
  return h.rts();
}
// 81:C39F: queue the message list of the current system.
export function queueMatrixMessages(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.load(h.read(h.abs(MATRIX_MESSAGES)) & BYTE_MASK);
  h.asl();
  h.index('x', ctx.a);
  h.load(h.read(h.abs(MESSAGE_LISTS & WORD_MASK) + ctx.x));
  h.dpWrite(DP_LIST, ctx.a);
  h.index('y', 0);
  const read = () => h.read((h.abs(h.dp(DP_LIST, 2)) + ctx.y) & LONG_MASK);
  h.load(read());
  h.load(ctx.a & BYTE_MASK);
  h.index('x', ctx.a);
  h.index('y', ctx.y + 1);
  do {
    h.phx();
    h.load(read());
    h.index('x', ctx.a);
    h.index('y', ctx.y + 1);
    h.index('y', ctx.y + 1);
    h.load(read());
    h.index('y', ctx.y + 1);
    h.phy();
    h.index('y', ctx.a);
    call(0x81c3c1, 0x81b282);
    h.ply();
    h.plx();
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_ZERO));
  return h.rts();
}
// 81:B37E: text command: select the palette for the following characters.
function setMatrixTextPalette(h) {
  h.xba();
  h.asl();
  carry(h, true);
  h.sbc(TILE_PALETTE_STEP);
  h.write(h.abs(MATRIX_TEXT_PALETTE), h.ctx.a);
  carry(h, false);
  return h.rts();
}
// 81:B389: text command: move the cursor to the next line and scroll the window when it is full.
function startMatrixTextLine(h) {
  const { ctx } = h;
  carry(h, false);
  h.load(h.read(h.abs(MATRIX_TEXT_CURSOR)));
  h.adc(MAP_ROW_WORDS);
  h.load(ctx.a & TEXT_ROW_MASK);
  h.load(ctx.a | TEXT_HOME);
  h.write(h.abs(MATRIX_TEXT_CURSOR), ctx.a);
  h.modify(h.abs(MATRIX_TEXT_LINE), 'inc');
  h.load(h.read(h.abs(MATRIX_TEXT_LINE)));
  h.cmp(h.read(h.abs(MATRIX_TEXT_LINES)));
  if (ctx.status & FLAG_CARRY) {
    h.load(h.read(h.abs(MATRIX_TEXT_LINES)));
    h.write(h.abs(MATRIX_TEXT_LINE), ctx.a);
    carry(h, false);
    h.load(h.read(h.abs(MATRIX_TEXT_SCROLL)));
    h.adc(TILE_SIZE);
    h.write(h.abs(MATRIX_TEXT_SCROLL), ctx.a);
  }
  h.load(NEW_LINE_DELAY);
  h.write(h.abs(MATRIX_TEXT_DELAY), ctx.a);
  carry(h, true);
  return h.rts();
}
// 81:B3BC: text command: wait for the number of frames in the next text byte.
function pauseMatrixText(h) {
  h.load(readMatrixText(h));
  advanceMatrixText(h);
  h.load(h.ctx.a & BYTE_MASK);
  h.write(h.abs(MATRIX_TEXT_DELAY), h.ctx.a);
  carry(h, true);
  return h.rts();
}
// 81:B3C8: text command: move the cursor one character back.
function stepMatrixCursorBack(h) {
  h.modify(h.abs(MATRIX_TEXT_CURSOR), 'dec');
  h.load(1);
  h.write(h.abs(MATRIX_TEXT_DELAY), h.ctx.a);
  carry(h, true);
  return h.rts();
}
export const textCommands = new Map([
  [0x81b37e, setMatrixTextPalette],
  [0x81b389, startMatrixTextLine],
  [0x81b3bc, pauseMatrixText],
  [0x81b3c8, stepMatrixCursorBack],
]);
// Only the source-proved command domain 1..6 is admitted. Bytes 7..31 would
// interpret instruction bytes behind B37C as jump words; retain that frontier.
// 81:B2D1: type the queued text into the message window, one character per delay.
export function typeMatrixText(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  const DP_START = 0xe;
  h.load(h.read(h.abs(MATRIX_TEXT_BUSY)));
  if (ctx.status & FLAG_ZERO) {
    call(0x81b2d6, 0x81b259);
    h.modify(h.abs(MATRIX_TEXT_BUSY), 'inc');
  }
  h.modify(h.abs(MATRIX_TEXT_DELAY), 'dec');
  if (!(ctx.status & FLAG_ZERO)) {
    carry(h, true);
    return h.rts();
  }
  h.load(1);
  h.write(h.abs(MATRIX_TEXT_DELAY), ctx.a);
  h.load(h.read(h.abs(MATRIX_TEXT_CURSOR)));
  h.dpWrite(DP_START, ctx.a);
  h.write(h.abs(MATRIX_TEXT_FILL), 0);
  h.write(h.abs(MATRIX_TEXT_COUNT), 0);
  h.index('y', h.read(h.abs(MATRIX_TEXT_COLUMNS), 2));
  for (;;) {
    h.load(readMatrixText(h));
    h.load(ctx.a & BYTE_MASK);
    if (ctx.status & FLAG_ZERO) {
      h.write(h.abs(MATRIX_TEXT_BUSY), 0);
      finishMatrixText(h);
      h.load(h.read(h.abs(MATRIX_TEXT_QUEUE_END)));
      h.cmp(h.read(h.abs(MATRIX_TEXT_QUEUE_START)));
      carry(h, !(ctx.status & FLAG_ZERO));
      return h.rts();
    }
    h.asl();
    h.index('x', ctx.a);
    h.cpx(FIRST_CHARACTER * 2);
    if (!(ctx.status & FLAG_CARRY)) {
      advanceMatrixText(h);
      const target = (COMMAND_TABLE & BANK_MASK) | h.read(COMMAND_TABLE + ctx.x, 2),
        run = textCommands.get(target);
      if (ctx.x > LAST_COMMAND_INDEX || !run)
        taskStop('matrix_text_command_frontier', { target, commandIndex: ctx.x });
      h.call(0x81b307, target, () => run(h));
      if (ctx.status & FLAG_CARRY) break;
      continue;
    }
    h.load(h.read(CHARACTER_TILES + ctx.x));
    h.load(ctx.a | TILE_PRIORITY);
    h.load(ctx.a | h.read(h.abs(MATRIX_TEXT_PALETTE)));
    h.index('x', h.read(h.abs(MATRIX_TEXT_FILL), 2));
    h.write(TEXT_ROW + ctx.x, ctx.a);
    h.modify(h.abs(MATRIX_TEXT_FILL), 'inc');
    h.modify(h.abs(MATRIX_TEXT_FILL), 'inc');
    advanceMatrixText(h);
    h.modify(h.abs(MATRIX_TEXT_COUNT), 'inc');
    h.modify(h.abs(MATRIX_TEXT_COUNT), 'inc');
    h.modify(h.abs(MATRIX_TEXT_CURSOR), 'inc');
    h.index('y', ctx.y - 1);
    if (ctx.status & FLAG_ZERO) break;
  }
  h.index('x', h.read(h.abs(MATRIX_DMA_END), 2));
  h.load(h.read(h.abs(MATRIX_TEXT_COUNT)));
  if (!(ctx.status & FLAG_ZERO)) {
    h.write(h.abs(DMA_RECORD_COUNT) + ctx.x, ctx.a);
    h.load(VMAINC_INCREMENT_AFTER_HIGH);
    h.write(h.abs(DMA_RECORD_VMAINC) + ctx.x, ctx.a);
    h.load(TEXT_ROW >>> WORD_BITS);
    h.write(h.abs(DMA_RECORD_BANK) + ctx.x, ctx.a);
    h.load(TEXT_ROW & WORD_MASK);
    h.write(h.abs(DMA_RECORD_SOURCE) + ctx.x, ctx.a);
    h.load(h.dp(DP_START));
    h.write(h.abs(DMA_RECORD_VRAM) + ctx.x, ctx.a);
    h.write(h.abs(DMA_RECORD_COUNT + DMA_RECORD_BYTES) + ctx.x, 0);
    h.load(ctx.x);
    carry(h, false);
    h.adc(DMA_RECORD_BYTES);
    h.write(h.abs(MATRIX_DMA_END), ctx.a);
    h.modify(h.abs(MATRIX_DMA_RECORDS), 'inc');
  }
  carry(h, true);
  return h.rts();
}
// 81:B228: clear the BG3 tilemap by DMA from a fixed source word.
function clearMatrixTextMap(h) {
  h.php();
  h.sep(FLAG_MEMORY_8BIT);
  h.load(VMAINC_INCREMENT_AFTER_HIGH);
  h.portWrite(VMAINC, h.ctx.a & BYTE_MASK, 1, 0x81b22d);
  h.load(DMAP_FIXED_SOURCE | DMAP_TWO_PORTS);
  h.portWrite(DMAP0, h.ctx.a & BYTE_MASK, 1, 0x81b232);
  h.index('x', BG3_MAP_VRAM);
  h.portWrite(VMADDL, h.ctx.x, 2, 0x81b238);
  h.load(VMDATAL & BYTE_MASK);
  h.portWrite(BBAD0, h.ctx.a & BYTE_MASK, 1, 0x81b23d);
  h.index('x', CLEAR_SOURCE & WORD_MASK);
  h.portWrite(A1T0L, h.ctx.x, 2, 0x81b243);
  h.load(CLEAR_SOURCE >>> WORD_BITS);
  h.portWrite(A1B0, h.ctx.a & BYTE_MASK, 1, 0x81b248);
  h.index('x', SCREEN_MAP_BYTES);
  h.portWrite(DAS0L, h.ctx.x, 2, 0x81b24e);
  h.load(1);
  h.portWrite(MDMAEN, h.ctx.a & BYTE_MASK, 1, 0x81b253);
  h.plp();
  return h.rts();
}
// 81:B3D3: draw a gauge row for the value in A from tilemap row X and queue its DMA to VRAM word
// address Y.
function drawMatrixGauge(h) {
  const { ctx } = h;
  const DP_VALUE = 0xe,
    DP_PARTIAL = 0x10,
    DP_FULL_TILES = 0x12,
    DP_TILES = 0x14,
    DP_VRAM = 0x16,
    DP_ROW = 0x20,
    DP_ROW_BANK = 0x22,
    PIXEL_MASK = TILE_SIZE - 1;
  h.dpWrite(DP_VALUE, ctx.a);
  h.dpWrite(DP_VRAM, ctx.y, 2);
  h.dpWrite(DP_ROW, ctx.x, 2);
  h.load(GAUGE_BANK);
  h.dpWrite(DP_ROW_BANK, ctx.a);
  h.load(h.read(GAUGE_WIDTH));
  for (let n = 0; n < TILE_BITS; n++) h.lsr();
  h.dpWrite(DP_TILES, ctx.a);
  h.load(h.dp(DP_VALUE));
  for (let n = 0; n < TILE_BITS; n++) h.lsr();
  h.dpWrite(DP_FULL_TILES, ctx.a);
  h.load(h.dp(DP_VALUE) & PIXEL_MASK);
  h.load(ctx.a ^ PIXEL_MASK);
  h.asl();
  h.index('x', ctx.a);
  h.load(h.read(GAUGE_PARTIAL + ctx.x));
  h.dpWrite(DP_PARTIAL, ctx.a);
  h.load(h.dp(DP_TILES));
  h.load(ctx.a + 1);
  h.asl();
  h.index('y', ctx.a);
  h.load(h.read(GAUGE_CAP));
  h.write(h.indirect(DP_ROW), ctx.a);
  h.load(ctx.a | TILE_H_FLIP);
  h.write(h.indirect(DP_ROW, ctx.y), ctx.a);
  h.index('y', 2);
  h.index('x', h.dp(DP_FULL_TILES, 2));
  let filled = false;
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(h.read(GAUGE_FULL));
    do {
      h.write(h.indirect(DP_ROW, ctx.y), ctx.a);
      h.index('y', ctx.y + 1);
      h.index('y', ctx.y + 1);
      h.modify(DP_TILES, 'dec', true);
      h.index('x', ctx.x - 1);
    } while (!(ctx.status & FLAG_ZERO));
    h.load(h.dp(DP_TILES));
    filled = !!(ctx.status & FLAG_ZERO);
  }
  if (!filled) {
    h.load(h.dp(DP_PARTIAL));
    h.write(h.indirect(DP_ROW, ctx.y), ctx.a);
    h.index('y', ctx.y + 1);
    h.index('y', ctx.y + 1);
    h.modify(DP_TILES, 'dec', true);
    h.load(h.dp(DP_TILES));
    if (!(ctx.status & FLAG_ZERO)) {
      h.load(h.read(GAUGE_EMPTY));
      do {
        h.write(h.indirect(DP_ROW, ctx.y), ctx.a);
        h.index('y', ctx.y + 1);
        h.index('y', ctx.y + 1);
        h.modify(DP_TILES, 'dec', true);
      } while (!(ctx.status & FLAG_ZERO));
    }
  }
  h.index('x', h.read(h.abs(MATRIX_DMA_END), 2));
  h.load(h.read(GAUGE_WIDTH));
  for (let n = 0; n < TILE_BITS; n++) h.lsr();
  h.load(ctx.a + 1);
  h.load(ctx.a + 1);
  h.asl();
  h.write(h.abs(DMA_RECORD_COUNT) + ctx.x, ctx.a);
  h.load(VMAINC_INCREMENT_AFTER_HIGH);
  h.write(h.abs(DMA_RECORD_VMAINC) + ctx.x, ctx.a);
  h.load(GAUGE_BANK);
  h.write(h.abs(DMA_RECORD_BANK) + ctx.x, ctx.a);
  h.load(h.dp(DP_ROW));
  h.write(h.abs(DMA_RECORD_SOURCE) + ctx.x, ctx.a);
  h.load(h.dp(DP_VRAM));
  h.write(h.abs(DMA_RECORD_VRAM) + ctx.x, ctx.a);
  h.write(h.abs(DMA_RECORD_COUNT + DMA_RECORD_BYTES) + ctx.x, 0);
  h.load(ctx.x);
  carry(h, false);
  h.adc(DMA_RECORD_BYTES);
  h.write(h.abs(MATRIX_DMA_END), ctx.a);
  h.modify(h.abs(MATRIX_DMA_RECORDS), 'inc');
  return h.rts();
}
// 81:B473: move the shown value X one step towards the matrix value (memory or health).
function stepShownMatrixValue(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(MATRIX_MEMORY) + ctx.x));
  h.cmp(h.read(h.abs(MATRIX_MEMORY_SHOWN) + ctx.x));
  if (!(ctx.status & FLAG_ZERO))
    h.modify(h.abs(MATRIX_MEMORY_SHOWN) + ctx.x, ctx.status & FLAG_CARRY ? 'inc' : 'dec');
  return h.rts();
}
// 81:B485: step the shown memory and health towards their values and redraw both gauges.
function updateMatrixGauges(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.index('x', 0);
  call(0x81b488, 0x81b473);
  h.index('x', MATRIX_HEALTH - MATRIX_MEMORY);
  call(0x81b48e, 0x81b473);
  h.load(HEALTH_GAUGE_WIDTH);
  h.write(GAUGE_WIDTH, ctx.a);
  h.index('x', HEALTH_GAUGE_ROW);
  h.index('y', HEALTH_GAUGE_VRAM);
  h.load(h.read(h.abs(MATRIX_DEATH_COUNTER)));
  h.lsr();
  call(0x81b4a2, 0x81b3d3);
  h.load(MEMORY_GAUGE_WIDTH);
  h.write(GAUGE_WIDTH, ctx.a);
  h.index('x', MEMORY_GAUGE_ROW);
  h.index('y', MEMORY_GAUGE_VRAM);
  h.load(h.read(h.abs(MATRIX_MEMORY_SHOWN)));
  call(0x81b4b5, 0x81b3d3);
  return h.rts();
}
// 81:B818: place the persona at the persona tile of the matrix map.
function findPersonaStart(h) {
  const { ctx } = h;
  const DP_MAP = 0x20,
    DP_MAP_BANK = 0x22;
  h.load(h.read(h.abs(MATRIX_MAP)));
  h.dpWrite(DP_MAP, ctx.a);
  h.load(MAP_BANK);
  h.dpWrite(DP_MAP_BANK, ctx.a);
  h.index('y', 0);
  do {
    h.load(h.read(h.indirect(DP_MAP, ctx.y)));
    h.load(ctx.a & TILE_NUMBER_MASK);
    h.cmp(PERSONA_TILE);
    if (ctx.status & FLAG_ZERO) break;
    h.index('y', ctx.y + 1);
    h.index('y', ctx.y + 1);
    h.cpy(SCREEN_MAP_BYTES);
  } while (!(ctx.status & FLAG_ZERO));
  h.load(ctx.y);
  h.load(ctx.a & MAP_ROW_OFFSET_MASK);
  h.lsr();
  h.lsr();
  h.write(h.abs(MATRIX_PERSONA_Y), ctx.a);
  h.load(ctx.y);
  h.load(ctx.a & MAP_COLUMN_OFFSET_MASK);
  h.asl();
  h.asl();
  h.asl();
  h.write(h.abs(MATRIX_PERSONA_X), ctx.a);
  return h.rts();
}
// 81:B84A: scroll the matrix view so that the persona stays inside the scroll margins.
function scrollToPersona(h) {
  const { ctx } = h;
  const DP_SCREEN_X = 0xe,
    DP_SCREEN_Y = 0x10,
    DP_SCROLL_X = 0x12,
    DP_SCROLL_Y = 0x14;
  carry(h, true);
  h.load(h.read(h.abs(MATRIX_PERSONA_X)));
  h.sbc(h.read(h.abs(MATRIX_SCROLL_X)));
  h.dpWrite(DP_SCREEN_X, ctx.a);
  carry(h, true);
  h.load(h.read(h.abs(MATRIX_PERSONA_Y)));
  h.sbc(h.read(h.abs(MATRIX_SCROLL_Y)));
  h.dpWrite(DP_SCREEN_Y, ctx.a);
  h.dpWrite(DP_SCROLL_X, 0);
  h.dpWrite(DP_SCROLL_Y, 0);
  for (const [source, dest] of [
    [DP_SCREEN_X, DP_SCROLL_X],
    [DP_SCREEN_Y, DP_SCROLL_Y],
  ]) {
    h.load(h.dp(source));
    h.cmp(SCROLL_LOW);
    if (!(ctx.status & FLAG_CARRY)) {
      carry(h, true);
      h.load(h.dp(source));
      h.sbc(SCROLL_LOW);
      h.dpWrite(dest, ctx.a);
    }
    h.load(h.dp(source));
    h.cmp(SCROLL_HIGH);
    if (ctx.status & FLAG_CARRY) {
      h.load(h.dp(source));
      h.sbc(SCROLL_HIGH);
      h.dpWrite(dest, ctx.a);
    }
  }
  carry(h, false);
  h.load(h.read(h.abs(MATRIX_SCROLL_X)));
  h.adc(h.dp(DP_SCROLL_X));
  h.write(h.abs(MATRIX_SCROLL_X), ctx.a);
  carry(h, false);
  h.load(h.read(h.abs(MATRIX_SCROLL_Y)));
  h.adc(h.dp(DP_SCROLL_Y));
  h.write(h.abs(MATRIX_SCROLL_Y), ctx.a);
  return h.rts();
}
// 81:BD62: empty all matrix object slots and stop them.
function resetMatrixObjects(h) {
  const { ctx } = h;
  h.index('x', 0);
  do {
    h.write(h.abs(MATRIX_OBJECT_TYPE) + ctx.x, 0);
    h.load(OBJECT_FLAGS_START);
    h.write(h.abs(MATRIX_OBJECT_FLAGS) + ctx.x, ctx.a);
    h.write(h.abs(MATRIX_SPEED_X) + ctx.x, 0);
    h.write(h.abs(MATRIX_SPEED_Y) + ctx.x, 0);
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.cpx(MATRIX_OBJECT_END);
  } while (!(ctx.status & FLAG_ZERO));
  return h.rts();
}
// 81:BFD8: fade the screen to white by colour addition, one level per frame.
function fadeMatrixToWhite(h, e, r) {
  return drainNativeSequence(fadeMatrixToWhiteSequence(h, e, r));
}
function* fadeMatrixToWhiteSequence(h, e, r) {
  const { ctx } = h;
  let result;
  yield () => {
    h.php();
    h.sep(FLAG_MEMORY_8BIT);
    h.portWrite(CGSWSEL, 0, 1, 0x81bfdb);
    h.load(ALL_LAYERS);
    h.portWrite(CGADSUB, ctx.a & BYTE_MASK, 1, 0x81bfe0);
    h.index('x', 0);
  };
  do {
    yield* nativeCallSequence(h, e, r, 0x81bfe6, 0x81eebb, true);
    yield () => {
      h.load(ctx.x);
      h.load(ctx.a | COLDATA_ALL);
      h.portWrite(COLDATA, ctx.a & BYTE_MASK, 1, 0x81bfed);
      h.index('x', ctx.x + 1);
      h.cpx(COLOUR_LEVELS);
    };
  } while (!(ctx.status & FLAG_ZERO));
  yield () => {
    h.plp();
    result = h.rts();
  };
  return result;
}
// 81:BFF8: fade back from white, then restore the matrix layers and colour math.
function fadeMatrixFromWhite(h, e, r) {
  return drainNativeSequence(fadeMatrixFromWhiteSequence(h, e, r));
}
function* fadeMatrixFromWhiteSequence(h, e, r) {
  const { ctx } = h;
  let result;
  yield () => {
    h.php();
    h.sep(FLAG_MEMORY_8BIT);
    h.load(MAIN_LAYERS);
    h.portWrite(TM, ctx.a & BYTE_MASK, 1, 0x81bffd);
    h.index('x', COLOUR_COMPONENT_MASK);
  };
  do {
    yield* nativeCallSequence(h, e, r, 0x81c003, 0x81eebb, true);
    yield () => {
      h.load(ctx.x);
      h.load(ctx.a | COLDATA_ALL);
      h.portWrite(COLDATA, ctx.a & BYTE_MASK, 1, 0x81c00a);
      h.index('x', ctx.x - 1);
    };
  } while (!(ctx.status & FLAG_NEGATIVE));
  yield () => {
    for (const [pc, at, value] of [
      [0x81c012, TS, LAYER_BG3],
      [0x81c017, TM, MATRIX_LAYERS],
      [0x81c01a, CGADSUB, null],
      [0x81c01f, CGSWSEL, CGSWSEL_SUB_SCREEN],
      [0x81c024, COLDATA, COLDATA_ALL],
    ]) {
      if (value !== null) h.load(value);
      h.portWrite(at, ctx.a & BYTE_MASK, 1, pc);
    }
    h.plp();
    result = h.rts();
  };
  return result;
}
// 81:C029: set up the matrix screen: the HDMA message window split, the persona at its start
// tile, the message window with the greeting, the IC text buffer and both gauges.
function setUpMatrixScreen(h, e, r) {
  return drainNativeSequence(setUpMatrixScreenSequence(h, e, r));
}
function* setUpMatrixScreenSequence(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r),
    entry = (n) => SCROLL_TABLE + n * HDMA_ENTRY_BYTES;
  let result;
  yield () => {
    h.sep(FLAG_MEMORY_8BIT);
    h.portWrite(DMAP6, 0, 1, 0x81c02b);
    h.load(BG3SC & BYTE_MASK);
    h.portWrite(BBAD6, ctx.a & BYTE_MASK, 1, 0x81c030);
    h.index('x', BG3_MAP_TABLE & WORD_MASK);
    h.portWrite(A1T6L, ctx.x, 2, 0x81c036);
    h.load(BG3_MAP_TABLE >>> WORD_BITS);
    h.portWrite(A1B6, ctx.a & BYTE_MASK, 1, 0x81c03b);
    h.load(DMAP_WRITE_TWICE);
    h.portWrite(DMAP5, ctx.a & BYTE_MASK, 1, 0x81c040);
    h.load(BG3VOFS & BYTE_MASK);
    h.portWrite(BBAD5, ctx.a & BYTE_MASK, 1, 0x81c045);
    h.index('x', SCROLL_TABLE & WORD_MASK);
    h.portWrite(A1T5L, ctx.x, 2, 0x81c04b);
    h.load(SCROLL_TABLE >>> WORD_BITS);
    h.portWrite(A1B5, ctx.a & BYTE_MASK, 1, 0x81c050);
    for (const [at, value] of [
      [entry(0), TOP_LINES],
      [entry(1), WINDOW_LINES],
      [entry(2), HDMA_LINE_COUNT_MASK],
      [entry(0) + 1, 0],
      [entry(0) + 2, null],
      [entry(1) + 1, null],
      [entry(1) + 2, null],
      [entry(2) + 1, null],
      [entry(2) + 2, null],
      [entry(HDMA_ENTRIES), null],
    ]) {
      if (value !== null) h.load(value);
      h.write(at, ctx.a);
    }
    h.load((1 << SCROLL_CHANNEL) | (1 << MAP_CHANNEL));
    h.portWrite(HDMAEN, ctx.a & BYTE_MASK, 1, 0x81c085);
    h.rep(FLAG_MEMORY_8BIT);
    h.write(h.abs(MATRIX_SCROLL_Y), 0);
    h.write(h.abs(MATRIX_SCROLL_X), 0);
    h.load(1);
    h.write(h.abs(MATRIX_STATE_CLOCK), ctx.a);
    h.write(h.abs(MATRIX_STATE_FRAMES), ctx.a);
    h.load(STATE_START);
    h.write(h.abs(MATRIX_STATE), ctx.a);
    h.load(1);
    h.write(h.abs(MATRIX_OBJECT_TYPE), ctx.a);
    h.load(PERSONA_ANIMATION & WORD_MASK);
    h.write(h.abs(MATRIX_ANIMATION), ctx.a);
    h.write(h.abs(MATRIX_ANIMATION_STEP), 0);
    for (const [at, value] of [
      [MATRIX_ANIMATION_CLOCK, 1],
      [MATRIX_ANIMATION_SPEED, PERSONA_ANIMATION_SPEED],
      [MATRIX_DIRECTION, DIRECTION_RIGHT],
    ]) {
      h.load(value);
      h.write(h.abs(at), ctx.a);
    }
    h.write(h.abs(MATRIX_SPEED_X), 0);
    h.write(h.abs(MATRIX_SPEED_Y), 0);
    call(0x81c0c6, 0x81b818);
    h.write(h.abs(MATRIX_MAP_EDIT), 0);
    call(0x81c0cc, 0x81b2a0);
    h.load(GAME_TEXT_LINES);
    h.write(h.abs(MATRIX_TEXT_LINES), ctx.a);
    h.load(GAME_TEXT_COLUMNS);
    h.write(h.abs(MATRIX_TEXT_COLUMNS), ctx.a);
    h.index('x', GREETING & WORD_MASK);
    h.index('y', GREETING >>> WORD_BITS);
    call(0x81c0e1, 0x81b282);
    h.index('x', 0);
    do {
      h.load(h.read(TEXT_TEMPLATE + ctx.x));
      h.write(TEXT_BUFFER + ctx.x, ctx.a);
      h.index('x', ctx.x + 1);
      h.index('x', ctx.x + 1);
      h.cpx(TEXT_TEMPLATE_BYTES);
    } while (!(ctx.status & FLAG_CARRY));
  };
  yield* nativeCallSequence(h, e, r, 0x81c0f6, 0x81eebb, true);
  yield () => {
    call(0x81c0fa, 0x81b228);
    call(0x81c0fd, 0x81b485);
    result = h.rts();
  };
  return result;
}
export const MATRIX_SETUP_ROUTINES = new Map([
  [0x81b4b9, toMatrixTilemapEntry],
  [0x81b4d3, uploadMatrixMap],
  [0x81b259, startNextMatrixText],
  [0x81b282, queueMatrixText],
  [0x81b2a0, resetMatrixTextWindow],
  [0x81c39f, queueMatrixMessages],
  [0x81b2d1, typeMatrixText],
  ...textCommands,
  [0x81b228, clearMatrixTextMap],
  [0x81b3d3, drawMatrixGauge],
  [0x81b473, stepShownMatrixValue],
  [0x81b485, updateMatrixGauges],
  [0x81b818, findPersonaStart],
  [0x81b84a, scrollToPersona],
  [0x81bd62, resetMatrixObjects],
  [0x81bfd8, fadeMatrixToWhite],
  [0x81bff8, fadeMatrixFromWhite],
  [0x81c029, setUpMatrixScreen],
]);
for (const [, run, sequence] of [
  [0x81bfd8, fadeMatrixToWhite, fadeMatrixToWhiteSequence],
  [0x81bff8, fadeMatrixFromWhite, fadeMatrixFromWhiteSequence],
  [0x81c029, setUpMatrixScreen, setUpMatrixScreenSequence],
])
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events, routines }) =>
      new NativeCallContinuation(h.a, sequence(h, events, routines)),
  });
