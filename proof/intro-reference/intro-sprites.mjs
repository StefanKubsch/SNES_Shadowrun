// Register-level reference of the intro sprite grid 81:E83A and the far object start
// 81:E971 (lifted in src/intro/intro-objects.mjs), moved from src/task/main-intro-nmi.mjs.
import { INTRO_FAR_ANIMATION } from './intro-setup.mjs';

import {
  DP_INTRO_X,
  INTRO_FAR_ANIMATIONS,
  INTRO_FAR_X,
  INTRO_FAR_Y,
  INTRO_OBJECT_LAST,
  OAM_SHADOW,
  OAM_SHADOW_HIGH,
} from '../../src/task/wram.mjs';
import { WORD_MASK } from '../../src/constants/bits.mjs';
import {
  OAM_ENTRY_BYTES,
  OAM_NAME_BYTE,
  SCREEN_WIDTH,
  TILE_SIZE,
} from '../../src/constants/ppu.mjs';
import {
  FLAG_CARRY,
  FLAG_MEMORY_8BIT,
  FLAG_ZERO,
  FLAG_NEGATIVE,
} from '../../src/constants/cpu-flags.mjs';

// 81:E83A draws sprite A at X/Y as a grid of 8x8 objects from the tables of bank 81 (by
// sprite: columns, rows, first character, left and top offset); characters advance by one
// per column and by a sheet row of 16 per row. DP_SPRITE_TILE holds the OAM name and
// attribute word (the attributes from the caller), DP_OAM_OFFSET the next OAM entry; an X
// of 256 or more sets the object's high X bit (81:E8E1: the bit in its high table byte).
const SPRITE_COLUMNS = 0x81e9f3,
  SPRITE_ROWS = 0x81ea55,
  SPRITE_CHARACTERS = 0x81e991,
  SPRITE_LEFT = 0x81eab7,
  SPRITE_TOP = 0x81eb19,
  SPRITE_ATTRIBUTES_MASK = 0xfe00, // all but the character name bits 0-8
  SHEET_ROW_CHARACTERS = 0x10,
  HIGH_TABLE_ENTRY_MASK = 3, // four objects per high table byte
  DP_SPRITE_SCRATCH = 0x16,
  DP_SPRITE_X = 0x20,
  DP_SPRITE_X_HIGH = 0x21,
  DP_SPRITE_LEFT = 0x22,
  DP_SPRITE_TILE = 0x24,
  DP_SPRITE_Y = 0x26,
  DP_SPRITE_COLUMNS = 0x28,
  DP_SPRITE_ROWS = 0x2a,
  DP_OAM_OFFSET = 0x2c;

// 81:E83A: draw the intro sprite grid (original), including BYTE clipping/high-X mask updates.
// Tables and scratch words are reread at their original points; no OAM limit
// or animation bound is inferred. Only the existing access budget stops bad data.
export function drawIntroSpriteGrid(h) {
  const { ctx } = h;
  h.phb();
  h.pushByte(ctx.programBank);
  h.plb();
  h.dpWrite(DP_SPRITE_LEFT, ctx.x, 2);
  h.dpWrite(DP_SPRITE_Y, ctx.y, 2);
  h.asl();
  h.index('x', ctx.a);
  h.load(h.read(h.abs(SPRITE_COLUMNS & WORD_MASK) + ctx.x));
  h.dpWrite(DP_SPRITE_COLUMNS, ctx.a);
  h.asl();
  h.asl();
  h.asl();
  h.dpWrite(DP_SPRITE_SCRATCH, ctx.a);
  ctx.status &= ~FLAG_CARRY;
  h.adc(SCREEN_WIDTH);
  h.dpWrite(DP_SPRITE_X, ctx.a);
  h.load(h.read(h.abs(SPRITE_ROWS & WORD_MASK) + ctx.x));
  h.dpWrite(DP_SPRITE_ROWS, ctx.a);
  h.load(h.dp(DP_SPRITE_TILE));
  h.load(ctx.a & SPRITE_ATTRIBUTES_MASK);
  h.load(ctx.a | h.read(h.abs(SPRITE_CHARACTERS & WORD_MASK) + ctx.x));
  h.dpWrite(DP_SPRITE_TILE, ctx.a);
  h.load(h.dp(DP_SPRITE_LEFT));
  ctx.status |= FLAG_CARRY;
  h.sbc(h.read(h.abs(SPRITE_LEFT & WORD_MASK) + ctx.x));
  h.dpWrite(DP_SPRITE_LEFT, ctx.a);
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.dp(DP_SPRITE_SCRATCH));
  h.cmp(h.dp(DP_SPRITE_X));
  if (ctx.status & FLAG_CARRY) {
    h.plb();
    return h.rtl();
  }
  h.load(h.dp(DP_SPRITE_Y));
  ctx.status |= FLAG_CARRY;
  h.sbc(h.read(h.abs(SPRITE_TOP & WORD_MASK) + ctx.x));
  h.dpWrite(DP_SPRITE_Y, ctx.a);
  h.index('x', h.dp(DP_OAM_OFFSET, 2));
  do {
    h.load(h.dp(DP_SPRITE_LEFT));
    h.dpWrite(DP_SPRITE_X, ctx.a);
    h.index('y', h.dp(DP_SPRITE_COLUMNS, 2));
    h.load(h.dp(DP_SPRITE_TILE));
    h.dpWrite(DP_SPRITE_SCRATCH, ctx.a);
    do {
      h.load(h.dp(DP_SPRITE_SCRATCH));
      h.write(h.abs(OAM_SHADOW + OAM_NAME_BYTE) + ctx.x, ctx.a);
      h.load(ctx.a + 1);
      h.dpWrite(DP_SPRITE_SCRATCH, ctx.a);
      h.sep(FLAG_MEMORY_8BIT);
      h.load(h.dp(DP_SPRITE_X_HIGH));
      if (!(ctx.status & FLAG_ZERO)) {
        h.phx();
        h.phy();
        h.load(0);
        h.xba();
        h.load(ctx.x);
        h.lsr();
        h.lsr();
        h.pha();
        h.lsr();
        h.lsr();
        h.index('x', ctx.a);
        h.pla();
        h.load(ctx.a & HIGH_TABLE_ENTRY_MASK);
        h.index('y', ctx.a);
        h.load(h.read(h.abs(OAM_SHADOW_HIGH) + ctx.x));
        h.load(ctx.a | h.read(h.abs(0x81e8e1 & WORD_MASK) + ctx.y));
        h.write(h.abs(OAM_SHADOW_HIGH) + ctx.x, ctx.a);
        h.ply();
        h.plx();
      }
      h.load(h.dp(DP_SPRITE_Y));
      h.xba();
      h.load(h.dp(DP_SPRITE_X));
      h.rep(FLAG_MEMORY_8BIT);
      h.write(h.abs(OAM_SHADOW) + ctx.x, ctx.a);
      for (let n = 0; n < OAM_ENTRY_BYTES; n++) h.index('x', ctx.x + 1);
      h.load(h.dp(DP_SPRITE_X));
      ctx.status &= ~FLAG_CARRY;
      h.adc(TILE_SIZE);
      h.dpWrite(DP_SPRITE_X, ctx.a);
      h.index('y', ctx.y - 1);
    } while (!(ctx.status & FLAG_ZERO));
    h.load(h.dp(DP_SPRITE_Y));
    ctx.status &= ~FLAG_CARRY;
    h.adc(TILE_SIZE);
    h.dpWrite(DP_SPRITE_Y, ctx.a);
    h.load(h.dp(DP_SPRITE_TILE));
    ctx.status &= ~FLAG_CARRY;
    h.adc(SHEET_ROW_CHARACTERS);
    h.dpWrite(DP_SPRITE_TILE, ctx.a);
    h.modify(DP_SPRITE_ROWS, 'dec', true);
  } while (!(ctx.status & FLAG_ZERO));
  h.dpWrite(DP_OAM_OFFSET, ctx.x, 2);
  h.plb();
  return h.rtl();
}
// 81:E971: start a far intro object at X in the first free far slot.
export function startFarIntroObject(h) {
  const { ctx } = h;
  h.dpWrite(DP_INTRO_X, ctx.x, 2);
  h.index('x', INTRO_OBJECT_LAST);
  for (;;) {
    h.load(h.read(h.abs(INTRO_FAR_ANIMATIONS) + ctx.x));
    if (ctx.status & FLAG_NEGATIVE) break;
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
    if (ctx.status & FLAG_NEGATIVE) return h.rtl();
  }
  h.load(INTRO_FAR_ANIMATION);
  h.write(h.abs(INTRO_FAR_ANIMATIONS) + ctx.x, ctx.a);
  h.load(ctx.y);
  h.write(h.abs(INTRO_FAR_Y) + ctx.x, ctx.a);
  h.load(h.dp(DP_INTRO_X));
  h.write(h.abs(INTRO_FAR_X) + ctx.x, ctx.a);
  return h.rtl();
}
