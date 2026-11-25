// Random per-function tests of the lifted swarm setup natives (src/game/swarm-setup.mjs
// through their natives in src/task) against the frozen outcomes (tools/lift-vectors/) of their former register-level references
// (proof/game-reference/swarm-setup.mjs): the wave goals 80:D97C, 80:D985, 80:D98E and
// 80:D997, the orbit reset 80:D622 and the orbit start 80:D604. Both sides run the native from its script call
// (data bank 80, direct page 0, the RTS frame). Game state only (docs/STRATEGY.md,
// 2026-11-14): WRAM outside the stacks, the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { setSwarmHeightPhaseTarget } from '../src/script/native-swarm-height-phase-target.mjs';
import { setSwarmPathPhaseTarget } from '../src/script/native-swarm-path-phase-target.mjs';
import { setSwarmPathSpeedTarget } from '../src/script/native-swarm-path-speed-target.mjs';
import { setSwarmHeightSpeedTarget } from '../src/script/native-swarm-height-speed-target.mjs';
import { resetSwarmPhases } from '../src/script/native-swarm-phases-reset.mjs';
import { startSwarmOrbit } from '../src/script/native-swarm-orbit-start.mjs';

useLiftVectors(import.meta.url);

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
const setup = (name, entry, run) => ({
  name,
  entry,
  samples: 200,
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
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
    setup('setSwarmHeightPhaseTarget 80:D97C', 0x80d97c, setSwarmHeightPhaseTarget),
    setup('setSwarmPathPhaseTarget 80:D985', 0x80d985, setSwarmPathPhaseTarget),
    setup('setSwarmPathSpeedTarget 80:D98E', 0x80d98e, setSwarmPathSpeedTarget),
    setup('setSwarmHeightSpeedTarget 80:D997', 0x80d997, setSwarmHeightSpeedTarget),
    setup('resetSwarmPhases 80:D622', 0x80d622, resetSwarmPhases),
    setup('startSwarmOrbit 80:D604', 0x80d604, startSwarmOrbit),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
