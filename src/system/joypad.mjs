// The joypad (lifted from 80:9E0B and 80:9E1A; long forms 80:F290 and 80:F298,
// register-level versions in src/task/main-scene-wait.mjs and
// src/task/native-input-apu.mjs). The NMI stores the held buttons; the game
// loop derives the newly pressed ones.
import { taskStop } from '../task/plan.mjs';
import { PAD_HELD, PAD_PREVIOUS, PAD_PRESSED } from '../task/wram.mjs';
import { HVBJOY, STDCNTRL1L } from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

const AUTO_READ_BUSY = 1,
  // Original instructions, the sites of the device model.
  STATUS_SITE = 0x809e0b,
  PAD_SITE = 0x809e13,
  // Select, Start, L and R together reset the game (80:9E2F selects 80:9E3D); the
  // low four bits are never set by a standard controller and void the word.
  SOFT_RESET_BUTTONS = 0x3030,
  INVALID_PAD_BITS = 0x000f;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// The buttons held on controller 1 (PAD_* bits in src/task/wram.mjs): wait while
// HVBJOY bit 0 reports the automatic read, then take the word.
export function readJoypad(port) {
  while (port.read(HVBJOY, 2, STATUS_SITE) & AUTO_READ_BUSY);
  return port.read(STDCNTRL1L, 2, PAD_SITE);
}
// The newly pressed buttons from the held ones (80:9E1A). The soft reset stops at
// the frontier of the reset entry, as the register-level version does.
export function takePadPresses(wram) {
  const held = word(wram, PAD_HELD);
  setWord(wram, PAD_PRESSED, (held ^ word(wram, PAD_PREVIOUS)) & held);
  setWord(wram, PAD_PREVIOUS, held);
  if (held === SOFT_RESET_BUTTONS)
    taskStop('task_reset_source_required', {
      pc: 0x809e2f,
      target: 0x809e3d,
      startupTarget: 0x80e382,
    });
  if (held & INVALID_PAD_BITS) {
    setWord(wram, PAD_HELD, 0);
    setWord(wram, PAD_PRESSED, 0);
  }
}
