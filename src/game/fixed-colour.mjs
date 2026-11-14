// The fixed colour of colour math (lifted from 81:8861 with its common tail 81:886A
// and the colour effect 81:8877; register-level versions in
// src/task/main-transition.mjs and src/task/native-dialog-portrait.mjs, which their
// other callers still use, and in proof/game-reference/main-upkeep.mjs).
//
// The colour effects of the game blend a fixed colour through the request word
// 7E:1FDC and its phase 7E:1FDE. Resetting them clears the request, starts the
// phase at 180 and turns the effect off: the fixed colour black in all three
// planes and colour math on no layer.
//
// The main loop applies the request in every pass (81:8877): bit 15 resets it
// (keeping the bits 2 to 14) and clears the fixed colour; bit 0 flashes once (the
// fixed colour E5, colour math E3); bit 1 ramps quickly in steps of 40 over the
// phase up to 180, where it ends; bit 2 ramps slowly in steps of 10 without end.
// A ramp's level comes from the colour ramp 80:D3D1 at the 9-bit phase: the fast
// ramp darkens all three planes, the slow one only red and clears green and blue.
import { COLOUR_PHASE, COLOUR_REQUEST } from '../task/wram.mjs';
import { CGADSUB, COLDATA } from '../constants/hardware-registers.mjs';
import { COLDATA_BLUE, COLDATA_GREEN, COLDATA_RED } from '../constants/ppu.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

const PHASE_START = 0x180;
const REQUEST_RESET = 0x8000,
  RESET_KEEP = 0x7ffc,
  FLASH = 1,
  FAST_RAMP = 2,
  SLOW_RAMP = 4,
  FAST_STEP = 0x40,
  SLOW_STEP = 0x10,
  FAST_SHIFT = 3,
  SLOW_SHIFT = 4,
  PHASE_MASK = 0x1ff,
  FAST_RAMP_END = 0x180,
  // The colour ramp in bank 80, one level byte per phase.
  COLOUR_RAMP = 0x80d3d1;
const FLASH_FIXED_COLOUR = 0xe5,
  FLASH_COLOUR_MATH = 0xe3,
  RAMP_COLOUR_MATH = 0x23;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// The fixed colour black and colour math off (81:886A).
export function clearFixedColour(video) {
  video.write(COLDATA, COLDATA_RED | COLDATA_GREEN | COLDATA_BLUE, 1);
  video.write(CGADSUB, 0, 1);
}
// No colour effect requested, its phase at the start, the fixed colour cleared
// (81:8861). m: {wram, video}.
export function resetFixedColour({ wram, video }) {
  setWord(wram, COLOUR_REQUEST, 0);
  setWord(wram, COLOUR_PHASE, PHASE_START);
  clearFixedColour(video);
}

// The colour effect of the main loop (81:8877). m: {mem, wram, video}. Returns the
// new phase on a ramp, the X the original leaves (otherwise it keeps X).
export function applyColourEffect({ mem, wram, video }) {
  const request = word(wram, COLOUR_REQUEST);
  if (request & REQUEST_RESET) {
    setWord(wram, COLOUR_REQUEST, request & RESET_KEEP);
    clearFixedColour(video);
    return;
  }
  if (request & FLASH) {
    video.write(COLDATA, FLASH_FIXED_COLOUR, 1);
    video.write(CGADSUB, FLASH_COLOUR_MATH, 1);
    setWord(wram, COLOUR_REQUEST, request & ~FLASH);
    return;
  }
  const fast = Boolean(request & FAST_RAMP);
  if (!fast && !(request & SLOW_RAMP)) return;
  const phase = (word(wram, COLOUR_PHASE) + (fast ? FAST_STEP : SLOW_STEP)) & PHASE_MASK;
  setWord(wram, COLOUR_PHASE, phase);
  let level = mem.read8(COLOUR_RAMP + phase) >>> (fast ? FAST_SHIFT : SLOW_SHIFT);
  if (level) level--;
  if (fast) video.write(COLDATA, level | COLDATA_RED | COLDATA_GREEN | COLDATA_BLUE, 1);
  else {
    video.write(COLDATA, level | COLDATA_RED, 1);
    video.write(COLDATA, COLDATA_GREEN | COLDATA_BLUE, 1);
  }
  video.write(CGADSUB, RAMP_COLOUR_MATH, 1);
  if (fast && phase === FAST_RAMP_END) setWord(wram, COLOUR_REQUEST, request & ~FAST_RAMP);
  return phase;
}
