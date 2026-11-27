// The lifted runner state bodies (src/game/runner-state.mjs) with the direct page values
// the original leaves, for the register-level call forms of 80:CECB and 80:D079 (moved
// from proof/replay/native-state-count-raise.mjs and native-runners-restore.mjs).
import { raiseStateCount, restoreRunners } from '../../src/game/runner-state.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT } from '../../src/system/native-leaf-support.mjs';
import {
  DP_REFILL_DOUBLE_MAGIC,
  DP_RESOURCE_MAX,
  DP_RESOURCE_RECORD,
  DP_RESOURCE_RECORD_BANK,
} from '../../src/data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../../src/constants/bits.mjs';

const dpWord = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setDpWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// 80:CECB: the member record pointer at the maximum and the maximum.
export function raiseStateCountBody(h) {
  const { mem } = h.a,
    { wram } = mem,
    { record, max } = raiseStateCount(
      mem,
      dpWord(wram, FIRST_ARGUMENT),
      dpWord(wram, SECOND_ARGUMENT),
    );
  setDpWord(wram, DP_RESOURCE_RECORD, record & WORD_MASK);
  wram[DP_RESOURCE_RECORD_BANK] = record >>> WORD_BITS;
  setDpWord(wram, DP_RESOURCE_MAX, max);
}
// 80:D079: the first row's record pointer and the last refilled magic attribute doubled.
export function restoreRunnersBody(h) {
  const { mem } = h.a,
    { wram } = mem,
    { record, doubleMagic } = restoreRunners(mem);
  setDpWord(wram, DP_RESOURCE_RECORD, record & WORD_MASK);
  wram[DP_RESOURCE_RECORD_BANK] = record >>> WORD_BITS;
  if (doubleMagic !== undefined) wram[DP_REFILL_DOUBLE_MAGIC] = doubleMagic;
}
