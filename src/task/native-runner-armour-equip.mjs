import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import {
  GLOVE_TARGET_TAG,
  GLOVE_TARGET_OBJECT,
  PLAYER_OBJECT,
  MEMBER_INDEX,
  OBJECT_ARMOUR,
  OBJECT_NUMBER,
  RUNNER_ARMOUR,
  RUNNER_ARMOUR_RATING,
  WRAM,
} from './wram.mjs';
import { FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
import { WORD_SIGN } from '../constants/bits.mjs';

// Index of the member's equipment record: the member word index (MEMBER_INDEX) times
// four by two ASLs, eight bytes per runner. Shared with 80:8B9F.
export function indexMemberEquipment(h) {
  h.load(h.longRead(h.abs(MEMBER_INDEX)));
  h.asl();
  h.asl();
  return h.index('x', h.ctx.a);
}

// 80:8B16: equip the member shown in the menus (MEMBER_INDEX) with the armour item
// object (first argument) of rating (second argument): the runner record gets the
// item number and the rating byte, and the object under the glove, or the player
// object when none is under it, gets the rating.
export const equipRunnerArmour = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const runner = indexMemberEquipment(h),
        item = h.index('y', h.dp(FIRST_ARGUMENT));
      h.longWrite(WRAM + RUNNER_ARMOUR + runner, h.load(h.longRead(h.abs(OBJECT_NUMBER) + item)));
      h.load(h.dp(SECOND_ARGUMENT));
      h.ctx.status |= FLAG_MEMORY_8BIT;
      h.longWrite(WRAM + RUNNER_ARMOUR_RATING + runner, h.ctx.a, 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
      const tag = h.load(h.longRead(h.abs(GLOVE_TARGET_TAG))),
        wearer = h.index(
          'x',
          h.longRead(h.abs(tag & WORD_SIGN ? PLAYER_OBJECT : GLOVE_TARGET_OBJECT)),
        );
      h.longWrite(WRAM + OBJECT_ARMOUR + wearer, h.load(h.dp(SECOND_ARGUMENT)));
    },
    outerReturn,
  );
