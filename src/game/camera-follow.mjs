// Follow the player with a dead zone, quarter-distance speed and bounded steps.
// Room bounds clamp the projected target before its height is applied.
import { cameraState } from '../state/camera.mjs';
import { clampToCameraBox } from './camera-box.mjs';
import { WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { lowObjectWord, objectWordIn } from '../state/objects.mjs';

const CAMERA_CENTRE_X = 0x400,
  PLAYER_ROW_BASE = 0x910,
  CAMERA_HEIGHT_BASE = 0x100,
  DEAD_ZONE_MASK = 0xfff8,
  SPEED_SHIFT = 2,
  SPEED_MAX = 0x20,
  STEP_MASK = 0xfffc;

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
  const state = cameraState(wram),
    slot = state.player;
  if (slot & WORD_SIGN) return slot;
  // The original's data bank 80 reaches the object tables only below 2000.
  state.projectedY = PLAYER_ROW_BASE - lowObjectWord(wram, 'diagonal', slot);
  state.projectedX =
    CAMERA_CENTRE_X + objectWordIn(wram, 'y', slot) - objectWordIn(wram, 'x', slot);
  clampToCameraBox(mem, wram);
  const aimY = state.projectedY + CAMERA_HEIGHT_BASE - objectWordIn(wram, 'height', slot);
  state.speedY = cameraSpeed((aimY - state.y) & WORD_MASK);
  state.speedX = cameraSpeed((state.projectedX - state.x) & WORD_MASK);
  return slot;
}
