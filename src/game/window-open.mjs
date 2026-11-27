import { waitStatus } from '../system/wait-status.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
// Opening a window (lifted from 80:F963 with the tile upload request 80:FA67; register-
// level version in proof/replay/native-window-open.mjs, which the other callers still use).
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
// Registers (user decision 2026-11-17): game state only; the routine leaves no A, X, Y
// or flags (its callers read the window index from the direct page word 00). The tile
// request waits with the lag-free frame model at its branch 81:ACC0 without a CPU
// frame or bank switch. Recorded observations use the former
// caller retained in proof/caller/window-open.mjs. Drawing's pushes are not reproduced.
import { sceneRuntime } from '../system/scene-runtime.mjs';
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
} from '../data/wram.mjs';
import { M7A, M7B, MPYL } from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

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
// Original product access sites and the blocking tile wait branch.
const PRODUCT_COLUMNS_SITE = 0x80f9ec,
  PRODUCT_HIGH_SITE = 0x80f9ef,
  PRODUCT_ROWS_SITE = 0x80f9f6,
  PRODUCT_SITE = 0x80fa01,
  PRODUCT_AGAIN_SITE = 0x80fa19,
  TILE_WAIT_BRANCH = 0x81acc0,
  // The carry of the first tile's shifts (bit 13, three ASL) enters the address.
  TILE_ADDRESS_CARRY_BIT = 13;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
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
// to 2027 past 2400. Returns the first tile.
function allocateTiles({ wram, port }, x) {
  port.write(
    M7A,
    (readStateByte(wram, DP_WINDOW_COLUMNS) - BORDER_CELLS) & BYTE_MASK,
    1,
    PRODUCT_COLUMNS_SITE,
  );
  port.write(M7A, 0, 1, PRODUCT_HIGH_SITE);
  port.write(
    M7B,
    (readStateByte(wram, DP_WINDOW_ROWS) - BORDER_CELLS) & BYTE_MASK,
    1,
    PRODUCT_ROWS_SITE,
  );
  let first = word(wram, WINDOW_NEXT_TILE);
  const count = port.read(MPYL, 2, PRODUCT_SITE);
  setWord(wram, WINDOW_TILE_COUNT + x, count);
  const add = (left, right) => {
    const result = (left + right) & WORD_MASK;
    setWord(wram, WINDOW_NEXT_TILE, result);
    return result;
  };
  if (add(count, first) >= TILE_LIMIT) {
    first = TILE_WRAP_START;
    add(TILE_WRAP_START, port.read(MPYL, 2, PRODUCT_AGAIN_SITE));
  }
  return first;
}

// The tile request (80:FA67): clear the window's text tiles in video memory with the
// NMI's next upload, and wait for it (81:ACBD). The window opening runs it directly
// (clearTiles); the return word of its JSR lies only in free stack bytes and is not
// reproduced (game state only, user decision 2026-11-17).

// The tile request 80:FA67 on its own for lifted callers, without the JSR frame (the
// caller's return word lies only in free stack bytes): the window in the direct page
// word 00. It leaves no registers.
export const requestTileClear = (h, events) => clearTiles(h, events, word(h.a.mem.wram, DP_LEFT));

// The request and its wait 81:ACBD, composed without a call frame.
function* clearTiles(h, events, x) {
  const { wram } = h.a.mem;
  yield () => {
    const start = word(wram, WINDOW_TILE_START + x),
      shifted = (start << TILE_PIXEL_SHIFT) & WORD_MASK,
      address =
        (shifted + VRAM_BEFORE_TILES + ((start >>> TILE_ADDRESS_CARRY_BIT) & 1)) & WORD_MASK;
    setWord(wram, TEXT_TILE_UPLOAD_ADDRESS, address);
    const count = word(wram, WINDOW_TILE_COUNT + x);
    setWord(wram, TEXT_TILE_UPLOAD_BYTES, count << TILE_BYTE_SHIFT);
    setWord(wram, TEXT_TILE_UPLOAD, word(wram, TEXT_TILE_UPLOAD) + 1);
  };
  // The wait's branch sees the request word's sign in 16-bit mode.
  for (let value; (value = word(wram, TEXT_TILE_UPLOAD)) !== 0;) {
    const status = waitStatus(
      h,
      events,
      FLAG_MEMORY_8BIT | FLAG_ZERO | FLAG_NEGATIVE,
      value & WORD_SIGN ? FLAG_NEGATIVE : 0,
    );
    yield* nmiAtBranch(h, events, TILE_WAIT_BRANCH, status);
  }
}

// Open the window of the direct page words 00 to 08 (80:F963) for lifted callers,
// without the JSR frame: the return word of the caller's JSR lies only in free stack
// bytes (game state only, user decision 2026-11-17). h is the caller's access (direct
// page 0, data bank 80).
export function* openWindow(h, events) {
  const m = sceneRuntime(h),
    { wram } = m;
  let x;
  yield () => {
    x = (word(wram, WINDOW_LAST_INDEX) + 2) & WORD_MASK;
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
    const first = allocateTiles(m, x);
    for (const field of [WINDOW_TILE_START, WINDOW_TILE_INITIAL, WINDOW_CURSOR_TILE])
      setWord(wram, field + x, first);
    setWord(wram, DP_LEFT, x);
  };
  if (x >= INDEX_LIMIT) return;
  yield* clearTiles(h, events, x);
  yield () => drawWindow(wram, x);
  yield* requestUploadCall(h, events);
}

// Named entries for callers that hold their windows by number (docs/READABLE-GAME.md):
// open a window over the cells [left, top, columns, rows] with its attributes and return
// its number (with no window free, the left column, as the original leaves its result);
// clear the text of a window.
export function* openWindowAt(h, events, [left, top, columns, rows], attributes = 0) {
  const { wram } = h.a.mem;
  yield () => {
    setWord(wram, DP_LEFT, left);
    setWord(wram, DP_TOP, top);
    setWord(wram, DP_WINDOW_COLUMNS, columns);
    setWord(wram, DP_WINDOW_ROWS, rows);
    setWord(wram, DP_WINDOW_ATTRIBUTES, attributes);
  };
  yield* openWindow(h, events);
  return word(wram, DP_LEFT);
}
export function* clearWindowText(h, events, window) {
  yield () => setWord(h.a.mem.wram, DP_LEFT, window);
  yield* clearTiles(h, events, window);
}
