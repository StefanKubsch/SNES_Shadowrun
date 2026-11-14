// The time limits of the notice windows (lifted from 80:FF14; register-level
// reference in proof/game-reference/main-upkeep.mjs).
//
// A notice (80:FEC1) opens a window in one of four slots with the frames it stays.
// The main loop counts them down in every pass, from the last slot to the first;
// a notice whose frames run out has its window released (80:FA3E, lifted in
// window-release.mjs, which redraws the window list and waits for the NMI of its
// upload) and its slot freed. While the notice effect frames 7E:0202 run down
// (a notice with window attributes 0400 sets them), each pass plays one of three
// effect sounds 80:FF73 with a chance of 3333/10000 (hex), at level 20 on voices 3.
//
// The release runs below the slot index the original pushes and the return word of
// its JSR (80:FF2D), as the NMI of the upload wait writes below them. The random
// numbers (src/system/random.mjs) and the sound effect (src/apu/sound-effect.mjs)
// are lifted; the direct page words 00 to 07 are left as the original leaves them:
// the random word without a sound, the sound's arguments with one. X and Y are left
// as the original leaves them, as a later wait takes its NMI with them (main-upkeep.mjs).
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { randomBelow, randomWord } from '../system/random.mjs';
import { playSoundEffect } from '../apu/sound-effect.mjs';
import { releaseWindowSequence } from './window-release.mjs';
import {
  DP_SOUND_EFFECT,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
  NOTICE_EFFECT_FRAMES,
  NOTICE_FRAMES,
  NOTICE_WINDOW_LAST,
  NOTICE_WINDOWS,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const NONE = WORD_MASK,
  LOOP_END = 0xfffe,
  SOUND_HIGH_BYTE = 0xff00,
  DP_WINDOW = 0x00,
  RELEASE_RETURN = 0xff2f;
// The effect sounds: a chance below 3333 of the random word, then one of three
// effect offsets in bank 80, played with no object at level 20 on voices 3.
const EFFECT_CHANCE = 0x3333,
  EFFECT_SOUNDS = 0x80ff73,
  EFFECT_CHOICES = 3,
  EFFECT_LEVEL = 0x20,
  EFFECT_VOICES = 3,
  // The register-level random leaves the range in the direct page word 02.
  DP_RANDOM_RANGE = 0x02;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Count the notices down and release the ones whose frames ran out (80:FF14), a
// sequence for a native call continuation.
export function* noticeTimeoutSequence(h, events) {
  const m = sceneRuntime(h),
    { mem, wram, port } = m;
  for (let x = NOTICE_WINDOW_LAST; x >= 0; x -= 2) {
    const window = word(wram, NOTICE_WINDOWS + x);
    if (window & WORD_SIGN) continue;
    const frames = (word(wram, NOTICE_FRAMES + x) - 1) & WORD_MASK;
    yield () => setWord(wram, NOTICE_FRAMES + x, frames);
    if (frames) continue;
    yield () => {
      setWord(wram, DP_WINDOW, window);
      h.a.pushWord(x);
      h.a.pushWord(RELEASE_RETURN);
    };
    yield* releaseWindowSequence(h, events);
    yield () => {
      h.a.pullWord();
      h.a.pullWord();
      setWord(wram, NOTICE_WINDOWS + x, NONE);
    };
  }
  yield () => {
    const { ctx } = h;
    // The loop counts X down past slot 0.
    ctx.x = LOOP_END;
    const frames = word(wram, NOTICE_EFFECT_FRAMES);
    if (!frames) return;
    setWord(wram, NOTICE_EFFECT_FRAMES, frames - 1);
    // The random byte runs with 8-bit index registers: X keeps its low byte, Y the
    // table index the draw leaves.
    const chance = randomWord(mem, port, ctx);
    ctx.x &= BYTE_MASK;
    setWord(wram, 0, chance);
    if (chance >= EFFECT_CHANCE) return;
    setWord(wram, DP_RANDOM_RANGE, EFFECT_CHOICES);
    const offset = randomBelow(mem, port, EFFECT_CHOICES, ctx) * 2,
      effect =
        mem.read8(EFFECT_SOUNDS + offset) | (mem.read8(EFFECT_SOUNDS + offset + 1) << BYTE_BITS);
    setWord(wram, 0, NONE);
    setWord(wram, DP_SOUND_EFFECT, effect);
    setWord(wram, DP_SOUND_LEVEL, EFFECT_LEVEL);
    setWord(wram, DP_SOUND_VOICE, EFFECT_VOICES);
    const sound = playSoundEffect(mem, port, {
      object: NONE,
      effect,
      level: EFFECT_LEVEL,
      voices: EFFECT_VOICES,
    });
    // The sound effect leaves the sound word with FF in its high byte and the offset.
    ctx.x = sound | SOUND_HIGH_BYTE;
    ctx.y = effect;
  };
}
