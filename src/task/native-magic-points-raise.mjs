import { leaf, FIRST_ARGUMENT, SECOND_ARGUMENT } from './native-leaf-support.mjs';
import { raiseMagicPoints } from '../game/runner-state.mjs';
import { DP_RESOURCE_DOUBLE_MAGIC, DP_RESOURCE_MAX, DP_RESOURCE_RECORD_BANK } from './wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

// 80:CF2E (lifted body in src/game/runner-state.mjs; register-level reference in
// proof/game-reference/runner-state.mjs; first argument the object, second the amount,
// no result): raise a member's magic points, at most ten times its magic attribute.
const dpWord = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setDpWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// The lifted body with the direct page values the original leaves: the record
// pointer's bank, twice the magic attribute over the pointer's word, and the maximum.
export function raiseMagicPointsBody(mem) {
  const { wram } = mem,
    { bank, doubleMagic, max } = raiseMagicPoints(
      mem,
      dpWord(wram, FIRST_ARGUMENT),
      dpWord(wram, SECOND_ARGUMENT),
    );
  wram[DP_RESOURCE_RECORD_BANK] = bank;
  setDpWord(wram, DP_RESOURCE_DOUBLE_MAGIC, doubleMagic);
  setDpWord(wram, DP_RESOURCE_MAX, max);
}
export const raiseMemberMagicPoints = (a, outerReturn = true) =>
  leaf(a, () => raiseMagicPointsBody(a.mem), outerReturn);
