// Random per-function test of the lifted outer game owner 80:A139/A157
// (src/frontend/game-owner.mjs) against the register-level reference
// (proof/frontend-reference/game-owner.mjs), for both entries; the live sessions of
// tools/game-owner-lift.test.mjs reach only A139 (docs/MATRIX-LIFT.md). The title
// cycle answers as a stub that records its call (return address, A, data bank) and
// returns a random choice; both sides call the live table's game audio set-up
// 81:EF63 (lifted; its register-level form is compared in
// tools/intro-lift-functions.test.mjs). Both sides must leave the same WRAM, device
// writes, stack pointer, program counter and data bank.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { FRONTEND_ROUTINES } from '../src/task/main-frontend.mjs';
import { GAME_OWNER_REFERENCE_ENTRIES } from '../proof/frontend-reference/game-owner.mjs';
import { runGameOwner } from '../src/frontend/game-owner.mjs';

const WRAM_BYTES = 0x20000,
  SRAM_BYTES = 0x2000,
  STACK_PAGE = 0x100,
  // The harness stack starts at 1C9; the caller's and the owner's frames end at 1C6.
  FREE_STACK_END = 0x1c6,
  HEX = 16;
const reference = new Map(GAME_OWNER_REFERENCE_ENTRIES);

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES),
    sram = new Uint8Array(SRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  for (let i = 0; i < sram.length; i++) sram[i] = rnd(256);
  return { seed, wram, sram, rnd, pick, choice: pick([0xffff, 0, 1, 2, 3]) };
}

function stubbedRoutines(s) {
  const routines = new Map([...FRONTEND_ROUTINES, ...GAME_OWNER_REFERENCE_ENTRIES]);
  routines.delete(0x80a139);
  routines.set(0x80a18c, (h) => {
    const { ctx } = h;
    (h.a.callLog ??= []).push(
      [0x80a18c, h.a.stackWord(), ctx.bank, ctx.a].map((v) => v.toString(HEX)).join(':'),
    );
    ctx.a = s.choice;
    ctx.x = 0xff;
    return h.rts();
  });
  return routines;
}
const side = (s) => {
  const state = createSide(s, stubbedRoutines(s));
  state.a.routines = state.routines;
  return state;
};
// The owner's caller reads the program counter, stack and data bank; the main start
// reads the choice from WRAM. A, X, Y and the flags after the owner are leftovers.
const summary = (h) =>
  [
    ...(h.a.callLog ?? []),
    ['pc', 'programBank', 'bank', 's'].map((r) => h.ctx[r].toString(HEX)).join(),
    h.a.stackWord().toString(HEX),
  ].join(' ');

registerCases(
  [
    {
      name: 'outer game owner 80:A139/A157',
      entry: 0x80a139,
      samples: 60,
      prepare: (s) => ({ pc: s.pick([0xa139, 0xa157]), a: s.rnd(0x10000), bank: 0x80 }),
      reference: (h, e, r) => reference.get(0x80a139)(h, e, r),
      events: () => ({ calls: [] }),
      result: summary,
      lifted: (h, input) => {
        h.ctx.programBank = 0x80;
        h.push(0x1234, 2);
        Object.assign(h.ctx, input);
        runGameOwner(h, { calls: [] }, h.a.routines);
        return summary(h);
      },
    },
  ],
  {
    sample,
    side,
    runtime: (h) => h,
    // The free stack below the owner's frame: the reference's JSL to 81:EF63 leaves
    // its return address there (the lifted owner calls the set-up directly).
    ignored: [[STACK_PAGE, FREE_STACK_END]],
  },
);
