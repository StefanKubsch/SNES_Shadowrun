// Shadowrun sound-driver port commands, dispatched through ARAM $02C8/$02E2.
// Source: src/apu/sound-driver.mjs command targets and docs/SOUND-DRIVER.md.
// These are game protocol values; DSP hardware registers live in src/apu/.
// Block list upload (driver $0635; 81:F092 sends a directory's base list with it).
export const APU_COMMAND_UPLOAD = 0x01;
export const APU_COMMAND_VOLUME_TARGET = 0x02;
// Step per tick toward the volume target, left low and right high byte (driver $068D).
export const APU_COMMAND_FADE_STEP = 0x03;
export const APU_COMMAND_SONG = 0x04;
export const APU_COMMAND_SOUND = 0x05;
export const APU_COMMAND_SOUND_LEVEL = 0x06;
// Sound of the low parameter byte; the high byte's nibbles set its left/right volume ($0916).
export const APU_COMMAND_SOUND_VOLUME = 0x07;
// Main volume at once: left from the low, right from the high parameter byte (driver $0692);
// APU_COMMAND_VOLUME_TARGET moves toward its value instead.
export const APU_COMMAND_VOLUME = 0x08;
// Sound directories of 81:F092 (98:FFFA + X, src/data/sound.mjs): the game's, and the one
// of the title, start menu and intro.
export const SOUND_DIRECTORY_GAME = 0;
export const SOUND_DIRECTORY_TITLE = 3;
// Song pointer tables installed by the European directory base lists ($04E1).
export const GAME_SONG_TABLE = 0xd067,
  TITLE_SONG_TABLE = 0x7674;
export const TITLE_MENU_SONG = 2;
// 81:E6AE/E775: the start-menu animation triggers these four pitched accents
// through command 07 (table 81:E7B4), outside the note sequencer.
export const TITLE_MUSIC_ACCENT_LAST = 3;
// Full left and right level of APU_COMMAND_VOLUME and APU_COMMAND_VOLUME_TARGET.
export const APU_FULL_VOLUME = 0x7f7f;
export const APU_COMMAND_SONG_LEVEL = 0x0d;
export const APU_COMMAND_SOUND_VOICES = 0x0f;
export const APU_COMMAND_TRANSFER = 0x10;
// Output mode from the low parameter byte (driver $060D; bit 7 stereo, see OUTPUT_STEREO).
export const APU_COMMAND_OUTPUT_MODE = 0x14;
// Pitch of the voices chosen by APU_COMMAND_SOUND_VOICES (driver $09E3).
export const APU_COMMAND_VOICE_PITCH = 0x18;
