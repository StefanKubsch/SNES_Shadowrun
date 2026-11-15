import { RUNNER_WEAPON_KIND } from './wram.mjs';

import { BYTE_MASK, BANK_SIZE } from '../constants/bits.mjs';

// Shot parameters of 8AB5 (DP04 hit bonus, DP06 kind, DP08 damage, DP0A range penalty) and
// their working copies: the bonus of the close kinds (also lowered by 8A43), of kind 5 and
// of the ranged kinds, the weapon kind, damage and signed range penalty.
export const DP_SHOT_BONUS = 4,
  DP_SHOT_KIND = 6,
  DP_SHOT_DAMAGE = 8,
  DP_SHOT_PENALTY = 0x0a,
  DP_BONUS_CLOSE = 0xab,
  DP_BONUS_KIND_5 = 0xae,
  DP_BONUS_RANGED = 0xb1,
  DP_WEAPON_KIND = 0xa2,
  DP_WEAPON_DAMAGE = 0xa5,
  DP_WEAPON_PENALTY = 0xa8;

// 8904: kinds below 4 and kind 6 roll without a range check; kind 5 adds half its bonus to
// the damage. The roll draws C51F below 8; the ranged kinds miss from 40 on any axis.
export const CLOSE_KIND_LIMIT = 4,
  CLOSE_KIND = 6,
  DAMAGE_BONUS_KIND = 5,
  HIT_ROLL_SIDES = 8,
  HIT_ROLL_OFFSET = 2,
  DAMAGE_BONUS_ROLL_OFFSET = 3,
  RANGED_REACH = 0x40;

// 8497: sign flags and magnitudes of the target offset; the eight facings by the signs of
// the dominant axis or of both axes (minus: target coordinate below the shooter's).
export const DP_MINUS_X = 0xc0,
  DP_MINUS_Y = 0xc3,
  DP_OFFSET_X = 0xba,
  DP_OFFSET_Y = 0xbd,
  FACING = Object.freeze({
    y: 0,
    xy: 1,
    x: 2,
    xMinusY: 3,
    minusY: 4,
    minusXMinusY: 5,
    minusX: 6,
    minusXY: 7,
  });

// 89B0: a miss places object E6 (script 80) at a random spot near the target: height below
// (box height + 0A) * 4 above the target, one of eight offsets of the tables 80:8A23/8A33,
// facing from 80:8A13 by the shooter's direction.
export const MISS_KIND = 0xe6,
  MISS_SCRIPT = 0x80,
  MISS_HEIGHT_RAISE = 0x0a,
  MISS_SPOTS = 8,
  MISS_OFFSETS_X = 0x8a23,
  MISS_OFFSETS_Y = 0x8a33,
  MISS_FACINGS = 0x8a13;

// 8860: the weapon owners 80:9700 (13 words, searched from X = 1A down), the record pointers
// 80:971A/9734 with the bonus bytes 6 (close), 7 (kind 5) and 8 (ranged, halved and rounded
// up). Shot sounds C, 40 and E for the kinds 0, 1 and 6, played by 88EB at level FF on
// voices FF.
export const WEAPON_OWNERS = 0x9700,
  WEAPON_OWNERS_END = 0x1a,
  WEAPON_RECORDS = 0x971a,
  WEAPON_RECORD_BANKS = 0x9734,
  DP_WEAPON_RECORD = 0xab,
  DP_WEAPON_RECORD_BANK = 0xad,
  RECORD_BONUS_CLOSE = 6,
  RECORD_BONUS_KIND_5 = 7,
  RECORD_BONUS_RANGED = 8,
  WEAPON_DAMAGE = RUNNER_WEAPON_KIND + 1,
  WEAPON_SEARCH_LIMIT = BANK_SIZE / 2,
  SHOT_SOUND_KIND_0 = 0x0c,
  SHOT_SOUND_KIND_1 = 0x40,
  SHOT_SOUND_KIND_6 = 0x0e,
  SHOT_SOUND_LEVEL_VOICES = BYTE_MASK;
