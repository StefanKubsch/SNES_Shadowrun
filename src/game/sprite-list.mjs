// The sprite list of a pass (lifted from 80:B8DE with the OAM high table fill 81:A7FC
// and the NMI job count 81:A954; register-level reference in
// src/task/native-scene-sprites.mjs).
//
// Each pass the draw list is sorted by screen depth (80:AFFC), the palette slots are
// reset (81:A840), every OAM high table bit pair is set to large sprites (AAAA), and
// the player figure's palette gets its slot (80:AB0A). Then the OAM buffer 7E:3D08 is
// filled from entry 1 on (entry 0 stays the glove's sprite): every object of the draw
// list that is drawn (flag 0080 clear) and has a picture (7E:3F80) enters its sprites
// (80:B20A, which moves the OAM offset in the direct page word 84). The rest of the OAM
// entries move below the screen (Y = F0; the original jumps into its unrolled stores at
// 80:B933), and the NMI gets one more job list (7E:1562).
//
// The sort (src/game/depth-sort.mjs) and the palette slots (src/game/palette-slots.mjs)
// are lifted, and so are the OAM entries (src/game/object-sprites.mjs), which run through
// their frames. The frames of the fill and the job count, and the data bank 7E
// the original sets through the stack for the hidden sprites, are reproduced on the
// stack. A, X, Y and the flags are left as the original leaves them.
import { taskStop } from '../task/plan.mjs';
import { sortDrawList } from './depth-sort.mjs';
import { paletteSlot, resetPaletteSlots } from './palette-slots.mjs';
import { enterObjectSprites } from './object-sprites.mjs';
import { DP_OAM_OFFSET } from '../task/native-sprite-helpers.mjs';
import {
  DRAW_LIST,
  DRAW_LIST_INDEX,
  NMI_JOB_LISTS,
  OAM_BUFFER,
  OAM_HIGH_TABLE,
  OBJECT_FLAGS,
  OBJECT_NOT_DRAWN,
  OBJECT_PALETTE,
  OBJECT_PICTURE,
  PLAYER_OBJECT,
} from '../task/wram.mjs';
import {
  OAM_ENTRY_BYTES,
  OAM_HIGH_ALL_LARGE,
  OAM_HIGH_TABLE_BYTES,
  OAM_Y_BYTE,
  OBJECT_COUNT,
} from '../constants/ppu.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';
import { WRAM_BANK_PAIR } from '../constants/memory-map.mjs';

// The unrolled stores at 80:B933, three bytes each (STA abs); the jump target is
// B933 + 3 * (OAM offset / 4), computed as offset / 2 + offset / 4 with ADC.
const HIDE_SEQUENCE = 0xb933,
  STORE_BYTES = 3,
  HIDDEN_Y = 0xf0,
  // The direct page word that holds the jump target.
  DP_JUMP = 0x0e,
  LOW_WRAM_END = 0x2000;
// Original call sites.
const SORT_CALL = 0xb8de,
  SORT_TARGET = 0x80affc,
  PALETTES_CALL = 0xb8e1,
  PALETTES_TARGET = 0x81a840,
  HIGH_CALL = 0xb8e5,
  HIGH_TARGET = 0x81a7fc,
  PLAYER_PALETTE_CALL = 0xb8f1,
  PALETTE_TARGET = 0x80ab0a,
  OAM_CALL = 0xb911,
  OAM_TARGET = 0x80b20a,
  JOBS_CALL = 0xbab6,
  JOBS_TARGET = 0x81a954;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const signAndZero = (ctx, value) => {
  flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  flag(ctx, FLAG_ZERO, value === 0);
};
// A word of a table in bank 80 below 2000 (the caller's data bank 80 reaches WRAM only there).
const lowField = (wram, base, index) => {
  if (base + index + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { base, index });
  return word(wram, base + index);
};

// Build the sprite list (80:B8DE) on the access h of the caller (data bank 80).
export function buildSprites(h) {
  const { ctx } = h,
    { wram } = h.a.mem;
  h.call(SORT_CALL, SORT_TARGET, () => sortDrawList(h));
  h.call(PALETTES_CALL, PALETTES_TARGET, () => resetPaletteSlots(h), true);
  h.call(
    HIGH_CALL,
    HIGH_TARGET,
    () => {
      for (let at = 0; at < OAM_HIGH_TABLE_BYTES; at += 2)
        setWord(wram, OAM_HIGH_TABLE + at, OAM_HIGH_ALL_LARGE);
      ctx.a = OAM_HIGH_ALL_LARGE;
      signAndZero(ctx, ctx.a);
      return h.rtl();
    },
    true,
  );
  const player = word(wram, PLAYER_OBJECT);
  ctx.y = player;
  signAndZero(ctx, player);
  if (!(player & WORD_SIGN)) {
    ctx.a = lowField(wram, OBJECT_PALETTE, player);
    signAndZero(ctx, ctx.a);
    h.call(PLAYER_PALETTE_CALL, PALETTE_TARGET, () => paletteSlot(h));
  }
  // OAM entry 0 stays reserved (the glove sprite of the game NMI).
  setWord(wram, DP_OAM_OFFSET, OAM_ENTRY_BYTES);
  let index = word(wram, DRAW_LIST_INDEX);
  while (!(index & WORD_SIGN)) {
    ctx.y = index;
    const slot = lowField(wram, DRAW_LIST, index);
    ctx.x = slot;
    const flags = lowField(wram, OBJECT_FLAGS, slot);
    ctx.a = flags;
    signAndZero(ctx, flags);
    // BIT #0080 sets the zero flag only.
    flag(ctx, FLAG_ZERO, !(flags & OBJECT_NOT_DRAWN));
    if (!(flags & OBJECT_NOT_DRAWN)) {
      // The picture word is read in bank 7E (a long read).
      const picture = word(wram, OBJECT_PICTURE + slot);
      ctx.a = picture;
      signAndZero(ctx, picture);
      if (picture) {
        h.a.pushWord(index);
        ctx.y = slot;
        h.call(OAM_CALL, OAM_TARGET, () => enterObjectSprites(h));
        ctx.y = h.a.pullWord();
      }
    }
    index = (ctx.y - 2) & WORD_MASK;
  }
  ctx.y = index;
  // The jump target: offset / 2 (kept in DP 0E), plus offset / 4 and the carry of the
  // second shift, plus B933 and the carry of that addition.
  const offset = word(wram, DP_OAM_OFFSET),
    half = offset >>> 1,
    first = half + (half >>> 1) + (half & 1),
    sum = (first & WORD_MASK) + HIDE_SEQUENCE + (first > WORD_MASK ? 1 : 0),
    target = sum & WORD_MASK;
  setWord(wram, DP_JUMP, target);
  flag(ctx, FLAG_CARRY, sum > WORD_MASK);
  flag(
    ctx,
    FLAG_OVERFLOW,
    (~((first & WORD_MASK) ^ HIDE_SEQUENCE) & ((first & WORD_MASK) ^ target) & WORD_SIGN) !== 0,
  );
  const firstHidden = (target - HIDE_SEQUENCE) / STORE_BYTES;
  if (!Number.isInteger(firstHidden) || firstHidden < 0 || firstHidden > OBJECT_COUNT)
    taskStop('task_sprite_clear_target_open', { target });
  // With the data bank 7E set through the stack and an 8-bit accumulator, as the original.
  h.sep(FLAG_MEMORY_8BIT);
  h.phb();
  h.a.pushWord(WRAM_BANK_PAIR);
  h.plb();
  h.plb();
  ctx.a = (target & ~BYTE_MASK) | HIDDEN_Y;
  for (let n = firstHidden; n < OBJECT_COUNT; n++)
    wram[OAM_BUFFER + OAM_Y_BYTE + OAM_ENTRY_BYTES * n] = HIDDEN_Y;
  h.plb();
  h.rep(FLAG_MEMORY_8BIT);
  h.call(
    JOBS_CALL,
    JOBS_TARGET,
    () => {
      const jobs = (lowField(wram, NMI_JOB_LISTS, 0) + 1) & WORD_MASK;
      setWord(wram, NMI_JOB_LISTS, jobs);
      signAndZero(ctx, jobs);
      return h.rtl();
    },
    true,
  );
  return h.rts();
}
