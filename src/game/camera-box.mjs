// Clamp the projected camera position to the room's two map axes, then project back.
// Content limits keep their encoded reader until phase 4.
import { cameraState } from '../state/camera.mjs';
import { BYTE_BITS, LONG_MASK, WORD_MASK } from '../constants/bits.mjs';
const NO_BOX = WORD_MASK,
  CAMERA_CENTRE_X = 0x400,
  CAMERA_CENTRE_Y = 0x940,
  AXIS_SHIFT = 3,
  X_SHIFT = 2,
  AXIS_A_LIMITS = 1,
  AXIS_B_LIMITS = 5,
  MAXIMUM = 2;
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);

export function clampToCameraBox(mem, wram) {
  const state = cameraState(wram);
  if (!state.boxSourceHigh) return;
  state.copyBoxSource();
  const box = state.boxAddress,
    shiftedX = (state.projectedX - CAMERA_CENTRE_X) & WORD_MASK,
    doubleY = ((CAMERA_CENTRE_Y - state.projectedY) << 1) & WORD_MASK;
  let a = ((doubleY - shiftedX) & WORD_MASK) >>> AXIS_SHIFT,
    b = ((doubleY + shiftedX) & WORD_MASK) >>> AXIS_SHIFT,
    clamped = 0;
  state.doubleY = doubleY;
  state.axisA = a;
  state.axisB = b;
  state.clampedLimit = 0;
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
  state.axisA = a;
  state.axisB = b;
  state.clampedLimit = clamped;
  if (!clamped) return;
  state.projectedX = ((((b - a) & WORD_MASK) << X_SHIFT) + CAMERA_CENTRE_X) & WORD_MASK;
  state.projectedY = (CAMERA_CENTRE_Y - (((b + a) & WORD_MASK) << 1)) & WORD_MASK;
}
