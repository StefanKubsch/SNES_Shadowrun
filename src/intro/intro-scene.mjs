// The intro (lifted from 81:DFE7, cutscene 14, with its set-up 81:D60F, 81:D83E,
// 81:D642, 81:DDB1 and 81:EF63 and the NMI callback 81:DF0E; register-level
// reference in proof/intro-reference/). The cutscene entry 81:CDF8 passes scene 14
// on to it (src/cutscene/cutscene-scene.mjs).
//
// The intro loads the title's sounds, builds its screen from two scene lists and
// five packed streams, plays its song and a sound, fades in and runs 300 frames
// unless a button is held. It fades out, plays cutscene 5 mirrored and sets up the
// game's sounds again.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { startSceneScreen, enableNmiAndJoypad, disableNmi } from '../system/nmi.mjs';
import { runSceneList } from '../system/scene-list.mjs';
import { unpackStream } from '../system/unpack.mjs';
import { takePadPresses } from '../system/joypad.mjs';
import { waitForFrame } from '../system/frame-wait.mjs';
import { loadSampleSet, loadSoundDirectory, startSong } from '../apu/music-mode.mjs';
import { setSceneScreen } from '../video/scene-screen.mjs';
import { fadeIn, fadeOut } from '../video/fades.mjs';
import {
  INTRO_FAR_ANIMATION,
  INTRO_FRAME_RESTART,
  clearIntroObjects,
  drawIntroObjects,
  introTables,
  placeFirstNearObjects,
  stepIntroFrame,
} from './intro-objects.mjs';
import {
  DP_TITLE_POSITION,
  DP_TITLE_SPEED,
  DP_TITLE_SPEED_TARGET,
  FRONTEND_FRAME_COUNTER,
  INTRO_FAR_ANIMATIONS,
  INTRO_FAR_X,
  INTRO_FAR_Y,
  INTRO_MAP,
  INTRO_MAP_BYTES,
  INTRO_NEAR_ANIMATIONS,
  INTRO_WINDOW_HDMA,
  MUSIC,
  PAD_HELD,
  SOUND_LOADED_SET,
  SOUND_VOICE_MASK,
  VRAM_SLOT_COUNT,
  WRAM,
} from '../task/wram.mjs';
import {
  A1B7,
  A1T7L,
  BBAD7,
  DMAP7,
  HDMAEN,
  TMW,
  W12SEL,
  W34SEL,
  WBGLOG,
  WH0,
  WOBJLOG,
  WOBJSEL,
} from '../constants/hardware-registers.mjs';
import {
  DMAP_TWO_PORTS,
  LAYER_BG1,
  LAYER_BG2,
  LAYER_BG3,
  LAYER_OBJ,
  TILE_PRIORITY,
  WINDOW_1_ENABLE,
  WINDOW_1_INVERT,
  WINDOW_HIGH_LAYER_SHIFT,
} from '../constants/ppu.mjs';
import {
  APU_COMMAND_FADE_STEP,
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_SOUND_VOLUME,
  APU_COMMAND_VOLUME,
  APU_COMMAND_VOLUME_TARGET,
  APU_FULL_VOLUME,
  SOUND_DIRECTORY_GAME,
  SOUND_DIRECTORY_TITLE,
} from '../constants/sound-commands.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

// Register-level routines for recorded interrupt observations and the nested
// cutscene, called from their original sites.
const WAIT_FRAME = 0x81eebb,
  WAIT_SITE = 0x81e07e,
  READ_INPUT = 0x80f298,
  INPUT_SITE = 0x81e082,
  CUTSCENE = 0x81cdf8,
  CUTSCENE_SITE = 0x81e120;
// The scene lists 81:F6EF (screen) and 81:F79F (NMI callback and more).
const SCREEN_LIST = 0x81f6ef,
  SCENE_LIST = 0x81f79f;
// The packed streams (intro_unpacks): source word, bank word and target in bank 7E,
// three words an entry; a zero source ends the list.
const UNPACK_ENTRY_WORDS = 3;
// The window: H-DMA channel 7 writes WH0/WH1 from the table in 7E (the original
// copies 14 bytes, the 13 of intro_window_hdma and the byte after it); window 1
// inverted on BG1-BG3 and OBJ masks them on the main screen.
const WINDOW_TABLE_BYTES = 14,
  WINDOW_SOURCE = 0x81d687,
  WRAM_BANK = WRAM >>> WORD_BITS,
  HDMA_CHANNEL_7 = 0x80,
  WINDOW = WINDOW_1_ENABLE | WINDOW_1_INVERT,
  WINDOW_LAYERS = LAYER_BG1 | LAYER_BG2 | LAYER_BG3 | LAYER_OBJ;
// Audio: the title's fade step, sounds on voices 0 and 1 at full volume (81:DDB1);
// the intro sound set and song, sound 0A at level 44 on voices 6 and 7; the game's
// sounds on voices 0 and 1 with their fade step (81:EF63).
const TITLE_FADE_STEP = 0x0a0a,
  GAME_FADE_STEP = 0x0808,
  VOICES_0_1 = 3,
  VOICE_0 = 1,
  VOICES_6_7 = 0xc0,
  INTRO_SOUND_SET = WORD_SIGN | 0x0a,
  INTRO_SONG = 3,
  INTRO_SOUND = 0x440a;
// The objects at the start: near slots 0 and 1 restart their animation, slots 2 and
// 3 are free, the far object stands at 6C/4C with no fractions.
const FREE = WORD_MASK,
  START_SLOTS = [INTRO_FRAME_RESTART, INTRO_FRAME_RESTART, FREE, FREE],
  FAR_START_X = 0x6c,
  FAR_START_Y = 0x4c,
  FAR_FRACTION = 2;
// The loop: 300 frames; then cutscene 5 mirrored, with the X the fade out leaves
// (8-bit X counted down to FF) as its argument.
const INTRO_FRAMES = 300,
  END_SCENE = WORD_SIGN | 5,
  END_SCENE_ARGUMENT = 0xff,
  INTRO_DATA_BANK = 0x81,
  // 81:EF63 leaves the data bank at 80.
  RETURN_DATA_BANK = 0x80;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Build the intro screen (81:D60F): the scene screen, the screen list, the packed
// streams (81:D83E), the picture map with priority tiles, the first near objects.
export function setUpIntroScene(m) {
  const { mem, wram, video, port } = m,
    t = introTables(mem);
  setWord(wram, VRAM_SLOT_COUNT, 0);
  startSceneScreen(wram, video, port);
  setSceneScreen(video);
  runSceneList(mem, video, port, SCREEN_LIST);
  for (let at = 0; ; at += UNPACK_ENTRY_WORDS) {
    const source = t.unpacks(at);
    if (source === 0) break;
    unpackStream(mem, ((t.unpacks(at + 1) & BYTE_MASK) << WORD_BITS) | source, t.unpacks(at + 2));
  }
  const map = INTRO_MAP - WRAM;
  for (let at = 0; at < INTRO_MAP_BYTES; at += 2)
    setWord(wram, map + at, word(wram, map + at) | TILE_PRIORITY);
  setWord(wram, DP_TITLE_POSITION, 0);
  placeFirstNearObjects(m);
}
// Set up the intro window H-DMA and masks (81:D642).
export function setUpIntroWindow(m) {
  const { mem, wram, video } = m;
  video.write(A1T7L, INTRO_WINDOW_HDMA & WORD_MASK, 2);
  for (let n = 0; n < WINDOW_TABLE_BYTES; n++)
    wram[INTRO_WINDOW_HDMA - WRAM + n] = mem.read8(WINDOW_SOURCE + n);
  video.write(DMAP7, DMAP_TWO_PORTS, 1);
  video.write(BBAD7, WH0 & BYTE_MASK, 1);
  video.write(A1B7, WRAM_BANK, 1);
  video.write(HDMAEN, HDMA_CHANNEL_7, 1);
  video.write(W12SEL, WINDOW | (WINDOW << WINDOW_HIGH_LAYER_SHIFT), 1);
  video.write(W34SEL, WINDOW, 1);
  video.write(WOBJSEL, WINDOW, 1);
  video.write(TMW, WINDOW_LAYERS, 1);
  video.write(WBGLOG, 0, 1);
  video.write(WOBJLOG, 0, 1);
}
// The title's audio (81:DDB1): fade step, sounds on voices 0 and 1, full volume.
export function setUpTitleAudio(m) {
  m.sound(APU_COMMAND_FADE_STEP, TITLE_FADE_STEP);
  m.sound(APU_COMMAND_SOUND_VOICES, VOICES_0_1);
  m.sound(APU_COMMAND_VOLUME, APU_FULL_VOLUME);
  m.sound(APU_COMMAND_VOLUME_TARGET, APU_FULL_VOLUME);
}
// The game's audio (81:EF63): no music, the game's sound directory, sounds on
// voices 0 and 1, its fade step.
export function setUpGameAudio(m) {
  const { mem, wram, port } = m;
  setWord(wram, SOUND_LOADED_SET, 0);
  setWord(wram, MUSIC, 0);
  startSong(mem, port, 0);
  loadSoundDirectory(mem, port, SOUND_DIRECTORY_GAME);
  setWord(wram, SOUND_VOICE_MASK, VOICES_0_1);
  m.sound(APU_COMMAND_SOUND_VOICES, VOICES_0_1);
  m.sound(APU_COMMAND_FADE_STEP, GAME_FADE_STEP);
}

// 81:EF63 for register-level callers (the outer owner 80:A141): the game's audio,
// data bank 80, RTL.
export function setUpGameAudioRoutine(h) {
  setUpGameAudio(sceneRuntime(h));
  h.ctx.bank = RETURN_DATA_BANK;
  return h.rtl();
}

// 81:DFE7: play the intro. h is the accessor of the native call that 81:CDF8
// passes on.
export function* introSequence(h, events, routines) {
  const { ctx } = h,
    // The original saves the status and runs with 16-bit registers in data bank 81.
    status = ctx.status,
    call = (site, target) => nativeCallSequence(h, events, routines, site, target, true),
    lifted = lagFree(events);
  ctx.status &= ~(FLAG_MEMORY_8BIT | FLAG_INDEX_8BIT);
  ctx.bank = INTRO_DATA_BANK;
  let m;
  const wait = () => (lifted ? waitForFrame(h, events, m.port) : call(WAIT_SITE, WAIT_FRAME)),
    input = lifted ? () => [() => takePadPresses(m.wram)] : () => call(INPUT_SITE, READ_INPUT);
  yield () => {
    m = sceneRuntime(h);
    const { mem, wram, port } = m;
    startSong(mem, port, 0);
    loadSoundDirectory(mem, port, SOUND_DIRECTORY_TITLE);
    clearIntroObjects(wram);
    setUpIntroScene(m);
    runSceneList(mem, m.video, port, SCENE_LIST);
    START_SLOTS.forEach((value, slot) => setWord(wram, INTRO_NEAR_ANIMATIONS + slot * 2, value));
    for (const [at, value] of [
      [INTRO_FAR_ANIMATIONS, INTRO_FAR_ANIMATION],
      [INTRO_FAR_X, FAR_START_X],
      [INTRO_FAR_Y, FAR_START_Y],
      [INTRO_FAR_X + FAR_FRACTION, FREE],
      [INTRO_FAR_Y + FAR_FRACTION, FREE],
    ])
      setWord(wram, at, value);
    setUpTitleAudio(m);
    setUpIntroWindow(m);
    m.sound(APU_COMMAND_SOUND_VOICES, VOICE_0);
    loadSampleSet(mem, port, INTRO_SOUND_SET);
    startSong(mem, port, INTRO_SONG);
    m.sound(APU_COMMAND_SOUND_VOLUME, INTRO_SOUND);
    m.sound(APU_COMMAND_SOUND_VOICES, VOICES_6_7);
    enableNmiAndJoypad(wram, port);
  };
  yield* fadeIn(m.video, wait);
  yield () => {
    for (const at of [FRONTEND_FRAME_COUNTER, DP_TITLE_SPEED_TARGET, DP_TITLE_SPEED])
      setWord(m.wram, at, 0);
  };
  for (let left = INTRO_FRAMES; ;) {
    yield* wait();
    yield* input();
    yield () => stepIntroFrame(m);
    if (word(m.wram, PAD_HELD) !== 0) break;
    left--;
    if (left === 0) break;
  }
  yield* fadeOut(m.video, wait);
  yield () => {
    disableNmi(m.wram, m.port);
    ctx.a = END_SCENE;
    ctx.x = END_SCENE_ARGUMENT;
  };
  yield* call(CUTSCENE_SITE, CUTSCENE);
  let result;
  yield () => {
    setUpGameAudio(m);
    ctx.bank = RETURN_DATA_BANK;
    ctx.status = status;
    result = h.rtl();
  };
  return result;
}

// 81:DF0E: the NMI callback of the intro (src/intro/intro-objects.mjs).
export function handleIntroNmi(h) {
  drawIntroObjects(sceneRuntime(h));
  return h.rtl();
}
