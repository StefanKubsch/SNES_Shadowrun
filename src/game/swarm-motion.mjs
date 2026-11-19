// The swarms' motion each frame (lifted from the script natives 80:D85B and 80:D2E7;
// register-level references in proof/game-reference/swarm-motion.mjs).
//
// Both read the wave table 80:D3D1 (src/game/object-bob.mjs) and place the swarm's member
// objects (7E:1CEF on, a slot word each).
//
// Along a path (D85B): the running position starts at the origin (X and Y doubled, the
// height quadrupled) and the phases at their start values. For each of five members the
// wave bytes at the position phase, a quarter period later and the height phase, less 40,
// are added to the running X, Y and height; halved (the height quartered) they place the
// member. The phases then advance by the wave byte at their speed (a speed of 80 read as
// 81) over 4 less 10, and over 2 less 20. Afterwards both speeds and both start phases
// step by 2 towards their goals (7E:1D41 to 7E:1D47).
//
// As a wave (D2E7): a first argument of 1 only sets the wave's target position from the
// room's point list (the long pointer at the direct page F3, the point of the second
// argument, six bytes each; X, Y and height at 1, 3 and 5, each times four). Otherwise
// the origin's X and Y step by 2 towards the target (down when not below it), the
// running position starts at the origin, and the two phases advance by A and by -8. Each
// of thirteen members takes the height of the wave bytes at both member phases plus E8,
// the running X and the running Y, which steps down by 18 per member; the member phases
// advance by FFE and 1E. The first member's height adds the carry of the second phase's
// step, as the original's ADC without CLC.
//
// Every word is read fresh in the original's order: a member slot far out of range
// writes over the swarm's own words through the low WRAM mirror.
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { pointerWord } from '../system/open-bus.mjs';
import { PHASE_MASK, QUARTER_PHASE, WAVE_TABLE } from './object-bob.mjs';
import {
  OBJECT_HEIGHT,
  OBJECT_X,
  OBJECT_Y,
  PATH_PHASE_HEIGHT,
  PATH_PHASE_XY,
  PATH_SPEED_HEIGHT,
  PATH_SPEED_HEIGHT_GOAL,
  PATH_SPEED_XY,
  PATH_SPEED_XY_GOAL,
  PATH_START_HEIGHT,
  PATH_START_HEIGHT_GOAL,
  PATH_START_XY,
  PATH_START_XY_GOAL,
  SWARM_HEIGHT,
  SWARM_MEMBERS,
  SWARM_ORIGIN_HEIGHT,
  SWARM_ORIGIN_X,
  SWARM_ORIGIN_Y,
  SWARM_X,
  SWARM_Y,
  WAVE_HEIGHT_PART,
  WAVE_MEMBER_PHASE,
  WAVE_MEMBER_SECOND_PHASE,
  WAVE_PHASE,
  WAVE_SECOND_PHASE,
  WAVE_TARGET_HEIGHT,
  WAVE_TARGET_X,
  WAVE_TARGET_Y,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

const MEMBER_BYTES = 2,
  STEP = 2;
// Along a path: the wave's centre, the phase biases and the members' end offset.
const WAVE_CENTRE = 0x40,
  XY_PHASE_BIAS = 0x10,
  HEIGHT_PHASE_BIAS = 0x20,
  XY_SPEED_SHIFT = 2,
  HEIGHT_SPEED_SHIFT = 1,
  XY_SHIFT = 1,
  HEIGHT_SHIFT = 2,
  PATH_MEMBERS_END = 0x0a;
// As a wave: the target mode, the point list pointer, the phase steps, the base height,
// the members' spacing and their end offset.
const SET_TARGET = 1,
  DP_POINT_LIST = 0xf3,
  DP_POINT_LIST_BANK = DP_POINT_LIST + 2,
  POINT_SHIFT = 2,
  WAVE_PHASE_STEP = 0x0a,
  WAVE_SECOND_PHASE_STEP = 0xfff8,
  WAVE_BASE_HEIGHT = 0xe8,
  WAVE_MEMBER_SPACING = 0x18,
  WAVE_MEMBER_PHASE_STEP = 0x0ffe,
  WAVE_MEMBER_SECOND_PHASE_STEP = 0x1e,
  WAVE_MEMBERS_END = 0x1a;
// The point's X, Y and height words (offsets in its entry).
const POINT_FIELDS = [
  [1, WAVE_TARGET_X],
  [3, WAVE_TARGET_Y],
  [5, WAVE_TARGET_HEIGHT],
];

const word = (mem, at) => dataBankWord(mem, at);
const setWord = (mem, at, value) => setDataBankWord(mem, at, 0, value & WORD_MASK);
const waveByte = (mem, phase) => dataBankWord(mem, WAVE_TABLE, phase) & BYTE_MASK;
const member = (mem, offset) => dataBankWord(mem, SWARM_MEMBERS, offset);

// 80:D85B: move the swarm along its path.
export function moveSwarmAlongPath(mem) {
  setWord(mem, SWARM_X, word(mem, SWARM_ORIGIN_X) << 1);
  setWord(mem, SWARM_Y, word(mem, SWARM_ORIGIN_Y) << 1);
  setWord(mem, SWARM_HEIGHT, word(mem, SWARM_ORIGIN_HEIGHT) << 2);
  setWord(mem, PATH_PHASE_XY, word(mem, PATH_START_XY));
  setWord(mem, PATH_PHASE_HEIGHT, word(mem, PATH_START_HEIGHT));
  for (let offset = 0; offset !== PATH_MEMBERS_END; offset += MEMBER_BYTES) {
    const axis = (phase, sum, field, shift) => {
      const value = (waveByte(mem, phase) - WAVE_CENTRE + word(mem, sum)) & WORD_MASK;
      setWord(mem, sum, value);
      setDataBankWord(mem, field, member(mem, offset), value >>> shift);
    };
    axis(word(mem, PATH_PHASE_XY) & PHASE_MASK, SWARM_X, OBJECT_X, XY_SHIFT);
    axis((word(mem, PATH_PHASE_XY) + QUARTER_PHASE) & PHASE_MASK, SWARM_Y, OBJECT_Y, XY_SHIFT);
    axis(word(mem, PATH_PHASE_HEIGHT) & PHASE_MASK, SWARM_HEIGHT, OBJECT_HEIGHT, HEIGHT_SHIFT);
    const advance = (speed, shift, bias, phase) => {
      let at = word(mem, speed) & PHASE_MASK;
      if (at === QUARTER_PHASE) at++;
      setWord(mem, phase, (waveByte(mem, at) >>> shift) - bias + word(mem, phase));
    };
    advance(PATH_SPEED_XY, XY_SPEED_SHIFT, XY_PHASE_BIAS, PATH_PHASE_XY);
    advance(PATH_SPEED_HEIGHT, HEIGHT_SPEED_SHIFT, HEIGHT_PHASE_BIAS, PATH_PHASE_HEIGHT);
  }
  for (const [value, goal] of [
    [PATH_SPEED_XY, PATH_SPEED_XY_GOAL],
    [PATH_SPEED_HEIGHT, PATH_SPEED_HEIGHT_GOAL],
    [PATH_START_HEIGHT, PATH_START_HEIGHT_GOAL],
    [PATH_START_XY, PATH_START_XY_GOAL],
  ]) {
    const current = word(mem, value),
      target = word(mem, goal);
    if (current !== target) setWord(mem, value, current > target ? current - STEP : current + STEP);
  }
}

// 80:D2E7: move the swarm as a wave, or set the wave's target (first argument 1, the
// point in the second). The members' PHY pushes lie only in free stack bytes and are not
// reproduced (game state only).
export function moveSwarmWave(mem, mode, point) {
  const { wram } = mem;
  if (mode === SET_TARGET) {
    // Six times the point by ASL three times and two SBCs, the second keeping the
    // borrow of the first.
    const eight = (point << 3) & WORD_MASK,
      first = eight - point,
      entry = (first - point - (first < 0 ? 1 : 0)) & WORD_MASK;
    for (const [offset, target] of POINT_FIELDS) {
      const pointer =
        wram[DP_POINT_LIST] |
        (wram[DP_POINT_LIST + 1] << BYTE_BITS) |
        (wram[DP_POINT_LIST_BANK] << WORD_BITS);
      setWord(mem, target, pointerWord(mem, pointer, (entry + offset) & WORD_MASK) << POINT_SHIFT);
    }
    return;
  }
  for (const [origin, target] of [
    [SWARM_ORIGIN_X, WAVE_TARGET_X],
    [SWARM_ORIGIN_Y, WAVE_TARGET_Y],
  ]) {
    const value = word(mem, origin);
    setWord(mem, origin, value >= word(mem, target) ? value - STEP : value + STEP);
  }
  setWord(mem, SWARM_X, word(mem, SWARM_ORIGIN_X));
  setWord(mem, SWARM_Y, word(mem, SWARM_ORIGIN_Y));
  setWord(mem, SWARM_HEIGHT, word(mem, SWARM_ORIGIN_HEIGHT));
  const phase = (word(mem, WAVE_PHASE) + WAVE_PHASE_STEP) & PHASE_MASK;
  setWord(mem, WAVE_PHASE, phase);
  setWord(mem, WAVE_MEMBER_PHASE, phase);
  const secondSum = word(mem, WAVE_SECOND_PHASE) + WAVE_SECOND_PHASE_STEP,
    second = secondSum & PHASE_MASK;
  setWord(mem, WAVE_SECOND_PHASE, second);
  setWord(mem, WAVE_MEMBER_SECOND_PHASE, second);
  // The carry into the first member's height: the second phase's step; later members
  // follow the comparison of the member offset (below the end: clear).
  let carry = secondSum > WORD_MASK ? 1 : 0;
  for (let offset = 0; offset !== WAVE_MEMBERS_END; offset += MEMBER_BYTES) {
    setWord(mem, WAVE_HEIGHT_PART, waveByte(mem, word(mem, WAVE_MEMBER_PHASE)));
    const height =
      waveByte(mem, word(mem, WAVE_MEMBER_SECOND_PHASE)) + word(mem, WAVE_HEIGHT_PART) + carry;
    const slot = member(mem, offset);
    setDataBankWord(mem, OBJECT_HEIGHT, slot, (height + WAVE_BASE_HEIGHT) & WORD_MASK);
    setDataBankWord(mem, OBJECT_X, slot, word(mem, SWARM_X));
    const y = (word(mem, SWARM_Y) - WAVE_MEMBER_SPACING) & WORD_MASK;
    setWord(mem, SWARM_Y, y);
    setDataBankWord(mem, OBJECT_Y, slot, y);
    setWord(
      mem,
      WAVE_MEMBER_PHASE,
      (word(mem, WAVE_MEMBER_PHASE) + WAVE_MEMBER_PHASE_STEP) & PHASE_MASK,
    );
    setWord(
      mem,
      WAVE_MEMBER_SECOND_PHASE,
      (word(mem, WAVE_MEMBER_SECOND_PHASE) + WAVE_MEMBER_SECOND_PHASE_STEP) & PHASE_MASK,
    );
    carry = 0;
  }
}
