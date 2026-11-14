// The swarm's setup by scripts (lifted from the script natives 80:D97C, 80:D985, 80:D98E,
// 80:D997, 80:D604 and 80:D622; register-level references in
// proof/game-reference/swarm-setup.mjs).
//
// A swarm's path and height follow waves whose start phase and speed step towards four
// goals (7E:1D41 to 7E:1D47); a script sets each goal as a wave word index (the argument
// with only bits 1 to 8 kept). The orbit reset clears the circle follower index, sets the
// countdown to the first follower to 64 frames and puts the sixteen member phases at
// 180. The orbit start (80:D604) takes the leader object, sets the circle phase to 100 and
// clears the height phase, both bob phases and the two circle speeds before the reset.
// All of these words lie in the low WRAM the data bank 80 mirrors.
import { setDataBankWord } from '../system/data-bank.mjs';
import {
  BOB_PHASE,
  BOB_SECOND_PHASE,
  CIRCLE_FOLLOWER_COUNTDOWN,
  CIRCLE_FOLLOWER_INDEX,
  CIRCLE_HEIGHT_PHASE,
  CIRCLE_LEADER,
  CIRCLE_PHASE,
  CIRCLE_PHASE_SPEED,
  CIRCLE_SPEED,
  PATH_SPEED_HEIGHT_GOAL,
  PATH_SPEED_XY_GOAL,
  PATH_START_HEIGHT_GOAL,
  PATH_START_XY_GOAL,
  SWARM_MEMBERS,
} from '../task/wram.mjs';
import { HALF_PHASE, WAVE_WORD_INDEX_MASK } from './object-bob.mjs';

// Frames to the first circle follower, the start phase of the sixteen member phases and
// their end offset.
export const FIRST_FOLLOWER_FRAMES = 0x64,
  ORBIT_START_PHASE = 0x180,
  ORBIT_PHASES_END = 0x20;
const PHASE_BYTES = 2,
  CIRCLE_START_PHASE = HALF_PHASE;
// The return word of 80:D604's JSR to the reset (the bank offset of its last byte).
const RESET_RETURN = 0xd620;

const setGoal = (mem, goal, value) => setDataBankWord(mem, goal, 0, value & WAVE_WORD_INDEX_MASK);

// 80:D97C: the goal of the height wave's start phase.
export const setSwarmHeightPhaseGoal = (mem, value) => setGoal(mem, PATH_START_HEIGHT_GOAL, value);
// 80:D985: the goal of the path wave's start phase.
export const setSwarmPathPhaseGoal = (mem, value) => setGoal(mem, PATH_START_XY_GOAL, value);
// 80:D98E: the goal of the path wave's speed.
export const setSwarmPathSpeedGoal = (mem, value) => setGoal(mem, PATH_SPEED_XY_GOAL, value);
// 80:D997: the goal of the height wave's speed.
export const setSwarmHeightSpeedGoal = (mem, value) => setGoal(mem, PATH_SPEED_HEIGHT_GOAL, value);

// 80:D622: reset the swarm orbit.
export function resetSwarmOrbit(mem) {
  setDataBankWord(mem, CIRCLE_FOLLOWER_INDEX, 0, 0);
  setDataBankWord(mem, CIRCLE_FOLLOWER_COUNTDOWN, 0, FIRST_FOLLOWER_FRAMES);
  for (let phase = 0; phase < ORBIT_PHASES_END; phase += PHASE_BYTES)
    setDataBankWord(mem, SWARM_MEMBERS, phase, ORBIT_START_PHASE);
}

// 80:D604: start the swarm orbit around the leader object; a takes the reset's call frame.
export function startSwarmOrbit(mem, a, leader) {
  setDataBankWord(mem, CIRCLE_LEADER, 0, leader);
  setDataBankWord(mem, CIRCLE_PHASE, 0, CIRCLE_START_PHASE);
  for (const word of [
    CIRCLE_HEIGHT_PHASE,
    BOB_PHASE,
    BOB_SECOND_PHASE,
    CIRCLE_SPEED,
    CIRCLE_PHASE_SPEED,
  ])
    setDataBankWord(mem, word, 0, 0);
  a.pushWord(RESET_RETURN);
  resetSwarmOrbit(mem);
  a.pullWord();
}
