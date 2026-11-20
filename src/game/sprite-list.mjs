// The sprite list of a pass (lifted from 80:B8DE with the OAM high table fill 81:A7FC
// and the NMI job count 81:A954; register-level reference in
// proof/replay/native-scene-sprites.mjs).
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
// are lifted, and so are the OAM entries (src/game/object-sprites.mjs). The sort, the
// OAM entries, the player's palette slot, the palette reset, the fill and the job count
// run without their frames, whose return words lie only in free stack bytes. The list
// position the original pushes over each OAM entry call lies there too and is kept in a
// local (game state only, user decision 2026-11-17). Registers (user decision
// 2026-11-17): game state only; no A, X, Y or flags are left (the main loop and the
// talk end read none of them), and the object and picture pass to the OAM entry as
// parameters.
import { taskStop } from '../system/task-stop.mjs';
import { sortDrawListInPlace } from './depth-sort.mjs';
import { paletteSlotInPlace } from './palette-slots.mjs';
import { clearPaletteSlots } from './game-screen.mjs';
import { enterObjectSpritesInPlace } from './object-sprites.mjs';
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
} from '../data/wram.mjs';
import {
  OAM_ENTRY_BYTES,
  OAM_HIGH_ALL_LARGE,
  OAM_HIGH_TABLE_BYTES,
  OAM_Y_BYTE,
  OBJECT_COUNT,
} from '../constants/ppu.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// Direct page word of the OAM buffer offset of the OAM entry 80:B20A, shared with its
// occlusion grids (register-level reference in proof/script/native-sprite-helpers.mjs).
export const DP_OAM_OFFSET = 0x84;
// The unrolled stores at 80:B933, three bytes each (STA abs); the jump target is
// B933 + 3 * (OAM offset / 4), computed as offset / 2 + offset / 4 with ADC.
const HIDE_SEQUENCE = 0xb933,
  STORE_BYTES = 3,
  HIDDEN_Y = 0xf0,
  // The direct page word that holds the jump target.
  DP_JUMP = 0x0e,
  LOW_WRAM_END = 0x2000;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// A word of a table in bank 80 below 2000 (the caller's data bank 80 reaches WRAM only there).
const lowField = (wram, base, index) => {
  if (base + index + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { base, index });
  return word(wram, base + index);
};

// Build the sprite list (80:B8DE) on the access h of the caller (data bank 80), for
// lifted callers without the JSR frame (its own JSR and JSL calls keep theirs).
export function buildSpritesInPlace(h) {
  const { wram } = h.a.mem;
  sortDrawListInPlace(h);
  // The palette slots reset 81:A840, without its JSL frame.
  clearPaletteSlots(wram);
  // The OAM high table fill 81:A7FC, without its JSL frame (the return word lies only
  // in free stack bytes).
  for (let at = 0; at < OAM_HIGH_TABLE_BYTES; at += 2)
    setWord(wram, OAM_HIGH_TABLE + at, OAM_HIGH_ALL_LARGE);
  const player = word(wram, PLAYER_OBJECT);
  if (!(player & WORD_SIGN)) {
    const palette = lowField(wram, OBJECT_PALETTE, player);
    paletteSlotInPlace(wram, palette);
  }
  // OAM entry 0 stays reserved (the glove sprite of the game NMI).
  setWord(wram, DP_OAM_OFFSET, OAM_ENTRY_BYTES);
  let index = word(wram, DRAW_LIST_INDEX);
  while (!(index & WORD_SIGN)) {
    const slot = lowField(wram, DRAW_LIST, index),
      flags = lowField(wram, OBJECT_FLAGS, slot);
    if (!(flags & OBJECT_NOT_DRAWN)) {
      // The picture word is read in bank 7E (a long read).
      const picture = word(wram, OBJECT_PICTURE + slot);
      if (picture) enterObjectSpritesInPlace(h, slot, picture);
    }
    index = (index - 2) & WORD_MASK;
  }
  // The jump target: offset / 2 (kept in DP 0E), plus offset / 4 and the carry of the
  // second shift, plus B933 and the carry of that addition.
  const offset = word(wram, DP_OAM_OFFSET),
    half = offset >>> 1,
    first = half + (half >>> 1) + (half & 1),
    sum = (first & WORD_MASK) + HIDE_SEQUENCE + (first > WORD_MASK ? 1 : 0),
    target = sum & WORD_MASK;
  setWord(wram, DP_JUMP, target);
  const firstHidden = (target - HIDE_SEQUENCE) / STORE_BYTES;
  if (!Number.isInteger(firstHidden) || firstHidden < 0 || firstHidden > OBJECT_COUNT)
    taskStop('task_sprite_clear_target_open', { target });
  // The original sets the data bank 7E through the stack (PHB, PEA, PLB, PLB) and pulls
  // the old one again; those bytes lie only in free stack bytes, so the lifted stores
  // leave the data bank and the stack alone.
  for (let n = firstHidden; n < OBJECT_COUNT; n++)
    wram[OAM_BUFFER + OAM_Y_BYTE + OAM_ENTRY_BYTES * n] = HIDDEN_Y;
  // The job count 81:A954, without its JSL frame (the return word lies only in free
  // stack bytes).
  setWord(wram, NMI_JOB_LISTS, (lowField(wram, NMI_JOB_LISTS, 0) + 1) & WORD_MASK);
}
// The sprite list as called with JSR; returns with its RTS.
export function buildSprites(h) {
  buildSpritesInPlace(h);
  return h.rts();
}
