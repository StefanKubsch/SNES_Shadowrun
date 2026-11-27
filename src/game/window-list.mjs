import { waitStatus } from '../system/wait-status.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
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
// Live uploads compose the drawing and blocking wait directly without CPU frames
// or temporary banks. Entry wrappers consume only their caller-provided frame.
// Recorded observations use proof/caller/window-list.mjs independently.
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
// The original wait's branch back to its load, retained for device observations.
const UPLOAD_WAIT_BRANCH = 0x81acb2;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
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

// Request the text map upload and wait until the NMI takes it (81:ACB5/81:ACAF).
// The request word and frame jobs govern progress; no CPU frame is created.
function* requestUploadSequence(h, events) {
  const { wram } = h.a.mem;
  yield () => {
    setWord(wram, TEXT_MAP_UPLOAD, word(wram, TEXT_MAP_UPLOAD) + 1);
  };
  for (let request; (request = word(wram, TEXT_MAP_UPLOAD)) !== 0;) {
    // After LDA of a nonzero word in 16-bit mode: Z clear, N from bit 15.
    const status = waitStatus(
      h,
      events,
      FLAG_MEMORY_8BIT | FLAG_ZERO | FLAG_NEGATIVE,
      request & WORD_SIGN ? FLAG_NEGATIVE : 0,
    );
    yield* nmiAtBranch(h, events, UPLOAD_WAIT_BRANCH, status);
  }
}
// The text map upload for direct callers such as window opening.
export const requestUploadCall = (h, events) => requestUploadSequence(h, events);

// Draw the window list (81:AD92) and wait for its upload directly.
export function* drawWindowListSequence(h, events) {
  yield* windowListBody(h, events);
}

// The dialog window's list redrawn (80:CDA8), a sequence for the script native: the
// dialog window as the list's first argument, then its redraw and optional RTS.
export function* redrawDialogWindowListSequence(h, events) {
  const { wram } = h.a.mem;
  yield () => setWord(wram, 0, word(wram, DIALOG_WINDOW));
  yield* drawWindowListSequence(h, events);
}

// 81:AEB0: redraw from the first window after clearing the first index.
export function* resetWindowList(h, events) {
  yield () => {
    setWord(h.a.mem.wram, WINDOW_FIRST_INDEX, 0);
  };
  yield* drawWindowListSequence(h, events);
}
// The shared list body; memory and upload requests are explicit.
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
  yield* requestUploadSequence(h, events);
}
