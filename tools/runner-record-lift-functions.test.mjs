// Random per-function tests of the lifted script natives 80:D067 (the Strength of a runner
// object, src/game/runner-state.mjs) and 80:D186 (the player object after a BRK,
// src/game/script-queries.mjs) through their natives in src/task against their
// register-level references (proof/game-reference/script-starts.mjs). Both sides run the
// native from its script call (data bank 80, direct page 0, the RTS frame). Game state
// only (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return must be equal.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import {
  getPlayerObjectAfterBreakReference,
  getRunnerStrengthReference,
} from '../proof/game-reference/script-starts.mjs';
import { getRunnerStrength } from '../src/script/native-runner-record-byte.mjs';
import { getPlayerObjectAfterBreak } from '../src/script/native-player-object-break.mjs';
import { OBJECT_NUMBER } from '../src/data/wram.mjs';
import { RUNNERS, RUNNER_OBJECT_NUMBERS } from '../src/data/runners.mjs';

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  SLOTS = 44,
  ROM_MEMORY = new DialogTestMemory(new Uint8Array(WRAM_BYTES));

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
const romWord = (at) => ROM_MEMORY.read8(at) | (ROM_MEMORY.read8(at + 1) << 8);
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // An object of a runner of the table (its record in ROM or WRAM) or any number.
  const object = pick([2 * rnd(SLOTS), 2 * rnd(SLOTS), 2 * rnd(SLOTS), rnd(WORD)]);
  setWord(wram, 0, object);
  if (object < 2 * SLOTS)
    setWord(
      wram,
      OBJECT_NUMBER + object,
      rnd(8) ? romWord((CODE_BANK << 16) | (RUNNER_OBJECT_NUMBERS + 2 * rnd(RUNNERS))) : rnd(WORD),
    );
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const step = (name, entry, reference, run) => ({
  name,
  entry,
  samples: 500,
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
    step('getRunnerStrength 80:D067', 0x80d067, getRunnerStrengthReference, getRunnerStrength),
    step(
      'getPlayerObjectAfterBreak 80:D186',
      0x80d186,
      getPlayerObjectAfterBreakReference,
      getPlayerObjectAfterBreak,
    ),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
