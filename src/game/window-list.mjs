import { waitStatus } from '../system/wait-status.mjs';
// Draw active windows through named records, preserving live map and workspace aliases.
import { windowDrawingState } from '../state/window-drawing.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { nmiAtBranch } from '../system/frame-wait.mjs';
import { unpackWindowMap } from './game-screen.mjs';
import { windowManagerState } from '../state/windows.mjs';
import { WINDOW_TEXT_FIELDS, windowsText } from '../state/windows-text.mjs';
import { stateField } from '../state/named-fields.mjs';
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

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

// Counts retain word wrap, including a zero count's full loop.
export function drawWindow(wram, x) {
  const state = windowDrawingState(wram),
    record = state.record(x);
  let y;
  const put = (tile) => {
    state.writeMap(y, tile | state.attributes);
    y = (y + 2) & WORD_MASK;
  };
  const nextRow = () => {
    const next = (state.mapRow + MAP_ROW_BYTES) & WORD_MASK;
    state.mapRow = next;
    y = next;
  };
  const across = (tile) => {
    let n = state.columns;
    do {
      put(tile);
      n = (n - 1) & WORD_MASK;
    } while (n);
  };
  state.window = x;
  state.tile = record.initialTile;
  state.attributes = record.attributes;
  state.mapRow = record.mapOffset;
  y = state.mapRow;
  put(BORDER_TOP_LEFT);
  state.columns = record.columns - BORDER_CELLS;
  across(BORDER_TOP);
  put(BORDER_TOP_RIGHT);
  let rows = (record.rows - BORDER_CELLS) & WORD_MASK;
  do {
    nextRow();
    put(BORDER_LEFT);
    state.cellsLeft = state.columns;
    // The map word counts up on its own, from the tile with the attributes.
    let tile = state.tile | state.attributes;
    do {
      state.writeMap(y, tile);
      tile = (tile + 1) & WORD_MASK;
      state.tile = state.tile + 1;
      y = (y + 2) & WORD_MASK;
      state.cellsLeft = state.cellsLeft - 1;
    } while (state.cellsLeft);
    put(BORDER_RIGHT);
    // The tiles wrap to the window's first text tile at the end of its range.
    const window = state.window,
      current = state.record(window),
      start = current.firstTile;
    if (((state.tile - start) & WORD_MASK) >= current.tileCount) state.tile = start;
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
  const state = windowManagerState(h.a.mem);
  yield () => {
    state.mapUploadRequest++;
  };
  for (let request; (request = state.mapUploadRequest) !== 0;) {
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
  const mem = h.a.mem,
    manager = windowManagerState(mem),
    dialogWindow = stateField(mem, WINDOW_TEXT_FIELDS, windowsText, 'dialogWindow');
  yield () => {
    manager.windowArgument = dialogWindow.get();
  };
  yield* drawWindowListSequence(h, events);
}

// 81:AEB0: redraw from the first window after clearing the first index.
export function* resetWindowList(h, events) {
  yield () => {
    windowManagerState(h.a.mem).firstIndex = 0;
  };
  yield* drawWindowListSequence(h, events);
}
// The shared list body; memory and upload requests are explicit.
function* windowListBody(h, events) {
  const m = sceneRuntime(h),
    { wram } = m;
  yield () => unpackWindowMap(m);
  yield () => {
    const state = windowDrawingState(wram),
      manager = state.manager,
      last = manager.lastIndex;
    if (last & WORD_SIGN) return;
    for (let x = 0; x <= last; x += 2)
      if (x >= manager.firstIndex && state.record(x).active) drawWindow(wram, x);
  };
  yield* requestUploadSequence(h, events);
}
