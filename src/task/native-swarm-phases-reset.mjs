import { leaf } from './native-leaf-support.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';
import { LONG_WRAP, WORD_MASK } from '../constants/bits.mjs';
import { CIRCLE_FOLLOWER_INDEX, CIRCLE_FOLLOWER_COUNTDOWN, SWARM_MEMBERS } from './wram.mjs';
import {
  FIRST_FOLLOWER_FRAMES,
  ORBIT_START_PHASE,
  ORBIT_PHASES_END,
} from './native-swarm-orbit-start.mjs';

const PHASE_BYTES = 2;

// 80:D622: reset the swarm orbit: no circle follower yet, the countdown to the first
// follower, and every one of the sixteen member phases at the start phase. The flags
// come from the last CPX.
export const resetSwarmPhases = (a, outerReturn = true) =>
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
