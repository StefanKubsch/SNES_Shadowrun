// Random per-function tests of the lifted fight list queries (src/game/fight-list.mjs
// through their natives in src/task) against their register-level references
// (proof/game-reference/fight-list-queries.mjs): 80:8656 (in the list), 80:866F (a target
// on screen) and 80:8631 (the previous object). Both sides run the native from its script
// call (data bank 80, direct page 0, the RTS frame). Game state only (docs/STRATEGY.md,
// 2026-11-14): WRAM outside the stacks, the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import {
  getPreviousFightObjectReference,
  hasFightTargetReference,
  isInFightListReference,
} from '../proof/game-reference/fight-list-queries.mjs';
import { isInFightList } from '../src/script/native-fight-list-contains.mjs';
import { hasFightTarget } from '../src/script/native-fight-list-any-active.mjs';
import { getPreviousFightObject } from '../src/script/native-fight-list-previous.mjs';
import { FIGHT_LIST, FIGHT_LIST_INDEX } from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  SLOTS = 44,
  // The list stays below the hardware registers at 80:2000 (at most 38 objects).
  ENTRIES = 38;

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // A list of game slots (the last index FFFE when empty) and an object of the list, a
  // slot, a negative word or any word.
  const count = rnd(ENTRIES + 1),
    list = Array.from({ length: count }, () => 2 * rnd(SLOTS));
  setWord(wram, FIGHT_LIST_INDEX, 2 * count - 2);
  list.forEach((object, n) => setWord(wram, FIGHT_LIST + 2 * n, object));
  setWord(
    wram,
    0,
    [count ? list[rnd(count)] : 0, 2 * rnd(SLOTS), 0x8000 + rnd(0x8000), rnd(WORD)][rnd(4)],
  );
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const query = (name, entry, reference, run) => ({
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
    query('isInFightList 80:8656', 0x808656, isInFightListReference, isInFightList),
    query('hasFightTarget 80:866F', 0x80866f, hasFightTargetReference, hasFightTarget),
    query(
      'getPreviousFightObject 80:8631',
      0x808631,
      getPreviousFightObjectReference,
      getPreviousFightObject,
    ),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
