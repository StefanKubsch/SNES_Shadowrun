// Random per-function tests of the lifted glove limit, distance and halving natives
// (src/game/glove-target.mjs, object-distance.mjs and script-queries.mjs through their
// natives in src/task) against the frozen outcomes (tools/lift-vectors/) of their former register-level references
// (proof/game-reference/script-measures.mjs): the crosshair and spell glove limits 80:BC83
// and 80:BC9C, the distances 80:C68D (to the player) and 80:C694 (between two objects) and
// the signed halving 80:D9A7. Both sides run the native from its script call (data bank
// 80, direct page 0, the RTS frame). Game state only (docs/STRATEGY.md, 2026-11-14): WRAM
// outside the stacks, the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { limitCrosshair as limitCrosshairLifted } from '../src/script/native-glove-crosshair-limits.mjs';
import { limitSpellGlove as limitSpellGloveLifted } from '../src/script/native-glove-spell-limits.mjs';
import { getDistanceToPlayer as getDistanceToPlayerLifted } from '../src/script/native-object-distance.mjs';
import { getDistanceBetweenObjects as getDistanceBetweenObjectsLifted } from '../src/script/native-object-distance-direct.mjs';
import { halveArgumentSigned as halveArgumentSignedLifted } from '../src/script/native-shift-right-signed.mjs';
import { OBJECT_X, PLAYER_OBJECT } from '../src/data/wram.mjs';
import { leafRts } from './register-forms/leaf-return.mjs';
// The natives with the RTS of their register-level entry (2026-11-27).
const limitCrosshair = leafRts(limitCrosshairLifted);
const limitSpellGlove = leafRts(limitSpellGloveLifted);
const getDistanceToPlayer = leafRts(getDistanceToPlayerLifted);
const getDistanceBetweenObjects = leafRts(getDistanceBetweenObjectsLifted);
const halveArgumentSigned = leafRts(halveArgumentSignedLifted);

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  SLOTS = 44;

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // Two objects of the game's slots (sometimes the same) or any words; the player one of
  // the slots.
  const first = 2 * rnd(SLOTS);
  setWord(wram, 0, [first, rnd(WORD)][rnd(2)]);
  setWord(wram, 2, [2 * rnd(SLOTS), first, rnd(WORD)][rnd(3)]);
  setWord(wram, PLAYER_OBJECT, 2 * rnd(SLOTS));
  // Sometimes an X difference of exactly 8000.
  if (!rnd(8)) {
    setWord(wram, OBJECT_X + first, 0x8000);
    setWord(wram, OBJECT_X + (wram[2] | (wram[3] << 8)), 0);
  }
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const measure = (name, entry, run) => ({
  name,
  entry,
  samples: 300,
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
    measure('limitCrosshair 80:BC83', 0x80bc83, limitCrosshair),
    measure('limitSpellGlove 80:BC9C', 0x80bc9c, limitSpellGlove),
    measure('getDistanceToPlayer 80:C68D', 0x80c68d, getDistanceToPlayer),
    measure('getDistanceBetweenObjects 80:C694', 0x80c694, getDistanceBetweenObjects),
    measure('halveArgumentSigned 80:D9A7', 0x80d9a7, halveArgumentSigned),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
