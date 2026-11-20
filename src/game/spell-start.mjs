import { writeStateByte } from '../state/objects.mjs';
// Starting the selected spell (lifted from the script native 80:8EDA; register-level
// reference in proof/game-reference/script-starts.mjs).
//
// The spell menu leaves the selected spell's script (7E:3C13) and a pointer to its level
// byte in bank 7E (7E:3C1A). The level byte becomes the first argument of a task that the
// lifted task append 80:C34A (src/game/task-append.mjs) starts with the script; the long
// pointer stays in the direct page words A2 and A4 (bank 7E) as in the original, and the
// JSR's return word lies on the stack.
import { argumentWords, tasksOf } from '../script/task-api.mjs';
import {
  DP_SELECTION_POINTER,
  DP_SELECTION_POINTER_BANK,
  SELECTED_SPELL_LEVEL_POINTER,
  SELECTED_SPELL_SCRIPT,
  WRAM,
} from '../data/wram.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK } from '../constants/bits.mjs';

const DP_ARGUMENT = 0;

const wramWord = (mem, offset) => mem.read16((WRAM + offset) & LONG_MASK);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// 80:8EDA: start the selected spell's script with its level as the first argument; a is
// the accessor of the tasks. The return word of the append's call lies only in free stack
// bytes and is not reproduced (game state only, user decision 2026-11-17).
export function startSelectedSpell(mem, a) {
  const { wram } = mem,
    script = wramWord(mem, SELECTED_SPELL_SCRIPT),
    pointer = wramWord(mem, SELECTED_SPELL_LEVEL_POINTER);
  setWord(wram, DP_SELECTION_POINTER, pointer);
  setWord(wram, DP_SELECTION_POINTER_BANK, WRAM_BANK);
  setWord(wram, DP_ARGUMENT, mem.read8(WRAM + pointer));
  tasksOf(a).append(script, argumentWords(mem, script));
}
