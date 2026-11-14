// The register-level audio routines in place of the lifted ones, for the references
// and the ROM proof tests: the sound driver command 81:F007, the music change
// 81:EF47, the song start 81:F229 (moved from src/task/main-scene.mjs), the mode
// sample list 81:F1FA, the sample loader 81:F130 with its length 81:F100, word
// 81:F122 and byte pair 81:F03A, and the sound effect 80:C46E. The routines other
// than F229 live in src/task/native-audio-compose.mjs and native-input-apu.mjs,
// where the register-level task natives still call them directly. Lifted versions:
// src/apu/music-mode.mjs, src/apu/apu-command.mjs, src/apu/audio-routines.mjs,
// src/apu/sound-effect.mjs.
import { MAIN_SCENE_ROUTINES } from '../../src/task/main-scene.mjs';
import {
  setMusicMode,
  playSoundEffect,
  loadSampleData,
  loadModeSamples,
  subtractSampleLength,
  runTaskAudioWord,
  sendApuBytePair,
} from '../../src/task/native-audio-compose.mjs';
import { sendApuCommand } from '../../src/task/native-input-apu.mjs';
import { routineCaller } from '../../src/task/routine-call.mjs';
import { BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import { APU_COMMAND_SONG } from '../../src/constants/sound-commands.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_ZERO,
  FLAG_CARRY,
} from '../../src/constants/cpu-flags.mjs';

// 81:F229: song command 04 with X 0, then (if A names a song) F1FA loads its mode
// samples, F130 its sound set (complement plus 8100: 80FF - song) and command 04
// starts it.
const SONG_LOAD_BIAS = 0x8100;

// Calls without a table use the live scene routines with these entries (built on
// first use: the task tables are complete only after all modules have loaded).
let routines = null;
const defaultRoutines = () =>
  (routines ??= new Map([...MAIN_SCENE_ROUTINES, ...AUDIO_REFERENCE_ENTRIES]));

// 81:F229: start the song in A with its sound set (command 04).
export function startSong(h, events, r = defaultRoutines()) {
  const { ctx } = h,
    call = routineCaller(h, events, r);
  h.php();
  h.rep(FLAG_INDEX_8BIT);
  h.sep(FLAG_MEMORY_8BIT);
  h.pha();
  h.load(APU_COMMAND_SONG);
  h.index('x', 0);
  call(0x81f234, 0x81f007, true);
  h.pla();
  if (!(ctx.status & FLAG_ZERO)) {
    call(0x81f23b, 0x81f1fa);
    h.rep(FLAG_MEMORY_8BIT);
    h.load(ctx.a & BYTE_MASK);
    h.pha();
    h.load(ctx.a ^ WORD_MASK);
    ctx.status &= ~FLAG_CARRY;
    h.adc(SONG_LOAD_BIAS);
    call(0x81f24b, 0x81f130, true);
    h.plx();
    h.sep(FLAG_MEMORY_8BIT);
    h.load(APU_COMMAND_SONG);
    call(0x81f254, 0x81f007, true);
  }
  h.plp();
  return h.rtl();
}

export const AUDIO_REFERENCE_ENTRIES = [
  [0x81ef47, (h, e) => setMusicMode(h.a, e, false)],
  [0x81f130, (h, e) => loadSampleData(h.a, e, false)],
  [0x81f007, (h) => sendApuCommand(h.a, false)],
  [0x81f229, (h, e, r = defaultRoutines()) => startSong(h, e, r)],
  [0x81f1fa, (h, e) => loadModeSamples(h.a, e, false)],
  [0x81f100, (h, e) => subtractSampleLength(h.a, e, false)],
  [0x81f122, (h, e) => runTaskAudioWord(h.a, e, false, false)],
  [0x81f03a, (h, e) => sendApuBytePair(h.a, e, false)],
  [0x80c46e, (h, e) => playSoundEffect(h.a, e, false)],
];
// A copy of a routine table with the register-level audio routines.
export const withAudioReference = (table) => new Map([...table, ...AUDIO_REFERENCE_ENTRIES]);
