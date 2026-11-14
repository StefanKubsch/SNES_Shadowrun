// Cutscenes (lifted from 81:CDF8 and the NMI callback 81:D479; register-level
// reference in proof/cutscene-reference/). A cutscene sets up its screen from a
// scene list, plays its music and sound, animates every frame for its frame
// count (B or Start ends it), slows the BG2 scroll for its end frames and fades
// out. Scene 14 is the intro (81:DFE7, src/intro/), passed on as the original
// does. A negative scene is mirrored.
import { taskStop } from '../task/plan.mjs';
import { nativeCallSequence, nativeTailSequence } from '../task/native-call-continuation.mjs';
import { FadePollContinuation, lagFree } from '../task/main-wait-interrupt.mjs';
import { sceneWaitByte } from '../task/main-scene-wait.mjs';
import { heldPad, menuCreditsRunning, CREDITS_SEQUENCE } from '../game/credits.mjs';
import {
  beginPackedTextEdit,
  endPackedTextEdit,
  CREDITS_EDIT,
} from '../data/packed-text-edits.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { startSceneScreen, enableNmiAndJoypad, disableNmi } from '../system/nmi.mjs';
import { runSceneList } from '../system/scene-list.mjs';
import { unpackStream } from '../system/unpack.mjs';
import { readJoypad, takePadPresses } from '../system/joypad.mjs';
import { nmiAtBranch, waitForFrame } from '../system/frame-wait.mjs';
import { loadSampleSet, setMusicMode, startSong } from '../apu/music-mode.mjs';
import { setSceneScreen } from '../video/scene-screen.mjs';
import {
  CHARACTER_MAP,
  CREDITS_BUFFER,
  SCENE_LAYERS,
  animateCutscene,
  cutsceneTables,
  drawSprites,
  fillTextMap,
  sceneIndex,
  sendMirroredPicture,
} from './cutscene-animation.mjs';
import {
  DP_CUTSCENE_POSITION as DP_POSITION,
  DP_CUTSCENE_SCENE as DP_SCENE,
  DP_CUTSCENE_SCROLL_Y as DP_SCROLL_Y,
  DP_CUTSCENE_SPEED as DP_SPEED,
  DP_CUTSCENE_SPEED_STEP as DP_STEP,
  DP_CUTSCENE_SPEED_TARGET as DP_TARGET,
  MUSIC,
  OAM_SHADOW,
  PAD_B,
  PAD_HELD,
  PAD_START,
  SCENE_ANIMATION_STEP,
  SCENE_ARGUMENT,
  SCENE_BRIGHTNESS,
  SCENE_BRIGHTNESS_TARGET,
  SCENE_COUNTER,
  SOUND_LOADED_SET,
  SOUND_VOICE_MASK,
  VRAM_SLOT_COUNT,
  WRAM,
} from '../task/wram.mjs';
import {
  A1B7,
  A1T7L,
  BBAD7,
  BG1VOFS,
  BG2HOFS,
  DMAP7,
  HDMAEN,
  INIDISP,
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
  INIDISP_FORCED_BLANK,
  MAX_BRIGHTNESS,
  OAM_BYTES,
  WINDOW_1_ENABLE,
  WINDOW_1_INVERT,
  WINDOW_HIGH_LAYER_SHIFT,
} from '../constants/ppu.mjs';
import {
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_SOUND_VOLUME,
} from '../constants/sound-commands.mjs';
import { BYTE_BITS, BYTE_MASK, BYTE_SIGN, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const INTRO_SCENE = 0x14,
  INTRO = 0x81dfe7,
  // Register-level routines for recorded interrupt observations, called from the
  // cutscene entry (nothing reads that return address).
  CALL_SITE = 0x81cdf8,
  WAIT_FRAME = 0x81eebb,
  READ_INPUT = 0x80f298,
  // The scene lists 81:F48D: one word per scene, lists in bank 81.
  SCENE_LISTS = 0x81f48d,
  LIST_BANK = SCENE_LISTS & ~WORD_MASK,
  // The credits: character map 85:FD38 into 7E:56A8, text 81:F2BD into 7E:62A8.
  CREDITS_CHARACTERS = 0x85fd38,
  CREDITS_TEXT = 0x81f2bd,
  // The scene window: H-DMA channel 7 writes WH0/WH1 from bank 81; window 1 inverted on
  // BG1-BG3 and OBJ, masking the scene layers on the main screen.
  WINDOW_HDMA_BANK = 0x81,
  HDMA_CHANNEL_7 = 0x80,
  SCENE_WINDOW = WINDOW_1_ENABLE | WINDOW_1_INVERT,
  // Sounds play on voice 0, their set loaded first (bit 15). B or Start ends a scene;
  // at its end sound 2E plays.
  SCENE_SOUND_VOICE = 1,
  LOAD_SET = WORD_SIGN,
  SKIP_BUTTONS = PAD_B | PAD_START,
  SCENE_END_SOUND = 0x2e,
  NO_MUSIC = WORD_MASK,
  // The fade poll 81:CF4C: LDA 11A3 / BNE CF4C, where the NMI arrives.
  FADE_POLL = 0x81cf4c,
  FADE_BRANCH = 0x81cf4f,
  // The BG2 position is the scroll times 128; a mirrored scene scrolls the other way.
  POSITION_SCROLL_SHIFT = 7,
  SCROLL_MIRROR = 0x1ff;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
function requireWideAccumulator(ctx) {
  if (ctx.status & FLAG_MEMORY_8BIT) taskStop('cutscene_wide_accumulator_required');
}

// 81:CDF8: play the cutscene in A with the argument in X. h is the accessor of the
// native call from the main loop (80:CC4B) or the frontend (credits).
export function* cutsceneSequence(h, events, routines) {
  const { ctx } = h;
  if (ctx.a === INTRO_SCENE) return yield* nativeTailSequence(h, events, routines, INTRO);
  const call = (target) => nativeCallSequence(h, events, routines, CALL_SITE, target, true),
    lifted = lagFree(events);
  let m, t, n;
  const wait = () => (lifted ? waitForFrame(h, events, m.port) : call(WAIT_FRAME)),
    input = lifted ? () => [() => takePadPresses(m.wram)] : () => call(READ_INPUT);
  // The credits read the edited credit pages while their streams unpack.
  const snapshot =
    (ctx.a & (WORD_SIGN - 1)) === CREDITS_SEQUENCE
      ? beginPackedTextEdit(h.a.mem, CREDITS_EDIT)
      : null;
  try {
    yield () => {
      requireWideAccumulator(ctx);
      m = sceneRuntime(h);
      t = cutsceneTables(m.mem);
      const { wram } = m;
      setWord(wram, DP_SCENE, ctx.a);
      setWord(wram, SCENE_ARGUMENT, ctx.x);
      setWord(wram, VRAM_SLOT_COUNT, 0);
      n = sceneIndex(wram);
      startSceneScreen(wram, m.video, m.port);
      setSceneScreen(m.video);
      setWord(wram, DP_TARGET, t.targets(n));
      setWord(wram, DP_STEP, t.steps(n));
      const list =
        m.mem.read8(SCENE_LISTS + n * 2) | (m.mem.read8(SCENE_LISTS + n * 2 + 1) << BYTE_BITS);
      runSceneList(m.mem, m.video, m.port, LIST_BANK | list);
      if (word(wram, DP_SCENE) & WORD_SIGN) sendMirroredPicture(m);
      drawSprites(m, t.spriteBases(n));
      for (const at of [DP_SCROLL_Y, SCENE_COUNTER, SCENE_ANIMATION_STEP, DP_SPEED, DP_POSITION])
        setWord(wram, at, 0);
      unpackStream(m.mem, CREDITS_CHARACTERS, CHARACTER_MAP);
      unpackStream(m.mem, CREDITS_TEXT, CREDITS_BUFFER);
    };
  } finally {
    endPackedTextEdit(h.a.mem, snapshot);
  }
  yield () => {
    const { wram, video } = m;
    fillTextMap(m);
    video.write(A1T7L, t.windowHdma(n), 2);
    video.write(DMAP7, DMAP_TWO_PORTS, 1);
    video.write(BBAD7, WH0 & BYTE_MASK, 1);
    video.write(A1B7, WINDOW_HDMA_BANK, 1);
    video.write(HDMAEN, HDMA_CHANNEL_7, 1);
    video.write(W12SEL, SCENE_WINDOW | (SCENE_WINDOW << WINDOW_HIGH_LAYER_SHIFT), 1);
    video.write(W34SEL, SCENE_WINDOW, 1);
    video.write(WOBJSEL, SCENE_WINDOW, 1);
    video.write(TMW, SCENE_LAYERS, 1);
    video.write(WBGLOG, 0, 1);
    video.write(WOBJLOG, 0, 1);
    wram[SCENE_BRIGHTNESS_TARGET] = MAX_BRIGHTNESS;
    wram[SCENE_BRIGHTNESS] = 0;
    const mode = t.audioModes(n);
    if (!(mode & WORD_SIGN)) setMusicMode(m.mem, m.port, mode);
    const sound = t.sounds(n);
    if (sound !== 0) {
      m.sound(APU_COMMAND_SOUND_VOICES, SCENE_SOUND_VOICE);
      loadSampleSet(m.mem, m.port, LOAD_SET | (sound & BYTE_MASK));
      m.sound(APU_COMMAND_SOUND_VOLUME, sound);
    }
    animateCutscene(m);
    enableNmiAndJoypad(wram, m.port);
  };
  // Credits from the start menu (src/game/credits.mjs) may be ended with B or Start:
  // the credits animation clears 01CA first, so the original never sees the pad;
  // for the menu's credits the pad word of the input read is kept for the check.
  let kept = 0;
  const frames = function* (count) {
    let left = count;
    do {
      yield* wait();
      yield* input();
      yield () => {
        kept = menuCreditsRunning(h.a.vm) ? heldPad(m.wram) : 0;
        animateCutscene(m);
      };
      if ((word(m.wram, PAD_HELD) | kept) & SKIP_BUTTONS) return true;
      left = (left - 1) & WORD_MASK;
    } while (!(left & WORD_SIGN));
    return false;
  };
  const skipped = yield* frames(t.frames(n));
  if (!skipped) {
    yield () => {
      setWord(m.wram, DP_STEP, t.endSteps(n));
      setWord(m.wram, DP_TARGET, 0);
    };
    yield* frames(t.endFrames(n));
  }
  yield () => {
    startSong(m.mem, m.port, 0);
    m.sound(APU_COMMAND_SOUND_VOLUME, SCENE_END_SOUND);
    m.wram[SCENE_BRIGHTNESS_TARGET] = 0;
  };
  // Wait until the NMI callback has faded the brightness to 0.
  if (lifted)
    while (m.wram[SCENE_BRIGHTNESS] !== 0) {
      const brightness = m.wram[SCENE_BRIGHTNESS],
        // After LDA of a nonzero byte in 8-bit mode: Z clear, N its bit 7.
        status = (ctx.status | FLAG_MEMORY_8BIT) & ~(FLAG_NEGATIVE | FLAG_ZERO);
      yield* nmiAtBranch(
        h,
        events,
        FADE_BRANCH,
        brightness & BYTE_SIGN ? status | FLAG_NEGATIVE : status,
      );
    }
  else if (events?.interrupts !== undefined)
    yield { continuation: new FadePollContinuation(h, events) };
  else
    for (let value = 1; value !== 0;)
      yield () => (value = sceneWaitByte(h, events, FADE_POLL, WRAM + SCENE_BRIGHTNESS));
  yield* wait();
  let result;
  yield () => {
    const { wram, video } = m;
    disableNmi(wram, m.port);
    video.write(HDMAEN, 0, 1);
    setWord(wram, SOUND_LOADED_SET, 0);
    setWord(wram, SOUND_VOICE_MASK, 0);
    setWord(wram, MUSIC, NO_MUSIC);
    result = h.rtl();
  };
  return result;
}

// 81:D479: the NMI callback of the cutscenes: sprites, the BG2 scroll from its
// position, the BG1 scroll, the BG2 speed towards its target, the brightness
// towards its target, then the joypad.
export function handleCutsceneNmi(h) {
  requireWideAccumulator(h.ctx);
  const m = sceneRuntime(h),
    { wram, video } = m;
  video.copyToOam(WRAM + OAM_SHADOW, OAM_BYTES);
  let scroll = word(wram, DP_POSITION) >>> POSITION_SCROLL_SHIFT;
  if (word(wram, DP_SCENE) & WORD_SIGN) scroll ^= SCROLL_MIRROR;
  video.write(BG2HOFS, scroll & BYTE_MASK, 1);
  video.write(BG2HOFS, scroll >>> BYTE_BITS, 1);
  video.write(BG1VOFS, wram[DP_SCROLL_Y], 1);
  video.write(BG1VOFS, wram[DP_SCROLL_Y + 1], 1);
  const target = word(wram, DP_TARGET),
    step = word(wram, DP_STEP);
  let speed = word(wram, DP_SPEED);
  if (speed < target) {
    speed = (speed + step) & WORD_MASK;
    if (speed >= target) speed = target;
  } else if (speed > target) {
    // A step past zero or below the target stops at the target.
    speed = speed >= step && speed - step >= target ? speed - step : target;
  }
  setWord(wram, DP_SPEED, speed);
  setWord(wram, DP_POSITION, (speed + word(wram, DP_POSITION)) & WORD_MASK);
  const brightness = wram[SCENE_BRIGHTNESS],
    goal = wram[SCENE_BRIGHTNESS_TARGET];
  video.write(INIDISP, brightness === 0 ? INIDISP_FORCED_BLANK : brightness, 1);
  if (brightness !== goal)
    wram[SCENE_BRIGHTNESS] = (brightness + (brightness > goal ? -1 : 1)) & BYTE_MASK;
  setWord(wram, PAD_HELD, readJoypad(m.port));
  return h.rtl();
}
