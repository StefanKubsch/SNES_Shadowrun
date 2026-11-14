// Random per-function tests of the lifted equipment rows (src/game/equipment-window.mjs)
// against the register-level 80:E9C5 with its item text 80:E9A8
// (src/task/native-member-spell-menu.mjs). Both sides call the same stand-ins for the
// cursor 80:FAAC, the text 80:FE69 and the number 80:FD80. Each records its target, A,
// X, Y, the flags N, V, Z and C, the direct page words 00 and 02, S and the three words
// above its return word (the pushed armour, rating and weapon), and leaves
// registers and flags drawn from the sample's own sequence. WRAM outside the stack, the
// calls, the return and the registers left must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { e9c5Sequence } from '../src/task/native-member-spell-menu.mjs';
import { equipmentRowsSequence } from '../src/game/equipment-window.mjs';
import {
  JAKE_DERMAL_ARMOUR,
  MEMBER_INDEX,
  MEMBER_OBJECT,
  PLAYER_OBJECT,
  RUNNER_ARMOUR,
  RUNNER_ARMOUR_RATING,
  RUNNER_WEAPON,
} from '../src/task/wram.mjs';
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
  RUNNERS = 13,
  TARGETS = [0x80faac, 0x80fe69, 0x80fd80];

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
  const runner = rnd(RUNNERS) * 2,
    entry = runner * 4;
  setWord(wram, MEMBER_INDEX, runner);
  if (rnd(2)) setWord(wram, MEMBER_OBJECT, word(wram, PLAYER_OBJECT));
  if (rnd(2)) wram[JAKE_DERMAL_ARMOUR] = 0;
  // Items: none or a listed item number, rarely any word; ratings near a byte's end.
  const item = () => (rnd(4) ? rnd(0x60) : rnd(3) ? 0x8000 | rnd(0x8000) : rnd(WORD));
  setWord(wram, RUNNER_WEAPON + entry, item());
  setWord(wram, RUNNER_ARMOUR + entry, item());
  setWord(wram, RUNNER_ARMOUR_RATING + entry, rnd(4) ? rnd(BYTE) : rnd(WORD));
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
        ctx.status & LEFT_FLAGS,
        word(w, 0),
        word(w, 2),
        ctx.s,
        word(w, ctx.s + 3),
        word(w, ctx.s + 5),
        word(w, ctx.s + 7),
      ]
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
  [h.ctx.pc, h.ctx.s, h.ctx.a, h.ctx.x, h.ctx.y, h.ctx.status & LEFT_FLAGS]
    .map((v) => v.toString(HEX))
    .join() +
  ' ' +
  calls.join(' ');
let referenceCalls, current;
registerCases(
  [
    {
      name: 'equipmentRows 80:E9C5',
      entry: 0x80e9c5,
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
        drainNativeSequence(e9c5Sequence(h, null, routines));
      },
      result: (h) => returned(h, referenceCalls),
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        const { routines, calls } = standIns(current);
        drainNativeSequence(equipmentRowsSequence(h, null, routines));
        return returned(h, calls);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
