// Random per-function test of the lifted magic point spending 80:8B43
// (spendMagicPointsSequence in src/game/magic-points.mjs) against the register-level
// native (spendMagicPoints in src/task/native-combat.mjs). Both sides call the same
// stand-in for the notice 80:FEC1 (it records A and the direct page window and text
// words and returns); WRAM outside the stack, the call and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { spendMagicPoints, NATIVE_COMBAT_ROUTINES } from '../src/task/native-combat.mjs';
import { spendMagicPointsSequence } from '../src/game/magic-points.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  MEMBER_INDEX = 0x1f60,
  MAGIC_POINTS = 0x3c96,
  NOTICE = 0x80fec1,
  IGNORED = [[0x0100, 0x01ca]];

const word = (wram, at, value) => {
  wram[at] = value & 0xff;
  wram[at + 1] = (value >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  return { seed, wram, rnd, pick };
}
function stub(calls, a) {
  const dp = Array.from({ length: 7 }, (_, n) => a.mem.wram[2 * n] | (a.mem.wram[2 * n + 1] << 8));
  calls.push(`${a.ctx.a.toString(HEX)}:${dp.map((v) => v.toString(HEX))}`);
  const rawReturnWord = a.pullWord();
  a.ctx.pc = (rawReturnWord + 1) & 0xffff;
  return { rawReturnWord };
}
const returned = (h, calls) =>
  [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join() + ' ' + calls.join(' ');
let referenceCalls, liftedCalls;
registerCases(
  [
    {
      // Members of the group and beyond, points and costs around each other.
      name: 'spendMagicPoints 80:8B43',
      entry: 0x808b43,
      samples: 600,
      prepare: (s) => {
        const member = s.pick([0, 2, 4, 6, s.rnd(65536)]),
          points = s.rnd(256);
        word(s.wram, MEMBER_INDEX, member);
        s.wram[MAGIC_POINTS + (member >>> 1)] = points;
        word(s.wram, 0, s.pick([points, points + 1, points - 1, 0, s.rnd(65536)]) & 0xffff);
        return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
      },
      reference: (h) => {
        referenceCalls = [];
        spendMagicPoints(h.a, null, false, {
          ...NATIVE_COMBAT_ROUTINES,
          notice: (a) => stub(referenceCalls, a),
        });
      },
      result: (h) => returned(h, referenceCalls),
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        liftedCalls = [];
        const routines = new Map([[NOTICE, (callee) => stub(liftedCalls, callee.a)]]);
        drainNativeSequence(spendMagicPointsSequence(h, null, routines));
        return returned(h, liftedCalls);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
