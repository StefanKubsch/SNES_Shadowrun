// The camera scroll of the room entry's camera jump (lifted from 81:8A91 and 81:8954;
// register-level versions in src/task/main-loop-camera.mjs and
// src/task/main-transition.mjs, which the main loop and the game NMI still call).
//
// The scene's two layer maps lie in WRAM (SCENE_LAYER_HIGH for BG1, SCENE_LAYER_LOW
// for BG2), one layer row of 0x80 bytes per screen column. The BG maps in VRAM hold
// 32 x 32 tiles and wrap. When the camera crosses a tile column or row, the tile
// buffers copy the 32 words of the newly visible map column or row into the edge
// buffers and mark them; the map edge upload sends marked buffers to VRAM by DMA and
// sets the scroll registers of both layers.
//
// The tile buffers write the direct page words the original uses as locals: the old
// and new column and row (11, 17, 0E, 14), the row as a word offset (1A), the column
// as a layer offset (1D) and the end of the column copy (20); the row copy leaves its
// end in 0E. The clamped positions are at most CAMERA_X_MAX and CAMERA_Y_MAX, so none
// of the original's additions carries.
import {
  CAMERA_SPEED_X,
  CAMERA_SPEED_Y,
  CAMERA_X,
  CAMERA_X_MAX,
  CAMERA_Y,
  CAMERA_Y_MAX,
  MAP_COLUMN_BG1,
  MAP_COLUMN_BG2,
  MAP_COLUMN_UPLOAD,
  MAP_COLUMN_VRAM_BG1,
  MAP_COLUMN_VRAM_BG2,
  MAP_LINE_BYTES,
  MAP_ROW_BG1,
  MAP_ROW_BG2,
  MAP_ROW_UPLOAD,
  MAP_ROW_VRAM_BG1,
  MAP_ROW_VRAM_BG2,
  SCENE_LAYER_HIGH,
  SCENE_LAYER_LOW,
  SCENE_LAYER_ROW_BYTES,
} from '../task/wram.mjs';
import {
  A1T3L,
  BG1HOFS,
  BG1VOFS,
  DAS3L,
  DMA_CHANNEL_STRIDE,
  DMAP0,
  DMAP3,
  MDMAEN,
  VMADDL,
  VMAINC,
} from '../constants/hardware-registers.mjs';
import { VMAINC_INCREMENT_AFTER_HIGH, VMAINC_STEP_32 } from '../constants/ppu.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

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
// The direct page words of the tile buffers.
const DP_COLUMN = 0x0e,
  DP_OLD_COLUMN = 0x11,
  DP_ROW = 0x14,
  DP_OLD_ROW = 0x17,
  DP_ROW_OFFSET = 0x1a,
  DP_COLUMN_OFFSET = 0x1d,
  DP_COLUMN_END = 0x20;
// The map edges use DMA channel 3; the scroll registers take camera / 4.
const MAP_CHANNEL = 1 << ((DMAP3 - DMAP0) / DMA_CHANNEL_STRIDE),
  SCROLL_SHIFT = 2,
  SECOND_LAYER = 2;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const negative = (value) => (value & WORD_SIGN) !== 0;

// Move one camera axis by its speed, clamped to 0 and the maximum (a clamp stops the
// axis); return the tile before the move.
function moveAxis(wram, position, speed, maximum) {
  const before = word(wram, position) >>> CAMERA_TILE_SHIFT;
  let value = (word(wram, position) + word(wram, speed)) & WORD_MASK;
  if (negative(value) || value >= maximum) {
    setWord(wram, speed, 0);
    value = negative(value) ? 0 : maximum;
  }
  setWord(wram, position, value);
  return before;
}

// Copy 32 words of both layers into the edge buffers, starting at layer offset from
// and buffer offset start, which wraps after one map line.
function copyEdge(wram, from, step, start, bg1, bg2) {
  let at = start;
  do {
    setWord(wram, bg1 + at, word(wram, SCENE_LAYER_HIGH + from));
    setWord(wram, bg2 + at, word(wram, SCENE_LAYER_LOW + from));
    from = (from + step) & WORD_MASK;
    at += WORD_BYTES;
    if (at === MAP_LINE_BYTES) at = 0;
  } while (at !== start);
}

// Move the camera by its speeds and fill the edge buffers of a newly crossed tile
// column or row (81:8A91). Returns the X and Y the original leaves, from the incoming
// y: the horizontal speed and y without a copy, else the layer offset after the last
// copy and the buffer offset it started at.
export function updateTileBuffers(wram, y = 0) {
  const registers = { x: 0, y };
  setWord(wram, DP_OLD_COLUMN, moveAxis(wram, CAMERA_X, CAMERA_SPEED_X, CAMERA_X_MAX));
  setWord(wram, DP_OLD_ROW, moveAxis(wram, CAMERA_Y, CAMERA_SPEED_Y, CAMERA_Y_MAX));
  // Moving left or up, the old tile counts one further, as the new one.
  const left = negative(word(wram, CAMERA_SPEED_X)),
    up = negative(word(wram, CAMERA_SPEED_Y));
  let row = word(wram, CAMERA_Y) >>> CAMERA_TILE_SHIFT;
  if (up) {
    setWord(wram, DP_OLD_ROW, word(wram, DP_OLD_ROW) + 1);
    row++;
  }
  setWord(wram, DP_ROW, row);
  setWord(wram, DP_ROW_OFFSET, row * WORD_BYTES);
  let column = word(wram, CAMERA_X) >>> CAMERA_TILE_SHIFT;
  if (left) {
    setWord(wram, DP_OLD_COLUMN, word(wram, DP_OLD_COLUMN) + 1);
    column++;
  }
  setWord(wram, DP_COLUMN, column);
  setWord(wram, DP_COLUMN_OFFSET, column * SCENE_LAYER_ROW_BYTES);
  registers.x = word(wram, CAMERA_SPEED_X);
  if (column !== word(wram, DP_OLD_COLUMN)) {
    const vram = (column & MAP_TILE_MASK) + BG1_MAP_VRAM;
    setWord(wram, MAP_COLUMN_VRAM_BG1, vram);
    setWord(wram, MAP_COLUMN_VRAM_BG2, vram + BG2_MAP_VRAM - BG1_MAP_VRAM);
    const from =
      column * SCENE_LAYER_ROW_BYTES +
      (left ? 0 : COLUMN_AHEAD) +
      row * WORD_BYTES +
      (up ? 0 : WORD_BYTES);
    const start = ((row + (up ? 0 : 1)) & MAP_TILE_MASK) * WORD_BYTES;
    setWord(wram, DP_COLUMN_END, start);
    copyEdge(wram, from, WORD_BYTES, start, MAP_COLUMN_BG1, MAP_COLUMN_BG2);
    registers.x = (from + MAP_TILES * WORD_BYTES) & WORD_MASK;
    registers.y = start;
    setWord(wram, MAP_COLUMN_UPLOAD, word(wram, MAP_COLUMN_UPLOAD) + 1);
  }
  if (row !== word(wram, DP_OLD_ROW)) {
    const vram = ((row & MAP_TILE_MASK) << MAP_ROW_WORDS_SHIFT) + BG1_MAP_VRAM;
    setWord(wram, MAP_ROW_VRAM_BG1, vram);
    setWord(wram, MAP_ROW_VRAM_BG2, vram + BG2_MAP_VRAM - BG1_MAP_VRAM);
    const from =
      row * WORD_BYTES +
      (up ? 0 : ROW_AHEAD) +
      word(wram, DP_COLUMN_OFFSET) +
      (left ? 0 : SCENE_LAYER_ROW_BYTES);
    const start = ((column + (left ? 0 : 1)) & MAP_TILE_MASK) * WORD_BYTES;
    setWord(wram, DP_COLUMN, start);
    copyEdge(wram, from, SCENE_LAYER_ROW_BYTES, start, MAP_ROW_BG1, MAP_ROW_BG2);
    registers.x = (from + MAP_TILES * SCENE_LAYER_ROW_BYTES) & WORD_MASK;
    registers.y = start;
    setWord(wram, MAP_ROW_UPLOAD, word(wram, MAP_ROW_UPLOAD) + 1);
  }
  return registers;
}

// Send the marked map column (VRAM step 32) and row (step 1) of BG1 and BG2 by DMA,
// then the scroll registers of both layers (81:8954). The DMA channel's mode, B-bus
// register and source bank are set by the game screen.
export function uploadMapEdges(wram, video) {
  for (const [pending, bg1, bg2, vram1, vram2, increment] of [
    [
      MAP_COLUMN_UPLOAD,
      MAP_COLUMN_BG1,
      MAP_COLUMN_BG2,
      MAP_COLUMN_VRAM_BG1,
      MAP_COLUMN_VRAM_BG2,
      VMAINC_INCREMENT_AFTER_HIGH | VMAINC_STEP_32,
    ],
    [
      MAP_ROW_UPLOAD,
      MAP_ROW_BG1,
      MAP_ROW_BG2,
      MAP_ROW_VRAM_BG1,
      MAP_ROW_VRAM_BG2,
      VMAINC_INCREMENT_AFTER_HIGH,
    ],
  ]) {
    if (!word(wram, pending)) continue;
    video.write(A1T3L, bg1, 2);
    video.write(DAS3L, MAP_LINE_BYTES, 2);
    video.write(VMADDL, word(wram, vram1), 2);
    video.write(VMAINC, increment, 1);
    video.write(MDMAEN, MAP_CHANNEL, 1);
    video.write(A1T3L, bg2, 2);
    video.write(DAS3L, MAP_LINE_BYTES, 2);
    video.write(VMADDL, word(wram, vram2), 2);
    video.write(MDMAEN, MAP_CHANNEL, 1);
    setWord(wram, pending, 0);
  }
  // Each scroll register takes the low byte, then a zero high byte.
  for (const [position, register] of [
    [CAMERA_X, BG1HOFS],
    [CAMERA_Y, BG1VOFS],
  ]) {
    const scroll = (word(wram, position) >>> SCROLL_SHIFT) & BYTE_MASK;
    for (const port of [register, register + SECOND_LAYER]) {
      video.write(port, scroll, 1);
      video.write(port, 0, 1);
    }
  }
}
