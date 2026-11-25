// Random per-function tests of the lifted motion target natives
// (src/game/motion-targets.mjs through their natives in src/task) against their
// register-level references (proof/game-reference/motion-targets.mjs): towards an object
// 80:C6F3 and 80:C6F8, towards the player 80:C716 and 80:C71D, towards a point 80:C79C
// and 80:C7A1, the stop 80:C7C2, towards a waypoint 80:C6BF and 80:C6C4 and onto one
// 80:D105. Both sides run the native from its script call (data
// bank 80, direct page 0, the RTS frame). Game state only (docs/STRATEGY.md, 2026-11-14):
// WRAM outside the stacks, the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import {
  moveObjectStraightToObjectReference,
  moveObjectStraightToPlayerReference,
  moveObjectStraightToPointReference,
  moveObjectToObjectReference,
  moveObjectToPlayerReference,
  moveObjectToPointReference,
  stopMotionReference,
  moveObjectStraightToWaypointReference,
  moveObjectToWaypointReference,
  placeObjectOnWaypointReference,
} from '../proof/game-reference/motion-targets.mjs';
import { moveObjectStraightToObject } from '../src/script/native-motion-object-follow.mjs';
import { moveObjectToObject } from '../src/script/native-motion-object-move.mjs';
import { moveObjectStraightToPlayer } from '../src/script/native-motion-player-follow.mjs';
import { moveObjectToPlayer } from '../src/script/native-motion-player-move.mjs';
import { moveObjectStraightToPoint } from '../src/script/native-motion-point-follow.mjs';
import { moveObjectToPoint } from '../src/script/native-motion-point-move.mjs';
import { stopMotion } from '../src/script/native-motion-stop.mjs';
import {
  moveObjectStraightToWaypoint,
  moveObjectToWaypoint,
} from '../src/script/native-motion-waypoint-move.mjs';
import { placeObjectOnWaypoint } from '../src/script/native-object-to-waypoint.mjs';
import { DP_POINT_LIST } from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234;

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // An object of the game's slots or any index (near FFFF: bank 7F).
  setWord(wram, 0, [2 * rnd(44), rnd(WORD), 0xfffe + rnd(2)][rnd(3)]);
  // A point list in WRAM (bank 7E or 7F) and a waypoint of it or any word.
  setWord(wram, DP_POINT_LIST, rnd(WORD));
  wram[DP_POINT_LIST + 2] = 0x7e + rnd(2);
  if (rnd(2)) setWord(wram, 2, rnd(64));
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const motion = (name, entry, reference, run) => ({
  name,
  entry,
  samples: 300,
  reference: (h) => reference(h.a, false),
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
  result: returned,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    run(h.a, false);
    return returned(h);
  },
});
registerCases(
  [
    motion(
      'moveObjectStraightToObject 80:C6F3',
      0x80c6f3,
      moveObjectStraightToObjectReference,
      moveObjectStraightToObject,
    ),
    motion('moveObjectToObject 80:C6F8', 0x80c6f8, moveObjectToObjectReference, moveObjectToObject),
    motion(
      'moveObjectStraightToPlayer 80:C716',
      0x80c716,
      moveObjectStraightToPlayerReference,
      moveObjectStraightToPlayer,
    ),
    motion('moveObjectToPlayer 80:C71D', 0x80c71d, moveObjectToPlayerReference, moveObjectToPlayer),
    motion(
      'moveObjectStraightToPoint 80:C79C',
      0x80c79c,
      moveObjectStraightToPointReference,
      moveObjectStraightToPoint,
    ),
    motion('moveObjectToPoint 80:C7A1', 0x80c7a1, moveObjectToPointReference, moveObjectToPoint),
    motion('stopMotion 80:C7C2', 0x80c7c2, stopMotionReference, stopMotion),
    motion(
      'moveObjectStraightToWaypoint 80:C6BF',
      0x80c6bf,
      moveObjectStraightToWaypointReference,
      moveObjectStraightToWaypoint,
    ),
    motion(
      'moveObjectToWaypoint 80:C6C4',
      0x80c6c4,
      moveObjectToWaypointReference,
      moveObjectToWaypoint,
    ),
    motion(
      'placeObjectOnWaypoint 80:D105',
      0x80d105,
      placeObjectOnWaypointReference,
      placeObjectOnWaypoint,
    ),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
