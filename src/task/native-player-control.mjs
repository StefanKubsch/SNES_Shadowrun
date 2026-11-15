import { PAD_A, PAD_B, PAD_X, PAD_L, PAD_R } from './wram.mjs';

// DEC7: the pad directions index pad_directions 80:DF4B (10: none), turned by the camera
// rotation word in SRAM and masked to the even directions, then walk_step_x/y DF27/DF39
// (src/data/tables.mjs).
export const PAD_DIRECTION_TABLE = 0xdf4b,
  WALK_STEP_X = 0xdf27,
  WALK_STEP_Y = 0xdf39,
  NO_DIRECTION = 0x10,
  DIRECTION_MASK = 0x0e,
  CAMERA_ROTATION_SRAM = 0x701ffd;

// A985 actions of E014 (DP02): idle 0, walking 2, spell 3, crosshair 4 or 7 for a weapon
// damage of 7 on (7E:3C34, the byte after RUNNER_WEAPON_KIND).
export const WALK_ACTION = 2,
  SPELL_ACTION = 3,
  AIM_ACTION = 4,
  HEAVY_AIM_ACTION = 7,
  HEAVY_WEAPON_DAMAGE = 7;

// BC36 and DF6B project an object position to the screen: BC36 puts the glove over the
// player, DF6B compares the glove with the player (four shifts scale the pixels back).
export const GLOVE_FACING = Object.freeze({
  yBase: 0x0bec,
  yOffset: 0x40,
  xBase: 0x05ec,
  shift: 4,
});

// DF6B direct page: glove X/4 and Y/4, the signs (nonzero: negative) and sizes of the
// differences, and the facing direction [if the sign is set, if it is zero] for a mostly
// vertical, mostly horizontal or diagonal difference (by the sign of X).
export const DP_FACING_GLOVE_X = 0x1a,
  DP_FACING_GLOVE_Y = 0x1d,
  DP_FACING_SIGN_X = 0x14,
  DP_FACING_SIGN_Y = 0x17,
  DP_FACING_SIZE_X = 0x0e,
  DP_FACING_SIZE_Y = 0x11;

export const FACING_DIRECTIONS = Object.freeze({
  vertical: [5, 1],
  horizontal: [7, 3],
  diagonalPositiveX: [4, 2],
  diagonalNegativeX: [6, 0],
});

// The spell glove aims with both buttons for Summon spirit (spell_scripts_b entry 4).
export const SUMMON_SPIRIT_SCRIPT = 0x01ec;

// E014 buttons.
export const GLOVE_BUTTONS = PAD_B | PAD_A | PAD_X | PAD_L | PAD_R,
  RELEASE_BUTTONS = PAD_B | PAD_L | PAD_R,
  AIM_BUTTONS = PAD_A | PAD_X;

// E014 notices 02/17 with three rows: "You are not armed yet!" and "No spell selected!".
export const NOTICE_WINDOW = Object.freeze({ left: 2, top: 0x17, rows: 3 }),
  WEAPON_NOTICE = Object.freeze({ columns: 0x12, text: 0x753e }),
  SPELL_NOTICE = Object.freeze({ columns: 0x0f, text: 0x7479 });
