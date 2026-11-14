// The global settings in SRAM (lifted from 81:D5D0, 81:D5E4, 81:D5EC, 81:D5F4 and 81:EF36;
// register-level versions in src/task/main-frontend-text.mjs): the output mode, the
// control type and the music setting, guarded by a checksum byte. The boot screens check
// them (src/frontend/boot-screens.mjs), the start menu's options change them
// (src/frontend/start-menu.mjs).
import {
  SETTINGS_CHECKSUM,
  SETTINGS_CONTROL,
  SETTINGS_MUSIC,
  SETTINGS_MUSIC_FULL,
  SETTINGS_STEREO,
  SETTINGS_STEREO_ON,
} from '../task/wram.mjs';
import { APU_COMMAND_OUTPUT_MODE } from '../constants/sound-commands.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

// Settings checksum (81:D5D0): seed plus the three bytes with carry, XORed at the end.
const SETTINGS_CHECKSUM_SEED = 0xeb,
  SETTINGS_CHECKSUM_XOR = 0x5a,
  SETTINGS_BYTES = 3;

// The checksum of the settings (81:D5D0), from the last byte to the first.
export function settingsChecksum(mem) {
  let sum = SETTINGS_CHECKSUM_SEED,
    carry = 0;
  for (let n = SETTINGS_BYTES - 1; n >= 0; n--) {
    const total = sum + mem.read8(SETTINGS_STEREO + n) + carry;
    sum = total & BYTE_MASK;
    carry = total >>> BYTE_BITS;
  }
  return sum ^ SETTINGS_CHECKSUM_XOR;
}
// Store the checksum of the settings in SRAM (81:D5E4).
export function storeSettingsChecksum(mem) {
  mem.write8(SETTINGS_CHECKSUM, settingsChecksum(mem));
}
// Whether the stored checksum matches the settings (81:D5EC).
export const settingsValid = (mem) => settingsChecksum(mem) === mem.read8(SETTINGS_CHECKSUM);
// The default settings with their checksum (81:D5F4): stereo, control type 0, full music.
export function restoreDefaultSettings(mem) {
  mem.write8(SETTINGS_STEREO, SETTINGS_STEREO_ON);
  mem.write8(SETTINGS_CONTROL, 0);
  mem.write8(SETTINGS_MUSIC, SETTINGS_MUSIC_FULL);
  storeSettingsChecksum(mem);
}
// The settings word: the output mode (low byte) and the control type (high byte).
export const settingsWord = (mem) =>
  mem.read8(SETTINGS_STEREO) | (mem.read8(SETTINGS_CONTROL) << BYTE_BITS);
// Send the output mode to the sound driver (81:EF36) with the settings word; m is the
// scene runtime (src/system/scene-runtime.mjs). Returns the settings word, the X the
// original leaves.
export function sendOutputMode(m) {
  const word = settingsWord(m.mem);
  m.sound(APU_COMMAND_OUTPUT_MODE, word);
  return word;
}
