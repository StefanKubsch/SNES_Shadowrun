// Random per-function tests of the lifted karma, nuyen and magic point sums
// (src/game/party-funds.mjs through their natives in src/task) against their
// register-level references (proof/game-reference/party-funds.mjs): 80:CDB2 (karma),
// 80:CCDB (nuyen) and 80:8B8A (the shown member's magic points). Both sides run the
// native from its script call (data bank 80, direct page 0, the RTS frame). Game state
// only (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  addKarmaReference,
  addMagicPointsReference,
  addNuyenReference,
} from '../proof/game-reference/party-funds.mjs';
import { addKarma } from '../src/task/native-karma-add.mjs';
import { addNuyen } from '../src/task/native-nuyen-add.mjs';
import { addMagicPoints } from '../src/task/native-magic-points-add.mjs';
import { MEMBER_INDEX, NUYEN } from '../src/task/wram.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  MEMBERS = 13;

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // The nuyen's high word near its wrap (FFFF: the saturation), the member shown one
  // of the runners or any word.
  if (rnd(2)) setWord(wram, NUYEN + 2, WORD - 1 - rnd(2));
  setWord(wram, MEMBER_INDEX, [2 * rnd(MEMBERS), rnd(WORD)][rnd(2)]);
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const sum = (name, entry, reference, run) => ({
  name,
  entry,
  samples: 400,
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
    sum('addKarma 80:CDB2', 0x80cdb2, addKarmaReference, addKarma),
    sum('addNuyen 80:CCDB', 0x80ccdb, addNuyenReference, addNuyen),
    sum('addMagicPoints 80:8B8A', 0x808b8a, addMagicPointsReference, addMagicPoints),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
