// Register-level reference of the fight list append 80:8521 (moved from
// src/task/native-fight-list-append.mjs; lifted in src/game/fight-list.mjs, bound as a
// script native in src/task/native-script-leaves.mjs).
import { taskStop } from '../../src/task/plan.mjs';
import { FIRST_ARGUMENT, leaf } from '../../src/task/native-leaf-support.mjs';
import { setMusicMode } from '../../src/task/native-audio-compose.mjs';
import {
  FIGHT_KARMA,
  FIGHT_LIST,
  FIGHT_LIST_INDEX,
  FIGHT_MUSIC,
  GAME_OPTIONS,
  KARMA,
  MUSIC,
  MUSIC_FIGHT,
  OPTION_MUSIC,
  WRAM,
} from '../../src/task/wram.mjs';
import { WORD_MASK, WORD_BITS } from '../../src/constants/bits.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import { CODE_BANK } from '../../src/constants/memory-map.mjs';
// JSL 81:EF47 (music mode in A) and its return word, the bank offset of the call's last byte.
const MUSIC_ROUTINE = 0x81ef47,
  MUSIC_RETURN_WORD = 0x80855c & WORD_MASK;
// 80:8521: append the object (first argument) to the fight list (index += 2, no capacity
// check). The first entry starts a fight: karma / 8 to FIGHT_KARMA and FFFF to
// FIGHT_MUSIC; with music enabled (GAME_OPTIONS) and another song playing, that song
// goes to FIGHT_MUSIC and 81:EF47 switches to the fight music (real JSL/RTL, APU ports
// observed).
export function appendToFightListReference(a, outerReturn = true) {
  return leaf(
    a,
    (h) => {
      const { ctx } = h,
        lsr = () => {
          ctx.status = (ctx.status & ~FLAG_CARRY) | (ctx.a & 1);
          h.load(ctx.a >>> 1);
        };
      h.index('x', h.longRead(h.abs(FIGHT_LIST_INDEX)));
      h.index('x', (ctx.x + 1) & WORD_MASK);
      h.index('x', (ctx.x + 1) & WORD_MASK);
      h.longWrite(h.abs(FIGHT_LIST_INDEX), ctx.x);
      h.load(h.dp(FIRST_ARGUMENT));
      h.longWrite(h.abs(FIGHT_LIST) + ctx.x, ctx.a);
      ctx.status = (ctx.status & ~FLAG_CARRY) | FLAG_CARRY;
      h.nz(ctx.x);
      if (ctx.x !== 0) return; // CPX #0
      h.load(h.longRead(WRAM + KARMA));
      lsr();
      lsr();
      lsr();
      h.longWrite(h.abs(FIGHT_KARMA), ctx.a);
      h.load(WORD_MASK);
      h.longWrite(h.abs(FIGHT_MUSIC), ctx.a);
      h.load(h.longRead(h.abs(GAME_OPTIONS)) & OPTION_MUSIC);
      if (ctx.status & FLAG_ZERO) return;
      h.load(MUSIC_FIGHT);
      const current = h.longRead(h.abs(MUSIC));
      h.nz((MUSIC_FIGHT - current) & WORD_MASK);
      ctx.status = (ctx.status & ~FLAG_CARRY) | Number(MUSIC_FIGHT >= current);
      if (ctx.status & FLAG_ZERO) return;
      h.index('y', h.longRead(h.abs(MUSIC)));
      h.longWrite(h.abs(FIGHT_MUSIC), ctx.y);
      a.write(ctx.s, ctx.programBank, '8521-JSL-bank');
      ctx.s = (ctx.s - 1) & WORD_MASK;
      a.pushWord(MUSIC_RETURN_WORD, '8521-JSL-WORD');
      ctx.programBank = MUSIC_ROUTINE >>> WORD_BITS;
      ctx.pc = MUSIC_ROUTINE & WORD_MASK;
      const result = setMusicMode(a, { calls: [] }, false);
      if (result.rawReturnWord !== MUSIC_RETURN_WORD || ctx.programBank !== CODE_BANK)
        taskStop('task_native_long_return_required', {
          raw: result.rawReturnWord,
          bank: ctx.programBank,
        });
    },
    outerReturn,
  );
}
