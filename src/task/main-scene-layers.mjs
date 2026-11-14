import { unpackStep } from './native-unpack-body.mjs';
import { SCENE_LOAD_ROUTINES } from './main-scene-load.mjs';
import { routineCaller } from './routine-call.mjs';
import {
  DP_SCENE_COUNT,
  DP_SCENE_LAYER,
  DP_SCENE_LAYER_BITS,
  DP_SCENE_RECORD,
  DP_TILE_FIRST,
  DP_TILE_FREE,
  DP_TILE_SECOND,
  DP_TILE_THIRD,
  DP_WALL_NEXT,
  GRAPHIC_DEPTH_MODE,
  TILE_STACK_FIRST,
  TILE_STACK_FREE,
  TILE_STACK_HEADS,
  TILE_STACK_NEXT,
  TILE_STACK_PREVIOUS,
  TILE_STACK_SECOND,
  TILE_STACK_THIRD,
  TILE_STACK_USES,
  WALL_CELL_BYTES,
  WALL_HEIGHTS,
  WALL_MAP,
  WALL_WORD_CELLS,
  WRAM,
} from './wram.mjs';
import { OBJECT_TABLE } from '../data/object-types.mjs';
import { GRAPHIC_TABLE } from '../data/object-graphics.mjs';
import {
  TILE_FLIP_BITS,
  TILE_H_FLIP,
  TILE_NAME_MASK,
  TILE_PALETTE_BITS,
} from '../constants/ppu.mjs';
import {
  BYTE_MASK,
  BYTE_SIGN,
  BYTE_VALUES,
  HIGH_BYTE_MASK,
  NIBBLE_BITS,
  NIBBLE_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
  BYTE_BITS,
} from '../constants/bits.mjs';
import {
  FLAG_MEMORY_8BIT,
  FLAG_CARRY,
  FLAG_ZERO,
  FLAG_OVERFLOW,
  FLAG_NEGATIVE,
} from '../constants/cpu-flags.mjs';

// Value written to mark a wall height as empty (negative).
const NONE = WORD_MASK;
// Direct page of 81:903E besides the shared DP_SCENE_* and DP_TILE_* fields (wram.mjs).
// Per object: the type definition pointer (bank DP13), its flip (TILE_H_FLIP or 0), the
// layer position (row in the high byte, column * 2 in the low byte, DP_CELL form) and the
// depth of the object, the parts left. The object word, X, Y and Z fields are reused per
// part as the part flip, the current cell, the row start and the depth base.
const DP_DEFINITION = 0x11,
  DP_DEFINITION_BANK = 0x13,
  DP_OBJECT_FLIP = 0x29,
  DP_POSITION = 0x2c,
  DP_DEPTH = 0x2f,
  DP_PARTS = 0x32,
  DP_X = 0x35,
  DP_PART_FLIP = DP_X,
  DP_Y = 0x38,
  DP_CELL = DP_Y,
  DP_Z = 0x3b,
  DP_ROW_START = DP_Z,
  DP_WORD = 0x3e,
  DP_PART_DEPTH = DP_WORD;
// Per graphic: its long pointer (bank DP16), the rows left, the cells per row and left,
// the palette bits, the new tile word, the depth of the cell and the saved read position.
const DP_GRAPHIC = 0x14,
  DP_GRAPHIC_BANK = 0x16,
  DP_ROWS_LEFT = 0x41,
  DP_ROW_CELLS = 0x44,
  DP_CELLS_LEFT = 0x47,
  DP_PALETTE = 0x4a,
  DP_TILE = 0x4d,
  DP_CELL_DEPTH = 0x50,
  DP_READ = 0x53;
// Per cell: the wall cell record, the layer offset, a full stack (3) or 0, the layer
// tile found there, the palette bits of the result and a scratch word.
const DP_CELL_RECORD = 0x56,
  DP_LAYER_OFFSET = 0x59,
  DP_STACK_FULL = 0x5f,
  DP_OLD_TILE = 0x62,
  DP_TILE_PALETTE = 0x68,
  DP_SCRATCH = 0x6b;

// Object definitions in bank 8A (src/data/object-types.mjs): the screen field word for
// an unflipped and a flipped object, the depth word, then 5 bytes per part from offset 8.
// Bits 0-12 of the object word, doubled, index the type table.
const DEFINITION_BANK = OBJECT_TABLE >>> WORD_BITS,
  HEADER_POSITION = 1,
  HEADER_POSITION_FLIPPED = 3,
  HEADER_DEPTH = 5,
  HEADER_BYTES = 8,
  TYPE_INDEX_MASK = 0x3fff,
  // Graphic number * 3 in bits 0-14 (bit 15 flips the part).
  GRAPHIC_INDEX_MASK = WORD_SIGN - 1,
  // Graphic byte 1: bit 7 selects one depth byte per row, bits 0-6 the palette.
  GRAPHIC_PALETTE_MASK = BYTE_SIGN - 1,
  DEPTH_PER_ROW = 0x7ffe;
// Layer position of an object: row = (0300 - depth - 8 z) / 8 (a 13-bit signed result,
// times 2), column = (y - x + 0280) / 8 in the high byte.
const PROJECTION_ROW_BASE = 0x300,
  PROJECTION_COLUMN_BASE = 0x280,
  SHIFT_3_SIGN_BIT = 0x1000,
  SHIFT_3_SIGN_BITS = 0xe000,
  ROW_STEP = BYTE_VALUES;
// A cell (DP_CELL form) is drawn for rows 20 to 7F and columns without bit 7; layer
// offset = row * 80 + column * 2 - 1000. Four layer cells share a wall map word.
const CELL_FIRST_ROW = 0x2000,
  CELL_ROW_END = 0x8000,
  CELL_COLUMN_MASK = BYTE_SIGN - 1,
  LAYER_ORIGIN = 0x1000,
  WALL_WORD_MASK = 0xfff8,
  WALL_CELL_INDEX_MASK = 2 * (WALL_WORD_CELLS - 1),
  WALL_WORD_RECORD_BYTES = WALL_WORD_CELLS * WALL_CELL_BYTES;
// Three heights per wall cell record, as byte offsets: the full stack and the last slot.
const STACK_WORDS = 3,
  STACK_BYTES = 2 * STACK_WORDS,
  STACK_LAST = 2 * (STACK_WORDS - 1),
  HEIGHT_SECOND = WALL_HEIGHTS + 2,
  HEIGHT_THIRD = WALL_HEIGHTS + 2 * 2;

// 81:903E: layer records -> the original depth-sorted three-word tile stacks (lifted in
// src/game/scene-load.mjs; this version serves the reference and the Mesen cold boot
// replay).
// All counters and saved indices are fresh. These equations retain WORD wrap,
// BYTE sign extension and the original clipping/eviction branches.
export function buildLayerTileStacks(h, e, r = SCENE_LOAD_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  const iny = (n = 1) => {
    for (let i = 0; i < n; i++) h.index('y', ctx.y + 1);
  };
  const dx = () => {
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  };
  const input = (ptr) => h.read(h.indirect(ptr, ctx.y));
  const field = (at, index = 'x') => h.read(h.abs(at) + ctx[index]);
  const put = (at, value, index = 'x') => h.write(h.abs(at) + ctx[index], value);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(DEFINITION_BANK);
  h.dpWrite(DP_DEFINITION_BANK, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.index('y', 0);
  do {
    h.load(input(DP_SCENE_RECORD));
    h.asl();
    h.dpWrite(DP_WORD, ctx.a);
    h.load(ctx.a & TYPE_INDEX_MASK);
    iny(2);
    h.index('x', ctx.a);
    h.load(h.read(OBJECT_TABLE + ctx.x));
    h.dpWrite(DP_DEFINITION, ctx.a);
    h.load(ctx.status & FLAG_CARRY ? TILE_H_FLIP : 0);
    h.dpWrite(DP_OBJECT_FLIP, ctx.a);
    h.dpWrite(DP_Y, 0);
    h.dpWrite(DP_X, 0);
    h.index('x', HIGH_BYTE_MASK);
    h.load(h.dp(DP_WORD));
    h.asl();
    if (ctx.status & FLAG_CARRY) h.dpWrite(DP_Y, ctx.x, 2);
    h.asl();
    if (ctx.status & FLAG_CARRY) h.dpWrite(DP_X, ctx.x, 2);
    h.load(input(DP_SCENE_RECORD));
    h.load(ctx.a & BYTE_MASK);
    h.bit(BYTE_SIGN);
    if (!(ctx.status & FLAG_ZERO)) h.load(ctx.a | HIGH_BYTE_MASK);
    h.asl();
    h.asl();
    h.asl();
    h.dpWrite(DP_Z, ctx.a);
    iny();
    for (const at of [DP_X, DP_Y]) {
      h.load(input(DP_SCENE_RECORD));
      h.load(ctx.a & BYTE_MASK);
      h.load(ctx.a | h.dp(at));
      h.asl();
      h.asl();
      h.dpWrite(at, ctx.a);
      iny();
    }
    h.phy();
    h.load(h.dp(DP_X));
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(DP_Y));
    h.lsr();
    h.dpWrite(DP_DEPTH, ctx.a);
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(DP_Z));
    ctx.status |= FLAG_CARRY;
    h.sbc(PROJECTION_ROW_BASE);
    h.load(ctx.a ^ WORD_MASK);
    h.load(ctx.a + 1);
    h.lsr();
    h.lsr();
    h.lsr();
    h.bit(SHIFT_3_SIGN_BIT);
    if (!(ctx.status & FLAG_ZERO)) h.load(ctx.a | SHIFT_3_SIGN_BITS);
    h.asl();
    h.dpWrite(DP_POSITION, ctx.a);
    h.load(h.dp(DP_Y));
    ctx.status |= FLAG_CARRY;
    h.sbc(h.dp(DP_X));
    ctx.status &= ~FLAG_CARRY;
    h.adc(PROJECTION_COLUMN_BASE);
    h.lsr();
    h.lsr();
    h.lsr();
    h.xba();
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(DP_POSITION));
    h.dpWrite(DP_POSITION, ctx.a);
    h.index('y', HEADER_POSITION);
    h.load(h.dp(DP_OBJECT_FLIP));
    if (!(ctx.status & FLAG_ZERO)) h.index('y', HEADER_POSITION_FLIPPED);
    h.load(input(DP_DEFINITION));
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(DP_POSITION));
    h.dpWrite(DP_POSITION, ctx.a);
    h.index('y', HEADER_DEPTH);
    h.load(input(DP_DEFINITION));
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(DP_DEPTH));
    h.dpWrite(DP_DEPTH, ctx.a);
    h.index('y', HEADER_BYTES);
    h.load(h.read(h.indirect(DP_DEFINITION)));
    h.load(ctx.a & BYTE_MASK);
    if (!(ctx.status & FLAG_ZERO)) {
      h.dpWrite(DP_PARTS, ctx.a);
      do {
        h.load(input(DP_DEFINITION));
        h.asl();
        h.php();
        ctx.status &= ~FLAG_CARRY;
        h.adc(input(DP_DEFINITION));
        h.load(ctx.a & GRAPHIC_INDEX_MASK);
        h.index('x', ctx.a);
        iny(2);
        h.sep(FLAG_MEMORY_8BIT);
        h.load(h.read(GRAPHIC_TABLE + 2 + ctx.x));
        h.dpWrite(DP_GRAPHIC_BANK, ctx.a);
        h.plp();
        h.load(h.read(GRAPHIC_TABLE + ctx.x));
        h.dpWrite(DP_GRAPHIC, ctx.a);
        h.load(ctx.status & FLAG_CARRY ? TILE_H_FLIP : 0);
        h.load(ctx.a ^ h.dp(DP_OBJECT_FLIP));
        h.dpWrite(DP_PART_FLIP, ctx.a);
        h.load(input(DP_DEFINITION));
        h.load(ctx.a & BYTE_MASK);
        ctx.status &= ~FLAG_CARRY;
        h.adc(h.dp(DP_POSITION));
        h.dpWrite(DP_CELL, ctx.a);
        h.load(input(DP_DEFINITION));
        h.load(ctx.a & HIGH_BYTE_MASK);
        iny(2);
        // Memory BIT takes N/V from DP29 as well as Z from A AND DP29.
        const bits = h.dp(DP_OBJECT_FLIP);
        ctx.status =
          (ctx.status & ~(FLAG_ZERO | FLAG_OVERFLOW | FLAG_NEGATIVE)) |
          ((bits >>> BYTE_BITS) & (FLAG_NEGATIVE | FLAG_OVERFLOW)) |
          ((ctx.a & bits) === 0 ? FLAG_ZERO : 0);
        if (ctx.status & FLAG_OVERFLOW) {
          ctx.status |= FLAG_CARRY;
          h.dpWrite(DP_SCRATCH, ctx.a);
          h.load(h.dp(DP_CELL));
          h.sbc(h.dp(DP_SCRATCH));
        } else {
          ctx.status &= ~FLAG_CARRY;
          h.adc(h.dp(DP_CELL));
        }
        h.dpWrite(DP_CELL, ctx.a);
        h.dpWrite(DP_ROW_START, ctx.a);
        h.load(input(DP_DEFINITION));
        iny();
        h.load(ctx.a & BYTE_MASK);
        ctx.status &= ~FLAG_CARRY;
        h.adc(h.dp(DP_DEPTH));
        h.dpWrite(DP_PART_DEPTH, ctx.a);
        h.dpWrite(DP_CELL_DEPTH, ctx.a);
        h.phy();
        h.load(h.read(h.indirect(DP_GRAPHIC)));
        h.load(ctx.a & NIBBLE_MASK);
        h.dpWrite(DP_ROWS_LEFT, ctx.a);
        h.load(h.read(h.indirect(DP_GRAPHIC)));
        h.load(ctx.a & (NIBBLE_MASK << NIBBLE_BITS));
        for (let n = 0; n < NIBBLE_BITS; n++) h.lsr();
        h.dpWrite(DP_ROW_CELLS, ctx.a);
        h.dpWrite(DP_CELLS_LEFT, ctx.a);
        h.index('y', 1);
        h.load(input(DP_GRAPHIC));
        h.load(ctx.a & BYTE_SIGN);
        if (!(ctx.status & FLAG_ZERO)) h.load(DEPTH_PER_ROW);
        h.write(h.abs(GRAPHIC_DEPTH_MODE), ctx.a);
        h.load(input(DP_GRAPHIC));
        iny();
        h.load(ctx.a & GRAPHIC_PALETTE_MASK);
        h.phy();
        call(0x81918a, 0x818ce0);
        h.ply();
        // Palette slot << 10: the palette bits of a tile word.
        h.xba();
        h.asl();
        h.asl();
        h.dpWrite(DP_PALETTE, ctx.a);
        for (;;) {
          h.modify(h.abs(GRAPHIC_DEPTH_MODE), 'inc');
          h.load(h.read(h.abs(GRAPHIC_DEPTH_MODE)));
          if (!(ctx.status & FLAG_NEGATIVE)) {
            h.load(input(DP_GRAPHIC));
            h.load(ctx.a & BYTE_MASK);
            ctx.status &= ~FLAG_CARRY;
            h.adc(h.dp(DP_PART_DEPTH));
            h.dpWrite(DP_CELL_DEPTH, ctx.a);
          }
          h.load(h.dp(DP_CELL));
          h.cmp(CELL_FIRST_ROW);
          let clipped = !(ctx.status & FLAG_CARRY);
          if (!clipped) {
            h.cmp(CELL_ROW_END);
            clipped = Boolean(ctx.status & FLAG_CARRY);
            if (!clipped) {
              h.load(ctx.a & BYTE_SIGN);
              clipped = !(ctx.status & FLAG_ZERO);
            }
          }
          if (clipped) {
            h.load(h.read(h.abs(GRAPHIC_DEPTH_MODE)));
            if (!(ctx.status & FLAG_NEGATIVE)) iny();
            iny(2);
            h.dpWrite(DP_READ, ctx.y, 2);
          } else {
            h.load(h.read(h.abs(GRAPHIC_DEPTH_MODE)));
            if (!(ctx.status & FLAG_NEGATIVE)) iny();
            h.load(input(DP_GRAPHIC));
            if (ctx.status & FLAG_ZERO) {
              iny(2);
              h.dpWrite(DP_READ, ctx.y, 2);
            } else {
              iny(2);
              h.load(ctx.a ^ h.dp(DP_PART_FLIP));
              h.dpWrite(DP_TILE, ctx.a);
              h.dpWrite(DP_READ, ctx.y, 2);
              unpackStep(h, e, 0x8191d4);
              h.load(h.dp(DP_CELL));
              unpackStep(h, e, 0x8191d6);
              h.load(ctx.a & HIGH_BYTE_MASK);
              h.lsr();
              h.dpWrite(DP_SCRATCH, ctx.a);
              h.load(h.dp(DP_CELL));
              h.load(ctx.a & CELL_COLUMN_MASK);
              h.load(ctx.a | h.dp(DP_SCRATCH));
              ctx.status |= FLAG_CARRY;
              h.sbc(LAYER_ORIGIN);
              h.dpWrite(DP_LAYER_OFFSET, ctx.a);
              h.load(ctx.a & WALL_WORD_MASK);
              unpackStep(h, e, 0x8191ec);
              h.lsr();
              h.lsr();
              h.index('x', ctx.a);
              h.load(h.dp(DP_LAYER_OFFSET));
              h.load(ctx.a & WALL_CELL_INDEX_MASK);
              h.dpWrite(DP_SCRATCH, ctx.a);
              h.asl();
              h.adc(h.dp(DP_SCRATCH));
              h.dpWrite(DP_CELL_RECORD, ctx.a);
              h.load(h.read(WALL_MAP + ctx.x));
              if (ctx.status & FLAG_NEGATIVE) {
                // A new wall map word takes the next four cell records; their first
                // heights start empty.
                h.load(h.dp(DP_WALL_NEXT));
                h.write(WALL_MAP + ctx.x, ctx.a);
                h.index('x', ctx.a);
                h.adc(WALL_WORD_RECORD_BYTES);
                h.dpWrite(DP_WALL_NEXT, ctx.a);
                h.load(NONE);
                for (let cell = 0; cell < WALL_WORD_CELLS; cell++)
                  h.write(WALL_HEIGHTS + cell * WALL_CELL_BYTES + ctx.x, ctx.a);
                h.load(ctx.x);
              }
              h.adc(h.dp(DP_CELL_RECORD));
              h.dpWrite(DP_CELL_RECORD, ctx.a);
              h.index('y', h.dp(DP_LAYER_OFFSET, 2));
              h.load(h.read(h.abs(h.dp(DP_SCENE_LAYER, 2)) + ctx.y));
              h.dpWrite(DP_OLD_TILE, ctx.a);
              let skip = false;
              if (ctx.status & FLAG_ZERO) {
                h.dpWrite(DP_TILE_SECOND, 0);
                h.dpWrite(DP_TILE_THIRD, 0);
                h.index('y', 0);
                h.index('x', h.dp(DP_CELL_RECORD, 2));
                h.load(NONE);
                h.write(HEIGHT_SECOND + ctx.x, ctx.a);
                h.load(h.dp(DP_PALETTE));
                h.dpWrite(DP_TILE_PALETTE, ctx.a);
              } else {
                // Unpack the stack of the tile already there, with its flip applied.
                h.load(ctx.a & TILE_NAME_MASK);
                h.asl();
                h.index('x', ctx.a);
                h.load(h.dp(DP_OLD_TILE));
                unpackStep(h, e, 0x819247);
                h.load(ctx.a & TILE_PALETTE_BITS);
                h.dpWrite(DP_TILE_PALETTE, ctx.a);
                h.load(h.dp(DP_OLD_TILE));
                h.load(ctx.a & TILE_FLIP_BITS);
                const flip = !(ctx.status & FLAG_ZERO);
                if (flip) h.dpWrite(DP_SCRATCH, ctx.a);
                h.load(field(TILE_STACK_FIRST));
                if (flip) h.load(ctx.a ^ h.dp(DP_SCRATCH));
                h.dpWrite(DP_TILE_FIRST, ctx.a);
                h.load(field(TILE_STACK_SECOND));
                if (ctx.status & FLAG_ZERO) {
                  h.dpWrite(DP_TILE_SECOND, 0);
                  h.dpWrite(DP_TILE_THIRD, 0);
                  h.index('y', 1);
                  h.dpWrite(DP_STACK_FULL, 0);
                } else {
                  if (flip) h.load(ctx.a ^ h.dp(DP_SCRATCH));
                  h.dpWrite(DP_TILE_SECOND, ctx.a);
                  h.load(field(TILE_STACK_THIRD));
                  if (ctx.status & FLAG_ZERO) {
                    h.dpWrite(DP_TILE_THIRD, 0);
                    h.index('y', 2);
                    h.dpWrite(DP_STACK_FULL, 0);
                  } else {
                    if (flip) h.load(ctx.a ^ h.dp(DP_SCRATCH));
                    h.dpWrite(DP_TILE_THIRD, ctx.a);
                    h.index('y', STACK_WORDS);
                    h.dpWrite(DP_STACK_FULL, ctx.y, 2);
                  }
                }
                // Step through the stored heights while the cell depth lies below them.
                h.index('x', h.dp(DP_CELL_RECORD, 2));
                for (;;) {
                  h.load(h.dp(DP_CELL_DEPTH));
                  h.cmp(h.read(WALL_HEIGHTS + ctx.x));
                  if (ctx.status & FLAG_CARRY) break;
                  h.index('x', ctx.x + 1);
                  h.index('x', ctx.x + 1);
                  h.index('y', ctx.y - 1);
                  if (ctx.status & FLAG_ZERO) {
                    h.load(h.dp(DP_PALETTE));
                    h.dpWrite(DP_TILE_PALETTE, ctx.a);
                    break;
                  }
                }
                h.load(h.dp(DP_STACK_FULL));
                if (!(ctx.status & FLAG_ZERO)) {
                  h.cpy(STACK_WORDS);
                  if (ctx.status & FLAG_ZERO) skip = true;
                  else {
                    dx();
                    h.cpy(2);
                    if (!(ctx.status & FLAG_ZERO)) {
                      h.cpy(1);
                      if (ctx.status & FLAG_ZERO) {
                        h.load(h.dp(DP_TILE_SECOND));
                        h.dpWrite(DP_TILE_FIRST, ctx.a);
                        h.load(h.read(WALL_HEIGHTS + ctx.x));
                        h.write(WALL_HEIGHTS - 2 + ctx.x, ctx.a);
                      } else {
                        h.load(h.dp(DP_TILE_SECOND));
                        h.dpWrite(DP_TILE_FIRST, ctx.a);
                        h.load(h.dp(DP_TILE_THIRD));
                        h.dpWrite(DP_TILE_SECOND, ctx.a);
                        h.load(h.read(WALL_HEIGHTS - 2 + ctx.x));
                        h.write(WALL_HEIGHTS - 2 * 2 + ctx.x, ctx.a);
                        h.load(h.read(WALL_HEIGHTS + ctx.x));
                        h.write(WALL_HEIGHTS - 2 + ctx.x, ctx.a);
                        h.load(h.dp(DP_PALETTE));
                        h.dpWrite(DP_TILE_PALETTE, ctx.a);
                      }
                    }
                    h.load(ctx.x);
                    ctx.status |= FLAG_CARRY;
                    h.sbc(h.dp(DP_CELL_RECORD));
                    h.index('y', ctx.a);
                  }
                } else {
                  h.load(ctx.x);
                  ctx.status |= FLAG_CARRY;
                  h.sbc(h.dp(DP_CELL_RECORD));
                  h.cmp(STACK_BYTES);
                  if (ctx.status & FLAG_CARRY) skip = true;
                  else {
                    h.index('y', ctx.a);
                    h.cmp(STACK_LAST);
                    if (ctx.status & FLAG_ZERO) {
                      h.load(h.dp(DP_PALETTE));
                      h.dpWrite(DP_TILE_PALETTE, ctx.a);
                    } else {
                      h.index('y', ctx.a);
                      if (ctx.status & FLAG_ZERO) {
                        h.load(h.read(HEIGHT_SECOND + ctx.x));
                        h.write(HEIGHT_THIRD + ctx.x, ctx.a);
                        h.load(h.read(WALL_HEIGHTS + ctx.x));
                        h.write(HEIGHT_SECOND + ctx.x, ctx.a);
                        h.load(h.dp(DP_TILE_SECOND));
                        h.dpWrite(DP_TILE_THIRD, ctx.a);
                        h.load(h.dp(DP_TILE_FIRST));
                        h.dpWrite(DP_TILE_SECOND, ctx.a);
                      } else {
                        h.load(h.read(WALL_HEIGHTS + ctx.x));
                        h.write(HEIGHT_SECOND + ctx.x, ctx.a);
                        h.load(h.dp(DP_TILE_SECOND));
                        h.dpWrite(DP_TILE_THIRD, ctx.a);
                      }
                    }
                  }
                }
              }
              if (!skip) {
                h.load(h.dp(DP_CELL_DEPTH));
                h.write(WALL_HEIGHTS + ctx.x, ctx.a);
                h.load(h.dp(DP_TILE));
                h.write(h.abs(DP_TILE_FIRST) + ctx.y, ctx.a);
                h.load(h.dp(DP_OLD_TILE));
                if (!(ctx.status & FLAG_ZERO)) {
                  // Release the old stack entry; an unused entry leaves its hash chain
                  // and returns to the free stack.
                  h.load(ctx.a & TILE_NAME_MASK);
                  h.asl();
                  h.index('x', ctx.a);
                  h.modify(h.abs(TILE_STACK_USES) + ctx.x, 'dec');
                  if (ctx.status & FLAG_NEGATIVE) {
                    h.index('x', h.dp(DP_TILE_FREE, 2));
                    h.index('x', ctx.x + 1);
                    h.index('x', ctx.x + 1);
                    h.write(WRAM + TILE_STACK_FREE + ctx.x, ctx.a);
                    h.dpWrite(DP_TILE_FREE, ctx.x, 2);
                    h.index('y', ctx.a);
                    h.load(field(TILE_STACK_NEXT, 'y'));
                    h.index('x', field(TILE_STACK_PREVIOUS, 'y'));
                    // A chain head's previous word is its bucket offset | 8000.
                    if (ctx.status & FLAG_NEGATIVE)
                      h.write(TILE_STACK_HEADS - WORD_SIGN + ctx.x, ctx.a);
                    else put(TILE_STACK_NEXT, ctx.a);
                    h.index('y', ctx.a);
                    if (!(ctx.status & FLAG_NEGATIVE)) {
                      h.load(ctx.x);
                      put(TILE_STACK_PREVIOUS, ctx.a, 'y');
                    }
                  }
                }
                call(0x81937c, 0x818e57);
                h.load(ctx.a | h.dp(DP_TILE_PALETTE));
                unpackStep(h, e, 0x819381);
                h.load(ctx.a | h.dp(DP_SCENE_LAYER_BITS));
                h.index('y', h.dp(DP_LAYER_OFFSET, 2));
                h.write(h.abs(h.dp(DP_SCENE_LAYER, 2)) + ctx.y, ctx.a);
              }
            }
          }
          h.modify(DP_CELLS_LEFT, 'dec', true);
          if (!(ctx.status & FLAG_NEGATIVE)) {
            h.load(h.dp(DP_CELL));
            h.load(ctx.a + 1);
            h.load(ctx.a + 1);
            h.dpWrite(DP_CELL, ctx.a);
            h.index('y', h.dp(DP_READ, 2));
            continue;
          }
          h.load(h.read(h.abs(GRAPHIC_DEPTH_MODE)));
          h.load(ctx.a + 1);
          if (ctx.status & FLAG_NEGATIVE) {
            h.load(DEPTH_PER_ROW);
            h.write(h.abs(GRAPHIC_DEPTH_MODE), ctx.a);
          }
          h.modify(DP_ROWS_LEFT, 'dec', true);
          if (ctx.status & FLAG_NEGATIVE) break;
          h.load(h.dp(DP_ROW_CELLS));
          h.dpWrite(DP_CELLS_LEFT, ctx.a);
          h.load(h.dp(DP_PART_FLIP));
          if (ctx.status & FLAG_ZERO) {
            ctx.status &= ~FLAG_CARRY;
            h.load(h.dp(DP_ROW_START));
            h.adc(ROW_STEP);
          } else {
            ctx.status |= FLAG_CARRY;
            h.load(h.dp(DP_ROW_START));
            h.sbc(ROW_STEP);
          }
          h.dpWrite(DP_ROW_START, ctx.a);
          h.dpWrite(DP_CELL, ctx.a);
          h.index('y', h.dp(DP_READ, 2));
        }
        h.ply();
        h.modify(DP_PARTS, 'dec', true);
      } while (!(ctx.status & FLAG_ZERO));
    }
    h.ply();
    h.modify(DP_SCENE_COUNT, 'dec', true);
  } while (!(ctx.status & FLAG_ZERO));
  h.load(ctx.y);
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.dp(DP_SCENE_RECORD));
  h.dpWrite(DP_SCENE_RECORD, ctx.a);
  return h.rts();
}
