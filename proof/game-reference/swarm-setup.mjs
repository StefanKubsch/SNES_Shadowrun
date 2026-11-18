// Register-level references of the swarm setup's script natives (moved from
// src/task/native-swarm-*-target.mjs, native-swarm-phases-reset.mjs and
// native-swarm-orbit-start.mjs; lifted in
// src/game/swarm-setup.mjs). The proof plans and the Native58 dispatch of
// proof/task/native-dispatch.mjs run these; the game runs the lifted natives.
import { FIRST_ARGUMENT, leaf } from '../system/native-leaf-support.mjs';
import { taskSelectionSupport } from '../script/native-object-turn.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import { LONG_WRAP, WORD_MASK } from '../../src/constants/bits.mjs';
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
} from '../../src/data/wram.mjs';
import { HALF_PHASE, WAVE_WORD_INDEX_MASK } from '../../src/game/object-bob.mjs';
import {
  FIRST_FOLLOWER_FRAMES,
  ORBIT_START_PHASE,
  ORBIT_PHASES_END,
} from '../../src/game/swarm-setup.mjs';

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

const CIRCLE_START_PHASE = HALF_PHASE,
  CLEAR_RETURN_WORD = 0x80d620 & WORD_MASK;
// 80:D604: start the swarm orbit around the leader object (first argument): leader to
// CIRCLE_LEADER, circle phase 0100, height phase, bob phases and speeds cleared; then
// the real JSR 80:D622 resets the followers and member phases (body inlined here).
export const startSwarmOrbitReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        k = taskSelectionSupport(h);
      h.load(h.dp(FIRST_ARGUMENT));
      h.longWrite(h.abs(CIRCLE_LEADER), ctx.a);
      h.load(CIRCLE_START_PHASE);
      h.longWrite(h.abs(CIRCLE_PHASE), ctx.a);
      for (const offset of [
        CIRCLE_HEIGHT_PHASE,
        BOB_PHASE,
        BOB_SECOND_PHASE,
        CIRCLE_SPEED,
        CIRCLE_PHASE_SPEED,
      ])
        h.longWrite(h.abs(offset), 0);
      k.call(CLEAR_RETURN_WORD, () => {
        h.longWrite(h.abs(CIRCLE_FOLLOWER_INDEX), 0);
        h.load(FIRST_FOLLOWER_FRAMES);
        h.longWrite(h.abs(CIRCLE_FOLLOWER_COUNTDOWN), ctx.a);
        h.index('x', 0);
        h.load(ORBIT_START_PHASE);
        do {
          h.longWrite(h.abs(SWARM_MEMBERS) + ctx.x, ctx.a);
          h.index('x', ctx.x + 2);
          h.nz((ctx.x - ORBIT_PHASES_END) & WORD_MASK);
          ctx.status = (ctx.status & ~FLAG_CARRY) | Number(ctx.x >= ORBIT_PHASES_END);
        } while (!(ctx.status & FLAG_ZERO));
      });
    },
    outerReturn,
  );
