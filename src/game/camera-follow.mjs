// The camera follow of the main loop (lifted from 81:8C2E; register-level reference
// in proof/game-reference/main-camera.mjs).
//
// Each pass the camera aims at the player figure: its projected position (x from
// 0400 plus the figure's y minus its x, y from 0910 minus its diagonal) goes into the
// direct page words 0E and 11, the room's camera box clamps it (81:8A05, lifted in
// camera-box.mjs), and the camera speeds follow the distance of the aim from the
// camera (y raised by 0100 minus the figure's height): differences below 8 count
// as none, the rest moves a quarter of the way, at most 20 either way, in steps of
// 4. The tile buffers 81:8A91 (camera-scroll.mjs) then move the camera. Without a
// player figure (bit 15 of its slot) the camera stays.
import { taskStop } from '../task/plan.mjs';
import { clampToCameraBox } from './camera-box.mjs';
import {
  CAMERA_SPEED_X,
  CAMERA_SPEED_Y,
  CAMERA_X,
  CAMERA_Y,
  OBJECT_DIAGONAL,
  OBJECT_HEIGHT,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_OBJECT,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const DP_CAMERA_X = 0x0e,
  DP_CAMERA_Y = 0x11;
const CAMERA_CENTRE_X = 0x400,
  PLAYER_ROW_BASE = 0x910,
  CAMERA_HEIGHT_BASE = 0x100,
  DEAD_ZONE_MASK = 0xfff8,
  SPEED_SHIFT = 2,
  SPEED_MAX = 0x20,
  STEP_MASK = 0xfffc,
  LOW_WRAM_END = 0x2000;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// The camera speed for a distance (a word): none below 8 either way, a quarter of
// it (rounded towards minus infinity) clamped to +-20, in steps of 4.
function cameraSpeed(distance) {
  // Sign-extended, shifted arithmetically by two.
  const quarter = ((distance & DEAD_ZONE_MASK) << WORD_BITS) >> (WORD_BITS + SPEED_SHIFT);
  return Math.min(Math.max(quarter, -SPEED_MAX), SPEED_MAX) & STEP_MASK & WORD_MASK;
}

// Aim the camera at the player figure (81:8C2E). Returns the player's slot, the Y
// the original leaves.
export function followPlayerWithCamera(mem, wram) {
  const slot = word(wram, PLAYER_OBJECT);
  if (slot & WORD_SIGN) return slot;
  // The original's data bank 80 reaches the object tables only below 2000.
  if (OBJECT_DIAGONAL + slot + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { slot });
  setWord(wram, DP_CAMERA_Y, PLAYER_ROW_BASE - word(wram, OBJECT_DIAGONAL + slot));
  setWord(
    wram,
    DP_CAMERA_X,
    CAMERA_CENTRE_X + word(wram, OBJECT_Y + slot) - word(wram, OBJECT_X + slot),
  );
  clampToCameraBox(mem, wram);
  const aimY = word(wram, DP_CAMERA_Y) + CAMERA_HEIGHT_BASE - word(wram, OBJECT_HEIGHT + slot);
  setWord(wram, CAMERA_SPEED_Y, cameraSpeed((aimY - word(wram, CAMERA_Y)) & WORD_MASK));
  setWord(
    wram,
    CAMERA_SPEED_X,
    cameraSpeed((word(wram, DP_CAMERA_X) - word(wram, CAMERA_X)) & WORD_MASK),
  );
  return slot;
}
