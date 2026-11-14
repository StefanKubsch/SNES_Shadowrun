import { taskStop } from './plan.mjs';
import { leaf } from './native-leaf-support.mjs';
import {
  RUNNER_DEFAULT_ARMOUR,
  RUNNER_DEFAULT_ARMOUR_RATING,
  RUNNER_DEFAULT_WEAPON,
  RUNNER_DEFAULT_WEAPON_KIND_DAMAGE,
  RUNNER_DEFAULT_WEAPON_RANGE,
  RUNNER_EQUIPMENT_SCAN_START,
  RUNNER_EQUIPMENT_BYTES,
} from '../data/runners.mjs';
import { fixesEnabled, restoreDefaultWeapon } from '../game/bugfixes.mjs';
import {
  RUNNER_ARMOUR,
  RUNNER_ARMOUR_RATING,
  RUNNER_WEAPON,
  RUNNER_WEAPON_KIND,
  RUNNER_WEAPON_RANGE,
  RECORD_PROPERTY,
  WRAM,
} from './wram.mjs';
import { FLAG_CARRY, FLAG_ZERO, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
import { WORD_MASK, LONG_MASK, BYTE_MASK } from '../constants/bits.mjs';
// 80:9CE4: as 80:9D15 for an actor entry: set the property word of the state record of
// the item's actor entry (first argument) to the second argument and take the item off
// any runner who has it equipped. Record 8D:B020+DP00 (0: nothing) gets DP02 at
// 7E0003+record; then DP00 is searched in the
// equipment table 7E3C2E/7E3C31 (X = 68 down by 8, SBC/BPL) and a match copies the ROM entry over the real
// JSR 9D3D (97A9 WORD, 97AB BYTE to 3C30) or 9D50 (97AC to 3C31 and 3C33, its low byte to 3C35). 9D50 also
// stores to actualDBR 97AE/97B0+X: with DBR 80 these are ROM writes without effect (src/vm/memory.mjs), they
// stay in the equation as accesses.
const EQUIP_ARMOUR_RETURN_WORD = 0x9d0f;
const EQUIP_WEAPON_RETURN_WORD = 0x9d13;
const call = (h, returnWord, run) => {
  h.a.pushWord(returnWord, '9CE4-JSR');
  run();
  const actual = h.a.pullWord('9CE4-RTS');
  if (actual !== returnWord)
    taskStop('task_native_helper_return_required', { actual, expected: returnWord });
  h.ctx.pc = (actual + 1) & WORD_MASK;
};
export const setActorItemPropertyAndUnequip = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        compare = (left, right) => {
          h.nz((left - right) & WORD_MASK);
          ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
        };
      const rom = (offset) => h.longRead(h.abs(offset) + ctx.x);
      h.index('x', h.dp(0));
      h.index('y', ctx.x);
      h.load(h.longRead(0x8db020 + ctx.x));
      if (ctx.status & FLAG_ZERO) return;
      h.index('x', ctx.a);
      h.load(h.dp(2));
      h.longWrite(WRAM + RECORD_PROPERTY + ctx.x, ctx.a);
      h.index('x', RUNNER_EQUIPMENT_SCAN_START);
      for (;;) {
        h.load(ctx.y);
        compare(ctx.a, h.longRead(WRAM + RUNNER_ARMOUR + ctx.x));
        if (ctx.status & FLAG_ZERO) {
          call(h, EQUIP_ARMOUR_RETURN_WORD, () => {
            h.load(rom(RUNNER_DEFAULT_ARMOUR));
            h.longWrite(WRAM + RUNNER_ARMOUR + ctx.x, ctx.a);
            h.load(
              a.read((h.abs(RUNNER_DEFAULT_ARMOUR_RATING) + ctx.x) & LONG_MASK, '9d3d-97AB-BYTE'),
              1,
            );
            a.write(WRAM + RUNNER_ARMOUR_RATING + ctx.x, ctx.a & BYTE_MASK, '9d3d-3C30-BYTE');
          });
          return;
        }
        compare(ctx.a, h.longRead(WRAM + RUNNER_WEAPON + ctx.x));
        if (ctx.status & FLAG_ZERO) {
          call(h, EQUIP_WEAPON_RETURN_WORD, () => {
            if (fixesEnabled(a)) {
              restoreDefaultWeapon(h);
              return;
            }
            h.load(rom(RUNNER_DEFAULT_WEAPON));
            h.longWrite(WRAM + RUNNER_WEAPON + ctx.x, ctx.a);
            h.longWrite(h.abs(RUNNER_DEFAULT_WEAPON_KIND_DAMAGE) + ctx.x, ctx.a);
            h.longWrite(WRAM + RUNNER_WEAPON_KIND + ctx.x, ctx.a);
            a.write(
              (h.abs(RUNNER_DEFAULT_WEAPON_RANGE) + ctx.x) & LONG_MASK,
              ctx.a & BYTE_MASK,
              '9d50-97B0-BYTE',
            );
            a.write(WRAM + RUNNER_WEAPON_RANGE + ctx.x, ctx.a & BYTE_MASK, '9d50-3C35-BYTE');
          });
          return;
        }
        h.load(ctx.x);
        ctx.status |= FLAG_CARRY;
        h.arithmetic(RUNNER_EQUIPMENT_BYTES, true);
        h.index('x', ctx.a);
        if (ctx.status & FLAG_NEGATIVE) return;
      }
    },
    outerReturn,
  );
