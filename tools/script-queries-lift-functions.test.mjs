// Random per-function tests of the lifted pad, player and glove getters
// (src/game/script-queries.mjs through their natives in src/task) against their
// register-level references (proof/game-reference/script-queries.mjs): 80:9E59, 80:9E5F,
// 80:CD97, 80:D18A, 80:C0F7 and 80:C100. Both sides run the native from its script call
// (data bank 80, direct page 0, the RTS frame). Game state only (docs/STRATEGY.md,
// 2026-11-14): WRAM outside the stacks, the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  getGloveScreenXReference,
  getGloveScreenYReference,
  getPadHeldReference,
  getPadPressedReference,
  getPlayerObjectCopyReference,
  getPlayerObjectReference,
} from '../proof/game-reference/script-queries.mjs';
import { getPadHeld } from '../src/task/native-pad-held.mjs';
import { getPadPressed } from '../src/task/native-pad-pressed.mjs';
import { getPlayerObject } from '../src/task/native-player-object.mjs';
import { getPlayerObjectCopy } from '../src/task/native-player-object-second.mjs';
import { getGloveScreenX } from '../src/task/native-glove-screen-x.mjs';
import { getGloveScreenY } from '../src/task/native-glove-screen-y.mjs';

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
const query = (name, entry, reference, run) => ({
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
    query('getPadHeld 80:9E59', 0x809e59, getPadHeldReference, getPadHeld),
    query('getPadPressed 80:9E5F', 0x809e5f, getPadPressedReference, getPadPressed),
    query('getPlayerObject 80:CD97', 0x80cd97, getPlayerObjectReference, getPlayerObject),
    query(
      'getPlayerObjectCopy 80:D18A',
      0x80d18a,
      getPlayerObjectCopyReference,
      getPlayerObjectCopy,
    ),
    query('getGloveScreenX 80:C0F7', 0x80c0f7, getGloveScreenXReference, getGloveScreenX),
    query('getGloveScreenY 80:C100', 0x80c100, getGloveScreenYReference, getGloveScreenY),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
