import { withInterruptEvents } from './observed-native-events.mjs';
import { taskStop } from './plan.mjs';
import { fitListWindow } from '../data/menu-layout.mjs';
import { leafAccess, finishLeaf } from './native-leaf-support.mjs';
import {
  observedContinuation,
  drainNativeSequence,
  dialogCallSequence,
  dialogCallBody,
} from './native-call-continuation.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { taskSelectionSupport } from './native-object-turn.mjs';
import {
  applyGloveLimits,
  GLOVE_LIMITS,
  GLOVE_OVER_PLAYER,
} from './native-glove-crosshair-limits.mjs';
import { setObjectAnimation } from './native-object-action-apply.mjs';
import { setObjectDirection } from './native-object-action-set.mjs';
import {
  STATUS_SCREEN_ROUTINES,
  statusRoutineSequence,
  TEXT_SLASH,
} from './native-status-screen.mjs';
import { validateDialogTaskOptions } from './native-dialog.mjs';

import {
  CAMERA_X,
  CAMERA_Y,
  GLOVE_KIND,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  GROUP_INDEX,
  GROUP_NUMBERS,
  MAGIC_POINTS,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_X,
  OBJECT_Y,
  PAD_HELD,
  PAD_PRESSED,
  PLAYER_OBJECT,
  RUNNER_WEAPON,
  WRAM,
  MEMBER_INDEX,
  OBJECT_RECORD,
  OBJECT_DIAGONAL,
  GLOVE_X,
  GLOVE_Y,
  PAD_A,
  PAD_B,
  PAD_X,
  PAD_Y,
  PAD_L,
  PAD_R,
  PAD_SELECT,
  PAD_START,
  PAD_DIRECTIONS,
  PLAYER_IDLE,
  AIMING_WEAPON,
  AIMING_SPELL,
  AIM_TARGET_OBJECT,
  AIM_ACTION_NEXT,
  GROUP_LEADER_ONLY,
  GROUP_SLOTS,
  RUNNER_WEAPON_KIND,
  SELECTED_SPELL_SCRIPT,
  STATUS_WINDOW,
  MEMBER_STATE_COUNT,
  DP_WINDOW_LEFT,
  DP_WINDOW_TOP,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_CURSOR_ROW,
  DP_MEMBER_RECORD,
  DP_MEMBER_RECORD_BANK,
} from './wram.mjs';
import {
  RUNNER_OBJECT_NUMBERS,
  RUNNER_RECORD_POINTERS,
  RUNNER_RECORD_BANKS,
  RUNNER_NAMES,
  RUNNER_LAST_INDEX,
  RECORD_MAGIC,
  RECORD_COUNT_MAX,
} from '../data/runners.mjs';
import { STATE_COUNT } from '../data/actors.mjs';
import { WORD_MASK, BYTE_BITS, BYTE_MASK, LONG_WRAP, BANK_WRAP } from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_MEMORY_8BIT,
  FLAG_INDEX_8BIT,
} from '../constants/cpu-flags.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';

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
// ED3C party status: window 01/01/1E with five rows plus one per two members ("PARTY
// STATUS" text 74F9); per member the name, state count / maximum and magic points / maximum
// in columns 0, 0B, 0E, 14 and 17, the first member in row 2.
const PARTY_WINDOW = Object.freeze({ left: 1, top: 1, columns: 0x1e, baseRows: 5 }),
  TEXT_PARTY_STATUS = 0x74f9,
  PARTY_COLUMNS = Object.freeze({
    count: 0x0b,
    countSlash: 0x0e,
    magic: 0x14,
    magicSlash: 0x17,
  });
const DP_PARTY_MEMBER = 0x0e,
  DP_PARTY_NAME = 0x0a,
  DP_MAGIC_MAXIMUM = 8;
// 80:E014: control the player for one frame (DP00 = leader 0CC2 at the start, result DP00). Select shows the group
// overview ED3C, Start the status screen (EA89, object under the glove or leader), Y its item list at once
// (EA8E). Without a glove: no button but the pad turns the leader (DEC7); A takes the crosshair (BC80, weapon
// 7E3C31 needed, else the notice 753E), X the spell glove (BC99, spell 7E3C13 needed, else the notice 7479),
// B/L/R the action glove (BC67); then A985. With the glove: DF6B turns the leader towards it; while aiming
// (1D5D/1D5F) a held A/X returns the target in DP00 (E13E), B/L/R ends aiming (A985 with 0) and the glove (BCB2);
// without aiming A/X or B/L/R without a tagged object switch the glove off. Every other path ends with STZ DP00.
// The equations of DEC7, BC36, the glove limits and DF6B were checked against Mesen2 before (oracle phase);
// their calls of A985/AAAF go through the routine table like every other call.

function support(h) {
  const { ctx } = h;
  const lsr = () => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | (ctx.a & 1);
    h.load(ctx.a >>> 1);
  };
  const xba = () => {
    const swapped = ((ctx.a >>> BYTE_BITS) | (ctx.a << BYTE_BITS)) & WORD_MASK;
    ctx.a = swapped;
    h.nz(swapped & BYTE_MASK, 1);
  };
  const negate = () => {
    h.load(ctx.a ^ WORD_MASK);
    h.load((ctx.a + 1) & WORD_MASK);
  };
  return { lsr, xba, negate };
}

// $DEC7: facing direction from the D-pad ($01CA bits 8-11) via the table $DF4B,
// relative to the camera rotation $70:1FFD (SRAM), result in $0D20/$0D78,Y.
function runFacingFromPad(h, k, jsr) {
  const { a, ctx } = h,
    { lsr, xba } = support(h);
  h.load(h.longRead(h.abs(PAD_HELD)));
  h.load(ctx.a & PAD_DIRECTIONS);
  xba();
  h.asl();
  h.index('x', ctx.a);
  h.load(h.longRead(h.abs(PAD_DIRECTION_TABLE) + ctx.x));
  k.compare(ctx.a, NO_DIRECTION);
  if (!(ctx.status & FLAG_CARRY)) {
    const rotation = () => a.readWord(CAMERA_ROTATION_SRAM, LONG_WRAP, 'dec7-camera-SRAM-WORD');
    ctx.status |= FLAG_CARRY;
    h.arithmetic(rotation(), true);
    ctx.status |= FLAG_CARRY;
    h.arithmetic(rotation(), true);
    h.load(ctx.a & DIRECTION_MASK);
  }
  h.index('x', ctx.a);
  h.load(h.longRead(h.abs(WALK_STEP_X) + ctx.x));
  h.longWrite(h.abs(OBJECT_VELOCITY_X) + ctx.y, ctx.a);
  h.load(h.longRead(h.abs(WALK_STEP_Y) + ctx.x));
  h.longWrite(h.abs(OBJECT_VELOCITY_Y) + ctx.y, ctx.a);
  k.compare(ctx.x, NO_DIRECTION);
  if (ctx.status & FLAG_ZERO) {
    // No direction: set $A985 once with DP02 = 0 and flag $1D5B.
    h.load(h.longRead(h.abs(PLAYER_IDLE)));
    if (!(ctx.status & FLAG_ZERO)) return;
    a.writeWord(2, 0, BANK_WRAP, 'dec7-DP02');
    jsr(0x80defe, 0x80a985);
    h.load(WORD_MASK);
    h.longWrite(h.abs(PLAYER_IDLE), ctx.a);
    return;
  }
  a.pushWord(ctx.x, 'dec7-PHX');
  h.load(h.longRead(h.abs(PLAYER_IDLE)));
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(WALK_ACTION);
    a.writeWord(2, ctx.a, BANK_WRAP, 'dec7-DP02');
    jsr(0x80df14, 0x80a985);
    h.longWrite(h.abs(PLAYER_IDLE), 0);
  }
  h.load(a.pullWord('dec7-PLA'));
  lsr();
  a.writeWord(2, ctx.a, BANK_WRAP, 'dec7-DP02');
  h.index('y', h.longRead(h.abs(PLAYER_OBJECT)));
  a.writeWord(0, ctx.y, BANK_WRAP, 'dec7-DP00');
  jsr(0x80df23, 0x80aaaf);
}

// $BC36: put the glove over the player figure ($01D4/$01D6 from position and camera).
function runGloveOverPlayer(h) {
  const { ctx } = h,
    { lsr, xba } = support(h),
    field = (offset) => h.longRead(h.abs(offset) + ctx.y);
  h.index('y', h.longRead(h.abs(PLAYER_OBJECT)));
  ctx.status |= FLAG_CARRY;
  h.load(GLOVE_OVER_PLAYER.yBase);
  for (const right of [
    field(OBJECT_DIAGONAL),
    field(OBJECT_HEIGHT),
    h.longRead(h.abs(CAMERA_Y)),
    GLOVE_OVER_PLAYER.yOffset,
  ])
    h.arithmetic(right, true);
  lsr();
  lsr();
  xba();
  h.longWrite(h.abs(GLOVE_Y), ctx.a);
  ctx.status &= ~FLAG_CARRY;
  h.load(GLOVE_OVER_PLAYER.xBase);
  h.arithmetic(field(OBJECT_Y));
  ctx.status |= FLAG_CARRY;
  for (const right of [field(OBJECT_X), h.longRead(h.abs(CAMERA_X)), GLOVE_OVER_PLAYER.xOffset])
    h.arithmetic(right, true);
  lsr();
  lsr();
  xba();
  h.longWrite(h.abs(GLOVE_X), ctx.a);
}

// Switch the glove on: $BC36, then limits and kind (src/task/native-glove-crosshair-limits.mjs): $BC67 action glove,
// $BC80 crosshair, $BC99 spell glove.
const GLOVE_ON = Object.freeze({ action: 0xbc67, crosshair: 0xbc80, spell: 0xbc99 });
const GLOVES = {
  [GLOVE_ON.action]: GLOVE_LIMITS.action,
  [GLOVE_ON.crosshair]: GLOVE_LIMITS.crosshair,
  [GLOVE_ON.spell]: GLOVE_LIMITS.spell,
};
// Return word of an inner JSR, from the ROM address its RTS returns to minus one.
const returnWord = (address) => address & WORD_MASK;
function runGloveOn(h, k, entry) {
  k.call(entry + 2, () => runGloveOverPlayer(h));
  applyGloveLimits(h, GLOVES[entry]);
}

// $DF6B: facing direction of the player figure towards the glove (eight directions), then $AAAF.
function runFacingTowardsGlove(h, k, jsr) {
  const { a, ctx } = h,
    { lsr, negate } = support(h),
    store = (offset, value) => a.writeWord(offset, value, BANK_WRAP, 'df6b-DP-WORD');
  const shift4 = () => {
    for (let n = 0; n < GLOVE_FACING.shift; n++) h.asl();
  };
  h.load(h.longRead(h.abs(GLOVE_X)));
  lsr();
  lsr();
  store(DP_FACING_GLOVE_X, ctx.a);
  h.load(h.longRead(h.abs(GLOVE_Y)));
  lsr();
  lsr();
  store(DP_FACING_GLOVE_Y, ctx.a);
  h.index('x', h.longRead(h.abs(PLAYER_OBJECT)));
  store(DP_FACING_SIGN_X, 0);
  store(DP_FACING_SIGN_Y, 0);
  ctx.status |= FLAG_CARRY;
  h.load(GLOVE_FACING.yBase);
  h.arithmetic(h.longRead(h.abs(OBJECT_DIAGONAL) + ctx.x), true);
  ctx.status |= FLAG_CARRY;
  h.arithmetic(h.longRead(h.abs(OBJECT_HEIGHT) + ctx.x), true);
  ctx.status |= FLAG_CARRY;
  h.arithmetic(h.longRead(h.abs(CAMERA_Y)), true);
  ctx.status &= ~FLAG_CARRY;
  h.arithmetic(GLOVE_FACING.yOffset, true);
  shift4();
  ctx.status |= FLAG_CARRY;
  h.arithmetic(h.dp(DP_FACING_GLOVE_Y), true);
  if (ctx.status & FLAG_NEGATIVE) {
    store(DP_FACING_SIGN_Y, ctx.a);
    negate();
  }
  store(DP_FACING_SIZE_Y, ctx.a);
  ctx.status &= ~FLAG_CARRY;
  h.load(GLOVE_FACING.xBase);
  h.arithmetic(h.longRead(h.abs(OBJECT_Y) + ctx.x));
  ctx.status |= FLAG_CARRY;
  h.arithmetic(h.longRead(h.abs(OBJECT_X) + ctx.x), true);
  ctx.status |= FLAG_CARRY;
  h.arithmetic(h.longRead(h.abs(CAMERA_X)), true);
  shift4();
  ctx.status |= FLAG_CARRY;
  h.arithmetic(h.dp(DP_FACING_GLOVE_X), true);
  if (ctx.status & FLAG_NEGATIVE) {
    store(DP_FACING_SIGN_X, ctx.a);
    negate();
  }
  store(DP_FACING_SIZE_X, ctx.a);
  const pick = (zeroDp, [ifSet, ifZero]) => {
    h.load(h.dp(zeroDp));
    h.index('y', ctx.status & FLAG_ZERO ? ifZero : ifSet);
  };
  h.load(h.dp(DP_FACING_SIZE_Y));
  lsr();
  k.compare(ctx.a, h.dp(DP_FACING_SIZE_X));
  if (ctx.status & FLAG_CARRY) pick(DP_FACING_SIGN_Y, FACING_DIRECTIONS.vertical);
  else {
    h.load(h.dp(DP_FACING_SIZE_X));
    lsr();
    k.compare(ctx.a, h.dp(DP_FACING_SIZE_Y));
    if (ctx.status & FLAG_CARRY) pick(DP_FACING_SIGN_X, FACING_DIRECTIONS.horizontal);
    else {
      h.load(h.dp(DP_FACING_SIGN_X));
      if (ctx.status & FLAG_ZERO) pick(DP_FACING_SIGN_Y, FACING_DIRECTIONS.diagonalPositiveX);
      else pick(DP_FACING_SIGN_Y, FACING_DIRECTIONS.diagonalNegativeX);
    }
  }
  store(0, ctx.x);
  store(2, ctx.y);
  jsr(0x80e010, 0x80aaaf);
}

// Called routines with their own proofs, by target (tests may replace them).
export const PLAYER_CONTROL_ROUTINES = new Map([
  ...STATUS_SCREEN_ROUTINES,
  [0x80a985, (h) => setObjectAnimation(h.a, false)],
  [0x80aaaf, (h) => setObjectDirection(h.a, false)],
]);
const routineCall =
  (d, events, routines) =>
  (pc, target, long = false) =>
    drainNativeSequence(routineSequence(d, events, routines)(pc, target, long));
// A table callee; its registered continuation is chosen by target and function identity.
const routineSequence =
  (d, events, routines) =>
  (pc, target, long = false) => {
    if (!routines.get(target)) taskStop('task_e014_routine_open', { pc, target });
    return dialogCallSequence(d, events, routines, pc, target, long);
  };

// 80:ED3C: group overview. BCB2, FF79, window 01/01/1E and the height 5 (1D6B set) or 7E2DE6/2 + 5 with the LSR
// carry (1F4C), text 74F9; per member X (1FA8/7E2DF0, while the next index stays below 7E2DE6 and 1D6B is clear):
// weapon 9700 (1F60), name 9782, data [F9] = 971A/9734, count byte 7E0002 of its record (1F5E), attribute
// [F9]+1 times 10, ammunition [F9]+5, counter 7E3C96. F953, FA3E.
export function* ed3cSequence(d, events, routines = PLAYER_CONTROL_ROUTINES) {
  const { ctx } = d,
    call = routineSequence(d, events, routines),
    store = (pairs) => {
      for (const [o, v] of pairs) {
        d.load(v);
        d.dpWrite(o, ctx.a);
      }
    };
  yield* call(0x80ed3c, 0x80bcb2);
  yield* call(0x80ed3f, 0x80ff79);
  yield () => {
    store([
      [DP_WINDOW_LEFT, PARTY_WINDOW.left],
      [DP_WINDOW_TOP, PARTY_WINDOW.top],
      [DP_WINDOW_COLUMNS, PARTY_WINDOW.columns],
    ]);
    d.load(d.read(d.abs(GROUP_LEADER_ONLY)));
    if (ctx.status & FLAG_ZERO) {
      d.load(d.read(WRAM + GROUP_INDEX));
      d.lsr();
      d.adc(PARTY_WINDOW.baseRows);
    } else d.load(PARTY_WINDOW.baseRows);
    d.dpWrite(DP_WINDOW_ROWS, ctx.a);
    store([[DP_WINDOW_ATTRIBUTES, 0]]);
  };
  yield* call(0x80ed67, 0x80f963);
  yield () => {
    d.load(d.dp(0));
    d.write(d.abs(STATUS_WINDOW), ctx.a);
    store([[2, TEXT_PARTY_STATUS]]);
  };
  yield* call(0x80ed74, 0x80fe69);
  yield () => d.index('x', 0);
  for (;;) {
    yield () => {
      d.dpWrite(DP_PARTY_MEMBER, ctx.x);
      d.index('y', d.read(d.abs(GROUP_SLOTS) + ctx.x));
      d.load(d.read(WRAM + GROUP_NUMBERS + ctx.x));
      d.index('x', RUNNER_LAST_INDEX);
      for (;;) {
        d.cmp(d.read(d.abs(RUNNER_OBJECT_NUMBERS) + ctx.x));
        if (ctx.status & FLAG_ZERO) break;
        d.index('x', ctx.x - 1);
        d.index('x', ctx.x - 1);
        if (ctx.status & FLAG_NEGATIVE) break;
      }
      d.write(d.abs(MEMBER_INDEX), ctx.x);
      d.load(d.read(d.abs(RUNNER_NAMES) + ctx.x));
      d.dpWrite(DP_PARTY_NAME, ctx.a);
      d.load(d.read(d.abs(RUNNER_RECORD_POINTERS) + ctx.x));
      d.dpWrite(DP_MEMBER_RECORD, ctx.a);
      d.sep(FLAG_MEMORY_8BIT);
      d.load(d.read(d.abs(RUNNER_RECORD_BANKS) + ctx.x));
      d.dpWrite(DP_MEMBER_RECORD_BANK, ctx.a);
      d.rep(FLAG_MEMORY_8BIT);
      d.index('x', d.read(d.abs(OBJECT_RECORD) + ctx.y));
      d.load(d.read(WRAM + STATE_COUNT + ctx.x));
      d.load(ctx.a & BYTE_MASK);
      d.write(d.abs(MEMBER_STATE_COUNT), ctx.a);
      d.index('y', RECORD_MAGIC);
      d.load(d.read(d.indirect(DP_MEMBER_RECORD, ctx.y)));
      d.load(ctx.a & BYTE_MASK);
      d.asl();
      d.dpWrite(DP_MAGIC_MAXIMUM, ctx.a);
      d.asl();
      d.asl();
      d.adc(d.dp(DP_MAGIC_MAXIMUM));
      d.dpWrite(DP_MAGIC_MAXIMUM, ctx.a);
      store([[2, 0]]);
      d.load(d.dp(DP_PARTY_MEMBER));
      d.lsr();
      d.load(ctx.a + 1);
      d.load(ctx.a + 1);
      d.dpWrite(DP_CURSOR_ROW, ctx.a);
    };
    yield* call(0x80edcf, 0x80faac);
    yield () => {
      d.load(d.dp(DP_PARTY_NAME));
      d.dpWrite(2, ctx.a);
    };
    yield* call(0x80edd6, 0x80fe69);
    yield () => store([[2, PARTY_COLUMNS.count]]);
    yield* call(0x80edde, 0x80faac);
    yield () => {
      d.load(d.read(d.abs(MEMBER_STATE_COUNT)));
      d.dpWrite(2, ctx.a);
    };
    yield* call(0x80ede6, 0x80fd80);
    yield () => store([[2, PARTY_COLUMNS.countSlash]]);
    yield* call(0x80edee, 0x80faac);
    yield () => store([[2, TEXT_SLASH]]);
    yield* call(0x80edf6, 0x80fe69);
    yield () => {
      d.index('y', RECORD_COUNT_MAX);
      d.load(d.read(d.indirect(DP_MEMBER_RECORD, ctx.y)));
      d.modify(DP_MEMBER_RECORD, 'inc', true);
      d.load(ctx.a & BYTE_MASK);
      d.dpWrite(2, ctx.a);
    };
    yield* call(0x80ee05, 0x80fd80);
    yield () => store([[2, PARTY_COLUMNS.magic]]);
    yield* call(0x80ee0d, 0x80faac);
    yield () => {
      d.load(d.read(d.abs(MEMBER_INDEX)));
      d.lsr();
      d.index('x', ctx.a);
      d.load(d.read(WRAM + MAGIC_POINTS + ctx.x));
      d.load(ctx.a & BYTE_MASK);
      d.dpWrite(2, ctx.a);
    };
    yield* call(0x80ee1e, 0x80fd80);
    yield () => store([[2, PARTY_COLUMNS.magicSlash]]);
    yield* call(0x80ee26, 0x80faac);
    yield () => store([[2, TEXT_SLASH]]);
    yield* call(0x80ee2e, 0x80fe69);
    yield () => {
      d.load(d.dp(DP_MAGIC_MAXIMUM));
      d.dpWrite(2, ctx.a);
    };
    yield* call(0x80ee35, 0x80fd80);
    let more;
    yield () => {
      d.index('x', d.dp(DP_PARTY_MEMBER));
      d.index('x', ctx.x + 1);
      d.load(ctx.x);
      d.index('x', ctx.x + 1);
      d.cmp(d.read(WRAM + GROUP_INDEX));
      more = !(ctx.status & FLAG_CARRY);
      if (more) {
        d.load(d.read(d.abs(GROUP_LEADER_ONLY)));
        more = Boolean(ctx.status & FLAG_ZERO);
      }
    };
    if (!more) break;
  }
  yield* call(0x80ee4b, 0x80f953);
  yield () => {
    d.load(d.read(d.abs(STATUS_WINDOW)));
    d.dpWrite(0, ctx.a);
  };
  yield* call(0x80ee53, 0x80fa3e);
  let result;
  yield () => {
    result = d.rts();
  };
  return result;
}

export function controlPlayer(a, events, outerReturn = true, routines = PLAYER_CONTROL_ROUTINES) {
  return drainNativeSequence(e014Sequence(a, events, outerReturn, routines));
}
// The per-frame decisions stay single segments; the group overview, the status
// screen, the notices and the glove release keep their real call frames.
function* e014Sequence(a, events, outerReturn, routines = PLAYER_CONTROL_ROUTINES) {
  if (
    a.ctx.d !== 0 ||
    a.ctx.programBank !== CODE_BANK ||
    a.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('task_e014_entry_required');
  const h = leafAccess(a),
    k = taskSelectionSupport(h),
    { ctx } = h,
    d = dialogAccess(a),
    call = routineCall(d, events, routines),
    table = routineSequence(d, events, routines);
  const pad = () => h.load(h.longRead(h.abs(PAD_PRESSED)));
  const bit = (mask) => {
    ctx.status = (ctx.status & ~FLAG_ZERO) | (ctx.a & mask ? 0 : FLAG_ZERO);
    return (ctx.a & mask) !== 0;
  };
  const dp00 = (value) => a.writeWord(0, value, BANK_WRAP, 'e014-DP00');
  const dp02 = (value) => {
    h.load(value);
    a.writeWord(2, ctx.a, BANK_WRAP, 'e014-DP02');
  };
  const notice = function* (pcs, { columns, text }) {
    yield () => {
      for (const [o, v] of [
        [DP_WINDOW_LEFT, NOTICE_WINDOW.left],
        [DP_WINDOW_TOP, NOTICE_WINDOW.top],
        [DP_WINDOW_COLUMNS, columns],
        [DP_WINDOW_ROWS, NOTICE_WINDOW.rows],
        [DP_WINDOW_ATTRIBUTES, 0],
      ]) {
        h.load(v);
        a.writeWord(o, ctx.a, BANK_WRAP, 'e014-DP');
      }
    };
    const [windowPc, textPc, waitPc, releasePc] = pcs;
    fitListWindow(a.mem, d, [text], { column: 0 });
    yield* table(windowPc, 0x80f963);
    yield () => dp02(text);
    yield* table(textPc, 0x80fe69);
    yield* table(waitPc, 0x80f953);
    yield* table(releasePc, 0x80fa3e);
    yield () => {
      h.load(h.longRead(h.abs(PLAYER_OBJECT)));
      dp00(ctx.a);
    };
  };
  const select = (pc) => call(pc, 0x80a985);
  // E075: STZ DP02, then E0D3 JSR A985 and E1B0.
  const neutral = () => {
    a.writeWord(2, 0, BANK_WRAP, 'e014-STZ-DP02');
    select(0x80e0d3);
  };
  const status = (entry) =>
    routines.has(entry)
      ? table(entry === 0x80ea89 ? 0x80e02c : 0x80e037, entry)
      : dialogCallBody(d, entry === 0x80ea89 ? 0x80e02c : 0x80e037, entry, () =>
          statusRoutineSequence(d, events, routines, entry),
        );
  let path;
  yield () => {
    path = (() => {
      h.index('y', h.longRead(h.abs(PLAYER_OBJECT)));
      a.writeWord(0, ctx.y, BANK_WRAP, 'e014-STY-DP00');
      pad();
      if (bit(PAD_SELECT)) return 'overview';
      if (bit(PAD_START)) return 'status';
      if (bit(PAD_Y)) return 'items';
      h.load(h.longRead(h.abs(GLOVE_KIND)));
      if (ctx.status & FLAG_ZERO) {
        pad();
        if (!bit(GLOVE_BUTTONS)) {
          k.call(returnWord(0x80e127), () =>
            runFacingFromPad(h, k, (pc, target) => call(pc, target)),
          );
          dp00(0);
          return 'done';
        }
        h.load(h.longRead(h.abs(PLAYER_IDLE)));
        if (ctx.status & FLAG_ZERO) {
          h.load(WORD_MASK);
          h.longWrite(h.abs(PLAYER_IDLE), ctx.a);
          h.load((ctx.a + 1) & WORD_MASK);
          h.longWrite(h.abs(OBJECT_VELOCITY_X) + ctx.y, ctx.a);
          h.longWrite(h.abs(OBJECT_VELOCITY_Y) + ctx.y, ctx.a);
        }
        pad();
        if (bit(PAD_A)) {
          h.load(h.longRead(WRAM + RUNNER_WEAPON));
          if (ctx.status & FLAG_NEGATIVE) return 'weapon-notice';
          k.call(returnWord(0x80e0b2), () => runGloveOn(h, k, GLOVE_ON.crosshair));
          h.load(h.longRead(WRAM + RUNNER_WEAPON_KIND + 1));
          h.load(ctx.a & BYTE_MASK);
          k.compare(ctx.a, HEAVY_WEAPON_DAMAGE);
          dp02(ctx.status & FLAG_CARRY ? HEAVY_AIM_ACTION : AIM_ACTION);
          h.load((ctx.a + 1) & WORD_MASK);
          h.longWrite(h.abs(AIM_ACTION_NEXT), ctx.a);
          h.load(WORD_MASK);
          h.longWrite(h.abs(AIMING_WEAPON), ctx.a);
          select(0x80e0d3);
          dp00(0);
          return 'done';
        }
        pad();
        if (bit(PAD_X)) {
          h.load(h.longRead(WRAM + SELECTED_SPELL_SCRIPT));
          if (ctx.status & FLAG_ZERO) return 'spell-notice';
          k.call(returnWord(0x80e113), () => runGloveOn(h, k, GLOVE_ON.spell));
          h.load(WORD_MASK);
          h.longWrite(h.abs(AIMING_SPELL), ctx.a);
          dp02(SPELL_ACTION);
          select(0x80e11f);
          dp00(0);
          return 'done';
        }
        k.call(returnWord(0x80e074), () => runGloveOn(h, k, GLOVE_ON.action));
        neutral();
        dp00(0);
        return 'done';
      }
      // E12B: glove active.
      k.call(returnWord(0x80e12d), () =>
        runFacingTowardsGlove(h, k, (pc, target) => call(pc, target)),
      );
      const release = () => {
        pad();
        if (!bit(RELEASE_BUTTONS)) {
          dp00(0);
          return 'done';
        }
        h.longWrite(h.abs(AIMING_WEAPON), 0);
        h.longWrite(h.abs(AIMING_SPELL), 0);
        a.writeWord(2, 0, BANK_WRAP, 'e014-STZ-DP02');
        select(0x80e1aa);
        return 'release';
      };
      h.load(h.longRead(h.abs(AIMING_WEAPON)));
      h.load(ctx.a | h.longRead(h.abs(AIMING_SPELL)));
      if (ctx.status & FLAG_ZERO) {
        pad();
        if (bit(AIM_BUTTONS)) return 'release';
        h.load(h.longRead(h.abs(GLOVE_TARGET_TAG)));
        if (!(ctx.status & FLAG_NEGATIVE)) {
          dp00(0);
          return 'done';
        }
        return release();
      }
      h.load(h.longRead(h.abs(PAD_HELD)));
      h.load(ctx.a & AIM_BUTTONS);
      if (ctx.status & FLAG_ZERO) return release();
      // E13E: aiming with A/X held; the result goes to DP00 and E014 returns at once.
      const newly = (mask) => {
        pad();
        h.load(ctx.a & mask);
      };
      const both = () => {
        h.load(h.longRead(h.abs(PAD_HELD)));
        h.load(ctx.a & PAD_A);
        a.pushWord(ctx.a, 'e014-PHA');
        newly(PAD_X);
        h.load(ctx.a | a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, 'e014-ORA-stack'));
        dp00(ctx.a);
        h.load(a.pullWord('e014-PLA'));
      };
      h.load(h.longRead(h.abs(AIMING_SPELL)));
      if (!(ctx.status & FLAG_ZERO)) {
        h.load(h.longRead(WRAM + SELECTED_SPELL_SCRIPT));
        k.compare(ctx.a, SUMMON_SPIRIT_SCRIPT);
        if (ctx.status & FLAG_ZERO) {
          both();
          return 'done';
        }
      }
      h.load(h.longRead(h.abs(GLOVE_TARGET_TAG)));
      if (!(ctx.status & FLAG_NEGATIVE)) {
        h.index('x', h.longRead(h.abs(GLOVE_TARGET_OBJECT)));
        h.load(h.longRead(h.abs(OBJECT_FLAGS) + ctx.x));
        if (ctx.status & FLAG_NEGATIVE) {
          h.longWrite(h.abs(AIM_TARGET_OBJECT), ctx.x);
          h.load(h.longRead(WRAM + RUNNER_WEAPON_KIND));
          h.load(ctx.a & BYTE_MASK);
          k.compare(ctx.a, 1);
          if (ctx.status & FLAG_ZERO) both();
          else {
            newly(AIM_BUTTONS);
            dp00(ctx.a);
          }
          return 'done';
        }
      }
      newly(PAD_A);
      dp00(ctx.a);
      return 'done';
    })();
  };
  if (path === 'overview') {
    if (routines.has(0x80ed3c)) yield* table(0x80e021, 0x80ed3c);
    else yield* dialogCallBody(d, 0x80e021, 0x80ed3c, () => ed3cSequence(d, events, routines));
    yield () => dp00(0);
  } else if (path === 'status') {
    yield* status(0x80ea89);
    yield () => dp00(0);
  } else if (path === 'items') {
    yield* status(0x80ea8e);
    yield () => dp00(0);
  } else if (path === 'weapon-notice') {
    yield* notice([0x80e098, 0x80e0a0, 0x80e0a3, 0x80e0a6], WEAPON_NOTICE);
    yield () => {
      neutral();
      dp00(0);
    };
  } else if (path === 'spell-notice') {
    yield* notice([0x80e0f8, 0x80e100, 0x80e103, 0x80e106], SPELL_NOTICE);
    yield () => {
      neutral();
      dp00(0);
    };
  } else if (path === 'release') {
    yield* table(0x80e1ad, 0x80bcb2);
    yield () => dp00(0);
  }
  let result;
  yield () => {
    result = finishLeaf(a, outerReturn);
  };
  return result;
}
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits and inputs replay the register-level
// native.
function observeControlPlayer(a, options, outerReturn, lifted = null) {
  const invalid = validateDialogTaskOptions(options);
  if (invalid) taskStop(invalid.reason);
  const events = withInterruptEvents(
    {
      mode: 'record-observations',
      values: options?.waitObservations ?? null,
      waitIndex: 0,
      calls: [],
      waitEvents: [],
      inputMode: 'record-observations',
      inputs: options?.inputObservations ?? null,
      inputIndex: 0,
      round: options?.round ?? null,
      nestedRound: options?.nestedRound ?? null,
    },
    options,
  );
  const finish = (result) => {
    if (events.waitIndex !== (events.values?.length ?? 0))
      taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
    if (events.inputIndex !== (events.inputs?.length ?? 0))
      taskStop('task_input_observation_unused', { observationIndex: events.inputIndex });
    return {
      ...result,
      waitObservationsUsed: events.waitIndex,
      inputObservationsUsed: events.inputIndex,
    };
  };
  if (lifted !== null && lagFree(events))
    return { sequence: liftedResult(lifted(dialogAccess(a), events)), finish };
  return { sequence: e014Sequence(a, events, outerReturn), finish };
}
function* liftedResult(sequence) {
  return { rawReturnWord: yield* sequence };
}
export function controlPlayerObserved(a, options, outerReturn = true, lifted = null) {
  const { sequence, finish } = observeControlPlayer(a, options, outerReturn, lifted);
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createControlPlayerObserved = (a, options, lifted = null) =>
  observedContinuation(a, observeControlPlayer(a, options, false, lifted));
