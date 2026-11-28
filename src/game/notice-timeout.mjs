// Count notices down in reverse slot order and retire windows when they expire.
// Effect duration, probability and sound choices retain the original random draws.
import { noticeState } from '../state/notices.mjs';
import { navigationState } from '../state/menu.mjs';
import { noticeEffectSound } from '../content/notices.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { randomBelow, randomWord } from '../system/random.mjs';
import { playSoundEffect } from '../apu/sound-effect.mjs';
import { releaseWindowAt } from './window-release.mjs';
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

export function* noticeTimeoutSequence(h, events) {
  const { mem, port } = sceneRuntime(h),
    state = noticeState(mem),
    argumentsState = navigationState(h.a);
  for (let index = state.slots.length - 1; index >= 0; index--) {
    const slot = state.slots[index],
      window = slot.window;
    if (window & WORD_SIGN) continue;
    const frames = (slot.frames - 1) & WORD_MASK;
    yield () => {
      slot.frames = frames;
    };
    if (frames) continue;
    yield* releaseWindowAt(h, events, window);
    yield () => {
      slot.window = WORD_MASK;
    };
  }
  yield () => {
    const frames = state.effectFrames;
    if (!frames) return;
    state.effectFrames = frames - 1;
    const chance = randomWord(mem, port);
    argumentsState.window = chance;
    if (chance >= 0x3333) return;
    argumentsState.argument = 3;
    const effect = noticeEffectSound(mem, randomBelow(mem, port, 3));
    argumentsState.window = WORD_MASK;
    argumentsState.soundEffect = effect;
    argumentsState.soundLevel = 0x20;
    argumentsState.soundVoices = 3;
    playSoundEffect(mem, port, { object: WORD_MASK, effect, level: 0x20, voices: 3 });
  };
}
