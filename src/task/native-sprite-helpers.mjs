import { OAM_HIGH_TABLE, WRAM } from './wram.mjs';
import { FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

// Direct page and indexed field access shared by the scene sprite modules.
export const dpLoad = (h, o) => h.load(h.dp(o)),
  dpStore = (h, o) => h.dpWrite(o, h.ctx.a);
export const field = (h, offset, index) => h.read(h.abs(offset) + h.ctx[index]);

// Direct page of the OAM entry 80:B20A shared with its occlusion grids (80:B130 to B755):
// the picture rows and the rows and columns left, the screen position of the 8x8 cell
// being checked, the object depth, the screen Y of the first cell of a column (saved by a
// grid) and of the top cell, a scratch word and the OAM buffer offset.
export const DP_ROWS = 0x23,
  DP_ROWS_LEFT = 0x26,
  DP_CELL_X = 0x2f,
  DP_CELL_Y = 0x32,
  DP_DEPTH = 0x35,
  DP_COLUMNS_LEFT = 0x56,
  DP_FIRST_CELL_Y = 0x5f,
  DP_TOP_CELL_Y = 0x62,
  DP_SCRATCH = 0x6b,
  DP_OAM_OFFSET = 0x84;
// Visible area of a sprite position: rows below 00D8, columns below 00F8; 8x8 cells
// within 16x16 picture parts.
export const VISIBLE_HEIGHT = 0xd8,
  VISIBLE_WIDTH = 0xf8,
  CELL_SIZE = 8,
  PART_SIZE = 0x10;

// High bit table: combine a byte from 80:table+(X/4-1) with 7E3F08+X/16 (AND or ORA), BYTE width.
export function highBits(h, table, or) {
  const { ctx } = h;
  h.rep(FLAG_MEMORY_8BIT);
  h.load(ctx.x);
  h.lsr();
  h.lsr();
  h.load(ctx.a - 1);
  h.index('x', ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(h.abs(table) + ctx.x));
  h.dpWrite(DP_SCRATCH, ctx.a);
  h.load(ctx.x);
  h.lsr();
  h.lsr();
  h.index('x', ctx.a);
  dpLoad(h, DP_SCRATCH);
  h.load(
    or
      ? ctx.a | h.read(WRAM + OAM_HIGH_TABLE + ctx.x)
      : ctx.a & h.read(WRAM + OAM_HIGH_TABLE + ctx.x),
  );
  h.write(WRAM + OAM_HIGH_TABLE + ctx.x, ctx.a);
}
