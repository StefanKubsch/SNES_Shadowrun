// The window list (lifted from 81:AD92 with the window drawing 81:ACCF; register-level
// versions in proof/system/native-render-compose.mjs, which recorded runs replay).
//
// Every active window from the first window index to the last is drawn into the window
// map buffer: its border and its text tile area, whose tiles count up from the
// window's initial tile and wrap within its tile range. The window map is unpacked
// first (81:A9B2, lifted in game-screen.mjs; its unpacker leaves the direct page state
// of the original) and the upload is requested afterwards (81:ACB5): the request word
// counts up and the request waits until the NMI has taken the upload (81:ACAF).
//
// Live uploads always use lag-free frames below the caller's JSL frame. Recorded
// observations use the independent former composition in proof/caller/window-list.mjs.
// Shared register/NMI interfaces are retained until their consumers are separated.
//
// The direct page words of the window drawing (the map row C3, the columns C6, the
// attributes C9, the cells left CC, the window CF and the next tile D2) are written as
// in the original; the Mesen oracle compares them.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { nmiAtBranch } from '../system/frame-wait.mjs';
import { unpackWindowMap } from './game-screen.mjs';
import {
  DIALOG_WINDOW,
  TEXT_MAP_UPLOAD,
  WINDOW_ACTIVE,
  WINDOW_ATTRIBUTES,
  WINDOW_COLUMNS,
  WINDOW_FIRST_INDEX,
  WINDOW_LAST_INDEX,
  WINDOW_MAP_BUFFER,
  WINDOW_MAP_OFFSET,
  WINDOW_ROWS,
  WINDOW_TILE_COUNT,
  WINDOW_TILE_INITIAL,
  WINDOW_TILE_START,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const DP_MAP_ROW = 0xc3,
  DP_COLUMNS = 0xc6,
  DP_ATTRIBUTES = 0xc9,
  DP_CELLS_LEFT = 0xcc,
  DP_WINDOW = 0xcf,
  DP_TILE = 0xd2;
// Border tiles: corners, edges (flip bits 14 and 15 mirror them).
const BORDER_TOP_LEFT = 0x2001,
  BORDER_TOP = 0x2002,
  BORDER_TOP_RIGHT = 0x6001,
  BORDER_LEFT = 0x2003,
  BORDER_RIGHT = 0x6003,
  BORDER_BOTTOM_LEFT = 0xa001,
  BORDER_BOTTOM = 0xa002,
  BORDER_BOTTOM_RIGHT = 0xe001,
  MAP_ROW_BYTES = 0x40,
  BORDER_CELLS = 2;
// The list runs in bank 81; the call sites of the window map unpack and the upload
// request; a JSL pushes the address of its last byte.
const LIST_BANK = 0x81,
  UPLOAD_SITE = 0x81adb5,
  JSL_LAST_BYTE = 3;
// The request's JSL to the wait 81:ACAF and the wait's branch back to its load.
const UPLOAD_WAIT_SITE = 0x81acb8,
  UPLOAD_WAIT_BRANCH = 0x81acb2;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Draw window x (a word index) into the window map buffer (81:ACCF): the top border,
// the rows with the text tiles between the side borders, the bottom border. Counts
// run as the original's 16-bit loops (a count of 0 wraps). Game state only (user
// decision 2026-11-17): the Y, carry and overflow the original leaves are produced by
// the register-level copy in proof/caller/window-list.mjs.
export function drawWindow(wram, x) {
  const field = (table) => word(wram, table + x);
  let y;
  const put = (tile) => {
    setWord(wram, WINDOW_MAP_BUFFER + y, tile | word(wram, DP_ATTRIBUTES));
    y = (y + 2) & WORD_MASK;
  };
  const nextRow = () => {
    const next = (word(wram, DP_MAP_ROW) + MAP_ROW_BYTES) & WORD_MASK;
    setWord(wram, DP_MAP_ROW, next);
    y = next;
  };
  const across = (tile) => {
    let n = word(wram, DP_COLUMNS);
    do {
      put(tile);
      n = (n - 1) & WORD_MASK;
    } while (n);
  };
  setWord(wram, DP_WINDOW, x);
  setWord(wram, DP_TILE, field(WINDOW_TILE_INITIAL));
  setWord(wram, DP_ATTRIBUTES, field(WINDOW_ATTRIBUTES));
  setWord(wram, DP_MAP_ROW, field(WINDOW_MAP_OFFSET));
  y = word(wram, DP_MAP_ROW);
  put(BORDER_TOP_LEFT);
  setWord(wram, DP_COLUMNS, field(WINDOW_COLUMNS) - BORDER_CELLS);
  across(BORDER_TOP);
  put(BORDER_TOP_RIGHT);
  let rows = (field(WINDOW_ROWS) - BORDER_CELLS) & WORD_MASK;
  do {
    nextRow();
    put(BORDER_LEFT);
    setWord(wram, DP_CELLS_LEFT, word(wram, DP_COLUMNS));
    // The map word counts up on its own, from the tile with the attributes.
    let tile = word(wram, DP_TILE) | word(wram, DP_ATTRIBUTES);
    do {
      setWord(wram, WINDOW_MAP_BUFFER + y, tile);
      tile = (tile + 1) & WORD_MASK;
      setWord(wram, DP_TILE, word(wram, DP_TILE) + 1);
      y = (y + 2) & WORD_MASK;
      setWord(wram, DP_CELLS_LEFT, word(wram, DP_CELLS_LEFT) - 1);
    } while (word(wram, DP_CELLS_LEFT));
    put(BORDER_RIGHT);
    // The tiles wrap to the window's first text tile at the end of its range.
    const window = word(wram, DP_WINDOW),
      start = word(wram, WINDOW_TILE_START + window);
    if (((word(wram, DP_TILE) - start) & WORD_MASK) >= word(wram, WINDOW_TILE_COUNT + window))
      setWord(wram, DP_TILE, start);
    rows = (rows - 1) & WORD_MASK;
  } while (rows);
  nextRow();
  put(BORDER_BOTTOM_LEFT);
  across(BORDER_BOTTOM);
  put(BORDER_BOTTOM_RIGHT);
}

// Push the frame of a JSL at site (in the running bank).
function pushLongFrame(h, site) {
  const { ctx, a } = h;
  a.write(ctx.s, ctx.programBank);
  ctx.s = (ctx.s - 1) & WORD_MASK;
  a.pushWord((site + JSL_LAST_BYTE) & WORD_MASK);
}
function pullLongFrame(h) {
  h.a.pullWord();
  h.ctx.s = (h.ctx.s + 1) & WORD_MASK;
}

// Request the text map upload and wait until the NMI takes it (81:ACB5/81:ACAF).
// callerFrame means the caller already supplied the outer JSL frame. The wait holds
// no request word in A (user decision 2026-11-17).
function* requestUploadSequence(h, events, site = UPLOAD_SITE, callerFrame = false) {
  const { ctx } = h,
    { wram } = h.a.mem,
    callerBank = ctx.programBank;
  let result;
  yield () => {
    if (!callerFrame) {
      pushLongFrame(h, site);
      ctx.programBank = LIST_BANK;
    }
    setWord(wram, TEXT_MAP_UPLOAD, word(wram, TEXT_MAP_UPLOAD) + 1);
    pushLongFrame(h, UPLOAD_WAIT_SITE);
  };
  for (let request; (request = word(wram, TEXT_MAP_UPLOAD)) !== 0;) {
    // After LDA of a nonzero word in 16-bit mode: Z clear, N from bit 15.
    const status =
      (ctx.status & ~(FLAG_MEMORY_8BIT | FLAG_ZERO | FLAG_NEGATIVE)) |
      (request & WORD_SIGN ? FLAG_NEGATIVE : 0);
    yield* nmiAtBranch(h, events, UPLOAD_WAIT_BRANCH, status);
  }
  yield () => {
    pullLongFrame(h);
    if (callerFrame) {
      result = h.rtl();
      return;
    }
    pullLongFrame(h);
    ctx.programBank = callerBank;
  };
  return result;
}
// The text map upload as a caller's JSL at site (80:F963 calls it from bank 80).
export const requestUploadCall = (h, events, site) => requestUploadSequence(h, events, site);

// The upload as called with JSL by a lifted caller that has pushed its frame (the glove
// target's list preparation 81:AEB8); the wait holds no request word in A (user decision
// 2026-11-17).
export const requestUploadJslSequence = (h, events) =>
  requestUploadSequence(h, events, UPLOAD_SITE, true);
// 81:A9B2 for lifted callers (called with JSL; nothing in it waits): the window map
// unpacked; no registers are left.
export function unpackWindowMapCall(h) {
  unpackWindowMap(sceneRuntime(h));
  return h.rtl();
}
// Draw the window list (81:AD92), a sequence; events are the frame events of the
// caller, callSite the address of its JSL. It leaves no registers; the register form
// is in proof/caller/window-list.mjs.
export function* drawWindowListSequence(h, events, callSite) {
  const { ctx } = h,
    callerBank = ctx.programBank;
  yield () => {
    pushLongFrame(h, callSite);
    ctx.programBank = LIST_BANK;
  };
  yield* windowListBody(h, events);
  yield () => {
    pullLongFrame(h);
    ctx.programBank = callerBank;
  };
}

// The dialog window's list redrawn (80:CDA8), a sequence for the script native: the
// dialog window as the list's first argument, the list (JSL at 80:CDAD), the native's
// RTS.
const REDRAW_SITE = 0x80cdad;
export function* redrawDialogWindowListSequence(h, events) {
  const { wram } = h.a.mem;
  yield () => setWord(wram, 0, word(wram, DIALOG_WINDOW));
  yield* drawWindowListSequence(h, events, REDRAW_SITE);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// 81:AEB0 (called with JSL): the window list from the first window on, after the first
// index is cleared; the list's JSL at 81:AEB3, then the RTL.
const RESET_LIST_SITE = 0x81aeb3;
export function* resetWindowListSequence(h, events) {
  yield () => {
    setWord(h.a.mem.wram, WINDOW_FIRST_INDEX, 0);
    h.ctx.programBank = LIST_BANK;
  };
  yield* drawWindowListSequence(h, events, RESET_LIST_SITE);
  let result;
  yield () => {
    result = h.rtl();
  };
  return result;
}
// The list below its JSL frame, in bank 81.
function* windowListBody(h, events) {
  const m = sceneRuntime(h),
    { wram } = m;
  yield () => unpackWindowMap(m);
  yield () => {
    const last = word(wram, WINDOW_LAST_INDEX);
    if (last & WORD_SIGN) return;
    for (let x = 0; x <= last; x += 2)
      if (x >= word(wram, WINDOW_FIRST_INDEX) && word(wram, WINDOW_ACTIVE + x)) drawWindow(wram, x);
  };
  yield* requestUploadSequence(h, events, UPLOAD_SITE);
}
