// Random per-function test of the lifted fight list removal 80:855E
// (removeFromFightListSequence in src/game/fight-list.mjs) against the register-level
// native (src/task/native-fight-list-remove.mjs). Both sides call the same stand-ins
// for their callees (the notice 80:FEC1 leaves its window in A, the cursor, number,
// text, sound and the music mode 81:EF47 record A and return), which have their own
// proofs and live comparisons; the test covers the removal, the formation countdown,
// the karma gain, the notice's set-up and the music choice. WRAM outside the stack,
// the calls with their A and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { removeFromFightList } from '../src/task/native-fight-list-remove.mjs';
import { removeFromFightListSequence } from '../src/game/fight-list.mjs';
import { drainNativeSequence } from '../src/task/native-call-continuation.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  FIGHT_LIST_INDEX = 0x1fb0,
  FIGHT_LIST = 0x1fb2,
  FIGHT_MUSIC = 0x1fca,
  FIGHT_KARMA = 0x1fcc,
  FIGHT_FIRST_REMOVAL = 0x1fce,
  GROUP_LEADER_ONLY = 0x1d6b,
  GROUP_INDEX = 0x2de6,
  GROUP_POSITIONS = 0x2df8,
  KARMA = 0x3c11,
  GAME_OPTIONS = 0x1fd6,
  NOTICE_WINDOW = 0x0006,
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
// The callees' stand-ins: each records its target and A and returns (RTS, or RTL for
// the music mode); the notice leaves its window in A.
const CALLEES = [0x80fec1, 0x80faac, 0x80fd80, 0x80fe69, 0x80c46e, 0x81ef47];
const NAMES = ['notice', 'cursor', 'number', 'text', 'sound', 'music'];
function stub(calls, target, a) {
  // The callee's A and its direct page arguments (the notice's window 00-0C).
  const dp = Array.from({ length: 7 }, (_, n) => a.mem.wram[2 * n] | (a.mem.wram[2 * n + 1] << 8));
  calls.push(`${target.toString(HEX)}:${a.ctx.a.toString(HEX)}:${dp.map((v) => v.toString(HEX))}`);
  if (target === 0x80fec1) a.ctx.a = NOTICE_WINDOW;
  const rawReturnWord = a.pullWord();
  if (target === 0x81ef47) {
    a.ctx.s = (a.ctx.s + 1) & 0xffff;
    a.ctx.programBank = a.read(a.ctx.s);
  }
  a.ctx.pc = (rawReturnWord + 1) & 0xffff;
  return { rawReturnWord };
}
const returned = (h, calls) =>
  [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join() + ' ' + calls.join(' ');
let referenceCalls, liftedCalls;
const CASE = {
  name: 'removeFromFightList 80:855E',
  entry: 0x80855e,
  samples: 800,
  prepare: (s) => {
    // Lists of 1 to 8 objects with the argument in them or not.
    const last = s.pick([0, 0, 1, 3, 7]),
      objects = Array.from({ length: last + 1 }, () => 2 * s.rnd(44));
    word(s.wram, FIGHT_LIST_INDEX, 2 * last);
    objects.forEach((o, n) => word(s.wram, FIGHT_LIST + 2 * n, o));
    word(s.wram, 0, s.rnd(5) ? s.pick(objects) : 2 * s.rnd(44));
    word(s.wram, FIGHT_FIRST_REMOVAL, s.pick([0, 0, 0xffff, s.rnd(65536)]));
    word(s.wram, GROUP_LEADER_ONLY, s.pick([0, 0, 1, 0x8000]));
    word(s.wram, GROUP_INDEX, s.pick([0, 2, 4, 6, 0xfffe]));
    for (let n = 0; n < 4; n++) word(s.wram, GROUP_POSITIONS + 2 * n, s.pick([0, 1, s.rnd(64)]));
    const karma = s.rnd(65536);
    word(s.wram, KARMA, karma);
    // Gains of 0, 9, 10 (the wide notice's bound), small and any.
    word(
      s.wram,
      FIGHT_KARMA,
      s.pick([0, 9, 10, s.rnd(20), s.rnd(65536)].map((gain) => (karma >>> 3) - gain)),
    );
    word(s.wram, GAME_OPTIONS, s.rnd(65536));
    word(s.wram, FIGHT_MUSIC, s.pick([0xffff, 0, 4, s.rnd(65536)]));
    return { bank: CODE_BANK, status: s.rnd(256) & 0xc3 };
  },
  reference: (h) => {
    referenceCalls = [];
    const routines = Object.fromEntries(
      NAMES.map((name, n) => [name, (a) => stub(referenceCalls, CALLEES[n], a)]),
    );
    removeFromFightList(h.a, null, false, routines);
  },
  result: (h) => returned(h, referenceCalls),
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    liftedCalls = [];
    const routines = new Map(
      CALLEES.map((target) => [target, (callee) => stub(liftedCalls, target, callee.a)]),
    );
    drainNativeSequence(removeFromFightListSequence(h, null, routines));
    return returned(h, liftedCalls);
  },
};
registerCases([CASE], {
  sample,
  side: (s) => createSide(s, new Map()),
  runtime: (h) => h,
  ignored: IGNORED,
});
