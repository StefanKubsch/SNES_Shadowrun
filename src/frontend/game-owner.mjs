import { writeStateByte } from '../state/objects.mjs';
// The outer game owner (lifted from 80:A139 and its resume point 80:A157;
// register-level reference in proof/frontend-reference/game-owner.mjs).
//
// The owner runs the title cycle (without its JSR frame) until the player chooses a
// game, sets up the game's audio and enters the game's main start 80:9688 with the
// original JSR frame of 80:A154. When the game ends, the main loop returns to 80:A157 and the owner starts
// the cycle again without the title.
import { titleCycle } from './title-cycle.mjs';
import { taskStop } from '../system/task-stop.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { setUpGameAudio } from '../intro/intro-scene.mjs';
import { GAME_START as MAIN_START } from '../game/game-start.mjs';
import {
  GAME_OPTIONS,
  OPTION_MUSIC,
  OPTION_MUSIC_RESTORE,
  SETTINGS_MUSIC,
  TIMER,
  TIMER_STOPPED,
} from '../data/wram.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
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

// 80:A139 / 80:A157: the original's A is the cycle's argument (nonzero: show the title
// first). The startup always enters A139 with 1 and the resume point A157 passes zero,
// so the lifted owner takes it from its entry point and reads no register. Ends at the main start
// 80:9688 with the return word A156 on the stack; returns that program counter. The
// cycle's choice passes as a value (A in the original) and no registers are left. Only
// the entry point is checked; the register-level check (direct page 0, data bank 80,
// 16-bit binary registers) stays with the proof caller in
// proof/frontend-caller/game-owner.mjs.
export function* gameOwnerSequence(h, events, routines) {
  const { ctx } = h;
  if (ctx.programBank !== CODE_BANK || ![GAME_OWNER_ENTRY, GAME_OWNER_RESUME].includes(ctx.pc))
    taskStop('main_owner_entry_required', { pc: ctx.pc });
  const { wram } = h.a.mem,
    title = ctx.pc === GAME_OWNER_ENTRY,
    shown = {};
  yield () => {
    // The cycle keeps the music on and restores it after the attract game.
    setWord(wram, GAME_OPTIONS, OPTION_MUSIC | OPTION_MUSIC_RESTORE);
  };
  yield* titleCycle(h, events, routines, title, shown);
  yield () => {
    setWord(wram, CHOICE, shown.choice);
    // The game plays music as the saved setting says.
    setWord(wram, GAME_OPTIONS, h.a.mem.read16(SETTINGS_MUSIC));
    setUpGameAudio(sceneRuntime(h));
    // The game starts without a countdown.
    setWord(wram, TIMER, TIMER_STOPPED);
    ctx.bank = CODE_BANK;
    h.a.pushWord(GAME_OWNER_RETURN_WORD);
    ctx.pc = MAIN_START;
  };
  return ctx.pc;
}
