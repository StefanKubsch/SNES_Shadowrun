// Random per-function tests of the lifted object release natives (src/game/object-release.mjs
// through their natives in src/task) against the frozen outcomes (tools/lift-vectors/) of their former register-level references
// (proof/game-reference/object-release.mjs): 80:AA4C (an object's graphics fields and VRAM
// slots) and 80:A8F5 (the object leaves the scene and the draw list). Both sides run the
// native from its script call (data bank 80, direct page 0, the RTS frame). Object
// indexes are game slots or damaged words; VRAM slot chains are short or long. Game state
// only (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks, the device writes and the
// return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { removeObject } from '../src/script/native-object-release.mjs';
import { releaseObjectGraphics } from '../src/script/native-object-release-direct.mjs';
import {
  DRAW_LIST,
  DRAW_LIST_INDEX,
  OBJECT_LAST_SLOT,
  OBJECT_VRAM_SLOT_COUNT,
  OBJECT_VRAM_SLOT_HEAD,
  VRAM_SLOT_FREE_LIST,
  VRAM_SLOT_NEXT,
} from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  OBJECT_SLOTS = OBJECT_LAST_SLOT / 2 + 1,
  VRAM_SLOTS = 0x40,
  DRAW_ENTRIES = 0x30;

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
  const game = rnd(4) !== 0,
    object = game ? 2 * rnd(OBJECT_SLOTS) : rnd(WORD);
  setWord(wram, 0, object);
  if (game) {
    // A chain of VRAM slots (none to a few, sometimes a damaged count).
    setWord(wram, OBJECT_VRAM_SLOT_COUNT + object, pick([0, 1, 2, 3, 4, rnd(WORD)]));
    setWord(wram, OBJECT_VRAM_SLOT_HEAD + object, 2 * rnd(VRAM_SLOTS));
    for (let slot = 0; slot < VRAM_SLOTS; slot++)
      setWord(wram, VRAM_SLOT_NEXT + 2 * slot, pick([2 * rnd(VRAM_SLOTS), rnd(WORD)]));
    setWord(wram, VRAM_SLOT_FREE_LIST, pick([2 * rnd(VRAM_SLOTS), WORD - 1]));
  }
  // The draw list holds the object at or below its last index.
  const last = 2 * rnd(DRAW_ENTRIES);
  setWord(wram, DRAW_LIST_INDEX, last);
  setWord(wram, DRAW_LIST + pick([last, 2 * rnd(last / 2 + 1)]), object);
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const step = (name, entry, run) => ({
  name,
  entry,
  samples: 500,
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
    step('releaseObjectGraphics 80:AA4C', 0x80aa4c, releaseObjectGraphics),
    step('removeObject 80:A8F5', 0x80a8f5, removeObject),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
