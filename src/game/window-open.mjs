// Window allocation and text clearing over named records. The existing hardware
// product and upload protocol remain the presentation boundary for phase 5.
import { windowState, windowManagerState } from '../state/windows.mjs';
import { waitStatus } from '../system/wait-status.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { nmiAtBranch } from '../system/frame-wait.mjs';
import { drawWindow, requestUploadCall } from './window-list.mjs';
import { M7A, M7B, MPYL } from '../constants/hardware-registers.mjs';
import { BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';
const INDEX_LIMIT = 0x20,
  RIGHT_LIMIT = 0x1f,
  BOTTOM_LIMIT = 0x1b,
  BORDER_CELLS = 2,
  MAP_ROW_SHIFT = 5,
  MAP_ROW_CARRY_BIT = 11,
  TILE_PIXEL_SHIFT = 3,
  TILE_BYTE_SHIFT = 4,
  TILE_LIMIT = 0x2400,
  TILE_WRAP_START = 0x2027,
  VRAM_BEFORE_TILES = 0x4fff;
const PRODUCT_COLUMNS_SITE = 0x80f9ec,
  PRODUCT_HIGH_SITE = 0x80f9ef,
  PRODUCT_ROWS_SITE = 0x80f9f6,
  PRODUCT_SITE = 0x80fa01,
  PRODUCT_AGAIN_SITE = 0x80fa19,
  TILE_WAIT_BRANCH = 0x81acc0,
  TILE_ADDRESS_CARRY_BIT = 13;
function clamp(args, position, extent, limit) {
  if ((args[position] - 1) & WORD_SIGN) {
    args[position] = 1;
    return;
  }
  const last = (limit - args[extent]) & WORD_MASK;
  if (last < args[position]) args[position] = last;
}
function allocateTiles({ mem, port }, handle) {
  const state = windowManagerState(mem),
    record = windowState(mem, handle);
  port.write(
    M7A,
    ((state.opening.columns & BYTE_MASK) - BORDER_CELLS) & BYTE_MASK,
    1,
    PRODUCT_COLUMNS_SITE,
  );
  port.write(M7A, 0, 1, PRODUCT_HIGH_SITE);
  port.write(
    M7B,
    ((state.opening.rows & BYTE_MASK) - BORDER_CELLS) & BYTE_MASK,
    1,
    PRODUCT_ROWS_SITE,
  );
  let first = state.nextTile;
  const count = port.read(MPYL, 2, PRODUCT_SITE);
  record.tileCount = count;
  const add = (left, right) => {
    const result = (left + right) & WORD_MASK;
    state.nextTile = result;
    return result;
  };
  if (add(count, first) >= TILE_LIMIT) {
    first = TILE_WRAP_START;
    add(TILE_WRAP_START, port.read(MPYL, 2, PRODUCT_AGAIN_SITE));
  }
  return first;
}
export const requestTileClear = (h, events) =>
  clearTiles(h, events, windowManagerState(h.a.mem).windowArgument);
function* clearTiles(h, events, handle) {
  const { mem } = h.a,
    state = windowManagerState(mem),
    record = windowState(mem, handle);
  yield () => {
    const start = record.firstTile,
      shifted = (start << TILE_PIXEL_SHIFT) & WORD_MASK;
    state.tileUploadAddress =
      (shifted + VRAM_BEFORE_TILES + ((start >>> TILE_ADDRESS_CARRY_BIT) & 1)) & WORD_MASK;
    state.tileUploadBytes = record.tileCount << TILE_BYTE_SHIFT;
    state.tileUploadRequest++;
  };
  for (let value; (value = state.tileUploadRequest) !== 0;) {
    const status = waitStatus(
      h,
      events,
      FLAG_MEMORY_8BIT | FLAG_ZERO | FLAG_NEGATIVE,
      value & WORD_SIGN ? FLAG_NEGATIVE : 0,
    );
    yield* nmiAtBranch(h, events, TILE_WAIT_BRANCH, status);
  }
}
export function* openWindow(h, events) {
  const runtime = sceneRuntime(h),
    { mem, wram } = runtime,
    state = windowManagerState(mem);
  let handle;
  yield () => {
    handle = (state.lastIndex + 2) & WORD_MASK;
    if (handle >= INDEX_LIMIT) return;
    state.lastIndex = handle;
    const args = state.opening,
      record = windowState(mem, handle);
    clamp(args, 'left', 'columns', RIGHT_LIMIT);
    clamp(args, 'top', 'rows', BOTTOM_LIMIT);
    const top = args.top,
      shifted = (top << MAP_ROW_SHIFT) & WORD_MASK;
    record.mapOffset = (shifted + args.left + ((top >>> MAP_ROW_CARRY_BIT) & 1)) << 1;
    record.columns = args.columns;
    record.widthPixels = (args.columns - BORDER_CELLS) << TILE_PIXEL_SHIFT;
    record.rows = args.rows;
    record.attributes = args.attributes;
    for (const field of ['cursorPixel', 'leftPixel', 'style', 'unidentified']) record[field] = 0;
    record.active--;
    const first = allocateTiles(runtime, handle);
    for (const field of ['firstTile', 'initialTile', 'cursorTile']) record[field] = first;
    state.windowArgument = handle;
  };
  if (handle >= INDEX_LIMIT) return;
  yield* clearTiles(h, events, handle);
  yield () => drawWindow(wram, handle);
  yield* requestUploadCall(h, events);
}
export function* openWindowAt(h, events, [left, top, columns, rows], attributes = 0) {
  const state = windowManagerState(h.a.mem);
  yield () => {
    Object.assign(state.opening, { left, top, columns, rows, attributes });
  };
  yield* openWindow(h, events);
  return state.windowArgument;
}
export function* clearWindowText(h, events, window) {
  const state = windowManagerState(h.a.mem);
  yield () => {
    state.windowArgument = window;
  };
  yield* clearTiles(h, events, window);
}
