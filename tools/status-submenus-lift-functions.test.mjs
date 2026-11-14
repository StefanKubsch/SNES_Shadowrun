// Random per-function tests of the lifted skills and notes submenus
// (src/game/status-submenus.mjs) against the register-level 80:E834 and 80:E8C8
// (src/task/native-status-screen.mjs). Both sides call the same stand-ins for the
// window 80:F963 (a window number in DP 00), the cursor 80:FAAC, the text 80:FE69, the
// number 80:FD80, the key wait 80:F953 (Select pressed or not) and the release 80:FA3E.
// Each records its target, A, X, Y, the flags N, V, Z and C and the direct page words
// 00 and 02, and leaves registers and flags drawn from the sample's own sequence. WRAM
// outside the stack, the calls, the return and the registers left must be equal.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { e834Sequence, e8c8Sequence } from '../src/task/native-status-screen.mjs';
import { notesSequence, skillsSequence } from '../src/game/status-submenus.mjs';
import {
  JAKE_DERMAL_ARMOUR,
  JAKE_SKILLSOFT,
  JAKE_WIRED_REFLEXES,
  MEMBER_DATAJACK,
  MEMBER_NUMBER,
  PAD_PRESSED,
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
  // The runners' record pointers and banks (80:971A, 80:9734), the record pointer DP
  // F9-FB at the skills (record byte 6), Jake's object number.
  RUNNER_RECORDS = 0x80971a,
  RUNNERS = 13,
  DP_RECORD = 0xf9,
  SKILLS_START = 6,
  SKILLS = 6,
  JAKE = 0x08b2,
  TARGETS = [0x80f963, 0x80faac, 0x80fe69, 0x80fd80, 0x80f953, 0x80fa3e];

const romMemory = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  records = Array.from({ length: RUNNERS }, (_, n) => [
    romMemory.read16(RUNNER_RECORDS + 2 * n),
    romMemory.read16(RUNNER_RECORDS + 2 * RUNNERS + 2 * n) & 0xff,
  ]);
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
  // Jake (his record in WRAM) in half of the samples.
  const runner = rnd(2) ? 0 : rnd(RUNNERS),
    [record, bank] = records[runner];
  setWord(wram, DP_RECORD, record + SKILLS_START);
  wram[DP_RECORD + 2] = bank;
  setWord(wram, MEMBER_NUMBER, runner === 0 || rnd(4) === 0 ? JAKE : rnd(WORD));
  if (runner === 0) {
    const known = rnd(4);
    for (let n = 0; n < SKILLS; n++)
      wram[record + SKILLS_START + n] = known && rnd(known + 1) ? 1 + rnd(9) : 0;
  }
  if (rnd(2)) setWord(wram, MEMBER_DATAJACK, 0);
  for (const flag of [JAKE_DERMAL_ARMOUR, JAKE_SKILLSOFT, JAKE_WIRED_REFLEXES])
    if (rnd(2)) wram[flag] = 0;
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
    if (target === 0x80f953) setWord(w, PAD_PRESSED, rnd(WORD));
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
const submenu = (name, entry, reference, lifted) => ({
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
    submenu('skills 80:E834', 0x80e834, e834Sequence, skillsSequence),
    submenu('notes 80:E8C8', 0x80e8c8, e8c8Sequence, notesSequence),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: IGNORED },
);
