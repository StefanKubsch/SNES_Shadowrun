// Random per-function tests of the lifted swarm setup natives (src/game/swarm-setup.mjs
// through their natives in src/task) against their register-level references
// (proof/game-reference/swarm-setup.mjs): the wave goals 80:D97C, 80:D985, 80:D98E and
// 80:D997 and the orbit reset 80:D622. Both sides run the native from its script call
// (data bank 80, direct page 0, the RTS frame). Game state only (docs/STRATEGY.md,
// 2026-11-14): WRAM outside the stacks, the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  resetSwarmPhasesReference,
  setSwarmHeightPhaseTargetReference,
  setSwarmHeightSpeedTargetReference,
  setSwarmPathPhaseTargetReference,
  setSwarmPathSpeedTargetReference,
} from '../proof/game-reference/swarm-setup.mjs';
import { setSwarmHeightPhaseTarget } from '../src/task/native-swarm-height-phase-target.mjs';
import { setSwarmPathPhaseTarget } from '../src/task/native-swarm-path-phase-target.mjs';
import { setSwarmPathSpeedTarget } from '../src/task/native-swarm-path-speed-target.mjs';
import { setSwarmHeightSpeedTarget } from '../src/task/native-swarm-height-speed-target.mjs';
import { resetSwarmPhases } from '../src/task/native-swarm-phases-reset.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234;

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const setup = (name, entry, reference, run) => ({
  name,
  entry,
  samples: 200,
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
    setup(
      'setSwarmHeightPhaseTarget 80:D97C',
      0x80d97c,
      setSwarmHeightPhaseTargetReference,
      setSwarmHeightPhaseTarget,
    ),
    setup(
      'setSwarmPathPhaseTarget 80:D985',
      0x80d985,
      setSwarmPathPhaseTargetReference,
      setSwarmPathPhaseTarget,
    ),
    setup(
      'setSwarmPathSpeedTarget 80:D98E',
      0x80d98e,
      setSwarmPathSpeedTargetReference,
      setSwarmPathSpeedTarget,
    ),
    setup(
      'setSwarmHeightSpeedTarget 80:D997',
      0x80d997,
      setSwarmHeightSpeedTargetReference,
      setSwarmHeightSpeedTarget,
    ),
    setup('resetSwarmPhases 80:D622', 0x80d622, resetSwarmPhasesReference, resetSwarmPhases),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
