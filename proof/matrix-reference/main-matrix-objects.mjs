import { clearOamHighTable, hideRemainingSprites } from '../../src/task/main-scene-video.mjs';
export { clearOamHighTable, hideRemainingSprites };
import { routineCaller } from '../../src/task/routine-call.mjs';
import { setCarry } from '../../src/task/status-flags.mjs';

import { MAP_BANK, NODE_TABLE_BYTES, TILE_NUMBER_MASK } from './main-scene-matrix.mjs';
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
  MATRIX_CPU_BITS,
  MATRIX_DMA_END,
  MATRIX_DMA_RECORDS,
  MATRIX_MAP,
  MATRIX_MAP_EDIT,
  MATRIX_NODE_COLUMNS,
  MATRIX_NODE_ROWS,
  MATRIX_OBJECT_ANIMATING,
  MATRIX_OBJECT_END,
  MATRIX_OBJECT_FLAGS,
  MATRIX_OBJECT_PICTURE,
  MATRIX_OBJECT_SHOWN,
  MATRIX_OBJECT_TYPE,
  MATRIX_PERSONA_X,
  MATRIX_PERSONA_Y,
  MATRIX_SCROLL_X,
  MATRIX_SCROLL_Y,
  MATRIX_SPEED_X,
  MATRIX_SPEED_Y,
  OAM_SHADOW,
  OAM_SHADOW_HIGH,
} from '../../src/task/wram.mjs';
import { HIGH_BYTE_MASK, LONG_MASK, BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO, FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';
import {
  OAM_ENTRY_BYTES,
  OAM_NAME_BYTE,
  OAM_Y_BYTE,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../../src/constants/ppu.mjs';
import {
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_SOUND_VOLUME,
} from '../../src/constants/sound-commands.mjs';
// Matrix object allocation, map edits and OAM shadow construction. This does not
// dispatch object AI or execute the BEC3 NMI callback/its DMA queue consumer.

// Bank 81 tables (meanings in src/data/tables.mjs): the bit per node (the nodes 21-27 from
// the second word), the four sides of a node (map byte offset, object position, map value,
// object kind), the cell step of 81:B56F toward the side holding 07, the map word under the
// object kinds 2-4, the OAM high table X bit by slot, and the next tile by heading as
// tile and as map byte offset.
export const MATRIX_BITS = 0x81c2d4,
  MATRIX_TILE_STEPS = 0x81bb76,
  MATRIX_MAP_STEPS = 0x81bb86,
  MATRIX_SIDE_OFFSETS = 0x81b642,
  MATRIX_SIDE_X = 0x81b64a,
  MATRIX_SIDE_Y = 0x81b652,
  MATRIX_SIDE_VALUES = 0x81b65a,
  MATRIX_SIDE_KINDS = 0x81b662,
  SIDES_BYTES = 8;
const NODE_BITS = MATRIX_BITS + 2,
  MATRIX_CELL_COLUMNS = 0x81b5f9,
  MATRIX_CELL_ROWS = 0x81b601,
  MATRIX_OBJECT_MARKS = 0x81b94f,
  MATRIX_OAM_X_BITS = 0x81be65,
  MARKED_KIND_END = 5;
// Map value 07: B on it costs one health (81:C111); 81:B56F moves a CPU node's cell toward it.
export const NODE_COSTS_HEALTH = 7;
// Map tiles are 16 pixels; a position names the tile under its centre. The persona acts
// only on the tile grid. A map row has 32 words; the map words of the matrix BG start at
// VRAM word 2000 (81:C3CA).
export const TILE_PIXEL_SHIFT = 4,
  TILE_PIXELS = 1 << TILE_PIXEL_SHIFT,
  GRID_MASK = TILE_PIXELS - 1,
  MATRIX_MAP_VRAM = 0x2000;
const HALF_TILE = TILE_PIXELS / 2,
  TILE_ROW_MASK = WORD_MASK - GRID_MASK,
  MAP_ROW_SHIFT = 5;
// Map edits: a ring of 40 bytes (32 tiles) in bank 7F that the VRAM DMA records point at.
const MAP_EDIT_TILES = 0x7f019a,
  MAP_EDIT_RING_BYTES = 0x40;
// 81:B8C8: a new object runs the animation list 81:BEB1 every 6 frames and plays sound 5.
const OBJECT_ANIMATION = 0x81beb1,
  OBJECT_ANIMATION_SPEED = 6,
  OBJECT_SOUND = 5;
// 81:B1C6: voices 0-3 for the sound, at full volume (parameter high byte FF).
const SOUND_VOICES = 0xf;
// Animation lists end with FFFE (stop, clears the animation bit) or FFFF (from the start).
const ANIMATION_STOP = 0xfffe,
  ANIMATION_LOOP = WORD_MASK,
  ANIMATION_DONE = WORD_MASK ^ MATRIX_OBJECT_ANIMATING;
// 81:BD99 places objects with a screen X of -8 to F7 and a Y of -8 to D7; unused entries
// get X FF, Y F0. Four sprites share one high table byte.
const VISIBLE_START = 0xfff8,
  VISIBLE_RIGHT = 0xf8,
  VISIBLE_BOTTOM = 0xd8,
  OAM_HIGH_SLOT_MASK = 3;
// Direct page: map pointer (DP20, bank DP22, from 81:B66A), the object that 81:B8C8
// places (DP1A, DP1C, kind DP1E), the OAM write offset and the gates 81:B56F opens.
export const DP_MAP = 0x20,
  DP_OBJECT_X = 0x1a,
  DP_OBJECT_Y = 0x1c,
  DP_OBJECT_KIND = 0x1e,
  DP_OPENED = 0x14;
const DP_MAP_BANK = 0x22,
  DP_OAM_OFFSET = 0x2c,
  DP_NODE_BITS = 0x12,
  DP_CELL_X = 0xe,
  DP_CELL_Y = 0x10,
  DP_SCREEN_X = 0xe,
  DP_SCREEN_Y = 0x10,
  DP_ANIMATION = 0x12,
  DP_PICTURE = 0x14,
  DP_X_BIT = 0x16,
  DP_COLUMN = 0x10,
  DP_VRAM = 0x14,
  DP_TILE_STEP = 0x16,
  DP_KIND_OFFSET = 0xe;
// 81:B54C: read the map tile at node X plus the side offset in A.
function readNodeSideTile(h) {
  const { ctx } = h;
  setCarry(h, false);
  h.adc(h.read(h.abs(MATRIX_MAP)));
  h.dpWrite(DP_MAP, ctx.a);
  h.load(MAP_BANK);
  h.dpWrite(DP_MAP_BANK, ctx.a);
  h.load(h.read(h.abs(MATRIX_NODE_ROWS) + ctx.x));
  for (let n = 0; n < MAP_ROW_SHIFT; n++) h.asl();
  setCarry(h, false);
  h.adc(h.read(h.abs(MATRIX_NODE_COLUMNS) + ctx.x));
  h.asl();
  setCarry(h, false);
  h.adc(h.dp(DP_MAP));
  h.dpWrite(DP_MAP, ctx.a);
  h.load(h.read(h.indirect(DP_MAP)));
  h.load(ctx.a & TILE_NUMBER_MASK);
  return h.rts();
}
// 81:B56F: open the gates of the nodes whose bits are in A.
export function openNodeGates(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.dpWrite(DP_NODE_BITS, ctx.a);
  h.dpWrite(DP_OPENED, 0);
  h.index('x', 0);
  do {
    h.load(h.read(h.abs(MATRIX_NODE_COLUMNS) + ctx.x));
    if (ctx.status & FLAG_NEGATIVE) break;
    h.load(h.dp(DP_NODE_BITS));
    h.load(ctx.a & h.read(h.abs(NODE_BITS & WORD_MASK) + ctx.x));
    if (!(ctx.status & FLAG_ZERO)) {
      h.load(h.read(h.abs(MATRIX_CPU_BITS)));
      h.load(ctx.a | h.read(h.abs(NODE_BITS & WORD_MASK) + ctx.x));
      h.write(h.abs(MATRIX_CPU_BITS), ctx.a);
      h.index('y', 0);
      do {
        h.load(h.read(h.abs(MATRIX_SIDE_OFFSETS & WORD_MASK) + ctx.y));
        call(0x81b591, 0x81b54c);
        h.cmp(NODE_COSTS_HEALTH);
        if (ctx.status & FLAG_ZERO) break;
        h.index('y', ctx.y + 1);
        h.index('y', ctx.y + 1);
        h.cpy(SIDES_BYTES);
      } while (!(ctx.status & FLAG_ZERO));
      setCarry(h, false);
      h.load(h.read(h.abs(MATRIX_NODE_COLUMNS) + ctx.x));
      h.adc(h.read(h.abs(MATRIX_CELL_COLUMNS & WORD_MASK) + ctx.y));
      h.write(h.abs(MATRIX_NODE_COLUMNS) + ctx.x, ctx.a);
      for (let n = 0; n < TILE_PIXEL_SHIFT; n++) h.asl();
      h.dpWrite(DP_CELL_X, ctx.a);
      setCarry(h, false);
      h.load(h.read(h.abs(MATRIX_NODE_ROWS) + ctx.x));
      h.adc(h.read(h.abs(MATRIX_CELL_ROWS & WORD_MASK) + ctx.y));
      h.write(h.abs(MATRIX_NODE_ROWS) + ctx.x, ctx.a);
      for (let n = 0; n < TILE_PIXEL_SHIFT; n++) h.asl();
      h.dpWrite(DP_CELL_Y, ctx.a);
      h.index('y', 0);
      do {
        h.load(h.read(h.abs(MATRIX_SIDE_OFFSETS & WORD_MASK) + ctx.y));
        call(0x81b5c6, 0x81b54c);
        h.cmp(h.read(h.abs(MATRIX_SIDE_VALUES & WORD_MASK) + ctx.y));
        if (ctx.status & FLAG_ZERO) {
          h.modify(DP_OPENED, 'inc', true);
          setCarry(h, false);
          h.load(h.dp(DP_CELL_X));
          h.adc(h.read(h.abs(MATRIX_SIDE_X & WORD_MASK) + ctx.y));
          h.dpWrite(DP_OBJECT_X, ctx.a);
          setCarry(h, false);
          h.load(h.dp(DP_CELL_Y));
          h.adc(h.read(h.abs(MATRIX_SIDE_Y & WORD_MASK) + ctx.y));
          h.dpWrite(DP_OBJECT_Y, ctx.a);
          h.load(h.read(h.abs(MATRIX_SIDE_KINDS & WORD_MASK) + ctx.y));
          h.dpWrite(DP_OBJECT_KIND, ctx.a);
          call(0x81b5e5, 0x81b8c8);
        }
        h.index('y', ctx.y + 1);
        h.index('y', ctx.y + 1);
        h.cpy(SIDES_BYTES);
      } while (!(ctx.status & FLAG_ZERO));
    }
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.cpx(NODE_TABLE_BYTES);
  } while (!(ctx.status & FLAG_ZERO));
  h.load(h.dp(DP_OPENED));
  return h.rts();
}
// 81:B1C6: play sound A at full left and right volume on the matrix sound voices.
function playMatrixSound(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.phx();
  h.phy();
  h.pha();
  h.index('x', SOUND_VOICES);
  h.load(APU_COMMAND_SOUND_VOICES);
  call(0x81b1cf, 0x81f007, true);
  h.pla();
  h.load(ctx.a | HIGH_BYTE_MASK);
  h.index('x', ctx.a);
  h.load(APU_COMMAND_SOUND_VOLUME);
  call(0x81b1db, 0x81f007, true);
  h.ply();
  h.plx();
  return h.rts();
}
// 81:B8C8: add a matrix object of kind DP1E at DP1A/DP1C in the first free slot.
export function addMatrixObject(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.phx();
  h.index('x', 0);
  do {
    h.load(h.read(h.abs(MATRIX_OBJECT_TYPE) + ctx.x));
    if (ctx.status & FLAG_ZERO) {
      h.load(h.dp(DP_OBJECT_X));
      h.write(h.abs(MATRIX_PERSONA_X) + ctx.x, ctx.a);
      h.load(h.dp(DP_OBJECT_Y));
      h.write(h.abs(MATRIX_PERSONA_Y) + ctx.x, ctx.a);
      h.load(h.dp(DP_OBJECT_KIND));
      h.write(h.abs(MATRIX_OBJECT_TYPE) + ctx.x, ctx.a);
      h.load(OBJECT_ANIMATION & WORD_MASK);
      h.write(h.abs(MATRIX_ANIMATION) + ctx.x, ctx.a);
      h.write(h.abs(MATRIX_ANIMATION_STEP) + ctx.x, 0);
      h.load(OBJECT_ANIMATION_SPEED);
      h.write(h.abs(MATRIX_ANIMATION_SPEED) + ctx.x, ctx.a);
      h.load(1);
      h.write(h.abs(MATRIX_ANIMATION_CLOCK) + ctx.x, ctx.a);
      h.load(h.read(h.abs(MATRIX_OBJECT_FLAGS) + ctx.x));
      h.load(ctx.a | MATRIX_OBJECT_ANIMATING);
      h.write(h.abs(MATRIX_OBJECT_FLAGS) + ctx.x, ctx.a);
      h.load(OBJECT_SOUND);
      call(0x81b90a, 0x81b1c6);
      h.plx();
      return h.rts();
    }
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.cpx(MATRIX_OBJECT_END);
  } while (!(ctx.status & FLAG_ZERO));
  h.plx();
  return h.rts();
}
// 81:BD99: place and animate the matrix objects in the OAM buffer.
export function drawMatrixObjects(h) {
  const { ctx } = h;
  setCarry(h, false);
  h.load(h.read(h.abs(MATRIX_PERSONA_X) + ctx.x));
  h.adc(h.read(h.abs(MATRIX_SPEED_X) + ctx.x));
  h.write(h.abs(MATRIX_PERSONA_X) + ctx.x, ctx.a);
  setCarry(h, false);
  h.load(h.read(h.abs(MATRIX_PERSONA_Y) + ctx.x));
  h.adc(h.read(h.abs(MATRIX_SPEED_Y) + ctx.x));
  h.write(h.abs(MATRIX_PERSONA_Y) + ctx.x, ctx.a);
  h.load(h.read(h.abs(MATRIX_OBJECT_FLAGS) + ctx.x));
  h.load(ctx.a | MATRIX_OBJECT_ANIMATING);
  h.write(h.abs(MATRIX_OBJECT_FLAGS) + ctx.x, ctx.a);
  h.load(ctx.a & MATRIX_OBJECT_SHOWN);
  if (ctx.status & FLAG_ZERO) return h.rts();
  setCarry(h, true);
  h.load(h.read(h.abs(MATRIX_PERSONA_X) + ctx.x));
  h.sbc(h.read(h.abs(MATRIX_SCROLL_X)));
  h.dpWrite(DP_SCREEN_X, ctx.a);
  // The original has CLC before this SBC, so the vertical coordinate includes
  // the incoming borrow of one. Preserve it, including clipping boundaries.
  setCarry(h, false);
  h.load(h.read(h.abs(MATRIX_PERSONA_Y) + ctx.x));
  h.sbc(h.read(h.abs(MATRIX_SCROLL_Y)));
  h.dpWrite(DP_SCREEN_Y, ctx.a);
  h.modify(h.abs(MATRIX_ANIMATION_CLOCK) + ctx.x, 'dec');
  if (ctx.status & FLAG_ZERO) {
    h.load(h.read(h.abs(MATRIX_ANIMATION_SPEED) + ctx.x));
    h.write(h.abs(MATRIX_ANIMATION_CLOCK) + ctx.x, ctx.a);
    h.load(h.read(h.abs(MATRIX_ANIMATION) + ctx.x));
    h.dpWrite(DP_ANIMATION, ctx.a);
    h.index('y', h.read(h.abs(MATRIX_ANIMATION_STEP) + ctx.x, 2));
    for (;;) {
      h.load(h.read((h.abs(h.dp(DP_ANIMATION, 2)) + ctx.y) & LONG_MASK));
      h.cmp(ANIMATION_STOP);
      if (ctx.status & FLAG_ZERO) {
        h.load(h.read(h.abs(MATRIX_OBJECT_FLAGS) + ctx.x));
        h.load(ctx.a & ANIMATION_DONE);
        h.write(h.abs(MATRIX_OBJECT_FLAGS) + ctx.x, ctx.a);
        return h.rts();
      }
      h.cmp(ANIMATION_LOOP);
      if (!(ctx.status & FLAG_ZERO)) break;
      h.load(h.read(h.abs(MATRIX_OBJECT_FLAGS) + ctx.x));
      h.load(ctx.a & ANIMATION_DONE);
      h.write(h.abs(MATRIX_OBJECT_FLAGS) + ctx.x, ctx.a);
      h.index('y', 0);
    }
    h.write(h.abs(MATRIX_OBJECT_PICTURE) + ctx.x, ctx.a);
    h.index('y', ctx.y + 1);
    h.index('y', ctx.y + 1);
    h.load(ctx.y);
    h.write(h.abs(MATRIX_ANIMATION_STEP) + ctx.x, ctx.a);
  }
  h.load(h.dp(DP_SCREEN_X));
  h.cmp(VISIBLE_START);
  if (!(ctx.status & FLAG_CARRY)) {
    h.cmp(VISIBLE_RIGHT);
    if (ctx.status & FLAG_CARRY) return h.rts();
  }
  h.load(h.dp(DP_SCREEN_Y));
  h.cmp(VISIBLE_START);
  if (!(ctx.status & FLAG_CARRY)) {
    h.cmp(VISIBLE_BOTTOM);
    if (ctx.status & FLAG_CARRY) return h.rts();
  }
  h.load(h.read(h.abs(MATRIX_OBJECT_PICTURE) + ctx.x));
  h.dpWrite(DP_PICTURE, ctx.a);
  h.phx();
  h.index('x', h.dp(DP_OAM_OFFSET, 2));
  h.load(h.dp(DP_SCREEN_X));
  h.write(h.abs(OAM_SHADOW) + ctx.x, ctx.a);
  h.load(h.dp(DP_SCREEN_Y));
  h.write(h.abs(OAM_SHADOW + OAM_Y_BYTE) + ctx.x, ctx.a);
  h.load(h.dp(DP_PICTURE));
  h.write(h.abs(OAM_SHADOW + OAM_NAME_BYTE) + ctx.x, ctx.a);
  for (let n = 0; n < OAM_ENTRY_BYTES; n++) h.index('x', ctx.x + 1);
  h.dpWrite(DP_OAM_OFFSET, ctx.x, 2);
  h.load(h.dp(DP_SCREEN_X));
  if (ctx.status & FLAG_NEGATIVE) {
    h.load(ctx.x);
    h.lsr();
    h.lsr();
    h.load(ctx.a - 1);
    h.load(ctx.a & OAM_HIGH_SLOT_MASK);
    h.index('x', ctx.a);
    h.load(h.read(h.abs(MATRIX_OAM_X_BITS & WORD_MASK) + ctx.x));
    h.load(ctx.a & BYTE_MASK);
    h.dpWrite(DP_X_BIT, ctx.a);
    h.load(ctx.x);
    h.lsr();
    h.lsr();
    h.index('x', ctx.a);
    h.load(h.dp(DP_X_BIT));
    h.load(ctx.a | h.read(h.abs(OAM_SHADOW_HIGH) + ctx.x));
    h.write(h.abs(OAM_SHADOW_HIGH) + ctx.x, ctx.a);
  }
  h.plx();
  return h.rts();
}
// 81:BD7C: rebuild the OAM buffer from the active matrix objects.
function buildMatrixSprites(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.dpWrite(DP_OAM_OFFSET, 0);
  call(0x81bd7e, 0x81edd7, true);
  h.index('x', 0);
  do {
    h.load(h.read(h.abs(MATRIX_OBJECT_TYPE) + ctx.x));
    if (!(ctx.status & FLAG_ZERO)) call(0x81bd8a, 0x81bd99);
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.cpx(MATRIX_OBJECT_END);
  } while (!(ctx.status & FLAG_ZERO));
  call(0x81bd94, 0x81ee0c, true);
  return h.rts();
}
// 81:B66A: set DP_MAP to the map tile under object X, offset by A.
function locateMapTile(h) {
  const { ctx } = h;
  setCarry(h, false);
  h.adc(h.read(h.abs(MATRIX_MAP)));
  h.dpWrite(DP_MAP, ctx.a);
  h.load(MAP_BANK);
  h.dpWrite(DP_MAP_BANK, ctx.a);
  h.load(h.read(h.abs(MATRIX_PERSONA_X) + ctx.x));
  setCarry(h, false);
  h.adc(HALF_TILE);
  for (let n = 0; n < TILE_PIXEL_SHIFT; n++) h.lsr();
  h.dpWrite(DP_COLUMN, ctx.a);
  h.load(h.read(h.abs(MATRIX_PERSONA_Y) + ctx.x));
  setCarry(h, false);
  h.adc(HALF_TILE);
  h.load(ctx.a & TILE_ROW_MASK);
  h.asl();
  h.load(ctx.a | h.dp(DP_COLUMN));
  h.asl();
  setCarry(h, false);
  h.adc(h.dp(DP_MAP));
  h.dpWrite(DP_MAP, ctx.a);
  return h.rts();
}
// 81:B696: write Y to the map tile under object X, offset by A.
function writeMapTile(h, e, r) {
  const call = routineCaller(h, e, r);
  call(0x81b696, 0x81b66a);
  h.load(h.ctx.y);
  h.write(h.indirect(DP_MAP), h.ctx.a);
  return h.rts();
}
// 81:B69D: read the tile number under object X, offset by A.
function readMapTile(h, e, r) {
  const call = routineCaller(h, e, r);
  call(0x81b69d, 0x81b66a);
  h.load(h.read(h.indirect(DP_MAP)));
  h.load(h.ctx.a & TILE_NUMBER_MASK);
  return h.rts();
}
// 81:B6A6: write a map tile and queue its VRAM update in the map edit ring.
export function queueMapEdit(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.dpWrite(DP_TILE_STEP, ctx.a);
  h.load(ctx.y);
  h.phx();
  call(0x81b6aa, 0x81b4b9);
  h.pha();
  h.load(h.read(h.abs(MATRIX_MAP_EDIT)));
  h.load(ctx.a + 1);
  h.load(ctx.a + 1);
  h.cmp(MAP_EDIT_RING_BYTES);
  if (ctx.status & FLAG_CARRY) h.load(0);
  h.write(h.abs(MATRIX_MAP_EDIT), ctx.a);
  h.index('x', ctx.a);
  h.pla();
  h.write(MAP_EDIT_TILES + ctx.x, ctx.a);
  h.plx();
  h.load(h.read(h.abs(MATRIX_PERSONA_X) + ctx.x));
  setCarry(h, false);
  h.adc(HALF_TILE);
  for (let n = 0; n < TILE_PIXEL_SHIFT; n++) h.lsr();
  h.dpWrite(DP_COLUMN, ctx.a);
  h.load(h.read(h.abs(MATRIX_PERSONA_Y) + ctx.x));
  setCarry(h, false);
  h.adc(HALF_TILE);
  h.load(ctx.a & TILE_ROW_MASK);
  h.asl();
  h.load(ctx.a | h.dp(DP_COLUMN));
  h.load(ctx.a | MATRIX_MAP_VRAM);
  setCarry(h, false);
  h.adc(h.dp(DP_TILE_STEP));
  h.dpWrite(DP_VRAM, ctx.a);
  h.phx();
  h.index('x', h.read(h.abs(MATRIX_DMA_END), 2));
  h.load(2);
  h.write(h.abs(DMA_RECORD_COUNT) + ctx.x, ctx.a);
  h.load(VMAINC_INCREMENT_AFTER_HIGH);
  h.write(h.abs(DMA_RECORD_VMAINC) + ctx.x, ctx.a);
  h.load(MAP_BANK);
  h.write(h.abs(DMA_RECORD_BANK) + ctx.x, ctx.a);
  setCarry(h, false);
  h.load(h.read(h.abs(MATRIX_MAP_EDIT)));
  h.adc(MAP_EDIT_TILES & WORD_MASK);
  h.write(h.abs(DMA_RECORD_SOURCE) + ctx.x, ctx.a);
  h.load(h.dp(DP_VRAM));
  h.write(h.abs(DMA_RECORD_VRAM) + ctx.x, ctx.a);
  h.write(h.abs(DMA_RECORD_COUNT + DMA_RECORD_BYTES) + ctx.x, 0);
  h.load(ctx.x);
  setCarry(h, false);
  h.adc(DMA_RECORD_BYTES);
  h.write(h.abs(MATRIX_DMA_END), ctx.a);
  h.load(1);
  h.write(h.abs(MATRIX_DMA_RECORDS), ctx.a);
  h.plx();
  return h.rts();
}
// 81:B90F: remove the marked objects whose animation has ended and restore their map tiles.
export function removeFinishedMatrixObjects(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.index('x', 0);
  do {
    h.load(h.read(h.abs(MATRIX_OBJECT_TYPE) + ctx.x));
    h.cmp(2);
    if (ctx.status & FLAG_CARRY) {
      h.cmp(MARKED_KIND_END);
      if (!(ctx.status & FLAG_CARRY)) {
        h.asl();
        h.dpWrite(DP_KIND_OFFSET, ctx.a);
        h.index('y', ctx.a);
        h.load(h.read(h.abs(MATRIX_OBJECT_MARKS & WORD_MASK) + ctx.y));
        h.index('y', ctx.a);
        h.load(0);
        call(0x81b92a, 0x81b696);
        h.load(h.read(h.abs(MATRIX_OBJECT_FLAGS) + ctx.x));
        h.load(ctx.a & MATRIX_OBJECT_ANIMATING);
        if (ctx.status & FLAG_ZERO) {
          h.load(0);
          h.write(h.abs(MATRIX_OBJECT_TYPE) + ctx.x, ctx.a);
          h.index('y', h.dp(DP_KIND_OFFSET, 2));
          h.load(h.read(h.abs(MATRIX_OBJECT_MARKS & WORD_MASK) + ctx.y));
          h.index('y', ctx.a);
          h.load(0);
          call(0x81b944, 0x81b6a6);
        }
      }
    }
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.cpx(MATRIX_OBJECT_END);
  } while (!(ctx.status & FLAG_ZERO));
  return h.rts();
}
export const MATRIX_OBJECT_ROUTINES = new Map([
  [0x81b54c, readNodeSideTile],
  [0x81b56f, openNodeGates],
  [0x81b8c8, addMatrixObject],
  [0x81b1c6, playMatrixSound],
  [0x81bd7c, buildMatrixSprites],
  [0x81bd99, drawMatrixObjects],
  [0x81edd7, clearOamHighTable],
  [0x81ee0c, hideRemainingSprites],
  [0x81b66a, locateMapTile],
  [0x81b696, writeMapTile],
  [0x81b69d, readMapTile],
  [0x81b6a6, queueMapEdit],
  [0x81b90f, removeFinishedMatrixObjects],
]);
