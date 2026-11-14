// Shooting (lifted from the script natives 80:8AB5, 80:8A51 and 80:8A8C; register-level
// version in src/task/native-object-shoot.mjs, which recorded waits and inputs replay).
//
// A shot runs in four steps, with the shooter's object slot and the target's:
// 1. The weapon (80:8860, not for 80:8AB5, which takes the shot's values from the direct
//    page): the shooter's object number is looked up in the weapon owners' list
//    (80:9700); its record gives the three hit bonuses (close, kind 5 and ranged, the
//    last halved and rounded up), its entry in the runners' weapons (7E:3C33) the kind,
//    damage and signed range penalty. Kinds 0, 1 and 6 play their shot sound.
// 2. The line of sight (81:A25F, src/game/line-of-sight.mjs): a blocked line ends the
//    shot; a low box on the line (80:8A43) lowers the close bonus by 2, not below 0.
// 3. The shooter turns towards the target (80:8497, not for 80:8A51): one of eight
//    directions by the signs of the dominant axis or of both.
// 4. The hit roll (80:8904): close kinds (below 4 and 6) roll at once; the others miss
//    from 40 apart on any axis, kind 5 adds half its bonus to the damage on a hit. A
//    roll draws below 8 and hits when the draw plus 1 less 2 (3 for kind 5), the bonus
//    and the range penalty is negative; a hit runs 80:8691 with the damage, a miss
//    places a marker (80:89B0) at a random spot near the target.
// The result in DP 00 is the hit's result (DP B4), FFFF when the sight is blocked (1 for
// 80:8A51).
//
// Game state only (docs/STRATEGY.md, 2026-11-14): the script interpreter replaces A, X,
// Y and the flags after the native and reads its result from DP 00, so the registers
// the original leaves are not produced. The sight, the random numbers, the turn, the
// object slot and the sound run lifted as plain calls; the line of sight's direct page
// working bytes 7E:000E-006C are not produced (as for the sight natives, user decision
// 2026-11-13). Only the hit 80:8691, whose notices wait for frames, runs through its
// JSR frame from the routine table, with the damage in A, the target in X and the
// shooter in Y.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import { drawBelowInDirectPage } from '../system/random.mjs';
import { playSoundEffect } from '../apu/sound-effect.mjs';
import { taskStop } from '../task/plan.mjs';
import { lineOfSight } from './line-of-sight.mjs';
import { turnObject } from './object-turn.mjs';
import { createObject } from './object-create.mjs';
import {
  CLOSE_KIND_LIMIT,
  CLOSE_KIND,
  DAMAGE_BONUS_KIND,
  DAMAGE_BONUS_ROLL_OFFSET,
  DP_BONUS_CLOSE,
  DP_BONUS_KIND_5,
  DP_BONUS_RANGED,
  DP_MINUS_X,
  DP_MINUS_Y,
  DP_OFFSET_X,
  DP_OFFSET_Y,
  DP_SHOT_BONUS,
  DP_SHOT_DAMAGE,
  DP_SHOT_KIND,
  DP_SHOT_PENALTY,
  DP_WEAPON_DAMAGE,
  DP_WEAPON_KIND,
  DP_WEAPON_PENALTY,
  DP_WEAPON_RECORD,
  DP_WEAPON_RECORD_BANK,
  FACING,
  HIT_ROLL_OFFSET,
  HIT_ROLL_SIDES,
  MISS_FACINGS,
  MISS_HEIGHT_RAISE,
  MISS_KIND,
  MISS_OFFSETS_X,
  MISS_OFFSETS_Y,
  MISS_SCRIPT,
  MISS_SPOTS,
  RANGED_REACH,
  RECORD_BONUS_CLOSE,
  RECORD_BONUS_KIND_5,
  RECORD_BONUS_RANGED,
  SHOT_SOUND_KIND_0,
  SHOT_SOUND_KIND_1,
  SHOT_SOUND_KIND_6,
  SHOT_SOUND_LEVEL_VOICES,
  WEAPON_DAMAGE,
  WEAPON_OWNERS,
  WEAPON_OWNERS_END,
  WEAPON_RECORD_BANKS,
  WEAPON_RECORDS,
  WEAPON_SEARCH_LIMIT,
} from '../task/native-object-shoot.mjs';
import { DP_HIT_RESULT, DP_HIT_SHOOTER } from '../task/native-object-hit.mjs';
import {
  DP_OBJECT_HEIGHT,
  DP_OBJECT_KIND,
  DP_OBJECT_SCRIPT,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  OBJECT_ARMOUR,
  OBJECT_ATTACKED,
  OBJECT_BOX_HEIGHT,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_NUMBER,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_OBJECT,
  RUNNER_WEAPON_KIND,
  RUNNER_WEAPON_RANGE,
} from '../task/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  HIGH_BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

// The hit 80:8691 and its call site in 80:8904.
const HIT = 0x808691,
  HIT_CALL = 0x8089ac;
// The result of 80:8A51 when the sight is blocked; the weapon entries are four bytes.
const GLOVE_BLOCKED = 1,
  WEAPON_ENTRY_SHIFT = 2,
  // Box units: coordinates over 4.
  BOX_SHIFT = 2,
  // A low box lowers the close bonus by this much.
  LOW_BOX_PENALTY = 2;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const negative = (value) => (value & WORD_SIGN) !== 0;
// left - right - borrow on words, with the borrow passed on as the 65816 carry.
function subtract(left, right, carry = true) {
  const difference = left - right - (carry ? 0 : 1);
  return { value: difference & WORD_MASK, carry: difference >= 0 };
}
// The size of a signed word (8000 stays).
const magnitude = (value) => (negative(value) ? -value & WORD_MASK : value);

// The script natives run with the direct page at 0: mem, its WRAM and the hardware port.
function shotRuntime(h) {
  if (h.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  const { mem } = h.a;
  return { h, mem, wram: mem.wram, port: accessorPort(h.a) };
}
// 80:C51F: a draw below range into DP 00 (src/system/random.mjs).
const drawBelow = ({ mem, port }, range) => drawBelowInDirectPage(mem, port, range);

// The shot sound of a weapon kind, or null.
const shotSound = (kind) =>
  kind === 0
    ? SHOT_SOUND_KIND_0
    : kind === 1
      ? SHOT_SOUND_KIND_1
      : kind === CLOSE_KIND
        ? SHOT_SOUND_KIND_6
        : null;
// 80:8860: the weapon of the shooter into the direct page (the record pointer in DP AB
// and AD is overwritten by the close bonus). An unknown object number searches for ever
// in the original; it stops after one pass over all owners' indices.
function takeWeapon(run, shooter) {
  const { mem, wram, port } = run,
    number = dataBankWord(mem, OBJECT_NUMBER, shooter);
  let owner = WEAPON_OWNERS_END;
  for (let n = 0; ; n++) {
    if (n === WEAPON_SEARCH_LIMIT)
      taskStop('task_native_8860_weapon_search_unbounded', { object: number });
    owner = (owner - 2) & WORD_MASK;
    if (dataBankWord(mem, WEAPON_OWNERS, owner) === number) break;
  }
  const pointer = dataBankWord(mem, WEAPON_RECORDS, owner),
    bank = dataBankWord(mem, WEAPON_RECORD_BANKS, owner),
    record = (offset) =>
      mem.read8(((pointer | ((bank & BYTE_MASK) << WORD_BITS)) + offset) & LONG_MASK);
  setWord(wram, DP_WEAPON_RECORD, pointer);
  setWord(wram, DP_WEAPON_RECORD_BANK, bank);
  setWord(wram, DP_BONUS_KIND_5, record(RECORD_BONUS_KIND_5));
  const ranged = record(RECORD_BONUS_RANGED);
  setWord(wram, DP_BONUS_RANGED, (ranged >>> 1) + (ranged & 1));
  setWord(wram, DP_BONUS_CLOSE, record(RECORD_BONUS_CLOSE));
  const entry = (owner << WEAPON_ENTRY_SHIFT) & WORD_MASK,
    kind = wram[RUNNER_WEAPON_KIND + entry],
    range = wram[RUNNER_WEAPON_RANGE + entry];
  setWord(wram, DP_WEAPON_KIND, kind);
  setWord(wram, DP_WEAPON_DAMAGE, wram[WEAPON_DAMAGE + entry]);
  setWord(wram, DP_WEAPON_PENALTY, range >= BYTE_SIGN ? range | HIGH_BYTE_MASK : range);
  const sound = shotSound(kind);
  if (sound === null) return;
  // 80:88EB: the sound for the shooter at full level on all voices; DP 00 and 02 come
  // back from the stack, the level and voices stay in DP 04 and 06.
  setWord(wram, DP_SOUND_LEVEL, SHOT_SOUND_LEVEL_VOICES);
  setWord(wram, DP_SOUND_VOICE, SHOT_SOUND_LEVEL_VOICES);
  playSoundEffect(mem, port, {
    object: shooter,
    effect: sound,
    level: SHOT_SOUND_LEVEL_VOICES,
    voices: SHOT_SOUND_LEVEL_VOICES,
  });
}

// The line of sight from the shooter to the target; true when it is blocked. A low box
// on an open line lowers the close bonus by 2, not below 0 (80:8A43).
function sightBlocked(run, shooter, target) {
  const { mem, wram, port } = run,
    { blocked, lowBox } = lineOfSight(mem, port, shooter, target);
  if (blocked) return true;
  if (lowBox) {
    const lowered = (word(wram, DP_BONUS_CLOSE) - LOW_BOX_PENALTY) & WORD_MASK;
    setWord(wram, DP_BONUS_CLOSE, negative(lowered) ? 0 : lowered);
  }
  return false;
}

// The direction from the signs of the target's offset on the dominant axis, or of both
// when neither axis is twice the other.
function facingDirection(offsetX, offsetY, minusX, minusY) {
  if (offsetY >>> 1 >= offsetX) return minusY ? FACING.minusY : FACING.y;
  if (offsetX >>> 1 >= offsetY) return minusX ? FACING.minusX : FACING.x;
  if (minusX) return minusY ? FACING.minusXMinusY : FACING.minusXY;
  return minusY ? FACING.xMinusY : FACING.xy;
}
// 80:8497: the shooter turns towards the target (80:AAAF with the shooter in DP 00 and
// the direction in DP 02). The negative offsets stay in DP C0 and C3, the sizes in BA
// and BD.
function faceTarget(run, shooter, target) {
  const { h, mem, wram } = run,
    field = (offset, slot) => dataBankWord(mem, offset, slot),
    down = (field(OBJECT_Y, target) - field(OBJECT_Y, shooter)) & WORD_MASK,
    across = (field(OBJECT_X, target) - field(OBJECT_X, shooter)) & WORD_MASK,
    minusY = negative(down) ? down : 0,
    minusX = negative(across) ? across : 0,
    offsetY = magnitude(down),
    offsetX = magnitude(across);
  setWord(wram, DP_MINUS_X, minusX);
  setWord(wram, DP_MINUS_Y, minusY);
  setWord(wram, DP_OFFSET_Y, offsetY);
  setWord(wram, DP_OFFSET_X, offsetX);
  setWord(wram, 0, shooter);
  setWord(wram, 2, facingDirection(offsetX, offsetY, minusX, minusY));
  turnObject(mem, wram, h.a);
}

// A roll: a draw below 8; true for a hit, when draw + 1 - offset - bonus - range penalty
// is negative (borrows passed on).
function rollHits(run, offset, bonus) {
  const { wram } = run,
    draw = drawBelow(run, HIT_ROLL_SIDES);
  let left = subtract((draw + 1) & WORD_MASK, offset);
  left = subtract(left.value, word(wram, bonus), left.carry);
  left = subtract(left.value, word(wram, DP_WEAPON_PENALTY), left.carry);
  return negative(left.value);
}
// 80:8691 with the damage in A for the target X by the shooter Y.
function* hitSequence(run, events, routines, shooter, target) {
  const { h, wram } = run;
  yield () => {
    h.ctx.a = word(wram, DP_WEAPON_DAMAGE);
    h.ctx.x = target;
    h.ctx.y = shooter;
  };
  yield* nativeCallSequence(h, events, routines, HIT_CALL, HIT, false, false);
}
// 80:89B0: a miss marker (object E6, script 80) in a free slot near the target: its
// height a draw below (box height + 0A) * 4 plus the target's height, over 4; one of
// eight spots around the target (80:8A23, 80:8A33); its armour word the spot's facing
// (80:8A13). The shooter waits in DP B7.
function placeMiss(run, shooter, target) {
  const { h, mem, wram } = run,
    field = (offset, slot) => dataBankWord(mem, offset, slot);
  setWord(wram, DP_HIT_SHOOTER, shooter);
  const range = ((word(wram, OBJECT_BOX_HEIGHT + target) + MISS_HEIGHT_RAISE) << 2) & WORD_MASK,
    height = (drawBelow(run, range) + field(OBJECT_HEIGHT, target)) & WORD_MASK;
  setWord(wram, DP_OBJECT_HEIGHT, height >>> BOX_SHIFT);
  const spot = (drawBelow(run, MISS_SPOTS) << 1) & WORD_MASK;
  setWord(wram, DP_OBJECT_X, (field(OBJECT_X, target) >>> BOX_SHIFT) + field(MISS_OFFSETS_X, spot));
  setWord(wram, DP_OBJECT_Y, (field(OBJECT_Y, target) >>> BOX_SHIFT) + field(MISS_OFFSETS_Y, spot));
  const facing = field(MISS_FACINGS, spot);
  setWord(wram, DP_OBJECT_SCRIPT, MISS_SCRIPT);
  setWord(wram, DP_OBJECT_KIND, MISS_KIND);
  createObject(mem, wram, h.a);
  setWord(wram, OBJECT_ARMOUR + word(wram, 0), facing);
}
// A roll's outcome: the hit, or the miss marker.
function* rolledSequence(run, events, routines, shooter, target, offset, bonus) {
  if (rollHits(run, offset, bonus)) yield* hitSequence(run, events, routines, shooter, target);
  else placeMiss(run, shooter, target);
}
// 80:8904: the hit roll of the shooter at the target with the weapon in the direct page.
function* shotSequence(run, events, routines, shooter, target) {
  const { mem, wram } = run,
    kind = word(wram, DP_WEAPON_KIND);
  if (kind < CLOSE_KIND_LIMIT || kind === CLOSE_KIND) {
    yield* rolledSequence(run, events, routines, shooter, target, HIT_ROLL_OFFSET, DP_BONUS_CLOSE);
    return;
  }
  const far = [OBJECT_X, OBJECT_Y, OBJECT_HEIGHT].some(
    (offset) =>
      magnitude(
        (dataBankWord(mem, offset, target) - dataBankWord(mem, offset, shooter)) & WORD_MASK,
      ) >= RANGED_REACH,
  );
  if (far) placeMiss(run, shooter, target);
  else if (kind !== DAMAGE_BONUS_KIND)
    yield* rolledSequence(run, events, routines, shooter, target, HIT_ROLL_OFFSET, DP_BONUS_RANGED);
  else if (!rollHits(run, DAMAGE_BONUS_ROLL_OFFSET, DP_BONUS_KIND_5))
    placeMiss(run, shooter, target);
  else {
    setWord(
      wram,
      DP_WEAPON_DAMAGE,
      (word(wram, DP_BONUS_KIND_5) >>> 1) + word(wram, DP_WEAPON_DAMAGE),
    );
    yield* hitSequence(run, events, routines, shooter, target);
  }
}

// The result word into DP 00 (the hit's result by default), then the native's RTS.
function* finishSequence(run, value) {
  const { h, wram } = run;
  let result;
  yield () => {
    setWord(wram, 0, value ?? word(wram, DP_HIT_RESULT));
    result = h.rts();
  };
  return result;
}

// 80:8AB5: the object DP 00 shoots at the object DP 02 (none when negative) with the hit
// bonus DP 04, kind DP 06, damage DP 08 and range penalty DP 0A. A sequence that ends
// with the native's RTS.
export function* shootAtObjectSequence(h, events, routines) {
  const run = shotRuntime(h),
    { wram } = run,
    shooter = word(wram, 0),
    target = word(wram, 2);
  setWord(wram, DP_HIT_RESULT, 0);
  if (negative(target)) return yield* finishSequence(run);
  const bonus = word(wram, DP_SHOT_BONUS);
  setWord(wram, DP_BONUS_KIND_5, bonus);
  setWord(wram, DP_BONUS_RANGED, bonus);
  setWord(wram, DP_BONUS_CLOSE, bonus);
  setWord(wram, DP_WEAPON_KIND, word(wram, DP_SHOT_KIND));
  setWord(wram, DP_WEAPON_DAMAGE, word(wram, DP_SHOT_DAMAGE));
  setWord(wram, DP_WEAPON_PENALTY, word(wram, DP_SHOT_PENALTY));
  if (sightBlocked(run, shooter, target)) return yield* finishSequence(run, WORD_MASK);
  faceTarget(run, shooter, target);
  yield* shotSequence(run, events, routines, shooter, target);
  return yield* finishSequence(run);
}

// 80:8A51: the player figure shoots with its weapon at the object under the glove (none
// when 7E:01DA or the slot 7E:01DE is negative), which is marked as attacked. A
// sequence that ends with the native's RTS.
export function* shootAtGloveTargetSequence(h, events, routines) {
  const run = shotRuntime(h),
    { mem, wram } = run,
    player = word(wram, PLAYER_OBJECT);
  setWord(wram, DP_HIT_RESULT, 0);
  takeWeapon(run, player);
  const target = word(wram, GLOVE_TARGET_OBJECT);
  if (negative(word(wram, GLOVE_TARGET_TAG)) || negative(target)) return yield* finishSequence(run);
  if (sightBlocked(run, player, target)) return yield* finishSequence(run, GLOVE_BLOCKED);
  setDataBankWord(
    mem,
    OBJECT_FLAGS,
    target,
    dataBankWord(mem, OBJECT_FLAGS, target) | OBJECT_ATTACKED,
  );
  yield* shotSequence(run, events, routines, player, target);
  return yield* finishSequence(run);
}

// 80:8A8C: the object DP 00 shoots with its weapon at the object DP 02. A sequence that
// ends with the native's RTS.
export function* shootWithOwnWeaponSequence(h, events, routines) {
  const run = shotRuntime(h),
    { wram } = run,
    shooter = word(wram, 0);
  setWord(wram, DP_HIT_RESULT, 0);
  takeWeapon(run, shooter);
  const target = word(wram, 2);
  if (sightBlocked(run, shooter, target)) return yield* finishSequence(run, WORD_MASK);
  faceTarget(run, shooter, target);
  yield* shotSequence(run, events, routines, shooter, target);
  return yield* finishSequence(run);
}
