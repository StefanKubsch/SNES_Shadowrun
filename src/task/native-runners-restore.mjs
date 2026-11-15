import { restoreRunners } from '../game/runner-state.mjs';

import { DP_RESOURCE_RECORD, DP_RESOURCE_RECORD_BANK, DP_REFILL_DOUBLE_MAGIC } from './wram.mjs';

import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// 80:D079 (lifted body in src/game/runner-state.mjs; register-level reference in
// proof/game-reference/runner-state.mjs; no argument, no result): restore every runner. For the runner entries X = 18
// down to 0 (PHX, JSR D08A, PLX) the magic points and the state count are refilled, then
// JSL 81:AD92 draws the window list. D08A: pointer [6B] = member record + 1 (Magic); the
// runner's object number gives its object record (0: nothing); the magic points 7E3C96+X/2
// get ten times the BYTE [6B] (BYTE arithmetic), the record's state count BYTE the BYTE
// [6B+4] (record byte 5, the state count maximum).
const setDpWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// The lifted body (src/game/runner-state.mjs) with the direct page values the original
// leaves: the first row's record pointer and the last refilled magic attribute doubled.
export function restoreRunnersBody(h) {
  const { mem } = h.a,
    { wram } = mem,
    { record, doubleMagic } = restoreRunners(mem);
  setDpWord(wram, DP_RESOURCE_RECORD, record & WORD_MASK);
  wram[DP_RESOURCE_RECORD_BANK] = record >>> WORD_BITS;
  if (doubleMagic !== undefined) wram[DP_REFILL_DOUBLE_MAGIC] = doubleMagic;
}
