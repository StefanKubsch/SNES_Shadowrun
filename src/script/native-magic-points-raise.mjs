import { writeStateByte } from '../state/objects.mjs';
import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from '../system/native-leaf-support.mjs';
import { raiseMagicPoints } from '../game/runner-state.mjs';
import {
  DP_RESOURCE_DOUBLE_MAGIC,
  DP_RESOURCE_MAX,
  DP_RESOURCE_RECORD_BANK,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

// 80:CF2E (lifted body in src/game/runner-state.mjs; register-level reference in
// proof/game-reference/runner-state.mjs; first argument the object, second the amount,
// no result): raise a member's magic points, at most ten times its magic attribute.
const setDpWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
// The lifted body with the direct page values the original leaves: the record
// pointer's bank, twice the magic attribute over the pointer's word, and the maximum.
// Game state only (user decision 2026-11-17): it leaves no registers.
function raiseMagicPointsBody(mem, object, amount) {
  const { wram } = mem,
    { bank, doubleMagic, max } = raiseMagicPoints(mem, object, amount);
  writeStateByte(wram, DP_RESOURCE_RECORD_BANK, bank);
  setDpWord(wram, DP_RESOURCE_DOUBLE_MAGIC, doubleMagic);
  setDpWord(wram, DP_RESOURCE_MAX, max);
}
// The raise for lifted callers, without the JSR frame and its RTS.
export const raiseMemberMagicPointsInPlace = (a) =>
  raiseMagicPointsBody(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
export const raiseMemberMagicPoints = (a) => {
  raiseMemberMagicPointsInPlace(a);
  return finishLeaf(a);
};
