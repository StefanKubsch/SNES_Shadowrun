import { readStateByte, writeStateByte } from '../state/objects.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT } from '../system/native-leaf-support.mjs';

import { raiseStateCount } from '../game/runner-state.mjs';

import { DP_RESOURCE_RECORD, DP_RESOURCE_RECORD_BANK, DP_RESOURCE_MAX } from '../data/wram.mjs';

import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// 80:CECB (lifted body in src/game/runner-state.mjs; register-level reference in
// proof/game-reference/runner-state.mjs; first argument the object, second the amount, no result): raise a member's state
// count. The object number of the object is searched in the group numbers from the last
// index down by 2; without a match the player object is searched instead (without a match
// again the original loops forever: boundary). The runner entry of the number (X from 18
// down by 2, without a match FFFE) gives the member record; its byte 5 is the maximum DP04.
// An object record gets its state count BYTE + the amount, at most DP04. Then JSL 81:AD92
// redraws the window list, RTS.
const dpWord = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);

const setDpWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// The lifted body (src/game/runner-state.mjs) with the direct page values the original
// leaves: the member record pointer at the maximum and the maximum.
export function raiseStateCountBody(h) {
  const { mem } = h.a,
    { wram } = mem,
    { record, max } = raiseStateCount(
      mem,
      dpWord(wram, FIRST_ARGUMENT),
      dpWord(wram, SECOND_ARGUMENT),
    );
  setDpWord(wram, DP_RESOURCE_RECORD, record & WORD_MASK);
  writeStateByte(wram, DP_RESOURCE_RECORD_BANK, record >>> WORD_BITS);
  setDpWord(wram, DP_RESOURCE_MAX, max);
}
