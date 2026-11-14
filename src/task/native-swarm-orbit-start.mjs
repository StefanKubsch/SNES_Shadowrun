import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { taskSelectionSupport } from './native-object-turn.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { WORD_MASK } from '../constants/bits.mjs';
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
  SWARM_MEMBERS,
} from './wram.mjs';
import { HALF_PHASE } from './native-object-bob.mjs';
// Shared with resetSwarmPhases (80:D622, native-swarm-phases-reset.mjs): frames to the
// first circle follower, start phase of the sixteen member phases and their end offset.
export const FIRST_FOLLOWER_FRAMES = 0x64,
  ORBIT_START_PHASE = 0x180,
  ORBIT_PHASES_END = 0x20;
const CIRCLE_START_PHASE = HALF_PHASE,
  CLEAR_RETURN_WORD = 0x80d620 & WORD_MASK;
// 80:D604: start the swarm orbit around the leader object (first argument): leader to
// CIRCLE_LEADER, circle phase 0100, height phase, bob phases and speeds cleared; then
// the real JSR 80:D622 resets the followers and member phases (body inlined here).
export const startSwarmOrbit = (a, outerReturn = true) =>
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
