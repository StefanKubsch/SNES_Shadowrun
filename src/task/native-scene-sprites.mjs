import { taskStop } from './plan.mjs';
import { sec, clc } from './status-flags.mjs';
import {
  CELL_SIZE,
  DP_CELL_X,
  DP_CELL_Y,
  DP_COLUMNS_LEFT,
  DP_DEPTH,
  DP_OAM_OFFSET,
  DP_ROWS,
  DP_ROWS_LEFT,
  DP_SCRATCH,
  DP_TOP_CELL_Y,
  PART_SIZE,
  VISIBLE_HEIGHT,
  VISIBLE_WIDTH,
  dpLoad,
  dpStore,
  field,
  highBits,
} from './native-sprite-helpers.mjs';
import { clearPaletteSlots } from './main-initialize.mjs';
import { occlusion, mapCell } from './native-sprite-occlusion.mjs';

import {
  CAMERA_X,
  CAMERA_Y,
  CELL_BITS,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  ENTERED_OBJECT,
  ENTERED_OBJECT_FLAGS,
  NMI_JOB_LISTS,
  OAM_BUFFER,
  OAM_HIGH_TABLE,
  OBJECT_COVERED,
  OBJECT_DEPTH_BIAS,
  OBJECT_DEPTH_ORDER,
  OBJECT_DEPTH_RULE,
  OBJECT_DIAGONAL,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_HIDDEN,
  OBJECT_NOT_DRAWN,
  OBJECT_ON_SCREEN,
  OBJECT_PALETTE,
  OBJECT_PICTURE,
  OBJECT_VRAM_SLOT_HEAD,
  OBJECT_X,
  OBJECT_Y,
  OCCLUSION_COLUMN_BYTES,
  OCCLUSION_MASKS,
  OCCLUSION_TILES,
  PALETTE_SLOTS,
  PALETTE_UPLOAD_LIST,
  PALETTE_UPLOAD_LIST_BYTES,
  PLAYER_OBJECT,
  VRAM_SLOT_NEXT,
  WALL_CELL_BYTES,
  WALL_MAP,
  WALL_WORD_CELLS,
  WRAM,
} from './wram.mjs';
import { BYTE_MASK, NIBBLE_BITS, NIBBLE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_ZERO, FLAG_NEGATIVE, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
import { CODE_BANK_BASE, LOROM_OFFSET, WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
import {
  OAM_ENTRY_BYTES,
  OAM_FLIP_MASK,
  OAM_HIGH_ALL_LARGE,
  OAM_HIGH_TABLE_BYTES,
  OAM_LOW_TABLE_BYTES,
  OAM_PRIORITY_2,
  OAM_PRIORITY_3,
  OAM_Y_BYTE,
  OBJECT_COUNT,
} from '../constants/ppu.mjs';
// Sprite setup of the scene (80:B8DE): sort the draw list $14B2 by screen depth (AFFC), fill the OAM buffer
// 7E3D08 (4 bytes per sprite, pointer DP84) and the high bits 7E3F08 from the objects (B20A), hide the rest of
// the OAM. h from dialogAccess (native-dialog-support.mjs); DBR at entry is the caller's.

// Direct page of the depth sort 80:AFFC: the sort keys (OBJECT_DIAGONAL) of the first and
// the second object of a pair, the first object and the saved list position.
const DP_FIRST_KEY = 0x11,
  DP_SECOND_KEY = 0x14,
  DP_FIRST_OBJECT = 0x17,
  DP_SORT_POSITION = 0x1a;
// Jump tables of the depth rules (OBJECT_DEPTH_RULE of the first or the second object).
const DEPTH_RULES_FIRST = 0xb0e3,
  DEPTH_RULES_SECOND = 0xb126;

// Depth comparisons behind the jump tables 80:B0E3 (X = first object DP17) and 80:B126 (Y = second):
// field, branch on carry (BCS) or without (BCC), hit on branch or on no branch, target DP11 (+0FE0,X) or DP14 (+0FE0,Y).
export const COMPARE = new Map([
  [0xb0af, { field: OBJECT_Y, onCarry: false, addOnBranch: true, target: DP_FIRST_KEY }],
  [0xb0ba, { field: OBJECT_X, onCarry: false, addOnBranch: true, target: DP_FIRST_KEY }],
  [0xb0c5, { field: OBJECT_X, onCarry: true, addOnBranch: true, target: DP_FIRST_KEY }],
  [0xb0d0, { field: OBJECT_Y, onCarry: false, addOnBranch: false, target: DP_FIRST_KEY }],
  [0xb0f2, { field: OBJECT_Y, onCarry: false, addOnBranch: true, target: DP_SECOND_KEY }],
  [0xb0fd, { field: OBJECT_X, onCarry: false, addOnBranch: true, target: DP_SECOND_KEY }],
  [0xb108, { field: OBJECT_X, onCarry: true, addOnBranch: true, target: DP_SECOND_KEY }],
  [0xb113, { field: OBJECT_Y, onCarry: false, addOnBranch: false, target: DP_SECOND_KEY }],
]);

// Direct page of the OAM entry 80:B20A. The picture pointer is long (bank byte DP10).
// Screen X and Y of the current sprite part (DP12 is the high byte of X), Y of the top part
// row, the picture anchor (byte 0 and 1 times 2), the picture columns and rows of 16x16
// parts, the part rows left in a column, the current VRAM tile and the palette slot.
const DP_PICTURE = 0x0e,
  DP_PICTURE_BANK = 0x10,
  DP_SCREEN_X = 0x11,
  DP_SCREEN_X_HIGH = 0x12,
  DP_TOP_Y = 0x14,
  DP_SCREEN_Y = 0x17,
  DP_ANCHOR_X = 0x1a,
  DP_ANCHOR_Y = 0x1d,
  DP_COLUMNS = 0x20,
  DP_TILE = 0x29,
  DP_PALETTE_SLOT = 0x2c;
// The shared DP_CELL_X/Y (native-sprite-helpers.mjs) first hold the object's map column
// and row in quarter units. DP_DEPTH (OBJECT_DIAGONAL / 4) is compared by mapCell with the
// wall heights; from B755 the same word holds the OAM priority of the part.
const DP_PRIORITY = DP_DEPTH;
// Map cell walk: the cell rows and columns to read, the current map word index in bank 7F
// and that of the column's first word, the byte offset of the first cell inside a map word,
// the cells left in the first and in the current map word, the cell rows left in a column,
// the depth order (OBJECT_DEPTH_ORDER), later nonzero when the map column lies on a cell
// boundary, the row inside the first cell and the camera X/4 and Y/4 (the shared fields
// are in native-sprite-helpers.mjs).
const DP_CELL_ROWS = 0x38,
  DP_CELL_COLUMNS = 0x3b,
  DP_MAP_WORD = 0x41,
  DP_CELL_OFFSET = 0x44,
  DP_FIRST_WORD_CELLS = 0x47,
  DP_WORD_CELLS = 0x4a,
  DP_CELL_ROWS_LEFT = 0x4d,
  DP_COLUMN_WORD = 0x53,
  DP_DEPTH_ORDER = 0x59,
  DP_COLUMN_ALIGNED = DP_DEPTH_ORDER,
  DP_ROW_OFFSET = 0x5c,
  DP_CAMERA_X = 0x65,
  DP_CAMERA_Y = 0x68;

// Object pictures in banks 9B and 9C: a pointer with LOROM_OFFSET set selects bank 9C.
// Byte 0 and 1 hold the anchor, byte 2 the rows (high nibble) and columns of 16x16 parts,
// from byte 3 one byte per part: PART_EMPTY for a part without tile, and the flip bits.
const PICTURE_BANK = 0x9b,
  PICTURE_SIZE = 2,
  PICTURE_PARTS = 3,
  PICTURE_ROWS_MASK = 0xf0,
  PART_EMPTY = 0x20;
// Screen projection (quarter units): row = (0C00 - diagonal - height - anchor Y) / 4,
// column = (0600 + Y - X - anchor X) / 4.
const PROJECTION_ROW_BASE = 0xc00,
  PROJECTION_COLUMN_BASE = 0x600;
// Positions from -8 still count as visible (VISIBLE_HEIGHT/WIDTH in native-sprite-helpers.mjs).
const EDGE_MIN = 0xfff8;
const CELL_ALIGN_MASK = 0xfff8,
  CELL_OFFSET_MASK = 7,
  // Arithmetic shift right by four (fills the four top bits for a negative row).
  SHIFT_4_SIGN_BITS = 0xf000;
// Wall map in bank 7F: one word per 32 rows (four cells) of a map column, 0x20 bytes per
// column, negative: no walls; its value plus the cell offset indexes six-byte cells.
// (WALL_MAP, WALL_CELL_BYTES and WALL_WORD_CELLS in wram.mjs.)
const MAP_WORD_ROWS_MASK = 0xffe0,
  MAP_CELL_INDEX_MASK = 0x18,
  MAP_COLUMN_BYTES = 0x20;
// OAM high table bytes for X bit 8 of a part (ORA), indexed by OAM offset / 4 - 1.
const HIGH_X_BITS = 0xb85e;
// 80:B933: 128 unrolled STA $3D09+4k (three bytes each) that move sprites below the screen.
const HIDE_SEQUENCE = 0xb933,
  STA_ABSOLUTE_BYTES = 3,
  HIDDEN_Y = 0xf0;

function depthCompare(h, table) {
  const { ctx } = h;
  h.asl();
  h.index('x', ctx.a);
  const target = h.read(CODE_BANK_BASE | (table + ctx.x), 2),
    c = COMPARE.get(target);
  if (!c) taskStop('task_sprite_compare_target_open', { table, target });
  h.index('x', h.dp(DP_FIRST_OBJECT));
  h.load(field(h, c.field, 'x'));
  h.cmp(field(h, c.field, 'y'));
  if (((ctx.status & FLAG_CARRY) !== 0) === c.onCarry ? c.addOnBranch : !c.addOnBranch) {
    dpLoad(h, c.target);
    clc(h);
    h.adc(field(h, OBJECT_DEPTH_BIAS, c.target === DP_FIRST_KEY ? 'x' : 'y'));
    dpStore(h, c.target);
  }
  return h.rts();
}
// One comparison step of the sort at position X (pair 14B2+X / 14B4+X), ret = return addresses.
function sortStep(h, first, second) {
  const { ctx } = h;
  h.index('y', field(h, DRAW_LIST, 'x'));
  h.dpWrite(DP_FIRST_OBJECT, ctx.y);
  h.load(field(h, OBJECT_DIAGONAL, 'y'));
  dpStore(h, DP_FIRST_KEY);
  h.load(field(h, OBJECT_DEPTH_RULE, 'y'));
  h.index('y', field(h, DRAW_LIST + 2, 'x'));
  h.load(ctx.a | field(h, OBJECT_DEPTH_RULE, 'y'));
  let swap;
  if (ctx.status & FLAG_ZERO) {
    dpLoad(h, DP_FIRST_KEY);
    h.cmp(field(h, OBJECT_DIAGONAL, 'y'));
    swap = !(ctx.status & FLAG_CARRY);
  } else {
    h.load(field(h, OBJECT_DIAGONAL, 'y'));
    dpStore(h, DP_SECOND_KEY);
    h.dpWrite(DP_SORT_POSITION, ctx.x);
    h.load(field(h, OBJECT_DEPTH_RULE, 'y'));
    if (!(ctx.status & FLAG_NEGATIVE))
      h.call(first, 0x80b0a5, () => {
        h.index('x', h.dp(DP_FIRST_OBJECT));
        h.load(field(h, OBJECT_DEPTH_RULE, 'x'));
        return depthCompare(h, DEPTH_RULES_FIRST);
      });
    else h.call(second, 0x80b0ed, () => depthCompare(h, DEPTH_RULES_SECOND));
    h.index('x', h.dp(DP_SORT_POSITION));
    dpLoad(h, DP_FIRST_KEY);
    h.cmp(h.dp(DP_SECOND_KEY));
    swap = !(ctx.status & FLAG_CARRY);
  }
  if (swap) {
    dpLoad(h, DP_FIRST_OBJECT);
    h.write(h.abs(DRAW_LIST + 2) + ctx.x, ctx.a);
    h.load(ctx.y);
    h.write(h.abs(DRAW_LIST) + ctx.x, ctx.a);
  }
}
// 80:AFFC: one pass downwards and (with more than two entries) one upwards.
export function runDrawListSortPass(h) {
  const { ctx } = h;
  h.index('x', h.read(h.abs(DRAW_LIST_INDEX)));
  if (ctx.status & FLAG_ZERO || ctx.status & FLAG_NEGATIVE) return h.rts();
  h.index('x', ctx.x - 1);
  h.index('x', ctx.x - 1);
  do {
    sortStep(h, 0x80b029, 0x80b02e);
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(h.read(h.abs(DRAW_LIST_INDEX)));
  h.cmp(2);
  if (ctx.status & FLAG_ZERO) return h.rts();
  h.index('x', 2);
  do {
    sortStep(h, 0x80b07b, 0x80b080);
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.cpx(h.read(h.abs(DRAW_LIST_INDEX)));
  } while (!(ctx.status & FLAG_CARRY));
  return h.rts();
}
// 80:AB0A: palette slot for palette A ($17E6+2A, free = negative): assign a new slot $17D4 and record it in
// $17D6. Result A = slot.
export function runPaletteSlot(h) {
  const { ctx } = h;
  h.asl();
  h.index('x', ctx.a);
  h.load(field(h, PALETTE_SLOTS, 'x'));
  if (!(ctx.status & FLAG_NEGATIVE)) return h.rts();
  h.load(h.read(h.abs(PALETTE_UPLOAD_LIST_BYTES)));
  h.write(h.abs(PALETTE_SLOTS) + ctx.x, ctx.a);
  h.dpWrite(DP_SCRATCH, ctx.x);
  h.index('x', ctx.a);
  dpLoad(h, DP_SCRATCH);
  h.write(h.abs(PALETTE_UPLOAD_LIST) + ctx.x, ctx.a);
  h.load(ctx.x);
  h.index('x', ctx.x + 1);
  h.index('x', ctx.x + 1);
  h.write(h.abs(PALETTE_UPLOAD_LIST_BYTES), ctx.x);
  return h.rts();
}
// 80:B20A: enter object Y with picture pointer A into the OAM.
export function runObjectToOam(h) {
  const { ctx } = h,
    hide = () => {
      h.index('y', h.read(h.abs(ENTERED_OBJECT)));
      h.load(field(h, OBJECT_FLAGS, 'y') | OBJECT_HIDDEN);
      h.write(h.abs(OBJECT_FLAGS) + ctx.y, ctx.a);
      return h.rts();
    };
  h.write(h.abs(ENTERED_OBJECT), ctx.y);
  h.write(h.abs(ENTERED_OBJECT_FLAGS), 0);
  dpStore(h, DP_PICTURE);
  h.load(PICTURE_BANK);
  dpStore(h, DP_PICTURE_BANK);
  h.load(LOROM_OFFSET);
  h.testBits(DP_PICTURE, true, true);
  if (!(ctx.status & FLAG_ZERO)) h.modify(DP_PICTURE_BANK, 'inc', true);
  h.load(h.read(h.indirect(DP_PICTURE)) & BYTE_MASK);
  h.asl();
  dpStore(h, DP_ANCHOR_X);
  h.load(h.read(h.indirect(DP_PICTURE)));
  h.xba();
  h.load(ctx.a & BYTE_MASK);
  h.asl();
  dpStore(h, DP_ANCHOR_Y);
  h.load(
    field(h, OBJECT_FLAGS, 'y') &
      (~(OBJECT_ON_SCREEN | OBJECT_COVERED | OBJECT_HIDDEN) & WORD_MASK),
  );
  h.write(h.abs(OBJECT_FLAGS) + ctx.y, ctx.a);
  h.load(field(h, OBJECT_PALETTE, 'y'));
  h.call(0x80b23d, 0x80ab0a, () => runPaletteSlot(h));
  dpStore(h, DP_PALETTE_SLOT);
  h.load(field(h, OBJECT_DIAGONAL, 'y'));
  h.lsr();
  h.lsr();
  dpStore(h, DP_DEPTH);
  h.load(h.read(h.abs(CAMERA_Y)));
  h.lsr();
  h.lsr();
  dpStore(h, DP_CAMERA_Y);
  // Screen row: 0C00 - depth - height - picture height, divided by 4 with correct sign.
  sec(h);
  h.load(PROJECTION_ROW_BASE);
  h.sbc(field(h, OBJECT_DIAGONAL, 'y'));
  sec(h);
  h.sbc(field(h, OBJECT_HEIGHT, 'y'));
  sec(h);
  h.sbc(h.dp(DP_ANCHOR_Y));
  const quarter = () => {
    if (ctx.status & FLAG_NEGATIVE) {
      for (let n = 0; n < 2; n++) {
        const c = ctx.a & 1;
        h.load((ctx.a >>> 1) | WORD_SIGN);
        ctx.status = (ctx.status & ~FLAG_CARRY) | c;
      }
    } else {
      h.lsr();
      h.lsr();
    }
  };
  quarter();
  dpStore(h, DP_CELL_Y);
  sec(h);
  h.sbc(h.dp(DP_CAMERA_Y));
  if (!(ctx.status & FLAG_NEGATIVE)) {
    h.cmp(VISIBLE_HEIGHT);
    if (ctx.status & FLAG_CARRY) return hide();
  }
  dpStore(h, DP_TOP_Y);
  dpStore(h, DP_SCREEN_Y);
  h.load(h.read(h.abs(CAMERA_X)));
  h.lsr();
  h.lsr();
  dpStore(h, DP_CAMERA_X);
  clc(h);
  h.load(PROJECTION_COLUMN_BASE);
  h.adc(field(h, OBJECT_Y, 'y'));
  sec(h);
  h.sbc(field(h, OBJECT_X, 'y'));
  sec(h);
  h.sbc(h.dp(DP_ANCHOR_X));
  quarter();
  dpStore(h, DP_CELL_X);
  sec(h);
  h.sbc(h.dp(DP_CAMERA_X));
  if (!(ctx.status & FLAG_NEGATIVE)) {
    h.cmp(VISIBLE_WIDTH);
    if (ctx.status & FLAG_CARRY) return hide();
  }
  dpStore(h, DP_SCREEN_X);
  h.load(field(h, OBJECT_VRAM_SLOT_HEAD, 'y'));
  dpStore(h, DP_TILE);
  h.load(field(h, OBJECT_DEPTH_ORDER, 'y'));
  dpStore(h, DP_DEPTH_ORDER);
  h.index('y', PICTURE_SIZE);
  h.load(h.read(h.indirect(DP_PICTURE, ctx.y)) & PICTURE_ROWS_MASK);
  dpStore(h, DP_SCRATCH);
  clc(h);
  h.adc(h.dp(DP_TOP_Y));
  clc(h);
  h.adc(CELL_SIZE);
  if (ctx.status & FLAG_NEGATIVE) return hide();
  dpLoad(h, DP_SCRATCH);
  h.lsr();
  h.lsr();
  h.lsr();
  dpStore(h, DP_CELL_ROWS);
  h.lsr();
  dpStore(h, DP_ROWS);
  dpStore(h, DP_ROWS_LEFT);
  h.load(h.read(h.indirect(DP_PICTURE, ctx.y)) & NIBBLE_MASK);
  dpStore(h, DP_COLUMNS);
  dpStore(h, DP_COLUMNS_LEFT);
  h.asl();
  dpStore(h, DP_CELL_COLUMNS);
  h.asl();
  h.asl();
  h.asl();
  h.adc(h.dp(DP_SCREEN_X));
  clc(h);
  h.adc(CELL_SIZE);
  if (ctx.status & FLAG_NEGATIVE) return hide();
  dpLoad(h, DP_DEPTH_ORDER);
  if (!(ctx.status & FLAG_ZERO)) {
    // $1400+Y: the whole object in front of everything (positive: mask 20) or behind (negative: 30, bit 9 in 1C74)
    if (ctx.status & FLAG_NEGATIVE) {
      h.load(OBJECT_COVERED);
      h.testBits(h.abs(ENTERED_OBJECT_FLAGS), true);
      h.load(OAM_PRIORITY_3);
    } else h.load(OAM_PRIORITY_2);
    h.index('x', 0);
    do {
      h.index('y', h.dp(DP_ROWS));
      do {
        h.write(h.abs(OCCLUSION_MASKS) + ctx.x, ctx.a);
        h.index('x', ctx.x + 1);
        h.index('x', ctx.x + 1);
        h.index('y', ctx.y - 1);
      } while (!(ctx.status & FLAG_ZERO));
    } while (h.modify(DP_COLUMNS_LEFT, 'dec', true) !== 0);
  } else {
    dpLoad(h, DP_CELL_Y);
    h.load(ctx.a & CELL_OFFSET_MASK);
    if (!(ctx.status & FLAG_ZERO)) h.modify(DP_CELL_ROWS, 'inc', true);
    dpStore(h, DP_ROW_OFFSET);
    dpLoad(h, DP_CELL_X);
    dpStore(h, DP_COLUMN_ALIGNED);
    h.load(ctx.a & CELL_ALIGN_MASK);
    h.cmp(h.dp(DP_CELL_X));
    if (!(ctx.status & FLAG_ZERO)) {
      h.modify(DP_CELL_COLUMNS, 'inc', true);
      h.dpWrite(DP_COLUMN_ALIGNED, 0);
    }
    h.asl();
    h.asl();
    dpStore(h, DP_SCRATCH);
    dpLoad(h, DP_CELL_X);
    h.load(ctx.a & CELL_ALIGN_MASK);
    sec(h);
    h.sbc(h.dp(DP_CAMERA_X));
    dpStore(h, DP_CELL_X);
    dpLoad(h, DP_CELL_Y);
    h.load(ctx.a & MAP_WORD_ROWS_MASK);
    if (ctx.status & FLAG_NEGATIVE) {
      for (let n = 0; n < NIBBLE_BITS; n++) h.lsr();
      h.load(ctx.a | SHIFT_4_SIGN_BITS);
    } else for (let n = 0; n < NIBBLE_BITS; n++) h.lsr();
    h.load(ctx.a | h.dp(DP_SCRATCH));
    dpStore(h, DP_MAP_WORD);
    dpStore(h, DP_COLUMN_WORD);
    h.index('x', ctx.a);
    dpLoad(h, DP_CELL_Y);
    h.load(ctx.a & MAP_CELL_INDEX_MASK);
    h.lsr();
    dpStore(h, DP_SCRATCH);
    h.lsr();
    h.adc(h.dp(DP_SCRATCH));
    dpStore(h, DP_CELL_OFFSET);
    dpLoad(h, DP_CELL_Y);
    h.load(ctx.a & CELL_ALIGN_MASK);
    sec(h);
    h.sbc(h.dp(DP_CAMERA_Y));
    dpStore(h, DP_CELL_Y);
    dpStore(h, DP_TOP_CELL_Y);
    sec(h);
    h.load(WALL_WORD_CELLS << 2);
    h.sbc(h.dp(DP_SCRATCH));
    h.lsr();
    h.lsr();
    dpStore(h, DP_FIRST_WORD_CELLS);
    dpStore(h, DP_WORD_CELLS);
    h.index('y', 0);
    // Read map cells in bank 7F (rows of 0x20 bytes, 6 bytes per cell, 4 cells per map word).
    for (;;) {
      dpLoad(h, DP_CELL_ROWS);
      dpStore(h, DP_CELL_ROWS_LEFT);
      h.load(h.read(WALL_MAP + ctx.x));
      let column = ctx.status & FLAG_NEGATIVE ? 'empty' : 'add';
      for (;;) {
        if (column === 'empty') {
          h.load(0);
          for (;;) {
            h.write(h.abs(OCCLUSION_MASKS) + ctx.y, ctx.a);
            h.write(h.abs(OCCLUSION_TILES) + ctx.y, ctx.a);
            h.index('y', ctx.y + 1);
            h.index('y', ctx.y + 1);
            if (h.modify(DP_CELL_ROWS_LEFT, 'dec', true) === 0) break;
            if (h.modify(DP_WORD_CELLS, 'dec', true) === 0) {
              column = 'next';
              break;
            }
          }
          if (column !== 'next') break;
        } else {
          if (column === 'add') {
            clc(h);
            h.adc(h.dp(DP_CELL_OFFSET));
          }
          h.index('x', ctx.a);
          mapCell(h);
          h.write(h.abs(OCCLUSION_MASKS) + ctx.y, ctx.a);
          h.index('y', ctx.y + 1);
          h.index('y', ctx.y + 1);
          if (h.modify(DP_CELL_ROWS_LEFT, 'dec', true) === 0) break;
          if (h.modify(DP_WORD_CELLS, 'dec', true) !== 0) {
            h.load(ctx.x);
            clc(h);
            h.adc(WALL_CELL_BYTES);
            column = 'cell';
            continue;
          }
        }
        // B407: next map word
        h.load(WALL_WORD_CELLS);
        dpStore(h, DP_WORD_CELLS);
        h.index('x', h.dp(DP_MAP_WORD));
        h.index('x', ctx.x + 1);
        h.index('x', ctx.x + 1);
        h.dpWrite(DP_MAP_WORD, ctx.x, 2);
        h.load(h.read(WALL_MAP + ctx.x));
        column = ctx.status & FLAG_NEGATIVE ? 'empty' : 'cell';
      }
      if (h.modify(DP_CELL_COLUMNS, 'dec', true) === 0) break;
      dpLoad(h, DP_FIRST_WORD_CELLS);
      dpStore(h, DP_WORD_CELLS);
      h.load(ctx.y);
      h.load(ctx.a & (~(OCCLUSION_COLUMN_BYTES - 1) & WORD_MASK));
      clc(h);
      h.adc(OCCLUSION_COLUMN_BYTES);
      h.index('y', ctx.a);
      dpLoad(h, DP_COLUMN_WORD);
      h.adc(MAP_COLUMN_BYTES);
      dpStore(h, DP_COLUMN_WORD);
      dpStore(h, DP_MAP_WORD);
      h.index('x', ctx.a);
    }
    h.index('y', 0);
    h.index('x', 0);
    dpLoad(h, DP_COLUMN_ALIGNED);
    if (ctx.status & FLAG_ZERO) {
      dpLoad(h, DP_ROW_OFFSET);
      occlusion(h, ctx.status & FLAG_ZERO ? 'B' : 'A');
    } else {
      dpLoad(h, DP_ROW_OFFSET);
      occlusion(h, ctx.status & FLAG_ZERO ? 'D' : 'C');
    }
  }
  // B755: OAM entries of the picture (columns DP20, rows DP23), tile chain from DP29.
  h.index('y', h.read(h.abs(ENTERED_OBJECT)));
  h.load(OBJECT_ON_SCREEN);
  h.testBits(h.abs(ENTERED_OBJECT_FLAGS), true);
  dpLoad(h, DP_ROWS);
  dpStore(h, DP_ROWS_LEFT);
  h.index('y', PICTURE_PARTS);
  for (;;) {
    let visible = true;
    dpLoad(h, DP_SCREEN_X);
    h.cmp(EDGE_MIN);
    if (!(ctx.status & FLAG_CARRY)) {
      h.cmp(VISIBLE_WIDTH);
      if (ctx.status & FLAG_CARRY) visible = false;
    }
    if (visible) {
      dpLoad(h, DP_SCREEN_Y);
      h.cmp(EDGE_MIN);
      if (!(ctx.status & FLAG_CARRY)) {
        h.cmp(VISIBLE_HEIGHT);
        if (ctx.status & FLAG_CARRY) visible = false;
      }
    }
    let next = true;
    if (visible) {
      h.load(h.read(h.indirect(DP_PICTURE, ctx.y)));
      h.bit(PART_EMPTY);
      if (!(ctx.status & FLAG_ZERO)) next = false;
      else {
        h.load(ctx.y);
        h.asl();
        h.index('x', ctx.a);
        // Part n (picture byte 3 + n) reads its priority from OCCLUSION_MASKS + 2n.
        h.load(field(h, OCCLUSION_MASKS - 2 * PICTURE_PARTS, 'x'));
        dpStore(h, DP_PRIORITY);
        h.index('x', h.dp(DP_OAM_OFFSET));
        h.cpx(OAM_LOW_TABLE_BYTES);
        if (ctx.status & FLAG_CARRY) next = false;
        else {
          h.sep(FLAG_MEMORY_8BIT);
          dpLoad(h, DP_SCREEN_X);
          h.write(WRAM + OAM_BUFFER + ctx.x, ctx.a);
          h.index('x', ctx.x + 1);
          dpLoad(h, DP_SCREEN_Y);
          h.load(ctx.a - 1);
          h.write(WRAM + OAM_BUFFER + ctx.x, ctx.a);
          h.index('x', ctx.x + 1);
          dpLoad(h, DP_TILE);
          h.write(WRAM + OAM_BUFFER + ctx.x, ctx.a);
          h.index('x', ctx.x + 1);
          h.load(h.read(h.indirect(DP_PICTURE, ctx.y)) & OAM_FLIP_MASK);
          h.load(ctx.a | h.dp(DP_PALETTE_SLOT));
          h.load(ctx.a | h.dp(DP_PRIORITY));
          h.write(WRAM + OAM_BUFFER + ctx.x, ctx.a);
          h.index('x', ctx.x + 1);
          h.dpWrite(DP_OAM_OFFSET, ctx.x, 2);
          dpLoad(h, DP_SCREEN_X_HIGH);
          if (ctx.status & FLAG_NEGATIVE) highBits(h, HIGH_X_BITS, true);
          h.sep(FLAG_MEMORY_8BIT);
        }
      }
    } else {
      h.sep(FLAG_MEMORY_8BIT);
      h.load(h.read(h.indirect(DP_PICTURE, ctx.y)));
      h.bit(PART_EMPTY);
      if (!(ctx.status & FLAG_ZERO)) next = false;
    }
    if (next) {
      h.index('x', h.dp(DP_TILE, 2));
      h.load(h.read(h.abs(VRAM_SLOT_NEXT) + ctx.x));
      dpStore(h, DP_TILE);
    }
    h.rep(FLAG_MEMORY_8BIT);
    h.index('y', ctx.y + 1);
    if (h.modify(DP_ROWS_LEFT, 'dec', true) !== 0) {
      clc(h);
      dpLoad(h, DP_SCREEN_Y);
      h.adc(PART_SIZE);
      dpStore(h, DP_SCREEN_Y);
      continue;
    }
    if (h.modify(DP_COLUMNS, 'dec', true) === 0) break;
    clc(h);
    dpLoad(h, DP_SCREEN_X);
    h.adc(PART_SIZE);
    dpStore(h, DP_SCREEN_X);
    dpLoad(h, DP_ROWS);
    dpStore(h, DP_ROWS_LEFT);
    dpLoad(h, DP_TOP_Y);
    dpStore(h, DP_SCREEN_Y);
  }
  // B814: transfer the cell bits from 1C74 to $1458+Y (none: all bits as collected; only
  // front walls: cell bits off; only open cells: OBJECT_COVERED; both: OBJECT_HIDDEN).
  h.index('y', h.read(h.abs(ENTERED_OBJECT)));
  h.load(h.read(h.abs(ENTERED_OBJECT_FLAGS)) & CELL_BITS);
  if (ctx.status & FLAG_ZERO) {
    h.load(field(h, OBJECT_FLAGS, 'y') | h.read(h.abs(ENTERED_OBJECT_FLAGS)));
    h.write(h.abs(OBJECT_FLAGS) + ctx.y, ctx.a);
    return h.rts();
  }
  h.cmp(CELL_BITS);
  if (ctx.status & FLAG_ZERO) {
    h.load(h.read(h.abs(ENTERED_OBJECT_FLAGS)) & (~CELL_BITS & WORD_MASK));
    h.load(ctx.a | OBJECT_HIDDEN);
  } else {
    h.lsr();
    h.load(h.read(h.abs(ENTERED_OBJECT_FLAGS)) & (~CELL_BITS & WORD_MASK));
    if (!(ctx.status & FLAG_CARRY)) h.load(ctx.a | OBJECT_COVERED);
  }
  h.load(ctx.a | field(h, OBJECT_FLAGS, 'y'));
  h.write(h.abs(OBJECT_FLAGS) + ctx.y, ctx.a);
  return h.rts();
}
// 80:B8DE: sort, reset the palette and OAM lists, the player first, then all visible objects
// of the draw list (bit 7 in $1458 off, picture 7E3F80 not 0), hide the remaining sprites (Y = F0).
export function buildSpriteList(h) {
  const { ctx } = h;
  h.call(0x80b8de, 0x80affc, () => runDrawListSortPass(h));
  h.call(0x80b8e1, 0x81a840, () => clearPaletteSlots(h), true);
  h.call(
    0x80b8e5,
    0x81a7fc,
    () => {
      h.load(OAM_HIGH_ALL_LARGE);
      for (let o = 0; o < OAM_HIGH_TABLE_BYTES; o += 2) h.write(WRAM + OAM_HIGH_TABLE + o, ctx.a);
      return h.rtl();
    },
    true,
  );
  h.index('y', h.read(h.abs(PLAYER_OBJECT)));
  if (!(ctx.status & FLAG_NEGATIVE)) {
    h.load(field(h, OBJECT_PALETTE, 'y'));
    h.call(0x80b8f1, 0x80ab0a, () => runPaletteSlot(h));
  }
  // OAM entry 0 stays reserved (the glove sprite of the game NMI).
  h.load(OAM_ENTRY_BYTES);
  h.dpWrite(DP_OAM_OFFSET, ctx.a);
  h.index('y', h.read(h.abs(DRAW_LIST_INDEX)));
  if (!(ctx.status & FLAG_NEGATIVE))
    do {
      h.index('x', field(h, DRAW_LIST, 'y'));
      h.load(field(h, OBJECT_FLAGS, 'x'));
      h.bit(OBJECT_NOT_DRAWN);
      if (ctx.status & FLAG_ZERO) {
        h.load(h.read(WRAM + OBJECT_PICTURE + ctx.x));
        if (!(ctx.status & FLAG_ZERO)) {
          h.phy();
          h.index('y', ctx.x);
          h.call(0x80b911, 0x80b20a, () => runObjectToOam(h));
          h.ply();
        }
      }
      h.index('y', ctx.y - 1);
      h.index('y', ctx.y - 1);
    } while (!(ctx.status & FLAG_NEGATIVE));
  // Jump into the unrolled sequence STA $3D09+4k (k = DP84/4) at 80:B933, BYTE F0 with DBR 7E.
  dpLoad(h, DP_OAM_OFFSET);
  h.lsr();
  h.dpWrite(DP_PICTURE, ctx.a);
  h.lsr();
  h.adc(h.dp(DP_PICTURE));
  h.adc(HIDE_SEQUENCE);
  h.dpWrite(DP_PICTURE, ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.phb();
  h.a.pushWord(WRAM_BANK_PAIR);
  h.plb();
  h.plb();
  h.load(HIDDEN_Y);
  const target = h.dp(DP_PICTURE, 2),
    k = (target - HIDE_SEQUENCE) / STA_ABSOLUTE_BYTES;
  if (!Number.isInteger(k) || k < 0 || k > OBJECT_COUNT)
    taskStop('task_sprite_clear_target_open', { target });
  for (let n = k; n < OBJECT_COUNT; n++)
    h.write(h.abs(OAM_BUFFER + OAM_Y_BYTE + OAM_ENTRY_BYTES * n), ctx.a);
  h.plb();
  h.rep(FLAG_MEMORY_8BIT);
  h.call(
    0x80bab6,
    0x81a954,
    () => {
      h.modify(h.abs(NMI_JOB_LISTS), 'inc');
      return h.rtl();
    },
    true,
  );
  return h.rts();
}
