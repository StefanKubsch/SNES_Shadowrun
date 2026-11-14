// The hit shake of the player figure (lifted from 80:DE94; register-level reference
// in proof/game-reference/main-upkeep.mjs).
//
// A hit (80:881C) sets the frames 7E:1D65 the player figure shakes. While they run
// down, each pass of the main loop moves the figure by 4 in x and -4 in y, or the
// other way round, as the count before the pass is even or odd; on the last frame
// the figure stops. Without a player figure (bit 15 of its slot) nothing happens.
import { taskStop } from '../task/plan.mjs';
import {
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  PLAYER_HIT_FRAMES,
  PLAYER_OBJECT,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const SPEED = 4,
  LOW_WRAM_END = 0x2000;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Shake the hit player figure (80:DE94). Returns the player's slot, the X the
// original leaves.
export function shakeHitPlayer(wram) {
  const slot = word(wram, PLAYER_OBJECT);
  if (slot & WORD_SIGN) return slot;
  const frames = word(wram, PLAYER_HIT_FRAMES);
  if (!frames) return slot;
  setWord(wram, PLAYER_HIT_FRAMES, frames - 1);
  // The original's data bank 80 reaches the object tables only below 2000.
  if (OBJECT_VELOCITY_Y + slot + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { slot });
  const x = frames === 1 ? 0 : frames & 1 ? -SPEED : SPEED;
  setWord(wram, OBJECT_VELOCITY_X + slot, x & WORD_MASK);
  setWord(wram, OBJECT_VELOCITY_Y + slot, -x & WORD_MASK);
  return slot;
}
