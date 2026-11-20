// The swarms' start and the circling leader (lifted from the script natives 80:D7DD,
// 80:D260 and 80:D63C; register-level references in proof/game-reference/swarm-start.mjs).
//
// A swarm's origin is an object (the first argument, with its flag bit masked): its X,
// Y and height become the swarm's origin (7E:1D0B on).
//
// The path swarm (D7DD) creates four members of kind 8C (106 with bit 7 of the
// argument) at a quarter of the unmasked object's position with the script 32F, clears
// its speeds and start phases and sets the goals of the position's start phase and
// speed to 100. The wave swarm (D260) creates twelve members of kind 4D (DF with bit 0)
// at A0, 17C and 40 with the scripts of 80:D2DD (from the fifth member on always the
// fifth), takes the origin as the wave's target and clears both phases and 7E:1D49. The
// members' slots (low bytes) go to 7E:1CEF on.
//
// The circling leader (D63C) moves on a circle: its speed is set to FFEC (the original's
// two unsigned limits always leave that), the circle phase advances by its speed word
// and the height phase by the speed; the height is the wave byte at the height phase
// over 2 plus 160, X and Y the wave bytes at the circle phase and a quarter period later
// plus 680 and AC8. It turns (80:AAAF) to the circle phase plus 20 in eighths. Every
// eighth call while the countdown 7E:1D33 is not negative a follower of kind 78 at 19B,
// 293 and 65 with the scripts of 80:D704 is created, eight in all.
//
// The objects are created by the lifted creation 80:A835 (src/game/object-create.mjs);
// the pushed registers and the return words of the JSRs lie on the stack as in the
// original.
import { createObject } from './object-create.mjs';
import { turnObject } from './object-turn.mjs';
import { PHASE_MASK, QUARTER_PHASE, WAVE_TABLE } from './object-bob.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import {
  CIRCLE_FOLLOWER_COUNTDOWN,
  CIRCLE_FOLLOWER_INDEX,
  CIRCLE_FOLLOWERS,
  CIRCLE_HEIGHT_PHASE,
  CIRCLE_LEADER,
  CIRCLE_PHASE,
  CIRCLE_PHASE_SPEED,
  CIRCLE_SPEED,
  DP_OBJECT_HEIGHT,
  DP_OBJECT_KIND,
  DP_OBJECT_SCRIPT,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  PATH_SPEED_HEIGHT,
  PATH_SPEED_HEIGHT_GOAL,
  PATH_SPEED_XY,
  PATH_SPEED_XY_GOAL,
  PATH_START_HEIGHT,
  PATH_START_HEIGHT_GOAL,
  PATH_START_XY,
  PATH_START_XY_GOAL,
  SWARM_FOUR_ORIGIN,
  SWARM_MEMBERS,
  SWARM_ORIGIN_HEIGHT,
  SWARM_ORIGIN_X,
  SWARM_ORIGIN_Y,
  SWARM_TWELVE_ORIGIN,
  WAVE_CLEARED,
  WAVE_PHASE,
  WAVE_SECOND_PHASE,
  WAVE_TARGET_HEIGHT,
  WAVE_TARGET_X,
  WAVE_TARGET_Y,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { objectWord, setObjectWord } from '../state/objects.mjs';

const MEMBER_BYTES = 2,
  DP_OBJECT = 0,
  DP_DIRECTION = 2;
// The path swarm (D7DD).
const FOUR_SWARM_FLAG = 0x80,
  FOUR_KIND = 0x8c,
  FOUR_FLAGGED_KIND = 0x106,
  FOUR_SCRIPT = 0x032f,
  FOUR_POSITION_SHIFT = 2,
  FOUR_MEMBERS_END = 8,
  FOUR_GOAL = 0x100;
// The wave swarm (D260).
const TWELVE_SWARM_FLAG = 1,
  TWELVE_KIND = 0x4d,
  TWELVE_FLAGGED_KIND = 0xdf,
  TWELVE_X = 0xa0,
  TWELVE_Y = 0x17c,
  TWELVE_HEIGHT = 0x40,
  TWELVE_SCRIPTS = 0xd2dd,
  TWELVE_LAST_SCRIPT = 8,
  TWELVE_MEMBERS_END = 0x18;
// The circling leader (D63C).
const CIRCLE_SPEED_LIMIT = 0x14,
  CIRCLE_SPEED_FLOOR = 0xffec,
  CIRCLE_HEIGHT_SHIFT = 1,
  CIRCLE_BASE_HEIGHT = 0x160,
  CIRCLE_BASE_X = 0x680,
  CIRCLE_BASE_Y = 0xac8,
  FACING_ROUNDING = 0x20,
  FACING_SHIFT = 2,
  FACING_MASK = 7,
  FOLLOWER_KIND = 0x78,
  FOLLOWER_X = 0x19b,
  FOLLOWER_Y = 0x293,
  FOLLOWER_HEIGHT = 0x65,
  FOLLOWER_SCRIPTS = 0xd704,
  FOLLOWER_INTERVAL = 8,
  FOLLOWERS_END = 0x10,
  NO_MORE_FOLLOWERS = WORD_MASK;

const word = (mem, at) => dataBankWord(mem, at);
const setWord = (mem, at, value) => setDataBankWord(mem, at, 0, value & WORD_MASK);
const dpWord = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setDpWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const waveByte = (mem, phase) => dataBankWord(mem, WAVE_TABLE, phase) & BYTE_MASK;

// The swarm's origin: the object (masked) kept, its position the origin. Returns the
// unmasked argument.
function takeOrigin(mem, mask, keep) {
  const argument = dpWord(mem.wram, DP_OBJECT),
    object = argument & mask;
  setWord(mem, keep, object);
  setWord(mem, SWARM_ORIGIN_X, objectWord(mem, 'x', object));
  setWord(mem, SWARM_ORIGIN_Y, objectWord(mem, 'y', object));
  setWord(mem, SWARM_ORIGIN_HEIGHT, objectWord(mem, 'height', object));
  return argument;
}
// Create the object of the direct page arguments. The calls' return words and the words
// the original pushes around them lie only in free stack bytes and are not reproduced
// (game state only, user decision 2026-11-17).
const create = (mem, a) => createObject(mem, mem.wram, a);
// The created member's slot (its low byte) at the member offset.
const keepMember = (mem, offset) =>
  setDataBankWord(mem, SWARM_MEMBERS, offset, dpWord(mem.wram, DP_OBJECT) & BYTE_MASK);

// 80:D7DD: start the path swarm around the object in word 00.
export function startPathSwarm(mem, a) {
  const { wram } = mem,
    argument = takeOrigin(mem, WORD_MASK ^ FOUR_SWARM_FLAG, SWARM_FOUR_ORIGIN);
  for (let offset = 0; offset !== FOUR_MEMBERS_END; offset += MEMBER_BYTES) {
    setDpWord(wram, DP_OBJECT_KIND, argument & FOUR_SWARM_FLAG ? FOUR_FLAGGED_KIND : FOUR_KIND);
    for (const [table, at] of [
      ['x', DP_OBJECT_X],
      ['y', DP_OBJECT_Y],
      ['height', DP_OBJECT_HEIGHT],
    ])
      setDpWord(wram, at, objectWord(mem, table, argument) >>> FOUR_POSITION_SHIFT);
    setDpWord(wram, DP_OBJECT_SCRIPT, FOUR_SCRIPT);
    create(mem, a);
    keepMember(mem, offset);
  }
  for (const at of [
    PATH_SPEED_XY,
    PATH_SPEED_HEIGHT,
    PATH_START_HEIGHT_GOAL,
    PATH_SPEED_HEIGHT_GOAL,
    PATH_START_XY,
    PATH_START_HEIGHT,
  ])
    setWord(mem, at, 0);
  setWord(mem, PATH_START_XY_GOAL, FOUR_GOAL);
  setWord(mem, PATH_SPEED_XY_GOAL, FOUR_GOAL);
}

// 80:D260: start the wave swarm around the object in word 00.
export function startWaveSwarm(mem, a) {
  const { wram } = mem,
    argument = takeOrigin(mem, BYTE_MASK ^ TWELVE_SWARM_FLAG, SWARM_TWELVE_ORIGIN);
  for (let offset = 0; offset !== TWELVE_MEMBERS_END; offset += MEMBER_BYTES) {
    setDpWord(
      wram,
      DP_OBJECT_KIND,
      argument & TWELVE_SWARM_FLAG ? TWELVE_FLAGGED_KIND : TWELVE_KIND,
    );
    setDpWord(wram, DP_OBJECT_X, TWELVE_X);
    setDpWord(wram, DP_OBJECT_Y, TWELVE_Y);
    setDpWord(wram, DP_OBJECT_HEIGHT, TWELVE_HEIGHT);
    setDpWord(
      wram,
      DP_OBJECT_SCRIPT,
      dataBankWord(mem, TWELVE_SCRIPTS, Math.min(offset, TWELVE_LAST_SCRIPT)),
    );
    create(mem, a);
    keepMember(mem, offset);
  }
  setWord(mem, WAVE_TARGET_X, word(mem, SWARM_ORIGIN_X));
  setWord(mem, WAVE_TARGET_Y, word(mem, SWARM_ORIGIN_Y));
  setWord(mem, WAVE_TARGET_HEIGHT, word(mem, SWARM_ORIGIN_HEIGHT));
  for (const at of [WAVE_PHASE, WAVE_SECOND_PHASE, WAVE_CLEARED]) setWord(mem, at, 0);
}

// 80:D63C: move the circling leader one step and, every eighth call, add a follower.
export function circleSwarmLeader(mem, a) {
  const { wram } = mem;
  let speed = word(mem, CIRCLE_SPEED);
  if (speed >= CIRCLE_SPEED_LIMIT) speed = CIRCLE_SPEED_LIMIT;
  if (speed < CIRCLE_SPEED_FLOOR) speed = CIRCLE_SPEED_FLOOR;
  setWord(mem, CIRCLE_SPEED, speed);
  setWord(
    mem,
    CIRCLE_PHASE,
    (word(mem, CIRCLE_PHASE) + word(mem, CIRCLE_PHASE_SPEED)) & PHASE_MASK,
  );
  const heightPhase = (word(mem, CIRCLE_HEIGHT_PHASE) + word(mem, CIRCLE_SPEED)) & PHASE_MASK;
  setWord(mem, CIRCLE_HEIGHT_PHASE, heightPhase);
  const leader = word(mem, CIRCLE_LEADER);
  setObjectWord(
    mem,
    'height',
    leader,
    (waveByte(mem, heightPhase) >>> CIRCLE_HEIGHT_SHIFT) + CIRCLE_BASE_HEIGHT,
  );
  setObjectWord(mem, 'x', leader, waveByte(mem, word(mem, CIRCLE_PHASE)) + CIRCLE_BASE_X);
  setObjectWord(
    mem,
    'y',
    leader,
    waveByte(mem, (word(mem, CIRCLE_PHASE) + QUARTER_PHASE) & PHASE_MASK) + CIRCLE_BASE_Y,
  );
  setDpWord(wram, DP_OBJECT, leader);
  // The facing: the phase plus half a facing, times four, its high byte (XBA).
  const facing =
    (((word(mem, CIRCLE_PHASE) + FACING_ROUNDING) & PHASE_MASK) << FACING_SHIFT) >>> BYTE_BITS;
  setDpWord(wram, DP_DIRECTION, facing & FACING_MASK);
  turnObject(mem, wram);
  if (word(mem, CIRCLE_FOLLOWER_COUNTDOWN) & WORD_SIGN) return;
  const count = (word(mem, CIRCLE_FOLLOWER_COUNTDOWN) - 1) & WORD_MASK;
  setWord(mem, CIRCLE_FOLLOWER_COUNTDOWN, count);
  if (count !== 0) return;
  const index = word(mem, CIRCLE_FOLLOWER_INDEX);
  setDpWord(wram, DP_OBJECT_KIND, FOLLOWER_KIND);
  setDpWord(wram, DP_OBJECT_X, FOLLOWER_X);
  setDpWord(wram, DP_OBJECT_Y, FOLLOWER_Y);
  setDpWord(wram, DP_OBJECT_HEIGHT, FOLLOWER_HEIGHT);
  setDpWord(wram, DP_OBJECT_SCRIPT, dataBankWord(mem, FOLLOWER_SCRIPTS, index));
  create(mem, a);
  setDataBankWord(mem, CIRCLE_FOLLOWERS, index, dpWord(wram, DP_OBJECT));
  const next = (index + MEMBER_BYTES) & WORD_MASK;
  setWord(mem, CIRCLE_FOLLOWER_INDEX, next);
  setWord(mem, CIRCLE_FOLLOWER_COUNTDOWN, FOLLOWER_INTERVAL);
  if (next === FOLLOWERS_END) setWord(mem, CIRCLE_FOLLOWER_COUNTDOWN, NO_MORE_FOLLOWERS);
}
