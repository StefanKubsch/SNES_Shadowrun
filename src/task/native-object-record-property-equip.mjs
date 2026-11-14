import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import {
  RUNNER_DEFAULT_ARMOUR,
  RUNNER_DEFAULT_ARMOUR_RATING,
  RUNNER_DEFAULT_WEAPON,
  RUNNER_EQUIPMENT_SCAN_START,
  RUNNER_EQUIPMENT_BYTES,
} from '../data/runners.mjs';
import { taskSelectionSupport } from './native-object-turn.mjs';
import { fixesEnabled, restoreDefaultWeapon } from '../game/bugfixes.mjs';
import {
  OBJECT_NUMBER,
  OBJECT_RECORD,
  RUNNER_ARMOUR,
  RUNNER_ARMOUR_RATING,
  RUNNER_WEAPON,
  RUNNER_WEAPON_KIND,
  RUNNER_WEAPON_RANGE,
  RECORD_PROPERTY,
  WRAM,
} from './wram.mjs';
import { LONG_MASK, BYTE_MASK } from '../constants/bits.mjs';
import { FLAG_ZERO, FLAG_CARRY, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
// 80:9D15: set the property word of the record of the item object (first argument) to
// the second argument and take the item off any runner who has it equipped, giving
// that runner the default armour or weapon again. Without a record nothing changes.
// The record gets DP02 at 7E0003+record. Then its number
// 150A+Y is searched in the equipment table 7E3C2E/7E3C31 (8 bytes per entry, X from 68 down by 8): a match
// at 3C2E takes the ROM entry 97A9+X (WORD) and 97AB+X (BYTE to 3C30), a match at 3C31 the word 97AC+X to
// 3C31 and 3C33 and its low byte to 3C35. The original's STA $97AE,X and STA $97B0,X (probably meant as
// LDA) write to the ROM and have no effect on the hardware; the equation leaves them out (src/vm/memory.mjs).
export const setItemPropertyAndUnequip = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const k = taskSelectionSupport(h),
        { ctx } = h,
        rom = (offset) => h.longRead(h.abs(offset) + ctx.x);
      h.index('y', h.dp(FIRST_ARGUMENT));
      h.index('x', h.longRead(h.abs(OBJECT_RECORD) + ctx.y));
      if (ctx.status & FLAG_ZERO) return;
      h.load(h.dp(2));
      h.longWrite(WRAM + RECORD_PROPERTY + ctx.x, ctx.a);
      h.index('x', RUNNER_EQUIPMENT_SCAN_START);
      for (;;) {
        h.load(h.longRead(h.abs(OBJECT_NUMBER) + ctx.y));
        k.compare(ctx.a, h.longRead(WRAM + RUNNER_ARMOUR + ctx.x));
        if (ctx.status & FLAG_ZERO) {
          h.load(rom(RUNNER_DEFAULT_ARMOUR));
          h.longWrite(WRAM + RUNNER_ARMOUR + ctx.x, ctx.a);
          h.load(
            a.read((h.abs(RUNNER_DEFAULT_ARMOUR_RATING) + ctx.x) & LONG_MASK, '9d15-97AB-BYTE'),
            1,
          );
          a.write(WRAM + RUNNER_ARMOUR_RATING + ctx.x, ctx.a & BYTE_MASK, '9d15-3C30-BYTE');
          return;
        }
        k.compare(ctx.a, h.longRead(WRAM + RUNNER_WEAPON + ctx.x));
        if (ctx.status & FLAG_ZERO) {
          if (fixesEnabled(a)) {
            restoreDefaultWeapon(h);
            return;
          }
          h.load(rom(RUNNER_DEFAULT_WEAPON));
          h.longWrite(WRAM + RUNNER_WEAPON + ctx.x, ctx.a);
          h.longWrite(WRAM + RUNNER_WEAPON_KIND + ctx.x, ctx.a);
          a.write(WRAM + RUNNER_WEAPON_RANGE + ctx.x, ctx.a & BYTE_MASK, '9d15-3C35-BYTE');
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
