// Register-level references of the equipment natives 80:8B16 (armour), 80:8B9F (weapon),
// 80:9D15 and 80:9CE4 (an item's property word, taking it off its runner), moved from
// src/task/native-runner-armour-equip.mjs, native-runner-weapon-equip.mjs,
// native-object-record-property-equip.mjs and native-record-property-equip.mjs; lifted in
// src/game/runner-equipment.mjs. The proof plans, the Native58 dispatch of
// proof/task/native-dispatch.mjs and the instruction tests run these; the game runs the
// lifted natives.
import { taskStop } from '../../src/task/plan.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from '../../src/task/native-leaf-support.mjs';
import { taskSelectionSupport } from '../../src/task/native-object-turn.mjs';
import {
  RUNNER_DEFAULT_ARMOUR,
  RUNNER_DEFAULT_ARMOUR_RATING,
  RUNNER_DEFAULT_WEAPON,
  RUNNER_DEFAULT_WEAPON_KIND_DAMAGE,
  RUNNER_DEFAULT_WEAPON_RANGE,
  RUNNER_EQUIPMENT_SCAN_START,
  RUNNER_EQUIPMENT_BYTES,
} from '../../src/data/runners.mjs';
import { fixesEnabled, restoreDefaultWeapon } from '../../src/game/bugfixes.mjs';
import {
  GLOVE_TARGET_TAG,
  GLOVE_TARGET_OBJECT,
  PLAYER_OBJECT,
  MEMBER_INDEX,
  OBJECT_ARMOUR,
  OBJECT_NUMBER,
  OBJECT_RECORD,
  RUNNER_ARMOUR,
  RUNNER_ARMOUR_RATING,
  RUNNER_WEAPON,
  RUNNER_WEAPON_KIND,
  RUNNER_WEAPON_DAMAGE,
  RUNNER_WEAPON_RANGE,
  RECORD_PROPERTY,
  DP_EQUIP_WEAPON_KIND,
  DP_EQUIP_WEAPON_DAMAGE,
  DP_EQUIP_WEAPON_RANGE,
  WRAM,
} from '../../src/task/wram.mjs';
import {
  FLAG_CARRY,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';
import { BYTE_MASK, LONG_MASK, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';

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
export const equipRunnerArmourReference = (a, outerReturn = true) =>
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
// 80:8B9F: equip the member shown in the menus (MEMBER_INDEX) with the weapon item
// object (first argument): the runner record gets the item number, then the low bytes
// of the second to fourth argument as kind, damage and range.
export const equipRunnerWeaponReference = (a, outerReturn = true) =>
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
// 80:9D15: set the property word of the record of the item object (first argument) to
// the second argument and take the item off any runner who has it equipped, giving
// that runner the default armour or weapon again. Without a record nothing changes.
// The record gets DP02 at 7E0003+record. Then its number
// 150A+Y is searched in the equipment table 7E3C2E/7E3C31 (8 bytes per entry, X from 68 down by 8): a match
// at 3C2E takes the ROM entry 97A9+X (WORD) and 97AB+X (BYTE to 3C30), a match at 3C31 the word 97AC+X to
// 3C31 and 3C33 and its low byte to 3C35. The original's STA $97AE,X and STA $97B0,X (probably meant as
// LDA) write to the ROM and have no effect on the hardware; the equation leaves them out (src/vm/memory.mjs).
export const setItemPropertyAndUnequipReference = (a, outerReturn = true) =>
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
export const setActorItemPropertyAndUnequipReference = (a, outerReturn = true) =>
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
