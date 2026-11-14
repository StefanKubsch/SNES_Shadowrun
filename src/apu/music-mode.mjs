// Music modes and sample loading (lifted from 81:EF47, 81:F25A, 81:F1FA, 81:F130,
// 81:F100, 81:F122/F1E8, 81:F03A and the directory load 81:F092; register-level
// versions in src/task/native-audio-compose.mjs and proof/intro-reference/intro-setup.mjs;
// directory and block formats in
// src/data/sound.mjs).
//
// A music mode starts its song, loads the samples its mode list names and sets
// the song level and volume. Samples go to the sound driver as byte pairs: a
// transfer command with the byte count, the destination address, then the
// data. Pairs wait for the driver's echo of the command token on port 0.
//
// The original keeps the loader state in the direct page (7E:0089-008B,
// 008F-0099) and sets each field before it reads it; only the directory
// pointer 7E:008C-008E is persistent.
import { sendApuCommand } from './apu-command.mjs';
import {
  APU_COMMAND_TOKEN,
  APU_PAIR_FIRST_BYTE,
  APU_PAIR_PENDING,
  AUDIO_DIRECTORY_POINTER,
  MUSIC,
  MUSIC_MODE_BYTE,
} from '../task/wram.mjs';
import { APUIO0, APUIO1, APUIO2 } from '../constants/hardware-registers.mjs';
import {
  APU_COMMAND_SONG,
  APU_COMMAND_SONG_LEVEL,
  APU_COMMAND_TRANSFER,
  APU_COMMAND_UPLOAD,
  APU_COMMAND_VOLUME_TARGET,
} from '../constants/sound-commands.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const LONG_MASK = 0xffffff,
  // Original instructions, the sites of the device model.
  ECHO_SITE = 0x81f046,
  FIRST_SITE = 0x81f050,
  SECOND_SITE = 0x81f054,
  TOKEN_SITE = 0x81f058,
  // The long pointers of the sound directories (98:FFFA + number); a directory
  // names its upload block list by the long pointer at its byte 2.
  SOUND_POINTERS = 0x98fffa,
  DIRECTORY_POINTER_BYTES = 3,
  DIRECTORY_LIST = 2,
  // The directory: a word with the offset of the mode lists, then from byte 5
  // entries of four bytes (sample set id, long pointer of its block list), FF ends.
  DIRECTORY_ENTRIES = 5,
  DIRECTORY_ENTRY_BYTES = 4,
  DIRECTORY_END = 0xff,
  // A sample set id with bit 15 set is loaded; bits 0-7 are the id.
  LOAD_FLAG = WORD_SIGN,
  // A raw block: count word, long source address; the loop index steps to the
  // source word plus one, and the next block starts two bytes later.
  RAW_SOURCE = 2,
  RAW_BLOCK_STEP = 3,
  // A block count word with bit 15 set repeats one word (count in bits 0-14).
  REPEAT_COUNT_MASK = WORD_SIGN - 1,
  // F25A loads the set 80FF minus the mode byte and restarts the song with 01xx.
  MODE_SET_BASE = 0x80ff,
  SONG_REPEAT = 0x0100,
  // EF47 then sets these left/right levels.
  SONG_LEVELS = 0x2020,
  VOLUME_TARGET = 0x7f7f;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// The loader of one music change; read(address) reads a cartridge byte.
function loader(mem, port) {
  const { wram } = mem,
    read = (address) => mem.read8(address & LONG_MASK),
    readWord = (address) => read(address) | (read(address + 1) << BYTE_BITS),
    readLong = (address) => readWord(address) | (read(address + 2) << WORD_BITS),
    directory =
      word(wram, AUDIO_DIRECTORY_POINTER) | (wram[AUDIO_DIRECTORY_POINTER + 2] << WORD_BITS);
  // A byte towards the driver (81:F03A): the first of a pair waits, the second
  // sends both. Returns the byte the original leaves in A (the byte, or the token).
  const pair = (value) => {
    if (wram[APU_PAIR_PENDING] === 0) {
      wram[APU_PAIR_FIRST_BYTE] = value;
      wram[APU_PAIR_PENDING] = BYTE_MASK;
      return value;
    }
    wram[APU_PAIR_PENDING] = 0;
    const token = wram[APU_COMMAND_TOKEN];
    while (port.read(APUIO0, 1, ECHO_SITE) !== token);
    const next = (token + 1) & BYTE_MASK;
    port.write(APUIO1, wram[APU_PAIR_FIRST_BYTE], 1, FIRST_SITE);
    port.write(APUIO2, value, 1, SECOND_SITE);
    port.write(APUIO0, next, 1, TOKEN_SITE);
    wram[APU_COMMAND_TOKEN] = next;
    return next;
  };
  const pairWord = (value) => {
    pair(value & BYTE_MASK);
    pair(value >>> BYTE_BITS);
  };
  // Load the sample set id (bit 15 set, 81:F130): find it in the directory and send
  // its blocks, raw bytes or one repeated word.
  const loadSamples = (set) => {
    if (!(set & LOAD_FLAG)) return;
    const id = set & BYTE_MASK;
    let at = DIRECTORY_ENTRIES;
    for (;;) {
      const entry = read(directory + at);
      if (entry === DIRECTORY_END) return;
      if (entry === id) break;
      at = (at + DIRECTORY_ENTRY_BYTES) & WORD_MASK;
    }
    const list = readLong(directory + at + 1);
    let remaining = (readWord(list) - 2) & WORD_MASK,
      destination = readWord(list + 2),
      y = 2;
    for (;;) {
      y = (y + 2) & WORD_MASK;
      if (remaining === 0) return;
      const count = readWord(list + y);
      if (!(count & WORD_SIGN)) {
        remaining = (remaining - count) & WORD_MASK;
        const source = readLong(list + y + RAW_SOURCE);
        y = (y + RAW_BLOCK_STEP) & WORD_MASK;
        sendApuCommand(wram, port, APU_COMMAND_TRANSFER, count);
        wram[APU_PAIR_PENDING] = 0;
        pairWord(destination);
        let last,
          index = 0;
        do {
          last = pair(read(source + index));
          // Only the low byte of the destination counts on (81:F1A8).
          destination = (destination & ~BYTE_MASK) | ((destination + 1) & BYTE_MASK);
          index = (index + 1) & WORD_MASK;
        } while (index !== count);
        // The original sends once more what A holds after the last pair.
        pair(last);
      } else {
        const repeats = count & REPEAT_COUNT_MASK,
          bytes = (repeats * 2) & WORD_MASK;
        remaining = (remaining - bytes) & WORD_MASK;
        sendApuCommand(wram, port, APU_COMMAND_TRANSFER, bytes);
        wram[APU_PAIR_PENDING] = 0;
        pairWord(destination);
        y = (y + 2) & WORD_MASK;
        const value = readWord(list + y);
        let left = repeats;
        do {
          pairWord(value);
          destination = (destination + 2) & WORD_MASK;
          left = (left - 1) & WORD_MASK;
        } while (left !== 0);
      }
    }
  };
  // Store the mode byte and load every sample set its mode list names (81:F1FA).
  const loadModeSamples = (mode) => {
    wram[MUSIC_MODE_BYTE] = mode;
    let at = readWord(directory);
    for (;;) {
      const entry = read(directory + at);
      if (entry === 0) break;
      at = (at + 1) & WORD_MASK;
      if (entry === wram[MUSIC_MODE_BYTE]) loadSamples(LOAD_FLAG | read(directory + at));
      at = (at + 1) & WORD_MASK;
    }
    return wram[MUSIC_MODE_BYTE];
  };
  // Send the block list at list as one upload (81:F092): command 01 with the byte
  // count, the destination word, the raw bytes and repeated words of its blocks,
  // then a closing zero byte.
  const uploadBlockList = (list) => {
    let remaining = (readWord(list) - 2) & WORD_MASK,
      y = 2;
    sendApuCommand(wram, port, APU_COMMAND_UPLOAD, remaining);
    wram[APU_PAIR_PENDING] = 0;
    pairWord(readWord(list + y));
    for (;;) {
      y = (y + 2) & WORD_MASK;
      if (remaining === 0) break;
      const count = readWord(list + y);
      if (!(count & WORD_SIGN)) {
        remaining = (remaining - count) & WORD_MASK;
        const source = readLong(list + y + RAW_SOURCE);
        y = (y + RAW_BLOCK_STEP) & WORD_MASK;
        let index = 0;
        do {
          pair(read(source + index));
          index = (index + 1) & WORD_MASK;
        } while (index !== count);
      } else {
        const repeats = count & REPEAT_COUNT_MASK;
        remaining = (remaining - repeats * 2) & WORD_MASK;
        y = (y + 2) & WORD_MASK;
        const value = readWord(list + y);
        let left = repeats;
        do {
          pairWord(value);
          left = (left - 1) & WORD_MASK;
        } while (left !== 0);
      }
    }
    pair(0);
  };
  return { loadModeSamples, loadSamples, uploadBlockList };
}

// Load the sound directory number (0 the game's, 3 the title's; 81:F092): its long
// pointer at 98:FFFA + number becomes the directory pointer 7E:008C, and the block
// list named by the long pointer at directory + 2 goes to the driver.
export function loadSoundDirectory(mem, port, number) {
  const { wram } = mem;
  for (let n = 0; n < DIRECTORY_POINTER_BYTES; n++)
    wram[AUDIO_DIRECTORY_POINTER + n] = mem.read8((SOUND_POINTERS + number + n) & LONG_MASK);
  const directory =
    word(wram, AUDIO_DIRECTORY_POINTER) | (wram[AUDIO_DIRECTORY_POINTER + 2] << WORD_BITS);
  let list = 0;
  for (let n = DIRECTORY_POINTER_BYTES - 1; n >= 0; n--)
    list = (list << BYTE_BITS) | mem.read8((directory + DIRECTORY_LIST + n) & LONG_MASK);
  loader(mem, port).uploadBlockList(list);
}

// Switch the music to mode (81:EF47).
export function setMusicMode(mem, port, mode) {
  const { wram } = mem;
  setWord(wram, MUSIC, mode);
  // 81:F25A: stop the song; a nonzero mode loads its samples and restarts it.
  sendApuCommand(wram, port, APU_COMMAND_SONG, 0);
  const modeByte = mode & BYTE_MASK;
  if (modeByte !== 0) {
    const { loadModeSamples, loadSamples } = loader(mem, port),
      loaded = loadModeSamples(modeByte);
    loadSamples((MODE_SET_BASE - loaded) & WORD_MASK);
    sendApuCommand(wram, port, APU_COMMAND_SONG, loaded | SONG_REPEAT);
  }
  sendApuCommand(wram, port, APU_COMMAND_SONG_LEVEL, SONG_LEVELS);
  sendApuCommand(wram, port, APU_COMMAND_VOLUME_TARGET, VOLUME_TARGET);
}

// Load one sample set (bit 15 set; 81:F130).
export const loadSampleSet = (mem, port, set) => loader(mem, port).loadSamples(set);
// Start the song in the low byte of song (81:F229): stop the song; a nonzero song
// loads its samples and set 80FF minus it, then starts.
export function startSong(mem, port, song) {
  sendApuCommand(mem.wram, port, APU_COMMAND_SONG, 0);
  const songByte = song & BYTE_MASK;
  if (songByte === 0) return;
  const { loadModeSamples, loadSamples } = loader(mem, port),
    loaded = loadModeSamples(songByte);
  loadSamples((MODE_SET_BASE - loaded) & WORD_MASK);
  sendApuCommand(mem.wram, port, APU_COMMAND_SONG, loaded);
}
