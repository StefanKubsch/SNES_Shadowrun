// Random per-function tests of the lifted karma menu, line, step purchase and lists
// (src/game/karma-menu.mjs) against the register-level 80:EE57, 80:EF82, 80:F006,
// 80:F054, 80:F0F3 and 80:F1B5 (src/task/native-main-menu.mjs). The menu also calls
// stand-ins for the notice release, the glove, the plain menu 80:A6C7 (Exit, a cancel,
// a list row or another negative row), the lists and 80:CF2E. Both sides call the same
// stand-ins for the window 80:F963, the redraw 80:FA67, the cursor 80:FAAC, the text
// 80:FE69, the number 80:FD80, the key wait 80:F953, the release 80:FA3E, the numbered
// menu 80:A6B8 (Exit, a cancel or a row), the purchase (which sometimes clears DP 0E),
// the karma line and the state count 80:CECB. Each records its target, A, X, Y, the
// flags N, V, Z and C and the direct page words 00, 02, 0E, 1A and the cursor row, and
// leaves registers and flags drawn from the sample's own sequence. WRAM outside the stack, the calls,
// the return and the registers left must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { DialogTestMemory } from './task-native-dialog-harness.mjs';
import {
  KARMA_LISTS,
  ee57Sequence,
  ef82Sequence,
  f006Sequence,
  karmaListSequence as referenceList,
} from '../src/task/native-main-menu.mjs';
import {
  buyStepSequence,
  karmaLineSequence,
  karmaListSequence,
  karmaMenuSequence,
} from '../src/game/karma-menu.mjs';
import { DP_CURSOR_ROW, DP_KARMA_SELECTION, KARMA } from '../src/task/wram.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  WORD = 0x10000,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  // Status bits a stand-in may leave: N, V, Z and C (the register widths stay 16-bit).
  LEFT_FLAGS = 0xc3,
  IGNORED = [[0x0100, 0x01ca]],
  // The value pointer DP 0E with its bank DP 10: Jake's values in WRAM above 2000.
  DP_VALUE = 0x0e,
  VALUES_START = 0x3bf0,
  VALUES = 0x20,
  WRAM_BANKS = [0x7e, 0x7f],
  TARGETS = [
    0x80f963, 0x80fa67, 0x80faac, 0x80fe69, 0x80fd80, 0x80f953, 0x80fa3e, 0x80a6b8, 0x80f006,
    0x80ef82, 0x80cecb, 0x80ff79, 0x80bcb2, 0x80a6c7, 0x80cf2e, 0x80f054, 0x80f0f3, 0x80f1b5,
  ];
// The lists' value addresses and limits from the ROM.
const romMemory = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  listValues = Object.values(KARMA_LISTS).flatMap((list) =>
    Array.from({ length: list.end / 2 }, (_, n) => [
      romMemory.read16(0x800000 + list.pointers + 2 * n),
      romMemory.read16(0x800000 + list.limits + 2 * n),
    ]),
  );

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
const word = (w, at) => w[at] | (w[at + 1] << 8);

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  setWord(wram, DP_VALUE, VALUES_START + rnd(VALUES));
  wram[DP_VALUE + 2] = WRAM_BANKS[rnd(2)];
  // Small values and karma near their cost, or anything.
  if (rnd(2)) wram[(wram[DP_VALUE + 2] - 0x7e) * WORD + word(wram, DP_VALUE)] = rnd(16);
  if (rnd(2)) setWord(wram, KARMA, rnd(BYTE));
  // Karma exactly the cost.
  if (rnd(4) === 0)
    setWord(wram, KARMA, wram[(wram[DP_VALUE + 2] - 0x7e) * WORD + word(wram, DP_VALUE)] * 8);
  // The lists' values: none, below, at or above their limits.
  for (const [at, limit] of listValues) if (rnd(4)) wram[at] = rnd(Math.min(limit + 2, BYTE));
  return { seed, wram, rnd };
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
    calls.push(
      [
        target,
        ctx.a,
        ctx.x,
        ctx.y,
        ctx.s,
        ctx.status & LEFT_FLAGS,
        word(w, 0),
        word(w, 2),
        word(w, DP_CURSOR_ROW),
        word(w, DP_VALUE),
        word(w, DP_KARMA_SELECTION),
      ]
        .map((v) => v.toString(HEX))
        .join(':'),
    );
    if (target === 0x80f963) setWord(w, 0, rnd(8));
    // The cursor moves its row on.
    if (target === 0x80faac) setWord(w, DP_CURSOR_ROW, rnd(WORD));
    if (target === 0x80a6b8) setWord(w, 0, rnd(4) ? 1 + rnd(5) : rnd(2) ? 0 : WORD - 1 - rnd(4));
    if (target === 0x80f006 && rnd(4) === 0) setWord(w, DP_VALUE, 0);
    if (target === 0x80a6c7) setWord(w, 0, [0, WORD - 1, 1, 2, 3, 1, 2, 3, 0x8001][rnd(9)]);
    ctx.a = rnd(WORD);
    ctx.x = rnd(WORD);
    ctx.y = rnd(WORD);
    ctx.status = (ctx.status & ~LEFT_FLAGS) | (rnd(BYTE) & LEFT_FLAGS);
    return { rawReturnWord: h.rts() };
  };
  return { routines: new Map(TARGETS.map((t) => [t, stub(t)])), calls };
}
const returned = (h, calls) =>
  [h.ctx.pc, h.ctx.s, h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status & LEFT_FLAGS]
    .map((v) => v.toString(HEX))
    .join() +
  ' ' +
  calls.join(' ');
let referenceCalls, current;
const routine = (name, entry, reference, lifted) => ({
  name,
  entry,
  samples: 400,
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
    routine('karma menu 80:EE57', 0x80ee57, ee57Sequence, karmaMenuSequence),
    routine('karma line 80:EF82', 0x80ef82, ef82Sequence, karmaLineSequence),
    routine('step bought 80:F006', 0x80f006, f006Sequence, buyStepSequence),
    ...Object.keys(KARMA_LISTS).map((key) => {
      const entry = Number(key);
      return routine(
        'karma list 80:' + entry.toString(HEX).slice(2).toUpperCase(),
        entry,
        (h, events, routines) => referenceList(h, events, routines, entry),
        (h, events, routines) => karmaListSequence(h, events, routines, entry),
      );
    }),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
