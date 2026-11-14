// Random per-function tests of the lifted party status (src/game/party-status.mjs)
// against the register-level 80:ED3C (src/task/native-player-control.mjs). Both sides
// call the same stand-ins for the glove's release 80:BCB2, the notice windows' release
// 80:FF79, the window 80:F963, the text 80:FE69, the cursor 80:FAAC, the number 80:FD80,
// the key wait 80:F953 and the window's release 80:FA3E. Each records its target, A, X,
// Y, the flags N, V, Z and C and the direct page words 00 and 02, and leaves registers
// and flags drawn from the sample's own sequence. WRAM outside the stack, the calls, the
// return and the registers left must be equal.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { ed3cSequence } from '../src/task/native-player-control.mjs';
import { partyStatusSequence } from '../src/game/party-status.mjs';
import { GROUP_INDEX, GROUP_LEADER_ONLY, GROUP_NUMBERS, GROUP_SLOTS } from '../src/task/wram.mjs';
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
  // The runners' object numbers (80:9700, 13 words).
  RUNNER_NUMBERS = 0x809700,
  RUNNERS = 13;
const TARGETS = [0x80bcb2, 0x80ff79, 0x80f963, 0x80fe69, 0x80faac, 0x80fd80, 0x80f953, 0x80fa3e];

const romMemory = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  runnerNumbers = Array.from({ length: RUNNERS }, (_, n) =>
    romMemory.read16(RUNNER_NUMBERS + 2 * n),
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
  // A group of one to four members, an odd last index or a larger one sometimes.
  const last = rnd(6) ? 2 * rnd(4) : rnd(0x20);
  setWord(wram, GROUP_INDEX, last);
  setWord(wram, GROUP_LEADER_ONLY, rnd(3) ? 0 : rnd(WORD));
  for (let n = 0; n <= last + 2; n += 2) {
    setWord(wram, GROUP_NUMBERS + n, rnd(12) ? runnerNumbers[rnd(RUNNERS)] : rnd(WORD));
    setWord(wram, GROUP_SLOTS + n, rnd(0x40) * 2);
  }
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
      [target, ctx.a, ctx.x, ctx.y, ctx.status & LEFT_FLAGS, word(w, 0), word(w, 2)]
        .map((v) => v.toString(HEX))
        .join(':'),
    );
    if (target === 0x80f963) setWord(w, 0, rnd(8));
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
      name: 'partyStatus 80:ED3C',
      entry: 0x80ed3c,
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
        drainNativeSequence(ed3cSequence(h, null, routines));
      },
      result: (h) => returned(h, referenceCalls),
      lifted: (h, input) => {
        Object.assign(h.ctx, input);
        h.ctx.programBank = CODE_BANK;
        h.push(CALLER_RETURN, 2);
        const { routines, calls } = standIns(current);
        drainNativeSequence(partyStatusSequence(h, null, routines));
        return returned(h, calls);
      },
    },
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
