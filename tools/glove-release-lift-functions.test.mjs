// Random per-function test of the lifted glove release 80:CD9D (releaseGloveSequence
// in src/game/glove-release.mjs) against the register-level native (releaseGlove in
// src/task/native-glove-release.mjs). Both sides call the same stand-ins for the glove
// release 80:BCB2 (JSR) and the window list 81:AD92 (JSL), which record A and the
// dialog window word and return; WRAM outside the stack, the calls and the return must
// be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { releaseGlove } from '../src/task/native-glove-release.mjs';
import { releaseGloveSequence } from '../src/game/glove-release.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  DIALOG_WINDOW = 0x1d61,
  GLOVE = 0x80bcb2,
  LIST = 0x81ad92,
  IGNORED = [[0x0100, 0x01ca]];

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  return { seed, wram, rnd };
}
function stub(calls, target, a) {
  const w = a.mem.wram;
  calls.push(
    `${target.toString(HEX)}:${a.ctx.a.toString(HEX)}:${(w[DIALOG_WINDOW] | (w[DIALOG_WINDOW + 1] << 8)).toString(HEX)}`,
  );
  const rawReturnWord = a.pullWord();
  if (target === LIST) {
    a.ctx.s = (a.ctx.s + 1) & 0xffff;
    a.ctx.programBank = a.read(a.ctx.s);
  }
  a.ctx.pc = (rawReturnWord + 1) & 0xffff;
  return { rawReturnWord };
}
const returned = (h, calls) =>
  [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join() + ' ' + calls.join(' ');
let referenceCalls, liftedCalls;
registerCases(
  [
    {
      name: 'releaseGlove 80:CD9D',
      entry: 0x80cd9d,
      samples: 100,
      prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(256) & 0xc3 & ~0x30 }),
      reference: (h) => {
        referenceCalls = [];
        releaseGlove(h.a, null, false, {
          bcb2: (x) => stub(referenceCalls, GLOVE, x.a),
          list: (x) => stub(referenceCalls, LIST, x.a),
        });
      },
      result: (h) => returned(h, referenceCalls),
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        liftedCalls = [];
        const routines = new Map([GLOVE, LIST].map((t) => [t, (x) => stub(liftedCalls, t, x.a)]));
        drainNativeSequence(releaseGloveSequence(h, null, routines));
        return returned(h, liftedCalls);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
