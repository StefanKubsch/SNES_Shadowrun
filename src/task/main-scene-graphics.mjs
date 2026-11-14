import { unpackStep } from './native-unpack-body.mjs';
import { routineCaller } from './routine-call.mjs';
import { SCENE_COLLISION_ROUTINES } from './main-scene-collision.mjs';
import { unpackFixedStream } from './native-unpack.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';
import { WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
import { VMAINC, VMADDL, VMDATAL } from '../constants/hardware-registers.mjs';
import { PLANE_PAIR_BYTES, TILE_H_FLIP, VMAINC_INCREMENT_AFTER_HIGH } from '../constants/ppu.mjs';
import {
  TILE_CACHE_DATA,
  TILE_CACHE_KEYS,
  TILE_CACHE_LAST,
  TILE_CACHE_NEXT,
  TILE_COMPOSE,
  TILE_QUARTER_OFFSET,
  TILE_STACK_FIRST,
  TILE_STACK_LAST,
  TILE_STACK_SECOND,
  TILE_STACK_THIRD,
  TILE_STACK_USES,
  WRAM,
} from './wram.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
  FLAG_CARRY,
} from '../constants/cpu-flags.mjs';
// Cache of original 128-byte tile streams, reflected/composited into DP0CDE.
// PPU writes are requests at the original PCs; no VRAM/DMA effect is inferred.

// Direct page of the tile cache (81:A1BC, A1E1, A243): the stream key looked up, the most
// recently used entry, the entry before the one found (negative: it is the head) and the
// byte offset of the entry moved to the front.
const DP_CACHE_KEY = 0x7a,
  DP_CACHE_HEAD = 0x7c,
  DP_CACHE_PREVIOUS = 0x7e,
  DP_CACHE_OFFSET = 0x80;
// Direct page word of 81:9AE6: the tile stack entry being drawn.
const DP_STACK_ENTRY = 0x26;
// A free cache key or the end of the list.
const NO_KEY = 0xffff;
// Tile id (src/data/tiles.mjs): bits 2-13 name the 128-byte stream, bits 0-1 its tile,
// bits 10-13 the bank from 82; the stream pointers lie in 8D:A41F.
const STREAM_KEY_MASK = 0x3ffc,
  QUARTER_MASK = 3,
  STREAM_BANK_MASK = 0x3c00,
  TILE_BANK = 0x82,
  TILE_TABLE = 0x8da41f;
// Bit reversal table 81:A017 (bit_reverse) for horizontally flipped tiles.
const BIT_REVERSE = 0x81a017;
// A 4-bit tile of 32 bytes is stored plane by plane, eight bytes (rows) per plane.
const PLANE_BYTES = 8,
  TILE_PLANES = 4,
  TILE_BYTES = 32,
  TILE_WORDS = TILE_BYTES / 2;
// 81:9AE6 writes the scene tiles from VRAM word address 1000, one tile per stack entry.
const SCENE_TILES_VRAM = 0x1000,
  STACK_END = TILE_STACK_LAST + 2;
// Instruction bytes between the VRAM stores of 81:9AE6 (STA long; LDA abs + STA long).
const EMPTY_STORE_BYTES = 4,
  COPY_STORE_BYTES = 7;
// Store positions at which the observed interrupts resume (unpackStep): the fourth store of
// an empty tile, bytes 27 and 29 of a horizontally flipped tile and the seventh tile copy.
const EMPTY_INTERRUPT_STORE = 3,
  FLIP_INTERRUPT_BYTE = 27,
  FLIP_INTERRUPT_BYTE_2 = 29,
  COPY_INTERRUPT_STORE = 6;

// 81:A1BC: empty the tile cache and link its entries into one free list.
function clearTileCache(h) {
  const { ctx } = h;
  h.php();
  h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  h.push(WRAM_BANK_PAIR, 2);
  h.plb();
  h.plb();
  h.dpWrite(DP_CACHE_HEAD, 0);
  h.index('x', TILE_CACHE_LAST);
  do {
    h.load(NO_KEY);
    h.write(h.abs(TILE_CACHE_KEYS) + ctx.x, ctx.a);
    h.load(ctx.x);
    h.load(ctx.a + 1);
    h.load(ctx.a + 1);
    h.write(h.abs(TILE_CACHE_NEXT) + ctx.x, ctx.a);
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(NO_KEY);
  h.write(h.abs(TILE_CACHE_KEYS - 2), ctx.a);
  h.plp();
  return h.rts();
}
// 81:A243: move the entry found to the front of the cache list; DP80 gets its byte offset.
function moveCacheEntryToFront(h) {
  const { ctx } = h;
  h.index('y', h.dp(DP_CACHE_PREVIOUS, 2));
  if (!(ctx.status & FLAG_NEGATIVE)) {
    h.index('x', h.read(h.abs(TILE_CACHE_NEXT) + ctx.y, 2));
    h.load(h.read(h.abs(TILE_CACHE_NEXT) + ctx.x));
    h.write(h.abs(TILE_CACHE_NEXT) + ctx.y, ctx.a);
    h.load(h.dp(DP_CACHE_HEAD));
    h.write(h.abs(TILE_CACHE_NEXT) + ctx.x, ctx.a);
    h.dpWrite(DP_CACHE_HEAD, ctx.x, 2);
  }
  h.load(h.dp(DP_CACHE_HEAD));
  h.xba();
  h.lsr();
  h.lsr();
  h.dpWrite(DP_CACHE_OFFSET, ctx.a);
  return h.rts();
}
// 81:A1E1: find the 128-byte stream of tile id A in the cache, or unpack it into the
// least recently used entry; Y returns the offset of the tile in TILE_CACHE_DATA.
function findCachedTile(h, e, r = SCENE_GRAPHICS_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  h.phx();
  h.load(ctx.a & STREAM_KEY_MASK);
  h.dpWrite(DP_CACHE_KEY, ctx.a);
  h.load(ctx.x);
  h.load(ctx.a & QUARTER_MASK);
  h.xba();
  h.lsr();
  h.lsr();
  h.lsr();
  h.write(h.abs(TILE_QUARTER_OFFSET), ctx.a);
  h.load(NO_KEY);
  h.dpWrite(DP_CACHE_PREVIOUS, ctx.a);
  h.index('y', h.dp(DP_CACHE_HEAD, 2));
  for (;;) {
    h.load(h.read(h.abs(TILE_CACHE_KEYS) + ctx.y));
    unpackStep(h, e, 0x81a1fc);
    h.cmp(h.dp(DP_CACHE_KEY));
    if (ctx.status & FLAG_ZERO) {
      call(0x81a239, 0x81a243);
      ctx.status &= ~FLAG_CARRY;
      h.adc(h.read(h.abs(TILE_QUARTER_OFFSET)));
      h.index('y', ctx.a);
      h.plx();
      return h.rts();
    }
    h.load(h.read(h.abs(TILE_CACHE_NEXT) + ctx.y));
    if (ctx.status & FLAG_NEGATIVE) break;
    h.dpWrite(DP_CACHE_PREVIOUS, ctx.y, 2);
    h.index('y', ctx.a);
  }
  call(0x81a20a, 0x81a243);
  ctx.status &= ~FLAG_CARRY;
  h.adc(TILE_CACHE_DATA);
  h.pha();
  h.index('y', h.dp(DP_CACHE_HEAD, 2));
  h.load(h.dp(DP_CACHE_KEY));
  h.write(h.abs(TILE_CACHE_KEYS) + ctx.y, ctx.a);
  h.load(ctx.a & STREAM_BANK_MASK);
  h.lsr();
  unpackStep(h, e, 0x81a21d);
  h.lsr();
  h.xba();
  h.adc(TILE_BANK);
  h.index('y', ctx.a);
  h.load(h.dp(DP_CACHE_KEY));
  h.lsr();
  h.index('x', ctx.a);
  h.load(h.read(TILE_TABLE + ctx.x));
  h.plx();
  call(0x81a22c, 0x809e7e, true);
  h.load(h.read(h.abs(TILE_QUARTER_OFFSET)));
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.dp(DP_CACHE_OFFSET));
  h.index('y', ctx.a);
  h.plx();
  return h.rts();
}
const reverseByte = (h) => {
  h.index('x', h.ctx.a);
  h.load(h.read(BIT_REVERSE + h.ctx.x));
};
// 81:9490: overlay tile id A on the composed tile, masking the planes under its pixels.
function overlayStackTile(h, e, r = SCENE_GRAPHICS_ROUTINES) {
  const { ctx } = h;
  h.index('x', ctx.a);
  routineCaller(h, e, r)(0x819491, 0x81a1e1);
  h.load(ctx.x);
  const vertical = Boolean(ctx.status & FLAG_NEGATIVE);
  h.load(ctx.a & TILE_H_FLIP);
  const horizontal = !(ctx.status & FLAG_ZERO);
  if (horizontal) {
    h.load(0);
    h.sep(FLAG_MEMORY_8BIT);
  }
  const size = horizontal ? 1 : 2;
  for (let plane = 0; plane < PLANE_BYTES; plane += size) {
    h.load(h.read(h.abs(TILE_CACHE_DATA + plane) + ctx.y));
    for (let layer = 1; layer < TILE_PLANES; layer++)
      h.load(ctx.a | h.read(h.abs(TILE_CACHE_DATA + plane + layer * PLANE_BYTES) + ctx.y));
    if (horizontal) reverseByte(h);
    else if (vertical) h.xba();
    const dest = vertical ? PLANE_BYTES - size - plane : plane;
    for (let layer = 0; layer < TILE_PLANES; layer++)
      h.testBits(h.abs(TILE_COMPOSE + dest + layer * PLANE_BYTES), false);
    for (let layer = 0; layer < TILE_PLANES; layer++) {
      h.load(h.read(h.abs(TILE_CACHE_DATA + plane + layer * PLANE_BYTES) + ctx.y));
      if (horizontal) reverseByte(h);
      else if (vertical) h.xba();
      h.testBits(h.abs(TILE_COMPOSE + dest + layer * PLANE_BYTES), true);
    }
  }
  if (horizontal) h.rep(FLAG_MEMORY_8BIT);
  return h.rts();
}
// 81:9AE6: compose each tile stack entry and write it to VRAM from word address 1000
// (lifted in src/game/scene-tiles.mjs; this version serves the reference entry and the
// Mesen cold boot replay).
function uploadSceneTiles(h, e, r = SCENE_GRAPHICS_ROUTINES) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  // These stores are long bank-00 stores even though the live DBR is 7E.
  const port = (offset, value, width, pc) => {
    const bank = ctx.bank;
    ctx.bank = 0;
    try {
      h.portWrite(offset, value, width, pc);
    } finally {
      ctx.bank = bank;
    }
  };
  h.phb();
  call(0x819ae7, 0x81a1bc);
  h.push(WRAM_BANK_PAIR, 2);
  h.plb();
  h.plb();
  h.load(VMAINC_INCREMENT_AFTER_HIGH);
  port(VMAINC, ctx.a, 2, 0x819af2);
  h.load(SCENE_TILES_VRAM);
  port(VMADDL, ctx.a, 2, 0x819af9);
  h.index('x', 0);
  h.dpWrite(DP_STACK_ENTRY, ctx.x, 2);
  for (;;) {
    h.load(h.read(WRAM + TILE_STACK_USES + ctx.x));
    if (ctx.status & FLAG_NEGATIVE) {
      h.load(0);
      for (let i = 0; i < TILE_WORDS; i++) {
        if (i === EMPTY_INTERRUPT_STORE) unpackStep(h, e, 0x819b17);
        port(VMDATAL, ctx.a, 2, 0x819b0b + i * EMPTY_STORE_BYTES);
      }
    } else {
      h.load(h.read(WRAM + TILE_STACK_FIRST + ctx.x));
      h.index('x', ctx.a);
      call(0x819b53, 0x81a1e1);
      h.load(ctx.x);
      const vertical = Boolean(ctx.status & FLAG_NEGATIVE);
      h.load(ctx.a & TILE_H_FLIP);
      const horizontal = !(ctx.status & FLAG_ZERO);
      if (horizontal) {
        h.load(0);
        h.sep(FLAG_MEMORY_8BIT);
      }
      const size = horizontal ? 1 : 2;
      for (let at = 0; at < TILE_BYTES; at += size) {
        h.load(h.read(h.abs(TILE_CACHE_DATA + at) + ctx.y));
        if (horizontal) reverseByte(h);
        else if (vertical) h.xba();
        if (horizontal && !vertical && at === FLIP_INTERRUPT_BYTE) unpackStep(h, e, 0x819cfa);
        if (horizontal && !vertical && at === FLIP_INTERRUPT_BYTE_2) unpackStep(h, e, 0x819d10);
        h.write(
          h.abs(
            TILE_COMPOSE +
              (at & ~(PLANE_BYTES - 1)) +
              (vertical ? PLANE_BYTES - size - (at & (PLANE_BYTES - 1)) : at & (PLANE_BYTES - 1)),
          ),
          ctx.a,
        );
      }
      if (horizontal) h.rep(FLAG_MEMORY_8BIT);
      h.index('x', h.dp(DP_STACK_ENTRY, 2));
      h.load(h.read(WRAM + TILE_STACK_SECOND + ctx.x));
      if (!(ctx.status & FLAG_ZERO)) {
        call(0x819f15, 0x819490);
        h.index('x', h.dp(DP_STACK_ENTRY, 2));
        h.load(h.read(WRAM + TILE_STACK_THIRD + ctx.x));
        if (!(ctx.status & FLAG_ZERO)) call(0x819f20, 0x819490);
      }
      h.sep(FLAG_MEMORY_8BIT);
      for (let block = 0; block < 2; block++)
        for (let byte = 0; byte < PLANE_BYTES; byte++)
          for (let plane = 0; plane < 2; plane++) {
            const n = block * PLANE_PAIR_BYTES + byte * 2 + plane;
            if (n === COPY_INTERRUPT_STORE) unpackStep(h, e, 0x819f4f);
            h.load(
              h.read(h.abs(TILE_COMPOSE + block * PLANE_PAIR_BYTES + byte + plane * PLANE_BYTES)),
            );
            port(VMDATAL + plane, ctx.a & BYTE_MASK, 1, 0x819f28 + n * COPY_STORE_BYTES);
          }
      h.rep(FLAG_MEMORY_8BIT);
    }
    h.index('x', h.dp(DP_STACK_ENTRY, 2));
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.cpx(STACK_END);
    if (ctx.status & FLAG_ZERO) break;
    h.dpWrite(DP_STACK_ENTRY, ctx.x, 2);
  }
  h.plb();
  return h.rtl();
}
export const SCENE_GRAPHICS_ROUTINES = new Map([
  ...SCENE_COLLISION_ROUTINES,
  [0x81a1bc, clearTileCache],
  [0x81a243, moveCacheEntryToFront],
  [0x81a1e1, findCachedTile],
  [0x819490, overlayStackTile],
  [0x819ae6, uploadSceneTiles],
  [0x809e7e, (h, e) => unpackFixedStream(h.a, false, e)],
]);
