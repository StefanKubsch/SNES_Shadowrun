// Random per-function test of the lifted formation native 80:BB2C
// (src/game/formation-place.mjs through its native in src/task) against its register-level
// reference (proof/game-reference/formation-place.mjs). Both sides run the native from its
// script call (data bank 80, direct page 0, the RTS frame). Game state only
// (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { placeObjectInFormationReference } from '../proof/game-reference/formation-place.mjs';
import { placeObjectInFormation } from '../src/script/native-formation-place.mjs';
import {
  FORMATION_HEIGHT,
  FORMATION_INDEX,
  FORMATION_UNMOVED,
  GROUP_INDEX,
  GROUP_NUMBERS,
  OBJECT_DIRECTION,
  OBJECT_FRAME_COUNT,
  OBJECT_KIND,
  OBJECT_NUMBER,
  OBJECT_SELECTION,
} from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  SLOTS = 44,
  RING_BYTES = 0x80;

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
    members = rnd(4),
    number = rnd(WORD);
  setWord(wram, 0, object);
  setWord(wram, OBJECT_NUMBER + object, number);
  setWord(wram, GROUP_INDEX, pick([2 * members, 2 * members, rnd(WORD)]));
  if (rnd(4)) setWord(wram, GROUP_NUMBERS + 2 * rnd(members + 1), number);
  setWord(wram, FORMATION_INDEX, pick([2 * rnd(RING_BYTES / 2), rnd(WORD)]));
  setWord(wram, FORMATION_UNMOVED, pick([0, 0xffff, rnd(WORD)]));
  if (!rnd(4)) for (let at = 0; at < RING_BYTES; at += 2) setWord(wram, FORMATION_HEIGHT + at, 0);
  setWord(wram, OBJECT_KIND + object, rnd(16) ? rnd(64) : rnd(WORD));
  setWord(wram, OBJECT_SELECTION + object, pick([2, 0, 0xffff, rnd(16), rnd(WORD)]));
  setWord(wram, OBJECT_DIRECTION + object, pick([rnd(8), rnd(8), rnd(WORD)]));
  setWord(wram, OBJECT_FRAME_COUNT + object, pick([0, 0x80, rnd(0x80), rnd(WORD)]));
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
registerCases(
  [
    {
      name: 'placeObjectInFormation 80:BB2C',
      entry: 0x80bb2c,
      samples: 600,
      reference: (h) => placeObjectInFormationReference(h.a, false),
      prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
      result: returned,
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        placeObjectInFormation(h.a, false);
        return returned(h);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
