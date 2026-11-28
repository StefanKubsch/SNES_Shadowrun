// Move the camera and populate newly visible map rows and columns through named
// state. Map byte offsets and address arithmetic remain the presentation boundary.
import { cameraScrollingState } from '../state/camera-scrolling.mjs';
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
export { uploadMapEdges } from '../platform/map-edges.mjs';
const CAMERA_X_MAX = 0x800,
  CAMERA_Y_MAX = 0x47c,
  SCENE_LAYER_ROW_BYTES = 0x80,
  MAP_LINE_BYTES = 0x40;
// VRAM word addresses of the BG1 and BG2 maps (src/game/game-screen.mjs).
const BG1_MAP_VRAM = 0x7000,
  BG2_MAP_VRAM = 0x7400;
// Camera units per tile: 4 per pixel, 8 pixels. The BG maps wrap after 32 tiles, one
// map row is 32 words.
const CAMERA_TILE_SHIFT = 5,
  MAP_TILES = 32,
  MAP_TILE_MASK = MAP_TILES - 1,
  MAP_ROW_WORDS_SHIFT = 5,
  WORD_BYTES = 2;
// Moving right, the column copy starts one screen width ahead (32 layer rows); moving
// down, the row copy one screen height ahead (32 words). Moving down also starts the
// column copy one word further, moving right the row copy one layer row further.
const COLUMN_AHEAD = MAP_TILES * SCENE_LAYER_ROW_BYTES,
  ROW_AHEAD = MAP_LINE_BYTES;
const negative = (value) => (value & WORD_SIGN) !== 0;

// Move one camera axis by its speed, clamped to 0 and the maximum (a clamp stops the
// axis); return the tile before the move.
function moveAxis(camera, position, speed, maximum) {
  const before = camera[position] >>> CAMERA_TILE_SHIFT;
  let value = (camera[position] + camera[speed]) & WORD_MASK;
  if (negative(value) || value >= maximum) {
    camera[speed] = 0;
    value = negative(value) ? 0 : maximum;
  }
  camera[position] = value;
  return before;
}

// Copy 32 words of both layers into the edge buffers, starting at layer offset from
// and buffer offset start, which wraps after one map line.
function copyEdge(state, from, step, start, edge) {
  let at = start;
  do {
    edge.writeHigh(at, state.readHigh(from));
    edge.writeLow(at, state.readLow(from));
    from = (from + step) & WORD_MASK;
    at += WORD_BYTES;
    if (at === MAP_LINE_BYTES) at = 0;
  } while (at !== start);
}

// Move the camera by its speeds and fill the edge buffers of a newly crossed tile
// column or row (81:8A91). Game state only (user decision 2026-11-17): the X and Y the
// original leaves are not produced.
export function updateTileBuffers(wram) {
  const state = cameraScrollingState(wram);
  state.oldColumn = moveAxis(state.camera, 'x', 'speedX', CAMERA_X_MAX);
  state.oldRow = moveAxis(state.camera, 'y', 'speedY', CAMERA_Y_MAX);
  // Moving left or up, the old tile counts one further, as the new one.
  const left = negative(state.camera.speedX),
    up = negative(state.camera.speedY);
  let row = state.camera.y >>> CAMERA_TILE_SHIFT;
  if (up) {
    state.oldRow = state.oldRow + 1;
    row++;
  }
  state.row = row;
  state.rowOffset = row * WORD_BYTES;
  let column = state.camera.x >>> CAMERA_TILE_SHIFT;
  if (left) {
    state.oldColumn = state.oldColumn + 1;
    column++;
  }
  state.column = column;
  state.columnOffset = column * SCENE_LAYER_ROW_BYTES;
  if (column !== state.oldColumn) {
    const vram = (column & MAP_TILE_MASK) + BG1_MAP_VRAM;
    state.columnEdge.addressHigh = vram;
    state.columnEdge.addressLow = vram + BG2_MAP_VRAM - BG1_MAP_VRAM;
    const from =
      column * SCENE_LAYER_ROW_BYTES +
      (left ? 0 : COLUMN_AHEAD) +
      row * WORD_BYTES +
      (up ? 0 : WORD_BYTES);
    const start = ((row + (up ? 0 : 1)) & MAP_TILE_MASK) * WORD_BYTES;
    state.columnEnd = start;
    copyEdge(state, from, WORD_BYTES, start, state.columnEdge);
    state.columnEdge.pending = state.columnEdge.pending + 1;
  }
  if (row !== state.oldRow) {
    const vram = ((row & MAP_TILE_MASK) << MAP_ROW_WORDS_SHIFT) + BG1_MAP_VRAM;
    state.rowEdge.addressHigh = vram;
    state.rowEdge.addressLow = vram + BG2_MAP_VRAM - BG1_MAP_VRAM;
    const from =
      row * WORD_BYTES +
      (up ? 0 : ROW_AHEAD) +
      state.columnOffset +
      (left ? 0 : SCENE_LAYER_ROW_BYTES);
    const start = ((column + (left ? 0 : 1)) & MAP_TILE_MASK) * WORD_BYTES;
    state.column = start;
    copyEdge(state, from, SCENE_LAYER_ROW_BYTES, start, state.rowEdge);
    state.rowEdge.pending = state.rowEdge.pending + 1;
  }
}
