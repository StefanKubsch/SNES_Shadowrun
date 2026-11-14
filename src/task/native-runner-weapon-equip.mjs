import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { indexMemberEquipment } from './native-runner-armour-equip.mjs';
import {
  OBJECT_NUMBER,
  RUNNER_WEAPON,
  RUNNER_WEAPON_KIND,
  RUNNER_WEAPON_DAMAGE,
  RUNNER_WEAPON_RANGE,
  DP_EQUIP_WEAPON_KIND,
  DP_EQUIP_WEAPON_DAMAGE,
  DP_EQUIP_WEAPON_RANGE,
  WRAM,
} from './wram.mjs';
import { FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

// 80:8B9F: equip the member shown in the menus (MEMBER_INDEX) with the weapon item
// object (first argument): the runner record gets the item number, then the low bytes
// of the second to fourth argument as kind, damage and range.
export const equipRunnerWeapon = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const runner = indexMemberEquipment(h),
        item = h.index('y', h.dp(FIRST_ARGUMENT));
      h.longWrite(WRAM + RUNNER_WEAPON + runner, h.load(h.longRead(h.abs(OBJECT_NUMBER) + item)));
      h.ctx.status |= FLAG_MEMORY_8BIT;
      for (const [argument, field] of [
        [DP_EQUIP_WEAPON_KIND, RUNNER_WEAPON_KIND],
        [DP_EQUIP_WEAPON_DAMAGE, RUNNER_WEAPON_DAMAGE],
        [DP_EQUIP_WEAPON_RANGE, RUNNER_WEAPON_RANGE],
      ])
        h.longWrite(WRAM + field + runner, h.load(h.dp(argument, 1), 1), 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
