// Sound effects (lifted from 80:C46E with its stereo levels 80:C416; register-level
// versions in proof/replay/native-audio-compose.mjs and native-input-apu.mjs, references
// in proof/apu-reference/audio-routines.mjs).
//
// A sound effect names a sound word in the table 80:C4B3 (src/data/tables.mjs,
// sound_effects). A word with bit 15 set needs its sample set, which is loaded
// unless it is the set loaded last. The effect sends its left and right levels
// (from the level and the object's position on screen), the voices it may use
// (only when they changed) and then the sound (low byte; FF in the high byte).
import { sendApuCommand } from './apu-command.mjs';
import { loadSampleSet } from './music-mode.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import { taskStop } from '../system/task-stop.mjs';
import { CAMERA_X, SOUND_LOADED_SET, SOUND_VOICE_MASK } from '../data/wram.mjs';
import {
  APU_COMMAND_SOUND,
  APU_COMMAND_SOUND_LEVEL,
  APU_COMMAND_SOUND_VOICES,
} from '../constants/sound-commands.mjs';
import { RDMPYH, WRMPYA, WRMPYB } from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { objectWordIn } from '../state/objects.mjs';

const SOUND_EFFECTS = 0x80c4b3,
  LONG_MASK = 0xffffff,
  // A sound word with bit 15 set loads its sample set first.
  SAMPLE_SET_FLAG = WORD_SIGN,
  // The sound command sends the sound with FF in its high byte.
  SOUND_HIGH_BYTE = 0xff00,
  // Stereo position: centre without an object; the object's distance (its Y word
  // minus its X word, plus 600) from the camera's X, a quarter of it, clamped to
  // 0-255. Half the position weights the right level, its complement to 7F the left.
  PAN_CENTRE = 128,
  PAN_MAX = 255,
  PAN_BIAS = 0x600,
  PAN_SHIFT = 2,
  PAN_WEIGHT_MASK = 0x7f,
  // Original instructions of 80:C416, the sites of the device model: the level word
  // to the multiplicand (its high byte starts a product nobody reads), then each
  // weight as multiplier and the high byte of its product.
  LEVEL_SITE = 0x80c416,
  RIGHT_WEIGHT_SITE = 0x80c448,
  RIGHT_PRODUCT_SITE = 0x80c44f,
  LEFT_WEIGHT_SITE = 0x80c454,
  LEFT_PRODUCT_SITE = 0x80c45a,
  // The register-level caller passes the effect's arguments in direct page words.
  DP_OBJECT = 0,
  DP_EFFECT = 2,
  DP_LEVEL = 4,
  DP_VOICES = 6,
  // 80:C46E sets the data bank to its own bank and returns with RTS.
  CODE_BANK = 0x80;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// The left and right levels of a sound at level (low byte used) from the object
// (no object: a negative word) relative to the camera (80:C416): a word with the
// right level in its high byte and the left level in its low byte. Each level is
// the high byte of level times its weight, from the hardware multiplier as in the
// original (on another platform: (level * weight) >> 8).
export function soundLevels(wram, port, object, level) {
  port.write(WRMPYA, level, 2, LEVEL_SITE);
  let pan = PAN_CENTRE;
  if (!(object & WORD_SIGN)) {
    let distance =
      (objectWordIn(wram, 'y', object) - objectWordIn(wram, 'x', object) + PAN_BIAS) & WORD_MASK;
    if (distance & WORD_SIGN) distance = 0;
    const camera = word(wram, CAMERA_X);
    pan = distance < camera ? 0 : Math.min((distance - camera) >>> PAN_SHIFT, PAN_MAX);
  }
  const weight = pan >>> 1;
  port.write(WRMPYB, weight, 1, RIGHT_WEIGHT_SITE);
  const right = port.read(RDMPYH, 1, RIGHT_PRODUCT_SITE);
  port.write(WRMPYB, weight ^ PAN_WEIGHT_MASK, 1, LEFT_WEIGHT_SITE);
  const left = port.read(RDMPYH, 1, LEFT_PRODUCT_SITE);
  return (right << BYTE_BITS) | left;
}

// Play the sound effect at byte offset effect of the table at level on the voices
// (a nonzero mask) with the stereo position of object (80:C46E). Returns the sound
// word.
export function playSoundEffect(mem, port, { object, effect, level, voices }) {
  const { wram } = mem,
    at = SOUND_EFFECTS + effect,
    sound = mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
  if (sound !== word(wram, SOUND_LOADED_SET) && sound & SAMPLE_SET_FLAG) {
    setWord(wram, SOUND_LOADED_SET, sound);
    loadSampleSet(mem, port, sound);
  }
  sendApuCommand(wram, port, APU_COMMAND_SOUND_LEVEL, soundLevels(wram, port, object, level));
  // Voices 0: the original returns with the sound word still on its stack.
  if (voices === 0) taskStop('task_audio_return_required', { pc: 0x80c4b2, voice: 0 });
  if (voices !== word(wram, SOUND_VOICE_MASK)) {
    setWord(wram, SOUND_VOICE_MASK, voices);
    sendApuCommand(wram, port, APU_COMMAND_SOUND_VOICES, voices);
  }
  sendApuCommand(wram, port, APU_COMMAND_SOUND, sound | SOUND_HIGH_BYTE);
  return sound;
}

// 80:C46E as callers run it: the object, effect, level and voices in the WRAM words 0,
// 2, 4 and 6 (the direct page of its callers, which all run with D = 0). Leaves the data
// bank at 80. Game state only (user decision 2026-11-17): no direct page register is
// read, and the effect, sound word and command the original leaves in Y, X and A are not
// kept; every caller sets its own before reading them.
// playSoundEffectCall is it without the JSR frame for lifted callers (the caller's
// return word lies only in free stack bytes).
export function playSoundEffectCall(h) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    dp = (offset) => word(wram, offset);
  playSoundEffect(mem, accessorPort(h.a), {
    object: dp(DP_OBJECT),
    effect: dp(DP_EFFECT),
    level: dp(DP_LEVEL),
    voices: dp(DP_VOICES),
  });
  ctx.bank = CODE_BANK;
}
// The RTS form for register-level callers is playSoundEffectJsr in
// proof/caller/jsr-forms.mjs.
