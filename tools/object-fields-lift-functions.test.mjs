// Random per-function tests of the lifted object field script natives
// (src/game/object-fields.mjs through src/task/native-object-flags-*.mjs) against their
// register-level references (proof/game-reference/object-fields.mjs): the flag word's
// get 80:CA05, set 80:CA0D, OR 80:CA15 and AND 80:CA20. Both sides run the native from
// its script call (data bank 80, direct page 0, the RTS frame). Game state only
// (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return (program counter and stack pointer) must be equal; the script interpreter
// replaces the registers the natives leave.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  getObjectFlagsReference,
  keepObjectFlagBitsReference,
  setObjectFlagBitsReference,
  setObjectFlagsReference,
} from '../proof/game-reference/object-fields.mjs';
import { getObjectFlags } from '../src/task/native-object-flags-get.mjs';
import { setObjectFlags } from '../src/task/native-object-flags-set.mjs';
import { setObjectFlagBits } from '../src/task/native-object-flags-or.mjs';
import { keepObjectFlagBits } from '../src/task/native-object-flags-and.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  // Indices below this reach the flag table's low WRAM mirror (7E:1458 + index < 2000).
  LOW_WRAM_INDICES = 0x0ba8,
  IGNORED = [];

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // An object of the game's slots, none (FFFF) or any index in the low WRAM mirror.
  setWord(wram, 0, [2 * rnd(44), 2 * rnd(44), 0xffff, rnd(LOW_WRAM_INDICES)][rnd(4)]);
  setWord(wram, 2, rnd(WORD));
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const lifted = (run) => (h, input) => {
  Object.assign(h.ctx, input);
  h.ctx.programBank = CODE_BANK;
  h.push(CALLER_RETURN, 2);
  run(h.a, false);
  return returned(h);
};
const field = (name, entry, reference, run) => ({
  name,
  entry,
  samples: 400,
  reference: (h) => reference(h.a, false),
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
  result: returned,
  lifted: lifted(run),
});
registerCases(
  [
    field('getObjectFlags 80:CA05', 0x80ca05, getObjectFlagsReference, getObjectFlags),
    field('setObjectFlags 80:CA0D', 0x80ca0d, setObjectFlagsReference, setObjectFlags),
    field('setObjectFlagBits 80:CA15', 0x80ca15, setObjectFlagBitsReference, setObjectFlagBits),
    field('keepObjectFlagBits 80:CA20', 0x80ca20, keepObjectFlagBitsReference, keepObjectFlagBits),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
