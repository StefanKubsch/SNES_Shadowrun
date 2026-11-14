// The outer game owner (lifted from 80:A139 and its resume point 80:A157;
// register-level reference in proof/frontend-reference/game-owner.mjs).
//
// The owner runs the title cycle until the player chooses a game, sets up the game's
// audio and enters the game's main start 80:9688 with the original JSR frame of
// 80:A154. When the game ends, the main loop returns to 80:A157 and the owner starts
// the cycle again without the title.
import { nativeCallSequence, drainNativeSequence } from '../task/native-call-continuation.mjs';
import { taskStop } from '../task/plan.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { setUpGameAudio } from '../intro/intro-scene.mjs';
import { MAIN_START } from '../task/main-start.mjs';
import {
  GAME_OPTIONS,
  OPTION_MUSIC,
  OPTION_MUSIC_RESTORE,
  SETTINGS_MUSIC,
  TIMER,
  TIMER_STOPPED,
} from '../task/wram.mjs';
import { FLAG_DECIMAL, FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

// The owner's entry after the start-up, its resume point after a game, and the
// return word of its JSR 9688 at A154 (the main loop's final RTS lands on A157).
export const GAME_OWNER_ENTRY = 0xa139,
  GAME_OWNER_RESUME = 0xa157,
  GAME_OWNER_RETURN_WORD = 0xa156;
// The title cycle and its call site.
const TITLE_CYCLE = 0x80a18c,
  TITLE_CYCLE_SITE = 0x80a141;
// The game's main start reads the cycle's choice from direct page word 0.
const CHOICE = 0;

const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// 80:A139 / 80:A157: A is the cycle's argument at the entry (nonzero: show the
// title first); the resume point after a game passes zero. Ends at the main start
// 80:9688 with the return word A156 on the stack; returns that program counter.
export function* gameOwnerSequence(h, events, routines) {
  const { ctx } = h;
  if (
    ctx.programBank !== CODE_BANK ||
    ![GAME_OWNER_ENTRY, GAME_OWNER_RESUME].includes(ctx.pc) ||
    ctx.d !== 0 ||
    ctx.bank !== CODE_BANK ||
    ctx.status & (FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('main_owner_entry_required', { pc: ctx.pc });
  const { wram } = h.a.mem;
  yield () => {
    if (ctx.pc === GAME_OWNER_RESUME) ctx.a = 0;
    // The cycle keeps the music on and restores it after the attract game.
    setWord(wram, GAME_OPTIONS, OPTION_MUSIC | OPTION_MUSIC_RESTORE);
  };
  yield* nativeCallSequence(h, events, routines, TITLE_CYCLE_SITE, TITLE_CYCLE);
  yield () => {
    setWord(wram, CHOICE, ctx.a);
    // The game plays music as the saved setting says.
    setWord(wram, GAME_OPTIONS, h.a.mem.read16(SETTINGS_MUSIC));
    setUpGameAudio(sceneRuntime(h));
    // The game starts without a countdown.
    setWord(wram, TIMER, TIMER_STOPPED);
    ctx.bank = CODE_BANK;
    ctx.a = TIMER_STOPPED;
    h.a.pushWord(GAME_OWNER_RETURN_WORD);
    ctx.pc = MAIN_START;
  };
  return ctx.pc;
}

export function runGameOwner(h, e, r) {
  return drainNativeSequence(gameOwnerSequence(h, e, r));
}
