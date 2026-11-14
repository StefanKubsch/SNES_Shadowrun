// Opening a window (lifted from 80:F963 with the tile upload request 80:FA67; register-
// level version in src/task/native-window-open.mjs, which the other callers still use).
//
// The caller sets the window's left column and top row in the direct page words 00
// and 02, its columns and rows (with the border) in 04 and 06 and its attributes in 08.
// The window takes the next window index (up to 1E; past it nothing opens). A window
// that would leave the 32 x 28 map is moved left or up, a position 0 becomes 1. Its
// text tiles follow the last window's (7E:0212), (columns - 2) x (rows - 2) of them,
// wrapping to tile 2027 past 2400; the product runs on the PPU's multiplier (M7A, M7B,
// MPYL; Book I 2-27-1, signed 16 x 8), through the port as in the original. The tiles
// are cleared in video memory (a request of the NMI, 7E:01F6), the window is drawn into
// the window map (81:ACCF, window-list.mjs) and the map is uploaded (81:ACB5). The window
// index is left in the direct page word 00.
//
// Registers: the routine leaves X the window index, A 0 with zero set, and Y, the carry
// and the overflow of the window drawing (its last map row), as the original; past the
// last index X the index, the carry set and A, Y and the overflow unchanged. The tile
// request waits with the lag-free frame model at its branch 81:ACC0 below the frames of
// its JSR and JSL, with A the request word and the original's X, Y, carry and overflow;
// with recorded observations or interrupts it replays them as the original. The window
// drawing's own pushes are not reproduced.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import {
  requestWindowUploadAdapter,
  requestWindowUploadSequence,
} from '../task/native-menu-compose.mjs';
import { nmiAtBranch } from '../system/frame-wait.mjs';
import { drawWindow, requestUploadCall } from './window-list.mjs';
import {
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  TEXT_TILE_UPLOAD,
  TEXT_TILE_UPLOAD_ADDRESS,
  TEXT_TILE_UPLOAD_BYTES,
  WINDOW_ACTIVE,
  WINDOW_ATTRIBUTES,
  WINDOW_COLUMNS,
  WINDOW_CURSOR_PIXEL,
  WINDOW_CURSOR_TILE,
  WINDOW_LAST_INDEX,
  WINDOW_LEFT_PIXEL,
  WINDOW_MAP_OFFSET,
  WINDOW_NEXT_TILE,
  WINDOW_ROWS,
  WINDOW_STYLE,
  WINDOW_TILE_COUNT,
  WINDOW_TILE_INITIAL,
  WINDOW_TILE_START,
  WINDOW_WIDTH_PIXELS,
} from '../task/wram.mjs';
import { M7A, M7B, MPYL } from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';

const DP_LEFT = 0x00,
  DP_TOP = 0x02,
  INDEX_LIMIT = 0x20,
  RIGHT_LIMIT = 0x1f,
  BOTTOM_LIMIT = 0x1b,
  BORDER_CELLS = 2,
  // A map row is 32 words: (top * 32 + left) * 2.
  MAP_ROW_SHIFT = 5,
  MAP_ROW_CARRY_BIT = 11,
  TILE_PIXEL_SHIFT = 3,
  TILE_BYTE_SHIFT = 4,
  TILE_LIMIT = 0x2400,
  TILE_WRAP_START = 0x2027,
  // Text tiles start at VRAM word 5000; the request takes the address before the first.
  VRAM_BEFORE_TILES = 0x4fff,
  // A window field whose role is unproved; it is cleared with the cursor and style.
  WINDOW_FIELD_2160 = 0x2160;
// Original sites: the product's accesses, the tile request's JSR and its JSL to the
// wait, the wait loop's load and branch, the window drawing's and the map upload's JSL.
const PRODUCT_COLUMNS_SITE = 0x80f9ec,
  PRODUCT_HIGH_SITE = 0x80f9ef,
  PRODUCT_ROWS_SITE = 0x80f9f6,
  PRODUCT_SITE = 0x80fa01,
  PRODUCT_AGAIN_SITE = 0x80fa19,
  TILE_REQUEST_SITE = 0x80fa32,
  TILE_WAIT_SITE = 0x80fa84,
  TILE_REQUEST = 0x80fa67,
  TILE_WAIT_BRANCH = 0x81acc0,
  MAP_UPLOAD_SITE = 0x80fa39,
  JSR_LAST_BYTE = 2,
  JSL_LAST_BYTE = 3,
  WAIT_BANK = 0x81,
  CALLER_BANK = 0x80,
  // The carries of the shifts: bit 13 of the first tile (three ASL), bit 12 of the
  // tile count (four ASL).
  TILE_ADDRESS_CARRY_BIT = 13,
  TILE_BYTES_CARRY_BIT = 12;
const TILE_ROUTINES = new Map([[TILE_REQUEST, requestWindowUploadAdapter]]);

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};

// Clamp the position in the direct page word at: 0 becomes 1, a window past the limit
// moves back (the flags are replaced before they are read).
function clamp(wram, at, extent, limit) {
  if ((word(wram, at) - 1) & WORD_SIGN) {
    setWord(wram, at, 1);
    return;
  }
  const size = word(wram, extent),
    last = (limit - size) & WORD_MASK;
  if (last < word(wram, at)) setWord(wram, at, last);
}

// The window's text tiles: (columns - 2) x (rows - 2) after the last window's, wrapping
// to 2027 past 2400. Returns the first tile; the caller's flags are those of the last
// addition.
function allocateTiles({ wram, port }, ctx, x) {
  port.write(M7A, (wram[DP_WINDOW_COLUMNS] - BORDER_CELLS) & BYTE_MASK, 1, PRODUCT_COLUMNS_SITE);
  port.write(M7A, 0, 1, PRODUCT_HIGH_SITE);
  port.write(M7B, (wram[DP_WINDOW_ROWS] - BORDER_CELLS) & BYTE_MASK, 1, PRODUCT_ROWS_SITE);
  let first = word(wram, WINDOW_NEXT_TILE);
  const count = port.read(MPYL, 2, PRODUCT_SITE);
  setWord(wram, WINDOW_TILE_COUNT + x, count);
  const add = (left, right) => {
    const sum = left + right,
      result = sum & WORD_MASK;
    flag(ctx, FLAG_CARRY, sum > WORD_MASK);
    flag(ctx, FLAG_OVERFLOW, ~(left ^ right) & (left ^ result) & WORD_SIGN);
    setWord(wram, WINDOW_NEXT_TILE, result);
    return result;
  };
  if (add(count, first) >= TILE_LIMIT) {
    first = TILE_WRAP_START;
    add(TILE_WRAP_START, port.read(MPYL, 2, PRODUCT_AGAIN_SITE));
  }
  return first;
}

// Push the frame of a JSR or JSL at site (in the running bank) and pull it again.
function pushFrame(h, site, long) {
  const { ctx, a } = h;
  if (long) {
    a.write(ctx.s, ctx.programBank);
    ctx.s = (ctx.s - 1) & WORD_MASK;
  }
  a.pushWord((site + (long ? JSL_LAST_BYTE : JSR_LAST_BYTE)) & WORD_MASK);
}
function pullFrame(h, long) {
  h.a.pullWord();
  if (long) h.ctx.s = (h.ctx.s + 1) & WORD_MASK;
}

// The tile request (80:FA67): clear the window's text tiles in video memory with the
// NMI's next upload, and wait for it (81:ACBD). Without the lag-free frame model the
// register-level request runs through its frame.
function* requestTileClear(h, events, x) {
  if (!lagFree(events)) {
    yield* nativeCallSequence(h, events, TILE_ROUTINES, TILE_REQUEST_SITE, TILE_REQUEST);
    return;
  }
  yield () => pushFrame(h, TILE_REQUEST_SITE, false);
  yield* clearTiles(h, events, x);
  yield () => pullFrame(h, false);
}

// The tile request 80:FA67 on its own, as other routines call it with JSR (their
// sequence pushes the frame): the window in the direct page word 00. It leaves A 0 with
// zero set and sign clear, X the window, Y unchanged and the carry and overflow of its
// shifts and address addition, as the original. Without the lag-free frame model the
// register-level request runs.
export function* requestTileClearSequence(h, events) {
  if (!lagFree(events)) return yield* requestWindowUploadSequence(h.a, events, false);
  yield* clearTiles(h, events, word(h.a.mem.wram, DP_LEFT));
  let result;
  yield () => {
    flag(h.ctx, FLAG_ZERO, true);
    flag(h.ctx, FLAG_NEGATIVE, false);
    result = h.rts();
  };
  return result;
}

// The request's work and its wait 81:ACBD below the JSL frame, inside the JSR frame.
function* clearTiles(h, events, x) {
  const { ctx } = h,
    { wram } = h.a.mem;
  yield () => {
    const start = word(wram, WINDOW_TILE_START + x),
      shifted = (start << TILE_PIXEL_SHIFT) & WORD_MASK,
      address =
        (shifted + VRAM_BEFORE_TILES + ((start >>> TILE_ADDRESS_CARRY_BIT) & 1)) & WORD_MASK;
    setWord(wram, TEXT_TILE_UPLOAD_ADDRESS, address);
    const count = word(wram, WINDOW_TILE_COUNT + x);
    setWord(wram, TEXT_TILE_UPLOAD_BYTES, count << TILE_BYTE_SHIFT);
    setWord(wram, TEXT_TILE_UPLOAD, word(wram, TEXT_TILE_UPLOAD) + 1);
    // The overflow of the address addition and the carry of the bytes' last shift.
    flag(ctx, FLAG_OVERFLOW, ~(shifted ^ VRAM_BEFORE_TILES) & (shifted ^ address) & WORD_SIGN);
    flag(ctx, FLAG_CARRY, (count >>> TILE_BYTES_CARRY_BIT) & 1);
    ctx.x = x;
    pushFrame(h, TILE_WAIT_SITE, true);
    ctx.programBank = WAIT_BANK;
  };
  for (let value; (value = word(wram, TEXT_TILE_UPLOAD)) !== 0;) {
    ctx.a = value;
    const status =
      (ctx.status & ~(FLAG_MEMORY_8BIT | FLAG_ZERO | FLAG_NEGATIVE)) |
      (value & WORD_SIGN ? FLAG_NEGATIVE : 0);
    yield* nmiAtBranch(h, events, TILE_WAIT_BRANCH, status);
  }
  yield () => {
    pullFrame(h, true);
    ctx.programBank = CALLER_BANK;
    ctx.a = 0;
  };
}

// Open the window of the direct page words 00 to 08 (80:F963), a sequence for a native
// call continuation: h the caller's access (direct page 0, data bank 80).
export function* openWindowSequence(h, events) {
  const { ctx } = h,
    m = sceneRuntime(h),
    { wram } = m;
  let x;
  yield () => {
    x = (word(wram, WINDOW_LAST_INDEX) + 2) & WORD_MASK;
    ctx.x = x;
    flag(ctx, FLAG_CARRY, x >= INDEX_LIMIT);
    flag(ctx, FLAG_NEGATIVE, (x - INDEX_LIMIT) & WORD_SIGN);
    flag(ctx, FLAG_ZERO, x === INDEX_LIMIT);
    if (x >= INDEX_LIMIT) return;
    setWord(wram, WINDOW_LAST_INDEX, x);
    clamp(wram, DP_LEFT, DP_WINDOW_COLUMNS, RIGHT_LIMIT);
    clamp(wram, DP_TOP, DP_WINDOW_ROWS, BOTTOM_LIMIT);
    // (top * 32 + left) * 2: the ASLs' last carry goes into the addition.
    const top = word(wram, DP_TOP),
      shifted = (top << MAP_ROW_SHIFT) & WORD_MASK;
    const offset = (shifted + word(wram, DP_LEFT) + ((top >>> MAP_ROW_CARRY_BIT) & 1)) << 1;
    setWord(wram, WINDOW_MAP_OFFSET + x, offset);
    const columns = word(wram, DP_WINDOW_COLUMNS);
    setWord(wram, WINDOW_COLUMNS + x, columns);
    setWord(wram, WINDOW_WIDTH_PIXELS + x, (columns - BORDER_CELLS) << TILE_PIXEL_SHIFT);
    setWord(wram, WINDOW_ROWS + x, word(wram, DP_WINDOW_ROWS));
    setWord(wram, WINDOW_ATTRIBUTES + x, word(wram, DP_WINDOW_ATTRIBUTES));
    for (const field of [WINDOW_CURSOR_PIXEL, WINDOW_LEFT_PIXEL, WINDOW_STYLE, WINDOW_FIELD_2160])
      setWord(wram, field + x, 0);
    setWord(wram, WINDOW_ACTIVE + x, word(wram, WINDOW_ACTIVE + x) - 1);
    const first = allocateTiles(m, ctx, x);
    for (const field of [WINDOW_TILE_START, WINDOW_TILE_INITIAL, WINDOW_CURSOR_TILE])
      setWord(wram, field + x, first);
    setWord(wram, DP_LEFT, x);
  };
  if (x >= INDEX_LIMIT) return yield* rts(h);
  yield* requestTileClear(h, events, x);
  yield () => {
    const drawn = drawWindow(wram, x);
    ctx.y = drawn.y;
    flag(ctx, FLAG_OVERFLOW, drawn.overflow);
    flag(ctx, FLAG_CARRY, drawn.carry);
  };
  yield* requestUploadCall(h, events, MAP_UPLOAD_SITE);
  yield () => {
    ctx.a = 0;
    flag(ctx, FLAG_ZERO, true);
    flag(ctx, FLAG_NEGATIVE, false);
  };
  return yield* rts(h);
}
function* rts(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
