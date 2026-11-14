// Random per-function tests of the lifted player control (src/game/player-control.mjs)
// against the register-level native 80:E014 (src/task/native-player-control.mjs). Both
// sides call the same stand-ins for the party status 80:ED3C, the status screen 80:EA89
// and its item list 80:EA8E, the notice's window 80:F963, text 80:FE69, key wait 80:F953
// and release 80:FA3E, the glove's release 80:BCB2, the action 80:A985 and the turn
// 80:AAAF. Each records its target, A, X, Y, the flags N, V, Z and C and the direct page
// words 00 and 02, and leaves registers and flags drawn from the sample's own sequence.
// WRAM outside the stack, the calls, the return and the registers left must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { controlPlayer } from '../src/task/native-player-control.mjs';
import { controlPlayerSequence } from '../src/game/player-control.mjs';
import {
  AIMING_SPELL,
  AIMING_WEAPON,
  GLOVE_KIND,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  OBJECT_FLAGS,
  PAD_HELD,
  PAD_PRESSED,
  PLAYER_IDLE,
  PLAYER_OBJECT,
  RUNNER_WEAPON,
  RUNNER_WEAPON_KIND,
  SELECTED_SPELL_SCRIPT,
} from '../src/task/wram.mjs';
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
  IGNORED = [[0x0100, 0x01ca]],
  // Select, Start, Y, B, A, X, L, R and none, then the Summon spirit script.
  BUTTONS = [0x2000, 0x1000, 0x4000, 0x8000, 0x0080, 0x0040, 0x0020, 0x0010, 0],
  SUMMON_SPIRIT_SCRIPT = 0x01ec;
const TARGETS = [
  0x80ed3c, 0x80ea89, 0x80ea8e, 0x80f963, 0x80fe69, 0x80f953, 0x80fa3e, 0x80bcb2, 0x80a985,
  0x80aaaf,
];

const setWord = (w, at, v) => {
  w[at] = v & 0xff;
  w[at + 1] = (v >>> 8) & 0xff;
};
const word = (w, at) => w[at] | (w[at + 1] << 8);

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (values) => values[rnd(values.length)],
    wram = new Uint8Array(WRAM_BYTES),
    sram = new Uint8Array(SRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  for (let i = 0; i < sram.length; i++) sram[i] = rnd(BYTE);
  const player = rnd(0x40) * 2,
    target = rnd(0x40) * 2;
  setWord(wram, PLAYER_OBJECT, player);
  // One button newly pressed, two, or none; the held directions any.
  const pressed = rnd(6) ? pick(BUTTONS) | (rnd(3) ? 0 : pick(BUTTONS)) : rnd(WORD);
  setWord(wram, PAD_PRESSED, pressed);
  setWord(wram, PAD_HELD, rnd(4) ? (rnd(WORD) & 0x0fc0) | (pressed & 0x00c0) : rnd(WORD));
  setWord(wram, GLOVE_KIND, rnd(2) ? 0 : 1 + rnd(WORD - 1));
  setWord(wram, PLAYER_IDLE, pick([0, 0xffff, rnd(WORD)]));
  setWord(wram, RUNNER_WEAPON, rnd(3) ? rnd(0x8000) : 0x8000 | rnd(0x8000));
  setWord(wram, SELECTED_SPELL_SCRIPT, pick([0, SUMMON_SPIRIT_SCRIPT, rnd(WORD)]));
  setWord(wram, AIMING_WEAPON, rnd(2) ? 0 : 0xffff);
  setWord(wram, AIMING_SPELL, rnd(2) ? 0 : 0xffff);
  setWord(wram, GLOVE_TARGET_TAG, rnd(2) ? rnd(0x8000) : 0x8000 | rnd(0x8000));
  setWord(wram, GLOVE_TARGET_OBJECT, target);
  setWord(wram, OBJECT_FLAGS + target, rnd(WORD));
  wram[RUNNER_WEAPON_KIND] = pick([0, 1, 1, rnd(BYTE)]);
  wram[RUNNER_WEAPON_KIND + 1] = rnd(12);
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
    calls.push(
      [target, ctx.a, ctx.x, ctx.y, ctx.status & LEFT_FLAGS, word(w, 0), word(w, 2)]
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
      name: 'controlPlayer 80:E014',
      entry: 0x80e014,
      samples: 600,
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
        controlPlayer(h.a, null, false, routines);
      },
      result: (h) => returned(h, referenceCalls),
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        const { routines, calls } = standIns(current);
        drainNativeSequence(controlPlayerSequence(h, null, routines));
        return returned(h, calls);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
