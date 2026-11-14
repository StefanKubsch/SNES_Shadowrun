// Random per-function test of the lifted script native 80:E30F, entering the Matrix
// (src/game/matrix-enter.mjs through src/task/native-matrix-enter.mjs), against its
// register-level reference (proof/game-reference/matrix-enter.mjs). The native runs from
// its script call (data bank 80, direct page 0, the RTS frame). The decker is a runner
// of the table (or any number: both searches miss); the group holds the decker at or
// below the runner's index, or not; the member's object has a record in WRAM, none, or
// any pointer. Game state only (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks,
// the device writes and the return must be equal.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { enterMatrixReference } from '../proof/game-reference/matrix-enter.mjs';
import { enterMatrix } from '../src/task/native-matrix-enter.mjs';
import { GROUP_NUMBERS, GROUP_SLOTS, OBJECT_RECORD } from '../src/task/wram.mjs';
import { RUNNERS, RUNNER_OBJECT_NUMBERS } from '../src/data/runners.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  SLOTS = 44,
  DP_DECKER = 8,
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
  const runner = rnd(RUNNERS),
    decker = rnd(8) ? romWord((CODE_BANK << 16) | (RUNNER_OBJECT_NUMBERS + 2 * runner)) : rnd(WORD);
  setWord(wram, DP_DECKER, decker);
  if (rnd(4)) {
    const member = 2 * rnd(runner + 1),
      slot = pick([2 * rnd(SLOTS), 2 * rnd(SLOTS), rnd(WORD)]);
    setWord(wram, GROUP_NUMBERS + member, decker);
    setWord(wram, GROUP_SLOTS + member, slot);
    if (slot < 2 * SLOTS)
      setWord(wram, OBJECT_RECORD + slot, pick([0, 0x3000 + rnd(0x1000), rnd(WORD)]));
  }
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
registerCases(
  [
    {
      name: 'enterMatrix 80:E30F',
      entry: 0x80e30f,
      samples: 500,
      reference: (h) => enterMatrixReference(h.a, false),
      prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
      result: returned,
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        enterMatrix(h.a, false);
        return returned(h);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);
