import { writeStateByte } from '../state/objects.mjs';
// The outer game owner (lifted from 80:A139 and its resume point 80:A157;
// register-level reference retired on 2026-11-25).
//
// The owner runs the title cycle until the player chooses a game, sets up its
// audio and returns the choice. After a game, the caller requests the cycle
// without the title. No game return frame is created.
import { titleCycle } from './title-cycle.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { setUpGameAudio } from '../intro/intro-scene.mjs';
import {
  GAME_OPTIONS,
  OPTION_MUSIC,
  OPTION_MUSIC_RESTORE,
  SETTINGS_MUSIC,
  TIMER,
  TIMER_STOPPED,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

// The owner's entry after the start-up, its resume point after a game, and the
// return word of its JSR 9688 at A154 (the main loop's final RTS lands on A157).
export const GAME_OWNER_ENTRY = 0xa139,
  GAME_OWNER_RESUME = 0xa157,
  GAME_OWNER_RETURN_WORD = 0xa156;
// The game's main start reads the cycle's choice from direct page word 0.
const CHOICE = 0;

const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// 80:A139 / 80:A157: the caller explicitly chooses whether to show the title.
// The selected save slot or new-game marker is returned as a value. Direct page
// word 0 is retained for legacy callers; it does not select live control flow.
export function* gameOwnerSequence(h, events, showTitle = true) {
  const { wram } = h.a.mem;
  yield () => {
    // The cycle keeps the music on and restores it after the attract game.
    setWord(wram, GAME_OPTIONS, OPTION_MUSIC | OPTION_MUSIC_RESTORE);
  };
  const choice = yield* titleCycle(h, events, showTitle);
  yield () => {
    setWord(wram, CHOICE, choice);
    // The game plays music as the saved setting says.
    setWord(wram, GAME_OPTIONS, h.a.mem.read16(SETTINGS_MUSIC));
    setUpGameAudio(sceneRuntime(h));
    // The game starts without a countdown.
    setWord(wram, TIMER, TIMER_STOPPED);
  };
  return choice;
}
