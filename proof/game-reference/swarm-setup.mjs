// Register-level references of the swarm setup's script natives (moved from
// src/task/native-swarm-*-target.mjs and native-swarm-phases-reset.mjs; lifted in
// src/game/swarm-setup.mjs). The proof plans and the Native58 dispatch of
// proof/task/native-dispatch.mjs run these; the game runs the lifted natives.
import { FIRST_ARGUMENT, leaf } from '../../src/task/native-leaf-support.mjs';
import { FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';
import { LONG_WRAP, WORD_MASK } from '../../src/constants/bits.mjs';
import {
  CIRCLE_FOLLOWER_COUNTDOWN,
  CIRCLE_FOLLOWER_INDEX,
  PATH_SPEED_HEIGHT_GOAL,
  PATH_SPEED_XY_GOAL,
  PATH_START_HEIGHT_GOAL,
  PATH_START_XY_GOAL,
  SWARM_MEMBERS,
} from '../../src/task/wram.mjs';
import { WAVE_WORD_INDEX_MASK } from '../../src/task/native-object-bob.mjs';
import {
  FIRST_FOLLOWER_FRAMES,
  ORBIT_START_PHASE,
  ORBIT_PHASES_END,
} from '../../src/task/native-swarm-orbit-start.mjs';

const PHASE_BYTES = 2;

// 80:D97C: set the target wave phase of the swarm height to the first argument as a wave index.
export const setSwarmHeightPhaseTargetReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const phase = h.load(h.dp(FIRST_ARGUMENT) & WAVE_WORD_INDEX_MASK);
      a.writeWord(h.abs(PATH_START_HEIGHT_GOAL), phase, LONG_WRAP, 'leaf-selection');
    },
    outerReturn,
  );
// 80:D985: set the target wave phase of the swarm path (X/Y) to the first argument as a wave index.
export const setSwarmPathPhaseTargetReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const phase = h.load(h.dp(FIRST_ARGUMENT) & WAVE_WORD_INDEX_MASK);
      h.longWrite(h.abs(PATH_START_XY_GOAL), phase);
    },
    outerReturn,
  );
// 80:D98E: set the target wave speed of the swarm path (X/Y) to the first argument as a wave index.
export const setSwarmPathSpeedTargetReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const speed = h.load(h.dp(FIRST_ARGUMENT) & WAVE_WORD_INDEX_MASK);
      h.longWrite(h.abs(PATH_SPEED_XY_GOAL), speed);
    },
    outerReturn,
  );
// 80:D997: set the target wave speed of the swarm height to the first argument as a wave index.
export const setSwarmHeightSpeedTargetReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const speed = h.load(h.dp(FIRST_ARGUMENT) & WAVE_WORD_INDEX_MASK);
      a.writeWord(h.abs(PATH_SPEED_HEIGHT_GOAL), speed, LONG_WRAP, 'leaf-selection');
    },
    outerReturn,
  );
// 80:D622: reset the swarm orbit: no circle follower yet, the countdown to the first
// follower, and every one of the sixteen member phases at the start phase. The flags
// come from the last CPX.
export const resetSwarmPhasesReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      a.writeWord(h.abs(CIRCLE_FOLLOWER_INDEX), 0, LONG_WRAP, 'leaf-reset-zero');
      const frames = h.load(FIRST_FOLLOWER_FRAMES);
      a.writeWord(h.abs(CIRCLE_FOLLOWER_COUNTDOWN), frames, LONG_WRAP, 'leaf-reset-count');
      let phase = h.index('x', 0);
      const start = h.load(ORBIT_START_PHASE);
      do {
        a.writeWord(h.abs(SWARM_MEMBERS) + phase, start, LONG_WRAP, 'leaf-reset-record');
        phase = h.index('x', (phase + PHASE_BYTES) & WORD_MASK);
        h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(phase >= ORBIT_PHASES_END);
        h.nz((phase - ORBIT_PHASES_END) & WORD_MASK);
      } while (phase !== ORBIT_PHASES_END);
    },
    outerReturn,
  );
