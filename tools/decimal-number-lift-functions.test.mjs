// Random per-function tests of the lifted decimal number (src/game/decimal-number.mjs)
// against the register-level 80:FDCF (src/task/native-status-screen.mjs). Both sides
// call the same stand-in for the text buffer 80:FB39. It records its target, the data
// bank, A, X, Y, the flags N, V, Z and C and the direct page words 00 and 02, and leaves
// registers and flags drawn from the sample's own sequence. WRAM outside the stack, the
// calls, the return and the registers left must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { fdcfSequence } from '../src/task/native-status-screen.mjs';
import { decimalNumberSequence } from '../src/game/decimal-number.mjs';

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
  TARGETS = [0x80fb39];

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
  // Any 32-bit number, or a small one, or one just below a power of ten.
  const kind = rnd(3),
    number =
      kind === 0
        ? rnd(WORD) * WORD + rnd(WORD)
        : kind === 1
          ? rnd(100000)
          : 10 ** (1 + rnd(9)) - 1 - rnd(2);
  setWord(wram, 2, number % WORD);
  setWord(wram, 4, Math.floor(number / WORD));
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
      [target, ctx.bank, ctx.a, ctx.x, ctx.y, ctx.status & LEFT_FLAGS, word(w, 0), word(w, 2)]
        .map((v) => v.toString(HEX))
        .join(':'),
    );
    ctx.a = rnd(WORD);
    ctx.x = rnd(WORD);
    ctx.y = rnd(WORD);
    ctx.status = (ctx.status & ~LEFT_FLAGS) | (rnd(BYTE) & LEFT_FLAGS);
    const rawReturnWord = a.pullWord();
    ctx.pc = (rawReturnWord + 1) & 0xffff;
    return { rawReturnWord };
  };
  return { routines: new Map(TARGETS.map((t) => [t, stub(t)])), calls };
}
const returned = (h, calls) =>
  [h.ctx.pc, h.ctx.s, h.ctx.bank, h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status & LEFT_FLAGS]
    .map((v) => v.toString(HEX))
    .join() +
  ' ' +
  calls.join(' ');
let referenceCalls, current;
registerCases(
  [
    {
      name: 'decimalNumber 80:FDCF',
      entry: 0x80fdcf,
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
        drainNativeSequence(fdcfSequence(h, null, routines));
      },
      result: (h) => returned(h, referenceCalls),
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        const { routines, calls } = standIns(current);
        drainNativeSequence(decimalNumberSequence(h, null, routines));
        return returned(h, calls);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
