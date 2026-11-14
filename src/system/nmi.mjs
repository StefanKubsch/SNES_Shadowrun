// NMI control and the scene screen start (lifted from 81:EB7B, 81:EB89, 80:C109
// and 81:EB97; register-level versions in src/task/main-scene-video.mjs).
// NMITIMEN has a shadow in WRAM that the frame wait reads; the NMI handler
// calls the long callback in 7E:006E-0070.
import {
  CLEAR_COLOUR,
  NMI_CALLBACK,
  NMI_CALLBACK_BANK,
  NMITIMEN_SHADOW,
  OAM_SHADOW,
  WRAM,
} from '../task/wram.mjs';
import {
  NMITIMEN,
  NMITIMEN_AUTO_JOYPAD,
  NMITIMEN_NMI_ENABLE,
} from '../constants/hardware-registers.mjs';
import {
  CGRAM_COLOURS,
  INIDISP_FORCED_BLANK,
  OAM_BYTES,
  OAM_ENTRY_BYTES,
  OAM_LOW_TABLE_BYTES,
} from '../constants/ppu.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// Original instructions, the sites of the device model.
const ENABLE_SITE = 0x81eb84,
  DISABLE_SITE = 0x81eb92,
  JOYPAD_ONLY_SITE = 0x81eb9f;
// The scene start installs the callback 81:EC15 (a plain return) and fills CGRAM
// from colour 16 on (wrapping) with the clear colour; 81:EE4E is a zero byte.
const SCREEN_START_CALLBACK = 0x81ec15,
  FIRST_CLEARED_COLOUR = 0x10,
  VRAM_ZERO_BYTE = 0x81ee4e,
  // Direct page 2E is cleared here; no reader is known.
  CLEARED_WORD = 0x2e,
  // A sprite off screen: X FF, Y F0.
  OAM_OFF_SCREEN = 0xf0ff;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
function setNmiTimen(wram, port, value, site) {
  wram[NMITIMEN_SHADOW] = value;
  port.write(NMITIMEN, value, 1, site);
}

// Enable the NMI and the automatic joypad read (81:EB7B).
export function enableNmiAndJoypad(wram, port) {
  setNmiTimen(
    wram,
    port,
    wram[NMITIMEN_SHADOW] | NMITIMEN_NMI_ENABLE | NMITIMEN_AUTO_JOYPAD,
    ENABLE_SITE,
  );
}
// Disable the NMI, keep the other bits (81:EB89).
export function disableNmi(wram, port) {
  setNmiTimen(wram, port, wram[NMITIMEN_SHADOW] & ~NMITIMEN_NMI_ENABLE & BYTE_MASK, DISABLE_SITE);
}
// The NMI callback, a long address (80:C109).
export function setNmiCallback(wram, callback) {
  setWord(wram, NMI_CALLBACK, callback & WORD_MASK);
  wram[NMI_CALLBACK_BANK] = callback >>> WORD_BITS;
}
// Hide every sprite of the OAM buffer and clear its high table (81:EDB6).
export function hideAllSprites(wram) {
  for (let at = 0; at < OAM_LOW_TABLE_BYTES; at += OAM_ENTRY_BYTES)
    setWord(wram, OAM_SHADOW + at, OAM_OFF_SCREEN);
  for (let at = OAM_LOW_TABLE_BYTES; at < OAM_BYTES; at += 2) setWord(wram, OAM_SHADOW + at, 0);
}
// Start a scene screen (81:EB97): joypad read only, forced blank, the plain callback,
// default registers, empty VRAM, hidden sprites, and CGRAM from colour 16 in the
// clear colour, which is reset to black afterwards.
export function startSceneScreen(wram, video, port) {
  setNmiTimen(wram, port, NMITIMEN_AUTO_JOYPAD, JOYPAD_ONLY_SITE);
  video.setDisplay(INIDISP_FORCED_BLANK);
  disableNmi(wram, port);
  setNmiCallback(wram, SCREEN_START_CALLBACK);
  video.resetRegisters();
  video.clearVram(VRAM_ZERO_BYTE);
  hideAllSprites(wram);
  video.copyToOam(WRAM + OAM_SHADOW, OAM_BYTES);
  video.setColours(FIRST_CLEARED_COLOUR, ...Array(CGRAM_COLOURS).fill(word(wram, CLEAR_COLOUR)));
  setWord(wram, CLEAR_COLOUR, 0);
  setWord(wram, CLEARED_WORD, 0);
}
