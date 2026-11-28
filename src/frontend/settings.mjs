// The game-facing settings: defaults and the sound driver's output-mode command.
// The .srm serializer owns their persistence and checksum.
import { SETTINGS_MUSIC_FULL, SETTINGS_STEREO_ON } from '../data/wram.mjs';
import { APU_COMMAND_OUTPUT_MODE } from '../constants/sound-commands.mjs';
import {
  readSaveSettings,
  writeSaveSettings,
  settingsChecksum as checksum,
  storeSettingsChecksum as storeChecksum,
  settingsValid as valid,
} from '../storage/srm.mjs';

export const settingsChecksum = (mem) => checksum(mem.sram);
export const storeSettingsChecksum = (mem) => storeChecksum(mem.sram);
export const settingsValid = (mem) => valid(mem.sram);
export function restoreDefaultSettings(mem) {
  writeSaveSettings(mem.sram, {
    stereo: SETTINGS_STEREO_ON,
    control: 0,
    music: SETTINGS_MUSIC_FULL,
  });
  storeSettingsChecksum(mem);
}
export const settingsWord = (mem) => readSaveSettings(mem.sram).outputControlWord;
export function sendOutputMode(m) {
  const word = settingsWord(m.mem);
  m.sound(APU_COMMAND_OUTPUT_MODE, word);
  return word;
}
