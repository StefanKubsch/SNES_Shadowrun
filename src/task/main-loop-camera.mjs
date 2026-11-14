import { sec, clc } from './status-flags.mjs';
import { BG1_MAP_VRAM, BG2_MAP_VRAM } from './main-initialize.mjs';
import {
  CAMERA_BOX,
  CAMERA_BOX_HIGH,
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
  WRAM,
} from './wram.mjs';
import { WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
import { BYTE_BITS, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_ZERO, FLAG_CARRY, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
// Camera clamping $8A05 and tile rows $8A91 (the camera $81:8C2E is lifted in
// src/game/camera-follow.mjs, its reference in proof/game-reference/main-camera.mjs). All data and the real
// JSL/DBR frames live in VM memory. The publication at CD0/CD6 performs no DMA.

// Projected camera position (DP0E X, DP11 Y) shared by 81:8A05, 81:8C2E and 81:8A91.
const DP_CAMERA_X = 0x0e,
  DP_CAMERA_Y = 0x11;
// 81:8A05: the camera box pointer (DP3E/3F, bank DP40), the two map axes of the position
// (a = x - 400, b from (0940 - y) * 2; both / 8) and the box offset that clamped (0: none).
const DP_BOX = 0x3e,
  DP_BOX_HIGH = 0x3f,
  DP_AXIS_A = 0x41,
  DP_AXIS_B = 0x44,
  DP_DOUBLE_Y = 0x47,
  DP_CLAMPED = 0x4a;
const CAMERA_CENTRE_X = 0x400,
  CAMERA_CENTRE_Y = 0x940,
  NO_BOX = WORD_MASK;
// 81:8A91: the previous and new tile column and row (camera / 32), the row times 2, the
// column times one layer row and the end of the copied words.
const DP_OLD_COLUMN = 0x11,
  DP_OLD_ROW = 0x17,
  DP_COLUMN = 0x0e,
  DP_ROW = 0x14,
  DP_ROW_WORD = 0x1a,
  DP_COLUMN_OFFSET = 0x1d,
  DP_COPY_END = 0x20;
// Camera units per tile: 4 per pixel, 8 pixels; the BG maps wrap after 32 tiles (32 words
// per map row). A column copy reaches one screen width ahead when moving right (32 layer
// rows), a row copy one screen height ahead when moving down (32 words).
const CAMERA_TILE_SHIFT = 5,
  MAP_TILE_MASK = 0x1f,
  MAP_ROW_SHIFT = 5,
  COLUMN_AHEAD = 0x1000,
  ROW_AHEAD = MAP_LINE_BYTES;

// $8A05: optional clamping box [0CDA]+1..7 for the projected position DP0E/11 (lifted in
// src/game/camera-box.mjs for the room entry; the camera 8C2E still calls this one).
export function clampToCameraBox(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(CAMERA_BOX_HIGH)));
  if (ctx.status & FLAG_ZERO) return h.rtl();
  h.dpWrite(DP_BOX_HIGH, ctx.a);
  h.load(h.read(h.abs(CAMERA_BOX)));
  h.dpWrite(DP_BOX, ctx.a);
  h.load(h.dp(DP_CAMERA_X));
  sec(h);
  h.sbc(CAMERA_CENTRE_X);
  h.dpWrite(DP_AXIS_A, ctx.a);
  h.load(CAMERA_CENTRE_Y);
  sec(h);
  h.sbc(h.dp(DP_CAMERA_Y));
  h.asl();
  h.dpWrite(DP_DOUBLE_Y, ctx.a);
  clc(h);
  h.adc(h.dp(DP_AXIS_A));
  h.lsr();
  h.lsr();
  h.lsr();
  h.dpWrite(DP_AXIS_B, ctx.a);
  h.load(h.dp(DP_DOUBLE_Y));
  sec(h);
  h.sbc(h.dp(DP_AXIS_A));
  h.lsr();
  h.lsr();
  h.lsr();
  h.dpWrite(DP_AXIS_A, ctx.a);
  h.dpWrite(DP_CLAMPED, 0);
  h.index('y', 1);
  h.load(h.read(h.indirect(DP_BOX, ctx.y)));
  h.cmp(NO_BOX);
  if (ctx.status & FLAG_ZERO) return h.rtl();
  // Box words: minimum and maximum of axis a, then of axis b.
  for (const offset of [DP_AXIS_A, DP_AXIS_B]) {
    h.load(h.dp(offset));
    h.cmp(h.read(h.indirect(DP_BOX, ctx.y)));
    if (!(ctx.status & FLAG_CARRY)) {
      h.load(h.read(h.indirect(DP_BOX, ctx.y)));
      h.dpWrite(DP_CLAMPED, ctx.y);
    }
    h.index('y', ctx.y + 1);
    h.index('y', ctx.y + 1);
    h.cmp(h.read(h.indirect(DP_BOX, ctx.y)));
    if (ctx.status & FLAG_CARRY) {
      h.load(h.read(h.indirect(DP_BOX, ctx.y)));
      h.dpWrite(DP_CLAMPED, ctx.y);
    }
    if (offset === DP_AXIS_A) {
      h.index('y', ctx.y + 1);
      h.index('y', ctx.y + 1);
    }
    h.dpWrite(offset, ctx.a);
  }
  h.load(h.dp(DP_CLAMPED));
  if (ctx.status & FLAG_ZERO) return h.rtl();
  h.load(h.dp(DP_AXIS_B));
  sec(h);
  h.sbc(h.dp(DP_AXIS_A));
  h.asl();
  h.asl();
  clc(h);
  h.adc(CAMERA_CENTRE_X);
  h.dpWrite(DP_CAMERA_X, ctx.a);
  h.load(h.dp(DP_AXIS_B));
  clc(h);
  h.adc(h.dp(DP_AXIS_A));
  h.asl();
  h.dpWrite(DP_CAMERA_Y, ctx.a);
  h.load(CAMERA_CENTRE_Y);
  sec(h);
  h.sbc(h.dp(DP_CAMERA_Y));
  h.dpWrite(DP_CAMERA_Y, ctx.a);
  return h.rtl();
}

// $8A91: clamp the position; when a 32 cell changes, copy 32 words each into the two
// tile buffers. The three ADC chains keep their original carry.
export function updateCameraTileBuffers(h) {
  const { ctx } = h;
  const shifts = (count) => {
    for (let i = 0; i < count; i++) h.lsr();
  };
  for (const [position, speed, maximum, previous] of [
    [CAMERA_X, CAMERA_SPEED_X, CAMERA_X_MAX, DP_OLD_COLUMN],
    [CAMERA_Y, CAMERA_SPEED_Y, CAMERA_Y_MAX, DP_OLD_ROW],
  ]) {
    h.load(h.read(h.abs(position)));
    shifts(CAMERA_TILE_SHIFT);
    h.dpWrite(previous, ctx.a);
    clc(h);
    h.load(h.read(h.abs(position)));
    h.adc(h.read(h.abs(speed)));
    if (ctx.status & FLAG_NEGATIVE) {
      h.write(h.abs(speed), 0);
      h.load(0);
    } else {
      h.cmp(maximum);
      if (ctx.status & FLAG_CARRY) {
        h.write(h.abs(speed), 0);
        h.load(maximum);
      }
    }
    h.write(h.abs(position), ctx.a);
  }
  // A is the updated vertical position; the original does not reload it here.
  shifts(CAMERA_TILE_SHIFT);
  h.index('x', h.read(h.abs(CAMERA_SPEED_Y)));
  if (ctx.status & FLAG_NEGATIVE) {
    h.modify(DP_OLD_ROW, 'inc', true);
    h.load(ctx.a + 1);
  }
  h.dpWrite(DP_ROW, ctx.a);
  h.asl();
  h.dpWrite(DP_ROW_WORD, ctx.a);
  h.load(h.read(h.abs(CAMERA_X)));
  shifts(CAMERA_TILE_SHIFT);
  h.index('x', h.read(h.abs(CAMERA_SPEED_X)));
  if (ctx.status & FLAG_NEGATIVE) {
    h.modify(DP_OLD_COLUMN, 'inc', true);
    h.load(ctx.a + 1);
  }
  h.dpWrite(DP_COLUMN, ctx.a);
  // Column * 100 / 2: one layer row (SCENE_LAYER_ROW_BYTES) per screen column.
  h.xba();
  h.lsr();
  h.dpWrite(DP_COLUMN_OFFSET, ctx.a);
  h.load(h.dp(DP_COLUMN));
  h.cmp(h.dp(DP_OLD_COLUMN));
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(ctx.a & MAP_TILE_MASK);
    clc(h);
    h.adc(BG1_MAP_VRAM);
    h.write(h.abs(MAP_COLUMN_VRAM_BG1), ctx.a);
    h.adc(BG2_MAP_VRAM - BG1_MAP_VRAM);
    h.write(h.abs(MAP_COLUMN_VRAM_BG2), ctx.a);
    h.load(h.dp(DP_COLUMN));
    h.xba();
    h.lsr();
    h.index('x', h.read(h.abs(CAMERA_SPEED_X)));
    if (!(ctx.status & FLAG_NEGATIVE)) h.adc(COLUMN_AHEAD);
    h.adc(h.dp(DP_ROW_WORD));
    h.index('y', h.read(h.abs(CAMERA_SPEED_Y)));
    if (!(ctx.status & FLAG_NEGATIVE)) {
      h.load(ctx.a + 1);
      h.load(ctx.a + 1);
    }
    h.index('x', ctx.a);
    h.phb();
    h.push(WRAM_BANK_PAIR, 2);
    h.plb();
    h.plb();
    h.load(h.dp(DP_ROW));
    h.cpy(0);
    if (!(ctx.status & FLAG_NEGATIVE)) h.load(ctx.a + 1);
    h.load(ctx.a & MAP_TILE_MASK);
    h.asl();
    h.dpWrite(DP_COPY_END, ctx.a);
    h.index('y', ctx.a);
    do {
      h.load(h.read(WRAM + SCENE_LAYER_HIGH + ctx.x));
      h.write(h.abs(MAP_COLUMN_BG1) + ctx.y, ctx.a);
      h.load(h.read(WRAM + SCENE_LAYER_LOW + ctx.x));
      h.write(h.abs(MAP_COLUMN_BG2) + ctx.y, ctx.a);
      h.index('x', ctx.x + 1);
      h.index('x', ctx.x + 1);
      h.index('y', ctx.y + 1);
      h.index('y', ctx.y + 1);
      h.cpy(MAP_LINE_BYTES);
      if (ctx.status & FLAG_ZERO) h.index('y', 0);
      h.cpy(h.dp(DP_COPY_END));
    } while (!(ctx.status & FLAG_ZERO));
    h.plb();
    h.modify(h.abs(MAP_COLUMN_UPLOAD), 'inc');
  }
  h.load(h.dp(DP_ROW));
  h.cmp(h.dp(DP_OLD_ROW));
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(ctx.a & MAP_TILE_MASK);
    h.xba();
    shifts(BYTE_BITS - MAP_ROW_SHIFT);
    h.adc(BG1_MAP_VRAM);
    h.write(h.abs(MAP_ROW_VRAM_BG1), ctx.a);
    h.adc(BG2_MAP_VRAM - BG1_MAP_VRAM);
    h.write(h.abs(MAP_ROW_VRAM_BG2), ctx.a);
    h.load(h.dp(DP_ROW));
    h.asl();
    h.index('x', h.read(h.abs(CAMERA_SPEED_Y)));
    if (!(ctx.status & FLAG_NEGATIVE)) h.adc(ROW_AHEAD);
    h.adc(h.dp(DP_COLUMN_OFFSET));
    h.index('y', h.read(h.abs(CAMERA_SPEED_X)));
    if (!(ctx.status & FLAG_NEGATIVE)) h.adc(SCENE_LAYER_ROW_BYTES);
    h.index('x', ctx.a);
    h.phb();
    h.push(WRAM_BANK_PAIR, 2);
    h.plb();
    h.plb();
    h.load(h.dp(DP_COLUMN));
    h.cpy(0);
    if (!(ctx.status & FLAG_NEGATIVE)) h.load(ctx.a + 1);
    h.load(ctx.a & MAP_TILE_MASK);
    h.asl();
    h.dpWrite(DP_COLUMN, ctx.a);
    h.index('y', ctx.a);
    do {
      h.load(h.read(WRAM + SCENE_LAYER_HIGH + ctx.x));
      h.write(h.abs(MAP_ROW_BG1) + ctx.y, ctx.a);
      h.load(h.read(WRAM + SCENE_LAYER_LOW + ctx.x));
      h.write(h.abs(MAP_ROW_BG2) + ctx.y, ctx.a);
      h.load(ctx.x);
      clc(h);
      h.adc(SCENE_LAYER_ROW_BYTES);
      h.index('x', ctx.a);
      h.index('y', ctx.y + 1);
      h.index('y', ctx.y + 1);
      h.cpy(MAP_LINE_BYTES);
      if (ctx.status & FLAG_ZERO) h.index('y', 0);
      h.cpy(h.dp(DP_COLUMN));
    } while (!(ctx.status & FLAG_ZERO));
    h.plb();
    h.modify(h.abs(MAP_ROW_UPLOAD), 'inc');
  }
  return h.rtl();
}
