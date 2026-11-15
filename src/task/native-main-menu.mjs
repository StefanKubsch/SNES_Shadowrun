import {
  DP_SAVE_SLOT,
  DP_CHECKSUM_FIRST_SUM,
  DP_CHECKSUM_SECOND_SUM,
  DP_CHECKSUM_WORD,
  DP_CHECKSUM_HIGH,
} from './wram.mjs';

import {
  SLOT_OFFSETS_FOUR,
  saveSlotCount,
  FOUR_SAVE_SLOTS,
  ORIGINAL_SAVE_SLOTS,
  SLOT_CHECKED_BYTES,
  SECOND_SUM_START,
  CHECKSUM_KEY,
} from '../game/save-slots.mjs';

import { BYTE_MASK, WORD_BITS } from '../constants/bits.mjs';

import { FLAG_CARRY, FLAG_ZERO, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

import { SRAM_FIRST_BANK } from '../constants/memory-map.mjs';

export const KARMA_WINDOWS = Object.freeze({
  left: 3,
  columns: 11,
  balanceTop: 5,
  balanceRows: 3,
  categoryTop: 8,
  categoryRows: 6,
  categoryVisibleRows: 4,
  detailLeft: 14,
  detailColumns: 16,
  headerTop: 5,
  headerRows: 3,
  listTop: 8,
  listRows: 9,
  listVisibleRows: 7,
});

const SAVE_SRAM_BASE = SRAM_FIRST_BANK << WORD_BITS,
  EXTENDED_SLOT_TABLE_INDEX = ORIGINAL_SAVE_SLOTS * 2;

// 81:B174 (BYTE-A): end-around carry: carry adds 1, FF becomes 0.
function runEndAroundCarry(h) {
  const { ctx } = h;
  if (ctx.status & FLAG_CARRY) h.load(ctx.a + 1);
  h.cmp(BYTE_MASK);
  if (ctx.status & FLAG_ZERO) h.load(ctx.a + 1);
  return h.rts();
}

// 81:B11A: X = slot offset 81:B124+2*DP0E. Slots 3/4 of the four-slot option
// use their own offsets behind the original 8 KiB (src/game/save-slots.mjs).
export function getSaveSlotOffset(h) {
  const { ctx } = h;
  h.load(h.dp(DP_SAVE_SLOT));
  h.asl();
  h.index('x', ctx.a);
  if (ctx.x >= EXTENDED_SLOT_TABLE_INDEX && saveSlotCount(h.a) === FOUR_SAVE_SLOTS)
    h.load(SLOT_OFFSETS_FOUR[ctx.x >> 1]);
  else h.load(h.read(0x81b124 + ctx.x));
  h.index('x', ctx.a);
  return h.rts();
}

// 81:B12C: checksum of the slot (70:X+2, 0F26 bytes) with two running sums from 0 and AD, A = word 14 EOR ABA5.
function runSaveChecksum(h) {
  const { ctx } = h,
    add = (pc, offset) => {
      ctx.status &= ~FLAG_CARRY;
      h.adc(h.dp(offset));
      h.call(pc, 0x81b174, () => runEndAroundCarry(h));
    };
  h.call(0x81b12c, 0x81b11a, () => getSaveSlotOffset(h));
  h.phx();
  h.index('x', ctx.x + 1);
  h.index('x', ctx.x + 1);
  h.index('y', SLOT_CHECKED_BYTES);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(SECOND_SUM_START);
  h.dpWrite(DP_CHECKSUM_SECOND_SUM, ctx.a);
  h.dpWrite(DP_CHECKSUM_FIRST_SUM, 0);
  do {
    h.load(h.read(SAVE_SRAM_BASE + ctx.x));
    h.index('x', ctx.x + 1);
    add(0x81b145, DP_CHECKSUM_FIRST_SUM);
    h.dpWrite(DP_CHECKSUM_FIRST_SUM, ctx.a);
    add(0x81b14d, DP_CHECKSUM_SECOND_SUM);
    h.dpWrite(DP_CHECKSUM_SECOND_SUM, ctx.a);
    h.index('y', ctx.y - 1);
  } while (!(ctx.status & FLAG_ZERO));
  h.load(h.dp(DP_CHECKSUM_FIRST_SUM));
  add(0x81b15a, DP_CHECKSUM_SECOND_SUM);
  h.load(ctx.a ^ BYTE_MASK);
  h.dpWrite(DP_CHECKSUM_SECOND_SUM, ctx.a);
  add(0x81b164, DP_CHECKSUM_FIRST_SUM);
  h.load(ctx.a ^ BYTE_MASK);
  h.dpWrite(DP_CHECKSUM_HIGH, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.plx();
  h.load(h.dp(DP_CHECKSUM_WORD));
  h.load(ctx.a ^ CHECKSUM_KEY);
  return h.rts();
}

// 81:B1AB: checksum comparison for a selected slot; no validity policy is
// inferred. The caller consumes the original CMP flags and SRAM offset in X.
export function compareSaveChecksum(h) {
  h.dpWrite(DP_SAVE_SLOT, h.ctx.a);
  h.call(0x81b1ad, 0x81b12c, () => runSaveChecksum(h));
  h.cmp(h.read(SAVE_SRAM_BASE + h.ctx.x));
  return h.rtl();
}

// The three karma lists: header text, value pointers (bank 7E via DP10), names, limits, entry count and where
// the loop starts again (F054 rebuilds the header, F0F3 and F1B5 only the rows). Values below their limit are
// listed (1DAB names, 1EB1 values, 1E2F indices); a changed row count resets the cursor DP1A. The menu A6B8 in
// window 1F52 buys with F006 (F0F3: the value 7E3BFB also raises 7E3C00 by 0A and raises the state count of the
// leader over CECB with FF... 0A) and shows the karma again (EF82).
export const KARMA_LISTS = Object.freeze({
  0x80f054: {
    text: 0x70bb,
    pointers: 0xefca,
    names: 0xefd2,
    limits: 0xefda,
    end: 8,
    header: true,
    pcs: { text: 0x80f059, request: 0x80f0b3, menu: 0x80f0d3, buy: 0x80f0e9, karma: 0x80f0ec },
  },
  0x80f0f3: {
    text: 0x7490,
    pointers: 0xefb2,
    names: 0xefba,
    limits: 0xefc2,
    end: 8,
    header: false,
    body: true,
    pcs: {
      text: 0x80f0f8,
      request: 0x80f152,
      menu: 0x80f172,
      buy: 0x80f188,
      karma: 0x80f1ae,
      refill: 0x80f1ab,
    },
  },
  0x80f1b5: {
    text: 0x709d,
    pointers: 0xefe2,
    names: 0xefee,
    limits: 0xeffa,
    end: 0x0c,
    header: false,
    pcs: { text: 0x80f1ba, request: 0x80f214, menu: 0x80f234, buy: 0x80f24a, karma: 0x80f24d },
  },
});
