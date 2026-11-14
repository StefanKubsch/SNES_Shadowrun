import { clc } from './status-flags.mjs';
import {
  CELL_SIZE,
  DP_CELL_X,
  DP_CELL_Y,
  DP_COLUMNS_LEFT,
  DP_DEPTH,
  DP_FIRST_CELL_Y,
  DP_OAM_OFFSET,
  DP_ROWS,
  DP_ROWS_LEFT,
  DP_TOP_CELL_Y,
  PART_SIZE,
  VISIBLE_HEIGHT,
  VISIBLE_WIDTH,
  dpLoad,
  dpStore,
  field,
  highBits,
} from './native-sprite-helpers.mjs';
import {
  CELL_FRONT_WALL,
  CELL_OPEN,
  ENTERED_OBJECT_FLAGS,
  OAM_BUFFER,
  OBJECT_HIDDEN,
  OCCLUSION_COLUMN_BYTES,
  OCCLUSION_MASKS,
  OCCLUSION_TILES,
  WALL_HEIGHTS,
  WALL_TILES,
  WRAM,
} from './wram.mjs';
import {
  OAM_ENTRY_BYTES,
  OAM_LOW_TABLE_BYTES,
  OAM_NAME_BYTE,
  OAM_NAME_HIGH,
  OAM_PRIORITY_2,
  OAM_PRIORITY_3,
} from '../constants/ppu.mjs';
import { HEX_RADIX, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_ZERO, FLAG_CARRY, FLAG_NEGATIVE, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

// Occlusion tiles of the scene sprites (native-scene-sprites.mjs): walls in front of an
// object become 8x8 sprites from the map cells around it.

// Value returned by mapCell for a cell with a wall tile from the second or third height.
const NONE = WORD_MASK;
// 80:B18A: high table AND masks for a wall piece, indexed like the X bit table 80:B85E.
const SMALL_SPRITE_BITS = 0xb18a;
// A 16x16 part covers two 8x8 cells down (4 bytes) and two cell columns across.
const PART_CELL_BYTES = 2 * 2,
  PART_COLUMN_BYTES = 2 * OCCLUSION_COLUMN_BYTES;

// 80:B130: enter occlusion tile A (Z from the caller's load) as an 8x8 sprite at DP2F/DP32, clear cell 1A72+Y.
function runOcclusionSprite(h) {
  const { ctx } = h,
    done = () => h.rts();
  if (ctx.status & FLAG_ZERO) return done();
  h.index('x', h.dp(DP_OAM_OFFSET));
  h.cpx(OAM_LOW_TABLE_BYTES);
  if (ctx.status & FLAG_CARRY) return done();
  h.load(ctx.a | OAM_NAME_HIGH);
  h.write(WRAM + OAM_BUFFER + OAM_NAME_BYTE + ctx.x, ctx.a);
  h.load(0);
  h.write(h.abs(OCCLUSION_TILES) + ctx.y, ctx.a);
  dpLoad(h, DP_CELL_Y);
  if (ctx.status & FLAG_NEGATIVE) return done();
  h.cmp(VISIBLE_HEIGHT);
  if (ctx.status & FLAG_CARRY) return done();
  dpLoad(h, DP_CELL_X);
  if (ctx.status & FLAG_NEGATIVE) return done();
  h.cmp(VISIBLE_WIDTH);
  if (ctx.status & FLAG_CARRY) return done();
  h.sep(FLAG_MEMORY_8BIT);
  h.write(WRAM + OAM_BUFFER + ctx.x, ctx.a);
  h.index('x', ctx.x + 1);
  dpLoad(h, DP_CELL_Y);
  h.load(ctx.a - 1);
  h.write(WRAM + OAM_BUFFER + ctx.x, ctx.a);
  for (let n = 0; n < OAM_ENTRY_BYTES - 1; n++) h.index('x', ctx.x + 1);
  h.dpWrite(DP_OAM_OFFSET, ctx.x, 2);
  highBits(h, SMALL_SPRITE_BITS, false);
  h.rep(FLAG_MEMORY_8BIT);
  return done();
}
// Occlusion grid: cells (check words 1872+Y, draw 1A72+Y) in four shapes; steps as in the original.
const GRIDS = {
  A: {
    checks: [0, 2, 4, 0x20, 0x22, 0x24, 0x40, 0x42, 0x44],
    steps: [
      'c0',
      'tsb',
      'first',
      'c2',
      'down',
      'c4',
      'push',
      'c20',
      'down',
      'c22',
      'down',
      'c24',
      'top',
      'right',
      'c40',
      'down',
      'c42',
      'down',
      'c44',
      'top',
    ],
  },
  B: {
    checks: [0, 2, 0x20, 0x22, 0x40, 0x42],
    steps: [
      'c0',
      'tsb',
      'first',
      'c2',
      'push',
      'c20',
      'down',
      'c22',
      'top',
      'right',
      'c40',
      'down',
      'c42',
      'top',
    ],
  },
  C: {
    checks: [0, 2, 4, 0x20, 0x22, 0x24],
    steps: [
      'c0',
      'tsb',
      'first',
      'c2',
      'down',
      'c4',
      'push',
      'c20',
      'down',
      'c22',
      'down',
      'c24',
      'top',
    ],
  },
  D: {
    checks: [0, 2, 0x20, 0x22],
    steps: ['c0', 'tsb', 'first', 'c2', 'pushOnly', 'c22', 'top', 'c20'],
  },
};
const GRID_PCS = {
  A: [0xb486, 0xb49c, 0xb4aa, 0xb4bd, 0xb4cb, 0xb4d9, 0xb4eb, 0xb4f9, 0xb507],
  B: [0xb56c, 0xb582, 0xb595, 0xb5a3, 0xb5b5, 0xb5c3],
  C: [0xb62f, 0xb645, 0xb653, 0xb666, 0xb674, 0xb682],
  D: [0xb6e1, 0xb6f7, 0xb706, 0xb710],
};
export function occlusion(h, kind) {
  const { ctx } = h,
    g = GRIDS[kind],
    pcs = GRID_PCS[kind];
  for (;;) {
    h.load(field(h, OCCLUSION_MASKS + g.checks[0], 'y'));
    for (const o of g.checks.slice(1)) h.load(ctx.a | field(h, OCCLUSION_MASKS + o, 'y'));
    if (!(ctx.status & FLAG_ZERO)) {
      h.phx();
      let call = 0;
      for (const step of g.steps) {
        if (step[0] === 'c') {
          h.load(field(h, OCCLUSION_TILES + parseInt(step.slice(1), HEX_RADIX), 'y'));
          h.call(pcs[call++], 0x80b130, () => runOcclusionSprite(h));
        } else if (step === 'tsb') {
          h.load(OBJECT_HIDDEN);
          h.testBits(h.abs(ENTERED_OBJECT_FLAGS), true);
        } else if (step === 'first') {
          clc(h);
          dpLoad(h, DP_CELL_Y);
          dpStore(h, DP_FIRST_CELL_Y);
          h.adc(CELL_SIZE);
          dpStore(h, DP_CELL_Y);
        } else if (step === 'down') {
          clc(h);
          dpLoad(h, DP_CELL_Y);
          h.adc(CELL_SIZE);
          dpStore(h, DP_CELL_Y);
        } else if (step === 'push' || step === 'pushOnly') {
          dpLoad(h, DP_CELL_X);
          h.pha();
          clc(h);
          h.adc(CELL_SIZE);
          dpStore(h, DP_CELL_X);
          if (step === 'push') {
            dpLoad(h, DP_FIRST_CELL_Y);
            dpStore(h, DP_CELL_Y);
          }
        } else if (step === 'top') {
          dpLoad(h, DP_FIRST_CELL_Y);
          dpStore(h, DP_CELL_Y);
        } else if (step === 'right') {
          clc(h);
          dpLoad(h, DP_CELL_X);
          h.adc(CELL_SIZE);
          dpStore(h, DP_CELL_X);
        }
      }
      h.pla();
      dpStore(h, DP_CELL_X);
      h.plx();
      h.load(OAM_PRIORITY_3);
    } else h.load(OAM_PRIORITY_2);
    h.write(h.abs(OCCLUSION_MASKS) + ctx.x, ctx.a);
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    if (h.modify(DP_ROWS_LEFT, 'dec', true) !== 0) {
      clc(h);
      dpLoad(h, DP_CELL_Y);
      h.adc(PART_SIZE);
      dpStore(h, DP_CELL_Y);
      for (let n = 0; n < PART_CELL_BYTES; n++) h.index('y', ctx.y + 1);
      continue;
    }
    if (h.modify(DP_COLUMNS_LEFT, 'dec', true) === 0) return;
    h.load(ctx.y & (~(PART_COLUMN_BYTES - 1) & WORD_MASK));
    clc(h);
    h.adc(PART_COLUMN_BYTES);
    h.index('y', ctx.a);
    dpLoad(h, DP_CELL_X);
    h.adc(PART_SIZE);
    dpStore(h, DP_CELL_X);
    dpLoad(h, DP_TOP_CELL_Y);
    dpStore(h, DP_CELL_Y);
    dpLoad(h, DP_ROWS);
    dpStore(h, DP_ROWS_LEFT);
  }
}
// Map cell at X (bank 7F): heights 0C00/0C02/0C04 against the object depth DP35 decide whether the wall
// lies in front (tile from 69C0/69C2/69C4 to 1A72+Y, mask to 1872+Y).
export function mapCell(h) {
  const { ctx } = h;
  h.load(h.read(WALL_HEIGHTS + ctx.x));
  if (ctx.status & FLAG_NEGATIVE) {
    h.load(0);
    h.write(h.abs(OCCLUSION_TILES) + ctx.y, ctx.a);
    return;
  }
  h.cmp(h.dp(DP_DEPTH));
  if (!(ctx.status & FLAG_CARRY)) {
    h.load(h.read(WALL_TILES + ctx.x));
    h.write(h.abs(OCCLUSION_TILES) + ctx.y, ctx.a);
    h.load(CELL_FRONT_WALL);
    h.testBits(h.abs(ENTERED_OBJECT_FLAGS), true);
    h.load(0);
    return;
  }
  for (const [height, tile] of [
    [WALL_HEIGHTS + 2, WALL_TILES + 2],
    [WALL_HEIGHTS + 2 * 2, WALL_TILES + 2 * 2],
  ]) {
    h.load(h.read(height + ctx.x));
    if (ctx.status & FLAG_NEGATIVE) break;
    h.cmp(h.dp(DP_DEPTH));
    if (!(ctx.status & FLAG_CARRY)) {
      h.load(h.read(tile + ctx.x));
      h.write(h.abs(OCCLUSION_TILES) + ctx.y, ctx.a);
      h.load(NONE);
      return;
    }
    if (height === WALL_HEIGHTS + 2 * 2) break;
  }
  h.load(CELL_OPEN);
  h.testBits(h.abs(ENTERED_OBJECT_FLAGS), true);
  h.load(0);
  h.write(h.abs(OCCLUSION_TILES) + ctx.y, ctx.a);
  h.load(ctx.a - 1);
}
