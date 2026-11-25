// Random per-function tests of the lifted bobbing and orbit natives
// (src/game/object-bob.mjs through their natives in src/task) against their register-level
// references (proof/game-reference/object-bob.mjs): 80:D714 and 80:D73B (bob) and the
// orbit entries 80:D769 to 80:D793 (slots 0 to 14). Both sides run the native from its
// script call (data bank 80, direct page 0, the RTS frame). Game state only
// (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import {
  advanceOrbitReference,
  bobObjectReference,
  bobSecondObjectReference,
} from '../proof/game-reference/object-bob.mjs';
import { bobObject, bobSecondObject } from '../src/script/native-object-bob.mjs';
import { advanceOrbit, D796_ENTRIES } from '../src/script/native-orbit.mjs';
import { BOB_PHASE, BOB_SECOND_PHASE, SWARM_MEMBERS } from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  SLOTS = 44,
  PHASES = 0x200;

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // An object of the game's slots; the phases inside the wave table or any word.
  setWord(wram, 0, 2 * rnd(SLOTS));
  for (const at of [
    BOB_PHASE,
    BOB_SECOND_PHASE,
    ...[...D796_ENTRIES.values()].map((slot) => SWARM_MEMBERS + slot),
  ])
    setWord(wram, at, [rnd(PHASES), rnd(WORD)][rnd(2)]);
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const step = (name, entry, reference, run) => ({
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
    step('bobObject 80:D714', 0x80d714, bobObjectReference, bobObject),
    step('bobSecondObject 80:D73B', 0x80d73b, bobSecondObjectReference, bobSecondObject),
    ...[...D796_ENTRIES].map(([entry, slot]) =>
      step(
        `advanceOrbit ${(entry >>> 16).toString(HEX).toUpperCase()}:${(entry & 0xffff)
          .toString(HEX)
          .toUpperCase()}`,
        entry,
        (a, o) => advanceOrbitReference(a, slot, o),
        (a, o) => advanceOrbit(a, slot, o),
      ),
    ),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
