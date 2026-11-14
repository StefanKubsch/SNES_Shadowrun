import { unpackStep } from './native-unpack-body.mjs';
import { MAIN_INITIALIZE_ROUTINES } from './main-initialize.mjs';
import { unpackPortrait } from './native-dialog-portrait.mjs';
import { buildLayerTileStacks } from './main-scene-layers.mjs';
import { routineCaller } from './routine-call.mjs';
import {
  DP_SCENE_COUNT,
  DP_SCENE_LAYER,
  DP_SCENE_LAYER_BITS,
  DP_SCENE_RECORD,
  DP_SCENE_RECORD_BANK,
  DP_TILE_FIRST,
  DP_TILE_FREE,
  DP_TILE_SECOND,
  DP_TILE_THIRD,
  DP_WALL_NEXT,
  PALETTE_BYTES,
  PALETTE_COUNT,
  PALETTE_DIRECTION,
  PALETTE_SLOT_END,
  PALETTE_STEP,
  PALETTE_TABLE,
  SCENE_BACKDROP,
  SCENE_LAYER_BYTES,
  SCENE_LAYER_HIGH,
  SCENE_LAYER_LOW,
  SCENE_LAYER_ROW_BYTES,
  SCENE_PALETTE_COUNT,
  SCENE_PALETTE_LIST,
  SCENE_PALETTE_SLOTS,
  SCENE_RECORD,
  SHAPE_GRID,
  SHAPE_GRID_BYTES,
  SHAPE_GRID_HIDDEN_ROWS,
  SHAPE_GRID_ROW_BYTES,
  TILE_STACK_FIRST,
  TILE_STACK_FREE,
  TILE_STACK_HEAD_LAST,
  TILE_STACK_HEADS,
  TILE_STACK_LAST,
  TILE_STACK_NEXT,
  TILE_STACK_PREVIOUS,
  TILE_STACK_SECOND,
  TILE_STACK_THIRD,
  TILE_STACK_USES,
  WALL_CELL_BYTES,
  WALL_MAP,
  WALL_MAP_BYTES,
  WALL_TILES,
  WALL_WORD_CELLS,
} from './wram.mjs';
import { CYCLE_TABLE, CYCLES } from '../data/palette-cycles.mjs';
import { TILESET_ATTRIBUTES, TILESET_BLOCKS } from '../data/tilesets.mjs';
import { TILE_FLIP_BITS, TILE_NAME_MASK, TILE_PRIORITY } from '../constants/ppu.mjs';
import { WRAM_BANK_PAIR, WRAM_HIGH_BANK } from '../constants/memory-map.mjs';
import {
  BYTE_MASK,
  HIGH_BYTE_MASK,
  NIBBLE_BITS,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_ZERO, FLAG_CARRY, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
const down = (h, name = 'x', n = 2) => {
  for (let i = 0; i < n; i++) h.index(name, h.ctx[name] - 1);
};
const up = (h, name = 'y', n = 1) => {
  for (let i = 0; i < n; i++) h.index(name, h.ctx[name] + 1);
};

// Value written to mark a slot, chain or entry as empty (negative).
const NONE = WORD_MASK;
// Direct page of 81:A117 besides the shared DP_SCENE_* fields (wram.mjs): the tileset
// block and attribute pointers (banks DP13, DP16), the pointer to the object lists kept
// for 81:903E (bank DP79) and a scratch word.
const DP_BLOCKS = 0x11,
  DP_BLOCKS_BANK = 0x13,
  DP_ATTRIBUTES = 0x14,
  DP_ATTRIBUTES_BANK = 0x16,
  DP_OBJECT_LISTS = 0x77,
  DP_OBJECT_LISTS_BANK = 0x79,
  DP_SCRATCH = 0x6b;
// Shapes (81:8DE2 to 8DC0): the block value, the cells left on a diagonal, the
// rectangle's rows and its cells per row.
const DP_VALUE = 0x23,
  DP_CELLS = 0x26,
  DP_ROWS = 0x29,
  DP_WIDTH = 0x2c;
// Block placement 81:8EDF: the grid offset, the layer offset and the palette bits.
const DP_GRID_OFFSET = 0x23,
  DP_LAYER_OFFSET = 0x26,
  DP_PALETTE_BITS = 0x29;
// Wall tiles 81:940A: the cells left in a map word and the flip bits of a tile.
const DP_WALL_CELLS = 0x65,
  DP_FLIP = 0x68;
// Palette cycle lookup 81:801A: the record pointer.
const DP_CYCLE_RECORD = 0xa2;

// The tileset tables lie in bank 8D, the palette cycles in bank 8B.
const TILESET_BANK = TILESET_BLOCKS >>> WORD_BITS,
  CYCLE_BANK_PAIR = 0x8b8b,
  CYCLE_ENTRY_BYTES = 3,
  CYCLE_SLOTS_END = 4,
  // Record words after the first colour: DMA length, speed, steps; then the colours.
  CYCLE_LENGTH = 2,
  CYCLE_SPEED = 4,
  CYCLE_STEPS = 6,
  CYCLE_COLOURS = 8;
// Shape grid steps: one row down and one cell left or right.
const STEP_LEFT = SHAPE_GRID_ROW_BYTES - 2,
  STEP_RIGHT = SHAPE_GRID_ROW_BYTES + 2,
  GRID_LAST = SHAPE_GRID_BYTES - 1,
  // Grid offset bits of a shape word (bit 15 rectangle, bit 14 border or right step).
  SHAPE_OFFSET_MASK = 0x3ffe;
// 81:8D3D draws edges with the values v+1 to v+4 and adds these to the current edge value
// for the four corners: above the first cell (v+7), the two turns (v+5, v+6), the end (v+8).
const CORNER_ABOVE = 6,
  CORNER_FIRST_TURN = 3,
  CORNER_SECOND_TURN = 2,
  CORNER_END = 4;
// 81:8EDF walks the drawn grid rows and their first 32 cells; a block is 2 x 4 tile words
// (16 bytes, BLOCK_SHIFT) placed as columns of the layer rows.
const GRID_DRAWN = SHAPE_GRID + SHAPE_GRID_HIDDEN_ROWS * SHAPE_GRID_ROW_BYTES,
  GRID_DRAWN_LAST = 0xbbe,
  GRID_RIGHT_HALF = 0x40,
  GRID_CELL_MASK = 0x3f,
  GRID_ROW_MASK = 0xff80,
  BLOCK_SHIFT = 4,
  BLOCK_DESTINATIONS = [0, 1].flatMap((column) =>
    [0, 1, 2, 3].map((row) => SCENE_LAYER_LOW + row * SCENE_LAYER_ROW_BYTES + 2 * column),
  );
const TILE_STACK_HASH_MASK = BYTE_MASK;

// A117: decode the original scene record into bank 7F, then construct its
// palette, tile and layer lists in the same memory. No DMA is performed. Lifted in
// src/game/scene-load.mjs; this version serves the reference entry and the Mesen cold
// boot replay.
export function loadScene(h, e, r = SCENE_LOAD_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.phb();
  h.push(WRAM_BANK_PAIR, 2);
  h.plb();
  h.plb();
  h.dpWrite(DP_SCRATCH, ctx.a);
  h.asl();
  h.adc(h.dp(DP_SCRATCH));
  h.index('x', ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(WRAM_HIGH_BANK);
  h.dpWrite(DP_SCENE_RECORD_BANK, ctx.a);
  h.dpWrite(DP_OBJECT_LISTS_BANK, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.load(h.read(0x8bf9e5 + ctx.x));
  h.index('y', ctx.a);
  h.load(h.read(0x8bf9e3 + ctx.x));
  h.index('x', SCENE_RECORD & WORD_MASK);
  h.dpWrite(DP_SCENE_RECORD, ctx.x, 2);
  call(0x81a13b, 0x809f69, true);
  h.load(h.read(h.indirect(DP_SCENE_RECORD)));
  h.write(h.abs(SCENE_BACKDROP), ctx.a);
  h.modify(DP_SCENE_RECORD, 'inc', true);
  h.modify(DP_SCENE_RECORD, 'inc', true);
  h.load(h.read(h.indirect(DP_SCENE_RECORD)));
  h.modify(DP_SCENE_RECORD, 'inc', true);
  h.load(ctx.a & BYTE_MASK);
  h.asl();
  h.index('x', ctx.a);
  h.load(TILESET_BANK);
  h.dpWrite(DP_BLOCKS_BANK, ctx.a);
  h.dpWrite(DP_ATTRIBUTES_BANK, ctx.a);
  h.load(h.read(TILESET_BLOCKS + ctx.x));
  h.dpWrite(DP_BLOCKS, ctx.a);
  h.load(h.read(TILESET_ATTRIBUTES + ctx.x));
  h.dpWrite(DP_ATTRIBUTES, ctx.a);
  h.load(h.read(h.indirect(DP_SCENE_RECORD)));
  h.modify(DP_SCENE_RECORD, 'inc', true);
  h.load(ctx.a & BYTE_MASK);
  h.dpWrite(DP_SCENE_COUNT, ctx.a);
  for (const [pc, t, long] of [
    [0x81a16d, 0x818de2, false],
    [0x81a170, 0x818fc2, false],
    [0x81a173, 0x818cb9, true],
    [0x81a177, 0x819022, false],
    [0x81a17a, 0x818edf, false],
    [0x81a17d, 0x81902d, false],
  ])
    call(pc, t, long);
  h.load(h.dp(DP_SCENE_RECORD));
  h.dpWrite(DP_OBJECT_LISTS, ctx.a);
  h.load(h.read(h.indirect(DP_SCENE_RECORD)));
  h.modify(DP_SCENE_RECORD, 'inc', true);
  h.load(ctx.a & BYTE_MASK);
  if (!(ctx.status & FLAG_ZERO)) {
    h.dpWrite(DP_SCENE_COUNT, ctx.a);
    h.load(SCENE_LAYER_LOW);
    h.dpWrite(DP_SCENE_LAYER, ctx.a);
    h.dpWrite(DP_SCENE_LAYER_BITS, 0);
    call(0x81a196, 0x81903e);
    call(0x81a199, 0x81902d);
  }
  h.load(h.read(h.indirect(DP_SCENE_RECORD)));
  h.modify(DP_SCENE_RECORD, 'inc', true);
  h.load(ctx.a & BYTE_MASK);
  if (!(ctx.status & FLAG_ZERO)) {
    h.dpWrite(DP_SCENE_COUNT, ctx.a);
    h.load(SCENE_LAYER_HIGH);
    h.dpWrite(DP_SCENE_LAYER, ctx.a);
    h.load(TILE_PRIORITY);
    h.dpWrite(DP_SCENE_LAYER_BITS, ctx.a);
    call(0x81a1b1, 0x818ff0);
    call(0x81a1b4, 0x81903e);
  }
  call(0x81a1b7, 0x81940a);
  h.plb();
  return h.rtl();
}
// 81:801A: look palette A up in the palette cycles; a hit fills the next cycle slot
// (at most two) for scene palette slot Y.
function addPaletteCycle(h) {
  const { ctx } = h;
  h.php();
  h.phb();
  h.push(CYCLE_BANK_PAIR, 2);
  h.plb();
  h.plb();
  h.index('x', 0);
  h.sep(FLAG_MEMORY_8BIT);
  for (;;) {
    h.cpx(CYCLES * CYCLE_ENTRY_BYTES);
    if (ctx.status & FLAG_ZERO) break;
    h.cmp(h.read(h.abs(CYCLE_TABLE & WORD_MASK) + ctx.x));
    if (ctx.status & FLAG_ZERO) {
      h.rep(FLAG_MEMORY_8BIT);
      up(h, 'x');
      h.load(h.read(h.abs(CYCLE_TABLE & WORD_MASK) + ctx.x));
      h.dpWrite(DP_CYCLE_RECORD, ctx.a);
      h.load(h.read(h.abs(PALETTE_SLOT_END)));
      h.index('x', ctx.a);
      h.cpx(CYCLE_SLOTS_END);
      if (ctx.status & FLAG_ZERO) break;
      // First colour: 16 colours per palette slot.
      h.load(ctx.y);
      for (let n = 0; n < NIBBLE_BITS; n++) h.asl();
      h.index('y', h.dp(DP_CYCLE_RECORD, 2));
      h.load(ctx.a | h.read(h.abs(0) + ctx.y));
      h.write(h.abs(PALETTE_DIRECTION) + ctx.x, ctx.a);
      for (const [source, dest] of [
        [CYCLE_LENGTH, PALETTE_BYTES],
        [CYCLE_SPEED, PALETTE_STEP],
        [CYCLE_STEPS, PALETTE_COUNT],
      ]) {
        h.load(h.read(h.abs(source) + ctx.y));
        h.write(h.abs(dest) + ctx.x, ctx.a);
      }
      h.load(ctx.y);
      ctx.status &= ~FLAG_CARRY;
      h.adc(CYCLE_COLOURS);
      h.write(h.abs(PALETTE_TABLE) + ctx.x, ctx.a);
      up(h, 'x', 2);
      h.load(ctx.x);
      h.write(h.abs(PALETTE_SLOT_END), ctx.a);
      break;
    }
    up(h, 'x', CYCLE_ENTRY_BYTES);
  }
  h.plb();
  h.plp();
  return h.rtl();
}
// 81:8CE0: the scene palette slot of palette A; a new slot is listed and looked up
// in the palette cycles.
function scenePaletteSlot(h, e, r = SCENE_LOAD_ROUTINES) {
  const { ctx } = h;
  h.asl();
  h.index('x', ctx.a);
  h.load(h.read(SCENE_PALETTE_SLOTS + ctx.x));
  if (ctx.status & FLAG_NEGATIVE) {
    h.load(h.read(h.abs(SCENE_PALETTE_COUNT)));
    h.load(ctx.a + 1);
    h.write(SCENE_PALETTE_SLOTS + ctx.x, ctx.a);
    h.write(h.abs(SCENE_PALETTE_COUNT), ctx.a);
    h.asl();
    h.index('y', ctx.a);
    h.load(ctx.x);
    h.lsr();
    h.write(h.abs(SCENE_PALETTE_LIST) + ctx.y, ctx.a);
    h.index('y', h.read(h.abs(SCENE_PALETTE_COUNT), 2));
    routineCaller(h, e, r)(0x818cfd, 0x81801a, true);
    h.load(h.read(h.abs(SCENE_PALETTE_COUNT)));
  }
  return h.rts();
}
// 81:8D09: write the shape value into DP_CELLS + 1 grid cells from X, down and to the left.
function drawLeftDiagonal(h) {
  return diagonal(h, STEP_LEFT);
}
// 81:8D23: write the shape value into DP_CELLS + 1 grid cells from X, down and to the right.
function drawRightDiagonal(h) {
  return diagonal(h, STEP_RIGHT);
}
// Write the value into DP_CELLS + 1 grid cells from X along a diagonal step.
function diagonal(h, stride) {
  const { ctx } = h;
  h.load(h.dp(DP_CELLS));
  if (!(ctx.status & FLAG_NEGATIVE))
    do {
      h.cpx(GRID_LAST);
      if (!(ctx.status & FLAG_CARRY)) {
        h.load(h.dp(DP_VALUE));
        h.write(SHAPE_GRID + ctx.x, ctx.a);
      }
      h.load(ctx.x);
      ctx.status &= ~FLAG_CARRY;
      h.adc(stride);
      h.index('x', ctx.a);
      h.modify(DP_CELLS, 'dec', true);
    } while (!(ctx.status & FLAG_NEGATIVE));
  return h.rts();
}
// 81:8D3D: the border of a rectangle.
function drawRectangleBorder(h, e, r = SCENE_LOAD_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.load(h.dp(DP_VALUE));
  h.pha();
  h.load(ctx.a + 1);
  h.dpWrite(DP_VALUE, ctx.a);
  h.cpx(SHAPE_GRID_ROW_BYTES);
  if (ctx.status & FLAG_CARRY) {
    ctx.status &= ~FLAG_CARRY;
    h.adc(CORNER_ABOVE);
    h.write(SHAPE_GRID - SHAPE_GRID_ROW_BYTES + ctx.x, ctx.a);
  }
  h.phx();
  h.load(ctx.x);
  ctx.status |= FLAG_CARRY;
  h.sbc(2);
  h.index('x', ctx.a);
  h.load(h.dp(DP_WIDTH));
  h.load(ctx.a - 1);
  h.dpWrite(DP_CELLS, ctx.a);
  call(0x818d5c, 0x818d09);
  h.load(h.dp(DP_VALUE));
  h.load(ctx.a + 1);
  h.dpWrite(DP_VALUE, ctx.a);
  h.cpx(GRID_LAST);
  if (!(ctx.status & FLAG_CARRY)) {
    h.adc(CORNER_FIRST_TURN);
    h.write(SHAPE_GRID + ctx.x, ctx.a);
  }
  ctx.status &= ~FLAG_CARRY;
  h.load(ctx.x);
  h.adc(STEP_RIGHT);
  h.index('x', ctx.a);
  h.load(h.dp(DP_ROWS));
  h.load(ctx.a - 1);
  h.pha();
  h.dpWrite(DP_CELLS, ctx.a);
  call(0x818d7c, 0x818d23);
  h.modify(DP_VALUE, 'inc', true);
  h.pla();
  h.dpWrite(DP_CELLS, ctx.a);
  h.load(h.read((ctx.s + 1) & WORD_MASK, 2));
  ctx.status &= ~FLAG_CARRY;
  h.adc(2);
  h.index('x', ctx.a);
  call(0x818d8b, 0x818d23);
  h.load(h.dp(DP_VALUE));
  h.load(ctx.a + 1);
  h.dpWrite(DP_VALUE, ctx.a);
  h.cpx(GRID_LAST);
  if (!(ctx.status & FLAG_CARRY)) {
    h.adc(CORNER_SECOND_TURN);
    h.write(SHAPE_GRID + ctx.x, ctx.a);
  }
  ctx.status &= ~FLAG_CARRY;
  h.load(ctx.x);
  h.adc(STEP_LEFT);
  h.index('x', ctx.a);
  h.load(h.dp(DP_WIDTH));
  h.load(ctx.a - 1);
  h.dpWrite(DP_CELLS, ctx.a);
  call(0x818daa, 0x818d09);
  h.cpx(GRID_LAST);
  if (!(ctx.status & FLAG_CARRY)) {
    h.load(h.dp(DP_VALUE));
    h.adc(CORNER_END);
    h.write(SHAPE_GRID + ctx.x, ctx.a);
  }
  h.plx();
  h.pla();
  h.dpWrite(DP_VALUE, ctx.a);
  return h.rts();
}
// 81:8DC0: the fill of a rectangle, two diagonals per row.
function fillRectangle(h, e, r = SCENE_LOAD_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  for (;;) {
    h.load(h.dp(DP_WIDTH));
    h.dpWrite(DP_CELLS, ctx.a);
    h.phx();
    call(0x818dc5, 0x818d09);
    h.plx();
    h.modify(DP_ROWS, 'dec', true);
    if (ctx.status & FLAG_NEGATIVE) return h.rts();
    h.load(h.dp(DP_WIDTH));
    h.load(ctx.a - 1);
    h.dpWrite(DP_CELLS, ctx.a);
    h.load(ctx.x);
    ctx.status &= ~FLAG_CARRY;
    h.adc(SHAPE_GRID_ROW_BYTES);
    h.index('x', ctx.a);
    h.phx();
    call(0x818dd9, 0x818d09);
    h.plx();
    up(h, 'x', 2);
  }
}
// 81:8DE2: clear the shape grid and draw the shapes of the scene record.
function drawSceneShapes(h, e, r = SCENE_LOAD_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.index('x', SHAPE_GRID_BYTES - 2);
  h.load(0);
  do {
    h.write(SHAPE_GRID + ctx.x, ctx.a);
    down(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(h.dp(DP_SCENE_COUNT));
  if (ctx.status & FLAG_ZERO) return h.rts();
  h.index('y', 0);
  do {
    h.load(h.read(h.indirect(DP_SCENE_RECORD, ctx.y)));
    up(h, 'y', 2);
    h.dpWrite(DP_SCRATCH, ctx.a);
    h.index('x', ctx.a);
    const rectangular = Boolean(ctx.status & FLAG_NEGATIVE);
    h.load(ctx.a & SHAPE_OFFSET_MASK);
    h.index('x', ctx.a);
    h.load(h.read(h.indirect(DP_SCENE_RECORD, ctx.y)));
    up(h, 'y', rectangular ? 1 : 2);
    if (rectangular) h.load(ctx.a & BYTE_MASK);
    h.dpWrite(DP_VALUE, ctx.a);
    if (rectangular) {
      h.load(h.read(h.indirect(DP_SCENE_RECORD, ctx.y)));
      up(h, 'y', 2);
      h.dpWrite(DP_WIDTH, ctx.a);
      h.xba();
      h.load(ctx.a & BYTE_MASK);
      h.dpWrite(DP_ROWS, ctx.a);
      h.load(HIGH_BYTE_MASK);
      h.testBits(DP_WIDTH, false, true);
      h.load(h.dp(DP_SCRATCH));
      h.asl();
      if (ctx.status & FLAG_NEGATIVE) call(0x818e46, 0x818d3d);
      call(0x818e49, 0x818dc0);
    } else {
      h.xba();
      h.load(ctx.a & BYTE_MASK);
      h.dpWrite(DP_CELLS, ctx.a);
      h.load(HIGH_BYTE_MASK);
      h.testBits(DP_VALUE, false, true);
      h.load(h.dp(DP_SCRATCH));
      h.asl();
      if (ctx.status & FLAG_NEGATIVE) call(0x818e1f, 0x818d23);
      else call(0x818e1a, 0x818d09);
    }
    h.modify(DP_SCENE_COUNT, 'dec', true);
  } while (!(ctx.status & FLAG_ZERO));
  h.load(ctx.y);
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.dp(DP_SCENE_RECORD));
  h.dpWrite(DP_SCENE_RECORD, ctx.a);
  return h.rts();
}
// 8E57: intern a triple of tile words. Fresh chain/scratch reads remain visible
// even when a free slot or a link aliases another table.
function runInternTileTriple(h, e) {
  const { ctx } = h;
  ctx.status &= ~FLAG_CARRY;
  h.load(h.dp(DP_TILE_FIRST));
  h.adc(h.dp(DP_TILE_SECOND));
  h.adc(h.dp(DP_TILE_THIRD));
  unpackStep(h, e, 0x818e5e);
  h.load(ctx.a & TILE_STACK_HASH_MASK);
  h.asl();
  h.index('x', ctx.a);
  h.load(h.read(TILE_STACK_HEADS + ctx.x));
  if (!(ctx.status & FLAG_NEGATIVE)) {
    h.index('y', ctx.a);
    for (;;) {
      // An entry matches when all three words agree apart from one common flip.
      h.load(h.read(h.abs(TILE_STACK_FIRST) + ctx.y));
      h.load(ctx.a ^ h.dp(DP_TILE_FIRST));
      h.dpWrite(DP_SCRATCH, ctx.a);
      h.load(ctx.a & (~TILE_FLIP_BITS & WORD_MASK));
      let equal = Boolean(ctx.status & FLAG_ZERO);
      if (equal) {
        h.load(h.read(h.abs(TILE_STACK_SECOND) + ctx.y));
        h.load(ctx.a | h.dp(DP_TILE_SECOND));
        if (!(ctx.status & FLAG_ZERO)) {
          h.load(h.read(h.abs(TILE_STACK_SECOND) + ctx.y));
          h.load(ctx.a ^ h.dp(DP_TILE_SECOND));
          h.cmp(h.dp(DP_SCRATCH));
          equal = Boolean(ctx.status & FLAG_ZERO);
          if (equal) {
            h.load(h.read(h.abs(TILE_STACK_THIRD) + ctx.y));
            h.load(ctx.a | h.dp(DP_TILE_THIRD));
            if (!(ctx.status & FLAG_ZERO)) {
              h.load(h.read(h.abs(TILE_STACK_THIRD) + ctx.y));
              h.load(ctx.a ^ h.dp(DP_TILE_THIRD));
              h.cmp(h.dp(DP_SCRATCH));
              equal = Boolean(ctx.status & FLAG_ZERO);
            }
          }
        }
      }
      if (equal) {
        unpackStep(h, e, 0x818e96);
        h.index('x', ctx.y);
        h.modify(h.abs(TILE_STACK_USES) + ctx.x, 'inc');
        h.load(ctx.y);
        h.lsr();
        h.load(ctx.a | h.dp(DP_SCRATCH));
        return h.rts();
      }
      h.load(h.read(h.abs(TILE_STACK_NEXT) + ctx.y));
      unpackStep(h, e, 0x818ea2);
      h.index('y', ctx.a);
      if (ctx.status & FLAG_NEGATIVE) break;
    }
  }
  h.index('y', h.dp(DP_TILE_FREE, 2));
  h.load(h.read(h.abs(TILE_STACK_FREE) + ctx.y));
  down(h, 'y');
  h.dpWrite(DP_TILE_FREE, ctx.y, 2);
  h.index('y', ctx.a);
  h.load(0);
  h.write(h.abs(TILE_STACK_USES) + ctx.y, ctx.a);
  h.load(ctx.x);
  h.load(ctx.a | WORD_SIGN);
  h.write(h.abs(TILE_STACK_PREVIOUS) + ctx.y, ctx.a);
  for (const [dp, table] of [
    [DP_TILE_FIRST, TILE_STACK_FIRST],
    [DP_TILE_SECOND, TILE_STACK_SECOND],
    [DP_TILE_THIRD, TILE_STACK_THIRD],
  ]) {
    h.load(h.dp(dp));
    if (dp === DP_TILE_FIRST) unpackStep(h, e, 0x818ebe);
    h.write(h.abs(table) + ctx.y, ctx.a);
  }
  h.load(h.read(TILE_STACK_HEADS + ctx.x));
  h.write(h.abs(TILE_STACK_NEXT) + ctx.y, ctx.a);
  h.load(ctx.y);
  h.write(TILE_STACK_HEADS + ctx.x, ctx.a);
  h.index('x', h.read(h.abs(TILE_STACK_NEXT) + ctx.y, 2));
  h.write(h.abs(TILE_STACK_PREVIOUS) + ctx.x, ctx.a);
  h.lsr();
  return h.rts();
}
// 81:8FC2: free all tile stack entries (the free stack in descending order).
function resetTileStacks(h, e, r = SCENE_LOAD_ROUTINES) {
  const { ctx } = h;
  h.index('x', TILE_STACK_LAST);
  h.dpWrite(DP_TILE_FREE, ctx.x, 2);
  do {
    h.load(ctx.x);
    h.write(h.abs(TILE_STACK_FREE - 2) + ctx.x, ctx.a);
    unpackStep(h, e, 0x818fcb);
    h.load(NONE);
    h.write(h.abs(TILE_STACK_USES) + ctx.x, ctx.a);
    down(h);
  } while (!(ctx.status & FLAG_ZERO));
  h.write(h.abs(TILE_STACK_USES), ctx.a);
  return resetIntern(h, e, r, 0x818fec);
}
// 81:8FF0: the free stack in ascending order.
function resetTileStacksAscending(h, e, r = SCENE_LOAD_ROUTINES) {
  const { ctx } = h;
  h.index('x', TILE_STACK_LAST);
  h.dpWrite(DP_TILE_FREE, ctx.x, 2);
  h.load(2);
  do {
    h.write(h.abs(TILE_STACK_FREE - 2) + ctx.x, ctx.a);
    h.load(ctx.a + 1);
    h.load(ctx.a + 1);
    down(h);
  } while (!(ctx.status & FLAG_ZERO));
  h.load(NONE);
  h.write(h.abs(TILE_STACK_USES), ctx.a);
  return resetIntern(h, e, r, 0x81901e);
}
// Entry 0 ends the free stack; empty chains, then intern the empty stack (0, 0, 0).
function resetIntern(h, e, r, pc) {
  h.write(h.abs(TILE_STACK_FREE + TILE_STACK_LAST), 0);
  h.index('x', TILE_STACK_HEAD_LAST);
  if (pc === 0x81901e) h.load(NONE);
  do {
    h.write(TILE_STACK_HEADS + h.ctx.x, h.ctx.a);
    down(h);
  } while (!(h.ctx.status & FLAG_NEGATIVE));
  for (const o of [DP_TILE_FIRST, DP_TILE_SECOND, DP_TILE_THIRD]) h.dpWrite(o, 0);
  routineCaller(h, e, r)(pc, 0x818e57);
  return h.rts();
}
// 81:9022: clear both tile layers.
function clearSceneLayers(h, e) {
  h.index('x', 2 * SCENE_LAYER_BYTES - 2);
  do {
    unpackStep(h, e, 0x819025);
    h.write(h.abs(SCENE_LAYER_HIGH) + h.ctx.x, 0);
    unpackStep(h, e, 0x819028);
    down(h);
  } while (!(h.ctx.status & FLAG_NEGATIVE));
  return h.rts();
}
// 81:902D: empty wall map.
function clearWallMap(h, e) {
  h.dpWrite(DP_WALL_NEXT, 0);
  h.index('x', WALL_MAP_BYTES - 2);
  h.load(NONE);
  do {
    h.write(WALL_MAP + h.ctx.x, h.ctx.a);
    unpackStep(h, e, 0x819039);
    down(h);
  } while (!(h.ctx.status & FLAG_NEGATIVE));
  return h.rts();
}
// 81:8EDF: place the tileset block of every drawn grid cell into the first layer.
function placeGridBlocks(h, e, r = SCENE_LOAD_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.index('x', GRID_DRAWN_LAST);
  for (;;) {
    h.load(h.read(GRID_DRAWN + ctx.x));
    if (!(ctx.status & FLAG_ZERO)) {
      h.index('y', ctx.a);
      h.dpWrite(DP_GRID_OFFSET, ctx.x, 2);
      h.load(h.read(h.indirect(DP_ATTRIBUTES, ctx.y)));
      h.load(ctx.a & BYTE_MASK);
      h.phy();
      call(0x818ef4, 0x818ce0);
      // Palette slot << 10: the palette bits of a tile word.
      h.xba();
      h.asl();
      h.asl();
      h.dpWrite(DP_PALETTE_BITS, ctx.a);
      h.pla();
      for (let n = 0; n < BLOCK_SHIFT; n++) h.asl();
      h.index('y', ctx.a);
      h.load(h.dp(DP_GRID_OFFSET));
      h.load(ctx.a & GRID_CELL_MASK);
      h.asl();
      h.dpWrite(DP_SCRATCH, ctx.a);
      h.load(h.dp(DP_GRID_OFFSET));
      h.load(ctx.a & GRID_ROW_MASK);
      h.asl();
      h.asl();
      h.load(ctx.a | h.dp(DP_SCRATCH));
      h.dpWrite(DP_LAYER_OFFSET, ctx.a);
      const pcs = [0x818f1c, 0x818f30, 0x818f44, 0x818f58, 0x818f6c, 0x818f80, 0x818f94, 0x818fa8];
      for (let n = 0; n < BLOCK_DESTINATIONS.length; n++) {
        if (n) up(h, 'y', 2);
        h.load(h.read(h.indirect(DP_BLOCKS, ctx.y)));
        if (!(ctx.status & FLAG_ZERO)) {
          h.dpWrite(DP_TILE_FIRST, ctx.a);
          h.phy();
          call(pcs[n], 0x818e57);
          h.ply();
          h.load(ctx.a | h.dp(DP_PALETTE_BITS));
          h.index('x', h.dp(DP_LAYER_OFFSET, 2));
          h.write(h.abs(BLOCK_DESTINATIONS[n]) + ctx.x, ctx.a);
        }
      }
      h.index('x', h.dp(DP_GRID_OFFSET, 2));
    }
    down(h);
    if (ctx.status & FLAG_NEGATIVE) return h.rts();
    h.load(ctx.x);
    h.load(ctx.a & (~GRID_RIGHT_HALF & WORD_MASK));
    h.index('x', ctx.a);
  }
}
// 81:940A: the wall tiles of every wall map cell from the second layer: the tile itself
// and, as new single tiles, the second and third word of its stack.
function buildWallTiles(h, e, r = SCENE_LOAD_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.dpWrite(DP_TILE_THIRD, 0);
  h.index('x', WALL_MAP_BYTES - 2);
  h.index('y', SCENE_LAYER_BYTES - 2);
  for (;;) {
    h.load(h.read(WALL_MAP + ctx.x));
    if (ctx.status & FLAG_NEGATIVE) {
      h.load(ctx.y);
      ctx.status |= FLAG_CARRY;
      h.sbc(2 * WALL_WORD_CELLS);
      h.index('y', ctx.a);
      down(h);
    } else {
      h.phx();
      ctx.status &= ~FLAG_CARRY;
      h.adc((WALL_WORD_CELLS - 1) * WALL_CELL_BYTES);
      h.index('x', ctx.a);
      h.load(WALL_WORD_CELLS);
      h.dpWrite(DP_WALL_CELLS, ctx.a);
      for (;;) {
        h.load(h.read(h.abs(SCENE_LAYER_HIGH) + ctx.y));
        if (!(ctx.status & FLAG_ZERO)) {
          h.load(ctx.a & (TILE_FLIP_BITS | TILE_NAME_MASK));
          h.write(WALL_TILES + ctx.x, ctx.a);
          h.load(ctx.a & TILE_FLIP_BITS);
          h.dpWrite(DP_FLIP, ctx.a);
          h.load(h.read(h.abs(SCENE_LAYER_HIGH) + ctx.y));
          h.phy();
          unpackStep(h, e, 0x819438);
          h.load(ctx.a & TILE_NAME_MASK);
          h.asl();
          h.index('y', ctx.a);
          h.load(h.read(h.abs(TILE_STACK_SECOND) + ctx.y));
          if (!(ctx.status & FLAG_ZERO)) {
            h.load(ctx.a ^ h.dp(DP_FLIP));
            h.dpWrite(DP_TILE_FIRST, ctx.a);
            h.load(h.read(h.abs(TILE_STACK_THIRD) + ctx.y));
            if (!(ctx.status & FLAG_ZERO)) h.load(ctx.a ^ h.dp(DP_FLIP));
            h.dpWrite(DP_TILE_SECOND, ctx.a);
            h.phx();
            call(0x819450, 0x818e57);
            h.plx();
            h.write(WALL_TILES + 2 + ctx.x, ctx.a);
            h.load(h.dp(DP_TILE_SECOND));
            if (!(ctx.status & FLAG_ZERO)) {
              h.dpWrite(DP_TILE_FIRST, ctx.a);
              h.dpWrite(DP_TILE_SECOND, 0);
              h.phx();
              call(0x819461, 0x818e57);
              h.plx();
              h.write(WALL_TILES + 2 * 2 + ctx.x, ctx.a);
            }
          }
          h.ply();
        } else h.write(WALL_TILES + ctx.x, ctx.a);
        down(h, 'y');
        h.modify(DP_WALL_CELLS, 'dec', true);
        if (ctx.status & FLAG_ZERO) break;
        h.load(ctx.x);
        ctx.status |= FLAG_CARRY;
        h.sbc(WALL_CELL_BYTES);
        h.index('x', ctx.a);
      }
      h.plx();
      down(h);
    }
    if (ctx.status & FLAG_NEGATIVE) return h.rts();
  }
}
// 80:9F69: long entry (JSL) of the unpacker 80:9F6D.
function unpackLong(h, e, r = SCENE_LOAD_ROUTINES) {
  unpackStep(h, e, 0x809f69);
  routineCaller(h, e, r)(0x809f69, 0x809f6d);
  unpackStep(h, e, 0x809f6c);
  return h.rtl();
}
export const SCENE_LOAD_ROUTINES = new Map([
  ...MAIN_INITIALIZE_ROUTINES,
  [0x81a117, loadScene],
  [0x81801a, addPaletteCycle],
  [0x818ce0, scenePaletteSlot],
  [0x818d09, drawLeftDiagonal],
  [0x818d23, drawRightDiagonal],
  [0x818d3d, drawRectangleBorder],
  [0x818dc0, fillRectangle],
  [0x818de2, drawSceneShapes],
  [0x818e57, runInternTileTriple],
  [0x818edf, placeGridBlocks],
  [0x818fc2, resetTileStacks],
  [0x818ff0, resetTileStacksAscending],
  [0x819022, clearSceneLayers],
  [0x81902d, clearWallMap],
  [0x81903e, buildLayerTileStacks],
  [0x81940a, buildWallTiles],
  [0x809f69, unpackLong],
  [0x809f6d, unpackPortrait],
]);
