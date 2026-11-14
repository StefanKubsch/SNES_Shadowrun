// The camera box clamp (lifted from 81:8A05; register-level version in
// src/task/main-loop-camera.mjs, which the main loop camera 81:8C2E still calls).
//
// A room may give a camera box (src/data/rooms.mjs): the minimum and maximum of two
// map axes of the projected camera position. The position is turned into the axes,
// each axis is clamped and, when one was clamped, the position is formed back from
// them. The clamp reads the long pointer at CAMERA_BOX (the box minus 1; a zero
// high word: no box) and the position in the direct page words 0E (x) and 11 (y).
//
// The direct page words 3E to 4A are left as the original leaves them: the box
// pointer, both axes, the doubled y distance and the offset of the last limit that
// clamped.
import { CAMERA_BOX, CAMERA_BOX_HIGH } from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

const LONG_MASK = 0xffffff,
  NO_BOX = WORD_MASK;
// The projected camera position and the clamp's direct page words.
const DP_CAMERA_X = 0x0e,
  DP_CAMERA_Y = 0x11,
  DP_BOX = 0x3e,
  DP_AXIS_A = 0x41,
  DP_AXIS_B = 0x44,
  DP_DOUBLE_Y = 0x47,
  DP_CLAMPED = 0x4a;
// The axes: a = (2 * (0940 - y) - (x - 0400)) / 8, b = (2 * (0940 - y) + (x - 0400)) / 8.
const CAMERA_CENTRE_X = 0x400,
  CAMERA_CENTRE_Y = 0x940,
  AXIS_SHIFT = 3,
  X_SHIFT = 2;
// Offsets of the limits behind the box pointer: minimum and maximum of axis a, then
// of axis b.
const AXIS_A_LIMITS = 1,
  AXIS_B_LIMITS = 5,
  MAXIMUM = 2;
const BOX_POINTER_BYTES = 3;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);

// Clamp the projected camera position (direct page 0E and 11) to the room's camera
// box (81:8A05).
export function clampToCameraBox(mem, wram) {
  if (!word(wram, CAMERA_BOX_HIGH)) return;
  for (let n = 0; n < BOX_POINTER_BYTES; n++) wram[DP_BOX + n] = wram[CAMERA_BOX + n];
  const box = (wram[DP_BOX + 2] << WORD_BITS) | word(wram, DP_BOX),
    shiftedX = (word(wram, DP_CAMERA_X) - CAMERA_CENTRE_X) & WORD_MASK,
    doubleY = ((CAMERA_CENTRE_Y - word(wram, DP_CAMERA_Y)) << 1) & WORD_MASK;
  let a = ((doubleY - shiftedX) & WORD_MASK) >>> AXIS_SHIFT,
    b = ((doubleY + shiftedX) & WORD_MASK) >>> AXIS_SHIFT,
    clamped = 0;
  setWord(wram, DP_DOUBLE_Y, doubleY);
  setWord(wram, DP_AXIS_A, a);
  setWord(wram, DP_AXIS_B, b);
  setWord(wram, DP_CLAMPED, 0);
  if (readWord(mem, box + AXIS_A_LIMITS) === NO_BOX) return;
  // Below the minimum: the minimum; at or above the maximum: the maximum (unsigned).
  const clamp = (value, offset) => {
    const minimum = readWord(mem, box + offset),
      maximum = readWord(mem, box + offset + MAXIMUM);
    if (value < minimum) {
      value = minimum;
      clamped = offset;
    }
    if (value >= maximum) {
      value = maximum;
      clamped = offset + MAXIMUM;
    }
    return value;
  };
  a = clamp(a, AXIS_A_LIMITS);
  b = clamp(b, AXIS_B_LIMITS);
  setWord(wram, DP_AXIS_A, a);
  setWord(wram, DP_AXIS_B, b);
  setWord(wram, DP_CLAMPED, clamped);
  if (!clamped) return;
  setWord(wram, DP_CAMERA_X, ((((b - a) & WORD_MASK) << X_SHIFT) + CAMERA_CENTRE_X) & WORD_MASK);
  setWord(wram, DP_CAMERA_Y, (CAMERA_CENTRE_Y - (((b + a) & WORD_MASK) << 1)) & WORD_MASK);
}
