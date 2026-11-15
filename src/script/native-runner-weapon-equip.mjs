import { FIRST_ARGUMENT, finishLeaf, leafArgument } from '../system/native-leaf-support.mjs';
import { equipWeapon } from '../game/runner-equipment.mjs';
import {
  DP_EQUIP_WEAPON_KIND,
  DP_EQUIP_WEAPON_DAMAGE,
  DP_EQUIP_WEAPON_RANGE,
} from '../data/wram.mjs';

// 80:8B9F (lifted in src/game/runner-equipment.mjs; register-level reference in
// proof/game-reference/runner-equipment.mjs): equip the member shown in the menus with
// the weapon item object (first argument); the low bytes of the second to fourth
// argument are its kind, damage and range.
export const equipRunnerWeapon = (a, outerReturn = true) => {
  const { wram } = a.mem;
  equipWeapon(
    a.mem,
    leafArgument(a, FIRST_ARGUMENT),
    wram[DP_EQUIP_WEAPON_KIND],
    wram[DP_EQUIP_WEAPON_DAMAGE],
    wram[DP_EQUIP_WEAPON_RANGE],
  );
  return finishLeaf(a, outerReturn);
};
