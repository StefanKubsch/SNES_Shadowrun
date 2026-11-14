// Random per-function tests of the lifted main menu and save menu
// (src/game/main-menu.mjs) against the register-level 80:CE6D and 80:CDD6
// (src/task/native-main-menu.mjs). Both sides call the same stand-ins for the window
// 80:F963, the text 80:FE69, the key wait 80:F953, the release 80:FA3E, the plain menu
// 80:A6C7 (Exit, a cancel or a row), the sound effect 80:C46E and, for the main menu,
// the save and karma menus. The save 81:B17D runs register-level on the reference side
// and lifted (saveGame of src/game/save-slots.mjs) on the other, into the sample's SRAM.
// Game state only (docs/STRATEGY.md, 2026-11-14): each stand-in records its target and
// the direct page words 00, 02, 04 and 06 it reads, and leaves registers and flags drawn
// from the sample's own sequence. WRAM outside the stacks and the save routine's direct
// page scratch, SRAM, the calls and the return target must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { calleeRecord, createSide, registerCases } from './lift-function-harness.mjs';
import { cdd6Sequence, mainMenuRoutineSequence } from '../src/task/native-main-menu.mjs';
import { mainMenuSequence, saveMenuSequence } from '../src/game/main-menu.mjs';
import { TIMER } from '../src/task/wram.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';

const WRAM_BYTES = 0x20000,
  SRAM_BYTES = 0x2000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  // Status bits a stand-in may leave: N, V, Z and C (the register widths stay 16-bit).
  LEFT_FLAGS = 0xc3,
  // The save routine's direct page scratch: the slot 0E and the checksum sums 11-15.
  IGNORED = [[0x000e, 0x0016]],
  TARGETS = [0x80f963, 0x80fe69, 0x80f953, 0x80fa3e, 0x80a6c7, 0x80c46e, 0x80cdd6, 0x80ee57];

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES),
    sram = new Uint8Array(SRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  for (let i = 0; i < sram.length; i++) sram[i] = rnd(BYTE);
  // The countdown stopped in most samples.
  if (rnd(4)) wram[TIMER + 1] |= 0x80;
  return { seed, wram, sram, rnd };
}

// The stand-ins of one side; both sides draw the same sequence.
function standIns(s) {
  const random = prng(s.seed ^ 0x3c3c3c3c),
    rnd = (n) => Math.floor(random() * n),
    calls = [];
  const stub = (target) => (h) => {
    const { a } = h,
      { ctx } = a,
      w = a.mem.wram;
    calls.push(calleeRecord(target, h, { dp: [0, 2, 4, 6] }));
    if (target === 0x80f963) setWord(w, 0, rnd(8));
    if (target === 0x80a6c7) setWord(w, 0, [0, WORD - 1, 1, 2, 1, 2, 0x8002][rnd(7)]);
    ctx.a = rnd(WORD);
    ctx.x = rnd(WORD);
    ctx.y = rnd(WORD);
    ctx.status = (ctx.status & ~LEFT_FLAGS) | (rnd(BYTE) & LEFT_FLAGS);
    return { rawReturnWord: h.rts() };
  };
  return { routines: new Map(TARGETS.map((t) => [t, stub(t)])), calls };
}
const returned = (h, calls) => h.ctx.pc.toString(HEX) + ' ' + calls.join(' ');
let referenceCalls, current;
const routine = (name, entry, reference, lifted) => ({
  name,
  entry,
  samples: 300,
  prepare: (s) => {
    current = s;
    return {
      bank: CODE_BANK,
      a: s.rnd(WORD),
      x: s.rnd(WORD),
      y: s.rnd(WORD),
      status: s.rnd(BYTE) & LEFT_FLAGS,
    };
  },
  reference: (h) => {
    const { routines, calls } = standIns(current);
    referenceCalls = calls;
    drainNativeSequence(reference(h, null, routines));
  },
  result: (h) => returned(h, referenceCalls),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    const { routines, calls } = standIns(current);
    drainNativeSequence(lifted(h, null, routines));
    return returned(h, calls);
  },
});
registerCases(
  [
    routine('save menu 80:CDD6', 0x80cdd6, cdd6Sequence, saveMenuSequence),
    routine('main menu 80:CE6D', 0x80ce6d, mainMenuRoutineSequence, mainMenuSequence),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
