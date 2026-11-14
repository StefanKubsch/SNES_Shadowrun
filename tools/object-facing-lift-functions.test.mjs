// Random per-function tests of the lifted facing natives (src/game/object-facing.mjs
// through their natives in src/task) against their register-level references
// (proof/game-reference/object-facing.mjs): 80:CF93 (towards another object), 80:D1D2
// (towards the player object) and 80:D1DD (the direction towards the player object).
// Both sides run the native from its script call (data bank 80, direct page 0, the RTS
// frame). Game state only (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the
// device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import {
  getDirectionToPlayerReference,
  turnObjectToObjectReference,
  turnObjectToPlayerReference,
} from '../proof/game-reference/object-facing.mjs';
import { turnObjectToObject } from '../src/task/native-object-face-object.mjs';
import { turnObjectToPlayer } from '../src/task/native-player-direction-slot.mjs';
import { getDirectionToPlayer } from '../src/task/native-player-direction.mjs';
import {
  OBJECT_DIRECTION,
  OBJECT_FRAME_COUNT,
  OBJECT_KIND,
  OBJECT_SELECTION,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_OBJECT,
} from '../src/task/wram.mjs';

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
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  const object = 2 * rnd(SLOTS),
    target = pick([2 * rnd(SLOTS), 2 * rnd(SLOTS), 0xff | (rnd(BYTE) << 8), rnd(WORD)]);
  setWord(wram, 0, object);
  setWord(wram, 2, target);
  setWord(wram, PLAYER_OBJECT, pick([2 * rnd(SLOTS), object, rnd(WORD)]));
  // Positions near each other (every direction and the dominance limits) or any word.
  const base = rnd(WORD);
  for (const slot of [
    object,
    target & 0xfffe,
    (wram[PLAYER_OBJECT] | (wram[PLAYER_OBJECT + 1] << 8)) & 0xfffe,
  ])
    if (slot < 2 * SLOTS) {
      setWord(wram, OBJECT_X + slot, pick([base + rnd(64) - 32, rnd(WORD)]));
      setWord(wram, OBJECT_Y + slot, pick([base + rnd(64) - 32, rnd(WORD)]));
    }
  setWord(wram, OBJECT_KIND + object, rnd(16) ? rnd(64) : rnd(WORD));
  setWord(wram, OBJECT_SELECTION + object, pick([2, 0xffff, rnd(16), rnd(WORD)]));
  setWord(wram, OBJECT_DIRECTION + object, pick([rnd(8), rnd(8), rnd(WORD)]));
  setWord(wram, OBJECT_FRAME_COUNT + object, pick([0, 0x80, rnd(0x80), rnd(WORD)]));
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
    step('turnObjectToObject 80:CF93', 0x80cf93, turnObjectToObjectReference, turnObjectToObject),
    step('turnObjectToPlayer 80:D1D2', 0x80d1d2, turnObjectToPlayerReference, turnObjectToPlayer),
    step(
      'getDirectionToPlayer 80:D1DD',
      0x80d1dd,
      getDirectionToPlayerReference,
      getDirectionToPlayer,
    ),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
