// Script natives without frame waits that run lifted code (docs/MAIN-LOOP-LIFT.md):
// each takes its arguments from the direct page words the script interpreter fills,
// calls the lifted function and returns with the native's RTS. The interpreter's
// $F509 replaces A, X, Y and the direct page afterwards and reads the result from the
// direct page word 00, so the registers the original leaves are not produced.
// Register-level references: proof/game-reference/fight-list-append.mjs,
// proof/apu-reference/sound-stereo.mjs, src/task/native-audio-compose.mjs (80:C46E) and
// src/task/native-random.mjs (80:C51F, 80:C560), which register-level callers still use,
// proof/game-reference/enemy-target-choice.mjs (80:8BC5) and src/task/native-combat.mjs (80:8C08,
// 80:8C8D, 80:8CCF, 80:8D7F, 80:8D3F, 80:8D4E).
import { FIRST_ARGUMENT, SECOND_ARGUMENT, finishLeaf } from './native-leaf-support.mjs';
import { taskStop } from './plan.mjs';
import { appendToFightList } from '../game/fight-list.mjs';
import { sendApuCommand } from '../apu/apu-command.mjs';
import { playSoundEffect, soundLevels } from '../apu/sound-effect.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import { randomBelow, randomWord, rangeMask } from '../system/random.mjs';
import { DP_POINT_LIST, DP_RANDOM_MASK } from './wram.mjs';
import { addRise, listPoint, objectPoint, setVelocityTowards } from '../game/object-velocity.mjs';
import { APU_COMMAND_SONG_LEVEL } from '../constants/sound-commands.mjs';
import {
  NO_TARGET,
  canAttack,
  chooseEnemyTarget,
  chooseRandomFightTarget,
  findNearestVisibleMember,
} from '../game/combat-targets.mjs';
import { payNuyen, setActorStateHolder } from '../game/script-records.mjs';
import { faceRoomDirection } from '../game/member-facing.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// The sound effect's direct page words.
const DP_OBJECT = 0,
  DP_EFFECT = 2,
  DP_LEVEL = 4,
  DP_VOICES = 6;
const argument = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setArgument = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// The natives run with the direct page at 0 (the script arguments).
function leafRuntime(a) {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  return { mem: a.mem, wram: a.mem.wram, port: accessorPort(a) };
}

// 80:8521: append the object (first argument) to the fight list (src/game/fight-list.mjs).
export function appendToFightListNative(a, outerReturn = true) {
  const { mem, wram, port } = leafRuntime(a);
  appendToFightList(mem, port, argument(wram, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
}
// 80:C461: the song level (second argument) panned to the screen position of the object
// (first argument), sent as the sound driver's song level command.
export function panSongLevelToObject(a, outerReturn = true) {
  const { wram, port } = leafRuntime(a),
    levels = soundLevels(
      wram,
      port,
      argument(wram, FIRST_ARGUMENT),
      argument(wram, SECOND_ARGUMENT),
    );
  sendApuCommand(wram, port, APU_COMMAND_SONG_LEVEL, levels);
  return finishLeaf(a, outerReturn);
}
// 80:C46E: the sound effect with the object, effect, level and voices in the direct
// page words 0 to 6 (src/apu/sound-effect.mjs).
export function playSoundEffectNative(a, outerReturn = true) {
  const { mem, wram, port } = leafRuntime(a);
  playSoundEffect(mem, port, {
    object: argument(wram, DP_OBJECT),
    effect: argument(wram, DP_EFFECT),
    level: argument(wram, DP_LEVEL),
    voices: argument(wram, DP_VOICES),
  });
  return finishLeaf(a, outerReturn);
}
// 80:C51F: a random number below the limit (first argument) as the result; a limit of 0
// leaves it. The original keeps the limit in the second argument word and the mask in
// the direct page word 04. Returns the draws, the mask and whether the limit was 0 as
// the register-level native reports them.
export function randomBelowNative(a, outerReturn = true) {
  const { mem, wram, port } = leafRuntime(a),
    range = argument(wram, FIRST_ARGUMENT);
  if (range === 0)
    return { ...finishLeaf(a, outerReturn), zeroLimit: true, attempts: 0, mask: null };
  const mask = rangeMask(mem, range),
    counter = {};
  setArgument(wram, SECOND_ARGUMENT, range);
  setArgument(wram, DP_RANDOM_MASK, mask);
  setArgument(wram, FIRST_ARGUMENT, randomBelow(mem, port, range, null, counter));
  return { ...finishLeaf(a, outerReturn), zeroLimit: false, attempts: counter.draws, mask };
}
// 80:C560: a random word (two random bytes) as the result.
export function randomByteNative(a, outerReturn = true) {
  const { mem, wram, port } = leafRuntime(a);
  setArgument(wram, FIRST_ARGUMENT, randomWord(mem, port));
  return finishLeaf(a, outerReturn);
}

// 80:8D95 leaves its working values in the direct page: the target point, the signs
// and the x and y magnitudes, the divisor (the natives' result) and half of it, and the
// halving request plus one in the direct page word 04.
const DP_POINT_X = 0xb4,
  DP_POINT_Y = 0xb7,
  DP_POINT_HEIGHT = 0xba,
  DP_SIGN_X = 0xa8,
  DP_SIGN_Y = 0xab,
  DP_SIGN_HEIGHT = 0xae,
  DP_DISTANCE_X = 0xa2,
  DP_DISTANCE_Y = 0xa5,
  DP_HALF_DIVISOR = 0xb1,
  DP_HALVING = 4,
  // 8D7F requests the extra halving with FFFF, so the word ends 0; a jump's ends 1.
  MOVE_HALVING = 0,
  JUMP_HALVING = 1;
function velocityTowards(a, point, move) {
  const { mem, wram, port } = leafRuntime(a),
    object = argument(wram, FIRST_ARGUMENT),
    { x, y, height, divisor } = setVelocityTowards(mem, port, object, point, move);
  for (const [at, value] of [
    [DP_POINT_X, point.x],
    [DP_POINT_Y, point.y],
    [DP_POINT_HEIGHT, point.height],
    [DP_SIGN_X, x.sign],
    [DP_SIGN_Y, y.sign],
    [DP_SIGN_HEIGHT, height.sign],
    [DP_DISTANCE_X, x.magnitude],
    [DP_DISTANCE_Y, y.magnitude],
    [DP_HALVING, move ? MOVE_HALVING : JUMP_HALVING],
    [FIRST_ARGUMENT, divisor],
    [DP_HALF_DIVISOR, divisor >>> 1],
  ])
    setArgument(wram, at, value);
  return { mem, object, divisor };
}
// 80:8D7F: the object (first argument) moves towards the object of the second argument.
export function moveObjectTowardsObject(a, outerReturn = true) {
  const { mem } = a;
  velocityTowards(a, objectPoint(mem, argument(mem.wram, SECOND_ARGUMENT)), true);
  return finishLeaf(a, outerReturn);
}
// 80:8D3F: the object (first argument) jumps towards the object of the second argument.
export function jumpObjectTowardsObject(a, outerReturn = true) {
  const { mem } = a,
    jump = velocityTowards(a, objectPoint(mem, argument(mem.wram, SECOND_ARGUMENT)), false);
  addRise(jump.mem, jump.object, jump.divisor);
  return finishLeaf(a, outerReturn);
}
// 80:8D4E: the object (first argument) jumps towards the point (second argument) of the
// point list at the long pointer in the direct page F3.
export function jumpObjectTowardsPoint(a, outerReturn = true) {
  const { mem } = a,
    { wram } = mem,
    list = argument(wram, DP_POINT_LIST) | (wram[DP_POINT_LIST + 2] << WORD_BITS),
    jump = velocityTowards(a, listPoint(mem, list, argument(wram, SECOND_ARGUMENT)), false);
  addRise(jump.mem, jump.object, jump.divisor);
  return finishLeaf(a, outerReturn);
}

// The sight natives (src/game/combat-targets.mjs). A random draw leaves its range and
// mask in the direct page words 02 and 04 as 80:C51F does. The line of sight's own
// direct page working bytes (7E:000E-006C) are not produced.
function keepDraw(mem, range) {
  if (range === null) return;
  setArgument(mem.wram, SECOND_ARGUMENT, range);
  setArgument(mem.wram, DP_RANDOM_MASK, rangeMask(mem, range));
}
// 80:8BC5: an enemy's (first argument) target in the group as the result.
export function chooseEnemyTargetNative(a, outerReturn = true) {
  const { mem, wram, port } = leafRuntime(a),
    { target, range } = chooseEnemyTarget(mem, port, argument(wram, FIRST_ARGUMENT));
  keepDraw(mem, range);
  setArgument(wram, FIRST_ARGUMENT, target);
  return finishLeaf(a, outerReturn);
}
// 80:8C08 keeps the last member's working distance, the nearest distance and the
// nearest member in the direct page.
const DP_MEMBER_DISTANCE = 0xa2,
  DP_NEAREST_DISTANCE = 0xa5,
  DP_NEAREST_MEMBER = 0xa8;
// 80:8C08: the nearest group member the object (first argument) sees as the result.
export function findNearestVisibleMemberNative(a, outerReturn = true) {
  const { mem, wram, port } = leafRuntime(a),
    nearest = findNearestVisibleMember(mem, port, argument(wram, FIRST_ARGUMENT));
  if (nearest === null) setArgument(wram, FIRST_ARGUMENT, NO_TARGET);
  else
    for (const [at, value] of [
      [DP_MEMBER_DISTANCE, nearest.lastDistance],
      [DP_NEAREST_DISTANCE, nearest.distance],
      [DP_NEAREST_MEMBER, nearest.member],
      [FIRST_ARGUMENT, nearest.member],
    ])
      setArgument(wram, at, value);
  return finishLeaf(a, outerReturn);
}
// 80:8C8D: a random target of the fight list for the object (first argument).
export function chooseRandomFightTargetNative(a, outerReturn = true) {
  const { mem, wram, port } = leafRuntime(a),
    { target, range } = chooseRandomFightTarget(mem, port, argument(wram, FIRST_ARGUMENT));
  keepDraw(mem, range);
  setArgument(wram, FIRST_ARGUMENT, target);
  return finishLeaf(a, outerReturn);
}
// 80:8CCF: FFFF if the first argument can attack the second, else 0.
export function canAttackNative(a, outerReturn = true) {
  const { mem, wram, port } = leafRuntime(a),
    yes = canAttack(mem, port, argument(wram, FIRST_ARGUMENT), argument(wram, SECOND_ARGUMENT));
  setArgument(wram, FIRST_ARGUMENT, yes ? WORD_MASK : 0);
  return finishLeaf(a, outerReturn);
}

// 80:CD20: pay the nuyen of the first argument; the result FFFF if paid, else 0
// (src/game/script-records.mjs).
export function payNuyenNative(a, outerReturn = true) {
  const { wram } = leafRuntime(a);
  setArgument(wram, FIRST_ARGUMENT, payNuyen(wram, argument(wram, FIRST_ARGUMENT)) ? WORD_MASK : 0);
  return finishLeaf(a, outerReturn);
}
// 80:CBF7: the actor of the first argument gets the holder of the second.
export function setActorStateHolderNative(a, outerReturn = true) {
  const { mem, wram } = leafRuntime(a);
  setActorStateHolder(mem, argument(wram, FIRST_ARGUMENT), argument(wram, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
}
// 80:BBA0: the member object (first argument) faces the room's direction
// (src/game/member-facing.mjs).
export function faceRoomDirectionNative(a, outerReturn = true) {
  const { mem } = leafRuntime(a);
  faceRoomDirection(mem, a);
  return finishLeaf(a, outerReturn);
}
